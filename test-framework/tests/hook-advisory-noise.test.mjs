import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { actualDelegatedCommand } from "../../scripts/lib/governed-routing.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

function temporaryHome(callback) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "svc-hook-noise-"));
  try { return callback(home); }
  finally { fs.rmSync(home, { recursive: true, force: true }); }
}

function runNode(script, args, options = {}) {
  const result = spawnSync(process.execPath, [path.join(root, script), ...args], {
    cwd: root, encoding: "utf8", ...options,
  });
  assert.equal(result.status, 0, result.stderr);
  return result;
}

function hookCount(config, event, name) {
  return (config.hooks[event] || []).flatMap((entry) => entry.hooks || [])
    .filter((hook) => actualDelegatedCommand(hook.command).includes(name)).length;
}

test("Codex wiring reconciles legacy direct hooks once and stays byte stable", () => temporaryHome((home) => {
  const hooks = path.join(home, "hooks.json");
  const config = path.join(home, "config.toml");
  const env = { ...process.env, HOME: home };
  const args = ["--skills-path", root, "--hooks-file", hooks, "--config", config];
  runNode("scripts/wire-codex-hooks.mjs", args, { env });
  const installed = JSON.parse(fs.readFileSync(hooks, "utf8"));
  for (const [event, name] of [
    ["PostToolUse", "svc-codex-posttool-heartbeat.mjs"],
    ["UserPromptSubmit", "svc-codex-owner-recovery.mjs"],
  ]) {
    const index = installed.hooks[event].findIndex((entry) =>
      entry.hooks?.some((hook) => actualDelegatedCommand(hook.command).includes(name)));
    assert.ok(index >= 0);
    const wrapped = installed.hooks[event][index];
    const direct = structuredClone(wrapped);
    direct.hooks[0].command = actualDelegatedCommand(wrapped.hooks[0].command);
    installed.hooks[event].splice(index, 0, direct);
  }
  fs.writeFileSync(hooks, `${JSON.stringify(installed, null, 2)}\n`);
  runNode("scripts/wire-codex-hooks.mjs", args, { env });
  const reconciled = JSON.parse(fs.readFileSync(hooks, "utf8"));
  assert.equal(hookCount(reconciled, "PostToolUse", "svc-codex-posttool-heartbeat.mjs"), 1);
  assert.equal(hookCount(reconciled, "UserPromptSubmit", "svc-codex-owner-recovery.mjs"), 1);
  assert.equal(Object.values(reconciled.hooks).flat().length, 8);
  const before = fs.readFileSync(hooks);
  const inode = fs.statSync(hooks).ino;
  const second = runNode("scripts/wire-codex-hooks.mjs", args, { env });
  assert.match(second.stdout, /All svc hooks already present/);
  assert.equal(hash(fs.readFileSync(hooks)), hash(before));
  assert.equal(fs.statSync(hooks).ino, inode);
}));

function runBoundary(home, output, mode = "advisory", fixtureStderr = "") {
  const fixture = path.join(home, "fixture.mjs");
  fs.writeFileSync(fixture, "process.stdout.write(process.env.SVC_FIXTURE_JSON); process.stderr.write(process.env.SVC_FIXTURE_STDERR || \"\");\n");
  const spec = Buffer.from(JSON.stringify({
    command: `${process.execPath} ${fixture}`, host: "codex", event: "PreToolUse", timeoutMs: 5000,
  })).toString("base64url");
  return runNode("hooks/svc-hook-boundary.mjs", ["svc-test", "--spec", spec], {
    env: { ...process.env, HOME: home, SVC_HOOK_MODE: mode, SVC_FIXTURE_JSON: JSON.stringify(output), SVC_FIXTURE_STDERR: fixtureStderr },
    input: "{}",
  });
}

test("advisory mode quietly retains routine input normalization", () => temporaryHome((home) => {
  const input = { hookSpecificOutput: {
    hookEventName: "PreToolUse", permissionDecision: "allow", updatedInput: { command: "git --no-optional-locks status" },
  } };
  const result = runBoundary(home, input);
  assert.equal(result.stderr, "");
  const observed = JSON.parse(result.stdout);
  assert.equal(observed.hookSpecificOutput?.updatedInput, undefined);
  assert.equal(observed.hookSpecificOutput?.permissionDecision, undefined);
  assert.equal(observed.systemMessage, undefined);
  assert.deepEqual(JSON.parse(runBoundary(home, input, "enforce").stdout), input);
}));

test("advisory recovery stays quiet when its skill-loader substitution is discarded", () => temporaryHome((home) => {
  const input = { systemMessage: "SSVE restored the authorized WI. This call loads its current skill; the original operation has not run. Read the skill output, then retry the original operation.",
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow", updatedInput: { command: "load skill" } } };
  const result = runBoundary(home, input);
  const output = JSON.parse(result.stdout);
  assert.equal(output.hookSpecificOutput?.updatedInput, undefined);
  assert.equal(output.hookSpecificOutput?.additionalContext, undefined);
  assert.equal(output.systemMessage, undefined);
  assert.doesNotMatch(result.stdout, /This call loads its current skill/);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(runBoundary(home, input, "enforce").stdout), input);
}));

test("missing post-tool receipt is quiet for advisory calls and proven reads", () => temporaryHome((home) => {
  const payload = { session_id: "session-quiet-noise", tool_use_id: "call-quiet-noise", tool_name: "Bash",
    tool_input: { command: "echo hello" }, tool_response: { exit_code: 0 } };
  const env = { ...process.env, HOME: home, SVC_CODEX_RUNTIME_DIR: path.join(home, "runtime") };
  const advisory = runNode("hooks/codex/svc-codex-posttool-heartbeat.mjs", [], {
    env: { ...env, SVC_HOOK_MODE: "advisory" }, input: JSON.stringify(payload),
  });
  assert.deepEqual(JSON.parse(advisory.stdout), {});
  assert.equal(advisory.stderr, "");
  const enforce = runNode("hooks/codex/svc-codex-posttool-heartbeat.mjs", [], {
    env: { ...env, SVC_HOOK_MODE: "enforce" }, input: JSON.stringify(payload),
  });
  assert.match(JSON.parse(enforce.stdout).systemMessage, /heartbeat no-op \(receipt_missing\)/);
  const read = runNode("hooks/codex/svc-codex-posttool-heartbeat.mjs", [], {
    env: { ...env, SVC_HOOK_MODE: "enforce" },
    input: JSON.stringify({ ...payload, tool_input: { command: "git status" } }),
  });
  assert.deepEqual(JSON.parse(read.stdout), {});
}));

test("Codex wiring keeps foreign lookalikes and removes stale managed commands", () => temporaryHome((home) => {
  const hooks = path.join(home, "hooks.json");
  const config = path.join(home, "config.toml");
  const env = { ...process.env, HOME: home };
  const args = ["--skills-path", root, "--hooks-file", hooks, "--config", config];
  runNode("scripts/wire-codex-hooks.mjs", args, { env });
  const installed = JSON.parse(fs.readFileSync(hooks, "utf8"));
  const foreign = path.join(home, "foreign");
  fs.mkdirSync(foreign);
  const foreignOwner = `${process.execPath} ${path.join(foreign, "svc-codex-owner-recovery.mjs")}`;
  const foreignStop = `${process.execPath} ${path.join(foreign, "svc-codex-stop-firewall.mjs")}`;
  installed.hooks.UserPromptSubmit.unshift({ matcher: "*", hooks: [{ type: "command", command: foreignOwner }] });
  installed.hooks.UserPromptSubmit.push({ matcher: "*", hooks: [{ type: "command", command: `${process.execPath} ${path.join(root, "hooks/svc-phase-receipt-autoemit.mjs")}` }] });
  installed.hooks.Stop.push({ matcher: "*", hooks: [{ type: "command", command: foreignStop }] });
  fs.writeFileSync(hooks, `${JSON.stringify(installed, null, 2)}\n`);
  runNode("scripts/wire-codex-hooks.mjs", args, { env });
  const current = JSON.parse(fs.readFileSync(hooks, "utf8"));
  const commands = Object.values(current.hooks).flat().flatMap((entry) => entry.hooks?.map((hook) => hook.command) || []);
  assert.ok(commands.includes(foreignOwner));
  assert.ok(commands.includes(foreignStop));
  assert.ok(!commands.some((command) => command.includes("svc-phase-receipt-autoemit.mjs")));
  const before = fs.readFileSync(hooks);
  const inode = fs.statSync(hooks).ino;
  assert.match(runNode("scripts/wire-codex-hooks.mjs", args, { env }).stdout, /All svc hooks already present/);
  assert.equal(hash(fs.readFileSync(hooks)), hash(before));
  assert.equal(fs.statSync(hooks).ino, inode);
}));

test("advisory rewrite preserves independent warning beside the discarded recovery claim", () => temporaryHome((home) => {
  const claim = "SSVE restored the authorized WI. This call loads its current skill; the original operation has not run. Read the skill output, then retry the original operation.";
  const input = { systemMessage: `${claim}\nIndependent warning: source policy is stale.`,
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow", updatedInput: { command: "load skill" }, additionalContext: "Independent context: inspect the policy." } };
  const result = runBoundary(home, input, "advisory", "Independent stderr: keep this diagnostic.\n");
  const output = JSON.parse(result.stdout);
  assert.equal(output.systemMessage, "Independent warning: source policy is stale.");
  assert.match(result.stderr, /Independent stderr: keep this diagnostic/);
  assert.match(output.hookSpecificOutput.additionalContext, /Independent context: inspect the policy/);
  assert.doesNotMatch(output.hookSpecificOutput.additionalContext, /restored|did not load the skill/);
  assert.doesNotMatch(result.stdout, /This call loads its current skill/);
}));

test("Gemini outer deadline uses milliseconds and generated commands parse before install", async () => {
  const { wrapHookEntries, wrapHookCommand } = await import("../../scripts/lib/hook-command.mjs");
  const command = `${process.execPath} ${path.join(root, "hooks/svc-loop-guard.mjs")}`;
  const wrapped = wrapHookEntries({ command, timeout: 10000 }, { skillsPath: root, host: "gemini", event: "BeforeTool", outerTimeout: 30000 });
  assert.equal(wrapped.timeout, 30000);
  const encoded = wrapped.command.match(/--spec ([A-Za-z0-9_-]+)/)?.[1];
  assert.ok(encoded);
  assert.equal(JSON.parse(Buffer.from(encoded, "base64url").toString()).timeoutMs, 20000);
  const health = wrapHookEntries({ command: `${process.execPath} ${path.join(root, "hooks/svc-session-start-healthcheck.mjs")}`, timeout: 10000 },
    { skillsPath: root, host: "gemini", event: "SessionStart", outerTimeout: 30000 });
  assert.equal(health.timeout, 330000);
  assert.throws(() => wrapHookCommand("node $(touch /tmp/should-not-run)", { skillsPath: root, host: "codex", event: "PreToolUse" }), /unsupported managed command/);
  for (const host of ["codex", "claude", "cursor"]) {
    const options = { skillsPath: root, host, event: "PreToolUse" };
    assert.equal(wrapHookEntries({ command }, options).timeout, 30, `${host} ordinary hook has a 30s outer deadline`);
    assert.equal(wrapHookEntries({ command: `${process.execPath} ${path.join(root, "hooks/svc-session-start-healthcheck.mjs")}` }, options).timeout, 330);
    assert.equal(wrapHookEntries({ command: `${process.execPath} ${path.join(root, "hooks/svc-stop-quality.js")}` }, options).timeout, 570);
  }
});

test("boundary deadline includes stdin and termination cleans detached child", async () => {
  const { spawn } = await import("node:child_process");
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "svc-hook-lifetime-"));
  const boundary = path.join(root, "hooks/svc-hook-boundary.mjs");
  const waitClose = (child) => new Promise((resolve, reject) => {
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code, signal) => resolve({ code, signal, stderr }));
  });
  try {
    const idle = path.join(home, "idle.mjs");
    fs.writeFileSync(idle, "setInterval(() => {}, 1000);\n");
    const encode = (timeoutMs) => Buffer.from(JSON.stringify({ command: `${process.execPath} ${idle}`, host: "codex", event: "PreToolUse", timeoutMs })).toString("base64url");
    const stalled = spawn(process.execPath, [boundary, "svc-test", "--spec", encode(200)], {
      cwd: root, env: { ...process.env, HOME: home, SVC_HOOK_MODE: "advisory" }, stdio: ["pipe", "pipe", "pipe"],
    });
    const stalledResult = await waitClose(stalled);
    assert.equal(stalledResult.code, 0);
    assert.match(stalledResult.stderr, /hook payload read timed out/);

    const pidFile = path.join(home, "child.pid");
    const launched = path.join(home, "launched.mjs");
    fs.writeFileSync(launched, `import fs from "node:fs"; fs.writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(() => {}, 1000);\n`);
    const spec = Buffer.from(JSON.stringify({ command: `${process.execPath} ${launched}`, host: "codex", event: "PreToolUse", timeoutMs: 5000 })).toString("base64url");
    const wrapper = spawn(process.execPath, [boundary, "svc-test", "--spec", spec], {
      cwd: root, env: { ...process.env, HOME: home, SVC_HOOK_MODE: "advisory" }, stdio: ["pipe", "pipe", "pipe"],
    });
    const closing = waitClose(wrapper);
    wrapper.stdin.end("{}");
    const limit = Date.now() + 2500;
    while (!fs.existsSync(pidFile) && Date.now() < limit) await new Promise((resolve) => setTimeout(resolve, 20));
    assert.ok(fs.existsSync(pidFile), "child started before signal");
    const pid = Number(fs.readFileSync(pidFile, "utf8"));
    wrapper.kill("SIGTERM");
    const stopped = await closing;
    assert.equal(stopped.code, 143);
    const state = spawnSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8" }).stdout.trim();
    assert.ok(!state || state.startsWith("Z"), `child survived wrapper SIGTERM: ${pid} ${state}`);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
