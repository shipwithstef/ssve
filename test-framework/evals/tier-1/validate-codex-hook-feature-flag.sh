#!/usr/bin/env bash
# Tier 1: Codex hook setup must use the current hooks feature flag and prune duplicate hooks.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
FAIL=0

fail() {
  echo "  FAIL: $1"
  FAIL=$((FAIL + 1))
}

ACTIVE_PATHS=(
  "$REPO_ROOT/provision/hosts/codex.json"
  "$REPO_ROOT/references/host-capabilities.md"
  "$REPO_ROOT/references/knowledge/INDEX.md"
  "$REPO_ROOT/references/knowledge/domains/agent-harnesses/details/codex.md"
  "$REPO_ROOT/references/knowledge/domains/agent-harnesses/tools.md"
  "$REPO_ROOT/references/knowledge/domains/codex-hooks/CAPABILITIES.md"
  "$REPO_ROOT/references/knowledge/domains/codex-hooks/details/configuration.md"
)

for path in "${ACTIVE_PATHS[@]}"; do
  if grep -Fq "codex_hooks" "$path"; then
    fail "deprecated codex_hooks reference remains in ${path#$REPO_ROOT/}"
  fi
done

if grep -Fq "codex_hooks = true" "$REPO_ROOT/scripts/wire-codex-hooks.mjs"; then
  fail "Codex wirer still writes deprecated codex_hooks = true"
fi

if ! grep -Fq "svc-codex-stop-firewall.mjs" "$REPO_ROOT/scripts/wire-codex-hooks.mjs"; then
  fail "Codex wirer does not declare the composite Stop firewall"
fi
if node "$REPO_ROOT/scripts/wire-codex-hooks.mjs" --skills-path "$REPO_ROOT" --list-all | grep -Fq "svc-kimi-skill-load-enforcer.sh"; then
  fail "Codex active registry still delegates skill loading to the Kimi-only script"
fi
if ! grep -Fq "effective-single-stop" "$REPO_ROOT/references/codex-hook-execution-integrity.md"; then
  fail "Codex integrity reference does not separate effective hook state"
fi

if [ -f "$REPO_ROOT/.codex/hooks.json" ]; then
  fail "repo-local .codex/hooks.json should not be tracked; user-level ~/.codex/hooks.json is the setup target"
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# Materialize the minimum secure launcher shape the wirer probes. The test does
# not execute this stub; it proves the effective composite command is routed
# through the launcher when one is available.
mkdir -p "$TMP_DIR/.svc/enforcement/1/bin"
printf '#!/bin/sh\nexit 0\n' > "$TMP_DIR/.svc/enforcement/1/bin/svc-enforce"
chmod 700 "$TMP_DIR/.svc" "$TMP_DIR/.svc/enforcement" "$TMP_DIR/.svc/enforcement/1" "$TMP_DIR/.svc/enforcement/1/bin" "$TMP_DIR/.svc/enforcement/1/bin/svc-enforce"

CONFIG="$TMP_DIR/config.toml"
HOOKS="$TMP_DIR/hooks.json"

cat >"$CONFIG" <<'TOML'
model = "gpt-5.5"

[features]
codex_hooks = true
memories = true

[mcp_servers.playwright]
command = "npx"
TOML

HOME="$TMP_DIR" node "$REPO_ROOT/scripts/wire-codex-hooks.mjs" \
  --skills-path "$REPO_ROOT" \
  --hooks-file "$HOOKS" \
  --config "$CONFIG" >/dev/null

if ! node - "$HOOKS" <<'NODE'
const fs = require("fs");
const j = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const commands = (j.hooks?.PreToolUse || []).flatMap((entry) => entry.hooks || []).map((hook) => hook.command || "");
process.exit(commands.length === 1 && commands[0].includes("svc-enforce") && commands[0].includes("svc-codex-pretool-dispatcher") ? 0 : 1);
NODE
then
  fail "effective Codex composite dispatcher is not routed through the durable launcher"
fi

if ! grep -Fq "hooks = true" "$CONFIG"; then
  fail "wirer did not enable [features] hooks = true"
fi
if grep -Fq "codex_hooks" "$CONFIG"; then
  fail "wirer did not remove deprecated codex_hooks from config"
fi

# Codex persists per-hook enablement by exact hooks-file/event/entry/hook
# position. A launcher-routed command is not effective when that exact state is
# disabled. Setup must repair only the managed dispatcher and preserve sibling
# user choices.
node - "$CONFIG" "$HOOKS" <<'NODE'
const fs = require("fs");
const [config, hooks] = process.argv.slice(2);
const managed = `${hooks}:pre_tool_use:0:0`;
const unrelated = `${hooks}:session_start:0:0`;
fs.appendFileSync(config, `\n[hooks.state.${JSON.stringify(managed)}]\nenabled = false\n\n[hooks.state.${JSON.stringify(unrelated)}]\nenabled = false\n`);
NODE

if node --input-type=module - "$REPO_ROOT" "$HOOKS" <<'NODE'
import path from "node:path";
import { pathToFileURL } from "node:url";
const [repo, configPath] = process.argv.slice(2);
const { governedRoutingStatus } = await import(pathToFileURL(path.join(repo, "scripts/lib/governed-routing.mjs")).href);
const status = governedRoutingStatus(configPath, {
  governed: true,
  governed_token: ["svc-enforce", "svc-codex-pretool-dispatcher"],
  effective_state: { type: "codex-hooks-state" },
}, { stateConfigPath: `${configPath}.missing-state` });
process.exit(status.ok ? 0 : 1);
NODE
then
  fail "state-aware governed routing accepted an absent Codex state config"
fi

before_dry_run="$(sha256sum "$CONFIG" | awk '{print $1}')"
dry_output="$(HOME="$TMP_DIR" node "$REPO_ROOT/scripts/wire-codex-hooks.mjs" \
  --skills-path "$REPO_ROOT" --hooks-file "$HOOKS" --config "$CONFIG" --dry-run)"
after_dry_run="$(sha256sum "$CONFIG" | awk '{print $1}')"
if [ "$before_dry_run" != "$after_dry_run" ] || ! grep -Fq "would enable the exact managed dispatcher state" <<<"$dry_output"; then
  fail "Codex wirer dry-run did not report state repair without mutating config"
fi

HOME="$TMP_DIR" node "$REPO_ROOT/scripts/wire-codex-hooks.mjs" \
  --skills-path "$REPO_ROOT" \
  --hooks-file "$HOOKS" \
  --config "$CONFIG" >/dev/null

if ! node --input-type=module - "$REPO_ROOT" "$CONFIG" "$HOOKS" <<'NODE'
import path from "node:path";
import { pathToFileURL } from "node:url";
const [repo, stateConfigPath, configPath] = process.argv.slice(2);
const { governedRoutingStatus } = await import(pathToFileURL(path.join(repo, "scripts/lib/governed-routing.mjs")).href);
const wiring = {
  governed: true,
  governed_token: ["svc-enforce", "svc-codex-pretool-dispatcher"],
  effective_state: { type: "codex-hooks-state" },
};
const status = governedRoutingStatus(configPath, wiring, { stateConfigPath });
if (!status.ok) process.stderr.write(status.reason + "\n");
process.exit(status.ok ? 0 : 1);
NODE
then
  fail "state-aware governed routing did not accept the repaired dispatcher"
fi

managed_enabled="$(awk '/pre_tool_use:0:0/ {managed=1; next} /^\[/ {managed=0} managed && /enabled/ {print $3; exit}' "$CONFIG")"
unrelated_enabled="$(awk '/session_start:0:0/ {managed=1; next} /^\[/ {managed=0} managed && /enabled/ {print $3; exit}' "$CONFIG")"
if [ "$managed_enabled" != "true" ]; then
  fail "setup did not re-enable the exact managed dispatcher state"
fi
if [ "$unrelated_enabled" != "false" ]; then
  fail "setup changed unrelated Codex hook enablement"
fi

duplicates="$(
  node - "$HOOKS" <<'NODE'
const fs = require("fs");
const hooksFile = process.argv[2];
const j = JSON.parse(fs.readFileSync(hooksFile, "utf8"));
let duplicates = 0;
for (const entries of Object.values(j.hooks || {})) {
  const seen = new Set();
  for (const entry of entries || []) {
    for (const hook of entry.hooks || []) {
      const identity = `${entry.matcher}\t${hook.command || ""}`;
      if (seen.has(identity)) duplicates += 1;
      seen.add(identity);
    }
  }
}
process.stdout.write(String(duplicates));
NODE
)"

if [ "$duplicates" != "0" ]; then
  fail "Codex wirer is not idempotent; duplicate hook entries found: $duplicates"
fi

if [[ $FAIL -gt 0 ]]; then
  echo "=== Tier 1: Codex Hook Feature Flag ==="
  echo "  FAIL — $FAIL checks failed"
  exit 1
fi

echo "=== Tier 1: Codex Hook Feature Flag ==="
echo "  PASS — Codex hooks use current feature flag and idempotent setup"
