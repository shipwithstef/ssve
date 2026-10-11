#!/usr/bin/env node
/** Tier 1: hooks/hooks.json is the readable listing of the Claude hooks, so it must say
 * exactly what scripts/wire-hooks.mjs wires: same ids, events, matchers, commands, async
 * and `if` filters. It drifted before (it listed hooks the wirer never wired and missed
 * ones it did), and its install steps told people to copy guards the decision engine
 * already runs, which made them run twice. Engine children are listed separately and must
 * never appear as standalone entries, nor in copy-paste install instructions. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const listing = JSON.parse(fs.readFileSync(path.join(ROOT, "hooks/hooks.json"), "utf8"));

function wired() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "hooks-json-wirer-"));
  const env = { ...process.env, HOME: home };
  for (const key of ["SVC_STATE_HOME", "SVC_DISABLED_HOOKS", "SVC_HOOK_PROFILE"]) delete env[key];
  try {
    const r = spawnSync(process.execPath, [path.join(ROOT, "scripts/wire-hooks.mjs"), "--list-all", "--skills-path", ROOT], { env, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    const json = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
    const out = {};
    for (const [event, entries] of Object.entries(json.hooks)) {
      if (!entries.length) continue;
      out[event] = entries.map((e) => {
        const h = e.hooks[0];
        const spec = h.command.match(/--spec '?([A-Za-z0-9_-]+)/);
        const command = (spec ? JSON.parse(Buffer.from(spec[1], "base64url").toString()).command : h.command).split(ROOT + "/").join("");
        return { id: e.id, matcher: e.matcher || "*", command, async: Boolean(h.async), if: h.if || null };
      });
    }
    return out;
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}

test("hooks.json lists exactly what wire-hooks.mjs wires", () => {
  const expected = wired();
  const actual = Object.fromEntries(Object.entries(listing.hooks).map(([event, entries]) => [event, entries.map((e) => ({
    id: e.id, matcher: e.matcher || "*", command: e.command, async: Boolean(e.async), if: e.if || null,
  }))]));
  assert.deepEqual(actual, expected);
  for (const entries of Object.values(listing.hooks)) for (const e of entries) assert.ok(String(e.description || "").length > 20, `${e.id}: description`);
});

test("engine children are listed apart and never as standalone entries", () => {
  const dispatcher = fs.readFileSync(path.join(ROOT, "hooks/codex/svc-codex-pretool-dispatcher.mjs"), "utf8");
  const children = Array.isArray(listing.engine_children) ? listing.engine_children : [];
  assert.ok(children.length > 0);
  const standalone = new Map();
  for (const [event, entries] of Object.entries(listing.hooks)) for (const e of entries) standalone.set(`${event}:${e.command}`, e.id);
  for (const child of children) {
    const script = path.basename(String(child.command).split(/\s+/)[1] || "");
    assert.ok(script && dispatcher.includes(`"${script}"`), `${child.id} is not a child of the decision engine`);
    // The engine matches Bash|Edit|Write...; a standalone PreToolUse entry with the same
    // command on any of those tools would run the guard a second time.
    for (const e of listing.hooks.PreToolUse || []) {
      if (e.command !== child.command) continue;
      assert.ok(!/(^|\|)(Bash|Edit|Write)(\||$)/.test(e.matcher), `${child.id} is wired standalone on ${e.matcher} as ${e.id}`);
    }
  }
  const steps = JSON.stringify(listing.installation || {});
  for (const child of children) assert.ok(!steps.includes(`"command": "${child.command}"`) && !steps.includes(`\\"command\\": \\"${child.command}\\"`), `install steps tell users to wire ${child.id}`);
  assert.match(steps, /wire-hooks\.mjs|\.\/setup/);
});
