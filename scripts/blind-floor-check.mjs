#!/usr/bin/env node
/**
 * blind-floor-check.mjs — WI-410 blind-control-plan floor (the pure, deterministic core).
 *
 * Best-of-2 retention floor: classify every element of the blind plan B against the
 * framework plan F, and DECIDE whether F may ship (never worse than blind).
 *
 * Invariant (honest bound):
 *   - KEEP / ADD / certified-REFINE  → allowed.
 *   - REMOVE or ALTER of a correct B-element WITHOUT a valid cross-family
 *     certified_strict_improvement → VIOLATION → exit non-zero (verify-merged mode).
 *   - Retention escape hatch (--adopt-blind): ship B verbatim → floor_verdict=blind-adopted,
 *     exit 0, with ZERO dependence on any judge (this is what makes "never worse" unconditional).
 *
 * Anti-self-grade (AC3): this script NEVER writes certified_strict_improvement. It only
 * READS certifications from the judge verdicts file, and a certification whose
 * reviewer_family === the orchestrator family (default "anthropic") is INVALID (forged
 * self-cert) and does not count.
 *
 * Purity (AC4): same {B, F, verdicts} inputs → identical ledger JSON + identical exit code.
 * No Date.now / Math.random / new Date in the compute path (run-twice-golden).
 *
 * Usage:
 *   node scripts/blind-floor-check.mjs --blind B.json --merged F.json [--verdicts V.json]
 *        [--adopt-blind] [--orchestrator-family anthropic]
 *
 * Plan file shape (B.json / F.json):  { "elements": [ { "key": "<structural-key>", "content": "<text>" }, ... ] }
 *   key examples: "file:scripts/x.mjs", "task:T2", "ac:AC1->task:T2", "validation:run-twice", "rollback:delete-new-files"
 * Verdicts shape (V.json): { "reviewer_host": "...", "reviewer_family": "openai",
 *                            "certifications": [ { "key": "...", "certified_strict_improvement": true, "reviewer_family": "openai" } ] }
 *
 * Exit codes: 0 = floor holds (pass | blind-adopted); 1 = floor violated (fail); 2 = input error.
 */

import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

// Canonical binding a certification must be issued against (anti-stale/anti-replay):
// a verdict is valid ONLY for the exact change it certifies, so a verdict reused from a
// different B/F pair (or an earlier run) no longer matches and is rejected.
function bindingSha(kind, bContent, fContent) {
  const s = kind === "REMOVE" ? `REMOVE\n${bContent}` : `ALTER\n${bContent}\n=>\n${fContent}`;
  return createHash("sha256").update(s).digest("hex");
}

function parseArgs(argv) {
  const out = { orchestratorFamily: "anthropic", adoptBlind: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--blind") out.blind = argv[++i];
    else if (a === "--merged") out.merged = argv[++i];
    else if (a === "--verdicts") out.verdicts = argv[++i];
    else if (a === "--adopt-blind") out.adoptBlind = true;
    else if (a === "--orchestrator-family") out.orchestratorFamily = argv[++i];
  }
  return out;
}

function fail(msg) {
  process.stderr.write(`blind-floor-check: ${msg}\n`);
  process.exit(2);
}

function readJson(path, label) {
  if (!path || !existsSync(path)) fail(`${label} file not found: ${path}`);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    fail(`${label} is not valid JSON (${path}): ${e.message}`);
  }
}

function elementMap(plan, label) {
  if (!plan || !Array.isArray(plan.elements)) fail(`${label} must have an "elements" array`);
  const m = new Map();
  for (const e of plan.elements) {
    if (!e || typeof e.key !== "string") fail(`${label} element missing string "key"`);
    // Fail-closed on duplicate keys (WI-410 Tier-3 F-001): a silent last-wins overwrite
    // could let a malformed B self-weaken to match a weaker F, bypassing the floor.
    if (m.has(e.key)) fail(`${label} has duplicate key: "${e.key}" — plan JSON is malformed`);
    m.set(e.key, typeof e.content === "string" ? e.content : JSON.stringify(e.content ?? ""));
  }
  return m;
}

/**
 * PURE: classify B against F under verdicts. No I/O, no clock.
 * Returns { floor_verdict, element_ledger, violations }.
 */
export function classify(B, F, verdicts, orchestratorFamily, adoptBlind) {
  const bKeys = [...B.keys()].sort();
  const ledger = { kept: [], added: [], refined: [], removed: [], altered: [] };
  const orch = orchestratorFamily.toLowerCase();

  const certByKey = new Map();
  const certs = (verdicts && Array.isArray(verdicts.certifications)) ? verdicts.certifications : [];
  for (const c of certs) {
    if (c && typeof c.key === "string") certByKey.set(c.key, c);
  }

  // A certification counts ONLY if ALL hold (defense-in-depth against self-grade + replay):
  //   1. certified_strict_improvement === true
  //   2. reviewer_family !== orchestrator family   (anti-self-grade; v1 trusts the self-reported
  //      family — forge-resistance is the v2 check-chain-receipts host RE-derivation fence)
  //   3. for_content_sha === bindingSha(this exact change)  (anti-stale/anti-replay: a verdict
  //      issued for a different B/F pair no longer matches and is rejected)
  function valid(c, binding) {
    if (!c) return false;
    const fam = (c.reviewer_family || "").toLowerCase();
    return c.certified_strict_improvement === true
      && fam && fam !== orch
      && typeof c.for_content_sha === "string"
      && c.for_content_sha === binding;
  }

  for (const key of bKeys) {
    if (!F.has(key)) {
      // REMOVE: allowed only if cross-family-certified AND content-bound to the removed element
      const binding = bindingSha("REMOVE", B.get(key), null);
      if (valid(certByKey.get(key), binding)) ledger.refined.push(key);
      else ledger.removed.push(key);
      continue;
    }
    if (F.get(key) === B.get(key)) {
      ledger.kept.push(key); // structurally identical
    } else {
      // changed: REFINE only with a cross-family cert bound to THIS B->F change; else ALTER (violation)
      const binding = bindingSha("ALTER", B.get(key), F.get(key));
      if (valid(certByKey.get(key), binding)) ledger.refined.push(key);
      else ledger.altered.push(key);
    }
  }

  // ADD: F-only keys (always allowed)
  for (const key of [...F.keys()].sort()) {
    if (!B.has(key)) ledger.added.push(key);
  }

  ledger.removed.sort();
  ledger.altered.sort();

  const violations = [...ledger.removed, ...ledger.altered].sort();

  let floor_verdict;
  if (adoptBlind) {
    // Retention escape hatch: ship B verbatim. Floor holds unconditionally.
    floor_verdict = "blind-adopted";
  } else if (violations.length === 0) {
    floor_verdict = "pass";
  } else {
    floor_verdict = "fail";
  }
  return { floor_verdict, element_ledger: ledger, violations };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const B = elementMap(readJson(args.blind, "blind"), "blind");
  const F = elementMap(readJson(args.merged, "merged"), "merged");
  const verdicts = args.verdicts ? readJson(args.verdicts, "verdicts") : null;

  const result = classify(B, F, verdicts, args.orchestratorFamily, args.adoptBlind);

  // Deterministic output: ledger + verdict ONLY (no timestamp → run-twice golden).
  process.stdout.write(JSON.stringify({
    floor_verdict: result.floor_verdict,
    element_ledger: result.element_ledger,
    violations: result.violations,
  }, null, 2) + "\n");

  // Fail-closed: any uncertified REMOVE/ALTER → non-zero (unless retention escape hatch).
  process.exit(result.floor_verdict === "fail" ? 1 : 0);
}

// Run only as CLI (keep classify() importable + pure for tests).
if (import.meta.url === `file://${process.argv[1]}`) main();
