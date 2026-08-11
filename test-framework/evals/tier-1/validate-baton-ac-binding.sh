#!/usr/bin/env bash
# Tier 1: pipeline-baton AC-binding gate (WI-381).
#
# The plan-manifest baton's `ac_digests` lets downstream chain skills read a
# one-page navigation index instead of re-reading the whole spec. To keep that
# safe, the baton stores a sha256 over the spec's normalized AC signatures, and
# this gate proves the binding RECOMPUTES and FAILS on a real AC revision (NOT
# the old key-presence check at check-chain-receipts.mjs). It also locks the
# schema contract (ac_digests in `required`) and the navigation-not-authoritative
# semantics. Hermetic + deterministic (pure hashing, no git/network/LLM).
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"
PASS=0; FAIL=0
pass(){ echo "  ✓ $1"; PASS=$((PASS+1)); }
fail(){ echo "  ✗ $1"; FAIL=$((FAIL+1)); }

echo "=== Tier 1: Pipeline-Baton AC Binding (WI-381) ==="

SCHEMA="schemas/receipts/plan-manifest.schema.json"
LIB="scripts/lib/normalize-ac-table.mjs"

# ---- A. Schema contract (AC4) ----------------------------------------------
[ -f "$SCHEMA" ] && pass "plan-manifest schema present" || fail "plan-manifest schema missing"
if jq -e '.required|index("ac_digests")' "$SCHEMA" >/dev/null 2>&1; then pass "ac_digests in schema.required (AC4)"; else fail "ac_digests NOT in schema.required (AC4)"; fi
if jq -e '.properties.ac_digests.properties.spec_ac_table_sha256' "$SCHEMA" >/dev/null 2>&1; then pass "schema declares spec_ac_table_sha256 (hash bind)"; else fail "schema missing spec_ac_table_sha256"; fi
# AC2: contract states navigation-not-authoritative.
if jq -r '.properties.ac_digests.description' "$SCHEMA" 2>/dev/null | grep -qi "navigation"; then pass "schema states ac_digests is a NAVIGATION index (AC2)"; else fail "schema does not state navigation-index semantics (AC2)"; fi

[ -f "$LIB" ] && pass "normalizer lib present ($LIB)" || fail "normalizer lib missing ($LIB)"

# ---- B. RECOMPUTE behavior: progress-insensitive, revision-sensitive (AC1/AC3)
node --input-type=module -e '
import { acTableSha256 } from "./scripts/lib/normalize-ac-table.mjs";
const base = `## Acceptance Criteria
- [ ] First criterion: the widget must persist across reload.
- [ ] Second criterion: errors surface within 200ms.
`;
// progress noise: checkbox flip + appended verification annotation
const progressed = `## Acceptance Criteria
- [x] First criterion: the widget must persist across reload. *(Verified: e2e green)*
- [x] Second criterion: errors surface within 200ms.
`;
// a REAL revision of an AC requirement
const revised = `## Acceptance Criteria
- [ ] First criterion: the widget must persist across reload.
- [ ] Second criterion: errors surface within 5 SECONDS.
`;
const h0 = acTableSha256(base);
const hp = acTableSha256(progressed);
const hr = acTableSha256(revised);
let rc = 0;
if (h0 === hp) console.log("  ✓ binding is progress-insensitive (checkbox flip + annotation → same hash)");
else { console.log("  ✗ progress noise changed the hash (false-stale risk)"); rc = 1; }
if (h0 !== hr) console.log("  ✓ binding is revision-sensitive (AC text change → different hash)");
else { console.log("  ✗ a real AC revision did NOT change the hash (staleness undetectable)"); rc = 1; }
// the FAIL path: a baton carrying h0 validated against the revised spec mismatches
if (acTableSha256(revised) !== h0) console.log("  ✓ recompute over revised spec ≠ stored baton hash → FAILS (re-distill forced)");
else { console.log("  ✗ recompute did not detect the stale baton"); rc = 1; }
// table format parity (feature specs)
const tbl = `## Acceptance Criteria
| AC | Description | Proof |
|----|-------------|-------|
| X-01 | must do the thing | run.sh |
`;
const tblProofChanged = tbl.replace("run.sh", "other.sh");      // proof col is volatile → same hash
const tblReqChanged = tbl.replace("must do the thing", "must do the OTHER thing");
if (acTableSha256(tbl) === acTableSha256(tblProofChanged)) console.log("  ✓ table format: proof-column edit is binding-neutral");
else { console.log("  ✗ table proof-column edit changed the binding"); rc = 1; }
if (acTableSha256(tbl) !== acTableSha256(tblReqChanged)) console.log("  ✓ table format: requirement edit changes the binding");
else { console.log("  ✗ table requirement edit did not change the binding"); rc = 1; }
// labeled work-item bullet parity
const labeled = `## Acceptance Criteria
- **AC-900-1:** Proven reads run without authority.
- **AC-900-2:** Mutations remain governed.
`;
const labeledRevised = labeled.replace("Mutations remain governed", "Mutations may bypass authority");
if (acTableSha256(labeled) !== acTableSha256("")) console.log("  ✓ labeled bullet format: non-empty ACs produce a non-empty binding");
else { console.log("  ✗ labeled bullet ACs collapsed to the empty binding"); rc = 1; }
if (acTableSha256(labeled) !== acTableSha256(labeledRevised)) console.log("  ✓ labeled bullet format: requirement edit changes the binding");
else { console.log("  ✗ labeled bullet requirement edit did not change the binding"); rc = 1; }
process.exit(rc);
' && pass "recompute behavior verified (progress-insensitive, revision-sensitive, all formats)" || fail "recompute behavior wrong"

# ---- C. check-chain wiring present (recompute, not presence) ----------------
if grep -q "acTableSha256" scripts/check-chain-receipts.mjs; then pass "check-chain-receipts recomputes the baton binding (not key-presence)"; else fail "check-chain-receipts does not recompute the baton"; fi
# Gemini G6 #1 regression lock: a PRESENT baton must ALWAYS be recomputed; the
# version-gated bypass (ac_digests present-but-unbound on a v<3 receipt skips the
# gate) must not return.
if grep -qE "schema_version\) >= 3 \|\| ad\.spec_ac_table_sha256" scripts/check-chain-receipts.mjs; then fail "check-chain baton recompute is version-gated (G6 #1 bypass reintroduced)"; else pass "check-chain recomputes ANY present baton — no version-gated bypass (G6 #1)"; fi

echo "baton AC binding: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
