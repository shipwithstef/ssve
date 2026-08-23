#!/usr/bin/env bash
# scripts/review-plan-codex.sh <plan-manifest-md>
# Plan-review package adapter for scripts/run-external-review.mjs.
# The launcher owns the pinned tuple, stdin transport, schema, receipt, cache,
# timeout, and Codex "--sandbox read-only" isolation policy.
# Exit codes:
#   0 — reviewer completed and shared findings were emitted
#   1 — canonical launcher hard-failed; inspect its actionable receipt
#   2 — findings missing or malformed after a nominal launcher success
#   3 — unsupported orchestrator before launcher invocation
#   4 — cannot derive exactly one authoritative WI; fail-closed, no provider call
set -euo pipefail

PLAN="${1:-}"
if [[ -z "$PLAN" || ! -r "$PLAN" ]]; then
  printf 'usage: review-plan-codex.sh <plan-manifest-md>\n' >&2
  exit 2
fi

# An explicitly selected owner policy is authority, not a hint. Validate it
# before even resolving the reviewer orchestrator so a typo cannot trigger any
# resolver/provider side effect or silently fall back to the legacy schedule.
EXPLICIT_POLICY="${SVC_DISPATCH_POLICY:-${SVC_REVIEWER_POLICY:-}}"
if [[ -n "$EXPLICIT_POLICY" && ! -e "$EXPLICIT_POLICY" && ! -L "$EXPLICIT_POLICY" ]]; then
  printf 'review-plan-codex: explicitly configured owner reviewer policy is missing: %s\n' "$EXPLICIT_POLICY" >&2
  exit 1
fi
if [[ -n "$EXPLICIT_POLICY" && ( ! -f "$EXPLICIT_POLICY" || -L "$EXPLICIT_POLICY" ) ]]; then
  printf 'review-plan-codex: owner reviewer policy exists but is not an eligible regular non-symlink file: %s\n' "$EXPLICIT_POLICY" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAUNCHER="$ROOT/scripts/run-external-review.mjs"
PROTOCOL_REF="$ROOT/references/plan-review-protocol.md"
ORCHESTRATOR="$(bash "$ROOT/scripts/resolve-adversarial-reviewer.sh" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).orchestrator))')"
if [[ -z "$ORCHESTRATOR" || "$ORCHESTRATOR" == "agy" ]]; then
  printf 'review-plan-codex: unsupported orchestrator %q\n' "$ORCHESTRATOR" >&2
  exit 3
fi

PLAN_ABS="$(node -e 'const path=require("path"); process.stdout.write(path.resolve(process.argv[1]))' "$PLAN")"
PLAN_DIR="$(cd "$(dirname "$PLAN_ABS")" && pwd -P)"
CONTEXT_ROOT="$(git -C "$PLAN_DIR" rev-parse --show-toplevel 2>/dev/null || printf '%s' "$PLAN_DIR")"
ARTIFACTS="${SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR:-$ROOT/.svc/external-review-artifacts/plan/pending/$(date -u +%Y%m%dT%H%M%SZ)-$$}"
mkdir -p "$ARTIFACTS"
SUMMARY="$ARTIFACTS/summary.json"
SNAPSHOT_DIR="$CONTEXT_ROOT/.svc/review-plan-snapshots"
mkdir -p "$SNAPSHOT_DIR"
PLAN_SNAPSHOT="$SNAPSHOT_DIR/$(date -u +%Y%m%dT%H%M%SZ)-$$.manifest.md"

# WI-489 phase-to-review-kind binding: prove this paid plan review runs BEFORE
# execute-changeset. The launcher refuses the plan review (zero provider calls)
# if a durable exec-record exists for the WI or implementation files have
# diverged from the pre-execution base. A plan review is the RIGHT operation
# only pre-execution; once code exists, use review-exec instead.
PHASE_ARGS=()
REVIEWER_ARGS=()
REVIEWER_CONFIG="${SVC_DISPATCH_POLICY:-${SVC_REVIEWER_POLICY:-$HOME/.svc/dispatch-policy.json}}"
EXPLICIT_REVIEWER_CONFIG="false"
if [[ -n "${SVC_DISPATCH_POLICY:-}" || -n "${SVC_REVIEWER_POLICY:-}" ]]; then EXPLICIT_REVIEWER_CONFIG="true"; fi
if [[ -e "$REVIEWER_CONFIG" || -L "$REVIEWER_CONFIG" ]]; then
  if [[ ! -f "$REVIEWER_CONFIG" || -L "$REVIEWER_CONFIG" ]]; then
    printf 'review-plan-codex: owner reviewer policy exists but is not an eligible regular non-symlink file: %s\n' "$REVIEWER_CONFIG" >&2
    exit 1
  fi
  REVIEWER_STATION="${SVC_REVIEWER_STATION:-}"
  REVIEWER_ARGS+=(--reviewer-config "$REVIEWER_CONFIG" --reviewer-phase plan)
  if [[ -n "${SVC_REVIEWER_MODE:-}" ]]; then
    REVIEWER_ARGS+=(--reviewer-mode "$SVC_REVIEWER_MODE")
  fi
  if [[ -n "$REVIEWER_STATION" ]]; then
    REVIEWER_ARGS+=(--reviewer-station "$REVIEWER_STATION")
  fi
elif [[ "$EXPLICIT_REVIEWER_CONFIG" == "true" ]]; then
  printf 'review-plan-codex: explicitly configured owner reviewer policy is missing: %s\n' "$REVIEWER_CONFIG" >&2
  exit 1
fi
# Derive EXACTLY ONE authoritative WI through the shared binder. Ambiguity
# (multiple distinct WIs) or absence is FAIL-CLOSED: refuse before any provider
# call rather than silently restoring the original unguarded paid-plan path.
set +e
BIND_JSON="$(node "$ROOT/scripts/resolve-execute-dispatch.mjs" bind-plan --repo "$CONTEXT_ROOT" --manifest "$PLAN_ABS" --snapshot-out "$PLAN_SNAPSHOT" 2>"$ARTIFACTS/bind-plan.err")"
BIND_RC=$?
set -e
if [[ "$BIND_RC" -ne 0 ]]; then
  BIND_ERR="$(cat "$ARTIFACTS/bind-plan.err" 2>/dev/null || true)"
  printf 'review-plan-codex: %s\n' "${BIND_ERR:-cannot derive exactly one authoritative WI}" >&2
  exit 4
fi
WI="$(printf '%s' "$BIND_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.wi) process.exit(4); process.stdout.write(j.wi);})')"
PLAN_SHA="$(printf '%s' "$BIND_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!/^[a-f0-9]{64}$/.test(j.manifest_sha256||"")) process.exit(4); process.stdout.write(j.manifest_sha256);})')"
if [[ -z "$WI" ]]; then
  printf 'review-plan-codex: cannot derive exactly one authoritative WI (found 0: ); refusing plan review before any provider call. Use an unambiguous WI branch or plan, or run review-exec if implementation has begun.\n' >&2
  exit 4
fi
PRE_EXEC_BASE="$(git -C "$CONTEXT_ROOT" merge-base HEAD origin/main 2>/dev/null || git -C "$CONTEXT_ROOT" rev-parse origin/main 2>/dev/null || echo origin/main)"
PHASE_BINDING="$ARTIFACTS/phase-binding.json"
printf '{"wi":"%s","pre_execution_base":"%s","plan_manifest_sha256":"%s"}\n' "$WI" "$PRE_EXEC_BASE" "$PLAN_SHA" > "$PHASE_BINDING"
PHASE_ARGS+=(--phase-binding "$PHASE_BINDING")
if [[ -n "${SVC_EXTERNAL_REVIEW_PHASE_OVERRIDE_FILE:-}" ]]; then
  PHASE_ARGS+=(--phase-override-file "$SVC_EXTERNAL_REVIEW_PHASE_OVERRIDE_FILE")
fi

# OUTPUT-FIRST PROTOCOL remains in the package so the review content contract
# stays explicit even though schema-constrained findings replace YAML tail parsing.
{
  cat <<EOF
OUTPUT-FIRST PROTOCOL: return only the schema-constrained findings object. Do not emit a preamble.

candidate_digest=$PLAN_SHA

You are an adversarial plan reviewer. Find flaws, missing determinism, and unreachable assumptions. You are not the plan author.

SCOPE LOCK: evaluate only this plan and paths it names. Do not explore unrelated repository state.

FOCUS DIMENSIONS:
  (a) AC-to-task coverage gaps
  (b) scope-boundary leaks
  (c) rollback adequacy
  (d) determinism rubric
  (e) idempotency and rerun safety
  (f) execute risk
  (g) lane compliance: every mandatory upstream skill must be completed with an artifact or skipped with a cited decision; an unnamed mandatory skill is a failing finding

Use review_kind "plan" and set rubric_score to the 0-10 determinism score. For zero findings, use verdict "pass" and findings []. Every finding needs id, severity, claim, analysis, evidence, and proposed_fix.

PROTOCOL REFERENCE:
EOF
  cat "$PROTOCOL_REF"
  printf '\nPLAN TO REVIEW:\n'
  cat "$PLAN_SNAPSHOT"
} | SVC_WI="$WI" node "$LAUNCHER" --orchestrator "$ORCHESTRATOR" --review-kind plan --candidate-digest "$PLAN_SHA" --context-root "$CONTEXT_ROOT" ${REVIEWER_ARGS[@]+"${REVIEWER_ARGS[@]}"} ${PHASE_ARGS[@]+"${PHASE_ARGS[@]}"} --artifacts-dir "$ARTIFACTS" > "$SUMMARY" || exit 1

FINDINGS="$(node -e 'const fs=require("fs");const s=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!s.ok||!s.findings)process.exit(2);process.stdout.write(s.findings)' "$SUMMARY")" || {
  printf 'review-plan-codex: findings missing from launcher summary; artifact=%s\n' "$SUMMARY" >&2
  exit 2
}
node -e 'const fs=require("fs");const f=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!Array.isArray(f.findings)||typeof f.verdict!=="string"||!Number.isInteger(f.rubric_score))process.exit(2);process.stdout.write(JSON.stringify(f,null,2)+"\n")' "$FINDINGS" || {
  printf 'review-plan-codex: findings missing or malformed; artifact=%s\n' "$FINDINGS" >&2
  exit 2
}
RECEIPT="$(node -e 'const fs=require("fs");const s=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(typeof s.receipt!=="string"||!s.receipt)process.exit(2);process.stdout.write(s.receipt)' "$SUMMARY")" || {
  printf 'review-plan-codex: receipt missing from launcher summary; artifact=%s\n' "$SUMMARY" >&2
  exit 2
}
printf 'review-plan-codex: receipt=%s\n' "$RECEIPT" >&2
