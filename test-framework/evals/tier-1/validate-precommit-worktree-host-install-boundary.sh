#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
HOOK="$ROOT/hooks/svc-pre-commit-multi-host-check.sh"
SLOT="$ROOT/hooks/git/pre-commit.d/00-svc-pre-commit-multi-host-check"

[[ -L "$SLOT" ]] || { echo "FAIL: multi-host pre-commit slot is not a symlink" >&2; exit 1; }
[[ "$(readlink "$SLOT")" == "../../svc-pre-commit-multi-host-check.sh" ]] || {
  echo "FAIL: multi-host pre-commit slot must be worktree-relative and portable" >&2
  exit 1
}
[[ "$(realpath "$SLOT")" == "$HOOK" ]] || { echo "FAIL: slot does not resolve to this checkout's hook" >&2; exit 1; }

node --input-type=module - "$HOOK" <<'NODE'
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(process.argv[2], "utf8");
const worktreeBranch = source.match(/if \[\[ "\$IS_WORKTREE" -eq 1 \]\][\s\S]*?exit 0\nfi/);
assert.ok(worktreeBranch, "hook must have an explicit feature-worktree branch");
assert.match(worktreeBranch[0], /SVC_SETUP_VALIDATE_ONLY=1 \.\/setup --host/);
assert.doesNotMatch(worktreeBranch[0], /SVC_SETUP_ALLOW_WORKTREE/);
assert.doesNotMatch(worktreeBranch[0], /check-install-drift/);
assert.match(worktreeBranch[0], /live installs remain on canonical main/);
assert.match(source, /\/\.worktrees\/|\/worktrees\//);

const canonicalBranch = source.slice(worktreeBranch.index + worktreeBranch[0].length);
assert.match(canonicalBranch, /check-install-drift\.sh --host/);
assert.match(canonicalBranch, /\.\/setup --host/);
assert.doesNotMatch(canonicalBranch, /SVC_SETUP_ALLOW_WORKTREE/);

const mutant = source.replace("SVC_SETUP_VALIDATE_ONLY=1 ./setup --host", "SVC_SETUP_ALLOW_WORKTREE=1 ./setup --host");
const mutantBranch = mutant.match(/if \[\[ "\$IS_WORKTREE" -eq 1 \]\][\s\S]*?exit 0\nfi/);
assert.ok(mutantBranch && !/SVC_SETUP_VALIDATE_ONLY=1/.test(mutantBranch[0]), "mutation must prove the worktree no-write assertion is live");

console.log("validate-precommit-worktree-host-install-boundary: PASS (candidate validate-only; canonical-main install)");
NODE
