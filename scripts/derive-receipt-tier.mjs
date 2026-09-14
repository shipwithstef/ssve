#!/usr/bin/env node
/**
 * derive-receipt-tier — re-derive the risk tier of a commit from its ACTUAL diff
 * (WI-385). EXACTLY TWO non-quick-fix tiers: "low" and "full". The pre-push
 * validator NEVER trusts a declared risk_tier token — it calls this, which reads
 * the commit's own changed files + LOC + concern class.
 *
 * FAILS CLOSED to "full": any error, any infra/hot-path touch, any runtime-
 * invisible logic, any CRITICAL concern match, or LOC over the threshold → full.
 * "low" is granted ONLY to a small, runtime-visible, non-infra, non-CRITICAL diff.
 * On a private framework repo almost everything is runtime-invisible (scripts /
 * skills / docs) → full, by design; the low tier is mainly for product UI deltas.
 *
 * Usage: node scripts/derive-receipt-tier.mjs --sha <sha>   (prints JSON, exit 0)
 *   import { deriveTier } from "./derive-receipt-tier.mjs"   → { tier, reasons, loc }
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const LOC_FULL_THRESHOLD = 150;   // changed lines at/over this → full

// Hot-path / infra / contract surfaces — ANY touch forces full (mirrors
// rules/plan-changeset-trigger.md risk signals + the chain's own machinery).
const INFRA_RE = [
  /^hooks\//,
  /^scripts\/(wire|resolve|init|lint|check-chain|emit-receipt|svc-reconcile|derive-receipt-tier|quick-fix-eligibility)/,
  /^scripts\/lib\//,
  /^test-framework\/evals\/tier-1\//,
  /^schemas\//,
  /^provision\//,
  /^skills-manifest\.json$/,
  /^\.svc\/.*\.json$/,            // machine config (not append-only .jsonl)
  /(^|\/)[^/]*\.config\.[a-z]+$/, // *.config.*
  /(^|\/)(package|tsconfig|pyproject)[^/]*\.(json|toml)$/,
  /(^|\/)migrations?\//,
  /(^|\/)schema\.(prisma|sql)$/,
];

// Runtime-VISIBLE product surfaces (exercisable by journey/E2E). A low-tier diff
// must touch ONLY these (+ their tests) — anything else is runtime-invisible
// logic and stays full (AC4).
const RUNTIME_VISIBLE_RE = [
  /^(src|app|components|pages|routes|public|styles|e2e|tests?)\//,
  /\.(tsx|jsx|vue|svelte|html|css|scss)$/,
  /\.(test|spec)\.[a-z]+$/,
];

function git(args) { return execSync(`git ${args}`, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim(); }

function changedFiles(sha) {
  // Gemini G6 #1 (CRITICAL): --name-only shows only the NEW path on a rename, so
  // renaming an infra file (scripts/check-chain-receipts.mjs) to a runtime-visible
  // path (src/x.tsx) would derive "low" for a change that moves a critical file.
  // --name-status exposes the OLD path of R/C entries; classify on BOTH.
  const files = new Set();
  for (const line of git(`show --name-status --format= ${sha}`).split("\n")) {
    const s = line.trim();
    if (!s) continue;
    const parts = s.split(/\t+/);
    if (parts.length >= 3 && /^[RC]/.test(parts[0])) { files.add(parts[1]); files.add(parts[2]); }   // rename/copy: old + new
    else if (parts.length >= 2) files.add(parts[parts.length - 1]);
    else files.add(parts[0]);
  }
  return [...files].filter(Boolean);
}

function changedLoc(sha) {
  // numstat: "<add>\t<del>\t<path>"; binary rows are "-\t-\t..." → treat as Infinity (fail-closed)
  let total = 0;
  for (const line of git(`show --numstat --format= ${sha}`).split("\n")) {
    const m = line.split("\t");
    if (m.length < 3) continue;
    if (m[0] === "-" || m[1] === "-") return Infinity;
    total += (Number(m[0]) || 0) + (Number(m[1]) || 0);
  }
  return total;
}

// Does any changed path match a CRITICAL concern's file_path_patterns?
function touchesCriticalConcern(files) {
  try {
    const p = process.env.SVC_CONCERNS_REGISTRY || join(SCRIPT_DIR, "..", "concerns", "REGISTRY.json");
    if (!existsSync(p)) return true;   // Gemini G6 #2: can't assess CRITICAL concerns → fail-closed to full
    const reg = JSON.parse(readFileSync(p, "utf8"));
    const globToRe = (g) => new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\//g, "(?:.*/)?").replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*") + "$");
    for (const c of (reg && reg.concerns) || []) {
      const sev = String(c.severity || c.default_severity || "").toUpperCase();
      if (sev !== "CRITICAL") continue;
      const pats = ((c.signals && c.signals.file_path_patterns) || []).map(globToRe);
      if (files.some((f) => pats.some((re) => re.test(f)))) return true;
    }
  } catch { return true; }   // can't read the registry → fail closed (assume critical)
  return false;
}

// PURE classifier (no git — hermetically testable). Given the changed files +
// total LOC (+ whether a CRITICAL concern is touched), return { tier, reasons }.
// Fails CLOSED to "full" on infra/hot-path, runtime-invisible logic, CRITICAL
// concern, over-threshold LOC, or an empty/invalid file set. EXACTLY two tiers.
export function classifyFiles(files, loc, opts = {}) {
  if (!Array.isArray(files) || files.length === 0) {
    return { tier: "full", reasons: ["no changed files → fail-closed"], loc };
  }
  const reasons = [];
  const infra = files.filter((f) => INFRA_RE.some((re) => re.test(f)));
  if (infra.length) reasons.push(`infra/hot-path touch: ${infra.slice(0, 3).join(", ")}`);
  const invisible = files.filter((f) => !RUNTIME_VISIBLE_RE.some((re) => re.test(f)));
  if (invisible.length) reasons.push(`runtime-invisible (not journey/E2E-exercisable): ${invisible.slice(0, 3).join(", ")}`);
  if (opts.criticalConcern) reasons.push("CRITICAL concern-registry match");
  if (!Number.isFinite(loc) || loc >= LOC_FULL_THRESHOLD) reasons.push(`LOC ${loc} >= ${LOC_FULL_THRESHOLD}`);
  const tier = reasons.length ? "full" : "low";
  if (tier === "low") reasons.push(`small (${loc} LOC), runtime-visible, no infra, no CRITICAL concern`);
  return { tier, reasons, loc };
}

export function deriveTier(sha) {
  try {
    const files = changedFiles(sha);
    const loc = changedLoc(sha);
    const r = classifyFiles(files, loc, { criticalConcern: touchesCriticalConcern(files) });
    return { ...r, files };
  } catch (e) {
    return { tier: "full", reasons: [`derivation error → fail-closed to full: ${String(e && e.message || e).slice(0, 80)}`], loc: Infinity };
  }
}

function argValue(name) { const i = process.argv.indexOf(name); return i === -1 ? null : process.argv[i + 1] || null; }

// WI-399 B6: --streak reports the consecutive clean full-envelope WI streak
// from origin/main history. The graded-tiering flip is USER-GATED: this mode
// only REPORTS qualification (streak >= --min, default 5); no code path here
// or anywhere flips .svc/chain-policy.json risk_tiering automatically.
async function reportStreak(minQualifying) {
  const { execFileSync } = await import("node:child_process");
  const REQUIRED = ["plan-manifest", "review-plan", "exec-record", "review-exec", "audit-implementation"];
  const shas = execFileSync("git", ["log", "--format=%H", "-50", "origin/main"], { encoding: "utf8" })
    .trim().split("\n");
  let streak = 0;
  const seen = [];
  for (const sha of shas) {
    let note = "";
    try {
      note = execFileSync("git", ["notes", "--ref=svc-receipts", "show", sha], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch { /* no note */ }
    let env = null;
    try { env = JSON.parse(note); } catch {}
    const qf = env && env["quick-fix"];
    if (qf && qf.eligible === true) continue; // exempt-class commits do not break or extend the streak
    const complete = env && REQUIRED.every((k) => env[k]);
    if (complete) { streak++; seen.push(sha.slice(0, 8)); }
    else break; // first non-exempt commit without a complete envelope ends the streak
  }
  process.stdout.write(JSON.stringify({
    streak,
    qualifying_min: minQualifying,
    qualifies: streak >= minQualifying,
    envelopes: seen,
    flip: "USER-GATED — propose risk_tiering:\"graded\" in .svc/chain-policy.json to the user; never auto-flip",
  }, null, 2) + "\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
    if (process.argv.includes("--streak")) {
    const min = Number.parseInt(argValue("--min") || "5", 10);
    await reportStreak(min);
    process.exit(0);
  }
  const sha = argValue("--sha") || "HEAD";
  let resolved;
  try { resolved = git(`rev-parse --verify ${sha}`); } catch { console.log(JSON.stringify({ tier: "full", reasons: ["sha unresolvable → fail-closed"], loc: Infinity })); process.exit(0); }
  process.stdout.write(JSON.stringify(deriveTier(resolved), null, 2));
}
