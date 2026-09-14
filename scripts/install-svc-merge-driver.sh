#!/usr/bin/env bash
# install-svc-merge-driver — register the svc-json merge driver in THIS repo's
# git config (WI-398).
#
# WHY a separate install step: a merge driver NAME lives in version-controlled
# `.gitattributes` (`merge=svc-json`), but the driver COMMAND must live in
# `.git/config`, which is NOT version-controlled. So every clone/worktree must
# run this once. `./setup` calls it automatically; run it by hand in an
# already-cloned repo. If it is never run, git falls back to its default text
# merge (safe conflict markers) — the driver is a non-breaking upgrade, not a
# dependency.
#
# FOREIGN-WORKTREE SAFE (AC3): the driver is registered with an ABSOLUTE,
# quoted script path resolved from `git rev-parse --show-toplevel`, so a merge
# triggered from any worktree or subdirectory finds the driver regardless of
# cwd. git worktrees share the common `.git/config`, so one registration covers
# the main checkout and every linked worktree.
set -euo pipefail

# Optional overrides let onboarded projects register the framework's driver
# against their OWN repo (the driver script lives in the framework install, not
# the project): --repo <project-root> --driver <abs-driver-path>.
REPO_ROOT=""; DRIVER=""
while [ $# -gt 0 ]; do
  case "$1" in
    --repo)   REPO_ROOT="$2"; shift 2 ;;
    --driver) DRIVER="$2";    shift 2 ;;
    *) echo "install-svc-merge-driver: unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [ -z "$REPO_ROOT" ]; then
  REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
    echo "install-svc-merge-driver: not inside a git repo" >&2
    exit 1
  }
fi
[ -n "$DRIVER" ] || DRIVER="$REPO_ROOT/scripts/svc-json-merge-driver.mjs"
# Normalize to an absolute path (cwd-independent / foreign-worktree safe).
case "$DRIVER" in /*) : ;; *) DRIVER="$(cd "$(dirname "$DRIVER")" && pwd)/$(basename "$DRIVER")" ;; esac
if [ ! -f "$DRIVER" ]; then
  echo "install-svc-merge-driver: driver missing at $DRIVER" >&2
  exit 1
fi

# Absolute + quoted path → cwd-independent (foreign-worktree safe).
git -C "$REPO_ROOT" config merge.svc-json.name   "svc deterministic JSON state 3-way merge (WI-398)"
git -C "$REPO_ROOT" config merge.svc-json.driver "node \"$DRIVER\" %O %A %B %P"

echo "install-svc-merge-driver: registered merge.svc-json → node \"$DRIVER\" %O %A %B %P"
