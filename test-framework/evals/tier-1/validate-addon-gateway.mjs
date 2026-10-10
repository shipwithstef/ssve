#!/usr/bin/env node
/** Tier 1: addon-gateway lists add-on packs from disk and resolves one playbook path, so packs cost one listing entry. Hermetic. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { addonRoots, readFrontmatter, buildIndex } from "../../../skills/addon-gateway/scripts/addon-index.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const script = path.join(root, "skills/addon-gateway/scripts/addon-index.mjs");
const skill = fs.readFileSync(path.join(root, "skills/addon-gateway/SKILL.md"), "utf8");

function pack() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "addon-gw-"));
  const skills = path.join(dir, "marketingskills", "skills");
  const write = (name, fm) => { fs.mkdirSync(path.join(skills, name), { recursive: true }); fs.writeFileSync(path.join(skills, name, "SKILL.md"), `---\n${fm}\n---\nbody\n`); };
  write("cro", "name: cro\ndescription: >\n  When the user wants to optimize conversions\n  on pages and forms.");
  write("copywriting", 'name: copywriting\ndescription: "Write marketing copy."');
  write("no-frontmatter-dir", "");
  fs.writeFileSync(path.join(skills, "no-frontmatter-dir", "SKILL.md"), "plain body\n");
  return { dir, skills };
}
const cli = (args, env) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8", env: { ...process.env, ...env } });

test("frontmatter parsing handles folded and quoted descriptions", () => {
  assert.deepEqual(readFrontmatter('---\nname: a\ndescription: "One line."\n---\n'), { name: "a", description: "One line." });
  assert.equal(readFrontmatter("---\nname: b\ndescription: >\n  Two\n  lines.\nother: x\n---\n").description, "Two lines.");
  assert.deepEqual(readFrontmatter("no frontmatter"), {});
  assert.equal(readFrontmatter("\uFEFF---\nname: c\ndescription: x\n---\n").name, "c");
  assert.equal(readFrontmatter("---\nname: d\ndescription: When the user wants\n  to do things.\n---\n").description, "When the user wants to do things.");
});

test("roots come from SVC_ADDON_ROOTS, else ~/.svc/external-skills/*/skills and ~/.agents/skills", () => {
  assert.deepEqual(addonRoots({ SVC_ADDON_ROOTS: "/a:/b" }, "/home/x"), ["/a", "/b"]);
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "addon-home-"));
  fs.mkdirSync(path.join(home, ".svc/external-skills/marketingskills/skills"), { recursive: true });
  assert.deepEqual(addonRoots({}, home), [path.join(home, ".svc/external-skills/marketingskills/skills"), path.join(home, ".agents/skills")]);
});

test("index lists every skill once, with the pack name, and stays compact", () => {
  const { skills } = pack();
  const packs = buildIndex([skills, skills]);
  assert.equal(packs.length, 1);
  assert.equal(packs[0].pack, "marketingskills");
  assert.deepEqual(packs[0].skills.map((s) => s.name).sort(), ["copywriting", "cro", "no-frontmatter-dir"]);
  const out = cli([], { SVC_ADDON_ROOTS: skills });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^### marketingskills \(3\)/m);
  assert.match(out.stdout, /- cro: Optimize conversions on pages and forms\./);
});

test("a SKILL.md that resolves outside its pack is not listed", () => {
  const { skills } = pack();
  fs.mkdirSync(path.join(skills, "escape"));
  const outside = path.join(os.tmpdir(), `addon-outside-${process.pid}.md`);
  fs.writeFileSync(outside, "---\nname: escape\ndescription: x\n---\n");
  fs.symlinkSync(outside, path.join(skills, "escape", "SKILL.md"));
  assert.ok(!buildIndex([skills])[0].skills.some((s) => s.name === "escape"));
});

test("--path resolves one playbook and fails cleanly on an unknown name", () => {
  const { skills } = pack();
  const ok = cli(["--path", "cro"], { SVC_ADDON_ROOTS: skills });
  assert.equal(ok.status, 0);
  assert.equal(ok.stdout.trim(), path.join(skills, "cro", "SKILL.md"));
  const bad = cli(["--path", "nope"], { SVC_ADDON_ROOTS: skills });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /no add-on skill named "nope"/);
});

test("no packs installed prints an install hint and exits 0", () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "addon-empty-"));
  const r = cli([], { SVC_ADDON_ROOTS: empty });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /No add-on packs found/);
});

test("the skill injects the index at invocation and loads one playbook, not the pack", () => {
  assert.match(skill, /!`node "\$\{CLAUDE_SKILL_DIR\}\/scripts\/addon-index\.mjs"`/);
  assert.match(skill, /--path <name>/);
  assert.match(skill, /never load the whole pack/);
  // The inline command runs only if allowed-tools pre-approves exactly that command.
  assert.match(skill, /^allowed-tools: 'Bash\(node "\$\{CLAUDE_SKILL_DIR\}\/scripts\/addon-index\.mjs"\*\)'$/m);
  const desc = skill.match(/^description: >\n([\s\S]*?)\n[a-z-]+:/m)[1].replace(/\s+/g, " ").trim();
  assert.ok(desc.length <= 400, `description ${desc.length} chars`);
});
