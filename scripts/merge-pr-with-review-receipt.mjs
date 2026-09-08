#!/usr/bin/env node
import path from "node:path";
import os from "node:os";
import { publishReceiptNotes, readPublishedReceiptNote, mergeReceiptEnvelopes } from "./lib/publish-receipt-notes.mjs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function argValue(name) {
  const idx = process.argv.indexOf(name);
  return idx === -1 ? null : process.argv[idx + 1] || null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

export function namedWisFromText(text) {
  return [...new Set(String(text || "").match(/WI-\d+/gi) || [])].map((id) => id.toUpperCase());
}

export function omittedWisFromText(text) {
  return [...String(text || "").matchAll(/\b(?:omitted|excluded|reverted):\s*(WI-\d+)/gi)]
    .map((match) => match[1].toUpperCase());
}

export function missingNamedWis({ namedWis = [], netFiles = [], dispositionText = "" } = {}) {
  const omitted = new Set(omittedWisFromText(dispositionText));
  const files = (netFiles || []).map((file) => String(file).toLowerCase());
  const missing = [];
  for (const wi of namedWis) {
    const id = String(wi || "").toUpperCase();
    if (!id || omitted.has(id)) continue;
    const token = id.toLowerCase();
    if (files.some((file) => file.includes(token))) continue;
    missing.push(id);
  }
  return missing;
}

const root = path.resolve(argValue("--root") || process.cwd());
const pr = argValue("--pr");
const dryRun = hasFlag("--dry-run");
const explicitRepo = argValue("--repo");
const expectedRepo = argValue("--expected-repo");
const expectedHead = argValue("--expected-head");
const expectedHeadSha = argValue("--expected-head-sha");

if (!pr || !/^[0-9]+$/.test(pr)) {
  console.error(
    "Usage: node scripts/merge-pr-with-review-receipt.mjs --pr <number> [--root <dir>] [--repo owner/name] [--squash] [--delete-branch] [--dry-run]",
  );
  process.exit(2);
}

function gitOutput(args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

function repoFromRemoteUrl(url) {
  const trimmed = String(url || "").trim();
  const match =
    trimmed.match(/github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?$/) ||
    trimmed.match(/^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/);
  return match ? `${match[1]}/${match[2]}` : "";
}

function resolveRepo() {
  if (explicitRepo) return explicitRepo;
  const remote = gitOutput(["remote", "get-url", "origin"]);
  const repo = repoFromRemoteUrl(remote);
  if (repo) return repo;
  console.error(
    "[svc-pr-merge-review-receipt] BLOCKED: cannot resolve GitHub repo. Pass --repo owner/name.",
  );
  process.exit(2);
}

const validate = spawnSync(
  process.execPath,
  [path.join(__dirname, "validate-review-receipt.mjs"), "--root", root, "--pr", pr],
  { cwd: root, encoding: "utf8" },
);

if (validate.status !== 0) {
  if (validate.stdout) process.stdout.write(validate.stdout);
  if (validate.stderr) process.stderr.write(validate.stderr);
  console.error(
    `[svc-pr-merge-review-receipt] BLOCKED: PR ${pr} is not eligible for merge from this shell surface.`,
  );
  process.exit(validate.status || 1);
}

if (validate.stdout) process.stdout.write(validate.stdout);

let alreadyMerged = false;
let mergedOid = null;
const ghArgs = ["pr", "merge", pr];
const repo = resolveRepo();
if (expectedRepo || expectedHead || expectedHeadSha) {
  if (!expectedRepo || !expectedHead || !/^[0-9a-f]{40}$/.test(expectedHeadSha || "") || repo !== expectedRepo) {
    console.error("[svc-pr-merge-review-receipt] BLOCKED: exact expected repo/head/head-sha binding is required."); process.exit(2);
  }
  if (!dryRun) {
    const prView = spawnSync("gh", ["pr", "view", pr, "--repo", repo, "--json", "headRefName,headRefOid"], { encoding: "utf8" });
    let prIdentity;
    try { prIdentity = prView.status === 0 ? JSON.parse(prView.stdout) : null; } catch { prIdentity = null; }
    if (!prIdentity || prIdentity.headRefName !== expectedHead || prIdentity.headRefOid !== expectedHeadSha) {
      if (prView.stderr) process.stderr.write(prView.stderr);
      console.error("[svc-pr-merge-review-receipt] BLOCKED: PR head identity does not match the promotion tuple."); process.exit(2);
    }
  }
}
ghArgs.push("--repo", repo);
if (hasFlag("--squash")) ghArgs.push("--squash");
if (hasFlag("--delete-branch")) ghArgs.push("--delete-branch");
if (hasFlag("--rebase")) ghArgs.push("--rebase");
if (hasFlag("--merge")) ghArgs.push("--merge");
if (hasFlag("--auto")) ghArgs.push("--auto");
if (hasFlag("--admin")) ghArgs.push("--admin");
const explicitSubject = argValue("--subject");
const explicitBody = argValue("--body");
if (explicitSubject) ghArgs.push("--subject", explicitSubject);
if (explicitBody) ghArgs.push("--body", explicitBody);

function netFilesFromArg() {
  const raw = argValue("--net-files");
  if (!raw) return null;
  return raw.split(",").map((item) => item.trim()).filter(Boolean);
}

function collectPrProvenance() {
  const explicitFiles = netFilesFromArg();
  if (explicitSubject != null || explicitBody != null || explicitFiles) {
    const title = explicitSubject || "";
    const body = explicitBody || "";
    return {
      title,
      body,
      files: explicitFiles || [],
      commitText: "",
    };
  }
  const view = spawnSync(
    "gh",
    ["pr", "view", pr, "--repo", repo, "--json", "title,body,files,commits"],
    { encoding: "utf8" },
  );
  if (view.status !== 0) {
    if (dryRun) return null;
    if (view.stderr) process.stderr.write(view.stderr);
    console.error("[svc-pr-merge-review-receipt] BLOCKED: cannot read PR title/body/files for named-WI provenance.");
    process.exit(2);
  }
  let payload;
  try { payload = JSON.parse(view.stdout); } catch { payload = null; }
  if (!payload) {
    if (dryRun) return null;
    console.error("[svc-pr-merge-review-receipt] BLOCKED: PR provenance JSON is invalid.");
    process.exit(2);
  }
  const commitText = Array.isArray(payload.commits)
    ? payload.commits.map((commit) => commit?.messageHeadline || commit?.message || "").join("\n")
    : "";
  const files = Array.isArray(payload.files)
    ? payload.files.map((file) => file?.path || file).filter(Boolean)
    : [];
  return {
    title: payload.title || "",
    body: payload.body || "",
    files,
    commitText,
  };
}

const provenance = collectPrProvenance();
if (provenance) {
  const namedWis = namedWisFromText(`${provenance.title}\n${provenance.body}\n${provenance.commitText}`);
  const missing = missingNamedWis({
    namedWis,
    netFiles: provenance.files,
    dispositionText: provenance.body,
  });
  if (missing.length) {
    console.error(
      `[svc-pr-merge-review-receipt] BLOCKED: named WI(s) ${missing.join(", ")} have no net-diff evidence and no omitted/excluded/reverted disposition.`,
    );
    process.exit(2);
  }
}

if (dryRun) {
  console.log(`DRY-RUN: gh ${ghArgs.join(" ")}`);
  process.exit(0);
}

// Run outside the git worktree so gh cannot try to check out local main after
// the remote merge. That checkout fails when main is already used by another
// worktree, even though the GitHub merge itself succeeded.
// WI-556 D5 pre-merge gates: squash-only contract and fresh-base refusal.
if (!hasFlag("--squash")) {
  console.error("[svc-finalize] BLOCKED: only --squash merges carry coverage finalization");
  process.exit(2);
}
for (const banned of ["--rebase", "--merge", "--auto"]) {
  if (hasFlag(banned)) {
    console.error(`[svc-finalize] BLOCKED: ${banned} is incompatible with coverage finalization`);
    process.exit(2);
  }
}
{
  const pre = spawnSync("gh", ["pr", "view", pr, "--repo", repo, "--json", "baseRefOid,headRefName,headRefOid,state,mergeCommit"], { encoding: "utf8" });
  if (pre.status !== 0 || !pre.stdout) {
    console.error("[svc-finalize] BLOCKED: cannot verify PR freshness (gh pr view failed). Merge refused to prevent stale-base coverage mismatch.");
    process.exit(2);
  }
  try {
    const meta = JSON.parse(pre.stdout);
    if (!/^[0-9a-f]{40}$/.test(meta.baseRefOid || "") || !/^[0-9a-f]{40}$/.test(meta.headRefOid || "")) throw new Error("PR base/head OIDs are missing");
    alreadyMerged = meta.state === "MERGED";
    mergedOid = alreadyMerged ? meta.mergeCommit?.oid : null;
    if (!/^[0-9a-f]{40}$/.test(mergedOid || "")) mergedOid = null;
    const compare = alreadyMerged ? { status: 0, stdout: "0" } : spawnSync("gh", ["api", `repos/${repo}/compare/${meta.baseRefOid}...${meta.headRefOid}`, "--jq", ".behind_by"], { encoding: "utf8" });
    const rawBehindBy = String(compare.stdout ?? "").trim();
    if (compare.status !== 0 || !/^(0|[1-9]\d*)$/.test(rawBehindBy)) throw new Error("GitHub compare did not return a valid behind_by count");
    const behindBy = Number(rawBehindBy);
    if (behindBy !== 0) {
      console.error(`[svc-finalize] BLOCKED: PR behindBy=${behindBy} (must be 0); rebase so squash tree matches reviewed candidate.`);
      process.exit(2);
    }
    if (/^[0-9a-f]{40}$/.test(meta.headRefOid || "")) globalThis.__wi556HeadOid = meta.headRefOid;
  } catch (e) {
    console.error(`[svc-finalize] BLOCKED: pre-merge metadata parse failed: ${e.message}`);
    process.exit(2);
  }
}

const merge = alreadyMerged ? { status: 0 } : spawnSync("gh", ghArgs, { cwd: os.tmpdir(), stdio: "inherit" });
if (alreadyMerged) console.log("[svc-finalize] PR already merged; resuming receipt finalization");
// ---------------------------------------------------------------------------
// WI-556 atomic merge finalization (replaces the bare exit). Contract:
//   exit 0 = merged AND coverage verified; exit 2 = pre-merge block (above);
//   exit 3 = MERGED_UNVERIFIED (merge exists on GitHub, coverage not verified).
// Callers MUST branch on 3; never report an exit-3 PR as still-open.
// Net-effect budget: one object+notes fetch, one envelope RMW, one CAS publish;
// poll only while mergeCommit is not yet visible.
const sleepMs = (ms) => { try { spawnSync("sleep", [String(ms / 1000)]); } catch {} };
function finalizeFail(reason) {
  console.error(`[svc-finalize] MERGED_UNVERIFIED: ${reason}`);
  process.exit(3);
}
function gitAt(args) { return spawnSync("git", args, { cwd: root, encoding: "utf8" }); }
function gitOut(args) { const r = gitAt(args); return r.status === 0 ? r.stdout.trim() : ""; }

if (merge.status !== 0) process.exit(merge.status || 1);

let oid = mergedOid;
for (let attempt = 0; attempt < 5 && !oid; attempt++) {
  if (attempt > 0) sleepMs(2000);
  const view = spawnSync("gh", ["pr", "view", pr, "--repo", repo, "--json", "mergeCommit,state"], { encoding: "utf8" });
  if (view.status === 0) {
    try { oid = JSON.parse(view.stdout)?.mergeCommit?.oid || null; } catch { oid = null; }
  }
}
if (!oid || !/^[0-9a-f]{40}$/.test(oid)) finalizeFail("mergeCommit unavailable after bounded poll");

const CANDIDATE_SHA = expectedHeadSha || globalThis.__wi556HeadOid;
if (!/^[0-9a-f]{40}$/.test(CANDIDATE_SHA || "")) finalizeFail("candidate SHA unavailable from PR identity");
if (gitAt(["fetch", "--no-tags", "origin", oid, CANDIDATE_SHA]).status !== 0) {
  // GitHub retains the reviewed pull-request head after its branch is deleted.
  if (gitAt(["fetch", "--no-tags", "origin", oid, `refs/pull/${pr}/head`]).status !== 0)
    finalizeFail("candidate and squash fetch failed");
}
const candidateTree = gitOut(["rev-parse", `${CANDIDATE_SHA}^{tree}`]);
const squashTree = gitOut(["rev-parse", `${oid}^{tree}`]);
if (!squashTree || !candidateTree) finalizeFail("candidate or squash tree unresolvable");
if (candidateTree !== squashTree) finalizeFail(`tree divergence: candidate ${candidateTree.slice(0, 12)} vs squash ${squashTree.slice(0, 12)}`);

let candidateEnvelopeRaw;
try {
  const local = gitOut(["notes", "--ref=svc-receipts", "show", CANDIDATE_SHA]);
  candidateEnvelopeRaw = JSON.stringify(mergeReceiptEnvelopes(
    readPublishedReceiptNote(root, CANDIDATE_SHA), local ? JSON.parse(local) : {},
  ));
} catch (e) { finalizeFail(`candidate receipt recovery failed: ${e.message}`); }
let remapped = {};
try { remapped = candidateEnvelopeRaw ? JSON.parse(candidateEnvelopeRaw) : {}; }
catch (e) { finalizeFail(`candidate envelope unreadable: ${e.message}`); }
for (const key of Object.keys(remapped)) {
  if (!key.startsWith("slot::")) continue;
  const parts = key.split("::");
  if (/^[0-9a-f]{40}$/.test(parts[3] || "") && parts[3] === CANDIDATE_SHA) {
    const nextKey = ["slot", parts[1], parts[2], oid, ...parts.slice(4)].join("::");
    const body = { ...remapped[key] };
    if (body.target_sha === CANDIDATE_SHA) body.target_sha = oid;
    if (body.sha === CANDIDATE_SHA) body.sha = oid;
    delete remapped[key];
    remapped[nextKey] = body;
  }
}

(async () => {
  let coverageAdded = false;
  try {
    const cov = await import("./lib/skill-coverage.mjs");
    const wiMatch = Object.keys(remapped)
      .map((k) => (k.match(/^slot::[^:]+::(WI-[A-Z0-9][A-Z0-9_-]*)::/) || [])[1])
      .find(Boolean);
    if (wiMatch) {
      let graphRaw = gitOut(["show", `${oid}:.svc/lane-tasks-${wiMatch}.json`]);
      if (!graphRaw) graphRaw = gitOut(["show", `${oid}:.svc/lane-tasks-${wiMatch.toLowerCase()}.json`]);
      // Tracked graph that fails to read/compile is a HARD failure; only a
      // genuinely absent graph keeps legacy consumer behavior (skip).
      if (graphRaw) {
        let compiled;
        try {
          const graph = JSON.parse(graphRaw);
          compiled = cov.compileCoverage({ graph, wi: wiMatch });
          if ((compiled.problems || []).length > 0) finalizeFail(`coverage compile problems: ${compiled.problems.join("; ")}`);
        } catch (e) { finalizeFail(`coverage compile failed on tracked graph: ${e.message}`); }
        const childBySlot = new Map(Object.entries(remapped));
        const required = compiled.required.map((entry) => {
          const baseSlot = `slot::${entry.producer_receipt_type}::${wiMatch}::${oid}`;
          let matchedKey = null;
          for (const key of childBySlot.keys()) {
            if (key === baseSlot || key.startsWith(`${baseSlot}::`)) { matchedKey = key; break; }
          }
          const child = matchedKey ? childBySlot.get(matchedKey) : null;
          return { ...entry, receipt_slot: matchedKey || baseSlot,
            ...(child ? { receipt_sha256: cov.sha256Hex(cov.stableStringify(child)) } : {}) };
        });
        const passCount = required.filter((r) => r.status === "pass").length;
        const naCount = required.filter((r) => r.status === "authorized_na").length;
        remapped[`slot::skill-coverage::${wiMatch}::${oid}`] = {
          receipt_type: "skill-coverage", schema_version: 1, wi: wiMatch,
          target_sha: oid, tree_hash: squashTree, graph_digest: compiled.graph_digest,
          policy_registry_digest: cov.POLICY_REGISTRY_DIGEST,
          graph_source: "commit_tree", canonicalizer_version: cov.CANONICALIZER_VERSION,
          required, counts: { required: required.length, pass: passCount, authorized_na: naCount },
          verdict: "pass", generated_at: new Date().toISOString(),
        };
        coverageAdded = true;
      }
    }
  } catch (e) { finalizeFail(`finalization error: ${e.message}`); }

  const writeNote = () => {
    const w = gitAt(["notes", "--ref=svc-receipts", "add", "-f", "-m", JSON.stringify(remapped), oid]);
    if (w.status !== 0) finalizeFail(`notes write failed: ${w.stderr}`);
  };
  writeNote();

  const pathMod = await import("node:path");
  const verify = spawnSync(process.execPath, [pathMod.join(__dirname, "check-chain-receipts.mjs"), "--sha", oid], { cwd: root, encoding: "utf8" });
  if (verify.status !== 0) {
    console.error(`[svc-finalize] coverage verify failed:\n${verify.stdout}${verify.stderr}`);
    process.exit(3);
  }
  try {
    await publishReceiptNotes(root, {
      [CANDIDATE_SHA]: JSON.parse(candidateEnvelopeRaw || "{}"),
      [oid]: remapped,
    });
  } catch (e) { finalizeFail(`receipt publication failed: ${e.message}`); }

  console.log(`[svc-finalize] DONE ${oid} coverage=${coverageAdded ? "published" : "skipped(no tracked graph)"}`);
  process.exit(0);
})();
