#!/usr/bin/env bash
# Tier-1: scripts/quick-fix-eligibility.mjs rejects structural changes.
# Promotion note: quick-fix is the only legitimate chain bypass; loosening
# it would let structural changes through without plan-changeset.

set -u
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

if [[ ! -f scripts/quick-fix-eligibility.mjs ]]; then
  echo "SKIP: eligibility script not present (pre-Phase A)"
  exit 0
fi

TMP="$(mktemp -d)"
trap "rm -rf $TMP" EXIT

cd "$TMP"
G375() { env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE git -C "$TMP" "$@"; }
G375 init -q
G375 config user.email t@t.t
G375 config user.name t

# Seed an initial baseline tree
echo "export function existing() { return 1; }" > test.mjs
G375 add test.mjs
TREE="$(G375 write-tree)"
INIT_SHA="$(GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t.t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t.t \
  G375 commit-tree "$TREE" -m init 2>/dev/null || echo "")"
if [[ -n "$INIT_SHA" ]]; then
  G375 update-ref refs/heads/main "$INIT_SHA"
  G375 symbolic-ref HEAD refs/heads/main
fi

# Stage a structural change (added function)
echo "export function newThing() { return 42; }" >> test.mjs
G375 add test.mjs

cd "$REPO_ROOT"
RESULT="$(GIT_DIR=$TMP/.git GIT_WORK_TREE=$TMP node scripts/quick-fix-eligibility.mjs 2>/dev/null || true)"
ELIGIBLE="$(echo "$RESULT" | grep -o '"eligible":[^,}]*' | head -1 | cut -d: -f2 | tr -d ' ')"

if [[ "$ELIGIBLE" == "true" ]]; then
  echo "FAIL: structural change (added function) was marked eligible"
  echo "  Output: $RESULT"
  exit 1
fi

echo "PASS: structural change correctly rejected"
exit 0
