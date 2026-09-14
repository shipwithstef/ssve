#!/usr/bin/env bash
# Probe: is codex CLI available + smoke-runnable?
command -v codex >/dev/null 2>&1 || exit 1
codex --help >/dev/null 2>&1 || exit 1
exit 0
