#!/usr/bin/env bash
# Canonical external-review adapter for WI-410 blind-plan floor certification.
# Exit 0 emits legacy verdict JSON; exit 2 is malformed findings; exit 3 remains
# reserved for the retired no-judge retention hatch; exit 4 is an actionable
# launcher/CLI hard failure. There is no anonymous degraded judge.
set -euo pipefail

BLIND='' MERGED='' ROWS='' ORCH_FAMILY='anthropic'
while [[ $# -gt 0 ]]; do
  case "$1" in
    --blind) BLIND="$2"; shift 2 ;;
    --merged) MERGED="$2"; shift 2 ;;
    --rows) ROWS="$2"; shift 2 ;;
    --orchestrator-family) ORCH_FAMILY="$2"; shift 2 ;;
    *) printf 'unknown arg: %s\n' "$1" >&2; exit 2 ;;
  esac
done
[[ -r "$BLIND" && -r "$MERGED" && -r "$ROWS" ]] || { printf 'usage: blind-floor-judge.sh --blind B.json --merged F.json --rows rows.json\n' >&2; exit 2; }

case "$ORCH_FAMILY" in anthropic) ORCHESTRATOR=claude ;; openai) ORCHESTRATOR=codex ;; *) printf 'blind-floor-judge: unsupported orchestrator family %q\n' "$ORCH_FAMILY" >&2; exit 4 ;; esac
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAUNCHER="$ROOT/scripts/run-external-review.mjs"
CONTENT_SHA="$(node -e 'const{createHash}=require("crypto"),fs=require("fs");for(const f of process.argv.slice(1)){const b=fs.readFileSync(f);process.stdout.write(createHash("sha256").update(b).digest("hex"))}' "$BLIND" "$MERGED" "$ROWS" | sha256sum | awk '{print $1}')"
CONTEXT_ROOT="$(git -C "$(dirname "$BLIND")" rev-parse --show-toplevel 2>/dev/null || pwd -P)"
ARTIFACTS="${SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR:-$ROOT/.svc/external-review-artifacts/blind-floor/$CONTENT_SHA/$(date -u +%Y%m%dT%H%M%SZ)-$$}"
mkdir -p "$ARTIFACTS"
SUMMARY="$ARTIFACTS/summary.json"

{
  cat <<'EOF'
OUTPUT-FIRST PROTOCOL: return only schema-constrained findings. You are an adversarial FLOOR JUDGE. The blind plan is the floor. For every REMOVE/ALTER row, add a certification with its exact key and certified=true only when the framework change is a strict improvement. Default to false on uncertainty. Longer is not better. Use review_kind "blind-floor". Put the concrete justification in summary or a finding. Set reviewer_family and leave for_content_sha empty; the adapter binds it to the exact compared content.

BLIND PLAN:
EOF
  cat "$BLIND"
  printf '\nFRAMEWORK PLAN:\n'; cat "$MERGED"
  printf '\nROWS TO CERTIFY OR REJECT:\n'; cat "$ROWS"
} | node "$LAUNCHER" --orchestrator "$ORCHESTRATOR" --review-kind blind-floor --candidate-digest "$CONTENT_SHA" --context-root "$CONTEXT_ROOT" --artifacts-dir "$ARTIFACTS" > "$SUMMARY" || exit 4

node - "$SUMMARY" "$BLIND" "$MERGED" <<'NODE' || { printf 'blind-floor-judge: findings missing or malformed\n' >&2; exit 2; }
const {createHash}=require('crypto');const fs=require('fs');
const summary=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const findings=JSON.parse(fs.readFileSync(summary.findings,'utf8'));
const map=p=>new Map((JSON.parse(fs.readFileSync(p,'utf8')).elements||[]).map(e=>[e.key,typeof e.content==='string'?e.content:JSON.stringify(e.content??'')]));
const B=map(process.argv[3]),F=map(process.argv[4]);
const bind=k=>F.has(k)?createHash('sha256').update(`ALTER\n${B.get(k)}\n=>\n${F.get(k)}`).digest('hex'):createHash('sha256').update(`REMOVE\n${B.get(k)}`).digest('hex');
if(!Array.isArray(findings.certifications))process.exit(2);
const certifications=findings.certifications.filter(c=>c&&typeof c.key==='string'&&B.has(c.key)).map(c=>({key:c.key,certified_strict_improvement:c.certified===true,reviewer_family:findings.reviewer.family,for_content_sha:bind(c.key)}));
process.stdout.write(JSON.stringify({reviewer_host:findings.reviewer.host,reviewer_family:findings.reviewer.family,certifications,external_review_receipt:summary.receipt})+'\n');
NODE
