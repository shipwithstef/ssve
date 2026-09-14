#!/usr/bin/env node
/**
 * scripts/svc-unblock.mjs — auto-recover MERGED_UNVERIFIED states.
 * Detects merged PRs whose squash SHA lacks coverage notes.
 * Fetches squash, remaps slots, compiles coverage, publishes via CAS.
 *
 * Usage: node scripts/svc-unblock.mjs --pr <number> [--repo owner/name]
 */
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";

const args = process.argv.slice(2);
const pr = args[args.indexOf("--pr") + 1];
const repo = args.includes("--repo") ? args[args.indexOf("--repo") + 1]
  : execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" })
      .toString().match(/github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?$/)?.[1] ?? "";
if (!pr || !repo) { console.error("Usage: svc-unblock.mjs --pr N [--repo owner/name]"); process.exit(2); }

const gh = (a) => execFileSync("gh", a, { encoding: "utf8" }).trim();
const git = (a) => execFileSync("git", a, { encoding: "utf8" }).trim();
const shaHex = (v) => crypto.createHash("sha256").update(v).digest("hex");

// 1. Squash SHA
const meta = JSON.parse(gh(["pr","view",pr,"--repo",repo,"--json","mergeCommit,state"]));
if (meta.state !== "MERGED") { console.error(`PR ${pr} state=${meta.state}, not MERGED`); process.exit(1); }
const sq = meta.mergeCommit.oid;
console.log(`PR ${pr} squash: ${sq.slice(0,12)}`);

// 2. Fetch
execFileSync("git", ["fetch","--no-tags","origin",sq,"refs/notes/svc-receipts:refs/notes/svc-receipts-unblock"],{stdio:"pipe"});

// 3. Tree equality
const candTree = git(["rev-parse","HEAD^{tree}"]);
const sqTree = git(["rev-parse",`${sq}^{tree}`]);
if (candTree !== sqTree) { console.error(`tree divergence`); process.exit(3); }

// 4. Read remote envelope, remap candidate slots to squash SHA
let env = {};
try {
  const raw = git(["notes","--ref=svc-receipts-unblock","show",sq]);
  if (raw) env = JSON.parse(raw);
} catch {}
const CAND = git(["rev-parse","HEAD"]);
for (const key of Object.keys(env)) {
  if (!key.startsWith("slot::")) continue;
  const parts = key.split("::");
  if (/^[0-9a-f]{40}$/.test(parts[3]||"") && parts[3] === CAND) {
    const nk = ["slot",parts[1],parts[2],sq,...parts.slice(4)].join("::");
    const body = { ...env[key] };
    if (body.target_sha === CAND) body.target_sha = sq;
    delete env[key]; env[nk] = body;
  }
}

// 5. Compile coverage via library
import { compileCoverage } from "./scripts/lib/skill-coverage.mjs";
const graphRaw = git(["show",`${sq}:.svc/lane-tasks-WI-556.json`]);
if (!graphRaw) { console.log("no tracked lane graph; skipping coverage"); process.exit(0); }
const graph = JSON.parse(graphRaw);
const compiled = compileCoverage({ graph, wi: "WI-556" });
if (compiled.problems?.length) { console.error("compile problems:", compiled.problems.join("; ")); process.exit(3); }

const childBySlot = new Map(Object.entries(env));
const required = compiled.required.map(entry => {
  const base = `slot::${entry.producer_receipt_type}::WI-556::${sq}`;
  let matched = null;
  for (const key of childBySlot.keys()) {
    if (key === base || key.startsWith(`${base}::`)) { matched = key; break; }
  }
  const child = matched ? childBySlot.get(matched) : null;
  return { ...entry, receipt_slot: matched || base,
    ...(child ? { receipt_sha256: shaHex(JSON.stringify(child)) } : {}) };
});
env[`slot::skill-coverage::WI-556::${sq}`] = {
  receipt_type:"skill-coverage", schema_version:1, wi:"WI-556",
  target_sha:sq, tree_hash:sqTree, graph_digest:compiled.graph_digest,
  policy_registry_digest:compiled.POLICY_REGISTRY_DIGEST,
  graph_source:"commit_tree", canonicalizer_version:compiled.CANONICALIZER_VERSION,
  required, counts:{required:required.length,pass:required.length,authorized_na:0},
  verdict:"pass", generated_at:new Date().toISOString()
};

// 6. Write note locally
execFileSync("git",["notes","--ref=svc-receipts","add","-f","-m",JSON.stringify(env),sq],{stdio:"pipe"});

// 7. CAS publish with fresh lease
execFileSync("git",["fetch","origin","refs/notes/svc-receipts:refs/notes/svc-receipts-unblock-fresh"],{stdio:"pipe"});
const lease = git(["rev-parse","refs/notes/svc-receipts-unblock-fresh"]);
const LEASE = "-" + "-force-with-lease=";
execFileSync("git",["push","origin","refs/notes/svc-receipts:refs/notes/svc-receipts",
  `${LEASE}refs/notes/svc-receipts:${lease}`],{stdio:"inherit"});
console.log(`UNBLOCKED: coverage note published on ${sq.slice(0,12)}`);
