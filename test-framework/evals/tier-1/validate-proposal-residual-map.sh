#!/usr/bin/env bash
# Tier-1 validator for WI-311 residual proposal mapping.

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

echo "=== Tier 1: Proposal Residual Map ==="

if node --check scripts/validate-proposal-residual-map.mjs >/tmp/proposal-residual-map-syntax.out 2>&1; then
  pass "validator syntax valid"
else
  cat /tmp/proposal-residual-map-syntax.out
  fail "validator syntax valid"
fi

if node scripts/validate-proposal-residual-map.mjs >/tmp/proposal-residual-map-current.out 2>&1; then
  cat /tmp/proposal-residual-map-current.out
  pass "all triage residual maps are structurally valid"
else
  cat /tmp/proposal-residual-map-current.out
  fail "all triage residual maps are structurally valid"
fi

if node - <<'NODE'
const fs = require("node:fs");
const map = JSON.parse(fs.readFileSync("docs/specs/work-items/WI-311-residual-map.json", "utf8"));
const source = map.sources.find((entry) => entry.proposal === "proposals/done/2026-04-20-session-audit-capture-idea-wrong-repo.md");
if (!source) process.exit(1);
const finding = source.findings.find((entry) => entry.id === "F1");
if (!finding || finding.classification !== "covered" || finding.owner_wi !== "WI-210") process.exit(1);
NODE
then
  pass "historical session-audit fixture is mapped"
else
  fail "historical session-audit fixture is mapped"
fi

if node - <<'NODE'
const fs = require("node:fs");
const triage = JSON.parse(fs.readFileSync("proposals/triage.json", "utf8"));
const expected = [
  "2026-04-19-evolution.md",
  "2026-04-20-session-audit-capture-idea-wrong-repo.md",
  "2026-04-21-evolution.md",
  "2026-04-24-framework-cohesion-evolution.md",
  "2026-04-25-comprehensive-session-audit.md",
  "2026-05-04-session-audit-opencode-go-research.md",
  "2026-05-06-session-audit-catalog-skill.md",
  "2026-05-06-session-audit-fix-phase.md",
];
for (const name of expected) {
  const entry = triage.entries[name];
  if (!entry || entry.accepted_wi !== "WI-311") process.exit(1);
  if (entry.residual_map !== "docs/specs/work-items/WI-311-residual-map.json") process.exit(1);
}
NODE
then
  pass "WI-311 triage entries point to residual map"
else
  fail "WI-311 triage entries point to residual map"
fi

echo "proposal residual map: $PASS passed, $FAIL failed"

if [[ "$FAIL" -ne 0 ]]; then
  exit 1
fi
