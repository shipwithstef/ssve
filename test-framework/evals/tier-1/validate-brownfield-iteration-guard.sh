#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

pass=0
fail=0
ok() { echo "  PASS - $1"; pass=$((pass+1)); }
bad() { echo "  FAIL - $1"; fail=$((fail+1)); }

echo "=== Tier 1: brownfield iteration guard ==="

node --check scripts/validate-brownfield-iteration-guard.mjs >/dev/null && ok "template validator syntax valid" || bad "template validator syntax invalid"
node --check hooks/svc-workflow-guard.mjs >/dev/null && ok "workflow guard syntax valid" || bad "workflow guard syntax invalid"
node scripts/validate-brownfield-iteration-guard.mjs references/templates/brownfield-iter-visual.json >/dev/null && ok "brownfield visual template review task is skill-bound" || bad "template review task is not skill-bound"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE git init -q "$tmp/repo"
cd "$tmp/repo"
G375() { env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE git -C "$tmp/repo" "$@"; }
G375 config user.email test@example.com
G375 config user.name Tester
mkdir -p .svc src docs
echo base > README.md
G375 add README.md
G375 commit -q -m init
G375 branch -M main
cat > .svc/lane-tasks-WI-TMP.json <<'JSON'
{
  "wi": "WI-TMP",
  "lane": "brownfield-feature",
  "delivery_graph": {
    "lane": "brownfield-feature",
    "change_type": "feature",
    "risk_flags": ["user-facing"]
  },
  "tasks": []
}
JSON

payload='{"tool_name":"Bash","tool_input":{"command":"git commit -m \"feature work\" -m \"Co-Authored-By: Claude Opus 4.6 (1M context) <contact-cd29c5ac34@example.invalid>\""}}'
if printf '%s' "$payload" | node "$REPO_ROOT/hooks/svc-workflow-guard.mjs" --bash-guard >/dev/null 2>&1; then
  ok "direct main feature commit with no staged files allowed"
else
  bad "direct main feature commit with no staged files blocked"
fi

printf 'x\n' > src/app.js
G375 add src/app.js
if printf '%s' "$payload" | node "$REPO_ROOT/hooks/svc-workflow-guard.mjs" --bash-guard >/dev/null 2>&1; then
  bad "direct main feature commit accepted"
else
  ok "direct main feature commit blocked"
fi

G375 reset -q
payload_chain='{"tool_name":"Bash","tool_input":{"command":"printf x > src/app.js && git add src/app.js && git commit -m \"feature work\" -m \"Co-Authored-By: Claude Opus 4.6 (1M context) <contact-cd29c5ac34@example.invalid>\""}}'
if printf '%s' "$payload_chain" | node "$REPO_ROOT/hooks/svc-workflow-guard.mjs" --bash-guard >/dev/null 2>&1; then
  bad "direct main chained add and commit accepted"
else
  ok "direct main chained add and commit blocked"
fi

printf 'tracked\n' > src/tracked.js
G375 add src/tracked.js
G375 commit -q -m tracked
printf 'tracked-change\n' > src/tracked.js
payload_commit_all='{"tool_name":"Bash","tool_input":{"command":"git commit -am \"feature work\" -m \"Co-Authored-By: Claude Opus 4.6 (1M context) <contact-cd29c5ac34@example.invalid>\""}}'
if printf '%s' "$payload_commit_all" | node "$REPO_ROOT/hooks/svc-workflow-guard.mjs" --bash-guard >/dev/null 2>&1; then
  bad "direct main commit -a accepted"
else
  ok "direct main commit -a blocked"
fi
G375 checkout -q -- src/tracked.js

G375 reset -q
printf 'docs\n' > docs/note.md
G375 add docs/note.md
if printf '%s' "$payload" | node "$REPO_ROOT/hooks/svc-workflow-guard.mjs" --bash-guard >/dev/null 2>&1; then
  ok "docs-only framework exception allowed"
else
  bad "docs-only framework exception blocked"
fi

mkdir -p .worktrees
G375 worktree add -q -b feature-worktree .worktrees/feature-worktree
printf 'main-staged\n' > src/main-staged.js
G375 add src/main-staged.js
worktree_payload=$(WORKTREE_CWD="$PWD/.worktrees/feature-worktree" node <<'NODE'
process.stdout.write(JSON.stringify({
  tool_name: "Bash",
  cwd: process.env.WORKTREE_CWD,
  tool_input: {
    command: "git commit -m \"worktree commit\" -m \"Co-Authored-By: Claude Opus 4.6 (1M context) <contact-cd29c5ac34@example.invalid>\"",
  },
}));
NODE
)
if printf '%s' "$worktree_payload" | node "$REPO_ROOT/hooks/svc-workflow-guard.mjs" --bash-guard >/dev/null 2>&1; then
  ok "payload cwd feature worktree avoids main false positive"
else
  bad "payload cwd feature worktree blocked by main state"
fi

echo "brownfield iteration guard: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
