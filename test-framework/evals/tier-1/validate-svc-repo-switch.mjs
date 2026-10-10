#!/usr/bin/env node
/** Tier 1: svc-repo.mjs turns svc off/on for one repo through Claude Code settings, and the hook boundary honours it in advisory mode only. Hermetic. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { applyOff, applyOn, describe, svcSkillNames } from "../../../scripts/svc-repo.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const script = path.join(root, "scripts/svc-repo.mjs");
const skills = svcSkillNames(root);
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

test("off hides every svc skill from the listing but keeps /name; on restores exactly what off set", () => {
  const before = { model: "opus", skillOverrides: { "my-own": "off", [skills[0]]: "name-only" }, env: { FOO: "1" } };
  const off = applyOff(before, skills);
  assert.equal(off.env.SVC_REPO_MODE, "off");
  assert.equal(off.env.FOO, "1");
  assert.ok(skills.every((s) => off.skillOverrides[s] === "user-invocable-only"));
  assert.equal(off.skillOverrides["my-own"], "off");
  assert.deepEqual(describe(off, skills), { hooks: "off", skills_hidden: skills.length, skills_total: skills.length });
  const on = applyOn(off, skills);
  assert.deepEqual(on, { model: "opus", skillOverrides: { "my-own": "off" }, env: { FOO: "1" } });
  assert.ok(Object.values(applyOff({}, skills, { hard: true }).skillOverrides).every((v) => v === "off"));
});

test("CLI writes the repo's local settings by default and shared settings with --shared", () => {
  const repo = tmp("svc-repo-");
  spawnSync("git", ["init", "-q", repo]);
  const run = (...a) => spawnSync(process.execPath, [script, ...a, "--dir", repo], { encoding: "utf8" });
  assert.equal(run("off").status, 0);
  const local = JSON.parse(fs.readFileSync(path.join(repo, ".claude/settings.local.json"), "utf8"));
  assert.equal(local.env.SVC_REPO_MODE, "off");
  assert.equal(JSON.parse(run("status", "--json").stdout).effective, "off");
  assert.equal(run("on").status, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(repo, ".claude/settings.local.json"), "utf8")), {});
  assert.equal(run("off", "--shared").status, 0);
  assert.ok(fs.existsSync(path.join(repo, ".claude/settings.json")));
  assert.equal(run("bogus").status, 2);
});

test("hook boundary skips svc hooks when the repo is off in advisory mode, but not in enforce mode", () => {
  const home = tmp("svc-repo-home-");
  const marker = path.join(home, "child-ran");
  const child = path.join(home, "child.mjs");
  fs.writeFileSync(child, `import fs from "node:fs"; fs.writeFileSync(${JSON.stringify(marker)}, "1"); process.stdout.write("{}");`);
  const spec = Buffer.from(JSON.stringify({ command: `'${process.execPath}' '${child}'`, host: "claude", event: "Stop", timeoutMs: 5000 })).toString("base64url");
  const run = (mode) => {
    fs.rmSync(marker, { force: true });
    const env = { ...process.env, HOME: home, SVC_REPO_MODE: "off", SVC_SESSION_ID: `repo-switch-${mode}` };
    delete env.SVC_HOOK_MODE;
    if (mode) env.SVC_HOOK_MODE = mode;
    const r = spawnSync(process.execPath, [path.join(root, "hooks/svc-hook-boundary.mjs"), "svc-fixture", "--spec", spec], { env, input: "{}", encoding: "utf8", timeout: 12000 });
    return { r, ran: fs.existsSync(marker) };
  };
  const advisory = run(undefined);
  assert.equal(advisory.r.status, 0);
  assert.equal(advisory.ran, false, "advisory + repo off must not run the hook");
  assert.equal(advisory.r.stdout.trim(), "{}");
  const enforce = run("enforce");
  assert.equal(enforce.ran, true, "enforce mode ignores the repo switch");
});
