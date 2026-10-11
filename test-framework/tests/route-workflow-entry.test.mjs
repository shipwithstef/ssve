// @organism-suite
import assert from "node:assert/strict";
import crypto from "node:crypto";
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

// ---- Round 2 regressions (one per review finding) ----

const git = (cwd, env, ...args) => spawnSync("git", args, { cwd, env, encoding: "utf8" });
function freshWorktree(wi) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "svc-entry-home-"));
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "svc-entry-proj-"));
  const env = { ...process.env, HOME: home, SVC_SESSION_ID: crypto.randomUUID(), SVC_CHAIN_POLICY: "",
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
  git(proj, env, "init", "-q", "-b", "main");
  git(proj, env, "commit", "-q", "--allow-empty", "-m", "root");
  git(proj, env, "update-ref", "refs/remotes/origin/main", "HEAD");
  const w = spawnSync(process.execPath, [path.join(root, "scripts/svc-ensure-worktree.mjs"), "--wi", wi, "--branch", wi.toLowerCase(), "--from", "origin/main", "--json"], { cwd: proj, env, encoding: "utf8" });
  assert.equal(w.status, 0, w.stderr);
  const wt = JSON.parse(w.stdout).absolute_worktree;
  return { env: { ...env, SVC_ROOT: root }, wt, cleanup: () => { fs.rmSync(proj, { recursive: true, force: true }); fs.rmSync(home, { recursive: true, force: true }); fs.rmSync(wt, { recursive: true, force: true }); } };
}
const compileLine = (wi) => {
  const m = /`(grep -q '"delivery_graph"'[^`]*--force)`/.exec(body);
  assert.ok(m, "entry carries the guarded compile command");
  return m[1].replaceAll("lane-tasks-WI.json", `lane-tasks-${wi}.json`).replace("--wi WI ", `--wi ${wi} `)
    .replace("--lane LANE", "--lane greenfield").replace("--change-type TYPE", "--change-type feature")
    .replace('"ONE LINE"', '"build it"').replace("--repo-mode MODE", "--repo-mode bootstrap").replace("--risk-flags FLAGS ", "");
};

test("F1: validators that read the entry or the relocated procedure pass", () => {
  for (const v of ["validate-route-workflow-hot-path-size", "validate-intent-normalization-routing", "validate-post-deploy-evidence-lock", "validate-mid-task-correction-routing", "validate-markdown-ast"]) {
    const file = fs.existsSync(path.join(root, "test-framework/evals/tier-1", `${v}.sh`)) ? `${v}.sh` : `${v}.mjs`;
    const cmd = file.endsWith(".sh") ? ["bash", path.join(root, "test-framework/evals/tier-1", file)] : [process.execPath, path.join(root, "test-framework/evals/tier-1", file)];
    const r = spawnSync(cmd[0], cmd.slice(1), { cwd: root, encoding: "utf8" });
    assert.equal(r.status, 0, `${file}: ${r.stdout}${r.stderr}`.slice(-600));
  }
  const hot = fs.readFileSync(path.join(root, "test-framework/evals/tier-1/validate-route-workflow-hot-path-size.sh"), "utf8");
  assert.match(hot, /entry_body/, "hot-path validator now also bounds the entry");
});

test("F2: the placeholder graph is compiled once, a compiled graph is never recompiled", () => {
  const { env, wt, cleanup } = freshWorktree("WI-FIX-261011000001");
  try {
    const wi = "WI-FIX-261011000001";
    const graphPath = path.join(wt, ".svc", `lane-tasks-${wi}.json`);
    const placeholder = JSON.parse(fs.readFileSync(graphPath, "utf8"));
    assert.equal(placeholder.tasks.length, 1);
    assert.equal(placeholder.delivery_graph, undefined);
    const run = () => spawnSync("bash", ["-c", compileLine(wi)], { cwd: wt, env, encoding: "utf8" });
    const first = run();
    assert.equal(first.status, 0, first.stderr);
    const compiled = JSON.parse(fs.readFileSync(graphPath, "utf8"));
    assert.ok(compiled.delivery_graph && compiled.tasks.length > 1 && compiled.lane === "greenfield");
    compiled.tasks[0].status = "completed";
    fs.writeFileSync(graphPath, JSON.stringify(compiled, null, 2));
    const before = fs.readFileSync(graphPath, "utf8");
    const second = run();
    assert.equal(second.status, 0, second.stderr);
    assert.equal(fs.readFileSync(graphPath, "utf8"), before, "resume must not overwrite a compiled graph");
  } finally { cleanup(); }
});

test("F3: the session id is per session, never a shared repo file", () => {
  assert.doesNotMatch(body, /\.svc\/session-id/);
  assert.doesNotMatch(skill, /session-id\s*(>|\$\(cat)/);
  assert.match(body, /already in your environment/);
  assert.match(body, /SVC_SESSION_ID/);
  assert.match(body, /CLAUDE_SESSION_ID/);
  assert.match(body, /Never keep it in a file in the repo/);
});

test("F4: every new request gets a unique valid WI id; fixed ids are gone", () => {
  assert.match(body, /\$\(date -u \+%y%m%d%H%M%S\)/);
  assert.doesNotMatch(body, /\bWI-(FIX|FEAT|SEC|DOCS|1)\b/);
  const re = /^WI-[A-Z0-9]+(-[A-Z0-9]+)*$/;
  for (const prefix of ["DOCS", "SEC", "FIX", "FEAT", "NEW"]) {
    assert.ok(body.includes(`| ${prefix} |`), `table lists PREFIX ${prefix}`);
    assert.match(`WI-${prefix}-261011184200`, re);
  }
  assert.match(body, /reuse an id only to continue/);
});

test("F5: the route record is written inside the ensured worktree", () => {
  const worktree = body.indexOf("absolute_worktree");
  const record = body.indexOf("Write `.svc/route-record.json` here");
  assert.ok(worktree > 0 && record > worktree, "record is written after cd to the worktree");
  assert.match(body, /Record and compile, inside the worktree/);
  assert.doesNotMatch(body, /Take the first row that fits, then write `\.svc\/route-record\.json`/);
});
