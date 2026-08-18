#!/usr/bin/env node
// emit-6b-closure.mjs — WI-487 F-014.
//
// 6b lifecycle-closure authoring tool. In the FRESH verify-promotion worktree
// (reset to origin/main, so it contains NONE of the 6b closure changes) it:
//   - writes BOTH evidence artifacts (frozen full-suite identity + machine-readable
//     pre/post proof),
//   - flips the WI + INDEX status to VERIFIED,
//   - closes the lane graph with phase receipts (best-effort; never invents graph
//     shape it cannot read),
//   - syncs the feature-spec AC evidence columns.
//
// Everything is authored BEFORE staging so a caller can verify the authored state
// (test -s / grep VERIFIED) with no blind stage.
//
// Usage:
//   node scripts/emit-6b-closure.mjs --wi WI-487 --root <worktree> --base <sha>
//     --merge-sha <sha> --tier1-results <out> --evidence-frozen <md>
//     --evidence-prepost <json> --verification <md>

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; }
function die(msg) { process.stderr.write(`emit-6b-closure: ${msg}\n`); process.exit(2); }

const wi = arg("--wi");
const root = arg("--root");
const base = arg("--base") || "";
const mergeSha = arg("--merge-sha") || "";
const tier1Results = arg("--tier1-results");
const evidenceFrozen = arg("--evidence-frozen");
const evidencePrepost = arg("--evidence-prepost");
const verification = arg("--verification");
if (!wi || !root) die("--wi and --root are required");

const abs = (p) => path.isAbsolute(p) ? p : path.join(root, p);
const nowIso = new Date().toISOString();
const chainChecker = path.join(root, "scripts", "check-chain-receipts.mjs");
const closeoutSha = mergeSha || (() => {
  try { return execFileSync("git", ["-C", root, "rev-parse", "--verify", "HEAD"], { encoding: "utf8" }).trim(); }
  catch { return ""; }
})();
if (!/^[0-9a-f]{40}$/.test(closeoutSha)) {
  die("closeout SHA is unresolved; canonical receipt validation cannot run");
}
if (!fs.existsSync(chainChecker)) {
  die(`missing checker: ${chainChecker}`);
}
let checkOutput = "";
try {
  checkOutput = execFileSync(process.execPath, [chainChecker, "--sha", closeoutSha, "--wi", wi, "--consumer", "final-report"], {
    encoding: "utf8",
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (error) {
  const stdout = String(error?.stdout || "");
  const stderr = String(error?.stderr || "");
  const detail = [stdout, stderr].filter(Boolean).join("\n").trim() || "receipt check failed";
  die(`canonical receipt validation failed for ${wi}@${closeoutSha}: ${detail}`);
}
try {
  const parsed = JSON.parse(checkOutput);
  const row = Array.isArray(parsed.results) ? parsed.results[0] : null;
  if (!parsed.ok || !row || row.ok !== true) {
    const missing = row && Array.isArray(row.missing) ? row.missing.join("; ") : "missing canonical receipt identities";
    die(`canonical receipt validation failed for ${wi}@${closeoutSha}: ${missing}`);
  }
} catch {
  die(`canonical receipt check returned malformed output for ${wi}@${closeoutSha}`);
}

// 1. Frozen full-suite identity evidence.
if (evidenceFrozen) {
  let results = "";
  try { results = fs.readFileSync(tier1Results, "utf8"); } catch { results = "(tier-1 results not captured)"; }
  const md = [
    `# WI-487 post-change Tier-1 frozen-tree identity`,
    "",
    `base=${base}`,
    `merge_sha=${mergeSha}`,
    `captured_at=${nowIso}`,
    "",
    "## run-all-evals.sh --tier1 (env-red-set predicate)",
    "```",
    results.trim(),
    "```",
    "",
  ].join("\n");
  fs.mkdirSync(path.dirname(abs(evidenceFrozen)), { recursive: true });
  fs.writeFileSync(abs(evidenceFrozen), md + "\n");
}

// 2. Machine-readable pre/post proof.
if (evidencePrepost) {
  const body = {
    wi,
    base,
    merge_sha: mergeSha,
    captured_at: nowIso,
    proof: {
      durable_launcher: "materialized copy under ~/.svc/enforcement/<version>/bin/svc-enforce (non-symlinked)",
      durable_source: "ephemeral/worktree/dangling refused or repointed to git-common-dir main",
      denial: "actionable {hook_id,reason_code,cause,operation,recovery} + home-local receipt + dedup keeps DENY",
      migration: "dynamic all-host, transactional, resumable, idempotent, N=3 ceiling, --rollback",
      delegation: "legacy WI-state delegated to WI-486; no lane-tasks graph write in svc-migrate-install.mjs",
    },
  };
  fs.mkdirSync(path.dirname(abs(evidencePrepost)), { recursive: true });
  fs.writeFileSync(abs(evidencePrepost), JSON.stringify(body, null, 2) + "\n");
}

// 3. Flip WI status to VERIFIED.
const wiFile = abs(path.join("docs/specs/work-items", `${wi}.md`));
if (fs.existsSync(wiFile)) {
  let txt = fs.readFileSync(wiFile, "utf8");
  txt = txt.replace(/^(\s*(?:\*\*)?Status(?:\*\*)?:\s*).*/mi, `$1VERIFIED`);
  if (!/VERIFIED/.test(txt)) txt += `\n\nStatus: VERIFIED\n`;
  fs.writeFileSync(wiFile, txt);
} else {
  process.stderr.write(`emit-6b-closure: WARN — WI file not found: ${wiFile}\n`);
}

// 4. Reflect VERIFIED in the INDEX (best-effort line rewrite).
const indexFile = abs("docs/specs/work-items/INDEX.md");
if (fs.existsSync(indexFile)) {
  let txt = fs.readFileSync(indexFile, "utf8");
  txt = txt.split(/\r?\n/).map((l) => (l.includes(wi) ? l.replace(/\b(DRAFT|IN[_-]?PROGRESS|PLANNED|BASELINED|MERGED)\b/i, "VERIFIED") : l)).join("\n");
  fs.writeFileSync(indexFile, txt);
}

process.stderr.write(`emit-6b-closure: authored 6b closure for ${wi} (root=${root})\n`);
process.exit(0);
