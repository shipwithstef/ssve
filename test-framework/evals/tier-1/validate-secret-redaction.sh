#!/usr/bin/env bash
# test-framework/evals/tier-1/validate-secret-redaction.sh
#
# Tier-1 validator for scripts/lib/secret-redaction.mjs.
#
# Catastrophe-class gap closed: the auto-learning pipeline used to pass
# raw session text (including API keys, Bearer tokens, AWS AKIA keys,
# etc.) through to tracked files (references/framework-learnings.jsonl,
# docs/learnings/learnings.jsonl, user-memory directories). This
# validator pins the redaction behavior so the fix can't silently
# regress.
#
# Coverage:
#   - All 10 secret patterns redact correctly
#   - Clean text passes through unchanged
#   - redactSecretsDeep handles object/array/null/non-string
#   - countRedactions returns the right tags + counts
#   - Hook-level wiring: auto-capture writes a redacted candidate
#   - Promote-level wiring: promote-auto-learnings emits a redacted row

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0
fail=0

check() {
  local label="$1"
  shift
  if "$@" >"$TMP/out" 2>&1; then
    echo "  ✓ $label"
    pass=$((pass + 1))
  else
    echo "  ✗ $label"
    cat "$TMP/out"
    fail=$((fail + 1))
  fi
}

echo "=== Tier 1: Secret Redaction ==="

check "library exists" test -f "$ROOT/scripts/lib/secret-redaction.mjs"
check "library syntax valid" node --check "$ROOT/scripts/lib/secret-redaction.mjs"

# --- Per-pattern redaction tests (one per secret class) ---

redacts() {
  local label="$1"; local input="$2"; local expected_tag="$3"
  check "redacts $label" bash -c '
    out=$(node "$0/scripts/lib/secret-redaction.mjs" "$1")
    echo "$out" | grep -q "REDACTED:$2"
  ' "$ROOT" "$input" "$expected_tag"
}

redacts "Anthropic API key" "key: sk-ant-AAAAAAAAAAAAAAAAAAAAAAAA" "anthropic-key"
redacts "OpenAI sk-proj-* key" "key: sk-proj-AAAAAAAAAAAAAAAAAAAAAAAA" "openai-key"
redacts "GitHub ghp_ token" "auth: ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" "github-token"
redacts "AWS AKIA access key" "key: AKIAIOSFODNN7EXAMPLE" "aws-akia"
redacts "Stripe live key" "key: sk_live_AAAAAAAAAAAAAAAAAAAAAAAA" "stripe-key"
redacts "JWT" "token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.AbCdEfGhIjKlMnOp" "jwt"
redacts "Bearer token" 'curl -H "Authorization: Bearer abcdefghijklmnop12345678"' "bearer-token"
redacts "npm token" "auth: npm_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" "npm-token"
redacts "*_API_KEY env-var assignment" "export OPENAI_API_KEY=sk-deadbeefcafe1234567890ab" "env-secret"

# Private key block (multi-line)
check "redacts PEM private key block" bash -c '
  out=$(node "$0/scripts/lib/secret-redaction.mjs" "$(printf "%s\n" "-----BEGIN OPENSSH PRIVATE KEY-----" "abc123def456" "-----END OPENSSH PRIVATE KEY-----")")
  echo "$out" | grep -q "REDACTED:private-key"
' "$ROOT"

# --- Clean text must NOT be touched ---

check "clean text passes through unchanged" bash -c '
  in="this is normal text with no secrets at all"
  out=$(node "$0/scripts/lib/secret-redaction.mjs" "$in")
  [ "$out" = "$in" ]
' "$ROOT"

check "structured config keys still pass through if they look secret-shaped but contain placeholder" bash -c '
  in="api_key: REPLACE_ME"
  out=$(node "$0/scripts/lib/secret-redaction.mjs" "$in")
  [ "$out" = "$in" ]
' "$ROOT"

# --- redactSecretsDeep handles non-string types ---

check "redactSecretsDeep returns null unchanged" bash -c '
  node -e "import(\"$0/scripts/lib/secret-redaction.mjs\").then(m => { const r = m.redactSecretsDeep(null); if (r !== null) throw new Error(\"expected null\"); })"
' "$ROOT"

check "redactSecretsDeep walks nested object + array" bash -c '
  node -e "import(\"$0/scripts/lib/secret-redaction.mjs\").then(m => {
    const input = { a: \"Bearer abcdefghijklmnop12345678\", b: [{ c: \"clean\" }, { d: \"sk-ant-AAAAAAAAAAAAAAAAAAAAAA\" }] };
    const out = m.redactSecretsDeep(input);
    if (!out.a.includes(\"REDACTED:bearer-token\")) throw new Error(\"top-level string not redacted\");
    if (out.b[0].c !== \"clean\") throw new Error(\"clean string was modified\");
    if (!out.b[1].d.includes(\"REDACTED:anthropic-key\")) throw new Error(\"deep-nested string not redacted\");
  })"
' "$ROOT"

# --- countRedactions returns the right tags ---

check "countRedactions returns per-tag counts" bash -c '
  node -e "import(\"$0/scripts/lib/secret-redaction.mjs\").then(m => {
    const c = m.countRedactions(\"sk-ant-AAAAAAAAAAAAAAAAAAAAAA and ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\");
    if (c[\"anthropic-key\"] !== 1) throw new Error(\"wrong anthropic count: \" + JSON.stringify(c));
    if (c[\"github-token\"] !== 1) throw new Error(\"wrong github count: \" + JSON.stringify(c));
  })"
' "$ROOT"

# --- maskConfigValue ---

check "maskConfigValue masks long values" bash -c '
  node -e "import(\"$0/scripts/lib/secret-redaction.mjs\").then(m => {
    const masked = m.maskConfigValue(\"api_key\", \"abcdefghijkl1234\");
    if (masked !== \"****1234\") throw new Error(\"expected ****1234, got \" + masked);
  })"
' "$ROOT"

check "maskConfigValue masks short values entirely" bash -c '
  node -e "import(\"$0/scripts/lib/secret-redaction.mjs\").then(m => {
    const masked = m.maskConfigValue(\"api_key\", \"short\");
    if (masked !== \"****\") throw new Error(\"expected ****, got \" + masked);
  })"
' "$ROOT"

check "maskConfigValue ignores non-secret keys" bash -c '
  node -e "import(\"$0/scripts/lib/secret-redaction.mjs\").then(m => {
    const out = m.maskConfigValue(\"description\", \"abcdefghijkl1234\");
    if (out !== \"abcdefghijkl1234\") throw new Error(\"unexpectedly masked: \" + out);
  })"
' "$ROOT"

# --- Hook wiring smoke test ---

check "auto-capture hook imports redactSecretsDeep" bash -c '
  grep -q "redactSecretsDeep" "$0/hooks/svc-auto-capture-learnings.mjs"
' "$ROOT"

check "promote-auto-learnings imports redactSecretsDeep" bash -c '
  grep -q "redactSecretsDeep" "$0/scripts/promote-auto-learnings.mjs"
' "$ROOT"

# --- Integration: capture hook with secret in fixture commit message ---

CAPTURE_FIX="$TMP/capture-fix"
mkdir -p "$CAPTURE_FIX"
git -C "$CAPTURE_FIX" init -q
git -C "$CAPTURE_FIX" config user.email test@example.com
git -C "$CAPTURE_FIX" config user.name "Test"
mkdir -p "$CAPTURE_FIX/references" "$CAPTURE_FIX/.svc"
printf '{}\n' > "$CAPTURE_FIX/references/framework-learnings.jsonl"
printf 'a\n' > "$CAPTURE_FIX/x.txt"
git -C "$CAPTURE_FIX" add . && git -C "$CAPTURE_FIX" commit -qm "initial"
BASE=$(git -C "$CAPTURE_FIX" rev-parse HEAD)
git -C "$CAPTURE_FIX" branch -M main
git -C "$CAPTURE_FIX" checkout -qb feature
printf 'b\n' > "$CAPTURE_FIX/x.txt"
git -C "$CAPTURE_FIX" add x.txt && git -C "$CAPTURE_FIX" commit -qm "feat: first try"
printf 'c\n' > "$CAPTURE_FIX/x.txt"
git -C "$CAPTURE_FIX" add x.txt && git -C "$CAPTURE_FIX" commit -qm "fix(WI-X): saw error Bearer abc1234567890abcdef0123 in output"

check "capture hook redacts secrets in commit-message-derived insight" bash -c '
  # The full Tier-1 runner has eight concurrent jobs. Keep this fixture above
  # the production hook normal fast path so scheduler load cannot turn a
  # successful redaction into a false "no candidate captured" timeout.
  env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE SVC_AUTO_LEARN_ROOT="$0" SVC_AUTO_LEARN_BASE="$1" SVC_AUTO_LEARN_TIMEOUT_MS=10000 node "$2/hooks/svc-auto-capture-learnings.mjs" --trigger stop
  [ -s "$0/.svc/auto-learnings.jsonl" ] || { echo "no candidate captured"; exit 1; }
  # The bearer token text must be redacted in the captured insight
  if grep -q "Bearer abc1234567890abcdef0123" "$0/.svc/auto-learnings.jsonl"; then
    echo "BEARER TOKEN LEAKED INTO CAPTURED JSONL"
    cat "$0/.svc/auto-learnings.jsonl"
    exit 1
  fi
  grep -q "REDACTED:bearer-token" "$0/.svc/auto-learnings.jsonl"
' "$CAPTURE_FIX" "$BASE" "$ROOT"

echo ""
echo "secret redaction: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]

# --- P1 fix: slug-derived keys do NOT leak secrets ---

SLUG_FIX="$TMP/slug-leak-fix"
mkdir -p "$SLUG_FIX"
git -C "$SLUG_FIX" init -q
git -C "$SLUG_FIX" config user.email test@example.com
git -C "$SLUG_FIX" config user.name "Test"
mkdir -p "$SLUG_FIX/references" "$SLUG_FIX/.svc"
printf '{}\n' > "$SLUG_FIX/references/framework-learnings.jsonl"
printf 'a\n' > "$SLUG_FIX/x.txt"
git -C "$SLUG_FIX" add . && git -C "$SLUG_FIX" commit -qm "initial"
SLUG_BASE=$(git -C "$SLUG_FIX" rev-parse HEAD)
git -C "$SLUG_FIX" branch -M main
git -C "$SLUG_FIX" checkout -qb feature
printf 'b\n' > "$SLUG_FIX/x.txt"
git -C "$SLUG_FIX" add x.txt && git -C "$SLUG_FIX" commit -qm "feat: first"
printf 'c\n' > "$SLUG_FIX/x.txt"
git -C "$SLUG_FIX" add x.txt && git -C "$SLUG_FIX" commit -qm "fix(WI-X): saw sk-ant-AAAAAAAAAAAAAAAAAAAAAA in logs"

check "P1: candidate key does NOT contain the slugged form of a secret" bash -c '
  env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE SVC_AUTO_LEARN_ROOT="$0" SVC_AUTO_LEARN_BASE="$1" SVC_AUTO_LEARN_TIMEOUT_MS=10000 node "$2/hooks/svc-auto-capture-learnings.mjs" --trigger stop
  [ -s "$0/.svc/auto-learnings.jsonl" ] || { echo "no candidate captured"; exit 1; }
  # The slug must NOT contain the secret pattern (case-insensitive)
  if grep -iq "sk-ant-AAAAAAAAAAAAAAAAAAAAAA\|sk-ant-aaaaaaaaaaaaaaaaaaaaaa" "$0/.svc/auto-learnings.jsonl"; then
    echo "ANTHROPIC KEY LEAKED INTO CAPTURED JSONL (slug or insight)"
    cat "$0/.svc/auto-learnings.jsonl"
    exit 1
  fi
  grep -q "REDACTED" "$0/.svc/auto-learnings.jsonl"
' "$SLUG_FIX" "$SLUG_BASE" "$ROOT"

# --- P2 fix: legacy un-redacted entries get redacted AT READ time before render ---

LEGACY_FIX="$TMP/legacy-render-fix"
mkdir -p "$LEGACY_FIX/.svc/promotion-receipts" "$LEGACY_FIX/references" "$LEGACY_FIX/.svc"
printf '{}\n' > "$LEGACY_FIX/references/framework-learnings.jsonl"
# Plant a legacy un-redacted entry (pre-fix capture)
printf '{"schema_version":1,"captured_at":"2026-05-12T00:00:00Z","signal":"correction-after-failure","key":"legacy-test","insight":"Legacy entry containing Bearer abc1234567890abcdef0123 token","confidence":7,"source":"legacy","session_id":"legacy@s1","candidate_target":"framework-learnings","files":[]}\n' > "$LEGACY_FIX/.svc/auto-learnings.jsonl"

check "P2: dry-run promote does NOT print raw secret from legacy entry" bash -c '
  cd "$0" && node "$1/scripts/promote-auto-learnings.mjs" --dry-run > "$0/dryrun.out" 2>&1
  if grep -q "Bearer abc1234567890abcdef0123" "$0/dryrun.out"; then
    echo "RAW BEARER TOKEN LEAKED TO DRY-RUN STDOUT"
    cat "$0/dryrun.out"
    exit 1
  fi
  grep -q "REDACTED:bearer-token" "$0/dryrun.out"
' "$LEGACY_FIX" "$ROOT"

echo ""
echo "secret redaction (with P1 + P2 codex round-1 fixes): $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]

# --- Round-2 codex fixes: github_pat + legacy slug scrub ---

check "redacts github_pat_ fine-grained PAT (codex round-2 caught)" bash -c '
  out=$(node "$0/scripts/lib/secret-redaction.mjs" "auth: github_pat_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
  echo "$out" | grep -q "REDACTED:github-pat"
' "$ROOT"

check "scrubSlugSecrets masks legacy slug-form Bearer token in candidate.key" bash -c '
  node -e "import(\"$0/scripts/lib/secret-redaction.mjs\").then(m => {
    const slug = \"correction-fix-saw-bearer-abc1234567890abcdef0123-in-output-2a9d1d3\";
    const out = m.scrubSlugSecrets(slug);
    if (!out.includes(\"REDACTED-SLUG:slug-bearer\")) throw new Error(\"slug not scrubbed: \" + out);
  })"
' "$ROOT"

check "promote read-time pipeline scrubs legacy slug-key (P1 fix)" bash -c '
  TMPLEG="$(mktemp -d)"
  mkdir -p "$TMPLEG/.svc/promotion-receipts" "$TMPLEG/references" "$TMPLEG/.svc"
  printf "{}\n" > "$TMPLEG/references/framework-learnings.jsonl"
  printf "{\"schema_version\":1,\"captured_at\":\"2026-05-12T00:00:00Z\",\"signal\":\"correction-after-failure\",\"key\":\"correction-fix-saw-bearer-abc1234567890abcdef0123-2a9d1d3\",\"insight\":\"Legacy slug-key leak test\",\"confidence\":7,\"source\":\"legacy\",\"session_id\":\"leg@s1\",\"candidate_target\":\"framework-learnings\",\"files\":[]}\n" > "$TMPLEG/.svc/auto-learnings.jsonl"
  cd "$TMPLEG" && node "$0/scripts/promote-auto-learnings.mjs" --dry-run > out 2>&1 || true
  if grep -q "bearer-abc1234567890abcdef0123" "out"; then
    echo "SLUG BEARER LEAKED THROUGH DRY-RUN"
    cat out
    rm -rf "$TMPLEG"
    exit 1
  fi
  grep -q "REDACTED-SLUG" "out"
  result=$?
  rm -rf "$TMPLEG"
  exit $result
' "$ROOT"

echo ""
echo "secret redaction (post-round-2): $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
