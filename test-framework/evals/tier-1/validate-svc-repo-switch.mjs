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
  const on = applyOn(applyOff(off, skills), skills);
  assert.deepEqual(on, before, "on restores the user's own overrides, even after off twice");
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

test("settings symlinked to a dotfiles repo stay symlinks", () => {
  const repo = tmp("svc-repo-link-");
  spawnSync("git", ["init", "-q", repo]);
  fs.mkdirSync(path.join(repo, ".claude"));
  const real = path.join(repo, "real.json");
  fs.writeFileSync(real, "{}");
  fs.symlinkSync(real, path.join(repo, ".claude/settings.local.json"));
  assert.equal(spawnSync(process.execPath, [script, "off", "--dir", repo]).status, 0);
  assert.ok(fs.lstatSync(path.join(repo, ".claude/settings.local.json")).isSymbolicLink());
  assert.equal(JSON.parse(fs.readFileSync(real, "utf8")).env.SVC_REPO_MODE, "off");
});

test("hook boundary skips svc hooks when the repo is off in advisory mode, but not in enforce mode", () => {
  const home = tmp("svc-repo-home-");
  const marker = path.join(home, "child-ran");
  const child = path.join(home, "child.mjs");
  fs.writeFileSync(child, `import fs from "node:fs"; fs.writeFileSync(${JSON.stringify(marker)}, "1"); process.stdout.write("{}");`);
  const spec = Buffer.from(JSON.stringify({ command: `'${process.execPath}' '${child}'`, host: "claude", event: "Stop", timeoutMs: 5000 })).toString("base64url");
  const run = (mode, ownerPolicy) => {
    fs.rmSync(marker, { force: true });
    fs.mkdirSync(path.join(home, ".svc"), { recursive: true });
    if (ownerPolicy) fs.writeFileSync(path.join(home, ".svc/hook-policy.json"), JSON.stringify({ mode: ownerPolicy }));
    else fs.rmSync(path.join(home, ".svc/hook-policy.json"), { force: true });
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
  const owner = run("advisory", "enforce");
  assert.equal(owner.ran, true, "an owner enforce policy wins even when repo env says advisory");
});

test("env can raise the hook mode to enforce but never lower the owner's enforce", async () => {
  const { resolveHookMode } = await import("../../../hooks/lib/hook-policy.mjs");
  const home = tmp("svc-mode-");
  assert.deepEqual(resolveHookMode({}, home), { mode: "advisory", source: "default" });
  assert.equal(resolveHookMode({ SVC_HOOK_MODE: "enforce" }, home).mode, "enforce", "env raises advisory");
  fs.mkdirSync(path.join(home, ".svc"));
  fs.writeFileSync(path.join(home, ".svc", "hook-policy.json"), '{"mode":"enforce"}');
  const lowered = resolveHookMode({ SVC_HOOK_MODE: "advisory" }, home);
  assert.equal(lowered.mode, "enforce", "a repo or host env cannot switch off the owner's enforce");
  assert.match(lowered.warning, /only that file can lower it/);
  assert.equal(resolveHookMode({ SVC_HOOK_MODE: "bogus" }, home).mode, "enforce", "an invalid env value keeps the owner mode");
  fs.writeFileSync(path.join(home, ".svc", "hook-policy.json"), '{"mode":"advisory"}');
  assert.equal(resolveHookMode({ SVC_HOOK_MODE: "enforce" }, home).mode, "enforce");
  assert.equal(resolveHookMode({ SVC_HOOK_MODE: "advisory" }, home).mode, "advisory");
});
