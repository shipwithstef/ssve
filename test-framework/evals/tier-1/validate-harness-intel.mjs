#!/usr/bin/env node
/** Tier 1: harness playbook (known-good invocations + flag probes) and harness drift (release notes since the tuned version). Hermetic. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPlaybook, fill, renderPrompt, missingFlags, probe } from "../../../scripts/harness-playbook.mjs";
import { cmpVersion, parseUpdates, proposals } from "../../../scripts/harness-drift.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const pb = loadPlaybook();
const baseline = JSON.parse(fs.readFileSync(path.join(root, "references/harness-baseline.json"), "utf8"));
const changelog = fs.readFileSync(path.join(root, "test-framework/fixtures/harness-drift/changelog.md"), "utf8");

test("every playbook host names its source, a probe, and roles whose flags it probes", () => {
  for (const [host, h] of Object.entries(pb.hosts)) {
    assert.ok(h.binary && h.source && h.probe?.flags?.length, host);
    const src = h.source.split(";")[0].trim().split(":")[0];
    assert.ok(fs.existsSync(path.join(root, src)), `${host} source ${src} exists`);
    if (h.launcher) continue; // role flags belong to the wrapper, not the CLI
    const used = [...new Set(Object.values(h.roles).flat().filter((a) => /^--/.test(a)))];
    const unprobed = used.filter((f) => !h.probe.flags.includes(f) && !(h.probe.documented_hidden && f in h.probe.documented_hidden));
    const allowed = h.conflict ? (h.conflict.match(/--[a-z-]+/g) || []) : [];
    assert.deepEqual(unprobed.filter((f) => !allowed.includes(f)), [], `${host}: every flag a role uses is probed`);
  }
});

test("fill leaves unknown placeholders visible; the reference prompt renders", () => {
  assert.deepEqual(fill(["--model", "{model}", "--x", "{nope}"], { model: "m" }), ["--model", "m", "--x", "{nope}"]);
  const p = renderPrompt(pb, { role: "reviewer", task: "WI-1", mode: "read-only", inputs: "a.md", done_condition: "each AC judged", schema_json: "{}" });
  assert.match(p, /^You are the reviewer for WI-1\. Work read-only\./);
  assert.ok(!/\{[a-z_]+\}/.test(p));
});

test("flag probes detect a renamed flag and skip missing CLIs", () => {
  assert.deepEqual(missingFlags("Usage:\n  --model <m>\n  --print, -p\n", ["--model", "--print", "--effort"]), ["--effort"]);
  assert.deepEqual(missingFlags("  --effort-level <x>\n", ["--effort"]), ["--effort"], "a longer flag does not satisfy a shorter one");
  const fake = (bin, args) => ({ stdout: "  --a\n  --b\n", stderr: "", status: 0 });
  assert.deepEqual(probe("x", { binary: "x", probe: { help: ["--help"], flags: ["--a", "--c"] } }, fake).missing, ["--c"]);
  const absent = () => ({ error: Object.assign(new Error("nope"), { code: "ENOENT" }) });
  assert.equal(probe("x", { binary: "x", probe: { help: [], flags: [] } }, absent).installed, false);
});

test("versions compare numerically", () => {
  assert.equal(cmpVersion("2.1.10", "2.1.9"), 1);
  assert.equal(cmpVersion("2.1.296", "2.1.296"), 0);
  assert.equal(cmpVersion("2.0.99", "2.1.0"), -1);
});

test("drift lists only entries after the tuned version, in watched areas, skipping other surfaces", () => {
  const updates = parseUpdates(changelog);
  assert.deepEqual(updates.map((u) => u.version), ["2.1.12", "2.1.11", "2.1.10"]);
  const p = proposals(updates, "2.1.10", "2.1.12", baseline.watch, baseline.skip_surfaces);
  const texts = p.map((x) => `${x.action} ${x.version} ${x.text}`);
  assert.ok(texts.some((t) => /^adopt 2\.1\.12 .*effort/.test(t)), "Added entry in a watched area is an adopt candidate");
  assert.ok(texts.some((t) => /^check 2\.1\.12 .*PreToolUse/.test(t)), "Fixed entry is a check candidate");
  assert.ok(texts.some((t) => /^adopt 2\.1\.11 .*omitClaudeMd/.test(t)));
  assert.ok(!texts.some((t) => /theme picker|VS Code|already tuned/.test(t)), "unwatched, other-surface and pre-baseline entries are skipped");
  assert.equal(proposals(updates, "2.1.10", "2.1.11", baseline.watch, baseline.skip_surfaces).length, 1, "nothing past the installed version");
});
