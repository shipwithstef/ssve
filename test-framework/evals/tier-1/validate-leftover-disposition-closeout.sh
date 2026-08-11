#!/usr/bin/env bash
# Tier 1: WI-345 leftover-disposition closeout guard.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }

expect_pass() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    pass "$label"
  else
    "$@" || true
    fail "$label"
  fi
}

expect_fail() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    fail "$label"
  else
    pass "$label"
  fi
}

make_repo() {
  local root="$1"
  mkdir -p "$root/docs/logs" "$root/test-results" "$root/.svc/leftover-dispositions"
  git -C "$root" init -q
  git -C "$root" config user.email "svc@example.test"
  git -C "$root" config user.name "svc"
  printf '.svc/leftover-dispositions/\n' > "$root/.gitignore"
  printf 'baseline\n' > "$root/docs/logs/base44-environment.md"
  git -C "$root" add .gitignore docs/logs/base44-environment.md
  git -C "$root" commit -q -m baseline
}

echo "=== Tier 1: Leftover Disposition Closeout ==="

node --check "$REPO_ROOT/scripts/validate-leftover-disposition.mjs" >/dev/null
pass "validator syntax valid"

for file in skills/route-workflow/SKILL.md skills/verify-promotion/SKILL.md skills/land-changeset/SKILL.md; do
  if grep -Fq "references/leftover-disposition.md" "$REPO_ROOT/$file"; then
    pass "$file references shared leftover-disposition rule"
  else
    fail "$file references shared leftover-disposition rule"
  fi
done

expect_pass "reference defines required columns" \
  bash -c "grep -Fq 'path' '$REPO_ROOT/references/leftover-disposition.md' && grep -Fq 'status' '$REPO_ROOT/references/leftover-disposition.md' && grep -Fq 'reason' '$REPO_ROOT/references/leftover-disposition.md' && grep -Fq 'follow_up' '$REPO_ROOT/references/leftover-disposition.md'"

expect_pass "reference defines all disposition statuses" \
  bash -c "for s in committed gitignored deleted local-evidence deferred user-owned; do grep -Fq \"\`\$s\`\" '$REPO_ROOT/references/leftover-disposition.md' || exit 1; done"

expect_pass "reference defines clean-repo hard gate" \
  bash -c "grep -Fq 'Clean-Repo Requests Are Hard Gates' '$REPO_ROOT/references/leftover-disposition.md' && grep -Fq 'a leftover-disposition ledger is not sufficient' '$REPO_ROOT/references/leftover-disposition.md'"

expect_pass "reference covers common residue families from clean-repo failures" \
  bash -c "grep -Fq '.svc/loop-guard-state.json' '$REPO_ROOT/references/leftover-disposition.md' && grep -Fq '.svc/pipeline-decisions.jsonl' '$REPO_ROOT/references/leftover-disposition.md' && grep -Fq 'docs/specs/research-log.md' '$REPO_ROOT/references/leftover-disposition.md' && grep -Fq '.svc/lane-tasks-*.json' '$REPO_ROOT/references/leftover-disposition.md' && grep -Fq 'docs/specs/**/*.md' '$REPO_ROOT/references/leftover-disposition.md'"

expect_pass "reference explains tracked-vs-ignored rule" \
  bash -c "grep -Fq 'Tracked-Vs-Ignored Rule' '$REPO_ROOT/references/leftover-disposition.md' && grep -Fq 'git rm --cached .svc/loop-guard-state.json' '$REPO_ROOT/references/leftover-disposition.md'"

expect_pass "route-workflow enforces universal local residue closeout" \
  bash -c "grep -Fq 'Universal Local Residue Closeout' '$REPO_ROOT/skills/route-workflow/SKILL.md' && grep -Fq 'not a substitute' '$REPO_ROOT/skills/route-workflow/SKILL.md' && grep -Fq 'actually cleaning the repo' '$REPO_ROOT/skills/route-workflow/SKILL.md' && grep -Fq 'do not treat \`.gitignore\` as a disposition' '$REPO_ROOT/skills/route-workflow/SKILL.md'"

BAD="$TMP/bad"
make_repo "$BAD"
printf 'validation run\n' >> "$BAD/docs/logs/base44-environment.md"
printf '{"ok":true}\n' > "$BAD/test-results/prod-location-validation.json"

expect_fail "dirty operation log plus untracked JSON fails without ledger" \
  node "$REPO_ROOT/scripts/validate-leftover-disposition.mjs" --root "$BAD"

cat > "$BAD/.svc/leftover-dispositions/WI-345.json" <<'JSON'
{
  "schema_version": 1,
  "work_item": "WI-345",
  "entries": [
    {
      "path": "docs/logs/base44-environment.md",
      "status": "local-evidence",
      "reason": "Local Base44 operation log kept for the validation run."
    }
  ]
}
JSON

expect_fail "partial ledger still fails when untracked JSON is missing" \
  node "$REPO_ROOT/scripts/validate-leftover-disposition.mjs" \
    --root "$BAD" \
    --ledger .svc/leftover-dispositions/WI-345.json

cat > "$BAD/.svc/leftover-dispositions/WI-345.json" <<'JSON'
{
  "schema_version": 1,
  "work_item": "WI-345",
  "git_status_command": "git status --short --untracked-files=all",
  "entries": [
    {
      "path": "docs/logs/base44-environment.md",
      "status": "local-evidence",
      "reason": "Local Base44 operation log kept for the validation run."
    },
    {
      "path": "test-results/prod-location-validation.json",
      "status": "local-evidence",
      "reason": "Production validation JSON is local proof and not source."
    }
  ]
}
JSON

expect_pass "local-evidence ledger covers modified log and untracked JSON" \
  node "$REPO_ROOT/scripts/validate-leftover-disposition.mjs" \
    --root "$BAD" \
    --ledger .svc/leftover-dispositions/WI-345.json

IGNORED="$TMP/tracked-ignored"
make_repo "$IGNORED"
mkdir -p "$IGNORED/.svc"
printf '.svc/loop-guard-state.json\n' >> "$IGNORED/.gitignore"
printf '{"history":[]}\n' > "$IGNORED/.svc/loop-guard-state.json"
git -C "$IGNORED" add .gitignore
git -C "$IGNORED" add -f .svc/loop-guard-state.json
git -C "$IGNORED" commit -q -m "track legacy loop guard state"
printf '{"history":[{"fp":"changed"}]}\n' > "$IGNORED/.svc/loop-guard-state.json"
cat > "$IGNORED/.svc/leftover-dispositions/WI-345.json" <<'JSON'
{
  "schema_version": 1,
  "work_item": "WI-345",
  "entries": [
    {
      "path": ".svc/loop-guard-state.json",
      "status": "gitignored",
      "reason": "Loop guard state is local cache."
    }
  ]
}
JSON

expect_fail "tracked ignored cache cannot be closed as gitignored" \
  node "$REPO_ROOT/scripts/validate-leftover-disposition.mjs" \
    --root "$IGNORED" \
    --ledger .svc/leftover-dispositions/WI-345.json

COMMITTED="$TMP/committed"
make_repo "$COMMITTED"
printf 'validation run\n' >> "$COMMITTED/docs/logs/base44-environment.md"
printf '{"ok":true}\n' > "$COMMITTED/test-results/prod-location-validation.json"
git -C "$COMMITTED" add docs/logs/base44-environment.md test-results/prod-location-validation.json
git -C "$COMMITTED" commit -q -m "commit validation evidence"

expect_pass "committed evidence leaves clean closeout with no ledger required" \
  node "$REPO_ROOT/scripts/validate-leftover-disposition.mjs" --root "$COMMITTED"

if grep -Fq ".svc/leftover-dispositions/" "$REPO_ROOT/.gitignore"; then
  pass "transient leftover-disposition ledgers are gitignored"
else
  fail "transient leftover-disposition ledgers are gitignored"
fi

echo
echo "leftover disposition closeout: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]
