#!/usr/bin/env bash
# validate-enforce-bash-hook-mode.sh — WI-545
#
# Every svc-enforce `runner: bash` relpath must be git mode 100755. Setup
# materialize must refuse a durable source whose bash adapters are 100644
# instead of chmod-healing them.
#
# Tier-1 promotion note:
#   validator_path: test-framework/evals/tier-1/validate-enforce-bash-hook-mode.sh
#   failure_class: governed bash Stop adapters committed 100644 while svc-enforce
#     requires owner-executable; setup recopied the same blob and reported success.
#   promotion_signal: signal 3 — protects the install/Stop hot path (svc-enforce,
#     setup materialize). Observed during WI-542/WI-543 verify-promotion on grok.
#   expected_runtime_budget: < 5s, hermetic, no network/model.
#   why_tier_2_or_targeted_is_insufficient: a 100644 adapter makes Stop deny as
#     SVC-ENFORCE-HOOK-DANGLING on every Grok/Cursor session after install.

set -u
PASS=0; FAIL=0
pass() { PASS=$((PASS+1)); echo "  ok $1"; }
fail() { FAIL=$((FAIL+1)); echo "  FAIL $1"; }

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
echo "=== Tier 1: svc-enforce bash hook git mode + setup fail-closed (WI-545) ==="

command -v git >/dev/null 2>&1 || { echo "  SKIP — git unavailable"; echo "  PASS — 0 assertions (skipped)"; exit 0; }
command -v node >/dev/null 2>&1 || { echo "  SKIP — node unavailable"; echo "  PASS — 0 assertions (skipped)"; exit 0; }

if [ ! -f "$REPO_ROOT/bin/svc-enforce.mjs" ] || [ ! -f "$REPO_ROOT/scripts/svc-migrate-install.mjs" ]; then
  fail "svc-enforce / svc-migrate-install missing"
  echo "  FAIL — $FAIL assertion(s)"
  exit 1
fi

# AC-545-3: parse the live svc-enforce registry (not a copied list).
BASH_ROWS="$(node --input-type=module -e '
import fs from "node:fs";
const src = fs.readFileSync(process.argv[1], "utf8");
const block = src.match(/const DEFAULT_REGISTRY\s*=\s*\{([\s\S]*?)\n\};/);
if (!block) { process.stderr.write("DEFAULT_REGISTRY not found\n"); process.exit(2); }
const re = /"([^"]+)":\s*\{\s*relpath:\s*"([^"]+)",\s*runner:\s*"([^"]+)"/g;
let m;
const rows = [];
while ((m = re.exec(block[1]))) rows.push(`${m[1]}\t${m[2]}\t${m[3]}`);
if (!rows.length) { process.stderr.write("no HOOKS rows parsed\n"); process.exit(2); }
process.stdout.write(rows.join("\n") + "\n");
' "$REPO_ROOT/bin/svc-enforce.mjs")"
if [ $? -ne 0 ] || [ -z "$BASH_ROWS" ]; then
  fail "could not parse svc-enforce HOOKS registry"
  echo "  FAIL — $FAIL assertion(s)"
  exit 1
fi

BASH_COUNT=0
while IFS=$'\t' read -r id relpath runner; do
  [ -z "$id" ] && continue
  [ "$runner" = "bash" ] || continue
  BASH_COUNT=$((BASH_COUNT+1))
  mode="$(git -C "$REPO_ROOT" ls-files -s -- "$relpath" | awk '{print $1}')"
  if [ "$mode" = "100755" ]; then
    pass "$id ($relpath) is 100755"
  else
    fail "$id ($relpath) git mode is '${mode:-missing}', expected 100755"
  fi
done <<< "$BASH_ROWS"

if [ "$BASH_COUNT" -lt 4 ]; then
  fail "expected at least 4 bash runners (shared + kimi + cursor + grok), found $BASH_COUNT"
else
  pass "parsed $BASH_COUNT bash runners from svc-enforce"
fi

# Setup still fail-closes when materialize refuses (AC-545-2 wiring).
if grep -q 'durable launcher materialization FAILED' "$REPO_ROOT/setup" \
   && grep -q 'Refusing to touch the host surface' "$REPO_ROOT/setup"; then
  pass "setup aborts when materialize fails"
else
  fail "setup no longer fail-closes on materialize failure"
fi

# Dynamic: a durable 100644 grok adapter must make materialize refuse.
DURABLE_BASE="${SVC_TEST_DURABLE_BASE:-$HOME/.cache}"
mkdir -p "$DURABLE_BASE" 2>/dev/null || true
SRC="$(mktemp -d "$DURABLE_BASE/svc-wi545-hook-mode-XXXXXX")"
FHOME="$(mktemp -d)"
cleanup() { rm -rf "$SRC" "$FHOME" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

mkdir -p "$SRC/bin" "$SRC/hooks/lib" "$SRC/hooks/grok" "$SRC/hooks/cursor" "$SRC/hooks/kimi" \
         "$SRC/hooks/codex/lib" "$SRC/scripts" "$SRC/provision/hosts"
cp "$REPO_ROOT/scripts/svc-migrate-install.mjs" "$SRC/scripts/"
cp "$REPO_ROOT/bin/svc-enforce.mjs" "$SRC/bin/"
cp "$REPO_ROOT/hooks/lib/enforcement-core.mjs" "$SRC/hooks/lib/"
cp "$REPO_ROOT/hooks/svc-hook-boundary.mjs" "$SRC/hooks/"
cp "$REPO_ROOT/hooks/lib/hook-policy.mjs" "$SRC/hooks/lib/"
cp "$REPO_ROOT/hooks/codex/lib/argv-lex.mjs" "$SRC/hooks/codex/lib/"
cp "$REPO_ROOT/provision/hosts/grok.json" "$SRC/provision/hosts/"
cp "$REPO_ROOT/hooks/svc-task-completion-guard.sh" "$SRC/hooks/"
cp "$REPO_ROOT/hooks/kimi/svc-kimi-task-completion-guard.sh" "$SRC/hooks/kimi/"
cp "$REPO_ROOT/hooks/cursor/svc-cursor-task-completion-guard.sh" "$SRC/hooks/cursor/"
cp "$REPO_ROOT/hooks/grok/svc-grok-task-completion-guard.sh" "$SRC/hooks/grok/"
chmod 755 "$SRC/hooks/svc-task-completion-guard.sh" \
          "$SRC/hooks/kimi/svc-kimi-task-completion-guard.sh" \
          "$SRC/hooks/cursor/svc-cursor-task-completion-guard.sh"
chmod 644 "$SRC/hooks/grok/svc-grok-task-completion-guard.sh"

mkdir -p "$FHOME/.svc"
chmod 700 "$FHOME/.svc"

OUT="$(HOME="$FHOME" node "$SRC/scripts/svc-migrate-install.mjs" materialize \
      --host grok --repo-root "$SRC" --json 2>&1 || true)"
if printf '%s\n' "$OUT" | grep -q 'SVC-ENFORCE-HOOK-MODE' \
   && printf '%s\n' "$OUT" | grep -q 'svc-grok-task-completion-guard'; then
  pass "materialize refuses a 100644 grok bash adapter"
else
  fail "materialize did not refuse 100644 grok adapter: ${OUT:0:240}"
fi

chmod 755 "$SRC/hooks/grok/svc-grok-task-completion-guard.sh"
chmod 644 "$SRC/hooks/cursor/svc-cursor-task-completion-guard.sh"
OUT2="$(HOME="$FHOME" node "$SRC/scripts/svc-migrate-install.mjs" materialize \
      --host grok --repo-root "$SRC" --json 2>&1 || true)"
if printf '%s\n' "$OUT2" | grep -q 'SVC-ENFORCE-HOOK-MODE' \
   && printf '%s\n' "$OUT2" | grep -q 'svc-cursor-task-completion-guard'; then
  pass "materialize refuses a 100644 cursor bash adapter"
else
  fail "materialize did not refuse 100644 cursor adapter: ${OUT2:0:240}"
fi

echo ""
echo "  PASS=$PASS FAIL=$FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo "  FAIL — $FAIL assertion(s)"
  exit 1
fi
echo "  PASS — $PASS assertions"
exit 0
