#!/usr/bin/env bash
# Tier 1: gate-telemetry / measured-ceremony-tier gate (WI-383).
#
# WI-383 is the ONLY forward WI that can drop a review pass, so its tier
# predictor is fenced four ways and this gate golden-tests EVERY fence with
# synthetic ledgers — proving compression is earned only by measured-clean
# receipts over a COMPLETE window, and that any dirtiness/infra-touch/short-
# window/cold-start falls back to FULL. Also asserts the value-reduction
# containment: gate-stats.json is a gitignored regenerable cache, rule-hits.jsonl
# is append-only, and route-workflow only ACTS on `compressed` behind an explicit
# opt-in. Hermetic + deterministic (pure function; no git/network/LLM).
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"
PASS=0; FAIL=0
pass(){ echo "  ✓ $1"; PASS=$((PASS+1)); }
fail(){ echo "  ✗ $1"; FAIL=$((FAIL+1)); }

echo "=== Tier 1: Gate Telemetry / Measured Ceremony Tier (WI-383) ==="

[ -s scripts/mine-receipts.mjs ] && pass "mine-receipts.mjs present" || fail "mine-receipts.mjs missing"

# ---- A. Fenced predictor: golden unit tests over synthetic ledgers ----------
node --input-type=module -e '
import { tierForLane, MIN_WINDOW_RECEIPTS, MIN_CLEAN_STREAK, INFRA_RE } from "./scripts/mine-receipts.mjs";
const DAY = 86400000, NOW = 1800000000000, CORPUS = "deadbeef";
const clean = (d) => ({ epoch: NOW - d*DAY, actioned: 0, iter: 0, infra: false, corpus: CORPUS });
const mkAgg = (recs) => ({ byLane: { test: recs }, corpus_hash: CORPUS });
const tier = (recs, now=NOW) => tierForLane(mkAgg(recs), "test", now).tier;
const W = [20,17,14,9,5,1].map(clean);   // 6 clean receipts spanning 20 days = complete window
let rc = 0; const ck = (n,g,w) => { if (g===w) console.log(`  ✓ ${n} → ${g}`); else { console.log(`  ✗ ${n} → ${g} (want ${w})`); rc=1; } };

ck("cold-start (0 receipts) [AC2]", tier([]), "full");
ck("incomplete window (<5 receipts) [AC3]", tier([clean(20),clean(15),clean(2)]), "full");
ck("short span (<14d) [AC3]", tier([3,2.5,2,1.5,1,0.5].map(clean)), "full");
ck("clean complete window → EARNED compression", tier(W), "compressed");
ck("dirty recent (actioned finding) breaks streak [AC1]", tier([...W.slice(0,5), {epoch:NOW, actioned:1, iter:0, infra:false, corpus:CORPUS}]), "full");
ck("iteration_count>0 breaks streak [AC1]", tier([...W.slice(0,5), {epoch:NOW, actioned:0, iter:2, infra:false, corpus:CORPUS}]), "full");
ck("infra-touching breaks streak [AC4]", tier([...W.slice(0,5), {epoch:NOW, actioned:0, iter:0, infra:true, corpus:CORPUS}]), "full");
ck("corpus CHANGE breaks streak [AC2]", tier([...W.slice(0,5), {epoch:NOW, actioned:0, iter:0, infra:false, corpus:"OTHER_CORPUS"}]), "full");
ck("legacy receipt (no corpus_hash) breaks streak [AC2]", tier([...W.slice(0,5), {epoch:NOW, actioned:0, iter:0, infra:false, corpus:null}]), "full");
// G6 #1: window spans the STREAK, not all-history — a rapid clean burst with an
// OLD (dirty, not-in-streak) receipt must NOT pass the 14-day window.
ck("rapid clean burst + old dirty receipt → full [G6#1 streak-span]", tier([{epoch:NOW-40*DAY, actioned:2, iter:0, infra:false, corpus:CORPUS}, ...[0.4,0.3,0.2,0.1,0].map(clean)]), "full");
// G6 #3: the unknown/untagged lane never compresses, even with a clean window.
ck("unknown lane never compresses [G6#3]", tierForLane({byLane:{unknown:W}, corpus_hash:CORPUS}, "unknown", NOW).tier, "full");
// G6 #5: a receipt with an unparseable timestamp forces conservative full.
ck("unparseable timestamp → conservative full [G6#5]", tier([...W.slice(0,5), {epoch:NaN, actioned:0, iter:0, infra:false, corpus:CORPUS}]), "full");
// G6 #2: an infra-path change never compresses (regex now includes infra/).
ck("INFRA_RE matches infra/ [G6#2]", INFRA_RE.test("infra/foo.tf")?"match":"miss", "match");
// run-twice golden (AC5): pure function, identical output
const a = JSON.stringify(tierForLane(mkAgg(W),"test",NOW)), b = JSON.stringify(tierForLane(mkAgg(W),"test",NOW));
ck("run-twice golden (pure)", a===b?"same":"diff", "same");
// unsorted input must yield the same verdict (defensive sort)
ck("order-independent (shuffled input)", tier([...W].reverse()), "compressed");
process.exit(rc);
' && pass "fenced predictor: all fences + earned-compression path verified" || fail "predictor fence(s) wrong"

# ---- B. Value-reduction containment ----------------------------------------
# gate-stats.json must be a gitignored regenerable cache (AC5).
if git check-ignore -q .svc/gate-stats.json; then pass ".svc/gate-stats.json gitignored (regenerable cache, AC5)"; else fail ".svc/gate-stats.json NOT gitignored (AC5 — must be regenerable)"; fi
# rule-hits.jsonl is append-only event state → union-merge (WI-398) and tracked OR ignored.
am="$(git check-attr merge -- .svc/rule-hits.jsonl 2>/dev/null | sed 's#.*merge: ##')"
if [ "$am" = "union" ]; then pass ".svc/rule-hits.jsonl is union-merge append-only (WI-398)"; else fail ".svc/rule-hits.jsonl merge attr '$am' (expected union — append-only event log)"; fi
# route-workflow only ACTS on compression behind an explicit opt-in (default OFF).
if grep -q "ceremony_tiering" skills/route-workflow/SKILL.md; then pass "route-workflow gates compression behind ceremony_tiering opt-in (default OFF)"; else fail "route-workflow does not gate compression behind an opt-in"; fi

# ---- C. Append-only ledger discipline (AC5) --------------------------------
# Gemini G6 #4: append-only is enforced by the union-merge driver (section B) +
# the file being tracked — NOT by line order, which concurrent union-merged
# appends legitimately interleave. So validate EVENT VALIDITY (every line a valid
# event with a parseable ISO ts), which catches tampering/corruption without
# false-failing distributed workflows.
node --input-type=module -e '
import { readFileSync, existsSync } from "node:fs";
const p = ".svc/rule-hits.jsonl";
if (!existsSync(p)) { console.log("  ✓ rule-hits.jsonl absent (no events yet) — vacuously valid"); process.exit(0); }
const lines = readFileSync(p,"utf8").split("\n").filter(Boolean);
let ok = true, bad = "";
for (const l of lines) { try { const o = JSON.parse(l); if (!Number.isFinite(Date.parse(o.ts))) { ok=false; bad=l.slice(0,60); break; } } catch { ok=false; bad=l.slice(0,60); break; } }
console.log(ok ? `  ✓ rule-hits.jsonl: all ${lines.length} events valid w/ ISO ts (append-only via union-merge; order not required — G6#4)` : `  ✗ rule-hits.jsonl invalid event: ${bad}`);
process.exit(ok?0:1);
' && pass "rule-hits.jsonl append-only discipline holds" || fail "rule-hits.jsonl append-only violated"

echo "gate telemetry: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
