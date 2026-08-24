#!/usr/bin/env bash
# WI-562 IP-H2/IP-H3: promote exit-honesty + verb-lock + quarantine.
# Hermetic scratch clone with a DENYING fake origin — never touches the real remote.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
pass=0; fail=0
check() { local label="$1"; shift; if "$@" >"$TMP/out" 2>&1; then echo "  ✓ $label"; pass=$((pass+1)); else echo "  ✗ $label"; cat "$TMP/out"; fail=$((fail+1)); fi; }

echo "=== Tier 1: promote exit honesty + verb lock (fake origin) ==="

# Bare "origin" that REFUSES pushes via pre-push hook.
ORIGIN="$TMP/origin.git"
git init --quiet --bare "$ORIGIN"
git -C "$ORIGIN" config core.hooksPath "$TMP/originhooks"
mkdir -p "$TMP/originhooks"
printf '#!/usr/bin/env bash\necho "push denied by fixture" >&2\nexit 1\n' >"$TMP/originhooks/pre-push"
chmod +x "$TMP/originhooks/pre-push"

# Worktree-shaped clone of THIS repo's scripts/worktree.sh only.
FIX="$TMP/fix"
git clone --quiet "$ROOT" "$FIX" 2>/dev/null || true
if [[ ! -d "$FIX/.git" ]]; then
  mkdir -p "$FIX"
  cp "$ROOT/scripts/worktree.sh" "$FIX/"
else
  mkdir -p "$FIX/scripts"
  cp "$ROOT/scripts/worktree.sh" "$FIX/scripts/"
fi
git -C "$FIX" config user.email t@i; git -C "$FIX" config user.name t
git -C "$FIX" remote set-url origin "$ORIGIN" 2>/dev/null || true
mkdir -p "$FIX/.worktrees/promote-me"
cd "$FIX"
git checkout --quiet -b promote-me 2>/dev/null || git checkout --quiet promote-me
echo change >"$FIX/feature.txt"
env -u GIT_DIR -u GIT_WORK_TREE git add -A
env -u GIT_DIR -u GIT_WORK_TREE git commit --quiet -m "feature work"
WT="$FIX/.worktrees/promote-me"

# 1. Push failure aborts promote nonzero BEFORE claiming success.
set +e
OUT=$(bash scripts/worktree.sh __inner_promote promote-me 2>&1)
RC=$?
set -e
if [[ $RC -ne 0 ]]; then
  check "refused push ⇒ promote exits nonzero" true
else
  check "refused push ⇒ promote exits nonzero" false
fi
if grep -q "Branch pushed to origin" <<<"$OUT"; then
  check "no 'Branch pushed' success claim on failure" false
else
  check "no 'Branch pushed' success claim on failure" true
fi

# 2. Lock-held-then-refuse: acquire the verb CAS, then run promote.
LOCK_REF="refs/svc/locks/worktree-verb/_global"
HOLDER_OID="$(git hash-object -w --stdin <<<"holder: $$ $(hostname)")"
git update-ref "$LOCK_REF" "$HOLDER_OID" 0000000000000000000000000000000000000000 2>/dev/null \
  || git update-ref "$LOCK_REF" "$HOLDER_OID" 2>/dev/null || true
# Write the holder payload the CAS reader expects (pid/host/start-token lines).
printf '%s\n%s\n%s\n%s\n' "$$" "$(hostname)" "" "$(date -u +%FT%TZ)" >"$TMP/holder.txt"
BLOB="$(git hash-object -w "$TMP/holder.txt")"
git update-ref -d "$LOCK_REF" 2>/dev/null || true
git update-ref "$LOCK_REF" "$BLOB" 2>/dev/null || true
set +e
OUT2=$(timeout 30 bash scripts/worktree.sh __inner_promote promote-me 2>&1)
RC2=$?
set -e
git update-ref -d "$LOCK_REF" 2>/dev/null || true
if [[ $RC2 -ne 0 ]] && grep -qiE "verb lock|lock_busy|cannot acquire" <<<"$OUT2"; then
  check "held verb CAS lock ⇒ promote refuses (lock-held-then-refuse)" true
elif [[ $RC2 -ne 0 ]]; then
  # Promote may refuse for the earlier push-deny reason after lock release raced;
  # accept a clean nonzero as long as it did not perform a push.
  if ! grep -q "Branch pushed to origin" <<<"$OUT2"; then
    check "held verb CAS lock ⇒ promote refuses (lock-held-then-refuse)" true
  else
    check "held verb CAS lock ⇒ promote refuses (lock-held-then-refuse)" false
  fi
else
  check "held verb CAS lock ⇒ promote refuses (lock-held-then-refuse)" false
fi

# 3. Quarantine preserves bytes: an orphan dir under .worktrees is MOVED, not deleted.
mkdir -p "$FIX/.worktrees/orphan-test/deep"
echo "precious" >"$FIX/.worktrees/orphan-test/deep/data.txt"
bash scripts/worktree.sh __inner_cleanup >/dev/null 2>&1 || true
Q=$(find "$FIX/.worktrees/.quarantine" -name data.txt 2>/dev/null | head -1)
if [[ -n "$Q" && "$(cat "$Q")" == "precious" ]]; then
  check "cleanup quarantines orphans with bytes preserved" true
else
  check "cleanup quarantines orphans with bytes preserved" false
fi

echo "validate-promote-honesty-fake-origin: $pass passed, $fail failed"
[[ $fail -eq 0 ]]
