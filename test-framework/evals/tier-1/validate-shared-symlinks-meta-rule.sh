#!/usr/bin/env bash
# Tier 1: Persistent negative-test for the lint-skills-manifest.mjs WI137
# meta-rule. Sets up a tmpdir copy of provision/hosts/, swaps claude.json
# with the synthetic-violation fixture (missing "_shared" in infra_dirs),
# runs the linter against the tmpdir via SVC_HOSTS_DIR override, asserts
# the linter exits non-zero AND its stderr names "_shared" and "claude".
#
# Read-only against the real repo. Operates entirely in a tmpdir; never
# mutates real provision/hosts/.
#
# WI-137
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
LINTER="$REPO_ROOT/scripts/lint-skills-manifest.mjs"
FIXTURE="$REPO_ROOT/test-framework/fixtures/wi137-negative-host.json"
HOSTS_DIR="$REPO_ROOT/provision/hosts"

if [ ! -f "$LINTER" ]; then
  echo "FAIL: linter not found at $LINTER" >&2
  exit 1
fi
if [ ! -f "$FIXTURE" ]; then
  echo "FAIL: fixture not found at $FIXTURE" >&2
  exit 1
fi
if [ ! -d "$HOSTS_DIR" ]; then
  echo "FAIL: real provision/hosts/ not found at $HOSTS_DIR" >&2
  exit 1
fi

TMPDIR_HOSTS="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_HOSTS"' EXIT

cp -r "$HOSTS_DIR"/. "$TMPDIR_HOSTS"/
cp "$FIXTURE" "$TMPDIR_HOSTS/claude.json"

# Run linter against the tmpdir via SVC_HOSTS_DIR override.
# Capture stdout+stderr; expect non-zero exit (the meta-rule must reject the synthetic violation).
set +e
LINT_OUTPUT="$(SVC_HOSTS_DIR="$TMPDIR_HOSTS" node "$LINTER" 2>&1)"
LINT_EXIT=$?
set -e

if [ "$LINT_EXIT" -eq 0 ]; then
  echo "FAIL: meta-rule did NOT reject the synthetic violation"
  echo "(linter exited 0 with claude.json missing _shared in infra_dirs)"
  echo "--- linter output ---"
  echo "$LINT_OUTPUT"
  exit 1
fi

# Assert the error message names both _shared and claude
if ! echo "$LINT_OUTPUT" | grep -q "_shared"; then
  echo "FAIL: linter error did not mention '_shared'"
  echo "$LINT_OUTPUT"
  exit 1
fi
if ! echo "$LINT_OUTPUT" | grep -q "claude"; then
  echo "FAIL: linter error did not mention 'claude' host"
  echo "$LINT_OUTPUT"
  exit 1
fi

echo "PASS: meta-rule correctly rejected synthetic violation (exit=$LINT_EXIT, names _shared + claude)"
exit 0
