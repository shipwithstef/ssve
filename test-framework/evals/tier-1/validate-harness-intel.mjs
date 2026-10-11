#!/usr/bin/env node
/** Tier 1: harness playbook (known-good invocations + flag probes) and harness drift (release notes since the tuned version). Hermetic. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { loadPlaybook, fill, renderPrompt, missingFlags, probe, resolveHost, hasHeadless } from "../../../scripts/harness-playbook.mjs";
import { cmpVersion, parseUpdates, proposals } from "../../../scripts/harness-drift.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const pb = loadPlaybook();
const baseline = JSON.parse(fs.readFileSync(path.join(root, "references/harness-baseline.json"), "utf8"));
const changelog = fs.readFileSync(path.join(root, "test-framework/fixtures/harness-drift/changelog.md"), "utf8");

test("every provisioned host has exactly one playbook entry, mapped by provision_host", () => {
  const provisioned = fs.readdirSync(path.join(root, "provision/hosts")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();
  const mapped = Object.values(pb.hosts).map((h) => h.provision_host).sort();
  assert.deepEqual(mapped, provisioned, "playbook provision_host set equals provision/hosts/*.json");
  for (const host of provisioned) {
    const m = JSON.parse(fs.readFileSync(path.join(root, "provision/hosts", `${host}.json`), "utf8"));
    assert.equal(m.host, host, `${host}.json declares its own id`);
    const found = resolveHost(pb, host);
    assert.ok(found, `${host} resolves to a playbook entry`);
    assert.equal(found[1].provision_host, host);
  }
  assert.equal(resolveHost(pb, "antigravity")[0], "agy", "antigravity resolves to the agy reviewer transport");
  assert.equal(resolveHost(pb, "nope"), null);
  for (const via of ["review_via", "exec_via"]) for (const [host, h] of Object.entries(pb.hosts)) {
    if (h[via]) assert.ok(hasHeadless(pb.hosts[h[via]]), `${host}.${via} points at an entry with a headless role`);
  }
});

test("a roleless entry states why and is skipped by verify and refused by show", () => {
  for (const [host, h] of Object.entries(pb.hosts)) {
    if (hasHeadless(h)) continue;
    assert.ok(h.no_headless_reason && h.no_headless_reason.length > 40, `${host} explains why it has no headless invocation`);
    assert.equal(h.probe, undefined, `${host} has no probe without a role`);
  }
  const script = path.join(root, "scripts/harness-playbook.mjs");
  const v = spawnSync(process.execPath, [script, "verify", "gemini", "mimo-code"], { encoding: "utf8" });
  assert.equal(v.status, 0, v.stderr);
  assert.match(v.stdout, /gemini: no headless invocation recorded \(skipped\)/);
  assert.match(v.stdout, /mimo-code: no headless invocation recorded \(skipped\)/);
  const s = spawnSync(process.execPath, [script, "show", "gemini"], { encoding: "utf8" });
  assert.equal(s.status, 2); assert.match(s.stderr, /no headless invocation recorded/);
  const a = spawnSync(process.execPath, [script, "show", "antigravity"], { encoding: "utf8" });
  assert.equal(a.status, 0, a.stderr); assert.match(a.stdout, /dispatch-agy\.mjs/);
});

test("every playbook host names its source, a probe, and roles whose flags it probes", () => {
  for (const [host, h] of Object.entries(pb.hosts)) {
    assert.ok(h.binary && h.source, host);
    const src = h.source.split(";")[0].trim().split(":")[0];
    assert.ok(fs.existsSync(path.join(root, src)), `${host} source ${src} exists`);
    if (!hasHeadless(h)) continue; // no headless role: nothing to probe (checked above)
    assert.ok(h.probe?.flags?.length, `${host} has a probe`);
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
  assert.deepEqual(missingFlags("  --a.b\n", ["--a.b", "--axb", "--x\\y"]), ["--axb", "--x\\y"], "regex metacharacters in flag names are literal");
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
