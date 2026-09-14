#!/usr/bin/env node
// mine-receipts — aggregate the chain's git-note receipts into gate telemetry,
// and compute a MEASURED delivery-tier recommendation (WI-383).
//
// Two halves of one loop the framework was missing:
//   (a) 180+ git-note receipts carry findings + iteration_count + files but
//       nothing aggregates them; route-workflow picked tier by per-run LLM guess.
//   (b) WI-369's rule demotion needs hit telemetry that didn't exist in usable
//       form (decay-report: "observed telemetry: 0d").
//
// VALUE-REDUCTION CONTAINMENT (this is the only forward WI that can drop a review
// pass): the `--tier` predictor defaults CONSERVATIVE and is fenced four ways
// (AC1-AC4). Even when it returns `compressed`, route-workflow only acts on it if
// `.svc/chain-policy.json` opts in (`ceremony_tiering:"measured"`, default OFF) —
// so no gate is removed without explicit authorization. The diff is ALWAYS still
// gated by review-exec G6 + audit-implementation + the pre-push 5-receipt
// envelope; only the plan-level adversarial round can ever be tiered down.
//
// Modes:
//   --stats               aggregate → .svc/gate-stats.json (gitignored cache)
//   --tier <lane>         PURE function of the ledger → {tier, reason, fences}
//   --demotion-list       WI-369 90-day zero-hit rule list (from rule-hits.jsonl)
//   --learning-fires      rules/learnings fired >=3 times (elevation candidates)
// `--tier`/`--demotion-list`/`--learning-fires` are pure: same ledger in → same
// JSON out (run-twice golden). No Date.now() in the pure path — "now" is derived
// from the ledger's own max timestamp (or passed via --now for tests).

import { execSync } from "node:child_process";
import { readFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { writeJsonAtomic, appendJsonlLine } from "./state-io.mjs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = (() => { try { return execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim(); } catch { return process.cwd(); } })();

// ---- fence constants (the contract) ----------------------------------------
export const MIN_WINDOW_RECEIPTS = 5;   // AC3: a window isn't "complete" below this
export const MIN_WINDOW_DAYS = 14;      // AC3: ...and below this span
export const MIN_CLEAN_STREAK = 5;      // AC2: consecutive clean receipts to earn compression
export const INFRA_RE = /(^|\/)(infra|\.svc|scripts|hooks|test-framework|provision|schemas|migrations?)\//; // AC4 (Gemini G6 #2: `infra/` was missing)

function args() {
  const a = process.argv.slice(2); const o = { _: [] };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--stats") o.stats = true;
    else if (a[i] === "--delivery-cycle") o.deliveryCycle = a[++i];
    else if (a[i] === "--tier") o.tier = a[++i];
    else if (a[i] === "--demotion-list") o.demotion = true;
    else if (a[i] === "--learning-fires") o.fires = true;
    else if (a[i] === "--now") o.now = a[++i];
    else if (a[i] === "--json") o.json = true;
    else o._.push(a[i]);
  }
  return o;
}

// Corpus fingerprint (AC2): any change to the rule corpus, plan-review protocol,
// or receipt schemas RESETS earned streaks — a clean streak under the old rules
// says nothing about the new ones.
function corpusHash() {
  const h = createHash("sha256");
  const add = (p) => {
    const abs = join(REPO_ROOT, p);
    if (!existsSync(abs)) { h.update(`MISSING:${p}\n`); return; }
    const st = statSync(abs);
    if (st.isDirectory()) {
      for (const f of readdirSync(abs).sort()) add(join(p, f));
    } else {
      h.update(`${p}:${createHash("sha256").update(readFileSync(abs)).digest("hex")}\n`);
    }
  };
  ["rules", "schemas/receipts", "review-plan/SKILL.md"].forEach(add);
  return h.digest("hex");
}

// Walk every receipt envelope on refs/notes/svc-receipts.
// WI-562 IP-R3: notes are SLOT-KEYED since WI-550 — `slot::<type>::<wi>::<sha>[::<phase>]`
// — and one note (one commit sha) can carry MANY slots. The legacy reader here
// assumed type-keyed envelopes (`env["review-plan"]`), so every post-WI-550
// receipt was invisible to stats/tier telemetry. We now expand each envelope
// into one aggregate record PER SLOT, keeping legacy type-keyed envelopes as a
// fallback reader. Slots of the same type on the same sha are NEVER collapsed
// last-write-wins (that collision is exactly what WI-550's slot keys removed).
function readEnvelopes() {
  let raw = "";
  try { raw = execSync("git notes --ref=svc-receipts list", { encoding: "utf8", cwd: REPO_ROOT }); }
  catch { return []; }
  const out = [];
  for (const line of raw.split("\n").filter(Boolean)) {
    const parts = line.trim().split(/\s+/);
    const noteHash = parts[0];
    const sha = parts[1];
    if (!sha) continue;
    try {
      const env = JSON.parse(execSync(`git notes --ref=svc-receipts show ${sha}`, { encoding: "utf8", cwd: REPO_ROOT, stdio: ["pipe", "pipe", "ignore"] }));
      for (const expanded of expandEnvelope(env, sha)) out.push(expanded);
    } catch { /* skip unreadable */ }
    void noteHash;
  }
  return out;
}

// Expand one envelope into per-slot records. A record is the envelope scoped to
// ONE slot so downstream laneOf/actionedFindings/tsOf readers see exactly the
// type they expect.
function expandEnvelope(env, sha) {
  const records = [];
  const legacyTypes = ["review-plan", "review-exec", "exec-record", "plan-manifest", "audit-implementation"];
  let slotCount = 0;
  for (const key of Object.keys(env || {})) {
    if (!key.startsWith("slot::")) continue;
    const segs = key.split("::");
    // slot::<type>::<wi>::<sha>[::<phase>]
    const type = segs[1];
    if (!type) continue;
    slotCount++;
    const slotEnv = env[key];
    if (slotEnv && typeof slotEnv === "object") {
      // Round-5 review: carry the WHOLE envelope as lane-context fallback —
      // slot records alone lose plan-manifest/exec-record lane attribution.
      records.push({ sha, env: { [type]: slotEnv }, slot: { key, type, wi: segs[2] || null, phase: segs.length > 4 ? segs.slice(4).join("::") : null }, envelope: env });
    }
  }
  // Mixed envelopes: legacy type-keyed entries are ALSO emitted so they are
  // never dropped just because newer slot:: keys coexist. Slot identities stay
  // distinct (WI-550); the legacy view adds whole-envelope context.
  if (legacyTypes.some((t) => env && typeof env === "object" && env[t])) {
    records.push({ sha, env, slot: null });
  }
  return records;
}

// A receipt's "accepted finding" count — AC1: key on ACTIONED findings, never raw
// findings[].length. A finding counts if it was real enough to resolve/act on.
function actionedFindings(env) {
  let n = 0;
  for (const t of ["review-plan", "review-exec"]) {
    const fs = (env[t] && env[t].adversarial_review && env[t].adversarial_review.findings) || [];
    for (const f of fs) {
      const status = String(f.status || "").toLowerCase();
      const sev = String(f.severity || "").toUpperCase();
      // actioned = explicitly resolved/accepted/acknowledged, OR a CRITICAL/HIGH
      // that shipped without an explicit dismissal (conservative: counts as a catch).
      if (["resolved", "accepted", "acknowledged", "fixed"].includes(status)) n++;
      else if (!status && (sev === "CRITICAL" || sev === "HIGH")) n++;
    }
  }
  return n;
}
function iterationCount(env) {
  let n = 0;
  for (const t of ["review-plan", "review-exec"]) n += Number((env[t] && env[t].adversarial_review && env[t].adversarial_review.iteration_count) || 0);
  return n;
}
function laneOf(env) {
  const pm = env["plan-manifest"] || {};
  return (pm.lane || (env["exec-record"] && env["exec-record"].lane) || "unknown");
}
function filesOf(env) {
  const a = (env["exec-record"] && env["exec-record"].files_touched);
  if (Array.isArray(a)) return a;
  const b = (env["plan-manifest"] && env["plan-manifest"].scope && env["plan-manifest"].scope.included);
  return Array.isArray(b) ? b : [];
}
function tsOf(env) {
  for (const t of ["audit-implementation", "review-exec", "exec-record", "plan-manifest"]) {
    if (env[t] && env[t].timestamp) return env[t].timestamp;
  }
  return null;
}
// The corpus fingerprint the receipt was emitted under (AC2). A receipt with no
// stored corpus_hash (legacy) returns null → never matches the current corpus →
// cannot count toward a clean streak (conservative: we can't prove it was clean
// under the CURRENT rules).
function corpusOf(env) {
  for (const t of ["exec-record", "plan-manifest", "review-exec"]) {
    if (env[t] && env[t].corpus_hash) return env[t].corpus_hash;
  }
  return null;
}

// Build per-lane aggregate. `now` derived from the ledger (pure).
function aggregate(envelopes) {
  const byLane = {};
  let maxTs = 0;
  for (const rec of envelopes) {
    const env = rec.env || rec;
    // Slot records fall back to their whole-envelope context for attribution.
    const ctx = rec.envelope ? { ...rec.envelope, ...env } : env;
    const lane = laneOf(ctx);
    const ts = tsOf(ctx);
    const epoch = ts ? Date.parse(ts) : NaN;
    if (!Number.isNaN(epoch)) maxTs = Math.max(maxTs, epoch);
    // Attribution reads the CONTEXT (slot body first via spread order), so
    // per-slot review records inherit plan/exec lane metadata when present.
    const row = { ts, epoch, actioned: actionedFindings(ctx), iter: iterationCount(ctx), infra: filesOf(ctx).some((f) => INFRA_RE.test(f)), corpus: corpusOf(ctx) };
    (byLane[lane] = byLane[lane] || []).push(row);
  }
  for (const lane of Object.keys(byLane)) byLane[lane].sort((a, b) => (a.epoch || 0) - (b.epoch || 0));
  return { byLane, ledgerNow: maxTs || 0, corpus_hash: corpusHash() };
}

// AC1-AC4: the fenced, pure tier predictor for one lane. Exported for golden
// unit-testing with synthetic in-memory ledgers (validate-gate-telemetry.sh).
export function tierForLane(agg, lane, nowEpoch) {
  const fences = { window_complete: false, clean_streak: 0, corpus_stable: true, infra_free_streak: false, enough_span: false };
  // Gemini G6 #3: an untagged/unknown lane NEVER compresses (the safety claim
  // must be enforced, not merely asserted — else an untagged WI skips its round).
  if (lane === "unknown") return { tier: "full", reason: "unknown/untagged lane never compresses", fences };
  const all = agg.byLane[lane] || [];
  if (all.length === 0) return { tier: "full", reason: "cold-start: no receipts for lane (AC2)", fences };
  // Gemini G6 #5: a receipt with an unparseable timestamp can't be placed in
  // time — do NOT silently drop it (a dirty-but-undated receipt would then
  // preserve the streak). Any such anomaly forces conservative FULL.
  if (all.some((r) => !Number.isFinite(r.epoch))) return { tier: "full", reason: "a receipt has an unparseable timestamp — conservative FULL (cannot measure window)", fences };
  const recs = all.slice().sort((a, b) => a.epoch - b.epoch);
  // clean streak (AC1+AC2+AC4): consecutive most-recent receipts with 0 actioned
  // findings AND iteration_count 0 AND not infra-touching AND emitted under the
  // CURRENT corpus (a corpus change or a legacy receipt with no corpus_hash
  // breaks the streak at that point — conservative).
  let streak = 0;
  for (let i = recs.length - 1; i >= 0; i--) {
    const r = recs[i];
    if (r.actioned === 0 && r.iter === 0 && !r.infra && r.corpus === agg.corpus_hash) streak++;
    else break;
  }
  fences.clean_streak = streak;
  fences.corpus_stable = streak > 0;
  fences.infra_free_streak = streak >= MIN_CLEAN_STREAK;
  // window completeness (AC3) — Gemini G6 #1: span the CLEAN STREAK itself, NOT
  // all lane history. A burst of N clean receipts in one hour must NOT pass the
  // 14-day window just because some OLDER (possibly dirty, not-in-streak) receipt
  // exists. The streak must have >=MIN_WINDOW_RECEIPTS receipts AND span >=MIN_WINDOW_DAYS.
  const streakRecs = streak > 0 ? recs.slice(recs.length - streak) : [];
  const streakSpanDays = streak > 0 ? (nowEpoch - streakRecs[0].epoch) / 86400000 : 0;
  fences.enough_span = streakSpanDays >= MIN_WINDOW_DAYS;
  fences.window_complete = streak >= MIN_WINDOW_RECEIPTS && fences.enough_span;
  if (streak < MIN_CLEAN_STREAK) return { tier: "full", reason: `clean streak ${streak} < ${MIN_CLEAN_STREAK} (AC1: actioned-findings+iteration, not raw count)`, fences };
  if (!fences.window_complete) return { tier: "full", reason: `streak window not complete (need >=${MIN_WINDOW_RECEIPTS} clean receipts spanning >=${MIN_WINDOW_DAYS}d; streak ${streak} spans ${streakSpanDays.toFixed(0)}d) — AC3`, fences };
  // earned: measured-clean over a complete window. Compression is plan-level only.
  return { tier: "compressed", reason: `measured clean: ${streak} consecutive zero-actioned-finding receipts spanning ${streakSpanDays.toFixed(0)}d (corpus ${agg.corpus_hash.slice(0, 8)})`, fences };
}

// ---- rule-hits.jsonl (WI-369 substrate) ------------------------------------
// Populate the append-only ledger from the injector's per-session memos
// (.svc/rule-injections-<session>.json). This is the NON-protected population
// path: editing the injector hook itself (the ideal ~3-line real-time append)
// is blocked by the config-protection guard and needs explicit user
// authorization. Runs only on the impure --stats side; appends with `now`
// timestamps (>= every prior append → file stays monotonic) and dedups by
// (session,rule) so re-running --stats is idempotent. Best-effort: a session
// whose gitignored memo is cleaned before --stats runs is not captured (the
// authorized injector edit would close that gap).
function collectRuleHits() {
  const dir = join(REPO_ROOT, ".svc");
  const hitsPath = join(dir, "rule-hits.jsonl");
  const seen = new Set();
  if (existsSync(hitsPath)) {
    for (const l of readFileSync(hitsPath, "utf8").split("\n").filter(Boolean)) {
      try { const h = JSON.parse(l); seen.add(`${h.session} ${h.rule}`); } catch { /* skip */ }
    }
  }
  let memos = [];
  try { memos = readdirSync(dir).filter((f) => /^rule-injections-.+\.json$/.test(f)); } catch { return 0; }
  const now = new Date().toISOString();   // impure side only; keeps the ledger monotonic
  const appends = [];
  for (const f of memos) {
    const session = f.replace(/^rule-injections-/, "").replace(/\.json$/, "");
    let memo;
    try { memo = JSON.parse(readFileSync(join(dir, f), "utf8")); } catch { continue; }
    const rules = Array.isArray(memo) ? memo : Object.keys(memo || {});
    for (const rule of rules) {
      const key = `${session} ${rule}`;
      if (seen.has(key)) continue;
      seen.add(key);
      appends.push({ ts: now, rule, signal: "injected", session });
    }
  }
  for (const obj of appends) appendJsonlLine(hitsPath, obj);   // atomic append (state-io discipline)
  return appends.length;
}

function readRuleHits() {
  const p = join(REPO_ROOT, ".svc", "rule-hits.jsonl");
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

// Cumulative wall-clock evidence, not inferred CPU time or a delivery gate.
function intervalUnion(intervals) {
  const sorted = intervals.filter(([a,b]) => Number.isFinite(a) && Number.isFinite(b) && b >= a).sort((a,b) => a[0]-b[0]);
  const merged=[];
  for(const [a,b] of sorted) { const last=merged.at(-1); if(last && a<=last[1])last[1]=Math.max(last[1],b);else merged.push([a,b]); }
  return merged;
}
const intervalDuration = intervals => intervalUnion(intervals).reduce((sum,[a,b])=>sum+b-a,0);
export function deliveryCycleReport({cycle,events,now}) {
  const start=Date.parse(cycle?.cycle_started_at),end=Date.parse(now),problems=[];
  const validClock=Number.isFinite(start)&&Number.isFinite(end)&&end>=start;
  const intervalFits=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Number.isFinite(end)&&b>=a&&b<=end&&(!Number.isFinite(start)||a>=start);
  const unique=new Map();let duplicates=0;
  for(const envelope of events) {
    const e=envelope?.payload?.delivery_phase;
    if(!e || e.root_wi!==cycle?.root_wi)continue;
    if(e.schema_version!==1 || !e.event_id || !Number.isFinite(Date.parse(e.at))) {problems.push('malformed delivery event');continue;}
    if(unique.has(e.event_id)) {duplicates++;if(JSON.stringify(unique.get(e.event_id))!==JSON.stringify(e))problems.push(`conflicting event ${e.event_id}`);continue;}
    unique.set(e.event_id,e);
  }
  const phases={planning:[],implementation:[],finalization:[]},waits=[],active=new Map();let retries=0,reopened=0,amendments=0;
  for(const e of [...unique.values()].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))) {
    if(['reopened-decision','amendment'].includes(e.transition)) {
      if(!e.reason || !intervalFits(Date.parse(e.at),Date.parse(e.at)))problems.push(`unattributable decision event ${e.event_id}`);
      else if(e.transition==='reopened-decision')reopened++;else amendments++;
      continue;
    }
    if(e.transition==='wait') {
      const a=Date.parse(e.started_at),b=Date.parse(e.ended_at);
      if(!e.reason||!Number.isFinite(a)||!Number.isFinite(b)||b<a){problems.push(`invalid explicit wait ${e.event_id}`);continue;}
      if(intervalFits(a,b))waits.push([a,b]);else problems.push(`wait outside cycle ${e.event_id}`);
      continue;
    }
    if(!Object.hasOwn(phases,e.phase)||!['start','end'].includes(e.transition)){problems.push(`unknown phase/transition ${e.event_id}`);continue;}
    const at=Date.parse(e.at),key=`${e.event_id.split('/').slice(0,-1).join('/') || e.task_id}/${e.phase}/${e.attempt||1}`;
    // ID producer prefixes may differ; task+attempt+phase is the interval identity.
    const taskKey=`${e.wi||e.event_id.split('/')[1]||''}/${e.task_id}/${e.phase}/${e.attempt||1}`;
    if(e.transition==='start') {if(active.has(taskKey))problems.push(`duplicate start ${key}`);active.set(taskKey,at);if(e.attempt>1)retries++;}
    else if(active.has(taskKey)) {
      const a=active.get(taskKey);active.delete(taskKey);
      if(intervalFits(a,at))phases[e.phase].push([a,at]);else problems.push(`interval outside cycle ${e.event_id}`);
    } else problems.push(`end without start ${e.event_id}`);
  }
  const phase_ms=Object.fromEntries(Object.entries(phases).map(([k,v])=>[k,intervalDuration(v)]));
  const total_elapsed_ms=validClock?end-start:null;
  const unknown_ms=validClock?Math.max(0,total_elapsed_ms-intervalDuration([...Object.values(phases).flat(),...waits])):null;
  const budgets={planning:30,implementation:120,finalization:10};
  const target_missed=Object.fromEntries(Object.entries(budgets).map(([k,m])=>[k,phase_ms[k]>m*60000?true:(!validClock||unknown_ms>0||problems.length||active.size)?null:false]));
  return {root_wi:cycle?.root_wi||null,total_elapsed_ms,phase_ms,observed_external_wait_ms:intervalDuration(waits),unknown_ms,
    observed_retries:retries,observed_reopened_decisions:reopened,observed_amendments:amendments,duplicate_events:duplicates,unclosed_intervals:active.size,target_minutes:budgets,target_missed,problems,
    interpretation:'Observed phase intervals are wall time, including work and waits. Missing intervals are unknown; timing never authorizes a gate bypass.'};
}
function readDeliveryCycle(wi,now) {
  if(!/^WI-[A-Za-z0-9_-]+$/.test(wi))throw new Error('invalid delivery-cycle WI');
  const dir=join(REPO_ROOT,'.svc');const cycles=[],graphs=[];
  for(const name of readdirSync(dir).filter(n=>/^lane-tasks-.*\.json$/.test(n))) {
    try {const g=JSON.parse(readFileSync(join(dir,name),'utf8'));if(g.delivery_cycle?.root_wi===wi){cycles.push(g.delivery_cycle);graphs.push(g);}}catch { /* unrelated malformed graphs confer no timing */ }
  }
  const starts=cycles.map(c=>c.cycle_started_at).filter(t=>Number.isFinite(Date.parse(t))).sort((a,b)=>Date.parse(a)-Date.parse(b));
  const cycle={root_wi:wi,...(starts.length?{cycle_started_at:starts[0]}:{})};
  const events=[];let malformed=0;
  const log=join(dir,'pipeline-decisions.jsonl');
  if(existsSync(log))for(const line of readFileSync(log,'utf8').split('\n').filter(Boolean)){try{events.push(JSON.parse(line));}catch{malformed++;}}
  const completed=graphs.length>0 && graphs.every(g=>['completed','skipped'].includes(g.status));
  const ends=graphs.map(g=>g.completed_at).filter(t=>Number.isFinite(Date.parse(t))).sort((a,b)=>Date.parse(a)-Date.parse(b));
  const endpoint=completed?(ends.length===graphs.length?ends.at(-1):null):(now||new Date().toISOString());
  const report=deliveryCycleReport({cycle,events,now:endpoint});
  if(completed && !endpoint)report.problems.push('historical completion boundary unknown; task timestamps and current time are not substitutes');
  if(malformed)report.problems.push(`${malformed} malformed log rows; attribution unknown`);
  if(new Set(starts).size>1)report.problems.push('cycle start disagreement across related graphs; earliest recorded start retained');
  if(report.problems.length)for(const phase of Object.keys(report.target_missed))if(report.target_missed[phase]!==true)report.target_missed[phase]=null;
  return report;
}

function main() {
  const o = args();
  if (o.deliveryCycle) { process.stdout.write(JSON.stringify(readDeliveryCycle(o.deliveryCycle,o.now),null,2)+"\n"); return; }

  if (o.tier) {
    const agg = aggregate(readEnvelopes());
    const nowEpoch = o.now ? Date.parse(o.now) : agg.ledgerNow;
    const res = tierForLane(agg, o.tier, nowEpoch);
    process.stdout.write(JSON.stringify({ lane: o.tier, ...res, corpus_hash: agg.corpus_hash }, null, 2) + "\n");
    return;
  }

  if (o.demotion) {
    // WI-369: rules with zero hits over the trailing 90 days (elevation's inverse).
    const hits = readRuleHits();
    const now = o.now ? Date.parse(o.now) : hits.reduce((m, h) => Math.max(m, Date.parse(h.ts) || 0), 0);
    const cutoff = now - 90 * 86400000;
    const recent = new Set(hits.filter((h) => (Date.parse(h.ts) || 0) >= cutoff).map((h) => h.rule));
    const everHit = new Set(hits.map((h) => h.rule));
    const demote = [...everHit].filter((r) => !recent.has(r)).sort();
    process.stdout.write(JSON.stringify({ window_days: 90, zero_hit_rules: demote, total_rules_seen: everHit.size }, null, 2) + "\n");
    return;
  }

  if (o.fires) {
    const hits = readRuleHits();
    const counts = {};
    for (const h of hits) counts[h.rule] = (counts[h.rule] || 0) + 1;
    const elevate = Object.entries(counts).filter(([, n]) => n >= 3).map(([rule, n]) => ({ rule, fires: n })).sort((a, b) => b.fires - a.fires);
    process.stdout.write(JSON.stringify({ threshold: 3, elevation_candidates: elevate }, null, 2) + "\n");
    return;
  }

  // default: --stats → write the regenerable cache.
  const envelopes = readEnvelopes();
  const agg = aggregate(envelopes);
  const lanes = {};
  for (const lane of Object.keys(agg.byLane)) {
    const recs = agg.byLane[lane];
    lanes[lane] = {
      receipts: recs.length,
      total_actioned_findings: recs.reduce((s, r) => s + r.actioned, 0),
      total_iterations: recs.reduce((s, r) => s + r.iter, 0),
      tier_recommendation: tierForLane(agg, lane, agg.ledgerNow),
    };
  }
  const stats = { schema: 1, generated_from: "refs/notes/svc-receipts", corpus_hash: agg.corpus_hash, ledger_now: agg.ledgerNow ? new Date(agg.ledgerNow).toISOString() : null, lanes };
  mkdirSync(join(REPO_ROOT, ".svc"), { recursive: true });
  writeJsonAtomic(join(REPO_ROOT, ".svc", "gate-stats.json"), stats);   // atomic write (state-io discipline)
  const newHits = collectRuleHits();
  process.stdout.write(`mine-receipts: wrote .svc/gate-stats.json (${Object.keys(lanes).length} lanes, ${envelopes.length} receipts); rule-hits +${newHits} from session memos\n`);
}

// Run main() only as a CLI, not when imported by the validator (golden unit tests).
import { realpathSync } from "node:fs";
const isMain = (() => { try { return process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) main();
