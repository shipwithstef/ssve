#!/usr/bin/env bash
# Tier 1: discovery triple fan-out disjoint-write fence (WI-387).
#
# The concurrent discovery wave is only safe because the three wave-1 skills write
# DISJOINT paths. This proves the fence FAILS CLOSED on any pairwise intersection
# (equal path, dir-parent containment, empty/invalid scope, empty wave) and PASSES
# on the real disjoint discovery scopes (AC1). Hermetic; no network/LLM.
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"
PASS=0; FAIL=0
pass(){ echo "  ✓ $1"; PASS=$((PASS+1)); }
fail(){ echo "  ✗ $1"; FAIL=$((FAIL+1)); }
echo "=== Tier 1: Discovery Wave disjoint-write fence (WI-387) ==="

FENCE="scripts/discovery-wave-fence.mjs"
[ -s "$FENCE" ] && pass "fence present" || fail "fence missing"
node --check "$FENCE" 2>/dev/null && pass "fence parses" || fail "fence syntax error"
[ -s "references/discovery-wave.md" ] && pass "wave protocol present" || fail "protocol missing"

# real discovery scopes are disjoint → fence exits 0
node "$FENCE" >/dev/null 2>&1 && pass "AC1: real wave-1 scopes (domain/competitors/personas) are disjoint → fence OK" || fail "real scopes flagged as overlapping"

# fence logic: all the intersection classes REFUSE; disjoint passes
node --input-type=module -e '
import { disjointWaveScopes, scopesIntersect, WAVE1_SCOPES } from "./scripts/discovery-wave-fence.mjs";
let rc=0; const ok=(c,m)=>{if(!c){console.log("  ✗ "+m);rc=1;}};
ok(scopesIntersect("docs/specs/domain-profile.md","docs/specs/analyze-competitors.md")===false,"distinct files → disjoint");
ok(scopesIntersect("docs/specs/personas/","docs/specs/personas/p1.md")===true,"dir parent contains child → intersect");
ok(scopesIntersect("docs/specs/x.md","docs/specs/x.md")===true,"same file → intersect");
ok(scopesIntersect("","docs/specs/x.md")===true,"empty/invalid scope → intersect (fail-closed)");
ok(disjointWaveScopes(WAVE1_SCOPES).disjoint===true,"built-in WAVE1_SCOPES disjoint");
ok(disjointWaveScopes({a:["docs/specs/x.md"],b:["docs/specs/x.md"]}).disjoint===false,"path collision → REFUSE");
ok(disjointWaveScopes({a:["docs/specs/"],b:["docs/specs/domain-profile.md"]}).disjoint===false,"dir-parent overlap → REFUSE");
ok(disjointWaveScopes({}).disjoint===false,"empty wave → REFUSE (config error)");
// determinism
ok(JSON.stringify(disjointWaveScopes(WAVE1_SCOPES))===JSON.stringify(disjointWaveScopes(WAVE1_SCOPES)),"deterministic");
process.exit(rc);
' && pass "fence: every intersection class fails-closed, disjoint passes, deterministic" || fail "fence logic wrong"

# ---- Gemini G6: fence canonicalizes equivalent spellings (no fail-open) ------
node --input-type=module -e '
import { scopesIntersect } from "./scripts/discovery-wave-fence.mjs";
let rc=0; const ok=(c,m)=>{if(!c){console.log("  ✗ "+m);rc=1;}};
ok(scopesIntersect("docs/specs/personas","docs//specs/personas")===true,"G6#1: redundant // collapsed → intersect");
ok(scopesIntersect("docs/specs/personas","docs/specs/./personas")===true,"G6#1: ./ resolved → intersect");
ok(scopesIntersect("docs/specs/x.md","docs/specs/../specs/x.md")===true,"G6#1: ../ resolved → intersect");
ok(scopesIntersect("docs/specs/personas","Docs/Specs/Personas")===true,"G6#2: case-variant → intersect (fail-safe)");
ok(scopesIntersect(".","docs/specs/x.md")===true,"G6#3: . (whole-repo) vs child → intersect");
ok(scopesIntersect("..","docs/specs/x.md")===true,"G6: .. (parent, aliases into repo) → intersect");
ok(scopesIntersect("/docs/specs/x.md","docs/specs/x.md")===true,"G6#3: absolute vs relative same → intersect (fail-safe)");
ok(scopesIntersect("docs/specs/domain-profile.md","docs/specs/analyze-competitors.md")===false,"genuinely-distinct files still disjoint (no over-refusal)");
process.exit(rc);
' && pass "G6 #1/#2: equivalent-spelling + case canonicalization (no fail-open on //, ./, .., case)" || fail "G6 path-canonicalization regression"

# protocol cites the S5 policy + dispatch-waves transport (not native pipeline) + the caveat
grep -q "S5 policy\|workflow-fanout-protocol" references/discovery-wave.md && pass "protocol cites the S5 policy (mutating-transport authorization)" || fail "protocol missing S5 policy citation"
grep -q "dispatch-waves" references/discovery-wave.md && pass "protocol uses dispatch-waves transport (AC1: not native pipeline/parallel)" || fail "protocol missing dispatch-waves"
grep -qE "validate-feature" references/discovery-wave.md && pass "protocol preserves the validate-feature gate (AC2)" || fail "validate-feature gate not stated"
grep -qiE "caveat|soft|lose the serial" references/discovery-wave.md && pass "protocol states the serial-context-loss caveat, not hand-waved (AC3)" || fail "caveat not stated"

echo "discovery-wave: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
