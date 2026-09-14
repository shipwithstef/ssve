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
env -u GIT_DIR -u GIT_WORK_TREE git init --quiet --bare "$ORIGIN"
env -u GIT_DIR -u GIT_WORK_TREE git -C "$ORIGIN" config core.hooksPath "$TMP/originhooks"
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
# Deny pushes CLIENT-side. pre-push is a client hook: installing it in the
# bare origin's hooksPath (the previous fixture design) never fires, so the
# deny only worked vacuously while promote crashed earlier for unrelated
# reasons (WI-FW-SKILLS-ROUTING-01 landing surfaced this latent bug).
mkdir -p "$TMP/clienthooks"
printf '#!/usr/bin/env bash\necho "push denied by fixture" >&2\nexit 1\n' >"$TMP/clienthooks/pre-push"
chmod +x "$TMP/clienthooks/pre-push"
git -C "$FIX" config core.hooksPath "$TMP/clienthooks"
mkdir -p "$FIX/.worktrees/promote-me"
cd "$FIX"
env -u GIT_DIR -u GIT_WORK_TREE git -C "$FIX" checkout --quiet -b promote-me 2>/dev/null || env -u GIT_DIR -u GIT_WORK_TREE git -C "$FIX" checkout --quiet promote-me
echo change >"$FIX/feature.txt"
env -u GIT_DIR -u GIT_WORK_TREE git add -A
env -u GIT_DIR -u GIT_WORK_TREE git commit --quiet -m "feature work"
WT="$FIX/.worktrees/promote-me"

# 1. Push failure aborts promote nonzero BEFORE claiming success.
set +e
OUT=$(bash scripts/worktree.sh promote promote-me 2>&1)
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

# 2. Lock-held-then-refuse: acquire the verb CAS at ITS ACTUAL ref — the same
# authorityLockRef identity worktree-verb-lock.mjs uses (sha256 of identity) —
# then run promote and require the lock-specific refusal.
LOCK_IDENTITY="worktree-verb:_global:$(cd "$FIX" && pwd)"
LOCK_REF="refs/svc/authority-locks/$(printf '%s' "$LOCK_IDENTITY" | sha256sum | cut -d' ' -f1)"
# Holder payload is a JSON blob per wi-claim's CAS reader contract:
# {hostname, pid, process_start_token} — LIVE owner (this eval's own pid).
printf '{"schema_version":1,"hostname":"%s","pid":%s,"process_start_token":null}\n' "$(hostname)" "$$" >"$TMP/holder.json"
BLOB="$(env -u GIT_DIR -u GIT_WORK_TREE git -C "$FIX" hash-object -w "$TMP/holder.json")"
ZERO="$(env -u GIT_DIR -u GIT_WORK_TREE git -C "$FIX" rev-parse --show-object-format >/dev/null 2>&1 && echo 0000000000000000000000000000000000000000 || echo 0000000000000000000000000000000000000000)"
env -u GIT_DIR -u GIT_WORK_TREE git -C "$FIX" update-ref "$LOCK_REF" "$BLOB" "$ZERO" 2>/dev/null \
  || env -u GIT_DIR -u GIT_WORK_TREE git -C "$FIX" update-ref "$LOCK_REF" "$BLOB" 2>/dev/null || true
set +e
OUT2=$(timeout 30 bash scripts/worktree.sh promote promote-me 2>&1)
RC2=$?
set -e
env -u GIT_DIR -u GIT_WORK_TREE git -C "$FIX" update-ref -d "$LOCK_REF" 2>/dev/null || true
# Strict: must cite the VERB LOCK specifically — any-nonzero is not proof.
if [[ $RC2 -ne 0 ]] && grep -qiE "verb holds the global lock|lock_busy|cannot acquire the repository verb lock|authority-locks" <<<"$OUT2"; then
  check "held verb CAS lock ⇒ promote refuses with lock-specific error" true
else
  check "held verb CAS lock ⇒ promote refuses with lock-specific error" false
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
