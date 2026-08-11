#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import { compileProductProofGraph, compileTaskContext } from "../../../scripts/svc-product-proof-compiler-v2.mjs";

const sha = (value) => crypto.createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
const bindings = Object.freeze({
  protocol_generation_digest: sha("protocol"), product_generation_digest: sha("product"),
  context_generation_digest: sha("context"), concern_generation_digest: sha("concern"),
  control_generation_digest: sha("control"), authority_generation_digest: sha("authority"),
  layer_inventory_digest: sha("layers")
});
const layerInventory = { inventory_digest: bindings.layer_inventory_digest, layers: [{ id: "stage:implement" }] };

function node(id, type, contextScope = "feature", attributes = {}) {
  const value = `unit-fixture:${id}:${type}`;
  return {
    id, type, title: `${type.toLowerCase()} ${id}`, context_scope: contextScope, status: "RESOLVED", attributes,
    source: { path: `inline/${id}.json`, value, digest: sha(value), span: "inline" }
  };
}

function graph() {
  const nodes = [
    node("direction", "DIRECTION", "global"), node("claim", "EVIDENCE_CLAIM", "global"),
    node("uncertainty", "UNCERTAINTY", "global"), node("option-a", "OPTION", "global"),
    node("option-b", "OPTION", "global"), node("decision", "DECISION", "global"),
    node("feature", "FEATURE"), node("outcome", "OUTCOME"),
    node("layer", "LAYER_OBLIGATION", "global", { layer_id: "stage:implement", applicable: true, unique_benefit: "implements the bounded product slice", inventory_digest: bindings.layer_inventory_digest }),
    node("journey", "JOURNEY"), node("ac", "AC"), node("task", "TASK", "task"),
    node("code", "CODE", "task"), node("validator", "VALIDATOR", "task"),
    node("evidence", "EVIDENCE", "evidence"), node("live-probe", "RELEASE_PROBE", "evidence"),
    node("authority", "AUTHORITY", "task"), node("failure", "FAILURE_BEHAVIOR", "task"),
    node("operations", "OPERATIONS", "global"), node("final-review", "FINAL_REVIEW", "evidence"),
    node("final-sha", "FINAL_SHA", "evidence"), node("release", "RELEASE", "evidence"),
    node("rollback", "ROLLBACK_PROOF", "evidence"), node("observation", "OBSERVATION", "evidence"),
    node("delta", "OBSERVED_DELTA", "evidence"), node("next-decision", "NEXT_DECISION", "global"),
    node("learning", "LEARNING", "evidence")
  ];
  const edges = [
    { from: "direction", to: "decision", type: "DIRECTS" },
    { from: "claim", to: "option-a", type: "INFORMS" },
    { from: "uncertainty", to: "decision", type: "INFORMS" },
    { from: "decision", to: "option-a", type: "SELECTS" },
    { from: "decision", to: "option-b", type: "REJECTS" },
    { from: "decision", to: "feature", type: "AUTHORIZES" },
    { from: "feature", to: "outcome", type: "DELIVERS" },
    { from: "feature", to: "layer", type: "OBLIGATES" },
    { from: "layer", to: "task", type: "SATISFIED_BY" },
    { from: "feature", to: "operations", type: "OPERATED_BY" },
    { from: "outcome", to: "journey", type: "EXPERIENCED_IN" },
    { from: "journey", to: "ac", type: "ACCEPTED_BY" },
    { from: "journey", to: "live-probe", type: "VERIFIED_BY" },
    { from: "ac", to: "task", type: "IMPLEMENTED_BY" },
    { from: "task", to: "code", type: "CHANGES" },
    { from: "task", to: "validator", type: "PROVED_BY" },
    { from: "task", to: "authority", type: "CONSTRAINED_BY" },
    { from: "task", to: "failure", type: "FAILS_AS" },
    { from: "task", to: "final-review", type: "REVIEWED_BY" },
    { from: "validator", to: "evidence", type: "EMITS" },
    { from: "evidence", to: "final-review", type: "CONSUMED_BY" },
    { from: "final-review", to: "final-sha", type: "BINDS" },
    { from: "final-sha", to: "release", type: "RELEASES" },
    { from: "release", to: "rollback", type: "ROLLBACK_READY_BY" },
    { from: "release", to: "live-probe", type: "VERIFIED_BY" },
    { from: "release", to: "observation", type: "SCHEDULES" },
    { from: "observation", to: "delta", type: "OBSERVES" },
    { from: "delta", to: "learning", type: "TEACHES" },
    { from: "learning", to: "next-decision", type: "CONSUMED_BY" }
  ];
  return { schema_version: 2, product: "Example Marketplace", generation_bindings: bindings, layer_inventory_digest: bindings.layer_inventory_digest, nodes, edges };
}

let passed = 0;
function check(name, fn) { try { fn(); passed += 1; } catch (error) { console.error(`not ok ${name}: ${error.message}`); process.exitCode = 1; } }
const compile = (input) => compileProductProofGraph(input, { layerInventory });

check("complete direction-to-outcome graph compiles", () => {
  const result = compile(graph());
  assert.equal(result.valid, true, result.errors?.join("; "));
  assert.equal(result.summary.layers, 1);
  assert.match(result.graph_digest, /^[a-f0-9]{64}$/);
});

check("unresolved or SHA-only source declarations fail", () => {
  const input = graph();
  delete input.nodes[0].source.value;
  assert(compile(input).errors.some((error) => error.includes("cannot be resolved")));
});

check("selected and rejected options are complete", () => {
  const input = graph();
  input.edges = input.edges.filter((edge) => edge.type !== "REJECTS");
  assert(compile(input).errors.some((error) => error.includes("neither selected nor rejected")));
});

check("canonical layer denominator cannot be omitted", () => {
  const input = graph();
  input.nodes = input.nodes.filter((item) => item.id !== "layer");
  input.edges = input.edges.filter((edge) => edge.from !== "layer" && edge.to !== "layer");
  const result = compile(input);
  assert(result.errors.some((error) => error.includes("omitted canonical layer")));
});

check("task needs code validator authority and failure behavior", () => {
  const input = graph();
  input.edges = input.edges.filter((edge) => edge.from !== "task");
  const result = compile(input);
  for (const text of ["no code", "no validator", "no authority", "no failure"]) assert(result.errors.some((error) => error.includes(text)), text);
});

check("delivery cannot close without rollback live probe observation delta and next decision", () => {
  const requiredTargets = ["rollback", "live-probe", "observation", "delta", "next-decision"];
  for (const target of requiredTargets) {
    const input = graph();
    input.nodes = input.nodes.filter((item) => item.id !== target);
    input.edges = input.edges.filter((edge) => edge.from !== target && edge.to !== target);
    assert.equal(compile(input).valid, false, target);
  }
});

check("task context carries generation bindings and focused proof", () => {
  const result = compileTaskContext(graph(), "task", { layerInventory });
  assert.equal(result.valid, true, result.errors?.join("; "));
  assert.deepEqual(result.context.generation_bindings, bindings);
  assert(result.context.relevant_nodes.some((item) => item.id === "authority"));
  assert(result.bytes < 65536);
});

check("29 distinct edge removals produce zero false closure", () => {
  const baseline = graph();
  assert.equal(new Set(baseline.edges.map((edge) => `${edge.from}:${edge.type}:${edge.to}`)).size, baseline.edges.length);
  assert.equal(baseline.edges.length, 29);
  let falseValid = 0;
  for (let index = 0; index < baseline.edges.length; index += 1) {
    const input = graph();
    input.edges.splice(index, 1);
    if (compile(input).valid) falseValid += 1;
  }
  assert.equal(falseValid, 0);
});

if (process.exitCode) console.error(`product proof compiler v2: ${passed} passed, failures present`);
else console.log(`product proof compiler v2: ${passed} passed, 0 failed`);
