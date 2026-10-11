// @organism-suite
// Prerequisite stages (personas, journeys, e2e, journey proof, technical design) must
// be ordered before land-changeset and verify-promotion in every lane and profile.
// Review 6108295955 on PR #127: a production graph put write-e2e and test-journeys
// after promotion, and the validator passed it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { compileDeliveryGraph } from "../../scripts/compile-delivery-graph.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LANES = ["greenfield", "brownfield-feature", "bugfix", "drift", "refactor", "framework", "brownfield-conversion"];
const PROFILES = [undefined, "prototype", "mvp", "production"];
const SCENARIOS = {
  plain: { change_type: "feature", risk_flags: [] },
  "user-facing": { change_type: "feature", risk_flags: ["user-facing", "browser-visible"] },
  admin: { change_type: "feature", risk_flags: ["admin-facing"] },
  technical: { change_type: "feature", risk_flags: ["backend-function", "data-model-change", "deploy-affecting"] },
  docs: { change_type: "docs", risk_flags: ["docs-only"] },
};
const PREREQUISITES = ["build-personas", "write-journeys", "write-e2e", "test-journeys", "design-tech"];
const LATE = ["land-changeset", "verify-promotion"];

const skillOf = (t) => t.metadata.skill;
const compile = (lane, profile, scenario) => compileDeliveryGraph({
  wi: "WI-ORD-1", lane, user_intent: "ordering matrix", planned_files: ["src/app/page.tsx"],
  ...(profile ? { delivery_profile: profile } : {}), ...SCENARIOS[scenario],
});

function ordering(graph) {
  const order = graph.tasks.map(skillOf);
  const late = Math.min(...LATE.map((s) => order.indexOf(s)).filter((i) => i >= 0));
  const problems = [];
  graph.tasks.forEach((task, index) => {
    if (PREREQUISITES.includes(skillOf(task)) && index > late) problems.push(`${skillOf(task)} is ordered after ${order[late]}`);
    for (const step of task.metadata.required_process_steps || []) {
      if (!PREREQUISITES.includes(step.skill)) continue;
      if (index > late) problems.push(`process step ${step.skill} is owned by a task after ${order[late]}`);
      if (LATE.includes(step.before)) problems.push(`process step ${step.skill} runs before ${step.before}`);
    }
  });
  return problems;
}

function validate(graph) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ord-"));
  try {
    const file = path.join(dir, "g.json");
    fs.writeFileSync(file, JSON.stringify(graph));
    const r = spawnSync(process.execPath, [path.join(ROOT, "scripts/validate-delivery-graph.mjs"), file, "--registry", path.join(ROOT, "references/skip-conditions.json")], { encoding: "utf8" });
    return { status: r.status, out: r.stdout + r.stderr };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test("T3 reproduction: a production product puts write-e2e and test-journeys before land", () => {
  const g = compileDeliveryGraph({ wi: "WI-T", user_intent: "yoga studio booking app", lane: "greenfield", delivery_profile: "production", change_type: "feature", planned_files: ["src/app/page.tsx"], risk_flags: ["user-facing", "browser-visible"] });
  const order = g.tasks.map(skillOf);
  assert.equal(order.at(-1), "verify-promotion");
  for (const s of ["write-e2e", "test-journeys"]) {
    const direct = order.indexOf(s);
    const owned = g.tasks.findIndex((t) => (t.metadata.required_process_steps || []).some((p) => p.skill === s));
    const where = direct >= 0 ? direct : owned;
    assert.ok(where >= 0 && where < order.indexOf("land-changeset"), `${s} must be before land-changeset`);
  }
});

for (const lane of LANES) for (const profile of PROFILES) for (const scenario of Object.keys(SCENARIOS)) {
  test(`no prerequisite after promotion: ${lane} / ${profile || "default"} / ${scenario}`, () => {
    const g = compile(lane, profile, scenario);
    assert.deepEqual(ordering(g), []);
    const v = validate(g);
    assert.equal(v.status, 0, v.out);
  });
}

test("which skills are compiled does not change: user-facing production keeps persona, e2e and journey proof", () => {
  const g = compile("brownfield-feature", "production", "user-facing");
  for (const s of ["build-personas", "write-e2e", "test-journeys"]) assert.ok(g.delivery_graph.required_skills.includes(s), s);
});

test("personas and technical design are ordered before plan-changeset", () => {
  const g = compile("brownfield-feature", "production", "user-facing");
  const order = g.tasks.map(skillOf);
  assert.ok(order.indexOf("build-personas") < order.indexOf("write-spec"));
  const tech = compile("bugfix", "production", "technical").tasks.map(skillOf);
  assert.ok(tech.indexOf("design-tech") < tech.indexOf("plan-changeset"));
});

test("validator rejects a hand-made graph with prerequisites after promotion", () => {
  const g = compile("greenfield", "production", "user-facing");
  // Re-create the defect: e2e and journeys as top-level tasks after verify-promotion.
  const execute = g.tasks.find((t) => skillOf(t) === "execute-changeset");
  execute.metadata.required_process_steps = (execute.metadata.required_process_steps || []).filter((p) => !["write-e2e", "test-journeys"].includes(p.skill));
  const last = g.tasks.at(-1).id;
  g.tasks.push({ id: last + 1, subject: "write-e2e", status: "pending", blocked_by: [last], metadata: { skill: "write-e2e" } });
  g.tasks.push({ id: last + 2, subject: "test-journeys", status: "pending", blocked_by: [last + 1], metadata: { skill: "test-journeys" } });
  const v = validate(g);
  assert.equal(v.status, 1, v.out);
  assert.match(v.out, /write-e2e.*after (land-changeset|verify-promotion)/);
  assert.match(v.out, /test-journeys.*after (land-changeset|verify-promotion)/);
});

test("validator rejects a prerequisite process step that runs before verify-promotion", () => {
  const g = compile("greenfield", "production", "user-facing");
  const execute = g.tasks.find((t) => skillOf(t) === "execute-changeset");
  for (const p of execute.metadata.required_process_steps || []) if (p.skill === "test-journeys") p.before = "verify-promotion";
  const v = validate(g);
  assert.equal(v.status, 1, v.out);
  assert.match(v.out, /test-journeys.*verify-promotion/);
});

test("validator rejects a prerequisite process step owned by a task after land-changeset", () => {
  const g = compile("greenfield", "production", "user-facing");
  const execute = g.tasks.find((t) => skillOf(t) === "execute-changeset");
  const moved = (execute.metadata.required_process_steps || []).filter((p) => p.skill === "write-e2e");
  execute.metadata.required_process_steps = execute.metadata.required_process_steps.filter((p) => p.skill !== "write-e2e");
  g.tasks.find((t) => skillOf(t) === "verify-promotion").metadata.required_process_steps = moved;
  const v = validate(g);
  assert.equal(v.status, 1, v.out);
  assert.match(v.out, /write-e2e/);
});

test("validator rejects a prerequisite process step owned by land-changeset itself", () => {
  const g = compile("greenfield", "production", "user-facing");
  const execute = g.tasks.find((t) => skillOf(t) === "execute-changeset");
  const moved = (execute.metadata.required_process_steps || []).filter((p) => p.skill === "write-e2e");
  execute.metadata.required_process_steps = execute.metadata.required_process_steps.filter((p) => p.skill !== "write-e2e");
  g.tasks.find((t) => skillOf(t) === "land-changeset").metadata.required_process_steps = moved;
  const v = validate(g);
  assert.equal(v.status, 1, v.out);
  assert.match(v.out, /write-e2e.*strictly precede/);
});

// ---- resuming a graph compiled before this ordering existed ----------------------------
const INPUT = { wi: "WI-ORD-1", lane: "brownfield-feature", user_intent: "ordering matrix", planned_files: ["src/app/page.tsx"], delivery_profile: "production", change_type: "feature", risk_flags: ["user-facing", "browser-visible"] };

function cyclic(tasks) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const state = new Map();
  const visit = (id) => {
    if (!byId.has(id) || state.get(id) === 2) return false;
    if (state.get(id) === 1) return true;
    state.set(id, 1);
    const hit = (byId.get(id).blocked_by || []).some(visit);
    state.set(id, 2);
    return hit;
  };
  return tasks.some((t) => visit(t.id));
}

// The old compiler appended personas, write-e2e and test-journeys after verify-promotion.
function legacyGraph({ legacyStatus, rest }) {
  const g = compileDeliveryGraph(INPUT);
  const take = (skill) => g.tasks.splice(g.tasks.findIndex((t) => skillOf(t) === skill), 1)[0];
  const personas = take("build-personas");
  const execute = g.tasks.find((t) => skillOf(t) === "execute-changeset");
  execute.metadata.required_process_steps = (execute.metadata.required_process_steps || []).filter((p) => !["write-e2e", "test-journeys"].includes(p.skill));
  g.tasks.forEach((t, i) => { t.id = i + 1; t.blocked_by = i === 0 ? [] : [i]; t.status = rest; });
  let last = g.tasks.length;
  for (const entry of [personas, { metadata: { skill: "write-e2e" } }, { metadata: { skill: "test-journeys" } }]) {
    g.tasks.push({ id: last + 1, subject: skillOf(entry), status: legacyStatus, blocked_by: [last], metadata: { skill: skillOf(entry) } });
    last += 1;
  }
  return g;
}

function resume(old) {
  const next = compileDeliveryGraph({ ...INPUT, existing_graph: old });
  const v = validate(next);
  return { next, v };
}

for (const [legacyStatus, rest] of [["pending", "pending"], ["pending", "completed"], ["completed", "completed"]]) {
  test(`resuming a legacy graph (prerequisites ${legacyStatus}, chain ${rest}) has no cycle and passes the validator`, () => {
    const { next, v } = resume(legacyGraph({ legacyStatus, rest }));
    assert.equal(cyclic(next.tasks), false, "dependency cycle");
    assert.equal(v.status, 0, v.out);
    const order = next.tasks.map(skillOf);
    assert.ok(order.indexOf("build-personas") < order.indexOf("write-spec"));
    assert.equal(order.at(-1), "verify-promotion");
    for (const s of ["write-e2e", "test-journeys"]) assert.equal(order.includes(s), false, `${s} has no runnable top-level task`);
    assert.deepEqual(ordering(next), []);
  });
}

test("legacy e2e/journey tasks are archived as history, not kept executable", () => {
  const { next } = resume(legacyGraph({ legacyStatus: "completed", rest: "completed" }));
  const archived = next.delivery_graph.migrated_prerequisites;
  assert.deepEqual(archived.map((r) => r.task.metadata.skill).sort(), ["test-journeys", "write-e2e"]);
  assert.ok(archived.every((r) => r.task.status === "completed" && /not executable/.test(r.disposition)));
  const again = compileDeliveryGraph({ ...INPUT, existing_graph: next });
  assert.equal(again.delivery_graph.migrated_prerequisites.length, 2, "history is carried forward, not duplicated");
});

for (const legacyStatus of ["pending", "completed"]) {
  test(`a completed execute-changeset gaining process steps is reopened with its dependents (legacy ${legacyStatus})`, () => {
    const { next } = resume(legacyGraph({ legacyStatus, rest: "completed" }));
    const status = (s) => next.tasks.find((t) => skillOf(t) === s).status;
    for (const s of ["execute-changeset", "review-gate", "review-exec", "audit-implementation", "land-changeset", "verify-promotion"]) assert.equal(status(s), "pending", s);
    // A pending persona task that moves in front of write-spec reopens everything after it;
    // a completed one leaves the upstream stages alone.
    const upstream = legacyStatus === "completed" ? "completed" : "pending";
    for (const s of ["write-spec", "plan-changeset", "review-plan"]) assert.equal(status(s), upstream, `${s} upstream`);
    assert.equal(status("validate-feature"), "completed");
    assert.ok(next.delivery_graph.mutation_history.some((m) => m.action === "reopen_for_process_steps"));
    const steps = next.tasks.find((t) => skillOf(t) === "execute-changeset").metadata.required_process_steps.map((p) => p.skill);
    assert.ok(steps.includes("write-e2e") && steps.includes("test-journeys"));
  });
}

test("a pending execute-changeset gaining process steps needs no reopen", () => {
  const { next } = resume(legacyGraph({ legacyStatus: "pending", rest: "pending" }));
  assert.equal(next.delivery_graph.mutation_history.some((m) => m.action === "reopen_for_process_steps"), false);
});

// ---- round 2 -----------------------------------------------------------------------
import crypto from "node:crypto";
import { validateResearchGraph } from "../../scripts/lib/research-decision.mjs";

const question = (id, requesting_skill) => ({ id, claim: `Does ${id} work?`, evidence: [], consequential: true, external_resolvable: true, confidence: 6, explicit_request: false, freshness_required: false, requesting_skill });

test("research requested by a moved stage moves with it: no cycle, compiles", () => {
  const g = compileDeliveryGraph({ ...INPUT, questions: [question("persona-q", "build-personas")] });
  assert.equal(cyclic(g.tasks), false);
  const order = g.tasks.map(skillOf);
  assert.ok(order.indexOf("research") < order.indexOf("build-personas"));
  assert.ok(order.indexOf("build-personas") < order.indexOf("write-spec"));
  assert.deepEqual(validateResearchGraph(g), []);
  assert.equal(validate(g).status, 0);
});

for (const skill of ["write-e2e", "test-journeys"]) {
  test(`research requested by ${skill} is remapped to execute-changeset and kept upstream`, () => {
    const g = compileDeliveryGraph({ ...INPUT, questions: [question(`${skill}-q`, skill)] });
    assert.equal(cyclic(g.tasks), false);
    const research = g.tasks.find((t) => skillOf(t) === "research");
    assert.ok(research, "research prerequisite is kept");
    const execute = g.tasks.find((t) => skillOf(t) === "execute-changeset");
    assert.equal(research.metadata.requesting_task_id, execute.id);
    assert.ok(execute.blocked_by.includes(research.id));
    const order = g.tasks.map(skillOf);
    assert.ok(order.indexOf("research") < order.indexOf("plan-changeset"), "chain stays contiguous");
    assert.deepEqual(validateResearchGraph(g), []);
    assert.equal(validate(g).status, 0);
  });
}

test("resuming a legacy graph keeps research that was requested by a folded e2e task", () => {
  const q = question("legacy-q", "write-e2e");
  const old = legacyGraph({ legacyStatus: "pending", rest: "pending" });
  const e2e = old.tasks.find((t) => skillOf(t) === "write-e2e");
  const r = { id: old.tasks.length + 1, subject: "research", status: "pending", blocked_by: [], metadata: { skill: "research", requesting_decision_id: q.id, question_id: q.id, requesting_task_id: e2e.id } };
  old.tasks.push(r);
  e2e.blocked_by.push(r.id);
  const next = compileDeliveryGraph({ ...INPUT, questions: [q], existing_graph: old });
  assert.equal(cyclic(next.tasks), false);
  const research = next.tasks.find((t) => skillOf(t) === "research");
  assert.equal(research.id, r.id);
  assert.equal(next.tasks.find((t) => t.id === research.metadata.requesting_task_id).metadata.skill, "execute-changeset");
  assert.deepEqual(validateResearchGraph(next), []);
});

function receiptFor(skill, content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rcpt-"));
  const file = path.join(dir, `${skill}.txt`);
  fs.writeFileSync(file, content);
  return { file, row: { skill, evidence: { type: "file", path: file, sha256: crypto.createHash("sha256").update(content).digest("hex") } } };
}
const executeStatus = (g) => g.tasks.find((t) => skillOf(t) === "execute-changeset").status;
const withReceipts = (rows) => { const old = legacyGraph({ legacyStatus: "completed", rest: "completed" }); old.tasks.find((t) => skillOf(t) === "execute-changeset").process_receipts = rows; return old; };

test("a receipt holding only a matching skill name does not suppress reopening", () => {
  const { next } = resume(withReceipts([{ skill: "write-e2e" }, { skill: "test-journeys" }]));
  assert.equal(executeStatus(next), "pending");
  assert.equal(next.tasks.find((t) => skillOf(t) === "verify-promotion").status, "pending");
});

test("a receipt with a missing file, a bad digest or a malformed hash does not count", () => {
  const good = receiptFor("test-journeys", "ok");
  const e2e = receiptFor("write-e2e", "ok");
  for (const bad of [
    { skill: "write-e2e", evidence: { path: path.join(os.tmpdir(), "does-not-exist-xyz"), sha256: "a".repeat(64) } },
    { skill: "write-e2e", evidence: { path: e2e.file, sha256: "b".repeat(64) } },
    { skill: "write-e2e", evidence: { path: e2e.file, sha256: "short" } },
  ]) assert.equal(executeStatus(resume(withReceipts([bad, good.row])).next), "pending");
});

test("a receipt whose file changed after it was recorded does not count", () => {
  const a = receiptFor("write-e2e", "v1"), b = receiptFor("test-journeys", "v1");
  fs.writeFileSync(a.file, "v2 edited after recording");
  assert.equal(executeStatus(resume(withReceipts([a.row, b.row])).next), "pending");
});

test("digest-bound receipts that match the current file contents keep execution completed", () => {
  const a = receiptFor("write-e2e", "proof a"), b = receiptFor("test-journeys", "proof b");
  assert.equal(executeStatus(resume(withReceipts([a.row, b.row])).next), "completed");
});

test("reopening execution also resets in_progress dependents to pending, so task-graph next works", () => {
  const old = legacyGraph({ legacyStatus: "pending", rest: "completed" });
  for (const s of ["review-exec", "land-changeset"]) old.tasks.find((t) => skillOf(t) === s).status = "in_progress";
  old.tasks.find((t) => skillOf(t) === "verify-promotion").status = "pending";
  const { next } = resume(old);
  for (const s of ["review-exec", "land-changeset"]) assert.equal(next.tasks.find((t) => skillOf(t) === s).status, "pending", s);
  const done = new Set(next.tasks.filter((t) => t.status === "completed").map((t) => t.id));
  for (const t of next.tasks.filter((x) => x.status === "in_progress")) assert.ok(t.blocked_by.every((id) => done.has(id)), `${skillOf(t)} is in_progress but blocked`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tg-"));
  const file = path.join(dir, "g.json");
  // task-graph wants a skill receipt on every completed task; the receipt content is not under test here.
  for (const t of next.tasks) if (t.status === "completed") t.skill_receipt = { skill: skillOf(t), loaded_at: new Date().toISOString(), loaded_via: "fixture" };
  fs.writeFileSync(file, JSON.stringify(next));
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts/task-graph.mjs"), "next", file], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

// ---- round 3 -----------------------------------------------------------------------
const nextOk = (g) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tg3-"));
  const file = path.join(dir, "g.json");
  const copy = structuredClone(g);
  for (const t of copy.tasks) if (t.status === "completed") t.skill_receipt = { skill: skillOf(t), loaded_at: new Date().toISOString(), loaded_via: "fixture" };
  fs.writeFileSync(file, JSON.stringify(copy));
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts/task-graph.mjs"), "next", file], { encoding: "utf8" });
  return { status: r.status, out: r.stdout + r.stderr, next: r.status === 0 && r.stdout.trim() ? JSON.parse(r.stdout) : null };
};

test("reopening a completed legacy graph recomputes graph.status so task-graph next accepts it", () => {
  const old = legacyGraph({ legacyStatus: "completed", rest: "completed" });
  old.status = "completed";
  const { next } = resume(old);
  assert.equal(next.status, "pending");
  const r = nextOk(next);
  assert.equal(r.status, 0, r.out);
  assert.equal(r.next.metadata.skill, "execute-changeset");
});

test("graph.status follows the tasks: in_progress dependents reset leaves no active task in an in_progress graph", () => {
  const old = legacyGraph({ legacyStatus: "pending", rest: "completed" });
  old.status = "in_progress";
  old.tasks.find((t) => skillOf(t) === "land-changeset").status = "in_progress";
  const { next } = resume(old);
  assert.ok(!(next.status === "in_progress" && !next.tasks.some((t) => t.status === "in_progress")), "in_progress graph without an active task");
  assert.equal(nextOk(next).status, 0);
});

test("a task without metadata is reopened without throwing", () => {
  const old = legacyGraph({ legacyStatus: "completed", rest: "completed" });
  const extra = { id: old.tasks.length + 1, subject: "hand-made", status: "completed", blocked_by: [old.tasks.find((t) => skillOf(t) === "execute-changeset").id] };
  old.tasks.push(extra);
  const { next } = resume(old);
  const t = next.tasks.find((x) => x.id === extra.id);
  assert.equal(t.status, "pending");
  assert.equal(t.metadata.reopened.previous, "completed");
});

test("research addressed only by a folded task's requesting_task_id survives repeated resumes", () => {
  const q = { ...question("legacy-id-q", undefined) };
  delete q.requesting_skill;
  const old = legacyGraph({ legacyStatus: "pending", rest: "pending" });
  const e2e = old.tasks.find((t) => skillOf(t) === "write-e2e");
  q.requesting_task_id = e2e.id;
  const r = { id: old.tasks.length + 1, subject: "research", status: "pending", blocked_by: [], metadata: { skill: "research", requesting_decision_id: q.id, question_id: q.id, requesting_task_id: e2e.id } };
  old.tasks.push(r);
  e2e.blocked_by.push(r.id);
  let g = compileDeliveryGraph({ ...INPUT, questions: [q], existing_graph: old });
  const executeId = (x) => x.tasks.find((t) => skillOf(t) === "execute-changeset").id;
  for (let i = 0; i < 3; i += 1) {
    assert.equal(g.tasks.find((t) => skillOf(t) === "research").metadata.requesting_task_id, executeId(g), `resume ${i}`);
    assert.deepEqual(validateResearchGraph(g), []);
    assert.equal(cyclic(g.tasks), false);
    g = compileDeliveryGraph({ ...INPUT, questions: [q], existing_graph: g });
  }
  assert.ok(g.delivery_graph.research.requester_remap, "remapping is persisted in the graph");
});

test("an unfinished design-tech moving ahead of planning reopens the downstream stages", () => {
  const input = { wi: "WI-ORD-3", lane: "bugfix", user_intent: "x", change_type: "bugfix", delivery_profile: "production", planned_files: ["src/a.js"], risk_flags: ["backend-function", "data-model-change"] };
  const fresh = compileDeliveryGraph({ ...input, risk_flags: [] });
  // Older graph: bugfix compiled without technical risk, mid-way through the chain.
  const old = structuredClone(fresh);
  old.status = "in_progress";
  old.tasks.forEach((t) => { t.status = "completed"; });
  old.tasks.find((t) => skillOf(t) === "land-changeset").status = "in_progress";
  old.tasks.find((t) => skillOf(t) === "verify-promotion").status = "pending";
  const next = compileDeliveryGraph({ ...input, existing_graph: old });
  const by = (s) => next.tasks.find((t) => skillOf(t) === s);
  const order = next.tasks.map(skillOf);
  assert.ok(order.indexOf("design-tech") < order.indexOf("plan-changeset"));
  assert.equal(by("design-tech").status, "pending");
  for (const s of ["plan-changeset", "execute-changeset", "land-changeset", "verify-promotion"]) assert.equal(by(s).status, "pending", s);
  assert.ok(by("plan-changeset").blocked_by.includes(by("design-tech").id), "planning now depends on design-tech");
  assert.equal(cyclic(next.tasks), false);
  const r = nextOk(next);
  assert.equal(r.status, 0, r.out);
  assert.equal(r.next.metadata.skill, "design-tech", "next picks the unfinished prerequisite, not land-changeset");
});
