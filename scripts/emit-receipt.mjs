#!/usr/bin/env node
/**
 * One-call receipt emitter for chain skills.
 *
 * Writes a JSON receipt to staging (when no commit yet) or SHA mirror,
 * validates against its schema, and updates the consolidated git note
 * on refs/notes/svc-receipts.
 *
 * Usage:
 *   echo '<receipt-json>' | node scripts/emit-receipt.mjs \
 *       --type plan-manifest --wi WI-XXX
 *
 *   node scripts/emit-receipt.mjs --type review-exec --wi WI-XXX \
 *       --body path/to/receipt.json
 *
 * Required arguments:
 *   --type <receipt-type>    plan-manifest, exec-record, review-plan,
 *                            review-exec, audit-implementation,
 *                            verify-promotion, quick-fix
 *   --wi <wi-id>             work-item identifier
 *
 * Optional:
 *   --body <path>            read receipt body from file; default is stdin
 *   --no-note                skip writing the git note (mirror only)
 *   --phase <phase-id>       optional identity phase for multi-phase receipts
 *
 * Exit 0 on success, 1 on validation error, 2 on usage error.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { writeJsonAtomic } from "./state-io.mjs";
import { acquireLock } from "./state-lock.mjs";
import { familyOf } from "./lib/cognitive-family.mjs";   // WI-385 mechanical cross-family resolution
import { verifyReviewerEvidence } from "./lib/reviewer-evidence.mjs";

// WI-386: SCRIPT_DIR-relative, not cwd-relative. A cwd-relative SCHEMA_DIR returned
// null from any other directory, so loadSchema → validateReceipt became a no-op that
// accepted EVERY receipt (the WI-396 cwd-skip class, here on the emit side). That
// silently fails the mode-conditional blueprint gate OPEN. Resolve against this
// script's own location so the gate enforces regardless of caller cwd.
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = join(SCRIPT_DIR, "..", "schemas", "receipts");
const SLOT_PREFIX = "slot::";

function fail(msg, code = 2) {
  console.error(`emit-receipt: ${msg}`);
  process.exit(code);
}

function git(args) {
  try { return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e) { return null; }
}

function parseArgs(argv) {
  const out = { type: null, wi: null, body: null, noNote: false, sha: null, phase: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--type") out.type = argv[++i];
    else if (a === "--wi") out.wi = argv[++i];
    else if (a === "--body") out.body = argv[++i];
    else if (a === "--no-note") out.noNote = true;
    else if (a === "--sha") out.sha = argv[++i];
    else if (a === "--phase") out.phase = argv[++i];
  }
  return out;
}

function receiptDigest(receipt) {
  return createHash("sha256").update(JSON.stringify(receipt)).digest("hex");
}

function sleepMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return;
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {}
}

function slotKeyForIdentity({ type, wi, targetSha, phase = null }) {
  return `${SLOT_PREFIX}${type}::${wi}::${targetSha}${phase ? `::${phase}` : ""}`;
}

function readJsonFileIfExists(filePath) {
  if (!existsSync(filePath)) return null;
  try { return JSON.parse(readFileSync(filePath, "utf8")); }
  catch { return null; }
}

function parseCompositeSlotKey(key) {
  if (typeof key !== "string" || !key.startsWith(SLOT_PREFIX)) return null;
  const tail = key.slice(SLOT_PREFIX.length);
  const parts = tail.split("::");
  if (parts.length < 3 || parts.length > 4) return null;
  const [type, wi, targetSha, phase] = parts;
  if (!type || !wi || !/^[0-9a-f]{40}$/.test(String(targetSha))) return null;
  return { type, wi, targetSha, phase: phase || null };
}

function normalizeMirrorEnvelope(mirrorDir, targetSha) {
  const envelope = {};
  if (!existsSync(mirrorDir)) return envelope;
  try {
    for (const name of readdirSync(mirrorDir)) {
      if (!name.endsWith(".json")) continue;
      const content = readJsonFileIfExists(join(mirrorDir, name));
      if (!content || typeof content !== "object") continue;
      const type = typeof content.receipt_type === "string" ? content.receipt_type : name.replace(/\.json$/, "");
      const wi = typeof content.wi === "string" && content.wi.length > 0 ? content.wi : null;
      const phase = typeof content.phase === "string" && content.phase.length > 0 ? content.phase : null;
      if (wi && targetSha) {
        envelope[slotKeyForIdentity({ type, wi, targetSha, phase })] = content;
        continue;
      }
      envelope[type] = content;
    }
  } catch {}
  return envelope;
}

function supersessionFor(receipt) {
  const supersession = receipt?.supersession;
  if (!supersession || typeof supersession !== "object" || Array.isArray(supersession)) return null;
  return supersession;
}

function validateSupersession(receipt, previousReceipt) {
  const supersession = supersessionFor(receipt);
  if (!supersession) return "existing identity slot; re-emission requires supersession contract";
  const contract = String(supersession.contract || "");
  const contractSha = String(supersession.contract_sha256 || "");
  const priorSha = String(supersession.supersedes_receipt_sha256 || "");
  if (!contract || contract.length < 16) return "supersession.contract must be a meaningful non-empty string";
  if (!/^[0-9a-f]{64}$/.test(contractSha)) return "supersession.contract_sha256 must be a 64-hex sha256";
  const computedContractSha = createHash("sha256").update(contract).digest("hex");
  if (computedContractSha !== contractSha) return "supersession.contract_sha256 does not match supersession.contract";
  if (!/^[0-9a-f]{64}$/.test(priorSha)) return "supersession.supersedes_receipt_sha256 must be a 64-hex sha256";
  const previousDigest = receiptDigest(previousReceipt);
  if (previousDigest !== priorSha) return "supersession.supersedes_receipt_sha256 does not match existing receipt bytes";
  return null;
}

function readBody(args) {
  if (args.body) {
    if (!existsSync(args.body)) fail(`body file not found: ${args.body}`);
    return readFileSync(args.body, "utf8");
  }
  return readFileSync(0, "utf8");
}

function loadSchema(type) {
  const p = join(SCHEMA_DIR, `${type}.schema.json`);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf8")); }
  catch (e) { return null; }
}

function validateReceipt(type, body) {
  const schema = loadSchema(type);
  if (!schema) return { valid: true, reasons: [] };
  if (typeof body !== "object" || body === null) {
    return { valid: false, reasons: ["not an object"] };
  }
  if (body.receipt_type !== type) {
    return { valid: false, reasons: [`receipt_type=${body.receipt_type} expected ${type}`] };
  }
  let required = schema.required || [];
  // WI-381: the plan-manifest pipeline baton (ac_digests) is required only for
  // v3+ receipts; legacy/other-harness emissions stay valid without it (non-
  // breaking, parity with check-chain-receipts' grandfather). New plan-changeset
  // runs emit schema_version 3 with the baton.
  if (type === "plan-manifest" && Number(body.schema_version) < 3) {
    required = required.filter((k) => k !== "ac_digests");
  }
  // WI-386: conditional blueprints — symmetric with check-chain-receipts.mjs and the
  // schema's allOf if/then. changeset_blueprints left the top-level `required`; it is
  // required at EMIT time UNLESS the receipt explicitly self-declares mode:inline.
  // Fail-closed on absent/forged mode (dispatch semantics) so emission never produces a
  // blueprint-less receipt for the zero-context executor path (WI-347 guarantee).
  if (type === "plan-manifest" && body.mode !== "inline") {
    if (!required.includes("changeset_blueprints")) required = [...required, "changeset_blueprints"];
  }
  const missing = required.filter((k) => !(k in body));
  if (missing.length > 0) {
    return { valid: false, reasons: [`missing required: ${missing.join(", ")}`] };
  }
  if ((type === "review-plan" || type === "review-exec") && Number(body.schema_version) >= 3) {
    const evidenceReasons = verifyReviewerEvidence({ root: process.cwd(), reviewKind: type === "review-plan" ? "plan" : "exec", body });
    if (evidenceReasons.length) return { valid: false, reasons: evidenceReasons };
  }
  return { valid: true, reasons: [] };
}

function candidateHasDeletions(targetSha = null) {
  const command = targetSha
    ? ["diff-tree", "--no-commit-id", "--name-status", "-r", "--end-of-options", targetSha]
    : ["diff", "--name-status", "HEAD"];
  const output = git(command) || "";
  return output.split(/\r?\n/).some((line) => /^(?:D|R\d*|C\d*)\t/.test(line));
}

function writeNote(sha, type, wi, phase, receipt) {
  // WI-550:
  // - Canonical identity key: {receipt_type, wi, target_sha, phase?}
  // - Concurrent safety primitive: lock + CAS + retry (no check-then-write)
  // - Second write of the same identity requires explicit supersession contract
  const shortSha = sha.substring(0, 7);
  const mirrorDir = join(".svc", "receipts", shortSha);
  const noteSlotKey = slotKeyForIdentity({ type, wi, targetSha: sha, phase });
  const notesRef = "refs/notes/svc-receipts";
  const commonDir = git(["rev-parse", "--git-common-dir"]) || ".git";
  const lockDir = join(commonDir, "svc-receipts-locks");
  const lockStem = join(lockDir, `${shortSha}-note`);
  mkdirSync(lockDir, { recursive: true });

  let release = null;
  const deadline = Date.now() + 15000;
  while (!release) {
    try {
      release = acquireLock(lockStem, { staleMs: 60_000 });
    } catch (e) {
      if (Date.now() >= deadline) {
        return { ok: false, reason: `lock timeout (${String(e.message || e)})`, slot_key: noteSlotKey };
      }
      sleepMs(125);
    }
  }

  try {
    for (let attempt = 1; attempt <= 8; attempt++) {
      const refBefore = git(["rev-parse", "--verify", notesRef]) || "";
      const envelope = {};

      const existing = git(["notes", "--ref=svc-receipts", "show", sha]);
      if (existing) {
        try { Object.assign(envelope, JSON.parse(existing)); }
        catch {
          return { ok: false, reason: "existing receipt note is malformed JSON", slot_key: noteSlotKey };
        }
      }

      Object.assign(envelope, normalizeMirrorEnvelope(mirrorDir, sha));

      const existingSameSlot = envelope[noteSlotKey];
      if (existingSameSlot) {
        const supersessionError = validateSupersession(receipt, existingSameSlot);
        if (supersessionError) {
          return { ok: false, reason: supersessionError, slot_key: noteSlotKey };
        }
      }

      const refNow = git(["rev-parse", "--verify", notesRef]) || "";
      if (refNow !== refBefore) {
        sleepMs(25 * attempt);
        continue;
      }

      envelope[noteSlotKey] = receipt;

      const tmpPath = join(tmpdir(), `svc-note-${process.pid}-${Date.now()}-${attempt}.json`);
      writeFileSync(tmpPath, JSON.stringify(envelope));
      let wrote = false;
      try {
        execFileSync("git", ["notes", "--ref=svc-receipts", "add", "-f", "-F", tmpPath, sha], { stdio: "pipe" });
        wrote = true;
      } catch (e) {
        wrote = false;
      } finally {
        try { unlinkSync(tmpPath); } catch {}
      }
      if (!wrote) {
        sleepMs(25 * attempt);
        continue;
      }

      const verifyRaw = git(["notes", "--ref=svc-receipts", "show", sha]);
      if (!verifyRaw) {
        sleepMs(25 * attempt);
        continue;
      }
      try {
        const parsed = JSON.parse(verifyRaw);
        if (parsed && parsed[noteSlotKey] && receiptDigest(parsed[noteSlotKey]) === receiptDigest(receipt)) {
          return { ok: true, slot_key: noteSlotKey };
        }
      } catch {}
      sleepMs(25 * attempt);
    }
    return { ok: false, reason: "failed to persist identity slot after retries", slot_key: noteSlotKey };
  } finally {
    if (release) release();
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.type) fail("--type <receipt-type> required");
  if (!args.wi) fail("--wi <wi-id> required");
  let explicitTargetSha = null;
  if (args.sha) {
    explicitTargetSha = git(["rev-parse", "--verify", "--end-of-options", `${args.sha}^{commit}`]);
    if (!explicitTargetSha || !/^[0-9a-f]{40}$/.test(explicitTargetSha)) fail(`provided --sha '${args.sha}' is not a valid commit in git`, 2);
  }

  const raw = readBody(args);
  let body;
  try { body = JSON.parse(raw); }
  catch (e) { fail(`body is not valid JSON: ${e.message}`, 1); }

  body.receipt_type = body.receipt_type || args.type;
  body.schema_version = body.schema_version || 1;
  body.wi = body.wi || args.wi;
  if (args.phase) body.phase = body.phase || args.phase;
  body.timestamp = body.timestamp || new Date().toISOString();

  // Every review receipt produced after the WI-541 contract is v3. Historical
  // v1/v2 receipts remain readable, but the producer can no longer mint a new
  // receipt that skips direct reviewer-run evidence through version selection.
  if (args.type === "review-plan" || args.type === "review-exec") {
    body.schema_version = Math.max(3, Number(body.schema_version) || 1);
    if (body.reviewer_evidence && typeof body.reviewer_evidence === "object") {
      body.reviewer_evidence.deletion_bearing = candidateHasDeletions(explicitTargetSha);
    }
  }

  // WI-385: MECHANICALLY resolve the cross-family fields on review-exec from the
  // ACTUAL review hosts (orchestrator = author; the USED adversarial host =
  // reviewer). Gemini G6 #3: OVERWRITE unconditionally — never respect a body-
  // supplied author_family/reviewer_family, else a forged cross-family pair (while
  // the real hosts were same-family) would slip the fence. The hosts are the
  // single source of truth; the declared families are derived, not asserted.
  if (args.type === "review-exec" && body) {
    try {
      const sr = body.self_review || {};
      const ar = body.adversarial_review || {};
      const reviewerHost = ar.fallback_used ? ar.fallback_host : ar.primary_reviewer_host;
      if (sr.orchestrator) body.author_family = familyOf(sr.orchestrator);
      if (reviewerHost) body.reviewer_family = familyOf(reviewerHost);
    } catch { /* fail-open here only means families stay as-is → check-chain re-derives + verifies */ }
  }

  const v = validateReceipt(args.type, body);
  if (!v.valid) fail(`receipt invalid: ${v.reasons.join("; ")}`, 1);

  let targetSha = explicitTargetSha;
  let writeStaging = false;
  const treeHash = git(["write-tree"]);

  if (targetSha) {
    // Already resolved and verified before any candidate-dependent operation.
  } else {
    targetSha = git(["rev-parse", "--verify", "HEAD"]);
    const headTree = targetSha ? git(["rev-parse", `${targetSha}^{tree}`]) : null;
    writeStaging = !targetSha || !treeHash || treeHash !== headTree;
    if (writeStaging) targetSha = null;
  }

  let mirrorPath;
  let mirrorAliasPath = null;
  const phaseIdentity = args.phase || (typeof body.phase === "string" ? body.phase : null);
  if (writeStaging) {
    if (!treeHash) fail("could not compute tree hash for staging");
    const dir = join(".svc", "receipts", "staging", treeHash);
    mkdirSync(dir, { recursive: true });
    const slotName = `${args.type}--${args.wi}${phaseIdentity ? `--${phaseIdentity}` : ""}`;
    mirrorPath = join(dir, `${slotName}.json`);
    mirrorAliasPath = join(dir, `${args.type}.json`);
  } else {
    const shortSha = targetSha.substring(0, 7);
    const dir = join(".svc", "receipts", shortSha);
    mkdirSync(dir, { recursive: true });
    const slotName = `${args.type}--${args.wi}${phaseIdentity ? `--${phaseIdentity}` : ""}`;
    mirrorPath = join(dir, `${slotName}.json`);
    mirrorAliasPath = join(dir, `${args.type}.json`);
  }

  // WI-396: bind exec-record/review-exec to the commit TREE (squash-invariant,
  // unlike diff_hash) so check-chain-receipts can reject a forged or mis-bound
  // receipt — symmetric to the quick-fix tree_hash bind. schema_version 2 is the
  // EXPLICIT "tree-bound" marker (codex G6: grandfather by metadata, not by
  // tree_hash absence — else a forger omits tree_hash to skip every check).
  if ((targetSha || writeStaging) && (args.type === "exec-record" || args.type === "review-exec")) {
    const boundTree = targetSha ? git(["rev-parse", `${targetSha}^{tree}`]) : treeHash;
    if (boundTree) body.tree_hash = boundTree;
    body.schema_version = Math.max(2, Number(body.schema_version) || 1);
  }

  if (targetSha) {
    body.target_sha = body.target_sha || targetSha;
    body.sha = body.sha || targetSha;
  }

  const existingMirrorSlot = readJsonFileIfExists(mirrorPath);
  if (existingMirrorSlot) {
    const supersessionError = validateSupersession(body, existingMirrorSlot);
    if (supersessionError) {
      fail(`refused mirror overwrite for identity slot ${mirrorPath}: ${supersessionError}`, 1);
    }
  }

  let noteWritten = false;
  let noteSlotKey = null;
  if (!args.noNote && targetSha) {
    const noteResult = writeNote(targetSha, args.type, args.wi, phaseIdentity, body);
    noteWritten = noteResult.ok;
    noteSlotKey = noteResult.slot_key || null;
    if (!noteResult.ok) {
      fail(`refused note write for identity slot (${noteResult.slot_key || "unknown"}): ${noteResult.reason}`, 1);
    }
  }

  writeJsonAtomic(mirrorPath, body);
  // Compatibility alias: preserve historical <type>.json readers only when this
  // does not clobber a different WI's receipt.
  if (mirrorAliasPath) {
    const existingAlias = readJsonFileIfExists(mirrorAliasPath);
    const aliasOwnedBySameWi = existingAlias && String(existingAlias.wi || "") === String(body.wi || "");
    if (!existingAlias || aliasOwnedBySameWi) {
      writeJsonAtomic(mirrorAliasPath, body);
    }
  }

  console.log(JSON.stringify({
    ok: true,
    mirror_path: mirrorPath,
    mirror_alias_path: mirrorAliasPath,
    note_written: noteWritten,
    staging: writeStaging,
    type: args.type,
    wi: args.wi,
    phase: phaseIdentity,
    note_slot_key: noteSlotKey,
  }, null, 2));
}

main();
