#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/scripts" "$TMP/docs/specs" "$TMP/.svc"
cp "$ROOT/scripts/build-spec-index.mjs" "$ROOT/scripts/state-io.mjs" "$TMP/scripts/"
# WI-562: state-io imports the shared liveness lib — copy the dependency.
mkdir -p "$TMP/hooks/lib" && cp "$ROOT/hooks/lib/process-liveness.mjs" "$TMP/hooks/lib/"
printf '# Example\n\n## Stable section\n\nContent.\n' > "$TMP/docs/specs/example.md"

(
  cd "$TMP"
  node scripts/build-spec-index.mjs >/dev/null
  touch -d '2001-01-01T00:00:00Z' docs/specs/example.md
  node scripts/build-spec-index.mjs --check >/dev/null
  printf '\nChanged.\n' >> docs/specs/example.md
  if node scripts/build-spec-index.mjs --check >/dev/null 2>&1; then
    echo 'FAIL: content mutation passed freshness check' >&2
    exit 1
  fi
)

echo 'PASS: spec index freshness is content-bound and checkout-hermetic'
