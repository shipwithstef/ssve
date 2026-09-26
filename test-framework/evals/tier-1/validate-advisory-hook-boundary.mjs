#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveHookMode } from "../../../hooks/lib/hook-policy.mjs";
import { isBlockingPayload, advisoryPayload, parseManagedCommand } from "../../../hooks/svc-hook-boundary.mjs";
import { wrapHookCommand } from "../../../scripts/lib/hook-command.mjs";
import { buildCursorHookEntries, mergeCursorConfig } from "../../../scripts/wire-cursor-hooks.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const home = fs.mkdtempSync(path.join(os.tmpdir(), "svc-advisory-boundary-"));
const spaced = path.join(home, "skills with spaces");
fs.mkdirSync(spaced);
const fixture = path.join(spaced, "fixture.mjs");
fs.writeFileSync(fixture, `
const scenario=process.env.SVC_FIXTURE_SCENARIO;
if(scenario==='exit')process.exit(2);
if(scenario==='exit-text'){process.stdout.write('create the feature worktree, then resume');process.exit(2);}
if(scenario==='exit-json'){process.stdout.write(JSON.stringify({decision:'block',reason:'repair the task graph'}));process.exit(2);}
if(scenario==='timeout'){setInterval(()=>{},1000);}
if(scenario==='grandchild'){
  const {spawn}=await import('node:child_process');
  const fs=await import('node:fs');
  const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
  fs.writeFileSync(process.env.SVC_PID_FILE,String(child.pid));
  setInterval(()=>{},1000);
}
if(scenario==='text'){process.stdout.write('plain hook advice');process.exit(0);}
if(scenario==='large'){
  process.stdout.write('x'.repeat(512*1024));
  process.exitCode=Number(process.env.SVC_FIXTURE_EXIT||0);
}else process.stdout.write(process.env.SVC_FIXTURE_JSON||'{}');
`);
const quote = (value) => `'${String(value).replace(/'/g, "'\\''")}'`;
function run({ payload = {}, scenario = "json", mode, policy, host = "claude", event = "PreToolUse", timeoutMs = 5000, fixtureExit = 0, command, pidFile } = {}) {
  const policyDir = path.join(home, ".svc");
  fs.mkdirSync(policyDir, { recursive: true });
  const policyPath = path.join(policyDir, "hook-policy.json");
  if (policy === undefined) fs.rmSync(policyPath, { force: true });
  else fs.writeFileSync(policyPath, policy);
  const spec = Buffer.from(JSON.stringify({
    command: command || `${quote(process.execPath)} ${quote(fixture)}`,
    host, event, timeoutMs,
  })).toString("base64url");
  const env = { ...process.env, HOME: home, SVC_FIXTURE_SCENARIO: scenario, SVC_FIXTURE_JSON: JSON.stringify(payload), SVC_FIXTURE_EXIT: String(fixtureExit), SVC_PID_FILE: pidFile || "" };
  delete env.SVC_HOOK_MODE;
  if (mode !== undefined) env.SVC_HOOK_MODE = mode;
  return spawnSync(process.execPath, [path.join(repo, "hooks", "svc-hook-boundary.mjs"), "svc-fixture", "--spec", spec], {
    env, input: "{}", encoding: "utf8", timeout: 12000,
  });
}

try {
  assert.equal(resolveHookMode({}, home).mode, "advisory");
  assert.equal(parseManagedCommand("node ~/.kimi/hooks/svc-kimi-branch-guard.sh", { HOME: "/Users/John Doe" }).args[0], "/Users/John Doe/.kimi/hooks/svc-kimi-branch-guard.sh");
  const cursorSkills = path.join(home, "cursor-skills");
  const cursor = mergeCursorConfig({ hooks: { preToolUse: [
    { command: `bash ${cursorSkills}/hooks/svc-custom.sh` },
    { command: `echo ${cursorSkills}/hooks/svc-workflow-guard.mjs` },
  ] } }, buildCursorHookEntries(cursorSkills), cursorSkills);
  assert.equal(cursor.hooks.preToolUse[0].command, `bash ${cursorSkills}/hooks/svc-custom.sh`);
  assert.equal(cursor.hooks.preToolUse[1].command, `echo ${cursorSkills}/hooks/svc-workflow-guard.mjs`);
  assert.equal(isBlockingPayload({ continue: false }), true);
  assert.equal(isBlockingPayload({ decision: "block" }), true);
  assert.equal(isBlockingPayload({ permission: "deny" }), true);
  assert.equal(isBlockingPayload({ hookSpecificOutput: { permissionDecision: "deny" } }), true);
  assert.equal(isBlockingPayload({ updatedInput: { command: "echo hi" } }), false);
  assert.equal(advisoryPayload({ continue: false, updatedInput: { command: "echo hi" } }, "warn").updatedInput, undefined);

  for (const [host, event, payload] of [
    ["claude", "PreToolUse", { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "blocked" } }],
    ["codex", "PreToolUse", { hookSpecificOutput: { permissionDecision: "ask", permissionDecisionReason: "ask" } }],
    ["kimi", "Stop", { decision: "block", reason: "unfinished" }],
    ["gemini", "BeforeTool", { decision: "deny", reason: "blocked" }],
    ["cursor", "beforeShellExecution", { permission: "deny", user_message: "blocked" }],
    ["grok", "Stop", { continue: false, stopReason: "unfinished" }],
  ]) {
    const result = run({ host, event, payload });
    assert.equal(result.status, 0, `${host}/${event}: ${result.stderr}`);
    assert.match(result.stderr, /svc advisory/);
    assert.equal(isBlockingPayload(JSON.parse(result.stdout)), false, `${host}/${event} remained blocking`);
  }
  const success = { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow", additionalContext: "useful" } };
  assert.deepEqual(JSON.parse(run({ payload: success }).stdout), { hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: "useful" } });
  for (const rewrite of [
    { hookSpecificOutput: { permissionDecision: "allow", updatedInput: { command: "skill loader" } } },
    { permission: "allow", updated_input: { command: "skill loader" } },
  ]) {
    const result = run({ payload: rewrite });
    assert.equal(result.status, 0);
    assert.match(result.stderr, /original input retained/);
    const out = JSON.parse(result.stdout);
    assert.equal(out.updated_input, undefined);
    assert.equal(out.hookSpecificOutput?.updatedInput, undefined);
    assert.equal(out.permission, undefined);
    assert.equal(out.hookSpecificOutput?.permissionDecision, undefined);
  }
  const strict = run({ payload: { decision: "block", reason: "strict" }, mode: "enforce" });
  assert.equal(strict.status, 0);
  assert.deepEqual(JSON.parse(strict.stdout), { decision: "block", reason: "strict" });
  assert.equal(run({ scenario: "exit" }).status, 0);
  assert.equal(run({ scenario: "exit", mode: "enforce" }).status, 2);
  const kimiAdvice = run({ scenario: "exit-text", host: "kimi", event: "BeforeTool" });
  assert.equal(kimiAdvice.status, 0);
  assert.match(kimiAdvice.stderr, /create the feature worktree, then resume/);
  const jsonAdvice = run({ scenario: "exit-json" });
  assert.equal(jsonAdvice.status, 0);
  assert.equal(jsonAdvice.stdout, "");
  assert.match(jsonAdvice.stderr, /repair the task graph/);
  assert.equal(run({ scenario: "text", event: "SessionStart" }).stdout, "plain hook advice");
  for (const [name, event] of [["svc-session-start-healthcheck.mjs", "SessionStart"], ["svc-stop-quality.js", "Stop"]]) {
    const expensive = path.join(spaced, name);
    fs.writeFileSync(expensive, "process.stdout.write('expensive child ran');\n");
    const command = `${quote(process.execPath)} ${quote(expensive)}`;
    const deferred = run({ event, command });
    assert.equal(deferred.status, 0, deferred.stderr);
    assert.equal(deferred.stdout, "");
    assert.match(deferred.stderr, /deferred/);
    const enforced = run({ event, command, mode: "enforce" });
    assert.equal(enforced.status, 0, enforced.stderr);
    assert.equal(enforced.stdout, "expensive child ran");
  }
  assert.equal(JSON.parse(run({ scenario: "text", host: "gemini", event: "SessionStart" }).stdout).systemMessage, "plain hook advice");
  for (const [mode, fixtureExit, expectedExit] of [["enforce", 0, 0], ["enforce", 2, 2], [undefined, 0, 0]]) {
    const result = run({ scenario: "large", event: "SessionStart", mode, fixtureExit });
    assert.equal(result.status, expectedExit, result.stderr);
    assert.equal(result.stdout, "x".repeat(512 * 1024));
  }
  const timed = run({ scenario: "timeout", timeoutMs: 200 });
  assert.equal(timed.status, 0);
  assert.match(timed.stderr, /timed out/);
  assert.equal(run({ scenario: "timeout", timeoutMs: 200, mode: "enforce" }).status, 2);
  const pidFile = path.join(home, "grandchild.pid");
  const tree = run({ scenario: "grandchild", timeoutMs: 1500, pidFile });
  assert.equal(tree.status, 0, tree.stderr);
  assert.match(tree.stderr, /timed out/);
  const grandchildPid = Number(fs.readFileSync(pidFile, "utf8"));
  const state = spawnSync("ps", ["-o", "stat=", "-p", String(grandchildPid)], { encoding: "utf8" }).stdout.trim();
  assert.ok(!state || state.startsWith("Z"), `grandchild survived boundary timeout: ${grandchildPid} ${state}`);
  assert.equal(run({ payload: { decision: "deny" }, policy: '{"mode":"enforce"}' }).stdout.trim(), '{"decision":"deny"}');
  assert.match(run({ payload: { decision: "deny" }, policy: '{bad' }).stderr, /invalid .*hook-policy/);
  assert.match(run({ payload: { decision: "deny" }, mode: "bogus" }).stderr, /invalid SVC_HOOK_MODE/);

  const savedHome = process.env.HOME;
  process.env.HOME = home;
  const wrapped = wrapHookCommand(`node ${quote(fixture)}`, { skillsPath: spaced, host: "claude", event: "PreToolUse" });
  process.env.HOME = savedHome;
  assert.match(wrapped, /svc-hook-boundary\.mjs/);
  assert.match(JSON.parse(Buffer.from(wrapped.match(/--spec ([A-Za-z0-9_-]+)/)[1], "base64url").toString()).command, /skills with spaces/);
  fs.symlinkSync(path.join(repo, "hooks"), path.join(spaced, "hooks"), "dir");
  const spacedSpec = Buffer.from(JSON.stringify({ command: `${quote(process.execPath)} ${quote(fixture)}`, host: "claude", event: "PreToolUse", timeoutMs: 5000 })).toString("base64url");
  const spacedRun = spawnSync(process.execPath, [path.join(spaced, "hooks", "svc-hook-boundary.mjs"), "svc-fixture", "--spec", spacedSpec], {
    env: { ...process.env, HOME: home, SVC_FIXTURE_JSON: '{"decision":"deny"}' }, input: "{}", encoding: "utf8",
  });
  assert.equal(spacedRun.status, 0);
  assert.match(spacedRun.stderr, /svc advisory/);
  const customNode = path.join(spaced, "custom-node-runner");
  fs.symlinkSync(process.execPath, customNode);
  const customSpec = Buffer.from(JSON.stringify({ command: `${quote(customNode)} ${quote(fixture)}`, host: "claude", event: "PreToolUse", timeoutMs: 5000 })).toString("base64url");
  const customRun = spawnSync(process.execPath, [path.join(repo, "hooks", "svc-hook-boundary.mjs"), "svc-fixture", "--spec", customSpec], {
    env: { ...process.env, HOME: home, SVC_FIXTURE_JSON: '{"decision":"deny"}' }, input: "{}", encoding: "utf8",
  });
  assert.equal(customRun.status, 0);
  assert.match(customRun.stderr, /svc advisory/);
  console.log("PASS advisory hook boundary: default, strict, protocols, policy, failure, timeout, spaces");
} finally {
  fs.rmSync(home, { recursive: true, force: true });
}
