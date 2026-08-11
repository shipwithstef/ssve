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
 *
 * Exit 0 on success, 1 on validation error, 2 on usage error.
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { writeJsonAtomic, appendJsonlLine } from "./state-io.mjs";
import { acquireLock } from "./state-lock.mjs";
import { familyOf } from "./lib/cognitive-family.mjs";   // WI-385 mechanical cross-family resolution

// WI-386: SCRIPT_DIR-relative, not cwd-relative. A cwd-relative SCHEMA_DIR returned
// null from any other directory, so loadSchema → validateReceipt became a no-op that
// accepted EVERY receipt (the WI-396 cwd-skip class, here on the emit side). That
// silently fails the mode-conditional blueprint gate OPEN. Resolve against this
// script's own location so the gate enforces regardless of caller cwd.
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = join(SCRIPT_DIR, "..", "schemas", "receipts");

function fail(msg, code = 2) {
  console.error(`emit-receipt: ${msg}`);
  process.exit(code);
}

function git(args) {
  try { return execSync(`git ${args}`, { encoding: "utf8" }).trim(); }
  catch (e) { return null; }
}

function parseArgs(argv) {
  const out = { type: null, wi: null, body: null, noNote: false, sha: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--type") out.type = argv[++i];
    else if (a === "--wi") out.wi = argv[++i];
    else if (a === "--body") out.body = argv[++i];
    else if (a === "--no-note") out.noNote = true;
    else if (a === "--sha") out.sha = argv[++i];
  }
  return out;
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
  return { valid: true, reasons: [] };
}

function writeNote(sha, type, receipt) {
  // Per codex P1 review:
  //   1. Git note is the DURABLE store. Mirror is a regenerable cache that
  //      may be empty (fresh clone, GC, manual wipe). Seed envelope from
  //      existing note BEFORE overlaying mirror — otherwise we overwrite
  //      durable receipts with an incomplete local view.
  //   2. Even with mirror-union, snapshot-then-write isn't atomic between
  //      processes. Lock the read+merge+write critical section.

  const shortSha = sha.substring(0, 7);
  const mirrorDir = join(".svc", "receipts", shortSha);
  mkdirSync(".svc/receipts", { recursive: true });
  const sentinelPath = join(".svc/receipts", `.notes-${shortSha}`);

  let release = null;
  try {
    // Acquire lock with retry (up to 10s). acquireLock uses O_EXCL on
    // <sentinel>.lock; concurrent writers serialize cleanly.
    const deadline = Date.now() + 10000;
    while (true) {
      try { release = acquireLock(sentinelPath); break; }
      catch (e) {
        if (Date.now() > deadline) break;  // proceed best-effort
        const t0 = Date.now();
        while (Date.now() - t0 < 100) { /* spin 100ms */ }
      }
    }

    // 1. Seed from existing durable note (so we never lose keys that were
    //    only on the note and not in the local mirror cache).
    const envelope = {};
    const existing = git(`notes --ref=svc-receipts show ${sha} 2>/dev/null`);
    if (existing) {
      try { Object.assign(envelope, JSON.parse(existing)); } catch {}
    }

    // 2. Overlay mirror union (any receipts written locally that aren't
    //    yet in the note — typically the just-written receipt).
    if (existsSync(mirrorDir)) {
      try {
        for (const name of readdirSync(mirrorDir)) {
          if (!name.endsWith(".json")) continue;
          const typeName = name.replace(/\.json$/, "");
          try {
            envelope[typeName] = JSON.parse(readFileSync(join(mirrorDir, name), "utf8"));
          } catch {}
        }
      } catch {}
    }

    // 3. Overlay current receipt explicitly (safety net for fsync races).
    envelope[type] = receipt;

    // 4. Write via tempfile (no shell-escape bugs).
    const tmpPath = join(tmpdir(), `svc-note-${process.pid}-${Date.now()}.json`);
    writeFileSync(tmpPath, JSON.stringify(envelope));
    try {
      execSync(`git notes --ref=svc-receipts add -f -F "${tmpPath}" ${sha}`, { stdio: "pipe" });
      return true;
    } catch (e) {
      return false;
    } finally {
      try { unlinkSync(tmpPath); } catch {}
    }
  } finally {
    if (release) release();
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.type) fail("--type <receipt-type> required");
  if (!args.wi) fail("--wi <wi-id> required");

  const raw = readBody(args);
  let body;
  try { body = JSON.parse(raw); }
  catch (e) { fail(`body is not valid JSON: ${e.message}`, 1); }

  body.receipt_type = body.receipt_type || args.type;
  body.schema_version = body.schema_version || 1;
  body.wi = body.wi || args.wi;
  body.timestamp = body.timestamp || new Date().toISOString();

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

  let targetSha = args.sha;
  let writeStaging = false;

  if (targetSha) {
    const resolved = git(`rev-parse --verify ${targetSha} 2>/dev/null`);
    if (!resolved) {
      fail(`provided --sha '${targetSha}' is not a valid commit in git`, 2);
    }
    targetSha = resolved;
  } else {
    targetSha = git("rev-parse --verify HEAD 2>/dev/null");
    writeStaging = !targetSha;

    if (targetSha) {
      try {
        appendJsonlLine(".svc/pipeline-decisions.jsonl", {
          timestamp: new Date().toISOString(),
          run_id: args.wi,
          skill: "emit-receipt",
          type: "mechanical",
          decision: "deprecation-warning",
          reasoning: `Implicit checkout HEAD resolution was used because --sha was not provided for receipt type '${args.type}'. This fallback is deprecated to prevent concurrent checkout session collision receipt mis-routing.`,
          decided_by: "P0",
          overrideable: false
        });
      } catch (e) {
        console.warn(`emit-receipt warning: failed to write deprecation entry to pipeline-decisions.jsonl: ${e.message}`);
      }
    }
  }

  const treeHash = git("write-tree");

  let mirrorPath;
  if (writeStaging) {
    if (!treeHash) fail("could not compute tree hash for staging");
    const dir = join(".svc", "receipts", "staging", treeHash);
    mkdirSync(dir, { recursive: true });
    mirrorPath = join(dir, `${args.type}.json`);
  } else {
    const shortSha = targetSha.substring(0, 7);
    const dir = join(".svc", "receipts", shortSha);
    mkdirSync(dir, { recursive: true });
    mirrorPath = join(dir, `${args.type}.json`);
  }

  // WI-396: bind exec-record/review-exec to the commit TREE (squash-invariant,
  // unlike diff_hash) so check-chain-receipts can reject a forged or mis-bound
  // receipt — symmetric to the quick-fix tree_hash bind. schema_version 2 is the
  // EXPLICIT "tree-bound" marker (codex G6: grandfather by metadata, not by
  // tree_hash absence — else a forger omits tree_hash to skip every check).
  if (targetSha && (args.type === "exec-record" || args.type === "review-exec")) {
    const commitTree = git(`rev-parse ${targetSha}^{tree} 2>/dev/null`);
    if (commitTree) body.tree_hash = commitTree;
    body.schema_version = Math.max(2, Number(body.schema_version) || 1);
  }

  writeJsonAtomic(mirrorPath, body);

  let noteWritten = false;
  if (!args.noNote && targetSha) {
    noteWritten = writeNote(targetSha, args.type, body);
  }

  console.log(JSON.stringify({
    ok: true,
    mirror_path: mirrorPath,
    note_written: noteWritten,
    staging: writeStaging,
    type: args.type,
    wi: args.wi,
  }, null, 2));
}

main();
