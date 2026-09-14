#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
PROJECT="$TMP_DIR/example-marketplace"

mkdir -p "$PROJECT/docs/specs"
git -C "$TMP_DIR" init -q example-marketplace
git -C "$PROJECT" remote add origin git@github.com:example-org/example-marketplace.git
printf '# Existing consumer instructions\n' > "$PROJECT/CLAUDE.md"
printf '# Router context\n' > "$PROJECT/docs/specs/router-context.md"

node "$REPO_ROOT/scripts/init-project-state.mjs" "$PROJECT" >/dev/null

jq -e '.repository_name == "example-marketplace" and .repository_slug == "example-org/example-marketplace" and .canonical_root == "." and .framework_execution_source == "central-install-only"' \
  "$PROJECT/.agents/repository.json" >/dev/null
test -f "$PROJECT/AGENTS.md"
test -f "$PROJECT/.agents/skills/repo-context/SKILL.md"
grep -Fq 'Read and follow `CLAUDE.md`' "$PROJECT/AGENTS.md"
grep -Fq 'Never execute svc enforcement helpers from the consumer repository' "$PROJECT/.agents/skills/repo-context/SKILL.md"

before="$(sha256sum "$PROJECT/.agents/repository.json" "$PROJECT/AGENTS.md" "$PROJECT/.agents/skills/repo-context/SKILL.md")"
node "$REPO_ROOT/scripts/init-project-state.mjs" "$PROJECT" >/dev/null
after="$(sha256sum "$PROJECT/.agents/repository.json" "$PROJECT/AGENTS.md" "$PROJECT/.agents/skills/repo-context/SKILL.md")"
test "$before" = "$after"

printf 'owner-customized\n' >> "$PROJECT/AGENTS.md"
node "$REPO_ROOT/scripts/init-project-state.mjs" "$PROJECT" >/dev/null
grep -Fq 'owner-customized' "$PROJECT/AGENTS.md"

ESCAPE_PROJECT="$TMP_DIR/escape-project"
ESCAPE_TARGET="$TMP_DIR/outside-skills"
mkdir -p "$ESCAPE_PROJECT/.agents" "$ESCAPE_TARGET"
git -C "$TMP_DIR" init -q escape-project
ln -s "$ESCAPE_TARGET" "$ESCAPE_PROJECT/.agents/skills"
if node "$REPO_ROOT/scripts/init-project-state.mjs" --surface-only "$ESCAPE_PROJECT" >/dev/null 2>&1; then
  echo "FAIL: project surface accepted a symlinked .agents/skills directory" >&2
  exit 1
fi
test ! -e "$ESCAPE_TARGET/repo-context/SKILL.md"

echo "=== Tier 1: Project Consumer Surface ==="
echo "  PASS — repo identity, Codex context, local skill, idempotency, owner preservation, and symlink containment"
