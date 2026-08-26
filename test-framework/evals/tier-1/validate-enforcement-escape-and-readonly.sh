#!/usr/bin/env bash
# WI-501 regression guard for the two structural enforcement defects behind the
# WI-494/496/497/498/499 whack-a-mole:
#
#   EG-01  The governed-hook launcher honored NO disable switch, so when enforcement
#          misbehaved the agent was blocked from mutating the files needed to FIX it.
#          A break-glass MUST exist, MUST expire (fail safe), MUST be audited, and MUST
#          refuse an insecure marker.
#   EG-02  isReadOnlyTool() rejected any command containing ; & | $ ' " < > \, so a pure
#          read like `pwd && rg -n "x" f.md` was denied as a governed mutation.
#
# R1-F003: this tests the PURE CLASSIFIER DIRECTLY rather than through the installed
# launcher (which legitimately refuses a non-durable-canonical source — that made the
# first version exit 2), and never maps malformed output to ALLOW: an unparseable result
# is a hard FAIL, never an implicit pass.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
FAIL=0
ok(){ echo "  ok   - $1"; }; bad(){ echo "  FAIL - $1"; FAIL=1; }

echo "== EG-02: read-only classification (incl. the R1-F001 dequoting bypass corpus) =="
CORPUS_OUT="$(node "$ROOT/test-framework/evals/tier-1/lib/enforcement-readonly-corpus.mjs" 2>&1)"
CORPUS_RC=$?
printf '%s\n' "$CORPUS_OUT" | sed -n 's/^OK|/  ok   - /p; s/^BAD|/  FAIL - /p'
# R2-F001: the PROCESS EXIT STATUS is authoritative. A module syntax error or crash
# exits non-zero while printing neither OK| nor CORPUS-PASS, and must fail the gate —
# string inspection alone could let a crashed corpus report success.
if [ "$CORPUS_RC" -ne 0 ]; then
  bad "classifier corpus exited $CORPUS_RC (crash or failing vector) — NOT treated as pass"
  printf '%s\n' "$CORPUS_OUT" | grep -vE '^(OK|BAD)\|' | head -5
fi
if printf '%s' "$CORPUS_OUT" | grep -q "^BAD|"; then FAIL=1; fi
if ! printf '%s' "$CORPUS_OUT" | grep -q "CORPUS-PASS"; then
  bad "classifier corpus did not emit CORPUS-PASS sentinel"
fi

echo "== EG-01: break-glass allows, expires (fail safe), audits, refuses insecure marker =="
LAUNCHER="$ROOT/bin/svc-enforce.mjs"
HOMEDIR="$(mktemp -d)"; trap 'rm -rf "$HOMEDIR"' EXIT
# Hermeticity: an operator session may legitimately run with SVC_BREAK_GLASS=1
# armed; the validator must strip ambient break-glass state so "governed"
# probes actually exercise the governed path (WI-FW-HOOKS-SAFETY-01 remediation).
fire(){ env -u SVC_BREAK_GLASS -u SVC_BREAK_GLASS_TTL_HOURS HOME="$HOMEDIR" "$@" node "$LAUNCHER" svc-task-completion-guard 2>&1 <<< '{"hook_event_name":"Stop"}'; }
armed(){ printf '%s' "$1" | grep -q "BREAK-GLASS ACTIVE"; }

armed "$(fire SVC_BREAK_GLASS=1)" && ok "env form bypasses and announces" || bad "env form did not bypass"

if [ -s "$HOMEDIR/.svc/break-glass-audit.jsonl" ] && \
   node -e 'const l=require("fs").readFileSync(process.argv[1],"utf8").trim().split("\n").pop();process.exit(JSON.parse(l).via?0:1)' \
        "$HOMEDIR/.svc/break-glass-audit.jsonl" 2>/dev/null; then
  ok "bypass appended a parseable audit row"
else bad "no parseable audit row written"; fi

mkdir -p "$HOMEDIR/.svc"; : > "$HOMEDIR/.svc/BREAK-GLASS"; chmod 600 "$HOMEDIR/.svc/BREAK-GLASS"
armed "$(fire)" && ok "fresh file marker bypasses" || bad "fresh file marker did not bypass"

touch -d '25 hours ago' "$HOMEDIR/.svc/BREAK-GLASS"
armed "$(fire SVC_BREAK_GLASS_TTL_HOURS=4)" && bad "EXPIRED marker still bypassed (fail-open)" || ok "expired marker fails safe"

rm -f "$HOMEDIR/.svc/BREAK-GLASS"; : > "$HOMEDIR/.svc/real-marker"; chmod 600 "$HOMEDIR/.svc/real-marker"
ln -s "$HOMEDIR/.svc/real-marker" "$HOMEDIR/.svc/BREAK-GLASS"
armed "$(fire)" && bad "symlink marker accepted (R1-F002)" || ok "symlink marker refused"

rm -f "$HOMEDIR/.svc/BREAK-GLASS"; : > "$HOMEDIR/.svc/BREAK-GLASS"; chmod 600 "$HOMEDIR/.svc/BREAK-GLASS"; touch -d '30 days ago' "$HOMEDIR/.svc/BREAK-GLASS"
armed "$(fire SVC_BREAK_GLASS_TTL_HOURS=999999)" && bad "unbounded TTL honored (marker never expires)" || ok "TTL clamped to a finite maximum"

# R2-F002: a symlinked audit path must be REFUSED (not followed), and the refusal announced.
rm -f "$HOMEDIR/.svc/break-glass-audit.jsonl"
ln -s /dev/null "$HOMEDIR/.svc/break-glass-audit.jsonl"
OUT_SL="$(fire SVC_BREAK_GLASS=1)"
if printf '%s' "$OUT_SL" | grep -q "AUDIT WRITE FAILED"; then ok "symlinked audit path refused and announced"
else bad "symlinked audit path was followed or failure was silent"; fi
rm -f "$HOMEDIR/.svc/break-glass-audit.jsonl"

# R2-F003 / EG-01a: prove the hatch flips a REAL governed denial into an allow.
# Uses the PreToolUse enforcer so the decision JSON is observable.
PROBE='{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"touch /tmp/svc-eg01a-probe"},"cwd":"'"$ROOT"'"}'
decide(){ printf '%s' "$PROBE" | env -u SVC_BREAK_GLASS -u SVC_BREAK_GLASS_TTL_HOURS HOME="$HOMEDIR" "$@" node "$LAUNCHER" svc-codex-skill-load-enforcer 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const h=JSON.parse(s).hookSpecificOutput;console.log(h&&h.permissionDecision==="deny"?"DENY":"ALLOW")}catch(e){console.log("UNPARSEABLE")}})'; }
GOVERNED="$(decide)"
BYPASSED="$(decide SVC_BREAK_GLASS=1)"
if [ "$GOVERNED" = "DENY" ] && [ "$BYPASSED" = "ALLOW" ]; then
  ok "EG-01a: governed DENY becomes ALLOW under break-glass (behavioral)"
else
  bad "EG-01a not proven (governed=$GOVERNED bypassed=$BYPASSED; expected DENY then ALLOW)"
fi

if [ "$FAIL" -eq 0 ]; then echo "TIER-1 PASS: validate-enforcement-escape-and-readonly"; else echo "TIER-1 FAIL"; exit 1; fi
