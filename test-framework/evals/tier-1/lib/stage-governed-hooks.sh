#!/usr/bin/env bash
# Stage the full governed bash hook surface (MATERIALIZE_REGISTRY runner=bash
# entries) into a fixture source checkout as owner-executable files.
#
# scripts/svc-migrate-install.mjs assertBashHooksExecutable() refuses to
# materialize unless EVERY governed bash adapter (shared + kimi + cursor +
# grok) exists owner-executable in the source root. Fixtures that stage only
# the claude hook fail with SVC-ENFORCE-HOOK-MODE (WI-558).
#
# Usage: stage_governed_bash_hooks <fixture-root>
stage_governed_bash_hooks() {
  local src="$1"
  mkdir -p "$src/hooks/kimi" "$src/hooks/cursor" "$src/hooks/grok"
  cp "$STAGE_HOOKS_REPO/hooks/svc-task-completion-guard.sh" "$src/hooks/"
  cp "$STAGE_HOOKS_REPO/hooks/kimi/svc-kimi-task-completion-guard.sh" "$src/hooks/kimi/"
  cp "$STAGE_HOOKS_REPO/hooks/cursor/svc-cursor-task-completion-guard.sh" "$src/hooks/cursor/"
  cp "$STAGE_HOOKS_REPO/hooks/grok/svc-grok-task-completion-guard.sh" "$src/hooks/grok/"
  chmod 755 "$src/hooks/svc-task-completion-guard.sh" \
            "$src/hooks/kimi/svc-kimi-task-completion-guard.sh" \
            "$src/hooks/cursor/svc-cursor-task-completion-guard.sh" \
            "$src/hooks/grok/svc-grok-task-completion-guard.sh"
}
