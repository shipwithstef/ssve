#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
TMP=$(mktemp -d)
trap 'node -e "require(\"fs\").rmSync(process.argv[1],{recursive:true,force:true})" "$TMP"' EXIT
mkdir -m 700 "$TMP/runtime"
SVC_AUTHORITY_STATE_ROOT="$TMP/auth" SVC_CODEX_RUNTIME_DIR="$TMP/runtime" ROOT="$ROOT" node --input-type=module <<'NODE'
import fs from "node:fs";
import { bootstrapController, takeoverController, readController, principalId } from "./hooks/lib/authority-store.mjs";
import { createBootstrapHandoff, inspectBootstrapHandoff, consumeBootstrapHandoff } from "./hooks/codex/lib/session-handoff.mjs";
const root = process.env.ROOT;
const env = process.env;
const oldPrincipal = principalId({ host: "codex", session_id: "sess-old-12345678" });
const newPrincipal = principalId({ host: "codex", session_id: "sess-new-12345678" });
const first = bootstrapController({ stateRoot: env.SVC_AUTHORITY_STATE_ROOT, repoId: "repo-test", wi: "WI-999", worktreeRoot: root, principal: oldPrincipal });
const transferred = takeoverController({ stateRoot: env.SVC_AUTHORITY_STATE_ROOT, repoId: "repo-test", wi: "WI-999", worktreeRoot: root, principal: newPrincipal, expectedPrincipal: oldPrincipal, expectedGeneration: first.generation, reason: "explicit owner takeover" });
if (transferred.lease.generation !== 2 || readController({ stateRoot: env.SVC_AUTHORITY_STATE_ROOT, repoId: "repo-test", wi: "WI-999" }).controller_principal !== newPrincipal) throw new Error("takeover CAS failed");
const handoff = createBootstrapHandoff({ session_id: "sess-new-12345678", host: "grok", repo_root: root, wi: "WI-998", branch: "framework-WI-998", base: "a".repeat(40), env });
if ((fs.statSync(handoff.file).mode & 0o777) !== 0o600) throw new Error("handoff mode");
inspectBootstrapHandoff(handoff.nonce, { session_id: "sess-new-12345678", host: "grok", repo_root: root, wi: "WI-998", branch: "framework-WI-998", base: "a".repeat(40) }, { env });
consumeBootstrapHandoff(handoff.nonce, { session_id: "sess-new-12345678", host: "grok", wi: "WI-998", branch: "framework-WI-998", base: "a".repeat(40) }, { env });
let replayDenied = false;
try { consumeBootstrapHandoff(handoff.nonce, { session_id: "sess-new-12345678" }, { env }); } catch { replayDenied = true; }
if (!replayDenied) throw new Error("handoff replay accepted");
const hostBound = createBootstrapHandoff({ session_id: "sess-new-12345678", host: "grok", repo_root: root, wi: "WI-997", branch: "framework-WI-997", base: "b".repeat(40), env });
let hostDenied = false;
try { inspectBootstrapHandoff(hostBound.nonce, { session_id: "sess-new-12345678", host: "codex", repo_root: root, wi: "WI-997", branch: "framework-WI-997", base: "b".repeat(40) }, { env }); } catch { hostDenied = true; }
if (!hostDenied || !fs.existsSync(hostBound.file)) throw new Error("host mismatch consumed or accepted handoff");
let baseDenied = false;
try { consumeBootstrapHandoff(hostBound.nonce, { session_id: "sess-new-12345678", host: "grok", repo_root: root, wi: "WI-997", branch: "framework-WI-997", base: "c".repeat(40) }, { env }); } catch { baseDenied = true; }
if (!baseDenied || !fs.existsSync(hostBound.file)) throw new Error("base mismatch consumed or accepted handoff");
consumeBootstrapHandoff(hostBound.nonce, { session_id: "sess-new-12345678", host: "grok", repo_root: root, wi: "WI-997", branch: "framework-WI-997", base: "b".repeat(40) }, { env });
console.log("codex session rebinding: takeover CAS PASS; old session remains alive; handoff mode/one-use/replay PASS");
NODE

node --check "$ROOT/hooks/codex/svc-codex-pretool-dispatcher.mjs"
node --check "$ROOT/hooks/codex/svc-codex-owner-recovery.mjs"
mkdir -p "$TMP/home/.svc/enforcement/1/bin"
printf '#!/bin/sh\nexit 0\n' > "$TMP/home/.svc/enforcement/1/bin/svc-enforce"
chmod 700 "$TMP/home" "$TMP/home/.svc" "$TMP/home/.svc/enforcement" \
  "$TMP/home/.svc/enforcement/1" "$TMP/home/.svc/enforcement/1/bin" \
  "$TMP/home/.svc/enforcement/1/bin/svc-enforce"
HOME="$TMP/home" node "$ROOT/scripts/wire-codex-hooks.mjs" --skills-path "$ROOT" --list-all > "$TMP/hooks.json"
ROOT="$ROOT" HOOKS_JSON="$TMP/hooks.json" node --input-type=module <<'NODE'
import fs from "node:fs";
const rendered = fs.readFileSync(process.env.HOOKS_JSON, "utf8");
const hooks = JSON.parse(rendered.slice(rendered.indexOf("{")));
const commands = (hooks.hooks?.PreToolUse || []).flatMap((entry) => entry.hooks || []).map((hook) => hook.command || "");
const governed = commands.filter((command) => command.includes("svc-codex-pretool-dispatcher"));
if (governed.length !== 1 || !governed[0].includes("svc-enforce") || governed[0].includes("dispatcher.mjs")) {
  throw new Error(`expected one launcher-backed Codex dispatcher, got ${JSON.stringify(governed)}`);
}
const source = fs.readFileSync(`${process.env.ROOT}/hooks/codex/svc-codex-pretool-dispatcher.mjs`, "utf8");
const match = source.match(/const CHILDREN = (\[[^;]+\]);/);
if (!match) throw new Error("dispatcher CHILDREN declaration is not statically inspectable");
const actual = JSON.parse(match[1]);
const expected = [["svc-worktree-isolation-guard.mjs"],["svc-workflow-guard.mjs","--bash-guard"],["svc-workflow-guard.mjs"],["svc-loop-guard.mjs"],["svc-skill-artifact-authenticity.mjs"],["svc-session-contract-freshness.mjs"],["svc-inertia-check.mjs"],["codex","svc-codex-skill-load-enforcer.mjs"],["svc-impact-triad-guard.mjs"]];
if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("dispatcher child set/order drifted");
if (actual.filter((spec) => spec.includes("svc-codex-skill-load-enforcer.mjs")).length !== 1) {
  throw new Error("skill-load enforcer must occur exactly once");
}
NODE
echo "codex session rebinding focused checks: PASS"

mkdir -p "$TMP/home/.codex"
cat > "$TMP/home/.codex/hooks.json" <<JSON
{"hooks":{"PreToolUse":[{"matcher":"Bash","hooks":[{"type":"command","command":"node $ROOT/hooks/svc-impact-triad-guard.mjs"}]}]}}
JSON
printf '[features]\nhooks = true\n' > "$TMP/home/.codex/config.toml"
HOME="$TMP/home" node "$ROOT/scripts/wire-codex-hooks.mjs" --skills-path "$ROOT/skills" >/dev/null
node -e '
const hooks=require(process.argv[1]).hooks?.PreToolUse||[];
const commands=hooks.flatMap((entry)=>entry.hooks||[]).map((hook)=>hook.command||"");
if(commands.length!==1||!commands[0].includes("svc-codex-pretool-dispatcher")||commands[0].includes("svc-impact-triad-guard"))process.exit(1);
' "$TMP/home/.codex/hooks.json"
echo "legacy direct impact-triad hook is pruned behind the single dispatcher: PASS"

SESSION=sess-owner-12345678
OWNER_ENV="SVC_CODEX_RUNTIME_DIR=$TMP/runtime CODEX_THREAD_ID=$SESSION"
OVERRIDE_PAYLOAD="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],cwd:process.argv[2],prompt:"SVC OWNER OVERRIDE: work on WI-999\nContinue with the bounded hatch."}))' "$SESSION" "$ROOT")"
OVERRIDE_OUT="$(printf '%s' "$OVERRIDE_PAYLOAD" | SVC_CODEX_RUNTIME_DIR="$TMP/runtime" CODEX_THREAD_ID="$SESSION" node "$ROOT/hooks/codex/svc-codex-owner-recovery.mjs")"
printf '%s' "$OVERRIDE_OUT" | grep -q 'armed for 24 hours'
eval "$OWNER_ENV node \"$ROOT/scripts/svc-owner-recovery.mjs\" status --repo \"$ROOT\"" | grep -q 'work on WI-999'
eval "$OWNER_ENV node \"$ROOT/scripts/svc-owner-recovery.mjs\" disarm --repo \"$ROOT\"" | grep -q 'true'
echo "multiline owner prompt arms from its first line: PASS"
eval "$OWNER_ENV node \"$ROOT/scripts/svc-owner-recovery.mjs\" arm --repo \"$ROOT\" --worktree \"$ROOT\" --wi WI-999 --reason focused-recovery --ttl-min 1" >/dev/null
eval "$OWNER_ENV node \"$ROOT/scripts/svc-owner-recovery.mjs\" status --repo \"$ROOT\"" | grep -q 'focused-recovery'
printf '%s' "{\"session_id\":\"$SESSION\",\"cwd\":\"$ROOT\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"touch outside-recovery.txt\"}}" |
  SVC_HOST=codex SVC_CODEX_RUNTIME_DIR="$TMP/runtime" CODEX_THREAD_ID="$SESSION" node "$ROOT/hooks/codex/svc-codex-pretool-dispatcher.mjs" | grep -q '{}'
DIRECT_ISOLATION="$(printf '%s' "{\"session_id\":\"$SESSION\",\"cwd\":\"$ROOT\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"touch outside-recovery.txt\"}}" |
  SVC_CODEX_RUNTIME_DIR="$TMP/runtime" CODEX_THREAD_ID="$SESSION" node "$ROOT/hooks/svc-worktree-isolation-guard.mjs")"
test -z "$DIRECT_ISOLATION"
DIRECT_GROK_ISOLATION="$(printf '%s' "{\"session_id\":\"$SESSION\",\"cwd\":\"$ROOT\",\"tool_name\":\"run_terminal_command\",\"tool_input\":{\"command\":\"touch outside-recovery.txt\"}}" |
  SVC_HOST=grok SVC_CODEX_RUNTIME_DIR="$TMP/runtime" GROK_SESSION_ID="$SESSION" node "$ROOT/hooks/svc-worktree-isolation-guard.mjs")"
test -z "$DIRECT_GROK_ISOLATION"
echo "Grok run_terminal_command is shell-classified and accepts only the exact owner lease: PASS"
echo "owner recovery also bypasses a stale direct isolation hook: PASS"
eval "$OWNER_ENV node \"$ROOT/scripts/svc-owner-recovery.mjs\" disarm --repo \"$ROOT\"" | grep -q 'true'
echo "owner prompt/out-of-band lease arm/status/disarm and bounded bypass: PASS"
