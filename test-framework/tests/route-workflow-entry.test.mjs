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

test("F3: the session id is per session, never a shared repo file", () => {
  assert.doesNotMatch(body, /\.svc\/session-id/);
  assert.doesNotMatch(skill, /session-id\s*(>|\$\(cat)/);
  assert.match(body, /already in your environment/);
  assert.match(body, /SVC_SESSION_ID/);
  assert.match(body, /CLAUDE_SESSION_ID/);
  assert.match(body, /Never keep it in a file in the repo/);
});

test("F5: the route record is written inside the ensured worktree", () => {
  const worktree = body.indexOf("absolute_worktree");
  const record = body.indexOf("Write `.svc/route-record.json` here");
  assert.ok(worktree > 0 && record > worktree, "record is written after cd to the worktree");
  assert.match(body, /Record and compile, inside the worktree/);
  assert.doesNotMatch(body, /Take the first row that fits, then write `\.svc\/route-record\.json`/);
});

// ---- Round 3 regressions ----

const backtick = (re, what) => { const m = re.exec(body); assert.ok(m, `entry carries ${what}`); return m[1]; };
const checkCmd = () => backtick(/(node -e 'let g;try[^`]*?\.svc\/lane-tasks-WI\.json)`/, "the graph check");
const classify = (graphPath, cwd) => spawnSync("bash", ["-c", checkCmd().replace(".svc/lane-tasks-WI.json", graphPath)], { cwd, encoding: "utf8" }).stdout.trim();
const compileBase = (wi, extra = []) => [path.join(root, "scripts/compile-delivery-graph.mjs"), "--wi", wi, "--lane", "greenfield", "--change-type", "feature",
  "--intent", "build it", "--repo-mode", "bootstrap", "--out", `.svc/lane-tasks-${wi}.json`, ...extra];

test("R3-2: only the exact one-task placeholder is overwritten; legacy and compiled graphs are kept", () => {
  const wi = "WI-NEW-R3A";
  const { env, wt, cleanup } = freshWorktree(wi);
  try {
    const rel = `.svc/lane-tasks-${wi}.json`;
    const abs = path.join(wt, rel);
    assert.equal(classify(rel, wt), "placeholder");
    assert.equal(classify(".svc/nope.json", wt), "missing");
    const c = spawnSync(process.execPath, [...compileBase(wi), "--force"], { cwd: wt, env, encoding: "utf8" });
    assert.equal(c.status, 0, c.stderr);
    assert.equal(classify(rel, wt), "compiled");
    // A legacy multi-task graph (no delivery_graph) must be classified legacy, never placeholder.
    const legacy = { schema_version: 1, wi, lane: "greenfield", tasks: [
      { id: 1, status: "completed", skill: "route-workflow" }, { id: 2, status: "in_progress", skill: "write-spec", evidence: "kept" }] };
    fs.writeFileSync(abs, JSON.stringify(legacy));
    assert.equal(classify(rel, wt), "legacy");
    // One task that is not route-workflow is not the placeholder either.
    fs.writeFileSync(abs, JSON.stringify({ wi, lane: "bugfix", tasks: [{ id: 1, status: "pending", skill: "diagnose-bug" }] }));
    assert.equal(classify(rel, wt), "legacy");
    assert.match(body, /`compiled` or `legacy`: do not compile/);
    assert.match(body, /`placeholder`: compile with `--force`/);
  } finally { cleanup(); }
});

test("R3-1: continuation reuses the existing worktree and branch, not one rebuilt from the WI", () => {
  const wi = "WI-FIX-R3B";
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "svc-entry-home-"));
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "svc-entry-proj-"));
  const env = { ...process.env, HOME: home, SVC_SESSION_ID: crypto.randomUUID(), SVC_CHAIN_POLICY: "",
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
  git(proj, env, "init", "-q", "-b", "main");
  git(proj, env, "commit", "-q", "--allow-empty", "-m", "root");
  git(proj, env, "update-ref", "refs/remotes/origin/main", "HEAD");
  const ensure = (branch) => spawnSync(process.execPath, [path.join(root, "scripts/svc-ensure-worktree.mjs"), "--wi", wi, "--branch", branch, "--from", "origin/main", "--json"], { cwd: proj, env, encoding: "utf8" });
  let wt;
  try {
    const first = ensure("bugfix-r3b-legacy");
    assert.equal(first.status, 0, first.stderr);
    wt = JSON.parse(first.stdout).absolute_worktree;
    // Discovery exactly as the entry documents it.
    assert.match(body, /git worktree list --porcelain/);
    assert.match(body, /git -C <that worktree> branch --show-current/);
    assert.match(body, /never a branch rebuilt from the WI/);
    const listed = git(proj, env, "worktree", "list", "--porcelain").stdout.split("\n").filter((l) => l.startsWith("worktree ")).map((l) => l.slice(9));
    const graph = listed.flatMap((w) => fs.existsSync(path.join(w, ".svc")) ? fs.readdirSync(path.join(w, ".svc")).filter((f) => /^lane-tasks-.*\.json$/.test(f)).map((f) => path.join(w, ".svc", f)) : [])[0];
    assert.ok(graph, "graph found through worktree list");
    const foundWi = path.basename(graph).replace(/^lane-tasks-|\.json$/g, "");
    assert.equal(foundWi, wi);
    const branch = git(path.dirname(path.dirname(graph)), env, "branch", "--show-current").stdout.trim();
    assert.equal(branch, "bugfix-r3b-legacy");
    const resumed = ensure(branch);
    assert.equal(resumed.status, 0, resumed.stderr);
    const r = JSON.parse(resumed.stdout);
    assert.equal(r.absolute_worktree, wt);
    assert.equal(r.resumed, true);
    assert.notEqual(branch, wi.toLowerCase(), "the branch is not derivable from the WI");
  } finally {
    fs.rmSync(proj, { recursive: true, force: true }); fs.rmSync(home, { recursive: true, force: true }); if (wt) fs.rmSync(wt, { recursive: true, force: true });
  }
});

test("R3-3: the entry keeps mid-task correction handling and the validator checks both paths", () => {
  assert.match(body, /method-correction/);
  assert.match(body, /A correction keeps its WI, branch and graph: do not start a new lane/);
  assert.match(body, /Only a new goal gets a new WI/);
  const v = fs.readFileSync(path.join(root, "test-framework/evals/tier-1/validate-mid-task-correction-routing.sh"), "utf8");
  assert.match(v, /ENTRY=/);
  assert.match(v, /require_fixed "\$ENTRY" "method-correction"/);
  assert.match(v, /require_fixed "\$ROUTER" "method-correction"/);
});

test("R3-4: post-deploy proof reaches compilation as a required deploy evidence family", () => {
  assert.match(body, /add the risk flag `deploy-affecting`/);
  assert.match(body, /post_deploy_proof/);
  assert.match(body, /only after deployment against the live URL/);
  assert.match(body, /post-deploy PROOF was not run/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "svc-entry-pd-"));
  try {
    const run = (extra, out) => spawnSync(process.execPath, [...compileBase("WI-FIX-R3C", extra).slice(0, 11), "--out", out, ...extra], { cwd: dir, encoding: "utf8" });
    assert.equal(run(["--risk-flags", "deploy-affecting"], "with.json").status, 0);
    assert.equal(run([], "without.json").status, 0);
    const family = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).delivery_graph.evidence_families.deploy;
    assert.equal(family("with.json"), "required");
    assert.equal(family("without.json"), "n/a");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  const v = fs.readFileSync(path.join(root, "test-framework/evals/tier-1/validate-post-deploy-evidence-lock.sh"), "utf8");
  assert.match(v, /ENTRY=.*route-workflow\/SKILL\.md/);
  assert.match(v, /post_deploy_proof/);
});

test("R3-5: WI ids from concurrent same-second allocations are unique and valid", () => {
  const cmd = backtick(/(node -e 'console\.log\(Date\.now\(\)[^`]*?randomBytes[^`]*?\)')`/, "the id allocator");
  const outs = new Set();
  const re = /^WI-FIX-[A-Z0-9]+$/;
  const runs = [];
  for (let i = 0; i < 40; i++) runs.push(spawnSync("bash", ["-c", cmd], { encoding: "utf8" }).stdout.trim());
  for (const suffix of runs) { assert.match(`WI-FIX-${suffix}`, re); outs.add(suffix); }
  assert.equal(outs.size, runs.length, "no duplicate ids");
  assert.doesNotMatch(body, /%y%m%d%H%M%S/);
  assert.match(body, /Reuse an id only to continue work/);
  assert.doesNotMatch(body, /\bWI-(FIX|FEAT|SEC|DOCS|1)\b/);
});
