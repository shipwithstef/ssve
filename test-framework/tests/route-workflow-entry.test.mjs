// @organism-suite
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const skillPath = path.join(root, "skills/route-workflow/SKILL.md");
const refPath = path.join(root, "skills/route-workflow/references/framework-and-host-route.md");
const skill = fs.readFileSync(skillPath, "utf8");
const body = skill.split("\n---\n").slice(1).join("\n---\n").replace(/^\n+/, "");

test("entry body is short and imperative", () => {
  const lines = body.replace(/\n+$/, "").split("\n");
  assert.ok(lines.length <= 60, `body is ${lines.length} lines`);
  assert.match(skill, /^name: route-workflow$/m);
});

test("entry names the whole hot path in order", () => {
  const order = ["init-project-state", "svc-bootstrap-repo", "svc-ensure-worktree", "compile-delivery-graph", "svc-next"];
  let at = -1;
  for (const name of order) {
    const next = body.indexOf(name, at + 1);
    assert.ok(next > at, `${name} missing or out of order`);
    at = next;
  }
  assert.match(body, /skills-manifest\.json/);
  assert.match(body, /references\/framework-and-host-route\.md/);
  assert.match(body, /CLOSEOUT/);
  assert.match(body, /SVC_SESSION_ID/);
});

test("STATUS done is the only finish and assumptions never drop stages", () => {
  assert.match(body, /Finish only when `svc-next` prints `STATUS done`/);
  assert.match(body, /Nothing else ends the run/);
  assert.match(body, /never drops a stage, review or receipt/);
  assert.match(body, /the compiler, not you, decides what is short/);
  assert.doesNotMatch(body, /--delivery-profile[^`]*`?\s*(prototype|mvp|production)/);
});

test("classification table covers every lane class", () => {
  for (const row of ["continue earlier work", "docs or typo", "security review", "bug report", "new behavior", "build what spec.md asks"]) {
    assert.ok(body.includes(row), `missing class: ${row}`);
  }
});

test("every referenced script exists, except the two supplied by sibling packages", () => {
  const supplied = new Set(["svc-next", "svc-bootstrap-repo"]);
  const names = new Set([...body.matchAll(/scripts\/([a-z0-9-]+)\.mjs/g)].map((m) => m[1]));
  for (const name of names) {
    if (supplied.has(name)) continue;
    assert.ok(fs.existsSync(path.join(root, "scripts", `${name}.mjs`)), `scripts/${name}.mjs is missing`);
  }
});

test("moved reference keeps the old hot path", () => {
  const ref = fs.readFileSync(refPath, "utf8");
  assert.match(ref, /^## Hot Path$/m);
  assert.match(ref, /svc-ensure-worktree\.mjs --wi <WI> --branch <branch> --from origin\/main --json --print-cd/);
  assert.match(ref, /^## Lane Model & Routing$/m);
  assert.match(ref, /^### Self-Verify$/m);
  assert.ok(ref.length > 25000, "moved body looks truncated");
});

test("the documented init and compile commands run", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "svc-entry-"));
  try {
    const init = spawnSync(process.execPath, [path.join(root, "scripts/init-project-state.mjs")], { cwd: dir, encoding: "utf8" });
    assert.equal(init.status, 0, init.stderr);
    assert.ok(fs.existsSync(path.join(dir, ".svc")));
    const compile = [path.join(root, "scripts/compile-delivery-graph.mjs"),
      "--wi", "WI-1", "--lane", "greenfield", "--change-type", "feature", "--intent", "build the app",
      "--repo-mode", "bootstrap", "--risk-flags", "user-facing", "--out", ".svc/lane-tasks-WI-1.json"];
    const first = spawnSync(process.execPath, compile, { cwd: dir, encoding: "utf8" });
    assert.equal(first.status, 0, first.stderr);
    const graph = JSON.parse(fs.readFileSync(path.join(dir, ".svc/lane-tasks-WI-1.json"), "utf8"));
    const skills = graph.tasks.map((t) => t.skill || t.metadata?.skill);
    for (const s of ["plan-changeset", "review-plan", "execute-changeset", "review-exec", "audit-implementation", "land-changeset", "verify-promotion"]) {
      assert.ok(skills.includes(s), `lane graph lacks ${s}`);
    }
    const again = spawnSync(process.execPath, compile, { cwd: dir, encoding: "utf8" });
    assert.equal(again.status, 1, "second compile without --force must refuse");
    const forced = spawnSync(process.execPath, [...compile, "--force"], { cwd: dir, encoding: "utf8" });
    assert.equal(forced.status, 0, forced.stderr);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
