#!/usr/bin/env node
/** report-decay-candidates (WI-369 D3): MEASUREMENT-ONLY decay report.
 * - Rules: zero-hit ≥90d via WI-361 injection memos (.svc/rule-injections-*.json) → demotion candidates
 * - Concerns: zero-hit via .svc/concern-hits.jsonl → severity-demotion candidates
 * - Tier-1 validators: EXPLICITLY EXCLUDED from zero-hit logic (a green validator is working,
 *   not idle) — demotion only per rules/tier-1-promotion.md §Demotion.
 * - Learnings: confidence ≥8 → rule-elevation candidates (learning-preload mechanics; no parallel ledger).
 * Output: markdown to stdout (redirect into docs/analysis/). NOT a gate. */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
const DAYS = (()=>{const i=process.argv.indexOf("--days");return i>-1?Number(process.argv[i+1]):90;})();
const now = Date.now();
const manifest = JSON.parse(readFileSync("skills-manifest.json", "utf8"));
const rules = (manifest.rulesRegistry?.entries ?? []).map((e) => e.path);
// WI369-G6-001: WI-361 memos store "full"|"pointer" strings, not timestamps —
// the memo FILE's mtime is the truthful session-granular hit time (a rule in a
// session memo was injected during that session).
const hit = new Map();
let telemetryStart = Infinity;
if (existsSync(".svc")) for (const f of readdirSync(".svc")) {
  if (!/^rule-injections-.*\.json$/.test(f)) continue;
  try {
    const full = join(".svc", f);
    const t = statSync(full).mtimeMs;
    telemetryStart = Math.min(telemetryStart, t);
    const m = JSON.parse(readFileSync(full, "utf8"));
    for (const rule of Object.keys(m.injected ?? m)) {
      hit.set(rule, Math.max(hit.get(rule) ?? 0, t));
    }
  } catch {}
}
const concernHits = new Map();
let concernStart = Infinity;
if (existsSync(".svc/concern-hits.jsonl")) for (const l of readFileSync(".svc/concern-hits.jsonl", "utf8").split("\n")) {
  try {
    const d = JSON.parse(l); const t = Date.parse(d.ts) || 0;
    if (t) concernStart = Math.min(concernStart, t);
    concernHits.set(d.name ?? d.concern, Math.max(concernHits.get(d.name ?? d.concern) ?? 0, t));
  } catch {}
}
// WI369-G6-003: elevation requires confidence ≥8 AND 3+ recorded fires
// (rules/learning-preload.md). WI-399 B8: fire counts now JOIN from the
// WI-384 ledger (.svc/learning-fires.jsonl — one line per real injection
// application) in addition to any inline d.fires field — report fire counts
// honestly as unverified rather than inventing a parallel ledger (WI text).
const learnElev = [];
if (existsSync("references/framework-learnings.jsonl")) for (const l of readFileSync("references/framework-learnings.jsonl", "utf8").split("\n")) {
  try {
    const d = JSON.parse(l);
    if ((d.confidence ?? 0) >= 8 && d.key) {
      const fires = d.fires ?? d.applications ?? null;
      learnElev.push({ key: d.key, c: d.confidence, fires });
    }
  } catch {}
}
const cutoff = now - DAYS * 86400e3;
console.log(`# Decay report — ${new Date(now).toISOString().slice(0, 10)} (window ${DAYS}d)\n`);
console.log(`> **MEASUREMENT ONLY — not a gate.** Demotion/retirement decisions go through evaluate-rule / concern calibration knobs; tier-1 validators are excluded from zero-hit logic by design (rules/tier-1-promotion.md §Demotion only).\n`);
// WI369-G6-002: "no telemetry yet" is NOT "zero hits in 90 days" — a candidate
// requires a COMPLETE observation window. Per-rule window start = max(global
// telemetry start, the rule's own last_evaluated date from the registry).
const observedDays = telemetryStart === Infinity ? 0 : Math.floor((now - telemetryStart) / 86400e3);
const ruleEntries = manifest.rulesRegistry?.entries ?? [];
const staleRules = [];
let insufficient = 0;
for (const e of ruleEntries) {
  const ownStart = Math.max(telemetryStart === Infinity ? now : telemetryStart, Date.parse(e.last_evaluated ?? 0) || 0);
  if (now - ownStart < DAYS * 86400e3) { insufficient++; continue; }
  const lastHit = hit.get(e.path) ?? hit.get(e.path.replace(/^rules\//, "")) ?? 0;
  if (lastHit < cutoff) staleRules.push(e.path);
}
console.log(`## Rule demotion candidates (zero injection hits across a COMPLETE ${DAYS}d window): ${staleRules.length}/${ruleEntries.length}`);
console.log(`*(observed telemetry: ${observedDays}d; ${insufficient} rules excluded — observation window not yet complete)*`);
for (const r of staleRules) console.log(`- ${r}`);
console.log(`\n*(Telemetry caveat: injection memos are per-session machine-local since WI-361 — a short observation window under-counts; treat as candidates for evaluate-rule, never auto-retire.)*\n`);
const concerns = existsSync("concerns") ? readdirSync("concerns").filter((f) => f.endsWith(".md") && f !== "SCHEMA.md") : [];
// WI369-G6-002b: the concern ledger has its OWN observation start (oldest entry ts).
const concernObservedDays = concernStart === Infinity ? 0 : Math.floor((now - concernStart) / 86400e3);
const concernWindowOk = concernObservedDays >= DAYS;
if (!concernWindowOk) {
  console.log(`## Concern severity-demotion candidates: none emitted — hit-ledger observation window not yet complete (observed ${concernObservedDays}d, need ${DAYS}d).`);
} else {
  const staleConcerns = concerns.filter((c) => (concernHits.get(c.replace(/\.md$/, "")) ?? 0) < cutoff);
  console.log(`## Concern severity-demotion candidates (zero hits across a COMPLETE ${DAYS}d window): ${staleConcerns.length}/${concerns.length}`);
  for (const c of staleConcerns) console.log(`- concerns/${c}`);
}
console.log(`\n## Tier-1 validators: zero-hit demotion N/A by design — review only against §Demotion criteria (timeouts, duplication, one-off-incident guards).\n`);
// WI-399 B8: join recorded fires from the ledger (key -> count)
try {
  const fl = ".svc/learning-fires.jsonl";
  const counts = {};
  for (const line of (await import("node:fs")).readFileSync(fl, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { const e = JSON.parse(line); if (e.key) counts[e.key] = (counts[e.key] || 0) + 1; } catch {}
  }
  for (const x of learnElev) {
    const ledger = counts[x.key] || 0;
    x.fires = Math.max(x.fires ?? 0, ledger);
    if (ledger > 0) x.fires_source = "ledger";
  }
} catch { /* ledger absent — inline fires only */ }
const qualified = learnElev.filter((x) => (x.fires ?? 0) >= 3);
console.log(`## Learning → rule elevation candidates (confidence ≥8 AND fires ≥3): ${qualified.length}`);
for (const x of qualified) console.log(`- ${x.key} (c${x.c}, fires ${x.fires})`);
console.log(`\n*Confidence-qualified but fire-count unverified (no fires field recorded yet — elevation needs 3+ applications per rules/learning-preload.md): ${learnElev.length - qualified.length} — full list:*`);
for (const x of learnElev.filter((y) => (y.fires ?? 0) < 3)) console.log(`- ${x.key} (c${x.c}, fires ${x.fires ?? "unrecorded"})`);
