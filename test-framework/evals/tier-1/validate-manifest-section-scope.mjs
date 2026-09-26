#!/usr/bin/env node
/** Functional regression fixtures; no installed hosts or live project state are used. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
/** Create fixture-owned state and remove it after the test. */
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ssve-functional-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir;
}
/** Write only fixture data, creating missing fixture parents. */
function put(dir, name, value) {
  const file = path.join(dir, name); fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value)); return file;
}
/** Execute the production CLI with a bounded runtime and explicit fixture working directory. */
function cli(script, args, cwd, env = {}) {
  return spawnSync(process.execPath, [path.join(ROOT, script), ...args], {
    cwd, env: { ...process.env, ...env }, encoding: "utf8", timeout: 10000,
  });
}
/** Assert successful machine-readable output. */
function json(result) { assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout); }

const script="scripts/extract-manifest-files.mjs";
const table=(file,action="MODIFY")=>`| File | Action | Notes |\n|---|---|---|\n| \`${file}\` | ${action} | example |\n`;
/** Extract the real manifest and verify the input is never changed. */
function extract(t,body) {const dir=fixture(t);const file=put(dir,"manifest.md",body);const out=cli(script,[file],dir);assert.equal(fs.readFileSync(file,"utf8"),body);return out;}
test("planned scope ends at sibling and parent headings, including rollback",(t)=>{
  const out=extract(t,"## Files Planned\n"+table("src/app.js")+"## Rollback\n"+table("src/rollback.js")+"### Phase 1\n"+table("src/not-planned.js"));
  assert.equal(out.status,0,out.stderr);assert.equal(out.stdout,"M\tsrc/app.js\n");
});
test("nested non-phase sections cannot leak tables, and later planned phases re-enter",(t)=>{
  const body="## Files Planned\n"+table("src/base.js")
    +"### Rollback\n"+table("src/rollback.js")
    +"#### Phase 1\n"+table("src/rollback-phase.js")
    +"### External State\n"+table("src/external.js")
    +"### Lane Compliance\n"+table("src/compliance.js")
    +"### Implementation Summary\n"+table("src/summary.js")
    +"### Notes\n"+table("src/notes.js")
    +"### Phase 1\n"+table("src/phase.js","CREATE")
    +"#### Notes\n"+table("src/phase-notes.js")
    +"### Phase 2\n"+table("src/final.js","DELETE")
    +"## Discussion\n"+table("src/discussion.js")
    +"## Files Planned (follow-up)\n"+table("src/reentry.js");
  const out=extract(t,body);
  assert.equal(out.status,0,out.stderr);
  assert.equal(out.stdout,"A\tsrc/phase.js\nD\tsrc/final.js\nM\tsrc/base.js\nM\tsrc/reentry.js\n");
});
test("standalone phase sections exclude nested notes and resume at a sibling phase",(t)=>{
  const out=extract(t,"## Implementation\n### Phase 1\n"+table("src/first.js")
    +"#### Notes\n"+table("src/note.js")
    +"### Phase 2\n"+table("src/second.js")
    +"## Rollback\n### Phase 3\n"+table("src/rollback.js"));
  assert.equal(out.status,0,out.stderr);
  assert.equal(out.stdout,"M\tsrc/first.js\nM\tsrc/second.js\n");
});
test("table headers define column positions and escaped pipe filenames",(t)=>{
  const out=extract(t,"## Files Planned\n| Notes | Action | File |\n|---|---|---|\n| x | CREATE | `src/a\\|b.js` |\n");
  assert.equal(out.status,0,out.stderr);assert.equal(out.stdout,"A\tsrc/a|b.js\n");
});
test("backtick and tilde fenced examples do not contribute planned files",(t)=>{
  for(const fence of ["```","~~~~","````"]){const out=extract(t,"## Files Planned\n"+table("src/real.js")+fence+"markdown\n## Files Planned\n"+table("src/example.js")+fence+"\n");assert.equal(out.status,0,out.stderr);assert.equal(out.stdout,"M\tsrc/real.js\n");}
});
test("phase tables preserve sorted deduplicated create/modify/delete rows",(t)=>{
  const out=extract(t,"## Implementation\n### Phase 1\n"+table("src/z.js","DELETE")+table("src/a.js","CREATE")+"### Phase 2\n"+table("src/m.js")+table("src/a.js","CREATE"));
  assert.equal(out.status,0,out.stderr);assert.equal(out.stdout,"A\tsrc/a.js\nD\tsrc/z.js\nM\tsrc/m.js\n");
});
test("ordinary planned tables remain compatible, while absence stays a failure",(t)=>{
  const valid=extract(t,"# Change\n\n## Files Planned\n\n"+table("src/app.js"));assert.equal(valid.status,0);assert.equal(valid.stdout,"M\tsrc/app.js\n");
  const none=extract(t,"## Rollback\n"+table("src/app.js"));assert.equal(none.status,1);assert.equal(none.stdout,"");
});
