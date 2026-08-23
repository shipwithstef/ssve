#!/usr/bin/env bash
# Tier 1: prove that ./setup, when invoked from inside a git worktree (with the
# SVC_SETUP_ALLOW_WORKTREE override active), resolves its symlink-source root
# to the CANONICAL MAIN checkout, NEVER to the worktree path.
#
# This is the permafix for AP-30 (External State Uncoupled from Artifact
# Lifecycle). Concrete recurrence 2026-05-08: the override added in PR #75
# unblocked pre-commit-hook setup-from-worktree but inverted the protection it
# originally provided — every ~/.claude/skills/* symlink got repointed at the
# worktree, then dangled when the worktree was removed.
#
# This test makes regressions impossible to land silently.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
. "$REPO_ROOT/test-framework/evals/tier-1/lib/stage-governed-hooks.sh"; STAGE_HOOKS_REPO="$REPO_ROOT"
SETUP="$REPO_ROOT/setup"
EXPECTED_ROOT="$REPO_ROOT"
if [[ "$REPO_ROOT" == *"/.worktrees/"* ]]; then
  COMMON_GIT_DIR="$(cd "$REPO_ROOT" && git rev-parse --git-common-dir 2>/dev/null || true)"
  if [[ -n "$COMMON_GIT_DIR" ]]; then
    [[ "$COMMON_GIT_DIR" != /* ]] && COMMON_GIT_DIR="$(cd "$REPO_ROOT" && cd "$COMMON_GIT_DIR" && pwd)"
    EXPECTED_ROOT="$(cd "$COMMON_GIT_DIR/.." && pwd)"
  fi
fi

if [[ ! -x "$SETUP" ]]; then
  echo "FAIL: $SETUP not executable"
  exit 1
fi

# Always create a TRANSIENT worktree off main HEAD so the worktree's `setup`
# is byte-identical to the one under test. (Pre-existing worktrees may sit on
# stale branches whose setup predates the fix — testing those produces false
# negatives.)
WT_PATH="$REPO_ROOT/.worktrees/_validate-setup-canonical-resolution-$$"
TRANSIENT_BRANCH="_validate-setup-canonical-$$"
cleanup() {
  (env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE git -C "$REPO_ROOT" worktree remove --force "$WT_PATH" >/dev/null 2>&1 || true)
  (env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE git -C "$REPO_ROOT" branch -D "$TRANSIENT_BRANCH" >/dev/null 2>&1 || true)
}
trap cleanup EXIT
(env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE git -C "$REPO_ROOT" worktree add -b "$TRANSIENT_BRANCH" "$WT_PATH" HEAD >/dev/null 2>&1) || {
  echo "FAIL: could not create transient worktree at $WT_PATH"
  exit 1
}

# CRITICAL: copy the working-tree `setup` (which contains the change under
# test) into the worktree, OVER what git materialized from HEAD. We are
# testing setup as it currently exists, not as it was last committed.
cp "$REPO_ROOT/setup" "$WT_PATH/setup"
chmod +x "$WT_PATH/setup"

WT_SETUP="$WT_PATH/setup"
if [[ ! -x "$WT_SETUP" ]]; then
  echo "FAIL: $WT_SETUP not executable in worktree"
  exit 1
fi

# Sanity: confirm the worktree's setup actually has the dry-run hook we depend
# on. If not, the test would silently invoke a real install.
if ! grep -q 'SVC_SETUP_DRY_RUN_PRINT_ROOT' "$WT_SETUP"; then
  echo "FAIL: worktree's setup is missing SVC_SETUP_DRY_RUN_PRINT_ROOT hook"
  echo "  This test would otherwise invoke a REAL install — refusing."
  exit 1
fi

# --- Case 1: override NOT set → setup must refuse, exit non-zero.
set +e
out=$(SVC_SETUP_ALLOW_WORKTREE=0 SVC_SETUP_DRY_RUN_PRINT_ROOT=1 \
  "$WT_SETUP" --host claude 2>&1)
rc=$?
set -e
if [[ "$rc" -eq 0 ]]; then
  echo "FAIL: setup from worktree without override should refuse (got rc=0)"
  echo "$out"
  exit 1
fi

# --- Case 2: override SET, reason SET → must print canonical main, NOT worktree.
resolved=$(SVC_SETUP_ALLOW_WORKTREE=1 \
  SVC_SETUP_ALLOW_WORKTREE_REASON='tier-1 regression test' \
  SVC_SETUP_DRY_RUN_PRINT_ROOT=1 \
  "$WT_SETUP" --host claude 2>/dev/null | tail -1)

if [[ -z "$resolved" ]]; then
  echo "FAIL: dry-run produced no path"
  exit 1
fi

if [[ "$resolved" == *"/.worktrees/"* ]]; then
  echo "FAIL: setup from worktree resolved symlink-source to a worktree path"
  echo "  got:      $resolved"
  echo "  expected: $REPO_ROOT (or any path NOT containing /.worktrees/)"
  echo "This is AP-30 recurrence — symlinks would dangle on worktree removal."
  exit 1
fi

if [[ "$resolved" != "$EXPECTED_ROOT" ]]; then
  echo "FAIL: setup from worktree did not resolve to main checkout"
  echo "  got:      $resolved"
  echo "  expected: $EXPECTED_ROOT"
  exit 1
fi

# --- Case 3: override set but reason EMPTY → must refuse.
set +e
SVC_SETUP_ALLOW_WORKTREE=1 SVC_SETUP_ALLOW_WORKTREE_REASON='' \
  SVC_SETUP_DRY_RUN_PRINT_ROOT=1 "$WT_SETUP" --host claude >/dev/null 2>&1
rc=$?
set -e
if [[ "$rc" -eq 0 ]]; then
  echo "FAIL: setup with override=1 but empty reason should refuse"
  exit 1
fi

# --- WI-487 extension: ephemeral-source refusal + durable launcher materialization
# (copied, not symlinked). AC-487-1/4. ---
if [ -f "$REPO_ROOT/scripts/svc-migrate-install.mjs" ] && [ -f "$REPO_ROOT/bin/svc-enforce.mjs" ] && command -v node >/dev/null 2>&1; then
  DBASE="${SVC_TEST_DURABLE_BASE:-$HOME/.cache}"; mkdir -p "$DBASE" 2>/dev/null || true
  DSRC="$(mktemp -d "$DBASE/svc-wi487-canon-XXXXXX")"
  XHOME="$(mktemp -d)"
  mkdir -p "$DSRC/bin" "$DSRC/hooks/lib" "$DSRC/scripts" "$DSRC/provision/hosts"
  cp "$REPO_ROOT/bin/svc-enforce.mjs" "$DSRC/bin/"
  cp "$REPO_ROOT/hooks/lib/enforcement-core.mjs" "$DSRC/hooks/lib/"
  cp "$REPO_ROOT/scripts/svc-migrate-install.mjs" "$DSRC/scripts/"
  cp "$REPO_ROOT/provision/hosts/claude.json" "$DSRC/provision/hosts/"
  stage_governed_bash_hooks "$DSRC"
  # Durable materialization: launcher must be a COPIED real file, not a symlink.
  if HOME="$XHOME" node "$DSRC/scripts/svc-migrate-install.mjs" materialize --host claude --repo-root "$DSRC" --skills-path "$XHOME/.claude/skills" >/dev/null 2>&1; then
    LN="$XHOME/.svc/enforcement/1/bin/svc-enforce"
    if [ -f "$LN" ] && [ ! -L "$LN" ]; then
      echo "OK: durable launcher materialized as a copied real file (not a symlink)"
    else
      echo "FAIL: launcher not a copied real file"; rm -rf "$DSRC" "$XHOME"; exit 1
    fi
  else
    echo "FAIL: materialize from a durable canonical source failed"; rm -rf "$DSRC" "$XHOME"; exit 1
  fi
  # Ephemeral-source refusal: materializing from a /tmp source must be refused.
  ESRC="$(mktemp -d)"  # under /tmp -> ephemeral
  mkdir -p "$ESRC/bin" "$ESRC/hooks/lib" "$ESRC/scripts" "$ESRC/provision/hosts"
  cp "$REPO_ROOT/bin/svc-enforce.mjs" "$ESRC/bin/"; cp "$REPO_ROOT/hooks/lib/enforcement-core.mjs" "$ESRC/hooks/lib/"
  cp "$REPO_ROOT/scripts/svc-migrate-install.mjs" "$ESRC/scripts/"; cp "$REPO_ROOT/provision/hosts/claude.json" "$ESRC/provision/hosts/"
  # Stage the full governed hook surface so refusal is attributable to
  # ephemerality alone, not to SVC-ENFORCE-HOOK-MODE.
  stage_governed_bash_hooks "$ESRC"
  if HOME="$XHOME" node "$ESRC/scripts/svc-migrate-install.mjs" materialize --host claude --repo-root "$ESRC" --skills-path "$XHOME/.claude/skills" >/dev/null 2>&1; then
    echo "FAIL: materialize from an ephemeral (/tmp) source should be refused"; rm -rf "$DSRC" "$XHOME" "$ESRC"; exit 1
  else
    echo "OK: ephemeral (/tmp) source refused for launcher materialization"
  fi
  rm -rf "$DSRC" "$XHOME" "$ESRC"
else
  echo "EXPECTED-RED: ephemeral-source refusal + launcher materialization not yet implemented"
  exit 1
fi

# --- WI-487 R3-F003: launcher-bundle materialization is a PRE-MUTATION prerequisite.
# The durable bundle preflight (`svc-migrate-install.mjs materialize`) MUST run BEFORE
# setup creates or changes ANY host target — the skills-target mkdir, the `.source-repo`
# write, and the skill/infra symlinks. Assert the ordering statically so a regression
# that moves materialization back below the skills-surface mutation cannot land. ---
SETUP_FILE="$REPO_ROOT/setup"
# First line invoking the migrate CLI with the `materialize` subcommand (the preflight).
MAT_LINE=$(grep -n 'svc-migrate-install.mjs" materialize' "$SETUP_FILE" | head -1 | cut -d: -f1)
[ -z "$MAT_LINE" ] && MAT_LINE=$(grep -n 'svc-migrate-install.mjs materialize' "$SETUP_FILE" | head -1 | cut -d: -f1)
# First host-surface mutation: the earliest of mkdir SKILLS_TARGET / .source-repo write /
# skill symlink creation.
MUT_LINE=$(grep -nE 'mkdir -p "\$SKILLS_TARGET"|> "\$SKILLS_TARGET/\.source-repo"|ln -sf "\$skill_path"' "$SETUP_FILE" | head -1 | cut -d: -f1)
if [ -z "$MAT_LINE" ] || [ -z "$MUT_LINE" ]; then
  echo "FAIL: R3-F003 could not locate materialize (line '$MAT_LINE') or first host mutation (line '$MUT_LINE') in setup"
  exit 1
fi
if [ "$MAT_LINE" -lt "$MUT_LINE" ]; then
  echo "OK: R3-F003 bundle preflight (setup:$MAT_LINE) precedes the first host-surface mutation (setup:$MUT_LINE)"
else
  echo "FAIL: R3-F003 — materialization (setup:$MAT_LINE) does NOT precede the first host-surface mutation (setup:$MUT_LINE)"
  echo "  A materialization failure would abort AFTER the skills surface was already changed (AC-487-1 breach)."
  exit 1
fi

echo "OK: setup-worktree-canonical-resolution — all 3 cases pass + WI-487 durable-launcher + R3-F003 ordering"
