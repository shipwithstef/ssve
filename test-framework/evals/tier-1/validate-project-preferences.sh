#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
node --check scripts/project-preferences.mjs
node --test test-framework/tests/project-preferences.test.mjs
