#!/usr/bin/env bash
# Tier-1 validator: accepted proposals must be archived and owned by WIs.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

PASS=0
FAIL=0

pass() {
  echo "  ✓ $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  ✗ $1"
  FAIL=$((FAIL + 1))
}

make_fixture() {
  local root="$1"
  local proposal_name="${2:-2026-05-01-example.md}"
  mkdir -p "$root/proposals/done" "$root/docs/specs/work-items"
  cat > "$root/proposals/triage.json" <<JSON
{
  "schema": 1,
  "max_open_days": 1,
  "max_defer_days": 14,
  "entries": {
    "$proposal_name": {
      "accepted_wi": "WI-001",
      "residual_map": "docs/specs/work-items/WI-001-residual-map.json"
    }
  }
}
JSON
  cat > "$root/docs/specs/work-items/WI-001.md" <<'EOF_WI'
# WI-001: Example

**Status:** backlog
EOF_WI
}

echo "=== Tier 1: Proposal Promotion Closeout ==="

if node --check scripts/validate-proposal-promotion-closeout.mjs >/dev/null; then
  pass "validator syntax valid"
else
  fail "validator syntax invalid"
fi

TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

make_fixture "$TMP_ROOT/open"
cat > "$TMP_ROOT/open/proposals/2026-05-01-example.md" <<'EOF_PROPOSAL'
# Example Proposal
EOF_PROPOSAL
cat > "$TMP_ROOT/open/docs/specs/work-items/WI-001-residual-map.json" <<'JSON'
{
  "schema": 1,
  "wi": "WI-001",
  "source_proposals": ["proposals/2026-05-01-example.md"],
  "coverage": [
    {
      "source_proposal": "proposals/2026-05-01-example.md",
      "proposal_item": "F-1",
      "status": "covered",
      "owner_wi": "WI-001",
      "evidence": ["fixture"]
    }
  ],
  "residuals": []
}
JSON
cat > "$TMP_ROOT/open/docs/specs/work-items/PROPOSAL-PROMOTION-LEDGER.md" <<'EOF_LEDGER'
# Proposal Promotion Ledger

| Proposal | Accepted WI | Notes |
|---|---:|---|
| `2026-05-01-example.md` | WI-001 | fixture |
EOF_LEDGER

if node scripts/validate-proposal-promotion-closeout.mjs --root "$TMP_ROOT/open" >/tmp/svc-proposal-open.err 2>&1; then
  fail "validator rejects accepted proposal left open"
else
  if grep -q "accepted proposal must be archived" /tmp/svc-proposal-open.err; then
    pass "validator rejects accepted proposal left open"
  else
    cat /tmp/svc-proposal-open.err
    fail "validator reject message for open accepted proposal"
  fi
fi

make_fixture "$TMP_ROOT/stale-map"
cat > "$TMP_ROOT/stale-map/proposals/done/2026-05-01-example.md" <<'EOF_PROPOSAL'
# Example Proposal
EOF_PROPOSAL
cat > "$TMP_ROOT/stale-map/docs/specs/work-items/WI-001-residual-map.json" <<'JSON'
{
  "schema": 1,
  "wi": "WI-001",
  "source_proposals": ["proposals/2026-05-01-example.md"],
  "coverage": [
    {
      "source_proposal": "proposals/2026-05-01-example.md",
      "proposal_item": "F-1",
      "status": "covered",
      "owner_wi": "WI-001",
      "evidence": ["fixture"]
    }
  ],
  "residuals": []
}
JSON
cat > "$TMP_ROOT/stale-map/docs/specs/work-items/PROPOSAL-PROMOTION-LEDGER.md" <<'EOF_LEDGER'
# Proposal Promotion Ledger

| Proposal | Accepted WI | Notes |
|---|---:|---|
| `2026-05-01-example.md` | WI-001 | fixture |
EOF_LEDGER

if node scripts/validate-proposal-promotion-closeout.mjs --root "$TMP_ROOT/stale-map" >/tmp/svc-proposal-stale-map.err 2>&1; then
  fail "validator rejects residual map pointing at open proposal path"
else
  if grep -q "residual_map still references open source" /tmp/svc-proposal-stale-map.err; then
    pass "validator rejects residual map pointing at open proposal path"
  else
    cat /tmp/svc-proposal-stale-map.err
    fail "validator reject message for stale residual map"
  fi
fi

make_fixture "$TMP_ROOT/good"
cat > "$TMP_ROOT/good/proposals/done/2026-05-01-example.md" <<'EOF_PROPOSAL'
# Example Proposal
EOF_PROPOSAL
cat > "$TMP_ROOT/good/docs/specs/work-items/WI-001-residual-map.json" <<'JSON'
{
  "schema": 1,
  "wi": "WI-001",
  "source_proposals": ["proposals/done/2026-05-01-example.md"],
  "coverage": [
    {
      "source_proposal": "proposals/done/2026-05-01-example.md",
      "proposal_item": "F-1",
      "status": "covered",
      "owner_wi": "WI-001",
      "evidence": ["fixture"]
    }
  ],
  "residuals": []
}
JSON
cat > "$TMP_ROOT/good/docs/specs/work-items/PROPOSAL-PROMOTION-LEDGER.md" <<'EOF_LEDGER'
# Proposal Promotion Ledger

| Proposal | Accepted WI | Notes |
|---|---:|---|
| `2026-05-01-example.md` | WI-001 | fixture |
EOF_LEDGER

if node scripts/validate-proposal-promotion-closeout.mjs --root "$TMP_ROOT/good" >/tmp/svc-proposal-good.out 2>&1; then
  pass "validator accepts archived proposal with WI and residual map"
else
  cat /tmp/svc-proposal-good.out
  fail "validator accepts archived proposal with WI and residual map"
fi

if node scripts/validate-proposal-promotion-closeout.mjs >/tmp/svc-proposal-repo.out 2>&1; then
  pass "repo proposal promotion closeout passes"
else
  cat /tmp/svc-proposal-repo.out
  fail "repo proposal promotion closeout passes"
fi

if [[ $FAIL -gt 0 ]]; then
  echo "proposal promotion closeout: $PASS passed, $FAIL failed"
  exit 1
fi

echo "proposal promotion closeout: $PASS passed, $FAIL failed"
