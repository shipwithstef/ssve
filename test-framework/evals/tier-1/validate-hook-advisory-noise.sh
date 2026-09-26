#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
node --test "$ROOT/test-framework/tests/hook-advisory-noise.test.mjs"
