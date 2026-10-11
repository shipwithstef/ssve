#!/usr/bin/env node
/** Tier 1: nothing leaves the framework without its reason. docs/removals.md records every
 * removed part and rejected proposal with what it existed for, the evidence, why it was
 * removed and what now delivers its intent. This checks every entry is complete, and that a
 * skill recorded as removed is not still shipped. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const FIELDS = ["Kind", "Existed for", "Evidence", "Why removed", "Intent now delivered by", "Date / record", "Reintroduction check"];
const text = fs.readFileSync(path.join(ROOT, "docs/removals.md"), "utf8");
const entries = text.split(/^## /m).slice(1).map((block) => ({ name: block.split("\n")[0].trim(), body: block }));

test("every removal entry states its purpose, evidence, reason and replacement", () => {
  assert.ok(entries.length > 0);
  for (const e of entries) for (const field of FIELDS) {
    const m = e.body.match(new RegExp(`^- \\*\\*${field.replace(/[/]/g, "\\/")}:\\*\\* (.+)$`, "m"));
    assert.ok(m && m[1].trim().length > 3, `${e.name}: missing "${field}"`);
  }
});

test("a skill recorded as removed is no longer shipped", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "skills-manifest.json"), "utf8"));
  const shipped = new Set(manifest.includedSkills);
  for (const e of entries) {
    if (!/^- \*\*Kind:\*\* removed skill/m.test(e.body)) continue;
    const skill = e.name.replace(/\s*\(.*\)$/, "").trim();
    assert.ok(!shipped.has(skill) && !fs.existsSync(path.join(ROOT, "skills", skill)), `${skill} is recorded as removed but still shipped`);
  }
});

// A removed thing that comes back fails here. Each `pattern: /re/ in a/, b` clause scans the
// tracked files under those prefixes; `review:` clauses are for the plan and exec reviews.
test("nothing recorded as removed has come back", () => {
  const tracked = spawnSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).stdout.split("\n").filter(Boolean);
  const found = [];
  for (const e of entries) {
    const line = (e.body.match(/^- \*\*Reintroduction check:\*\* (.+)$/m) || [])[1] || "";
    for (const clause of line.split(" ; ")) {
      const m = clause.match(/^pattern: \/(.+)\/ in (.+)$/);
      if (!m) { assert.match(clause, /^review: .{10,}/, `${e.name}: a check is "pattern: /re/ in paths" or "review: ..."`); continue; }
      const rx = new RegExp(m[1]);
      const prefixes = m[2].split(",").map((s) => s.trim());
      for (const f of tracked) {
        if (!prefixes.some((p) => f === p || f.startsWith(p))) continue;
        if (f === "docs/removals.md" || f.startsWith("test-framework/evals/tier-1/")) continue;
        let body; try { body = fs.readFileSync(path.join(ROOT, f), "utf8"); } catch { continue; }
        if (rx.test(body)) found.push(`${e.name}: ${f}`);
      }
    }
  }
  assert.deepEqual(found, [], "a removal recorded in docs/removals.md is back; bring new evidence and update the entry first");
});
