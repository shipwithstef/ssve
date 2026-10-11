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

test("on is a no-op when already on and never deletes an owner's own override (review #127 P2)", async () => {
  const { applyOff, applyOn } = await import("../../../scripts/svc-repo.mjs");
  const owner = { skillOverrides: { "write-spec": "off" } };
  const skills = ["write-spec", "design-ux"];
  const roundTrip = applyOn(applyOff(owner, skills), skills);
  assert.deepEqual(roundTrip, owner, "off then on restores the owner's settings");
  assert.deepEqual(applyOn(roundTrip, skills), owner, "a second on changes nothing");
  assert.deepEqual(applyOn(owner, skills), owner, "on without a prior off changes nothing");
});

test("a non-Claude host sees the repo switch from the settings file alone, from any subdirectory, and enforce still wins (review #127 harness parity)", () => {
  const home = tmp("svc-repo-host-");
  const repo = tmp("svc-repo-files-");
  spawnSync("git", ["init", "-q", repo]);
  const sub = path.join(repo, "src", "deep");
  fs.mkdirSync(sub, { recursive: true });
  assert.equal(spawnSync(process.execPath, [script, "off", "--dir", repo]).status, 0);
  const marker = path.join(home, "child-ran");
  const child = path.join(home, "child.mjs");
  fs.writeFileSync(child, `import fs from "node:fs"; fs.writeFileSync(${JSON.stringify(marker)}, "1"); process.stdout.write("{}");`);
  const spec = Buffer.from(JSON.stringify({ command: `'${process.execPath}' '${child}'`, host: "codex", event: "Stop", timeoutMs: 5000 })).toString("base64url");
  const run = (mode) => {
    fs.rmSync(marker, { force: true });
    const env = { ...process.env, HOME: home, SVC_SESSION_ID: `repo-files-${mode ?? "advisory"}` };
    for (const k of ["SVC_HOOK_MODE", "SVC_REPO_MODE", "CLAUDE_PROJECT_DIR"]) delete env[k];
    if (mode) env.SVC_HOOK_MODE = mode;
    spawnSync(process.execPath, [path.join(root, "hooks/svc-hook-boundary.mjs"), "svc-fixture", "--spec", spec], { env, cwd: sub, input: "{}", encoding: "utf8", timeout: 12000 });
    return fs.existsSync(marker);
  };
  assert.equal(run(undefined), false, "advisory + repo off in .claude/settings.local.json skips the hook");
  assert.equal(run("enforce"), true, "enforce ignores the repo file");
  assert.equal(spawnSync(process.execPath, [script, "on", "--dir", repo]).status, 0);
  assert.equal(run(undefined), true, "svc on brings the hook back");
});

test("OpenCode reads the repo switch exactly as the shared resolver does", async () => {
  const { repoSettingsOff } = await import("../../../hooks/lib/hook-policy.mjs");
  const src = fs.readFileSync(path.join(root, "hooks/opencode/svc-opencode-plugin.ts"), "utf8");
  const start = src.indexOf("function repoSettingsOff(");
  let depth = 0, i = src.indexOf("{", start);
  for (; i < src.length; i++) { if (src[i] === "{") depth++; else if (src[i] === "}" && --depth === 0) break; }
  const dir = tmp("svc-repo-oc-");
  const harness = path.join(dir, "h.ts");
  fs.writeFileSync(harness, `import fs from "node:fs";\nimport path from "node:path";\n${src.slice(start, i + 1)}\nprocess.stdout.write(String(repoSettingsOff(process.argv[2])));\n`);
  const cases = [["none", null], ["local-off", { "settings.local.json": { env: { SVC_REPO_MODE: "off" } } }], ["shared-off", { "settings.json": { env: { SVC_REPO_MODE: "off" } } }], ["other", { "settings.json": { env: { SVC_REPO_MODE: "on" } } }], ["broken", { "settings.json": "{not json" }]];
  for (const [name, files] of cases) {
    const repo = path.join(dir, name);
    fs.mkdirSync(path.join(repo, ".git"), { recursive: true });
    fs.mkdirSync(path.join(repo, ".claude"), { recursive: true });
    for (const [f, v] of Object.entries(files || {})) fs.writeFileSync(path.join(repo, ".claude", f), typeof v === "string" ? v : JSON.stringify(v));
    const sub = path.join(repo, "a", "b"); fs.mkdirSync(sub, { recursive: true });
    const r = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", harness, sub], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, String(repoSettingsOff(sub)), name);
  }
  assert.equal(repoSettingsOff(path.join(dir, "local-off", "a", "b")), true);
  assert.equal(repoSettingsOff(path.join(dir, "broken", "a", "b")), false);
});

test("a linked worktree follows the switch set in its main checkout (review #127)", async () => {
  const { repoSettingsOff } = await import("../../../hooks/lib/hook-policy.mjs");
  const main = tmp("svc-repo-main-");
  spawnSync("git", ["init", "-q", main]);
  spawnSync("git", ["-C", main, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "init"]);
  const wt = path.join(tmp("svc-repo-wt-"), "wt");
  assert.equal(spawnSync("git", ["-C", main, "worktree", "add", "-q", wt]).status, 0);
  const sub = path.join(wt, "src"); fs.mkdirSync(sub);
  assert.equal(repoSettingsOff(sub), false);
  assert.equal(spawnSync(process.execPath, [script, "off", "--dir", main]).status, 0);
  assert.equal(repoSettingsOff(sub), true, "off in the main checkout reaches its worktrees");
  assert.equal(spawnSync(process.execPath, [script, "on", "--dir", main]).status, 0);
  assert.equal(repoSettingsOff(sub), false);
});
