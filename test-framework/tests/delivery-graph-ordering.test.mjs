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
