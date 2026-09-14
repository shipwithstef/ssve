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
# Safety contract: run only under a private fixture HOME. Install and break a
# disposable canonical source, then demand exact recovery; never touch the
# operator's installed pointers or accept a skip as recovery evidence.
set -u
FIXTURE_FRAMEWORK_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
if [ "${SVC_TIER1_FIXTURE_HOME:-}" != "$HOME" ]; then
  . "$FIXTURE_FRAMEWORK_ROOT/test-framework/evals/tier-1/lib/fixture-home.sh"
  svc_run_fixture bash "$0" "$@"
  exit "$?"
fi

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
. "$SELF487_REPO/test-framework/evals/tier-1/lib/stage-governed-hooks.sh"; STAGE_HOOKS_REPO="$SELF487_REPO"
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
  stage_governed_bash_hooks "$DDP_SRC"
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

# Build a canonical disposable Git source containing the candidate bytes. Its
# durable path is owned by the fixture; deleting it cannot affect any session.
FIXTURE_SOURCE="$HOME/app-workspaces/seriousvibecoding"
mkdir -p "$FIXTURE_SOURCE"
python3 - "$SELF487_REPO" "$FIXTURE_SOURCE" <<'PY_COPY'
import os, pathlib, shutil, subprocess, sys
root, target = map(pathlib.Path, sys.argv[1:])
files = subprocess.check_output(['git', '-C', str(root), 'ls-files', '-z', '--cached', '--others', '--exclude-standard']).split(b'\0')
for raw in set(files):
    if not raw: continue
    rel = pathlib.Path(os.fsdecode(raw))
    if rel.parts[0] in ('.git', '.svc', '.worktrees') or str(rel).startswith('test-framework/results/'): continue
    source = root / rel
    if not source.exists() and not source.is_symlink(): continue
    destination = target / rel
    destination.parent.mkdir(parents=True, exist_ok=True)
    if source.is_symlink(): destination.symlink_to(os.readlink(source))
    elif source.is_file(): shutil.copy2(source, destination)
PY_COPY
if [ "$?" -ne 0 ]; then fail "could not snapshot candidate source"; exit 1; fi
git -C "$FIXTURE_SOURCE" init -q
git -C "$FIXTURE_SOURCE" add .
git -C "$FIXTURE_SOURCE" -c user.name=Fixture -c user.email=fixture@example.invalid -c commit.gpgsign=false commit -qm 'isolated self-heal source'
if ! "$FIXTURE_SOURCE/setup" --host claude > "$HOME/setup.log" 2>&1; then
  cat "$HOME/setup.log"
  fail "could not install disposable source"
  exit 1
fi
SKILLS_DIR="$HOME/.claude/skills"
LIVE_POINTER="$SKILLS_DIR/.source-repo"
SCRIPTS_LINK="$SKILLS_DIR/scripts"
[ "$(cat "$LIVE_POINTER")" = "$FIXTURE_SOURCE" ] || { fail "fixture setup chose another source"; exit 1; }
[ -L "$SCRIPTS_LINK" ] || { fail "fixture setup did not link scripts"; exit 1; }
DEAD_PATH="$HOME/absent-source/.worktrees/deleted"
printf '%s\n' "$DEAD_PATH" > "$LIVE_POINTER"
rm "$SCRIPTS_LINK"
ln -s "$DEAD_PATH/scripts" "$SCRIPTS_LINK"
SVC_HOST=claude SVC_SELF_HEAL_DISABLE="" timeout 90 node "$FIXTURE_SOURCE/hooks/svc-session-start-healthcheck.mjs" </dev/null 2>"$HOME/self-heal.log"
HOOK_EXIT=$?
if [ "$HOOK_EXIT" -eq 0 ] && grep -q 'self-heal: repaired' "$HOME/self-heal.log" \
  && [ "$(cat "$LIVE_POINTER")" = "$FIXTURE_SOURCE" ] \
  && [ "$(readlink "$SCRIPTS_LINK")" = "$FIXTURE_SOURCE/scripts" ]; then
  pass "durable fixture receipt recovers both dead pointers to the exact canonical source"
else
  cat "$HOME/self-heal.log"
  fail "double-dead-pointer fixture did not restore both exact targets"
fi
if [ "$FAIL" -eq 0 ]; then
  echo "PASS — isolated self-heal recovery, source-loss denial, and untrusted-source rejection"
  exit 0
fi
exit 1
