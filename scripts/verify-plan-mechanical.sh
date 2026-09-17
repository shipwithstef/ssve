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
REPO_ROOT="$(pwd)"
PHASE="execution"
ROOT_SEEN=0
PHASE_SEEN=0
usage() { echo "usage: verify-plan-mechanical.sh <plan-manifest> [repo-root] [--phase plan|execution]" >&2; exit 2; }
[ -n "$PLAN" ] && [ -r "$PLAN" ] || usage
shift
while [ "$#" -gt 0 ]; do
  case "$1" in
    --phase)
      [ "$PHASE_SEEN" -eq 0 ] && [ "$#" -ge 2 ] || usage
      case "$2" in plan|execution) PHASE="$2" ;; *) usage ;; esac
      PHASE_SEEN=1; shift 2 ;;
    --*) usage ;;
    *) [ "$ROOT_SEEN" -eq 0 ] || usage
       REPO_ROOT="$1"; ROOT_SEEN=1; shift ;;
  esac
done
PLAN="$(cd "$(dirname "$PLAN")" && pwd)/$(basename "$PLAN")"
SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || { echo "repo root not accessible: $REPO_ROOT" >&2; exit 2; }
REPO_ROOT="$(pwd)"
PLAN_CONTRACT="$(dirname "$PLAN")/plan-contract.json"

FAIL=0
REPORT=""

report() { REPORT="${REPORT}${1}"$'\n'; FAIL=$((FAIL+1)); }

DEFERRED_PATHS=""
if [ "$PHASE" = "plan" ] && [ -f "$PLAN_CONTRACT" ]; then
  if ! DEFERRED_PATHS=$(node --input-type=module - "$SCRIPT_ROOT/scripts/validate-plan-contract.mjs" "$PLAN_CONTRACT" "$REPO_ROOT" <<'NODE'
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const { planDeferredPaths } = await import(pathToFileURL(process.argv[2]));
const contract = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
for (const file of planDeferredPaths(contract, { root: process.argv[4] })) console.log(file);
NODE
  ); then report "C1-FAIL: cannot validate declared future paths"; fi
fi

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
    if [ "$PHASE" = "plan" ] && printf '%s\n' "$DEFERRED_PATHS" | grep -Fxq -- "$path"; then continue; fi
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

# ── Check 7: explicit v4 inline contract, otherwise legacy shell sequence ──
if grep -q '^<!-- SVC_PLAN_BODY -->$' "$PLAN"; then
  if ! node "$SCRIPT_ROOT/scripts/prepare-plan-handoff.mjs" --manifest "$PLAN" --check; then
    report "C7-FAIL: explicit inline v4 handoff is invalid"
  fi
elif ! grep -q '## Execution Command Sequence' "$PLAN"; then
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

# ── Check 12: AGY/Gemini authored plans must record User Intent ───────────
if grep -qiE '^[[:space:]]*(author|orchestrator):[[:space:]]*["'"'"']?(antigravity|gemini|agy)["'"'"']?' "$PLAN"; then
  intent_body=$(awk '/^## (4\. )?User Intent/{flag=1; next} /^## /{flag=0} flag' "$PLAN" | sed '/^[[:space:]]*$/d')
  if [ -z "$intent_body" ]; then
    report "[FAIL] AGY/Gemini authored plan must include a non-empty '## User Intent' section"
  fi
fi

# ── Report ────────────────────────────────────────────────────────────────
PLAN_CONTRACT="$(dirname "$PLAN")/plan-contract.json"
if [ -f "$PLAN_CONTRACT" ]; then
  # WI-553 AC-553-3/4: validate-plan-contract.mjs also mechanically checks the
  # risk-triggered sections (concurrency, external_writer, lossless_rmw,
  # idempotent_rewriter) whenever plan-contract.json declares the matching
  # risk_flags — same call, no separate invocation needed.
  if ! node "$SCRIPT_ROOT/scripts/validate-plan-contract.mjs" "$PLAN_CONTRACT" "$REPO_ROOT" --phase "$PHASE"; then
    report "C10-FAIL: adjacent product-safety plan contract is invalid"
  fi
fi

# ── Check 11: manifest-declared risk flags require a matching plan-contract.json ──
# WI-553 AC-553-3: a manifest that declares "**Risk Flags:** <flag>[, <flag>...]"
# for any AC-553-1 flag MUST have an adjacent plan-contract.json whose
# risk_flags array includes that flag — otherwise the risk-triggered sections
# (and their AC-553-4 mechanical checks) would never run. Manifests with no
# "**Risk Flags:**" line, or an explicit "none"/"n/a", are unaffected — this
# is the AC-553-6 efficiency bound: zero extra cost for unmatched work.
RISK_LINE=$(grep -m1 -E '^[[:space:]]*(-[[:space:]]+)?\*\*Risk Flags:\*\*' "$PLAN" || true)
if [ -n "$RISK_LINE" ]; then
  DECLARED=$(echo "$RISK_LINE" | sed -E 's/^[[:space:]]*(-[[:space:]]+)?\*\*Risk Flags:\*\*[[:space:]]*//' | tr ',' '\n' | sed -E 's/^[[:space:]]+|[[:space:]]+$//g' | grep -viE '^(none|n/a)?$' || true)
  MATCHED=$(echo "$DECLARED" | grep -E '^(runtime_concurrency|external_state_writer|config_schema_migration|lossless_rmw|idempotent_rewriter)$' || true)
  if [ -n "$MATCHED" ]; then
    if [ ! -f "$PLAN_CONTRACT" ]; then
      report "C11-FAIL: manifest declares risk flag(s) [$(echo "$MATCHED" | tr '\n' ' ' | sed -E 's/[[:space:]]+$//')] but no plan-contract.json exists beside the manifest (WI-553 AC-553-3)"
    else
      CONTRACT_FLAGS=$(node -e 'let c;try{c=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))}catch(e){process.exit(0)};(c.risk_flags||[]).forEach((f)=>console.log(f))' "$PLAN_CONTRACT" 2>/dev/null || true)
      while IFS= read -r f; do
        [ -z "$f" ] && continue
        if ! printf '%s\n' "$CONTRACT_FLAGS" | grep -qx "$f"; then
          report "C11-FAIL: manifest declares risk flag '$f' but plan-contract.json risk_flags does not include it (WI-553 AC-553-3)"
        fi
      done <<< "$MATCHED"
    fi
  fi
fi

if [ "$FAIL" -eq 0 ]; then
  echo "TIER-1 PASS ($PHASE): all mechanical checks passed for $PLAN"
  exit 0
else
  echo "TIER-1 FAIL: $FAIL issue(s) detected"
  echo "$REPORT"
  exit 1
fi
