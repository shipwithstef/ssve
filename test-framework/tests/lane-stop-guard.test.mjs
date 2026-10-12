// @organism-suite
// Lane continuation at Stop: scripts/lane-stop-guard.mjs, the completion-guard wiring, and the
// advisory-mode laneContinue carve-out in hooks/svc-hook-boundary.mjs. No model is involved.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test, before, after } from "node:test";
import { fileURLToPath } from "node:url";
import { missingEssential, chainSteps, runnableGap } from "../../scripts/lane-stop-guard.mjs";
import { classifyActiveIntent } from "../../hooks/lib/active-intent.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BOUNDARY = path.join(ROOT, "hooks", "svc-hook-boundary.mjs");
const GUARD_CMD = `bash ${path.join(ROOT, "hooks", "svc-task-completion-guard.sh")}`;
const LANE_CLI = path.join(ROOT, "scripts", "lane-stop-guard.mjs");
const REGISTRY = JSON.parse(fs.readFileSync(path.join(ROOT, "references", "stage-registry.json"), "utf8"));
const CHAIN = ["plan-changeset", "review-plan", "execute-changeset", "review-exec", "audit-implementation", "land-changeset", "verify-promotion"];

let scratch;
let counter = 0;
before(() => { scratch = fs.mkdtempSync(path.join(os.tmpdir(), "svc-lane-guard-")); });
after(() => { fs.rmSync(scratch, { recursive: true, force: true }); });

function mk(name) {
  const dir = path.join(scratch, `${name}-${counter += 1}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function task(id, skill, status = "pending", receipt = false) {
  return {
    id, subject: `${skill} fixture`, status, metadata: { skill },
    ...(receipt ? { skill_receipt: { skill, loaded_at: "2026-01-01T00:00:00Z", loaded_via: "fixture" } } : {}),
  };
}

function graph(done = []) {
  return {
    wi: "WI-T1", lane: "greenfield", created: "2026-01-01T00:00:00Z", status: "in_progress",
    tasks: CHAIN.map((skill, i) => (done.includes(skill) ? task(i + 1, skill, "completed", true) : task(i + 1, skill))),
  };
}

// A project with `git init` and no commit, the shape of a fresh user project.
function project({ lane = graph(), commit = false, emptyBindings = false } = {}) {
  const dir = mk("proj");
  spawnSync("git", ["init", "-q"], { cwd: dir });
  spawnSync("git", ["config", "user.email", "t@example.invalid"], { cwd: dir });
  spawnSync("git", ["config", "user.name", "t"], { cwd: dir });
  if (lane) {
    fs.mkdirSync(path.join(dir, ".svc"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".svc", "lane-tasks-WI-T1.json"), JSON.stringify(lane, null, 2));
  }
  if (emptyBindings) fs.mkdirSync(path.join(dir, ".svc", "bindings"), { recursive: true });
  if (commit) {
    fs.writeFileSync(path.join(dir, "spec.md"), "spec\n");
    spawnSync("git", ["add", "spec.md"], { cwd: dir });
    spawnSync("git", ["commit", "-q", "-m", "root"], { cwd: dir });
  }
  return dir;
}

function writeLane(dir, lane) {
  fs.writeFileSync(path.join(dir, ".svc", "lane-tasks-WI-T1.json"), JSON.stringify(lane, null, 2));
}

// An SVC_ROOT without scripts/svc-next.mjs forces the stage-registry fallback walk.
function emptySvcRoot() { return mk("svcroot-empty"); }
function stubSvcRoot(card, status) {
  const dir = mk("svcroot-stub");
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(dir, "scripts", "svc-next.mjs"),
    `const card = ${JSON.stringify(card)};\nprocess.stdout.write(card.join("\\n") + "\\n");\nprocess.exit(${status});\n`);
  return dir;
}

function baseEnv(extra = {}) {
  const home = mk("home");
  const runtime = path.join(mk("runtime"), "rt");
  fs.mkdirSync(runtime, { mode: 0o700 });
  const env = { ...process.env, HOME: home, SVC_RUNTIME_DIR: runtime, SVC_ROOT: emptySvcRoot(), ...extra };
  for (const k of ["SVC_HOOK_MODE", "SVC_WORKER_WI", "SVC_SESSION_ROLE", "SVC_COMPLETION_FAIL_OPEN", "NODE_TEST_CONTEXT"]) {
    if (!(k in extra)) delete env[k];
  }
  return env;
}

function viaBoundary(dir, payload, env, command = GUARD_CMD) {
  const spec = Buffer.from(JSON.stringify({ command, host: "claude", event: "Stop", timeoutMs: 120000 })).toString("base64url");
  const r = spawnSync(process.execPath, [BOUNDARY, "svc-completion-guard", "--spec", spec], {
    cwd: dir, env, input: JSON.stringify({ session_id: "sess-1", cwd: dir, hook_event_name: "Stop", ...payload }),
    encoding: "utf8", timeout: 120000,
  });
  let out = null;
  try { out = JSON.parse(r.stdout.trim().split("\n").filter(Boolean).pop() || "null"); } catch { out = null; }
  return { status: r.status, out, stdout: r.stdout, stderr: r.stderr };
}

const blocked = (r) => r.out && r.out.decision === "block";

test("A: no lane file -> quiet allow, default mode and explicit advisory", () => {
  const dir = project({ lane: null });
  for (const extra of [{}, { SVC_HOOK_MODE: "advisory" }]) {
    const r = viaBoundary(dir, {}, baseEnv(extra));
    assert.equal(r.status, 0);
    assert.ok(!r.out || r.out.decision === undefined, r.stdout);
  }
  assert.ok(!fs.existsSync(path.join(dir, ".svc")), "guard must not create .svc");
});

test("B: lane with plan pending and no commit -> laneContinue block survives advisory", () => {
  const dir = project();
  for (const extra of [{}, { SVC_HOOK_MODE: "advisory" }]) {
    const r = viaBoundary(dir, {}, baseEnv(extra));
    assert.equal(r.status, 0);
    assert.ok(blocked(r), r.stdout + r.stderr);
    assert.equal(r.out.laneContinue, true);
    assert.equal(r.out.next_skill, "plan-changeset");
    assert.deepEqual(r.out.missing, ["plan-manifest"]);
    assert.match(r.out.reason, /^SVC_LANE_CONTINUE next=plan-changeset missing=plan-manifest\. /);
    assert.doesNotMatch(r.stderr, /HEAD is unresolved/);
  }
});

test("C: stop_hook_active does not exempt an active lane", () => {
  const dir = project();
  const r = viaBoundary(dir, { stop_hook_active: true }, baseEnv());
  assert.ok(blocked(r), r.stdout + r.stderr);
  assert.equal(r.out.next_skill, "plan-changeset");
});

test("D and E: cap of 8 identical sets, then the set shrinking resets the counter", () => {
  const dir = project();
  const env = baseEnv();
  for (let n = 1; n <= 8; n += 1) assert.ok(blocked(viaBoundary(dir, {}, env)), `block ${n}`);
  const ninth = viaBoundary(dir, {}, env);
  assert.equal(ninth.status, 0);
  assert.ok(!ninth.out || ninth.out.decision === undefined, ninth.stdout);
  assert.match(ninth.stderr, /cap 8/);
  // E: the plan receipt lands; review-plan is now the gap and the counter starts over.
  writeLane(dir, graph(["plan-changeset"]));
  const next = viaBoundary(dir, {}, env);
  assert.ok(blocked(next), next.stdout + next.stderr);
  assert.equal(next.out.next_skill, "review-plan");
  assert.deepEqual(next.out.missing, ["review-plan"]);
  for (let n = 2; n <= 8; n += 1) assert.ok(blocked(viaBoundary(dir, {}, env)), `post-reset block ${n}`);
  assert.ok(!blocked(viaBoundary(dir, {}, env)));
});

test("F: committed HEAD, checker missing audit-implementation -> that type is missing; passing checker allows", () => {
  const dir = project({ lane: graph(CHAIN), commit: true });
  const stub = (body) => {
    const f = path.join(mk("checker"), "check.mjs");
    fs.writeFileSync(f, `process.stdout.write(JSON.stringify(${JSON.stringify(body)}));\nprocess.exit(${body.ok ? 0 : 1});\n`);
    return f;
  };
  const run = (checker) => {
    const r = spawnSync(process.execPath, [LANE_CLI, "--cwd", dir, "--checker", checker], {
      env: { ...process.env, SVC_ROOT: emptySvcRoot() }, encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout);
  };
  const failing = run(stub({ ok: false, results: [{ ok: false, type: "invalid", missing: ["audit-implementation: receipt is not an object"] }] }));
  assert.equal(failing.decision, "block");
  assert.equal(failing.next_skill, "audit-implementation");
  assert.ok(failing.missing.includes("audit-implementation"));
  const passing = run(stub({ ok: true, results: [{ ok: true, type: "complete", missing: [] }] }));
  assert.equal(passing.decision, "allow");
  // The real checker with no receipt notes at all: the plan is the first gap even though tasks look done.
  const real = viaBoundary(dir, {}, baseEnv());
  assert.ok(blocked(real), real.stdout + real.stderr);
  assert.equal(real.out.next_skill, "plan-changeset");
});

test("G: every other Stop block is still removed in advisory mode", () => {
  const dir = project({ lane: null });
  const stubDir = mk("stubs");
  const emit = (name, obj) => {
    const f = path.join(stubDir, name);
    fs.writeFileSync(f, `process.stdout.write(${JSON.stringify(JSON.stringify(obj))});\n`);
    return `node ${f}`;
  };
  const env = baseEnv({ SVC_HOOK_MODE: "advisory" });
  const other = viaBoundary(dir, {}, env, emit("other-hook.mjs", { decision: "block", reason: "other" }));
  assert.equal(other.out?.decision, undefined, other.stdout);
  const lane = { decision: "block", laneContinue: true, reason: "SVC_LANE_CONTINUE next=plan-changeset missing=plan-manifest. x" };
  // laneContinue from a command that is not the completion guard is not trusted.
  const spoof = viaBoundary(dir, {}, env, emit("some-other-hook.mjs", lane));
  assert.equal(spoof.out?.decision, undefined, spoof.stdout);
  // The completion guard without the marker or without the reason prefix is stripped too.
  const noFlag = viaBoundary(dir, {}, env, emit("svc-task-completion-guard-stub.mjs", { decision: "block", reason: lane.reason }));
  assert.equal(noFlag.out?.decision, undefined, noFlag.stdout);
  const noPrefix = viaBoundary(dir, {}, env, emit("svc-task-completion-guard-stub2.mjs", { decision: "block", laneContinue: true, reason: "pending tasks" }));
  assert.equal(noPrefix.out?.decision, undefined, noPrefix.stdout);
  const kept = viaBoundary(dir, {}, env, emit("svc-task-completion-guard-stub3.mjs", lane));
  assert.equal(kept.out?.decision, "block");
});

test("H: an empty .svc/bindings/ directory does not silence an active lane", () => {
  const dir = project({ emptyBindings: true });
  const r = viaBoundary(dir, {}, baseEnv());
  assert.ok(blocked(r), r.stdout + r.stderr);
  assert.equal(r.out.next_skill, "plan-changeset");
});

test("svc-next present: exit 5 card drives the block; done and no-graph allow", () => {
  const dir = project();
  const owed = stubSvcRoot(["STATUS not_done", "SKILL review-plan", "TASK 2", "MISSING review-plan"], 5);
  const r = viaBoundary(dir, {}, baseEnv({ SVC_ROOT: owed }));
  assert.ok(blocked(r), r.stdout + r.stderr);
  assert.equal(r.out.next_skill, "review-plan");
  assert.deepEqual(r.out.missing, ["review-plan"]);
  assert.equal(r.out.reason, "SVC_LANE_CONTINUE next=review-plan missing=review-plan. Run that skill now and follow its handback; do not ask the user.");
  const next = stubSvcRoot(["STATUS next", "SKILL execute-changeset", "MISSING -"], 0);
  const n = viaBoundary(project(), {}, baseEnv({ SVC_ROOT: next }));
  assert.ok(blocked(n), n.stdout);
  assert.equal(n.out.next_skill, "execute-changeset");
  for (const [card, code] of [[["STATUS done", "SKILL -", "MISSING -"], 0], [["STATUS not_done"], 3]]) {
    const q = viaBoundary(project(), {}, baseEnv({ SVC_ROOT: stubSvcRoot(card, code) }));
    assert.ok(!blocked(q), q.stdout);
  }
});

test("subagent and reviewer sessions can always end", () => {
  const dir = project();
  const sub = viaBoundary(dir, { parent_session_id: "parent-1" }, baseEnv());
  assert.ok(!blocked(sub), sub.stdout);
  const subStop = viaBoundary(dir, { hook_event_name: "SubagentStop", agent_type: "subagent" }, baseEnv());
  assert.ok(!blocked(subStop), subStop.stdout);
  const rev = viaBoundary(dir, { session_role: "reviewer" }, baseEnv());
  assert.ok(!blocked(rev), rev.stdout);
  const viaEnv = viaBoundary(dir, {}, baseEnv({ SVC_SESSION_ROLE: "adversarial" }));
  assert.ok(!blocked(viaEnv), viaEnv.stdout);
});

test("archived and ambiguous lanes stay quiet", () => {
  const dir = project({ lane: null });
  fs.mkdirSync(path.join(dir, ".svc"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".svc", "lane-tasks-WI-T1.completed-12.json"), JSON.stringify(graph()));
  assert.ok(!blocked(viaBoundary(dir, {}, baseEnv())));
  fs.writeFileSync(path.join(dir, ".svc", "lane-tasks-WI-A.json"), JSON.stringify({ ...graph(), wi: "WI-A" }));
  fs.writeFileSync(path.join(dir, ".svc", "lane-tasks-WI-B.json"), JSON.stringify({ ...graph(), wi: "WI-B" }));
  assert.ok(!blocked(viaBoundary(dir, {}, baseEnv())));
});

test("missingEssential walks the registry chain in order", () => {
  assert.deepEqual(chainSteps(REGISTRY), CHAIN);
  assert.deepEqual(missingEssential(graph(CHAIN), REGISTRY, null), []);
  assert.deepEqual(missingEssential(graph(), REGISTRY, null).map((m) => m.skill), CHAIN);
  assert.deepEqual(missingEssential(graph(["plan-changeset"]), REGISTRY, null)[0], { skill: "review-plan", type: "review-plan" });
  // A completed task without a skill_receipt is not satisfied.
  const bare = graph(CHAIN);
  delete bare.tasks[0].skill_receipt;
  assert.equal(missingEssential(bare, REGISTRY, null)[0].skill, "plan-changeset");
  // Receipts on HEAD satisfy a step whose task was never closed.
  const idx = { ok: true, requiredTypes: ["plan-manifest", "review-plan", "exec-record", "review-exec", "audit-implementation"], missingTypes: [] };
  assert.deepEqual(missingEssential(graph(), REGISTRY, idx).map((m) => m.skill), ["land-changeset", "verify-promotion"]);
  // A graph with no chain skills is not a delivery lane.
  assert.deepEqual(missingEssential({ tasks: [task(1, "write-spec")] }, REGISTRY, null), []);
});

test("R1-1: a recorded pause or stop intent suppresses continuation; a negated or feature use does not", () => {
  for (const [text, suppress] of [
    ["pause everything for now", true], ["please halt", true], ["stand down", true], ["stop", true],
    ["don't pause, keep going", false], ["add a pause button to the game", false], ["handle the abort signal", false],
  ]) assert.equal(classifyActiveIntent(text).suppress, suppress, text);
  const record = (dir, prompt) => {
    const r = spawnSync(process.execPath, [path.join(ROOT, "hooks", "lib", "active-intent.mjs"), "record"], {
      cwd: dir, input: JSON.stringify({ prompt, session_id: "sess-1", cwd: dir }), encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout;
  };
  const dir = project();
  assert.ok(blocked(viaBoundary(dir, {}, baseEnv())), "lane blocks before any pause request");
  assert.match(record(dir, "pause, I need to think about this"), /^suppressed\tpause/);
  const r = viaBoundary(dir, {}, baseEnv());
  assert.ok(!blocked(r), r.stdout + r.stderr);
  const other = project();
  assert.match(record(other, "actually don't pause, carry on"), /^recorded/);
  assert.ok(blocked(viaBoundary(other, {}, baseEnv())));
});

test("R1-2: an explicit WI target applies to a single legacy graph too", () => {
  const dir = project();
  assert.ok(!blocked(viaBoundary(dir, {}, baseEnv({ SVC_WORKER_WI: "WI-OTHER" }))), "env target elsewhere");
  assert.ok(!blocked(viaBoundary(dir, { wi: "WI-OTHER" }, baseEnv())), "payload target elsewhere");
  assert.ok(blocked(viaBoundary(dir, { wi: "WI-T1" }, baseEnv())), "payload target here");
  assert.ok(blocked(viaBoundary(dir, {}, baseEnv({ SVC_WORKER_WI: "WI-T1" }))), "env target here");
  // A WI branch that names a different WI also points elsewhere.
  spawnSync("git", ["checkout", "-q", "-b", "WI-77-other"], { cwd: dir });
  assert.ok(!blocked(viaBoundary(dir, {}, baseEnv())), "branch target elsewhere");
});

test("R1-3: SVC_SUBAGENT=1 marks a child session that can always end", () => {
  const dir = project();
  const r = viaBoundary(dir, {}, baseEnv({ SVC_SUBAGENT: "1" }));
  assert.ok(!blocked(r), r.stdout + r.stderr);
  assert.ok(blocked(viaBoundary(dir, {}, baseEnv())));
});

test("R2-1: negated continuation is not a resume, and an explicit stop or pause wins", () => {
  for (const [text, want] of [
    ["Do not continue WI-123; pause everything", true],
    ["don't continue WI-123, stop", true],
    ["never resume WI-5, halt", true],
    ["continue WI-123", false],
    ["continue with WI-12 and stop asking questions", false],
    ["resume WI-479", false],
  ]) assert.equal(classifyActiveIntent(text).suppress, want, text);
  const generic = project();
  assert.ok(blocked(viaBoundary(generic, {}, baseEnv())));
  spawnSync(process.execPath, [path.join(ROOT, "hooks", "lib", "active-intent.mjs"), "record"], {
    cwd: generic, input: JSON.stringify({ prompt: "Do not continue, pause everything", session_id: "sess-1", cwd: generic }), encoding: "utf8",
  });
  const r = viaBoundary(generic, {}, baseEnv());
  assert.ok(!blocked(r), r.stdout + r.stderr);
});

test("R2-2: only a runnable compiled task is ordered; blocked or prerequisite-pending chains allow Stop", () => {
  const steps = (g) => missingEssential(g, REGISTRY, null);
  // plan-changeset runnable
  assert.equal(runnableGap(graph(), steps(graph())).skill, "plan-changeset");
  // plan-changeset explicitly blocked and everything after it waits on it: nothing can run
  const blockedPlan = graph();
  blockedPlan.tasks.forEach((t, i) => { t.blocked_by = i === 0 ? [] : [i]; });
  blockedPlan.tasks[0].status = "blocked";
  assert.equal(runnableGap(blockedPlan, steps(blockedPlan)), null);
  // plan done, review-plan pending but its prerequisite chain is intact -> review-plan
  const chained = graph(["plan-changeset"]);
  chained.tasks.forEach((t, i) => { t.blocked_by = i === 0 ? [] : [i]; });
  assert.equal(runnableGap(chained, steps(chained)).skill, "review-plan");
  // an upstream non-chain prerequisite still pending: plan-changeset is not startable yet
  const upstream = graph();
  upstream.tasks.unshift(task(99, "write-spec"));
  upstream.tasks.find((t) => t.metadata.skill === "plan-changeset").blocked_by = [99];
  upstream.tasks.forEach((t) => { if (t.metadata.skill !== "plan-changeset" && t.metadata.skill !== "write-spec") t.blocked_by = [99]; });
  assert.equal(runnableGap(upstream, steps(upstream)), null);
  const dir = project({ lane: upstream });
  const r = viaBoundary(dir, {}, baseEnv());
  assert.ok(!blocked(r), r.stdout + r.stderr);
  const dir2 = project({ lane: blockedPlan });
  assert.ok(!blocked(viaBoundary(dir2, {}, baseEnv())));
});

test("R2-3: lane discovery stops at the current Git worktree", () => {
  const outer = project();
  const inner = path.join(outer, "nested-project");
  fs.mkdirSync(inner);
  spawnSync("git", ["init", "-q"], { cwd: inner });
  const r = viaBoundary(inner, { cwd: inner }, baseEnv());
  assert.ok(!blocked(r), "an enclosing repository's lane is not ours: " + r.stdout);
  // A plain subdirectory of the same worktree still finds its lane.
  const sub = path.join(outer, "src");
  fs.mkdirSync(sub);
  assert.ok(blocked(viaBoundary(sub, { cwd: sub }, baseEnv())));
  // Outside Git entirely, a parent directory's lane is not inherited either.
  const loose = mk("loose");
  fs.mkdirSync(path.join(loose, ".svc"));
  fs.writeFileSync(path.join(loose, ".svc", "lane-tasks-WI-T1.json"), JSON.stringify(graph()));
  const child = path.join(loose, "child");
  fs.mkdirSync(child);
  const out = spawnSync(process.execPath, [LANE_CLI, "--cwd", child], { env: { ...process.env, SVC_ROOT: emptySvcRoot() }, encoding: "utf8" });
  assert.equal(JSON.parse(out.stdout).decision, "allow");
});

test("R2-4: feature work that mentions pause and resume is not a pause request", () => {
  for (const t of ["Implement pause and resume for the video player", "add a pause/resume toggle", "build pause handling for the game loop"]) {
    assert.equal(classifyActiveIntent(t).suppress, false, t);
  }
  for (const t of ["pause", "please pause now", "pause everything"]) assert.equal(classifyActiveIntent(t).suppress, true, t);
});

test("R3-1: a negated continuation classifies as suppressing intent", () => {
  for (const t of ["Do not continue WI-123", "don't resume WI-45 please", "never proceed with WI-9000"]) {
    const c = classifyActiveIntent(t);
    assert.equal(c.suppress, true, t);
    assert.equal(c.classification, "stop", t);
  }
  assert.equal(classifyActiveIntent("continue WI-123").suppress, false);
  const dir = project({ lane: { ...graph(), wi: "WI-123" } });
  assert.ok(blocked(viaBoundary(dir, {}, baseEnv())));
  const rec = spawnSync(process.execPath, [path.join(ROOT, "hooks", "lib", "active-intent.mjs"), "record"], {
    cwd: dir, input: JSON.stringify({ prompt: "Do not continue WI-123", session_id: "sess-1", cwd: dir }), encoding: "utf8",
  });
  assert.equal(rec.status, 0, rec.stderr);
  const r = viaBoundary(dir, {}, baseEnv());
  assert.ok(!blocked(r), r.stdout + r.stderr);
});

test("R3-2: an explicit pause clause survives feature-work wording in the same sentence", () => {
  for (const t of ["Fix this later, pause everything for now", "Fix this later and pause everything", "Add the login page. Pause everything."]) {
    assert.equal(classifyActiveIntent(t).suppress, true, t);
  }
  for (const t of ["implement pause and resume for the video player", "Add a pause/resume toggle to the player"]) {
    assert.equal(classifyActiveIntent(t).suppress, false, t);
  }
});

test("R3-3: bare receipt types from the checker are recognized before the all-missing fallback", () => {
  const dir = project({ lane: graph(CHAIN), commit: true });
  const f = path.join(mk("checker"), "check.mjs");
  fs.writeFileSync(f, `process.stdout.write(JSON.stringify({ ok: false, results: [{ ok: false, type: "invalid", missing: ["audit-implementation"] }] }));\nprocess.exit(1);\n`);
  const r = spawnSync(process.execPath, [LANE_CLI, "--cwd", dir, "--checker", f], { env: { ...process.env, SVC_ROOT: emptySvcRoot() }, encoding: "utf8" });
  const out = JSON.parse(r.stdout);
  assert.equal(out.decision, "block");
  assert.equal(out.next_skill, "audit-implementation");
  assert.deepEqual(out.missing, ["audit-implementation"]);
});

test("R3-4: the shell guard is silent for a nested repository without a lane, in every mode", () => {
  const outer = project();
  const inner = path.join(outer, "nested-project");
  fs.mkdirSync(inner);
  spawnSync("git", ["init", "-q"], { cwd: inner });
  for (const extra of [{}, { SVC_HOOK_MODE: "enforce" }]) {
    const r = viaBoundary(inner, { cwd: inner }, baseEnv(extra));
    assert.equal(r.status, 0, r.stderr);
    assert.ok(!r.out || r.out.decision === undefined, JSON.stringify(extra) + r.stdout + r.stderr);
  }
  // The outer project itself still gets the continuation, enforce mode included.
  assert.ok(blocked(viaBoundary(outer, {}, baseEnv({ SVC_HOOK_MODE: "enforce" }))));
});
