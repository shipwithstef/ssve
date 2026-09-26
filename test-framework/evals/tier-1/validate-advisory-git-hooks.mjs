#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { slotTimeoutMs } from "../../../scripts/git-hook-slot.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "svc-git-advisory-"));
const home = path.join(root, "home");
const project = path.join(root, "project");
fs.mkdirSync(home);
fs.mkdirSync(project);
const writeSlot = (name, body) => {
  const file = path.join(project, "hooks", "git", "pre-commit.d", name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  return file;
};
const run = (cmd, args, env = {}) => spawnSync(cmd, args, { cwd: project, env: { ...process.env, HOME: home, ...env }, encoding: "utf8" });
try {
  execFileSync("git", ["init", "-q", project]);
  fs.mkdirSync(path.join(project, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(project, "hooks", "lib"), { recursive: true });
  fs.copyFileSync(path.join(repo, "scripts", "install-git-hooks.mjs"), path.join(project, "scripts", "install-git-hooks.mjs"));
  fs.copyFileSync(path.join(repo, "scripts", "hook-mode.mjs"), path.join(project, "scripts", "hook-mode.mjs"));
  fs.copyFileSync(path.join(repo, "scripts", "git-hook-slot.mjs"), path.join(project, "scripts", "git-hook-slot.mjs"));
  fs.copyFileSync(path.join(repo, "hooks", "lib", "hook-policy.mjs"), path.join(project, "hooks", "lib", "hook-policy.mjs"));
  writeSlot("10-default-checkout-isolation", "exit 4");
  writeSlot("20-quick-fix-eligibility", "exit 0");
  writeSlot("21-manifest-integrity", "exit 0");
  const installer = path.join(project, "scripts", "install-git-hooks.mjs");
  assert.equal(run(process.execPath, [installer]).status, 0);
  const dispatcher = path.join(project, ".git", "hooks", "pre-commit");
  let result = run("bash", [dispatcher]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /svc advisory pre-commit/);
  result = run("bash", [dispatcher], { SVC_HOOK_MODE: "enforce" });
  assert.equal(result.status, 4, `strict dispatcher result: ${result.stderr}\n${fs.readFileSync(dispatcher, "utf8")}`);
  assert.equal(slotTimeoutMs("15-tier1-gate"), 30 * 60 * 1000);
  assert.equal(slotTimeoutMs("00-svc-pre-commit-multi-host-check"), 5 * 60 * 1000);
  const expensiveMarker = path.join(project, "expensive-ran");
  writeSlot("10-default-checkout-isolation", "exit 0");
  writeSlot("00-svc-pre-commit-multi-host-check", `touch '${expensiveMarker}'; exit 6`);
  result = run("bash", [dispatcher]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /multi-host setup is deferred/);
  assert.equal(fs.existsSync(expensiveMarker), false);
  result = run("bash", [dispatcher], { SVC_HOOK_MODE: "enforce" });
  assert.equal(result.status, 6, result.stderr);
  assert.equal(fs.existsSync(expensiveMarker), true);
  fs.rmSync(expensiveMarker);
  fs.unlinkSync(path.join(project, "hooks", "git", "pre-commit.d", "00-svc-pre-commit-multi-host-check"));
  const pushSlot = path.join(project, "hooks", "git", "pre-push.d", "15-tier1-gate");
  fs.mkdirSync(path.dirname(pushSlot), { recursive: true });
  fs.writeFileSync(pushSlot, `#!/bin/sh\ntouch '${expensiveMarker}'\nexit 8\n`, { mode: 0o755 });
  const pushDispatcher = path.join(project, ".git", "hooks", "pre-push");
  result = run("bash", [pushDispatcher]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /full Tier 1 is deferred/);
  assert.equal(fs.existsSync(expensiveMarker), false);
  result = run("bash", [pushDispatcher], { SVC_HOOK_MODE: "enforce" });
  assert.equal(result.status, 8, result.stderr);
  assert.equal(fs.existsSync(expensiveMarker), true);
  fs.rmSync(expensiveMarker);
  const grandchildFile = path.join(project, "slot-grandchild.pid");
  const treeScript = path.join(project, "tree-child.mjs");
  fs.writeFileSync(treeScript, `import fs from 'node:fs';\nimport {spawn} from 'node:child_process';\nconst child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});\nfs.writeFileSync(process.env.SVC_PID_FILE,String(child.pid));\nsetInterval(()=>{},1000);\n`);
  const treeSlot = path.join(project, "tree-slot.sh");
  fs.writeFileSync(treeSlot, `#!/bin/sh\nexec '${process.execPath}' '${treeScript}'\n`, { mode: 0o755 });
  const timedTree = run(process.execPath, [path.join(project, "scripts", "git-hook-slot.mjs"), treeSlot], {
    SVC_GIT_SLOT_TEST_TIMEOUT_MS: "1500", SVC_PID_FILE: grandchildFile,
  });
  assert.equal(timedTree.status, 124, timedTree.stderr);
  assert.match(timedTree.stderr, /timed out/);
  const pid = Number(fs.readFileSync(grandchildFile, "utf8"));
  const state = spawnSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8" }).stdout.trim();
  assert.ok(!state || state.startsWith("Z"), `git slot grandchild survived timeout: ${pid} ${state}`);

  // The same basename in another event is foreign and keeps native failure.
  const wrongEvent = writeSlot("15-tier1-gate", "exit 11");
  result = run("bash", [dispatcher]);
  assert.equal(result.status, 11, result.stderr);
  fs.unlinkSync(wrongEvent);

  // A tracked custom slot remains native and blocks in the default mode.
  writeSlot("12-user-foreign", "exit 7");
  execFileSync("git", ["add", "hooks/git/pre-commit.d/12-user-foreign"], { cwd: project });
  result = run("bash", [dispatcher]);
  assert.equal(result.status, 7, result.stderr);

  // A pre-existing regular Git hook survives installer migration intact.
  fs.writeFileSync(dispatcher, "#!/bin/sh\nexit 9\n", { mode: 0o755 });
  assert.equal(run(process.execPath, [installer]).status, 0);
  assert.equal(fs.readFileSync(path.join(project, "hooks", "git", "pre-commit.d", "00-existing-pre-commit"), "utf8"), "#!/bin/sh\nexit 9\n");
  result = run("bash", [dispatcher]);
  assert.equal(result.status, 9, result.stderr);
  console.log("PASS advisory git hooks: first-party warning, enforce, tracked foreign block, regular hook preservation");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
