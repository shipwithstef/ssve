#!/usr/bin/env bash
# Tier-1: validate canonical svc gates are wired across hook-capable hosts
# with hook wirers per references/canonical-gates.json. MUST gates HARD FAIL;
# MAY gates SOFT WARN. Hosts with capabilities.hooks=false must be explicitly
# classified as skills-only and must not appear in hook gate coverage.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
GATES="$REPO_ROOT/references/canonical-gates.json"
HOST_MANIFEST_DIR="$REPO_ROOT/provision/hosts"

if [ ! -f "$GATES" ]; then
  echo "FAIL: missing $GATES" >&2
  exit 1
fi

HOST_TO_FILE_claude="$REPO_ROOT/scripts/wire-hooks.mjs"
HOST_TO_FILE_kimi="$REPO_ROOT/scripts/wire-kimi-hooks.mjs"
HOST_TO_FILE_codex="$REPO_ROOT/scripts/wire-codex-hooks.mjs"
HOST_TO_FILE_gemini="$REPO_ROOT/scripts/wire-gemini-hooks.mjs"
HOST_TO_FILE_opencode="$REPO_ROOT/scripts/wire-opencode-hooks.mjs"
HOST_TO_FILE_cursor="$REPO_ROOT/scripts/wire-cursor-hooks.mjs"
HOST_TO_FILE_grok="$REPO_ROOT/scripts/wire-grok-hooks.mjs"

PASS=0; FAIL=0; WARN=0

fail() {
  echo "  ✗ $1"
  FAIL=$((FAIL+1))
}

pass() {
  echo "  ✓ $1"
  PASS=$((PASS+1))
}

warn() {
  echo "  ! $1"
  WARN=$((WARN+1))
}

mapfile -t no_hook_hosts < <(
  node - "$HOST_MANIFEST_DIR" <<'NODE'
const fs = require("fs");
const path = require("path");
const dir = process.argv[2];
for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".json")).sort()) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  if (manifest.capabilities?.hooks === false) {
    console.log(manifest.host || path.basename(file, ".json"));
  }
}
NODE
)

skills_only_check=$(
  node - "$GATES" "${no_hook_hosts[@]}" <<'NODE'
const fs = require("fs");
const gatesPath = process.argv[2];
const noHookHosts = process.argv.slice(3);
const canonical = JSON.parse(fs.readFileSync(gatesPath, "utf8"));
const skillsOnly = canonical.skills_only_hosts || {};
const hookHosts = new Set(canonical.hook_enforcement_hosts || []);
const covered = new Map();

for (const host of noHookHosts) {
  if (!skillsOnly[host]) {
    console.log(`FAIL\t${host}\tmissing skills_only_hosts entry`);
  } else {
    console.log(`PASS\t${host}\tclassified as skills-only`);
  }
  if (hookHosts.has(host)) {
    console.log(`FAIL\t${host}\tpresent in hook_enforcement_hosts despite capabilities.hooks=false`);
  }
}

for (const gate of canonical.gates || []) {
  for (const kind of ["must_hosts", "may_hosts"]) {
    for (const host of gate[kind] || []) {
      if (!covered.has(host)) covered.set(host, []);
      covered.get(host).push(`${gate.id}/${kind}`);
    }
  }
}

for (const host of noHookHosts) {
  const hits = covered.get(host) || [];
  if (hits.length > 0) {
    console.log(`FAIL\t${host}\tappears in hook gate coverage: ${hits.join(", ")}`);
  }
}
NODE
)

while IFS=$'\t' read -r status host message; do
  [ -z "$status" ] && continue
  if [ "$status" = "PASS" ]; then
    pass "skills-only host $host: $message"
  else
    fail "skills-only host $host: $message"
  fi
done <<< "$skills_only_check"

# Use node to iterate gates and produce checks
checks=$(node -e "
const j = JSON.parse(require('fs').readFileSync('$GATES','utf8'));
for (const g of j.gates) {
  for (const host of g.must_hosts || []) {
    const pat = (g.host_id_patterns||{})[host] || '';
    console.log('MUST\t'+g.id+'\t'+host+'\t'+pat);
  }
  for (const host of g.may_hosts || []) {
    const pat = (g.host_id_patterns||{})[host] || '';
    if (pat) console.log('MAY\t'+g.id+'\t'+host+'\t'+pat);
  }
}
")

while IFS=$'\t' read -r kind gate host pattern; do
  [ -z "$kind" ] && continue
  case "$host" in
    claude) wire="$HOST_TO_FILE_claude" ;;
    kimi)   wire="$HOST_TO_FILE_kimi" ;;
    codex)  wire="$HOST_TO_FILE_codex" ;;
    gemini) wire="$HOST_TO_FILE_gemini" ;;
    opencode) wire="$HOST_TO_FILE_opencode" ;;
    cursor) wire="$HOST_TO_FILE_cursor" ;;
    grok)   wire="$HOST_TO_FILE_grok" ;;
    *) continue ;;
  esac
  if [ ! -f "$wire" ]; then
    if [ "$kind" = "MUST" ]; then
      fail "MUST gate $gate × $host: wire script $wire missing"
    else
      warn "MAY gate $gate × $host: wire script $wire missing"
    fi
    continue
  fi
  if [ -z "$pattern" ]; then
    if [ "$kind" = "MUST" ]; then
      fail "MUST gate $gate × $host: no host_id_pattern declared"
    else
      warn "MAY gate $gate × $host: no host_id_pattern declared"
    fi
    continue
  fi
  if [[ "$host" == "claude" && "$gate" == "block-no-verify" ]]; then
    if node --input-type=module - "$REPO_ROOT" <<'JS'
import fs from 'node:fs';import {execFileSync} from 'node:child_process';import path from 'node:path';
const root=process.argv[2];
const raw=execFileSync(process.execPath,[path.join(root,'scripts/wire-hooks.mjs'),'--skills-path',root,'--list-all'],{encoding:'utf8'});
const config=JSON.parse(raw.slice(raw.indexOf('{')));
const dispatcher='hooks/codex/svc-codex-pretool-dispatcher.mjs';
if(!config.hooks.PreToolUse.some(e=>e.matcher.split('|').includes('Bash') && e.hooks.some(h=>h.command.includes(dispatcher)))) process.exit(1);
const source=fs.readFileSync(path.join(root,dispatcher),'utf8');
if(!source.includes('["svc-workflow-guard.mjs","--bash-guard"]')) process.exit(1);
JS
    then pass "MUST gate $gate × $host: emitted Bash dispatcher routes bash guard"
    else fail "MUST gate $gate × $host: consolidated route missing"
    fi
    continue
  fi
  if grep -q -F "$pattern" "$wire"; then
    pass "$kind gate $gate × $host (pattern: $pattern)"
  else
    if [ "$kind" = "MUST" ]; then
      fail "MUST gate $gate × $host: pattern '$pattern' not found in $(basename "$wire")"
    else
      warn "MAY gate $gate × $host: pattern '$pattern' not found in $(basename "$wire")"
    fi
  fi
done <<< "$checks"

# WI-SSVE-ARCHITECTURE-EVOLUTION-02 E4: capability-tier receipt wiring truth
receipt_checks=$(node - "$REPO_ROOT" <<'NODE'
const fs = require("fs");
const path = require("path");
const root = process.argv[2];
const catalog = JSON.parse(fs.readFileSync(path.join(root, "references/host-hook-catalog.json"), "utf8"));
const wirers = {
  claude: "scripts/wire-hooks.mjs",
  cursor: "scripts/wire-cursor-hooks.mjs",
  grok: "scripts/wire-grok-hooks.mjs",
};
const AUTOEMIT = "svc-phase-receipt-autoemit";
for (const [host, cap] of Object.entries(catalog.hosts || {})) {
  const tier = cap.receipts;
  const wirerPath = wirers[host];
  if (!wirerPath) continue;
  const text = fs.readFileSync(path.join(root, wirerPath), "utf8");
  const hasAutoemit = text.includes(AUTOEMIT);
  if (tier === "skills-only" || tier === "none") {
    if (hasAutoemit) console.log(`FAIL\t${host}\tskills-only/none must not wire autoemit`);
    else console.log(`PASS\t${host}\tskills-only correctly omits autoemit`);
  } else if (tier === "auto-edits-only") {
    if (!hasAutoemit) console.log(`FAIL\t${host}\tauto-edits-only must wire autoemit`);
    else if (text.includes("PostToolUse") && text.includes(AUTOEMIT)) console.log(`FAIL\t${host}\tauto-edits-only must not claim PostToolUse autoemit in ${wirerPath}`);
    else console.log(`PASS\t${host}\tauto-edits-only wires edit-surface autoemit only`);
  } else if (tier === "auto-full" || tier === "full") {
    if (!hasAutoemit) console.log(`FAIL\t${host}\tauto-full must wire autoemit`);
    else console.log(`PASS\t${host}\tauto-full wires autoemit`);
  }
}
NODE
)

while IFS=$'\t' read -r status host message; do
  [ -z "$status" ] && continue
  if [ "$status" = PASS ]; then pass "receipts $host: $message"; else fail "receipts $host: $message"; fi
done <<< "$receipt_checks"

echo ""
echo "validate-cross-host-hook-conformance: $PASS passed, $FAIL failed (MUST), $WARN warned (MAY)"
[ "$FAIL" -eq 0 ]
