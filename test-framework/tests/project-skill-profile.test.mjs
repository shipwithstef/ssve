import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { selectProjectSkills, codexLaunchArgs, readSkillPreferences, usageReport } from "../../scripts/lib/project-skill-profile.mjs";

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const results = path.join(root, "test-framework/results/project-skills");
function fixture(name, web = false) {
  const project = path.join(results, `${name}-${process.pid}`);
  fs.rmSync(project, { recursive: true, force: true });
  fs.mkdirSync(project, { recursive: true });
  if (web) fs.writeFileSync(path.join(project, "package.json"), JSON.stringify({ dependencies: { react: "*" } }));
  return project;
}
function names(profile) { return new Set(profile.selected.map((x) => x.name)); }

test("framework task selects a small relevant set and preserves explicit pins", () => {
  const p = selectProjectSkills({ frameworkRoot: root, projectRoot: root, intent: "fix framework skill routing bug", host: "grok" });
  const selected = names(p);
  assert.equal(p.project_type, "framework");
  assert.ok(selected.size < 15);
  assert.equal(p.catalog.selected, selected.size);
  assert.equal(p.catalog.first_party, p.catalog.selected + p.catalog.outside_profile);
  for (const name of ["wsl2-audio", "quick-fix", "ad-video-script", "cos", "analyze-marketing"]) assert.ok(!selected.has(name), name);
  assert.equal(p.exposure.status, "unfiltered-native-catalog");
  const forced = selectProjectSkills({ frameworkRoot: root, projectRoot: root, intent: "fix framework skill routing bug", explicitSkills: ["wsl2-audio"], activeSkill: "ad-video-script", nextSkill: "cos", preferences: { include: [], exclude: ["wsl2-audio", "cos", "ad-video-script"] } });
  for (const name of ["wsl2-audio", "cos", "ad-video-script"]) assert.ok(names(forced).has(name), name);
});

test("web UI task surfaces visual and same-job comparison tools without company catalog", () => {
  const project = fixture("web", true);
  try {
    const p = selectProjectSkills({ frameworkRoot: root, projectRoot: project, intent: "improve the UI page with same-job competitor comparison" });
    const selected = names(p);
    for (const name of ["design-ux", "design-ui", "analyze-competitors"]) assert.ok(selected.has(name), name);
    assert.ok(!selected.has("benchmark-landing"), "app screen comparison should not use a landing benchmark");
    const homeScreen = names(selectProjectSkills({ frameworkRoot: root, projectRoot: project, intent: "compare app homepage dashboard against competitors" }));
    assert.ok(!homeScreen.has("benchmark-landing"));
    assert.ok(!homeScreen.has("landing-page"));
    const landing = names(selectProjectSkills({ frameworkRoot: root, projectRoot: project, intent: "improve landing page against competitor references" }));
    assert.ok(landing.has("landing-page"));
    assert.ok(landing.has("benchmark-landing"));
    const buildLanding = names(selectProjectSkills({ frameworkRoot: root, projectRoot: project, intent: "build a landing page" }));
    assert.ok(buildLanding.has("landing-page"));
    assert.ok(buildLanding.has("benchmark-landing"));
    for (const name of ["cos", "wsl2-audio", "quick-fix"]) assert.ok(!selected.has(name), name);
    assert.equal(p.project_type, "web-product");
    const ordinaryUi = names(selectProjectSkills({ frameworkRoot: root, projectRoot: project, intent: "improve settings page UI" }));
    assert.ok(ordinaryUi.has("analyze-competitors"));
    assert.ok(!ordinaryUi.has("analyze-marketing"));
  } finally { fs.rmSync(project, { recursive: true, force: true }); }
});

test("project preferences remain isolated and other preference sections are ignored", () => {
  const a = fixture("a", true), b = fixture("b", true);
  try {
    fs.mkdirSync(path.join(a, ".svc"));
    fs.writeFileSync(path.join(a, ".svc/project-preferences.json"), JSON.stringify({ skills: { include: ["wsl2-audio"], exclude: ["design-ui"] }, communication: { detail: "beginner" } }));
    assert.deepEqual(readSkillPreferences(a), { include: ["wsl2-audio"], exclude: ["design-ui"] });
    const x = names(selectProjectSkills({ frameworkRoot: root, projectRoot: a, intent: "UI page" }));
    const y = names(selectProjectSkills({ frameworkRoot: root, projectRoot: b, intent: "UI page" }));
    assert.ok(x.has("wsl2-audio") && !y.has("wsl2-audio"));
    assert.ok(!x.has("design-ui") && y.has("design-ui"));
  } finally { for (const p of [a,b]) fs.rmSync(p, { recursive: true, force: true }); }
});

test("prose paths are ignored but explicit unknown skill flags still fail", () => {
  const project = fixture("prose", true);
  try {
    const intent = "inspect /api /etc $tokens before fixing UI";
    const profile = selectProjectSkills({ frameworkRoot: root, projectRoot: project, intent });
    assert.ok(profile.selected.length > 0);
    assert.throws(() => selectProjectSkills({ frameworkRoot: root, projectRoot: project, explicitSkills: ["not-a-skill"] }), /unknown explicitly requested skill/);
    const routed = spawnSync(process.execPath, [path.join(root, "scripts/skill-router.mjs"), "route", "--root", root, "--project-root", project, "--intent", intent, "--no-receipts"], { encoding: "utf8" });
    assert.equal(routed.status, 0, routed.stderr);
    assert.equal(JSON.parse(routed.stdout).schema_version, 1);
  } finally { fs.rmSync(project, { recursive: true, force: true }); }
});

test("advisory preferences fail open with bounded no-follow reads and diagnostics", () => {
  const project = fixture("prefs", true);
  const svc = path.join(project, ".svc"), file = path.join(svc, "project-preferences.json");
  try {
    fs.mkdirSync(svc);
    fs.writeFileSync(file, "not JSON");
    assert.ok(selectProjectSkills({ frameworkRoot: root, projectRoot: project }).diagnostics.length);
    fs.writeFileSync(file, JSON.stringify({ skills: { include: ["wsl2-audio", "not-a-skill"], exclude: ["design-ui"] } }));
    const unknown = selectProjectSkills({ frameworkRoot: root, projectRoot: project, intent: "improve UI" });
    assert.ok(unknown.diagnostics.includes("preferences-unknown-skill"));
    assert.ok(!names(unknown).has("wsl2-audio"));
    assert.ok(names(unknown).has("design-ui"));
    fs.writeFileSync(file, "x".repeat(16 * 1024 + 1));
    assert.ok(selectProjectSkills({ frameworkRoot: root, projectRoot: project }).diagnostics.includes("preferences-file-not-regular-or-oversize"));
    fs.unlinkSync(file);
    const target = path.join(project, "target.json");
    fs.writeFileSync(target, JSON.stringify({ skills: { include: ["wsl2-audio"] } }));
    fs.symlinkSync(target, file);
    const linked = selectProjectSkills({ frameworkRoot: root, projectRoot: project });
    assert.ok(linked.diagnostics.includes("preferences-file-not-regular"));
    assert.ok(!names(linked).has("wsl2-audio"));
  } finally { fs.rmSync(project, { recursive: true, force: true }); }
});

test("Codex per-process arguments exclude only proven SSVE skills and preserve caller args", () => {
  const project = fixture("launch", true), home = path.join(project, "codex-home");
  try {
    fs.mkdirSync(path.join(home, "skills", "wsl2-audio"), { recursive: true });
    fs.mkdirSync(path.join(home, "skills", "foreign-skill"), { recursive: true });
    fs.symlinkSync(path.join(root, "skills/wsl2-audio/SKILL.md"), path.join(home, "skills/wsl2-audio/SKILL.md"));
    fs.writeFileSync(path.join(home, "skills/foreign-skill/SKILL.md"), "foreign");
    const p = selectProjectSkills({ frameworkRoot: root, projectRoot: project, intent: "fix button" });
    const a = codexLaunchArgs({ profile: p, codexHome: home, projectRoot: project, userArgs: ["--model", "my-model", "--", "hello"] });
    assert.equal(a.excluded_count, 1);
    assert.ok(a.argv[1].includes("wsl2-audio"));
    assert.ok(!a.argv[1].includes("foreign-skill"));
    assert.deepEqual(a.argv.slice(-4), ["--model", "my-model", "--", "hello"]);
    assert.throws(() => codexLaunchArgs({ profile: p, codexHome: home, projectRoot: project, userArgs: ["-c", "skills.config=[]"] }), /cannot be safely replaced/);
    assert.throws(() => codexLaunchArgs({ profile: p, codexHome: home, projectRoot: project, userArgs: ["-cskills.config=[]"] }), /cannot be safely replaced/);
    assert.throws(() => codexLaunchArgs({ profile: p, codexHome: home, projectRoot: project, userArgs: ["-ppreferred"] }), /profile may contain/);
    assert.throws(() => codexLaunchArgs({ profile: p, codexHome: home, projectRoot: project, userArgs: ["-cprofile=preferred"] }), /cannot be safely replaced/);
    assert.throws(() => codexLaunchArgs({ profile: p, codexHome: home, projectRoot: project, userArgs: ['-c"skills".config=[]'] }), /cannot be safely replaced/);
    const inline = 'other = { note = "#", skills = { config = [{path="/foreign/SKILL.md",enabled=false}] } }\n';
    fs.writeFileSync(path.join(home, "config.toml"), inline);
    assert.throws(() => codexLaunchArgs({ profile: p, codexHome: home, projectRoot: project }), /refusing to replace user choices/);
    assert.equal(fs.readFileSync(path.join(home, "config.toml"), "utf8"), inline);
    fs.writeFileSync(path.join(home, "config.toml"), 'profile = "preferred"\n[profiles.preferred]\nmodel = "test"\n');
    assert.throws(() => codexLaunchArgs({ profile: p, codexHome: home, projectRoot: project }), /refusing to replace user choices/);
    fs.writeFileSync(path.join(home, "config.toml"), '["skills"."config"]\npath = "/foreign/SKILL.md"\n');
    assert.throws(() => codexLaunchArgs({ profile: p, codexHome: home, projectRoot: project }), /refusing to replace user choices/);
    fs.writeFileSync(path.join(home, "config.toml"), "[[skills.config]]\npath = \"/other/SKILL.md\"\nenabled = false\n");
    assert.throws(() => codexLaunchArgs({ profile: p, codexHome: home, projectRoot: project }), /refusing to replace user choices/);
  } finally { fs.rmSync(project, { recursive: true, force: true }); }
});

test("launch-codex forwards unchanged native arguments to a fake host", () => {
  const project = fixture("argv", true), home = path.join(project, "codex-home");
  try {
    fs.mkdirSync(home);
    const fake = path.join(project, "fake-codex.mjs");
    fs.writeFileSync(fake, `#!/usr/bin/env node\nimport fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(path.join(project,"argv.json"))}, JSON.stringify(process.argv.slice(2)));\n`, { mode: 0o755 });
    const r = spawnSync(process.execPath, [path.join(root, "scripts/skill-profile.mjs"), "launch-codex", "--project", project, "--codex-home", home, "--codex-bin", fake, "--", "--model", "test", "--", "a task"], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(project, "argv.json"), "utf8")), ["--model", "test", "--", "a task"]);
  } finally { fs.rmSync(project, { recursive: true, force: true }); }
});

test("usage report counts recorded events without inferring tokens or quality", () => {
  const project = fixture("usage");
  try {
    fs.mkdirSync(path.join(project, ".svc/skill-router"), { recursive: true });
    fs.writeFileSync(path.join(project, ".svc/lane-tasks-WI-1.json"), JSON.stringify({ tasks: [{ skill: "research", status: "completed" }, { skill: "design-ui", status: "completed", skip_reason: "deliberately skipped" }] }));
    fs.writeFileSync(path.join(project, ".svc/skill-router/decisions.jsonl"), JSON.stringify({ schema_version: 1, required: ["research"], suggestions: ["design-ui"] }) + "\n");
    const report = usageReport(project);
    assert.equal(report.counts.completed, 1);
    assert.equal(report.counts.skipped, 1);
    assert.equal(report.counts.router_decisions, 1);
    assert.equal(report.counts.suggested_mentions, 1);
    assert.deepEqual(report.by_skill.find((x) => x.skill === "research"), { skill: "research", graph_tasks: 1, completed: 1, skipped: 0, required_mentions: 1, suggested_mentions: 0 });
    assert.deepEqual(report.inspect_suggestions, ["design-ui"]);
    assert.ok(!Object.hasOwn(report.counts, "token_savings"));
  } finally { fs.rmSync(project, { recursive: true, force: true }); }
});
