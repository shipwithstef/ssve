#!/usr/bin/env bash
# Probe: is agy CLI available + smoke-runnable?
command -v agy >/dev/null 2>&1 || exit 1
agy --version >/dev/null 2>&1 || agy --help >/dev/null 2>&1 || exit 1
exit 0
