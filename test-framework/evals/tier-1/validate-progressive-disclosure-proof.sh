#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

echo "=== Tier 1: Progressive Disclosure Proof ==="
node --check "$ROOT/scripts/validate-progressive-disclosure-proof.mjs"
node "$ROOT/scripts/validate-progressive-disclosure-proof.mjs" --root "$ROOT"
