#!/bin/bash
# scripts/verify-plan-mechanical.sh <plan-manifest-md> [repo-root]
#
# Tier-1 of the review-plan gate: deterministic, model-free checks on a
# plan-changeset manifest. Runs in the orchestrator's current session, no
# subprocess needed. Emits a concise report; exit 0 on all-pass, exit 1 on
# any failure.
#
# Checks:
#   1. Every file path in "files_touched" / "new files" / "edited files" blocks
#      resolves on disk (test -f / test -d). Orchestrator knows path typos
#      and rename-drift kill plans.
#   2. Every npm/pnpm/yarn script referenced in the plan exists in package.json.
#   3. Every shell command passes `bash -n` syntax check.
#   4. No forbidden patterns: --force, --no-verify, git push -f, rm -rf /,
#      sudo, curl | sh. These never appear in a sane plan.
#   5. Every blocked_by reference in embedded JSON task-graph resolves to a
#      valid task id.
#   6. Every claimed CLI tool is on PATH.
#
# Usage:
#   bash scripts/verify-plan-mechanical.sh docs/plans/2026-04-20-wi-099/manifest.md
set -u   # explicit fail tracking, no auto-exit on nonzero

PLAN="${1:-}"
REPO_ROOT="${2:-$(pwd)}"
if [ -z "$PLAN" ] || [ ! -r "$PLAN" ]; then
  echo "usage: verify-plan-mechanical.sh <plan-manifest> [repo-root]" >&2
  exit 2
fi

cd "$REPO_ROOT" || { echo "repo root not accessible: $REPO_ROOT" >&2; exit 2; }

FAIL=0
REPORT=""

report() { REPORT="${REPORT}${1}"$'\n'; FAIL=$((FAIL+1)); }

# ── Check 1: file paths resolve ───────────────────────────────────────────
# Extract paths from markdown code spans that look like files (contain / and .)
# and from explicit "**File:**", "File:", "files_touched:" style listings.
while IFS= read -r path; do
  [ -z "$path" ] && continue
  # Skip if path looks like URL, shell var, command example
  case "$path" in http*|\$*|*\ *|*\`*) continue ;; esac
  # Only verify paths that look repo-relative (no leading /, has / inside)
  case "$path" in /*) continue ;; */*) ;; *) continue ;; esac
  if [ ! -e "$path" ]; then
    report "C1-FAIL: path does not exist: $path"
  fi
done < <(grep -oE '`[^` ]+\.(js|jsx|ts|tsx|md|json|sh|yaml|yml|py|go|rs|css|html|vue)`' "$PLAN" \
         | tr -d '`' \
         | sort -u)

# ── Check 2: npm scripts exist ────────────────────────────────────────────
if [ -f package.json ] && command -v jq >/dev/null 2>&1; then
  while IFS= read -r script; do
    [ -z "$script" ] && continue
    exists=$(jq -r --arg s "$script" '.scripts[$s] // empty' package.json 2>/dev/null)
    if [ -z "$exists" ]; then
      report "C2-FAIL: npm script '$script' not defined in package.json"
    fi
  done < <(grep -oE 'npm run [a-z0-9:_-]+' "$PLAN" | awk '{print $3}' | sort -u)
fi

# ── Check 3: bash commands lint ───────────────────────────────────────────
# Extract fenced bash blocks, try `bash -n` on each
awk '/^```bash$|^```sh$/{flag=1; next} /^```$/{flag=0} flag' "$PLAN" > /tmp/plan-bash-blocks.sh 2>/dev/null || true
if [ -s /tmp/plan-bash-blocks.sh ]; then
  if ! bash -n /tmp/plan-bash-blocks.sh 2>/tmp/plan-bash-err; then
    report "C3-FAIL: bash syntax error in plan:"
    report "$(cat /tmp/plan-bash-err | head -5)"
  fi
fi
rm -f /tmp/plan-bash-blocks.sh /tmp/plan-bash-err

# ── Check 4: forbidden patterns ───────────────────────────────────────────
# grep -c always prints a count (even 0); exit code reflects match status.
# We want the count only, so capture stdout and ignore exit code.
for pattern in '\-\-force' '\-\-no-verify' 'git push -f' 'rm -rf /' 'curl.*\| *sh' '\bsudo '; do
  hits=$(grep -cE "$pattern" "$PLAN" 2>/dev/null; true)
  hits=$(echo "$hits" | head -1)
  if [ "${hits:-0}" -gt 0 ] 2>/dev/null; then
    report "C4-FAIL: forbidden pattern '$pattern' appears $hits time(s) in plan"
  fi
done

# ── Check 5: task-graph blocked_by references resolve ─────────────────────
# Extract embedded JSON task graph (between ```json fences if present)
awk '/^```json$/{flag=1; next} /^```$/{flag=0} flag' "$PLAN" > /tmp/plan-tasks.json 2>/dev/null || true
if [ -s /tmp/plan-tasks.json ] && command -v jq >/dev/null 2>&1; then
  if jq -e '.tasks' /tmp/plan-tasks.json >/dev/null 2>&1; then
    IDS=$(jq -r '.tasks[].id' /tmp/plan-tasks.json | sort -u)
    BLOCKED=$(jq -r '.tasks[].blocked_by // [] | .[]' /tmp/plan-tasks.json | sort -u)
    for b in $BLOCKED; do
      if ! echo "$IDS" | grep -qx "$b"; then
        report "C5-FAIL: task references blocked_by=$b which is not a valid task id"
      fi
    done
  fi
fi
rm -f /tmp/plan-tasks.json

# ── Check 6: claimed CLI tools on PATH ────────────────────────────────────
# Look for standalone commands that imply tool availability
for tool in node npm git jq gh codex opencode claude; do
  hits=$(grep -cE "\b$tool\b" "$PLAN" 2>/dev/null; true)
  hits=$(echo "$hits" | head -1)
  if [ "${hits:-0}" -gt 0 ] 2>/dev/null && ! command -v "$tool" >/dev/null 2>&1; then
    report "C6-WARN: plan references '$tool' but it is not on PATH (orchestrator host)"
  fi
done

# ── Check 7: fenced shell block under ## Execution Command Sequence ────────
# WI-386 reconciliation: C7 (Execution Command Sequence) stays MANDATORY in BOTH
# execution modes — the inline path still needs a copy-pasteable bash pipeline; only
# §3a Changeset Blueprint (and therefore C8's MODIFY-diff fences below, which fire
# solely when `<<<<<<< BEFORE` markers exist) is mode-conditional. So an inline-mode
# manifest legitimately carries no diff blueprints (C8 simply finds no markers and is
# a no-op) yet must still pass C7 and C9.
if ! grep -q '## Execution Command Sequence' "$PLAN"; then
  report "C7-FAIL: '## Execution Command Sequence' section is missing"
else
  has_seq=$(awk '/## Execution Command Sequence/{flag=1; next} /^#/{flag=0} flag' "$PLAN" | grep -cE '^```(bash|sh)$' || true)
  if [ "${has_seq:-0}" -eq 0 ]; then
    report "C7-FAIL: '## Execution Command Sequence' lacks a fenced shell block (sh/bash)"
  fi
fi

# ── Check 8: MODIFY changeset diff formatting ──────────────────────────────
if grep -q '<<<<<<< BEFORE' "$PLAN"; then
  awk '/<<<<<<< BEFORE/{flag=1; count=0; before=0; after=0; next} flag && /=======/{before=count; count=0; next} flag && />>>>>>> AFTER/{after=count; flag=0; print before, after; next} flag{count++}' "$PLAN" > /tmp/plan-diffs.txt 2>/dev/null || true
  while read -r before after; do
    if [ -z "$before" ] || [ -z "$after" ]; then
      report "C8-FAIL: invalid diff markers in plan (unclosed <<<<<<< BEFORE or missing =======)"
    elif [ "$before" -lt 3 ] || [ "$after" -lt 3 ]; then
      report "C8-FAIL: diff blueprint lacks sufficient context (requires at least 3 lines of BEFORE and 3 lines of AFTER context, got $before and $after)"
    fi
  done < /tmp/plan-diffs.txt
  rm -f /tmp/plan-diffs.txt
fi

# ── Check 9: prerequisite matrix ──────────────────────────────────────────
# WI-386 reconciliation: C9 (Prerequisite Alignment Matrix) stays MANDATORY in BOTH
# modes — UX/UI/tech/style traces are independent of whether code payloads are inlined.
if ! grep -q '## Prerequisite Alignment Matrix' "$PLAN"; then
  report "C9-FAIL: '## Prerequisite Alignment Matrix' section is missing"
else
  has_matrix=$(awk '/## Prerequisite Alignment Matrix/{flag=1; next} /^#/{flag=0} flag' "$PLAN" | grep -c '|' || true)
  if [ "${has_matrix:-0}" -lt 3 ]; then
    report "C9-FAIL: '## Prerequisite Alignment Matrix' lacks a valid mapping table"
  fi
fi

# ── Report ────────────────────────────────────────────────────────────────
if [ "$FAIL" -eq 0 ]; then
  echo "TIER-1 PASS: all mechanical checks passed for $PLAN"
  exit 0
else
  echo "TIER-1 FAIL: $FAIL issue(s) detected"
  echo "$REPORT"
  exit 1
fi
