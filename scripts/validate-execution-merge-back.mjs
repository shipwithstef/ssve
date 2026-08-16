#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { matchesAny, readDelegation, validateCompletionReceiptShape, updateDelegationStatus } from "../hooks/lib/delegation-authority.mjs";
import { withStateLock } from "./state-io.mjs";

function parse(argv) { const flags = {}; for (let i = 0; i < argv.length; i += 1) { const key = argv[i]; if (!key.startsWith("--")) throw new Error(`unexpected argument: ${key}`); const next = argv[i + 1]; if (next !== undefined && !next.startsWith("--")) { flags[key] = next; i += 1; } else flags[key] = true; } return flags; }
function required(flags, key) { if (!flags[key] || flags[key] === true) throw new Error(`missing ${key}`); return String(flags[key]); }
function git(cwd, args, options = {}) { return execFileSync("git", ["-C", cwd, ...args], { encoding: options.binary ? undefined : "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
function digest(buffer) { return `sha256:${crypto.createHash("sha256").update(buffer).digest("hex")}`; }
function normalize(value) { const text = String(value).replaceAll("\\", "/").replace(/^\.\//, ""); if (!text || text.startsWith("/") || text.split("/").includes("..")) throw new Error(`unsafe changed path: ${value}`); return path.posix.normalize(text); }

export function validateMergeBack({ stateRoot, delegationId, lease, receipt, expectedIntegrationHead = null }) {
  const capability = readDelegation({ stateRoot, delegationId });
  const shape = validateCompletionReceiptShape(receipt); if (!shape.ok) throw new Error(`completion receipt missing: ${shape.missing.join(", ")}`);
  if (capability.status === "merged") throw new Error(`delegation already merged into ${capability.integration_mapping?.integration_commit || "an integration commit"}`);
  if (capability.status === "frozen") throw new Error("old-generation child result is frozen pending adoption");
  if (!["accepted", "running", "completed"].includes(capability.status)) throw new Error(`delegation status is not mergeable: ${capability.status}`);
  if (!lease || lease.state !== "active" || lease.lease_id !== capability.parent_lease_id || lease.generation !== capability.authority_generation) throw new Error("controller generation no longer matches delegation");
  if (receipt.delegation_id !== capability.delegation_id || receipt.child_principal !== capability.child_principal || receipt.authority_generation !== capability.authority_generation || receipt.task_id !== capability.task_id) throw new Error("completion receipt identity mismatch");
  if (receipt.base_sha !== capability.base_sha) throw new Error("completion receipt base mismatch");
  const inner = fs.realpathSync(capability.inner_worktree);
  try { git(inner, ["merge-base", "--is-ancestor", receipt.base_sha, receipt.head_sha]); } catch { throw new Error("completion head does not descend from base"); }
  const actualHead = git(inner, ["rev-parse", "HEAD"]).trim(); if (actualHead !== receipt.head_sha) throw new Error("completion head is not inner worktree HEAD");
  const files = git(inner, ["diff", "--name-only", `${receipt.base_sha}..${receipt.head_sha}`]).trim().split(/\r?\n/).filter(Boolean).map(normalize).sort();
  const declared = [...receipt.files_written].map(normalize).sort(); if (JSON.stringify(files) !== JSON.stringify(declared)) throw new Error("completion files do not match actual diff");
  for (const file of files) { if (matchesAny(file, capability.denied_paths)) throw new Error(`denied file changed: ${file}`); if (!matchesAny(file, capability.allowed_paths)) throw new Error(`unknown file changed: ${file}`); }
  const actualDigest = digest(git(inner, ["diff", "--binary", `${receipt.base_sha}..${receipt.head_sha}`], { binary: true })); if (actualDigest !== receipt.diff_digest) throw new Error("completion diff digest mismatch");
  const actualCommits = git(inner, ["rev-list", "--reverse", `${receipt.base_sha}..${receipt.head_sha}`]).trim().split(/\r?\n/).filter(Boolean);
  if (JSON.stringify(actualCommits) !== JSON.stringify(receipt.commits)) throw new Error("completion commits do not match actual commit range");
  if (!receipt.clean_worktree || git(inner, ["status", "--porcelain"]).trim()) throw new Error("child worktree is not clean");
  if (!Array.isArray(receipt.validation) || receipt.validation.length === 0 || receipt.validation.some((entry) => Number(entry.exit_code) !== 0 || !entry.output_digest)) throw new Error("required validation did not pass");
  if (expectedIntegrationHead && !/^[0-9a-f]{40}$/.test(expectedIntegrationHead)) throw new Error("invalid expected integration head");
  return { ok: true, capability, files, actual_digest: actualDigest, expected_integration_head: expectedIntegrationHead };
}

export function run(argv = process.argv.slice(2)) {
  const flags = parse(argv); const stateRoot = path.resolve(required(flags, "--state-root")); const delegationId = required(flags, "--delegation");
  const lease = JSON.parse(fs.readFileSync(path.resolve(required(flags, "--lease")), "utf8")); const receipt = JSON.parse(fs.readFileSync(path.resolve(required(flags, "--receipt")), "utf8"));
  const validated = validateMergeBack({ stateRoot, delegationId, lease, receipt, expectedIntegrationHead: flags["--expected-integration-head"] || null });
  let mapping = null;
  if (flags["--merge"]) {
    if (!flags["--expected-integration-head"]) throw new Error("--merge requires --expected-integration-head");
    const integration = fs.realpathSync(path.resolve(required(flags, "--integration-worktree")));
    const commits = git(validated.capability.inner_worktree, ["rev-list", "--reverse", `${receipt.base_sha}..${receipt.head_sha}`]).trim().split(/\r?\n/).filter(Boolean);
    const requiredValidation = validated.capability.validation_commands || [];
    if (!requiredValidation.length) throw new Error("merge requires controller-defined validation commands");
    const lockKey = crypto.createHash("sha256").update(integration).digest("hex");
    mapping = withStateLock(path.join(stateRoot, "integration-locks", `${lockKey}.json`), () => {
      const before = git(integration, ["rev-parse", "HEAD"]).trim();
      if (before !== flags["--expected-integration-head"]) throw new Error("integration assumptions changed before merge");
      if (git(integration, ["status", "--porcelain"]).trim()) throw new Error("integration worktree must be clean before merge");
      try {
        git(integration, ["fetch", "--quiet", validated.capability.inner_worktree, receipt.head_sha]);
        for (const commit of commits) git(integration, ["cherry-pick", commit]);
        for (const command of requiredValidation) execFileSync("bash", ["-lc", command], { cwd: integration, stdio: ["ignore", "pipe", "pipe"] });
        const after = git(integration, ["rev-parse", "HEAD"]).trim(); const next = { source_head: receipt.head_sha, integration_before: before, integration_commit: after };
        updateDelegationStatus({ stateRoot, delegationId, status: "merged", details: { integration_mapping: next } });
        return next;
      } catch (error) {
        try { git(integration, ["cherry-pick", "--abort"]); } catch {}
        try { git(integration, ["reset", "--hard", before]); } catch (rollbackError) { throw new Error(`merge rejected and rollback failed: ${error.message}; ${rollbackError.message}`); }
        updateDelegationStatus({ stateRoot, delegationId, status: "failed", reason: "merge_or_validation_rejected_and_rolled_back" });
        throw new Error(`merge rejected and rolled back: ${error.message}`);
      }
    });
  }
  const result = { ...validated, mapping };
  if (flags["--out"]) fs.writeFileSync(path.resolve(flags["--out"]), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { run(); } catch (error) { process.stderr.write(`[validate-execution-merge-back] ${error.message}\n`); process.exit(2); }
}
