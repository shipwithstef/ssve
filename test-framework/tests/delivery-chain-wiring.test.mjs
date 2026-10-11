// @organism-suite
// P1.3e — lanes as data, condition-first stages, ordering, security.
// Commands are the T2, T3 and T4 rows in docs/analysis/2026-10-11-organism-plan.md.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { compileDeliveryGraph } from "../../scripts/compile-delivery-graph.mjs";
import { checkLaneLayers } from "../../scripts/framework-coherence.mjs";
import { validateResearchGraph } from "../../scripts/lib/research-decision.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const COMPILER = path.join(ROOT, "scripts/compile-delivery-graph.mjs");
const TAIL = [
  "plan-changeset",
  "review-plan",
  "execute-changeset",
  "review-gate",
  "review-exec",
  "audit-implementation",
  "land-changeset",
  "verify-promotion",
];
const HISTORICAL_GREENFIELD = [
  "write-vision", "analyze-domain", "analyze-competitors", "build-personas",
  "validate-feature", "write-spec", "audit-ac", "write-journeys",
  "design-ux", "design-ui", "design-tech", "plan-changeset",
  "review-plan", "execute-changeset", "review-gate", "audit-implementation",
  "land-changeset", "verify-promotion",
];

function compile(args) {
  const r = spawnSync(process.execPath, [COMPILER, "--wi", "WI-T", ...args], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

const skills = (g) => g.tasks.map((t) => t.metadata.skill);
const owned = (g, skill) => g.tasks.filter((t) => (t.metadata.required_process_steps || []).some((s) => s.skill === skill));
const appearances = (g, skill) => skills(g).filter((s) => s === skill).length
  + g.tasks.reduce((n, t) => n + (t.metadata.required_process_steps || []).filter((s) => s.skill === skill).length, 0);

function beforeLand(g, skill) {
  const order = skills(g);
  const land = order.indexOf("land-changeset");
  const direct = order.indexOf(skill);
  if (direct >= 0) return direct < land;
  const host = order.findIndex((_, i) => (g.tasks[i].metadata.required_process_steps || []).some((s) => s.skill === skill));
  return host >= 0 && host < land;
}

test("lanes-as-data is a no-op against the compiler lists", () => {
  const data = JSON.parse(readFileSync(path.join(ROOT, "references/delivery-lanes.json"), "utf8"));
  assert.deepEqual(data.lanes.greenfield, HISTORICAL_GREENFIELD);
  assert.deepEqual(data.invariant_tail, TAIL);
  assert.ok(data.profile_keeps.prototype.includes("security"));
  assert.equal(data.stages["design-ux"].activation_condition, "ui");
  assert.equal(data.stages["design-ui"].activation_condition, "ui");
  assert.equal(data.stages["review-security"].activation_condition, "security");
  const g = compile([
    "--intent", "add a screen",
    "--lane", "greenfield",
    "--delivery-profile", "production",
    "--change-type", "feature",
    "--planned-files", "src/app/page.tsx",
  ]);
  const expected = [...HISTORICAL_GREENFIELD];
  expected.splice(expected.indexOf("review-gate") + 1, 0, "review-exec");
  assert.deepEqual(skills(g), expected);
});

test("T2 typo compiles no lane-upstream stage beyond the invariant tail", () => {
  for (const profile of ["production", "prototype"]) {
    const g = compile([
      "--intent", "fix typo in README",
      "--lane", "brownfield-feature",
      "--delivery-profile", profile,
      "--change-type", "docs",
      "--planned-files", "README.md",
      "--risk-flags", "docs-only",
    ]);
    assert.deepEqual(skills(g), TAIL, profile);
    for (const dropped of ["analyze-domain", "validate-feature", "write-spec", "write-journeys", "design-ux", "design-ui", "design-tech", "build-personas"]) {
      assert.equal(skills(g).includes(dropped), false, `${profile} kept ${dropped}`);
    }
    assert.equal(g.delivery_graph.activation.security, false);
    assert.equal(g.delivery_graph.activation.ui, false);
    assert.equal(appearances(g, "review-security"), 0);
  }
});

test("T3 production product orders personas, journeys and e2e before land, once", () => {
  const g = compile([
    "--intent", "yoga studio booking app",
    "--lane", "greenfield",
    "--delivery-profile", "production",
    "--change-type", "feature",
    "--planned-files", "src/app/page.tsx",
    "--risk-flags", "user-facing,browser-visible",
  ]);
  const order = skills(g);
  assert.equal(order.at(-1), "verify-promotion");
  for (const skill of ["build-personas", "write-journeys", "write-e2e", "test-journeys"]) {
    assert.equal(beforeLand(g, skill), true, skill);
  }
  assert.equal(appearances(g, "test-journeys"), 1);
  assert.equal(appearances(g, "write-e2e"), 1);
  assert.ok(order.indexOf("build-personas") < order.indexOf("land-changeset"));
  assert.ok(order.indexOf("write-journeys") < order.indexOf("land-changeset"));
  assert.equal(order.includes("write-e2e"), false, "write-e2e is one process stage, not a second task after promotion");
  assert.equal(order.includes("test-journeys"), false);
  const execute = g.tasks.find((t) => t.metadata.skill === "execute-changeset");
  assert.ok(execute.metadata.required_process_steps.some((s) => s.skill === "test-journeys" && s.before === "review-gate"));
  assert.ok(order.indexOf("execute-changeset") < order.indexOf("land-changeset"));
});

function securityOf(g) {
  const conditional = (g.delivery_graph.conditional_mandatory_skills || []).filter((s) => s.skill === "review-security");
  const audit = g.tasks.find((t) => t.metadata.skill === "audit-implementation");
  const steps = (audit?.metadata.required_process_steps || []).filter((s) => s.skill === "review-security");
  return { conditional, steps, zones: g.delivery_graph.planning.irreversible_zones };
}

test("T4 stripe webhook gets review-security with no flag, with auth, and with auth-sensitive", () => {
  const base = [
    "--intent", "fix stripe webhook double charge",
    "--lane", "bugfix",
    "--delivery-profile", "mvp",
    "--change-type", "bugfix",
    "--planned-files", "src/payments/webhook.ts",
  ];
  const plain = compile(base);
  const auth = compile([...base, "--risk-flags", "auth"]);
  const sensitive = compile([...base, "--risk-flags", "auth-sensitive"]);
  for (const g of [plain, auth, sensitive]) {
    const sec = securityOf(g);
    assert.equal(sec.conditional.length, 1);
    assert.equal(sec.conditional[0].signal, "security");
    assert.equal(sec.steps.length, 1);
    assert.equal(appearances(g, "review-security"), 1);
    assert.ok(sec.zones.includes("src/payments/webhook.ts"));
    assert.equal(beforeLand(g, "review-security"), true);
  }
  assert.ok(securityOf(auth).zones.includes("flag:auth"));
  assert.equal(plain.delivery_graph.activation.security, true);
  assert.equal(auth.delivery_graph.activation.security, true);
});

test("prototype keeps security on an auth path and drops it for a docs-only diff", () => {
  const kept = compile([
    "--intent", "fix login loop",
    "--lane", "bugfix",
    "--delivery-profile", "prototype",
    "--change-type", "bugfix",
    "--planned-files", "src/auth/login.ts",
  ]);
  assert.equal(securityOf(kept).steps.length, 1);
  const docs = compile([
    "--intent", "document the auth flow",
    "--lane", "bugfix",
    "--delivery-profile", "prototype",
    "--change-type", "docs",
    "--planned-files", "docs/payments-guide.md",
    "--risk-flags", "docs-only,auth",
  ]);
  assert.equal(appearances(docs, "review-security"), 0);
  assert.equal(docs.delivery_graph.activation.security, false);
  assert.deepEqual(skills(docs).filter((s) => !TAIL.includes(s)), []);
});

test("security activation covers ledger, schema, release workflows, and data-migration flags", () => {
  const cases = [
    ["--planned-files", "src/ledger/entries.ts"],
    ["--planned-files", "db/schema.sql"],
    ["--planned-files", ".github/workflows/release.yml"],
    ["--planned-files", "src/game.js", "--risk-flags", "data-migration"],
    ["--planned-files", "src/game.js", "--risk-flags", "data-deletion"],
    ["--planned-files", "src/game.js", "--risk-flags", "destructive-migration"],
  ];
  for (const extra of cases) {
    const g = compile([
      "--intent", "touch a protected path",
      "--lane", "bugfix",
      "--delivery-profile", "mvp",
      "--change-type", "bugfix",
      ...extra,
    ]);
    assert.equal(g.delivery_graph.activation.security, true, extra.join(" "));
    assert.equal(appearances(g, "review-security"), 1, extra.join(" "));
    assert.equal(beforeLand(g, "review-security"), true, extra.join(" "));
  }
});

test("docs classification is rejected when planned files contain payment code", () => {
  const payment = {
    wi: "WI-T",
    user_intent: "fix stripe webhook double charge",
    lane: "bugfix",
    delivery_profile: "mvp",
    planned_files: ["src/payments/webhook.ts"],
  };
  assert.throws(
    () => compileDeliveryGraph({ ...payment, change_type: "docs", risk_flags: ["auth-sensitive", "docs-only"] }),
    /contradictory documentation classification/,
  );
  assert.throws(
    () => compileDeliveryGraph({ ...payment, change_type: "docs", risk_flags: [] }),
    /contradictory documentation classification/,
  );
  assert.throws(
    () => compileDeliveryGraph({ ...payment, change_type: "bugfix", risk_flags: ["docs-only", "auth-sensitive"] }),
    /contradictory documentation classification/,
  );
  const screen = compile([
    "--intent", "docs pass over a screen file",
    "--lane", "brownfield-feature",
    "--delivery-profile", "production",
    "--change-type", "docs",
    "--planned-files", "src/app/page.tsx",
    "--risk-flags", "docs-only",
  ]);
  assert.equal(screen.delivery_graph.activation.security, false);
  assert.equal(appearances(screen, "review-security"), 0);
});

test("feature to docs recompilation archives dropped lane tasks and rebuilds obligations", () => {
  const feature = compileDeliveryGraph({
    wi: "WI-T",
    user_intent: "add a booking screen",
    lane: "brownfield-feature",
    delivery_profile: "production",
    change_type: "feature",
    planned_files: ["src/app/page.tsx"],
    risk_flags: ["user-facing", "browser-visible"],
  });
  assert.ok(feature.tasks.some((t) => t.metadata.skill === "write-journeys"));
  assert.ok(feature.tasks.some((t) => t.metadata.skill === "design-tech"));
  const docs = compileDeliveryGraph({
    wi: "WI-T",
    user_intent: "fix typo in README",
    lane: "brownfield-feature",
    delivery_profile: "production",
    change_type: "docs",
    planned_files: ["README.md"],
    risk_flags: ["docs-only"],
    existing_graph: feature,
  });
  const order = skills(docs);
  assert.deepEqual(order, TAIL);
  assert.equal(order.at(-1), "verify-promotion");
  for (const dropped of ["write-journeys", "design-tech", "design-ux", "design-ui"]) {
    assert.equal(order.includes(dropped), false, dropped);
    assert.ok(docs.delivery_graph.archived_compiler_tasks.some((row) => row.task.metadata.skill === dropped), dropped);
  }
  const live = new Set(docs.tasks.map((t) => t.id));
  for (const task of docs.tasks) {
    for (const id of task.blocked_by) assert.equal(live.has(id), true, task.metadata.skill);
  }
  const bySkill = Object.fromEntries(docs.tasks.map((t) => [t.metadata.skill, t]));
  assert.deepEqual(bySkill["review-plan"].blocked_by, [bySkill["plan-changeset"].id]);
  const steps = (bySkill["execute-changeset"].metadata.required_process_steps || []).map((s) => s.skill);
  assert.equal(steps.includes("test-journeys"), false);
  assert.equal(steps.includes("write-e2e"), false);
  assert.equal(steps.includes("track-visuals"), false);
  const again = compileDeliveryGraph({
    wi: "WI-T",
    user_intent: "fix typo in README",
    lane: "brownfield-feature",
    delivery_profile: "production",
    change_type: "docs",
    planned_files: ["README.md"],
    risk_flags: ["docs-only"],
    existing_graph: docs,
  });
  assert.equal(again.delivery_graph.archived_compiler_tasks.length, docs.delivery_graph.archived_compiler_tasks.length);
  assert.equal(again.tasks.some((t) => t.metadata.skill === "write-journeys"), false);
});

test("docs-only conditional insertions do not schedule track-visuals or design-tech", () => {
  const docs = compile([
    "--intent", "fix typo in README",
    "--lane", "brownfield-feature",
    "--delivery-profile", "production",
    "--change-type", "docs",
    "--planned-files", "README.md",
    "--risk-flags", "docs-only,browser-visible,backend-function",
  ]);
  assert.equal(appearances(docs, "track-visuals"), 0);
  assert.equal(appearances(docs, "design-tech"), 0);
  assert.deepEqual(skills(docs), TAIL);
  const code = compile([
    "--intent", "add an api handler",
    "--lane", "bugfix",
    "--delivery-profile", "production",
    "--change-type", "bugfix",
    "--planned-files", "src/api/handler.ts",
    "--risk-flags", "browser-visible,backend-function",
  ]);
  assert.ok(appearances(code, "track-visuals") >= 1);
  assert.equal(skills(code).includes("design-tech"), true);
});

function completeGraph(graph) {
  const done = structuredClone(graph);
  for (const task of done.tasks) task.status = "completed";
  done.status = "completed";
  return done;
}

function skillTask(graph, skill) {
  return graph.tasks.find((task) => task.metadata.skill === skill);
}

test("a finished production graph reopens audit, land and promotion when a payment file adds review-security", () => {
  const base = {
    wi: "WI-T",
    user_intent: "ship the game loop",
    lane: "bugfix",
    delivery_profile: "production",
    change_type: "bugfix",
    planned_files: ["src/game.js"],
  };
  const done = completeGraph(compileDeliveryGraph(base));
  assert.equal(appearances(done, "review-security"), 0);
  const next = compileDeliveryGraph({
    ...base,
    planned_files: ["src/payments/webhook.ts"],
    existing_graph: done,
  });
  assert.equal(appearances(next, "review-security"), 1);
  assert.equal(next.status, "pending");
  for (const skill of ["audit-implementation", "land-changeset", "verify-promotion"]) {
    const task = skillTask(next, skill);
    assert.equal(task.status, "pending", skill);
    assert.match(task.metadata.reopened.reason, /review-security/, skill);
  }
  assert.equal(skillTask(next, "review-exec").status, "completed");
  assert.ok(next.delivery_graph.mutation_history.some((row) => row.action === "reopen_for_process_steps"));

  const proof = "review-security ran";
  const dir = mkdtempSync(path.join(tmpdir(), "sec-rcpt-"));
  const file = path.join(dir, "review-security.txt");
  writeFileSync(file, proof);
  const held = completeGraph(compileDeliveryGraph(base));
  skillTask(held, "audit-implementation").process_receipts = [{
    skill: "review-security",
    evidence: { type: "file", path: file, sha256: createHash("sha256").update(proof).digest("hex") },
  }];
  const kept = compileDeliveryGraph({
    ...base,
    planned_files: ["src/payments/webhook.ts"],
    existing_graph: held,
  });
  assert.equal(appearances(kept, "review-security"), 1);
  assert.equal(kept.status, "completed");
  for (const skill of ["audit-implementation", "land-changeset", "verify-promotion"]) {
    assert.equal(skillTask(kept, skill).status, "completed", skill);
  }
});

test("executable code under docs/ is not documentation and cannot skip security", () => {
  const code = {
    wi: "WI-T",
    user_intent: "webhook checked in under docs",
    lane: "bugfix",
    delivery_profile: "production",
    planned_files: ["docs/payments/webhook.js"],
  };
  assert.throws(
    () => compileDeliveryGraph({ ...code, change_type: "docs", risk_flags: ["docs-only", "auth-sensitive"] }),
    /contradictory documentation classification/,
  );
  const live = compileDeliveryGraph({ ...code, change_type: "bugfix", risk_flags: [] });
  assert.equal(live.delivery_graph.activation.security, true);
  assert.equal(appearances(live, "review-security"), 1);
  assert.equal(beforeLand(live, "review-security"), true);
  const prose = compileDeliveryGraph({
    ...code,
    change_type: "docs",
    user_intent: "prose about the webhook",
    planned_files: ["docs/payments/webhook.md"],
    risk_flags: ["docs-only", "auth-sensitive"],
  });
  assert.equal(prose.delivery_graph.activation.security, false);
  assert.equal(appearances(prose, "review-security"), 0);
  const helper = compileDeliveryGraph({
    ...code,
    change_type: "docs",
    user_intent: "a helper checked in under docs",
    planned_files: ["docs/notes/helper.js"],
    risk_flags: ["docs-only"],
  });
  assert.equal(helper.delivery_graph.activation.security, false);
  assert.deepEqual(skills(helper), TAIL);
});

test("feature to docs archives completed research whose requester was deactivated", () => {
  const question = {
    id: "design-q",
    claim: "Does the booking API need a new client?",
    evidence: [],
    consequential: true,
    external_resolvable: true,
    confidence: 6,
    explicit_request: false,
    freshness_required: false,
    requesting_skill: "design-tech",
  };
  const feature = compileDeliveryGraph({
    wi: "WI-T",
    user_intent: "add a booking screen",
    lane: "brownfield-feature",
    delivery_profile: "production",
    change_type: "feature",
    planned_files: ["src/app/page.tsx"],
    risk_flags: ["user-facing"],
    questions: [question],
  });
  const research = skillTask(feature, "research");
  const design = skillTask(feature, "design-tech");
  assert.equal(research.metadata.requesting_task_id, design.id);
  research.status = "completed";
  assert.deepEqual(validateResearchGraph(feature), []);
  const resumed = compileDeliveryGraph({
    wi: "WI-T",
    user_intent: "add a booking screen",
    lane: "brownfield-feature",
    delivery_profile: "production",
    change_type: "feature",
    planned_files: ["src/app/page.tsx"],
    risk_flags: ["user-facing"],
    existing_graph: feature,
  });
  assert.equal(skillTask(resumed, "research").metadata.requesting_task_id, skillTask(resumed, "design-tech").id);
  assert.deepEqual(validateResearchGraph(resumed), []);
  const docs = compileDeliveryGraph({
    wi: "WI-T",
    user_intent: "fix typo in README",
    lane: "brownfield-feature",
    delivery_profile: "production",
    change_type: "docs",
    planned_files: ["README.md"],
    risk_flags: ["docs-only"],
    existing_graph: feature,
  });
  assert.equal(docs.tasks.some((task) => task.metadata.skill === "research"), false);
  assert.equal(docs.tasks.some((task) => task.metadata.skill === "design-tech"), false);
  const archivedResearch = docs.delivery_graph.archived_compiler_tasks.find((row) => row.task.metadata.skill === "research");
  assert.equal(archivedResearch.disposition, "research requester deactivated; archived, not executable");
  assert.equal(archivedResearch.question.id, question.id);
  assert.ok(docs.delivery_graph.archived_compiler_tasks.some((row) => row.task.metadata.skill === "design-tech"));
  assert.equal(docs.delivery_graph.research.questions.some((item) => item.id === question.id), false);
  assert.deepEqual(validateResearchGraph(docs), []);
});

test("checkLaneLayers reads delivery lane data, so a missing refactor design-tech is visible", () => {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, "skills-manifest.json"), "utf8"));
  assert.equal(checkLaneLayers(manifest).some((f) => /refactor: required step design-tech/.test(f.msg)), false);
  const broken = structuredClone(manifest);
  broken.laneDefinitions.refactor.skills = broken.laneDefinitions.refactor.skills.filter((s) => s !== "design-tech");
  assert.ok(checkLaneLayers(broken).some((f) => /refactor: required step design-tech/.test(f.msg)));
});
