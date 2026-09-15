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

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAUNCHER="$ROOT/scripts/run-external-review.mjs"
PROTOCOL_REF="$ROOT/references/plan-review-protocol.md"
ORCHESTRATOR="$(bash "$ROOT/scripts/resolve-adversarial-reviewer.sh" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).orchestrator))')"
if [[ -z "$ORCHESTRATOR" || "$ORCHESTRATOR" == "agy" ]]; then
  printf 'review-plan-codex: unsupported orchestrator %q\n' "$ORCHESTRATOR" >&2
  exit 3
fi

CONTEXT_ROOT="$(git -C "$(dirname "$PLAN")" rev-parse --show-toplevel 2>/dev/null || pwd -P)"
PLAN_FILE_ARGS=()
if grep -Fq '<!-- SVC_PLAN_BODY -->' "$PLAN"; then
  # Retain exact prepared bytes, including the authentic v4 bootstrap bytes.
  PLAN_SHA="$(node --input-type=module - "$ROOT" "$CONTEXT_ROOT" "$PLAN" <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
const [pkg,root,manifest] = process.argv.slice(2);
const {parsePlanBytes,containedReader} = await import(pathToFileURL(path.join(pkg,'scripts/lib/plan-manifest-contract.mjs')));
const {loadPlanAuthority} = await import(pathToFileURL(path.join(pkg,'scripts/lib/receipt-issuance-epoch.mjs')));
const {withStateLock} = await import(pathToFileURL(path.join(pkg,'scripts/state-io.mjs')));
const rel=path.relative(root,path.resolve(manifest)).split(path.sep).join('/');
const markdown=containedReader(root)(rel);
let bytes=parsePlanBytes(markdown);
const body=JSON.parse(bytes);
if(body.schema_version===4) bytes=loadPlanAuthority({consumerRoot:root,body}).planBytes;
const sha=crypto.createHash('sha256').update(bytes).digest('hex');
const dir=path.join(root,'.svc/external-review-artifacts/review-plan-inputs',sha);
for(let p=dir;p!==root;p=path.dirname(p)) {
  if(fs.existsSync(p) && fs.lstatSync(p).isSymbolicLink()) throw new Error('symlink review input path');
  if(path.dirname(p)===p) throw new Error('review inputs outside consumer');
}
fs.mkdirSync(dir,{recursive:true,mode:0o700});
for(const [name,content] of [['prepared-plan.json',bytes],['context-files.json',JSON.stringify([rel])+'\n']]) {
  const target=path.join(dir,name);
  withStateLock(target,()=>{
    if(fs.existsSync(target)&&fs.lstatSync(target).isSymbolicLink())throw new Error('symlink review input');
    const temp=target+'.'+process.pid+'.tmp';
    try {fs.writeFileSync(temp,content,{flag:'wx',mode:0o600});fs.renameSync(temp,target);}
    finally {if(fs.existsSync(temp))fs.unlinkSync(temp);}
  });
}
process.stdout.write(sha);
NODE
)"
  INPUT_DIR=".svc/external-review-artifacts/review-plan-inputs/$PLAN_SHA"
  PLAN_FILE_ARGS=(--plan-file "$INPUT_DIR/prepared-plan.json" --context-files "$INPUT_DIR/context-files.json")
else
  PLAN_SHA="$(sha256sum "$PLAN" | awk '{print $1}')"
fi
ARTIFACTS="${SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR:-$ROOT/.svc/external-review-artifacts/plan/$PLAN_SHA/$(date -u +%Y%m%dT%H%M%SZ)-$$}"
mkdir -p "$ARTIFACTS"
SUMMARY="$ARTIFACTS/summary.json"

# WI-489 phase-to-review-kind binding: prove this paid plan review runs BEFORE
# execute-changeset. The launcher refuses the plan review (zero provider calls)
# if a durable exec-record exists for the WI or implementation files have
# diverged from the pre-execution base. A plan review is the RIGHT operation
# only pre-execution; once code exists, use review-exec instead.
PHASE_ARGS=()
REVIEWER_ARGS=()
REVIEWER_CONFIG="${SVC_DISPATCH_POLICY:-${SVC_REVIEWER_POLICY:-$HOME/.svc/dispatch-policy.json}}"
if [[ -f "$REVIEWER_CONFIG" && ! -L "$REVIEWER_CONFIG" ]]; then
  REVIEWER_MODE="${SVC_REVIEWER_MODE:-production}"
  REVIEWER_STATION="${SVC_REVIEWER_STATION:-}"
  REVIEWER_TOPOLOGY="$(node "$ROOT/scripts/review-topology-v2.mjs" plan \
      --config "$REVIEWER_CONFIG" \
      --orchestrator "$ORCHESTRATOR" \
      --phase plan \
      --mode "$REVIEWER_MODE")"
  REVIEWER_STATION="$(printf '%s' "$REVIEWER_TOPOLOGY" | node -e '
        let s="";
        process.stdin.on("data", d => s += d).on("end", () => {
          const doc = JSON.parse(s);
          const requested = process.argv[1] || "";
          const stations = (doc.stations || []).filter((station) =>
            station.kind === "external" && station.required === true && station.authority === "independent" &&
            (!requested || station.id === requested));
          if (stations.length !== 1) {
            process.stderr.write(`review-plan-codex: expected exactly one required independent external station${requested ? ` matching ${requested}` : ""}, found ${stations.length}\n`);
            process.exit(2);
          }
          process.stdout.write(stations[0].id);
        });' "$REVIEWER_STATION")"
  REVIEWER_ARGS+=(--reviewer-config "$REVIEWER_CONFIG" --reviewer-mode "$REVIEWER_MODE" --reviewer-phase plan --reviewer-station "$REVIEWER_STATION")
fi
# Derive EXACTLY ONE authoritative WI. The branch name is authoritative; fall back
# to plan text only when the branch has none. Ambiguity (multiple distinct WIs) or
# absence is FAIL-CLOSED: refuse before any provider call rather than silently
# restoring the original unguarded paid-plan path (EXTREV-136 / EXTREV-EXEC-002).
WI_PATTERN='WI-[A-Z0-9]+(-[A-Z0-9]+)*'
WI_CANDIDATES="$(git -C "$CONTEXT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null | tr '[:lower:]' '[:upper:]' | grep -oE "$WI_PATTERN" | sort -u || true)"
[[ -z "$WI_CANDIDATES" ]] && WI_CANDIDATES="$(tr '[:lower:]' '[:upper:]' < "$PLAN" | grep -oE "$WI_PATTERN" | sort -u || true)"
WI_COUNT="$(printf '%s\n' "$WI_CANDIDATES" | grep -c . || true)"
if [[ "$WI_COUNT" -ne 1 ]]; then
  printf 'review-plan-codex: cannot derive exactly one authoritative WI (found %s: %s); refusing plan review before any provider call. Use an unambiguous WI branch or plan, or run review-exec if implementation has begun.\n' "$WI_COUNT" "$(printf '%s' "$WI_CANDIDATES" | tr '\n' ' ')" >&2
  exit 4
fi
WI="$WI_CANDIDATES"
# EXTREV-EXEC-007: a stale/reused WI branch could otherwise bind the branch WI
# while reviewing a plan for a DIFFERENT WI. If the plan names any WI at all,
# require the derived WI to be one of them; otherwise fail closed.
PLAN_WIS="$(tr '[:lower:]' '[:upper:]' < "$PLAN" | grep -oE "$WI_PATTERN" | sort -u || true)"
if [[ -n "$PLAN_WIS" ]] && ! printf '%s\n' "$PLAN_WIS" | grep -qx "$WI"; then
  printf 'review-plan-codex: derived WI %s does not appear in the plan (%s); refusing to bind a stale/reused branch WI. Rebase the review onto the correct WI branch/plan.\n' "$WI" "$(printf '%s' "$PLAN_WIS" | tr '\n' ' ')" >&2
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

You are an adversarial plan reviewer. Find flaws, missing consequential decisions, and unreachable assumptions. You are not the plan author.

SCOPE LOCK: evaluate only this plan and paths it names. Do not explore unrelated repository state.

FOCUS DIMENSIONS:
  (a) AC-to-task coverage gaps
  (b) scope-boundary leaks
  (c) rollback adequacy
  (d) mode-aware solution readiness / dispatch completeness
  (e) idempotency and rerun safety
  (f) execute risk
  (g) lane compliance: every mandatory upstream skill must be completed with an artifact or skipped with a cited decision; an unnamed mandatory skill is a failing finding

Use review_kind "plan" and set integer rubric_score to the 0-10 mode-aware score. For explicit inline mode, score these same ten dimensions as solution readiness: (1) exact resolvable or declared future files; (2) complete consequential behavior and interfaces, not authored code; (3) appropriate executable proof and outcomes; (4) meaningful action/authority limits; (5) exact write scope; (6) recovery path; (7) correct dependencies; (8) observable success; (9) original AC/UX/technical trace; (10) no unresolved consequential choice. Reversible local details are allowed. v4 release identities may use the validated existing-adapter producer form. Keep integer rubric_score 0–10 and concrete findings. For dispatch/absent mode, retain the complete-code/command packet rubric below. For zero findings, use verdict "pass" and findings []. Every finding needs id, severity, claim, analysis, evidence, and proposed_fix.

PROTOCOL REFERENCE:
EOF
  cat "$PROTOCOL_REF"
  printf '\nPLAN TO REVIEW:\n'
  cat "$PLAN"
} | node "$LAUNCHER" --orchestrator "$ORCHESTRATOR" --review-kind plan --candidate-digest "$PLAN_SHA" --context-root "$CONTEXT_ROOT" ${REVIEWER_ARGS[@]+"${REVIEWER_ARGS[@]}"} ${PHASE_ARGS[@]+"${PHASE_ARGS[@]}"} ${PLAN_FILE_ARGS[@]+"${PLAN_FILE_ARGS[@]}"} --artifacts-dir "$ARTIFACTS" > "$SUMMARY" || exit 1

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
