#!/usr/bin/env bash
# WI-510 focused contract: current execution, authorized skip, legacy authority,
# mutation-red inversions, and unchanged real-graph replay.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
FIXTURE="$REPO_ROOT/test-framework/evals/tier-1/fixtures/phase-receipt-skip-integrity.json"
CLI="$REPO_ROOT/scripts/validate-completed-task-integrity.mjs"
LIB="$REPO_ROOT/scripts/lib/completed-task-integrity.mjs"

if [[ ! -s "$CLI" || ! -s "$LIB" ]]; then
  echo "classifier-unavailable: scripts/validate-completed-task-integrity.mjs and scripts/lib/completed-task-integrity.mjs are required" >&2
  exit 2
fi

node --input-type=module - "$REPO_ROOT" "$FIXTURE" "$CLI" <<'NODE'
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const [repoRoot, fixturePath, cliPath] = process.argv.slice(2);
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wi510-phase-integrity-"));
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));

function clone(value) {
  return structuredClone(value);
}

function materializeOsTemporaryPaths(value) {
  if (typeof value === "string" && value.startsWith("__OS_TMP__/")) {
    return path.join(os.tmpdir(), value.slice("__OS_TMP__/".length));
  }
  if (Array.isArray(value)) return value.map(materializeOsTemporaryPaths);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, materializeOsTemporaryPaths(entry)]),
    );
  }
  return value;
}

function merge(target, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return clone(patch);
  const out = target && typeof target === "object" && !Array.isArray(target) ? clone(target) : {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete out[key];
    else if (typeof value === "object" && !Array.isArray(value)) out[key] = merge(out[key], value);
    else out[key] = clone(value);
  }
  return out;
}

function runGraph(graphPath, registryPath, root, extra = []) {
  const result = spawnSync(process.execPath, [
    cliPath,
    "--graph", graphPath,
    "--registry", registryPath,
    "--repo-root", root,
    "--json",
    ...extra,
  ], { cwd: repoRoot, encoding: "utf8" });
  assert.ok([0, 1].includes(result.status), `unexpected CLI exit ${result.status}: ${result.stderr}`);
  return {
    exit: result.status,
    body: JSON.parse(result.stdout),
  };
}

const canonicalRegistry = JSON.parse(fs.readFileSync(path.join(repoRoot, "references/skip-conditions.json"), "utf8"));
const integrityLibrary = await import(
  `file://${path.join(repoRoot, "scripts/lib/completed-task-integrity.mjs")}`
);
for (const scenario of fixture.scenarios) {
  const graph = materializeOsTemporaryPaths(clone(fixture.base_graph));
  graph.tasks[0] = merge(graph.tasks[0], scenario.task_patch || {});
  if (scenario.set_skip_reason_null) graph.tasks[0].skip_reason = null;
  if (scenario.receipt_patch) {
    graph.tasks[0].skill_receipt = merge(graph.tasks[0].skill_receipt, scenario.receipt_patch);
  }
  if (scenario.phase_patch) {
    const index = scenario.phase_patch.index;
    graph.tasks[0].skill_receipt.phases_executed[index] =
      merge(graph.tasks[0].skill_receipt.phases_executed[index], scenario.phase_patch.value);
  }
  if (scenario.artifact_patch) {
    const { phase_index: phaseIndex, artifact_index: artifactIndex, value } = scenario.artifact_patch;
    const artifact = graph.tasks[0].skill_receipt.phases_executed[phaseIndex].evidence_artifacts[artifactIndex];
    graph.tasks[0].skill_receipt.phases_executed[phaseIndex].evidence_artifacts[artifactIndex] = merge(artifact, value);
  }
  if (scenario.delivery_authorization) {
    graph.delivery_graph.skipped_skills = [merge(fixture.authorized_skip_entry, scenario.delivery_patch || {})];
    if (scenario.duplicate_delivery_authorization) {
      graph.delivery_graph.skipped_skills.push(clone(graph.delivery_graph.skipped_skills[0]));
    }
  }
  const registry = merge(canonicalRegistry, scenario.registry_patch || {});
  const graphPath = path.join(tmp, `${scenario.id}.json`);
  const registryPath = path.join(tmp, `${scenario.id}-registry.json`);
  fs.writeFileSync(graphPath, `${JSON.stringify(graph, null, 2)}\n`);
  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
  const actual = runGraph(graphPath, registryPath, repoRoot);
  assert.equal(actual.exit, scenario.expected.exit, `${scenario.id}: exit`);
  assert.equal(actual.body.results[0].classification, scenario.expected.classification, `${scenario.id}: classification`);
  const reasons = new Set(actual.body.results[0].reasons.map((reason) => reason.code));
  for (const code of scenario.expected.reasons) assert.ok(reasons.has(code), `${scenario.id}: missing ${code}`);
}

function git(cwd, args, env = {}) {
  return execFileSync("git", args, {
    cwd,
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
      ...env,
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

const legacyRoot = path.join(tmp, "anchored-legacy-repository");
git(tmp, ["clone", "-q", "--shared", repoRoot, legacyRoot]);
git(legacyRoot, ["config", "user.name", "WI-510 Fixture"]);
git(legacyRoot, ["config", "user.email", "wi510@example.invalid"]);
// WI-181 is the repository's immutable pre-enforcement compatibility canary:
// it exists at PHASE_ENFORCEMENT_ANCHOR and remains phase-free today. A future
// edit that changes those bytes should fail this test and trigger an explicit
// compatibility decision, not silently replace the historical authority.
const canonicalLegacyPath = path.join(legacyRoot, ".svc/lane-tasks-WI-181.json");
const canonicalLegacyText = fs.readFileSync(canonicalLegacyPath, "utf8");

for (const scenario of fixture.legacy_scenarios) {
  if (fs.readFileSync(canonicalLegacyPath, "utf8") !== canonicalLegacyText) {
    fs.writeFileSync(canonicalLegacyPath, canonicalLegacyText);
    git(legacyRoot, ["add", path.relative(legacyRoot, canonicalLegacyPath)]);
    git(legacyRoot, ["commit", "-q", "-m", `restore anchored graph before ${scenario.id}`], {
      GIT_AUTHOR_DATE: "2026-07-23T00:00:00Z",
      GIT_COMMITTER_DATE: "2026-07-23T00:00:00Z",
    });
  }
  let graphPath = canonicalLegacyPath;
  let graph = JSON.parse(canonicalLegacyText);
  const replacementTargets = [];
  const commitGraph = (message, commitDate = "2026-07-23T00:00:00Z") => {
    fs.writeFileSync(graphPath, `${JSON.stringify(graph, null, 2)}\n`);
    git(legacyRoot, ["add", path.relative(legacyRoot, graphPath)]);
    const env = {
      GIT_AUTHOR_DATE: commitDate,
      GIT_COMMITTER_DATE: commitDate,
    };
    git(legacyRoot, ["commit", "-q", "-m", message], env);
  };
  if (scenario.new_graph_commit_date || scenario.new_graph_untracked || scenario.new_graph_replace_attack) {
    graph = materializeOsTemporaryPaths(clone(fixture.base_graph));
    graph.created = "2026-05-01T00:00:00Z";
    delete graph.delivery_graph;
    delete graph.tasks[0].skill_receipt.phases_executed;
    graphPath = path.join(legacyRoot, `.svc/lane-tasks-${scenario.id}.json`);
    fs.writeFileSync(graphPath, `${JSON.stringify(graph, null, 2)}\n`);
    if (scenario.new_graph_commit_date) {
      commitGraph("add backdated current graph", scenario.new_graph_commit_date);
    }
    if (scenario.new_graph_replace_attack) {
      commitGraph("add current graph");
      const addedCommit = git(legacyRoot, ["rev-parse", "HEAD"]);
      git(legacyRoot, ["commit", "-q", "--allow-empty", "-m", "advance current head"], {
        GIT_AUTHOR_DATE: "2026-07-23T00:00:01Z",
        GIT_COMMITTER_DATE: "2026-07-23T00:00:01Z",
      });
      const realHead = git(legacyRoot, ["rev-parse", "HEAD"]);
      const graphTree = git(legacyRoot, ["rev-parse", `${addedCommit}^{tree}`]);
      const headTree = git(legacyRoot, ["rev-parse", `${realHead}^{tree}`]);
      const replacementAnchor = git(
        legacyRoot,
        ["commit-tree", graphTree, "-p", addedCommit],
        {
          GIT_AUTHOR_DATE: "2026-05-10T15:59:59Z",
          GIT_COMMITTER_DATE: "2026-05-10T15:59:59Z",
        },
      );
      let replacementParent = addedCommit;
      try {
        git(legacyRoot, ["cat-file", "-e", `${integrityLibrary.PHASE_ENFORCEMENT_ANCHOR}^{commit}`]);
        replacementParent = integrityLibrary.PHASE_ENFORCEMENT_ANCHOR;
      } catch {}
      const replacementHead = git(
        legacyRoot,
        ["commit-tree", headTree, "-p", replacementParent],
        {
          GIT_AUTHOR_DATE: "2026-07-23T00:00:02Z",
          GIT_COMMITTER_DATE: "2026-07-23T00:00:02Z",
        },
      );
      try {
        git(legacyRoot, ["cat-file", "-e", `${integrityLibrary.PHASE_ENFORCEMENT_ANCHOR}^{commit}`]);
        git(legacyRoot, ["replace", integrityLibrary.PHASE_ENFORCEMENT_ANCHOR, replacementAnchor]);
        replacementTargets.push(integrityLibrary.PHASE_ENFORCEMENT_ANCHOR);
      } catch {
        // A privacy-reset root intentionally externalizes the old anchor. The
        // new graph remains absent from the digest-bound epoch allowlist and
        // must still be rejected below.
      }
      git(legacyRoot, ["replace", realHead, replacementHead]);
      replacementTargets.push(realHead);
    }
  }
  if (scenario.receipt_patch) {
    graph.tasks[0].skill_receipt = merge(graph.tasks[0].skill_receipt, scenario.receipt_patch);
    commitGraph("add malformed current receipt");
  }
  if (scenario.post_cutoff_insert) {
    const inserted = clone(graph.tasks[0]);
    inserted.id = 999;
    graph.tasks.push(inserted);
    commitGraph("insert current task");
  }
  if (scenario.post_cutoff_id_string) {
    graph.tasks[0].id = String(graph.tasks[0].id);
    commitGraph("change current task id type");
  }
  if (scenario.post_cutoff_skill_change) {
    graph.tasks[0].metadata.skill = "execute-changeset";
    graph.tasks[0].skill_receipt.skill = "execute-changeset";
    commitGraph("change current task skill");
  }
  if (scenario.post_cutoff_receipt_change) {
    graph.tasks[0].skill_receipt.validation_output = "post-cutoff mutation";
    commitGraph("change current task receipt");
  }
  const actual = runGraph(
    graphPath,
    path.join(legacyRoot, "references/skip-conditions.json"),
    legacyRoot,
  );
  assert.equal(actual.exit, scenario.expected.exit, `${scenario.id}: exit`);
  assert.ok(actual.body.results.length > 0, `${scenario.id}: result exists`);
  if (scenario.expected.exit === 0) {
    assert.ok(
      actual.body.results.every((entry) => entry.classification === scenario.expected.classification),
      `${scenario.id}: all classifications`,
    );
  } else {
    const targetId = scenario.post_cutoff_insert ? 999 : graph.tasks[0].id;
    assert.equal(
      actual.body.results.find((entry) => entry.task_id === targetId)?.classification,
      scenario.expected.classification,
      `${scenario.id}: target classification`,
    );
  }
  for (const target of replacementTargets) git(legacyRoot, ["replace", "-d", target]);
}

const filterGraph = clone(fixture.base_graph);
filterGraph.tasks.push({
  id: 2,
  subject: "unregistered fixture skill",
  status: "completed",
  metadata: { skill: "not-registered" },
  skill_receipt: {
    skill: "not-registered",
    loaded_at: "2026-07-23T00:00:01Z",
    loaded_via: "fixture",
    phases_executed: [],
  },
  completed_at: "2026-07-23T00:00:08Z",
});
const filterGraphPath = path.join(tmp, "registered-filter.json");
const filterRegistryPath = path.join(tmp, "registered-filter-registry.json");
fs.writeFileSync(filterGraphPath, `${JSON.stringify(filterGraph, null, 2)}\n`);
fs.writeFileSync(filterRegistryPath, `${JSON.stringify(canonicalRegistry, null, 2)}\n`);
const filtered = runGraph(filterGraphPath, filterRegistryPath, repoRoot, ["--registered-skills-only"]);
assert.equal(filtered.exit, 0);
assert.equal(filtered.body.checked, 1);
assert.equal(filtered.body.results[0].skill, "review-plan");

const malformedMetadataGraph = clone(fixture.base_graph);
malformedMetadataGraph.tasks[0].skill = "review-plan";
malformedMetadataGraph.tasks[0].metadata.skill = "";
malformedMetadataGraph.tasks[0].skill_receipt.phases_executed = "malformed";
const malformedMetadataPath = path.join(tmp, "registered-malformed-metadata.json");
fs.writeFileSync(malformedMetadataPath, `${JSON.stringify(malformedMetadataGraph, null, 2)}\n`);
const malformedMetadata = runGraph(
  malformedMetadataPath,
  filterRegistryPath,
  repoRoot,
  ["--registered-skills-only"],
);
assert.equal(malformedMetadata.exit, 1);
assert.equal(malformedMetadata.body.checked, 1);
assert.ok(malformedMetadata.body.results[0].reasons.some((reason) => reason.code === "malformed-phases"));

const phaseFreeGraph = clone(fixture.base_graph);
delete phaseFreeGraph.tasks[0].skill_receipt.phases_executed;
phaseFreeGraph.tasks[0].skill_receipt.output_artifact = "docs/plans/fixture-review-log.yaml";
const phaseFreePath = path.join(tmp, "current-phase-free.json");
fs.writeFileSync(phaseFreePath, `${JSON.stringify(phaseFreeGraph, null, 2)}\n`);
const phaseFreeDefault = runGraph(phaseFreePath, filterRegistryPath, repoRoot);
assert.equal(phaseFreeDefault.exit, 1);
assert.ok(phaseFreeDefault.body.results[0].reasons.some(
  (reason) => reason.code === "unsupported-legacy-receipt",
));
const forgedTaskAuthority = integrityLibrary.classifyCompletedTask({
  graph: phaseFreeGraph,
  task: phaseFreeGraph.tasks[0],
  registry: canonicalRegistry,
  legacyAuthority: { eligible: true },
});
assert.equal(forgedTaskAuthority.ok, false);
const forgedGraphAuthority = integrityLibrary.classifyGraphCompletedTasks({
  graph: phaseFreeGraph,
  graphPath: phaseFreePath,
  registry: canonicalRegistry,
  repoRoot,
  legacyAuthority: { eligible: true },
});
assert.equal(forgedGraphAuthority.ok, false);
const scopedPhaseFree = runGraph(
  phaseFreePath,
  filterRegistryPath,
  repoRoot,
  ["--registered-skills-only", "--structured-or-skip-only", "--phase-free-compat", "summary"],
);
assert.equal(scopedPhaseFree.exit, 0);
assert.equal(scopedPhaseFree.body.checked, 0);

const scopedPhaseFreeRequest = spawnSync(process.execPath, [
  cliPath,
  "--graph", phaseFreePath,
  "--registry", filterRegistryPath,
  "--repo-root", repoRoot,
  "--registered-skills-only",
  "--structured-or-skip-only",
  "--phase-free-compat", "summary",
  "--task", "1",
  "--json",
], { cwd: repoRoot, encoding: "utf8" });
assert.equal(scopedPhaseFreeRequest.status, 2);
assert.match(scopedPhaseFreeRequest.stderr, /outside the structured-or-skip filter/);

const phaseFreeNoSummaryGraph = clone(phaseFreeGraph);
delete phaseFreeNoSummaryGraph.tasks[0].skill_receipt.output_artifact;
const phaseFreeNoSummaryPath = path.join(tmp, "current-phase-free-no-summary.json");
fs.writeFileSync(phaseFreeNoSummaryPath, `${JSON.stringify(phaseFreeNoSummaryGraph, null, 2)}\n`);
const phaseFreeNoSummary = runGraph(
  phaseFreeNoSummaryPath,
  filterRegistryPath,
  repoRoot,
  ["--registered-skills-only", "--structured-or-skip-only", "--phase-free-compat", "summary"],
);
assert.equal(phaseFreeNoSummary.exit, 1);
assert.equal(phaseFreeNoSummary.body.checked, 1);
assert.ok(phaseFreeNoSummary.body.results[0].reasons.some(
  (reason) => reason.code === "unsupported-legacy-receipt",
));
const loadedCompatiblePhaseFree = runGraph(
  phaseFreeNoSummaryPath,
  filterRegistryPath,
  repoRoot,
  ["--registered-skills-only", "--structured-or-skip-only", "--phase-free-compat", "loaded"],
);
assert.equal(loadedCompatiblePhaseFree.exit, 0);
assert.equal(loadedCompatiblePhaseFree.body.checked, 0);

const malformedPhaseFreeGraph = clone(phaseFreeGraph);
malformedPhaseFreeGraph.tasks[0].skill_receipt.loaded_at = "not-a-timestamp";
const malformedPhaseFreePath = path.join(tmp, "malformed-phase-free.json");
fs.writeFileSync(malformedPhaseFreePath, `${JSON.stringify(malformedPhaseFreeGraph, null, 2)}\n`);
const malformedPhaseFree = runGraph(
  malformedPhaseFreePath,
  filterRegistryPath,
  repoRoot,
  ["--registered-skills-only", "--structured-or-skip-only", "--phase-free-compat", "summary"],
);
assert.equal(malformedPhaseFree.exit, 1);
assert.equal(malformedPhaseFree.body.checked, 1);
assert.ok(malformedPhaseFree.body.results[0].reasons.some(
  (reason) => reason.code === "invalid-loaded-at",
));

const pendingGraph = clone(fixture.base_graph);
pendingGraph.tasks[0].status = "pending";
delete pendingGraph.tasks[0].completed_at;
const pendingGraphPath = path.join(tmp, "requested-pending.json");
fs.writeFileSync(pendingGraphPath, `${JSON.stringify(pendingGraph, null, 2)}\n`);
const pendingRequested = runGraph(pendingGraphPath, filterRegistryPath, repoRoot, ["--task", "1"]);
assert.equal(pendingRequested.exit, 1);
assert.equal(pendingRequested.body.checked, 1);
assert.ok(pendingRequested.body.results[0].reasons.some((reason) => reason.code === "not-completed"));

const filteredRequest = spawnSync(process.execPath, [
  cliPath,
  "--graph", filterGraphPath,
  "--registry", filterRegistryPath,
  "--repo-root", repoRoot,
  "--registered-skills-only",
  "--task", "2",
  "--json",
], { cwd: repoRoot, encoding: "utf8" });
assert.equal(filteredRequest.status, 2);
assert.match(filteredRequest.stderr, /outside the registered-skills filter/);
const missingRepoRootValue = spawnSync(process.execPath, [
  cliPath,
  "--graph", path.join(repoRoot, ".svc/lane-tasks-WI-498.json"),
  "--registry", path.join(repoRoot, "references/skip-conditions.json"),
  "--repo-root",
  "--json",
], { cwd: repoRoot, encoding: "utf8" });
assert.equal(missingRepoRootValue.status, 2);
assert.match(missingRepoRootValue.stderr, /--repo-root requires a value/);

const shellCutoff = fs.readFileSync(path.join(repoRoot, "test-framework/evals/tier-1/validate-skill-receipt-shape.sh"), "utf8")
  .match(/PHASE_B_ENFORCE_AFTER="\$\{PHASE_B_ENFORCE_AFTER:-([^}]+)\}"/)?.[1];
const doctrine = fs.readFileSync(path.join(repoRoot, "references/phase-receipts.md"), "utf8");
const registryConsumer = fs.readFileSync(
  path.join(repoRoot, "test-framework/evals/tier-1/validate-skip-conditions-registry.sh"),
  "utf8",
);
const laneConsumer = fs.readFileSync(
  path.join(repoRoot, "test-framework/evals/tier-1/validate-lane-tasks-integrity.sh"),
  "utf8",
);
const { PHASE_ENFORCE_AFTER } = integrityLibrary;
assert.equal(PHASE_ENFORCE_AFTER, shellCutoff, "cutoff parity with receipt-shape validator");
assert.ok(doctrine.includes(PHASE_ENFORCE_AFTER), "cutoff parity with normative doctrine");
for (const flag of ["--registered-skills-only", "--structured-or-skip-only", "--phase-free-compat summary"]) {
  assert.ok(registryConsumer.includes(flag), `registry consumer retains ${flag}`);
}
for (const flag of ["--registered-skills-only", "--structured-or-skip-only", "--phase-free-compat loaded"]) {
  assert.ok(laneConsumer.includes(flag), `lane consumer retains ${flag}`);
}

for (const graph of ["WI-498", "WI-509"]) {
  const result = runGraph(
    path.join(repoRoot, `.svc/lane-tasks-${graph}.json`),
    path.join(repoRoot, "references/skip-conditions.json"),
    repoRoot,
  );
  assert.equal(result.exit, 0, `${graph}: real replay`);
  if (graph === "WI-498") {
    for (const taskId of [5, 6]) {
      assert.equal(
        result.body.results.find((entry) => entry.task_id === taskId)?.classification,
        "executed",
        `WI-498 task ${taskId} remains executed`,
      );
    }
  }
}

console.log(`phase-receipt skip integrity: PASS (${fixture.scenarios.length} current, ${fixture.legacy_scenarios.length} legacy, 10 selection/filter, 2 real replay)`);
NODE
