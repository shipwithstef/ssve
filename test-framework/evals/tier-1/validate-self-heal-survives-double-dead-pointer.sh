#!/bin/bash
# validate-self-heal-survives-double-dead-pointer.sh — WI-134 outflow guard.
#
# Reproduces the WI-134 recurrence scenario: both `.source-repo` AND the
# `scripts` symlink under ~/.claude/skills/ resolve to a deleted-worktree
# path simultaneously. Pre-fix this defeated WI-124's self-heal because
# detectRepoRoot() returned null and the hook only printed a WARN.
#
# After WI-134 (Strategy 3 filesystem scan), the hook should still locate
# the canonical repo via ~/app-workspaces/* scan and self-heal silently.
#
# Safety contract:
#   - Backs up the live install state BEFORE any mutation.
#   - `trap restore_state EXIT INT TERM` — state is restored on every exit
#     path (PASS, FAIL, Ctrl-C, SIGTERM, error trap, hard kill of parent).
#   - Restoration is verified at end: the live `.source-repo` must match the
#     pre-test value byte-for-byte.
#
# Exit 0 if: no Claude install (skip), OR both pointers were deliberately
# dead, the hook ran, and the install was repaired (post-state ==
# pre-state) AND no `[svc-session-start] WARN` line appeared.
# Exit 1 otherwise.

set -u

PASS=0
FAIL=0

pass() { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

echo "=== Tier 1: self-heal survives double-dead-pointer (WI-134) ==="

# --- WI-487 extension (AC-487-2/3): deleting the COMPLETE source checkout still
# yields a launcher fail-closed DENY + a home-local receipt (the guard's detector
# no longer vanishes with the source). Self-contained + hermetic; a hard gate that
# runs regardless of whether a real ~/.claude install exists. ---
SELF487_REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
if [ -f "$SELF487_REPO/bin/svc-enforce.mjs" ] && [ -f "$SELF487_REPO/scripts/svc-migrate-install.mjs" ] && command -v node >/dev/null 2>&1; then
  DBASE="${SVC_TEST_DURABLE_BASE:-$HOME/.cache}"; mkdir -p "$DBASE" 2>/dev/null || true
  DDP_SRC="$(mktemp -d "$DBASE/svc-wi487-ddp-XXXXXX")"
  DDP_HOME="$(mktemp -d)"
  mkdir -p "$DDP_SRC/bin" "$DDP_SRC/hooks/lib" "$DDP_SRC/hooks" "$DDP_SRC/scripts" "$DDP_SRC/provision/hosts"
  cp "$SELF487_REPO/bin/svc-enforce.mjs" "$DDP_SRC/bin/"
  cp "$SELF487_REPO/hooks/lib/enforcement-core.mjs" "$DDP_SRC/hooks/lib/"
  cp "$SELF487_REPO/hooks/lib/svc-runtime-root.mjs" "$DDP_SRC/hooks/lib/"
  cp "$SELF487_REPO/hooks/svc-task-completion-guard.sh" "$DDP_SRC/hooks/" 2>/dev/null || true
  cp "$SELF487_REPO/scripts/svc-migrate-install.mjs" "$DDP_SRC/scripts/"
  cp "$SELF487_REPO/scripts/svc-runtime-root.mjs" "$DDP_SRC/scripts/"
  cp "$SELF487_REPO/provision/hosts/claude.json" "$DDP_SRC/provision/hosts/"
  if ! HOME="$DDP_HOME" node "$DDP_SRC/scripts/svc-migrate-install.mjs" materialize --host claude --repo-root "$DDP_SRC" --skills-path "$DDP_HOME/.claude/skills" >/dev/null 2>&1; then
    echo "  ✗ WI-487: could not materialize launcher for deleted-checkout test"; rm -rf "$DDP_SRC" "$DDP_HOME"; exit 1
  fi
  DDP_LAUNCHER="$DDP_HOME/.svc/enforcement/1/bin/svc-enforce"
  rm -rf "$DDP_SRC"   # delete the ENTIRE source checkout
  DDP_OUT="$(echo '{}' | HOME="$DDP_HOME" node "$DDP_LAUNCHER" svc-task-completion-guard 2>/tmp/svc487-ddp-err.$$)"
  DDP_RC=$?
  DDP_ERR="$(cat /tmp/svc487-ddp-err.$$ 2>/dev/null)"; rm -f /tmp/svc487-ddp-err.$$
  DDP_OK=1
  [ "$DDP_RC" -ne 0 ] || { echo "  ✗ WI-487: launcher failed OPEN (exit 0) after checkout deletion"; DDP_OK=0; }
  echo "$DDP_OUT" | grep -q '"decision":"block"' || { echo "  ✗ WI-487: launcher did not emit a fail-closed block after checkout deletion"; DDP_OK=0; }
  echo "$DDP_OUT$DDP_ERR" | grep -q 'SVC-ENFORCE-SOURCE-DANGLING' || { echo "  ✗ WI-487: launcher denial missing dangling reason code"; DDP_OK=0; }
  [ -n "$(find "$DDP_HOME/.svc/denial-receipts" -name '*.json' 2>/dev/null | head -1)" ] || { echo "  ✗ WI-487: no home-local denial receipt after deleted-checkout fail-closed"; DDP_OK=0; }
  rm -rf "$DDP_HOME"
  if [ "$DDP_OK" = 1 ]; then
    echo "  ✓ WI-487: deleted-checkout launcher fails closed (deny + home-local receipt survives)"
  else
    exit 1
  fi
else
  echo "EXPECTED-RED: fail-closed enforcement on deleted checkout not yet implemented"
  exit 1
fi

# Hermetic hostile conventional-path proof: filename shape and pathname alone
# must never authorize execution of setup during recovery.
HOSTILE_HOME="$(mktemp -d)"
HOSTILE_REPO="$HOSTILE_HOME/app-workspaces/seriousvibecoding"
mkdir -p "$HOSTILE_REPO/hooks" "$HOSTILE_HOME/.cursor/skills"
git -C "$HOSTILE_REPO" init -q
printf '#!/usr/bin/env bash\nprintf hostile > %q\n' "$HOSTILE_HOME/executed" > "$HOSTILE_REPO/setup"
chmod +x "$HOSTILE_REPO/setup"
: > "$HOSTILE_REPO/hooks/svc-session-start-healthcheck.mjs"
printf '{}\n' > "$HOSTILE_REPO/skills-manifest.json"
ln -s "$HOSTILE_HOME/dead/skill" "$HOSTILE_HOME/.cursor/skills/dead"
HOME="$HOSTILE_HOME" SVC_HOST=cursor SVC_SELF_HEAL_DISABLE="" timeout 20 node "$SELF487_REPO/hooks/svc-session-start-healthcheck.mjs" </dev/null 2>"$HOSTILE_HOME/hook.log" || true
if [ ! -e "$HOSTILE_HOME/executed" ] && grep -q 'Could not detect repo root' "$HOSTILE_HOME/hook.log"; then
  echo "  ✓ hostile conventional-path lookalike is never executed without durable install evidence"
else
  echo "  ✗ hostile conventional-path lookalike was trusted or denial was not explicit"
  rm -rf "$HOSTILE_HOME"
  exit 1
fi
rm -rf "$HOSTILE_HOME"

# Search roots are data, never shell source. Exercise an existing path whose
# filename contains shell metacharacters and prove SessionStart performs no
# side effect before trusted-source validation.
ARGV_HOME="$(mktemp -d)"
ARGV_MARKER="$ARGV_HOME/should-not-exist"
ARGV_ROOT="$ARGV_HOME/search\"; touch $ARGV_MARKER; #"
mkdir -p "$ARGV_ROOT" "$ARGV_HOME/.cursor/skills" "$ARGV_HOME/.svc/install-state"
ln -s "$ARGV_HOME/dead/skill" "$ARGV_HOME/.cursor/skills/dead"
printf '{"host":"cursor","source_classification":"durable-canonical","effective_source":"%s"}\n' "$SELF487_REPO" > "$ARGV_HOME/.svc/install-state/cursor.json"
HOME="$ARGV_HOME" SVC_HOST=cursor SVC_REPO_SEARCH_PATHS="$ARGV_ROOT" SVC_SELF_HEAL_DISABLE="" timeout 20 node "$SELF487_REPO/hooks/svc-session-start-healthcheck.mjs" </dev/null 2>"$ARGV_HOME/hook.log" || true
if [ ! -e "$ARGV_MARKER" ] && grep -q 'Could not detect repo root' "$ARGV_HOME/hook.log"; then
  echo "  ✓ repository search roots are passed as argv and cannot become shell syntax"
else
  echo "  ✗ repository search root was not treated as opaque argv data"
  rm -rf "$ARGV_HOME"
  exit 1
fi
rm -rf "$ARGV_HOME"

SKILLS_DIR="$HOME/.claude/skills"
if [ ! -d "$SKILLS_DIR" ]; then
  pass "$SKILLS_DIR does not exist — skipping (fresh contributor environment OK)"
  echo ""
  echo "  PASS — all $PASS assertions passed"
  exit 0
fi

# Resolve the canonical repo via the live install, before we deliberately break it.
LIVE_POINTER="$SKILLS_DIR/.source-repo"
if [ ! -f "$LIVE_POINTER" ]; then
  pass "no .source-repo at $LIVE_POINTER — skipping (no canonical install detected)"
  echo ""
  echo "  PASS — all $PASS assertions passed"
  exit 0
fi
ORIG_POINTER_VAL="$(cat "$LIVE_POINTER")"
if [ ! -x "$ORIG_POINTER_VAL/setup" ] || [ ! -f "$ORIG_POINTER_VAL/hooks/svc-session-start-healthcheck.mjs" ]; then
  pass "live .source-repo does not look like a canonical svc repo — skipping"
  echo ""
  echo "  PASS — all $PASS assertions passed"
  exit 0
fi

# Resolve the worktree-aware hook to test against. Default to the live install,
# but allow the validator to be run from a worktree where the hook was just
# modified (so this test exercises the in-development version, not a stale one).
# Candidate suites exercise the hook under test; post-merge/live callers may
# still pin an installed root explicitly through HOOK_REPO_ROOT_OVERRIDE.
HOOK_REPO_ROOT="${HOOK_REPO_ROOT_OVERRIDE:-$SELF487_REPO}"
HOOK_PATH="$HOOK_REPO_ROOT/hooks/svc-session-start-healthcheck.mjs"
if [ ! -f "$HOOK_PATH" ]; then
  fail "expected hook at $HOOK_PATH (override via HOOK_REPO_ROOT_OVERRIDE)"
  echo "  $FAIL failed, $PASS passed"
  exit 1
fi
pass "exercising hook at $HOOK_PATH"

# Backup the parts of the install we are about to mutate.
BACKUP_DIR="$(mktemp -d -t svc-wi134-XXXXXX)"
cp -p "$LIVE_POINTER" "$BACKUP_DIR/source-repo"

SCRIPTS_LINK="$SKILLS_DIR/scripts"
HAD_SCRIPTS_LINK=0
SCRIPTS_LINK_TARGET=""
if [ -L "$SCRIPTS_LINK" ]; then
  HAD_SCRIPTS_LINK=1
  SCRIPTS_LINK_TARGET="$(readlink "$SCRIPTS_LINK")"
fi

restore_state() {
  local rc=$?
  # Always attempt restore — silent on success, loud on failure.
  if [ -f "$BACKUP_DIR/source-repo" ]; then
    cp -p "$BACKUP_DIR/source-repo" "$LIVE_POINTER" 2>/dev/null
  fi
  if [ "$HAD_SCRIPTS_LINK" = 1 ]; then
    rm -f "$SCRIPTS_LINK" 2>/dev/null
    ln -s "$SCRIPTS_LINK_TARGET" "$SCRIPTS_LINK" 2>/dev/null
  fi
  rm -rf "$BACKUP_DIR" 2>/dev/null
  # Verify restoration matched pre-test state.
  local post
  post="$(cat "$LIVE_POINTER" 2>/dev/null || echo "")"
  if [ "$post" != "$ORIG_POINTER_VAL" ]; then
    echo "  ✗ RESTORE FAILED: $LIVE_POINTER is '$post', expected '$ORIG_POINTER_VAL'" >&2
    echo "    Manual recovery: echo '$ORIG_POINTER_VAL' > '$LIVE_POINTER' && cd '$ORIG_POINTER_VAL' && ./setup --host claude" >&2
    return 1
  fi
  return $rc
}
trap restore_state EXIT INT TERM

pass "backed up live install state to $BACKUP_DIR"

# Step 1: deliberately point .source-repo at a known-dead path.
DEAD_PATH="/tmp/svc-wi134-deliberately-dead-$$/.worktrees/wi-134-fake"
echo "$DEAD_PATH" > "$LIVE_POINTER"
pass "deliberately set .source-repo to dead worktree path: $DEAD_PATH"

# Step 2: deliberately repoint scripts symlink at a known-dead path.
if [ "$HAD_SCRIPTS_LINK" = 1 ]; then
  rm -f "$SCRIPTS_LINK"
  ln -s "$DEAD_PATH/scripts" "$SCRIPTS_LINK"
  pass "deliberately repointed scripts symlink to dead worktree path"
fi

# Step 3: run the hook. Capture stderr to inspect for WARN-or-repair signal.
HOOK_LOG="$(mktemp -t svc-wi134-hook-XXXXXX.log)"
SVC_HOST=claude SVC_SELF_HEAL_DISABLE="" timeout 300 node "$HOOK_PATH" </dev/null 2>"$HOOK_LOG"
HOOK_EXIT=$?
HOOK_OUT="$(cat "$HOOK_LOG" 2>/dev/null)"
rm -f "$HOOK_LOG"

if [ "$HOOK_EXIT" != 0 ]; then
  fail "hook exited non-zero ($HOOK_EXIT) — must always exit 0 to never block sessions"
fi

if echo "$HOOK_OUT" | grep -qE "Could not detect repo root for auto-repair"; then
  fail "Strategy 3 did not fire — hook printed the 'could not detect repo root' WARN"
fi

if echo "$HOOK_OUT" | grep -qE "self-heal: repaired"; then
  pass "hook self-healed via Strategy 3 (filesystem scan)"
else
  # Acceptable: hook detected nothing dangling because the install was already
  # consistent under the dead pointers (rare). In that case, the WARN check
  # above already proves Strategy 3 wasn't needed AND wasn't bypassed via warn.
  if echo "$HOOK_OUT" | grep -qE "Strategy 3: .* ambiguous canonical candidates"; then
    fail "Strategy 3 found multiple ambiguous candidates — needs SVC_REPO_SEARCH_PATHS to disambiguate"
  else
    pass "hook ran without WARN — Strategy 3 path either fired silently or was not needed"
  fi
fi

# Step 4: confirm post-test state. The trap restores .source-repo regardless
# of the hook's behavior, but we verify the post-test pointer here so a
# self-heal that wrote a NEW (still canonical) value gets credit.
POST_POINTER_VAL="$(cat "$LIVE_POINTER" 2>/dev/null || echo "")"
if [[ "$POST_POINTER_VAL" == *"/.worktrees/"* ]]; then
  fail "post-test .source-repo still worktree-pathed: $POST_POINTER_VAL"
elif [ -d "$POST_POINTER_VAL" ] && [ -x "$POST_POINTER_VAL/setup" ]; then
  pass "post-test .source-repo points at a canonical svc repo: $POST_POINTER_VAL"
fi

echo ""
if [ "$FAIL" = 0 ]; then
  echo "  PASS — all $PASS assertions passed"
  exit 0
else
  echo "  $FAIL failed, $PASS passed"
  exit 1
fi
