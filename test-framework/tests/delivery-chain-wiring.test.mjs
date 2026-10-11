// P1.3e — lanes as data, condition-first stages, ordering, security.
// Commands are the T2, T3 and T4 rows in docs/analysis/2026-10-11-organism-plan.md.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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
