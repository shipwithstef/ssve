#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import path from "node:path";

const CONTRACTS = [
  {
    "validator": "validate-skill-judgment.mjs",
    "inputs": [
      "_shared/product-question-format.md",
      "agents/strategic-reviewer.md",
      "references/elimination-gate-protocol.md",
      "skills/audit-ac/SKILL.md",
      "skills/design-tech/SKILL.md",
      "skills/design-ui/SKILL.md",
      "skills/design-ux/SKILL.md",
      "skills/diagnose-bug/SKILL.md",
      "skills/execute-changeset/SKILL.md",
      "skills/manage-finops/SKILL.md",
      "skills/manage-finops/references/finops-spec-template.md",
      "skills/plan-changeset/SKILL.md",
      "skills/review-gate/SKILL.md",
      "skills/route-workflow/SKILL.md",
      "skills/strategic-decision/SKILL.md",
      "skills/svc-advisor/SKILL.md",
      "skills/sync-spec-code/SKILL.md",
      "skills/test-journeys/SKILL.md",
      "skills/validate-feature/SKILL.md",
      "skills/write-spec/SKILL.md",
      "test-framework/evals/tier-1/validate-skill-judgment.mjs",
      "test-framework/fixtures/skill-judgment/behavior.json"
    ]
  },
  {
    validator: "validate-execution-controller-v2.mjs",
    inputs: [
      "schemas/execution-task-capsule-v2.schema.json",
      "schemas/execution-event-v2.schema.json",
      "schemas/evidence-object-v2.schema.json",
      "scripts/svc-execution-controller-v2.mjs",
      "test-framework/evals/tier-1/validate-execution-controller-v2.mjs",
      "test-framework/benchmarks/benchmark-execution-controller-v2.mjs"
    ]
  },
  {
    validator: "validate-concern-compiler-v2.mjs",
    inputs: [
      "scripts/svc-concern-compiler-v2.mjs",
      "test-framework/evals/tier-1/validate-concern-compiler-v2.mjs",
      "concerns/REGISTRY.json"
    ]
  },
  {
    validator: "validate-tier1-selector-v2.mjs",
    inputs: [
      "scripts/select-tier1-validators-v2.mjs",
      "test-framework/evals/tier-1/validate-tier1-selector-v2.mjs"
    ]
  },
  {
    validator: "validate-persistent-review-contract-v2.mjs",
    inputs: [
      "skills/execute-changeset/SKILL.md",
      "skills/diagnose-bug/SKILL.md",
      "DOCTRINE.md",
      "skills/review-plan/SKILL.md",
      "skills/review-exec/SKILL.md",
      "references/change-impact-triad.md",
      "references/plan-review-protocol.md",
      "hooks/svc-impact-triad-guard.mjs",
      "schemas/change-impact-triad.schema.json",
      "test-framework/evals/tier-1/validate-impact-triad.sh",
      "test-framework/evals/tier-1/validate-persistent-review-contract-v2.mjs"
    ]
  },
  {
    validator: "validate-impact-triad-contract-fast-v2.mjs",
    inputs: [
      "skills/execute-changeset/SKILL.md",
      "skills/diagnose-bug/SKILL.md",
      "DOCTRINE.md",
      "references/change-impact-triad.md",
      "hooks/svc-impact-triad-guard.mjs",
      "schemas/change-impact-triad.schema.json",
      "test-framework/evals/tier-1/validate-impact-triad.sh",
      "test-framework/evals/tier-1/validate-impact-triad-contract-fast-v2.mjs"
    ]
  },
  {
    validator: "validate-product-proof-compiler-v2.mjs",
    inputs: [
      "schemas/product-proof-graph-v2.schema.json",
      "scripts/svc-product-proof-compiler-v2.mjs",
      "test-framework/evals/tier-1/validate-product-proof-compiler-v2.mjs"
    ]
  },
  {
    validator: "validate-product-improvement-protocol-v2.mjs",
    inputs: [
      "schemas/product-improvement-protocol-v2.schema.json",
      "scripts/svc-product-improvement-protocol-v2.mjs",
      "references/product-outcome-improvement-protocol-v2.md",
      "test-framework/evals/tier-1/validate-product-improvement-protocol-v2.mjs"
    ]
  },
  {
    validator: "validate-control-value-audit-v2.mjs",
    inputs: [
      "scripts/svc-control-value-audit-v2.mjs",
      "test-framework/evals/tier-1/validate-control-value-audit-v2.mjs"
    ]
  },
  {
    validator: "validate-sample-shadow-replay-v2.mjs",
    inputs: [
      "scripts/replay-sample-revenue-activation-v2.mjs",
      "test-framework/fixtures/execution-controller-v2/sample-revenue-activation-r21-shadow.json",
      "test-framework/evals/tier-1/validate-sample-shadow-replay-v2.mjs",
      "scripts/svc-execution-controller-v2.mjs",
      "schemas/execution-task-capsule-v2.schema.json",
      "schemas/execution-event-v2.schema.json",
      "schemas/evidence-object-v2.schema.json"
    ]
  },
  {
    validator: "validate-layer-inventory-v2.mjs",
    inputs: ["schemas/canonical-layer-inventory-v2.schema.json", "scripts/svc-layer-inventory-v2.mjs", "test-framework/evals/tier-1/validate-layer-inventory-v2.mjs", "references/stage-registry.json", "references/canonical-gates.json"]
  },
  {
    validator: "validate-owner-decision-v2.mjs",
    inputs: ["schemas/owner-decision-v2.schema.json", "scripts/lib/runtime-owner-decision-v2.mjs", "references/owner-decision-runtime-v2.md", "skills/route-workflow/SKILL.md", "skills/decide/SKILL.md", "skills/strategic-decision/SKILL.md", "skills/research/SKILL.md", "test-framework/evals/tier-1/validate-owner-decision-v2.mjs"]
  },
  {
    validator: "validate-skill-runtime-contracts-v2.mjs",
    inputs: ["references/skill-runtime-contracts-v2.json", "references/runtime-continuation-v2.md", "scripts/svc-skill-runtime-compiler-v2.mjs", "skills/analyze-competitors/SKILL.md", "skills/analyze-domain/SKILL.md", "skills/catalog-domain-capabilities/SKILL.md", "skills/build-personas/SKILL.md", "skills/write-vision/SKILL.md", "skills/write-spec/SKILL.md", "skills/design-ux/SKILL.md", "skills/design-ui/SKILL.md", "skills/design-tech/SKILL.md", "skills/plan-changeset/SKILL.md", "test-framework/evals/tier-1/validate-skill-runtime-contracts-v2.mjs"]
  },
  {
    validator: "validate-runtime-scheduler-effects-v2.mjs",
    inputs: ["schemas/execution-lease-v2.schema.json", "scripts/lib/runtime-scheduler-v2.mjs", "scripts/lib/runtime-effects-v2.mjs", "test-framework/evals/tier-1/validate-runtime-scheduler-effects-v2.mjs"]
  },
  {
    validator: "validate-runtime-evidence-consumption-v2.mjs",
    inputs: ["schemas/consumption-ledger-v2.schema.json", "scripts/lib/runtime-evidence-consumption-v2.mjs", "test-framework/evals/tier-1/validate-runtime-evidence-consumption-v2.mjs"]
  },
  {
    validator: "validate-release-lifecycle-v2.mjs",
    inputs: ["schemas/release-lifecycle-v2.schema.json", "scripts/lib/runtime-release-lifecycle-v2.mjs", "skills/review-exec/SKILL.md", "skills/audit-implementation/SKILL.md", "skills/land-changeset/SKILL.md", "skills/verify-promotion/SKILL.md", "test-framework/evals/tier-1/validate-release-lifecycle-v2.mjs"]
  },
  {
    validator: "validate-memory-company-v2.mjs",
    inputs: ["schemas/product-memory-bridge-v2.schema.json", "scripts/lib/runtime-memory-company-v2.mjs", "skills/manage-learnings/SKILL.md", "skills/recall-stack-knowledge/SKILL.md", "skills/cos/SKILL.md", "test-framework/evals/tier-1/validate-memory-company-v2.mjs"]
  },
  {
    validator: "validate-host-runtime-adapter-v2.mjs",
    inputs: ["schemas/host-ingress-v2.schema.json", "scripts/svc-host-runtime-adapter-v2.mjs", "provision/hosts/claude.json", "provision/hosts/codex.json", "provision/hosts/kimi.json", "provision/hosts/gemini.json", "provision/hosts/opencode.json", "provision/hosts/mimo-code.json", "provision/hosts/antigravity.json", "provision/hosts/cursor.json", "provision/hosts/grok.json", "test-framework/evals/tier-1/validate-host-runtime-adapter-v2.mjs"]
  },
  {
    validator: "validate-runtime-migration-v2.mjs",
    inputs: ["schemas/runtime-migration-report-v2.schema.json", "scripts/svc-runtime-migrate-v2.mjs", "references/runtime-migration-v2.md", "test-framework/fixtures/execution-controller-v2/sample-accepted-prefix-v1.json", "test-framework/evals/tier-1/validate-runtime-migration-v2.mjs"]
  },
  {
    validator: "validate-runtime-assurance-mutations-v2.mjs",
    inputs: ["scripts/lib/runtime-assurance-v2.mjs", "test-framework/evals/tier-1/validate-runtime-assurance-mutations-v2.mjs"]
  },
  {
    validator: "validate-runtime-cutover-v2.mjs",
    inputs: ["schemas/runtime-cutover-decision-v2.schema.json", "scripts/svc-cutover-v2.mjs", "references/runtime-v2-cutover.md", "test-framework/evals/tier-1/validate-runtime-cutover-v2.mjs"]
  },
  {
    validator: "validate-runtime-v2.mjs",
    inputs: ["schemas/runtime-journal-event-v2.schema.json", "scripts/lib/generation-bindings-v2.mjs", "scripts/lib/runtime-engine-v2.mjs", "scripts/svc-runtime-v2.mjs", "test-framework/evals/tier-1/validate-runtime-v2.mjs", "test-framework/evals/tier-1/validate-runtime-golden-v2.mjs", "test-framework/fixtures/execution-controller-v2/golden-local-feature-v2.json", "test-framework/evals/run-wi368-final-proof-v2.sh"]
  },
  {
    validator: "validate-review-topology-v2.mjs",
    inputs: ["schemas/reviewer-policy-v2.schema.json", "schemas/review-topology-v2.schema.json", "scripts/review-topology-v2.mjs", "skills/review-exec/SKILL.md", "test-framework/evals/tier-1/validate-review-topology-v2.mjs"]
  },
  {
    validator: "validate-external-review-launcher.sh",
    inputs: ["schemas/external-review-findings.schema.json", "schemas/external-review-receipt.schema.json", "schemas/reviewer-policy-v2.schema.json", "scripts/review-topology-v2.mjs", "scripts/run-external-review.mjs", "test-framework/evals/tier-1/validate-external-review-launcher.sh"]
  },
  {
    validator: "validate-dispatch-resolver-wi551.mjs",
    inputs: [
      "schemas/dispatch-policy.schema.json",
      "examples/dispatch-policy.example.json",
      "scripts/resolve-dispatch.mjs",
      "scripts/resolve-model.sh",
      "scripts/review-topology-v2.mjs",
      "scripts/resolve-adversarial-reviewer.sh",
      "scripts/review-plan-codex.sh",
      "scripts/run-external-review.mjs",
      "test-framework/evals/tier-1/validate-dispatch-resolver-wi551.mjs"
    ]
  },
  {
    validator: "validate-story-receipt-delivery-projection-v2.mjs",
    inputs: ["scripts/audit-story-receipts.mjs", "test-framework/evals/tier-1/validate-story-receipt-delivery-projection-v2.mjs"]
  },
  {
    validator: "validate-runtime-state-model-v2.mjs",
    inputs: ["scripts/lib/runtime-state-model-v2.mjs", "scripts/svc-runtime-v2.mjs", "test-framework/evals/tier-1/validate-runtime-state-model-v2.mjs"]
  },
  {
    validator: "validate-continuation-lifecycle-wi552.mjs",
    inputs: [
      "schemas/continuation-baton.schema.json",
      "schemas/continuation-result.schema.json",
      "scripts/resolve-continuation.mjs",
      "scripts/resolve-dispatch.mjs",
      "hooks/svc-continuation-phase-guard.mjs",
      "hooks/hooks.json",
      ".svc/perf-baseline.json",
      "provision/hosts/antigravity.json",
      "provision/hosts/claude.json",
      "provision/hosts/codex.json",
      "provision/hosts/cursor.json",
      "provision/hosts/gemini.json",
      "provision/hosts/grok.json",
      "provision/hosts/kimi.json",
      "provision/hosts/mimo-code.json",
      "provision/hosts/opencode.json",
      "skills/land-changeset/SKILL.md",
      "skills/verify-promotion/SKILL.md",
      "test-framework/evals/tier-1/validate-continuation-lifecycle-wi552.mjs"
    ]
  },
  {
    validator: "validate-wi546-cursor-live-acceptance.sh",
    inputs: [
      "docs/specs/architecture/wi-548-capability-matrix.md",
      "provision/hosts/cursor.json",
      "scripts/wire-cursor-hooks.mjs",
      "hooks/cursor/svc-cursor-task-completion-guard.sh",
      "setup",
      "scripts/check-install-drift.sh",
      "scripts/resolve-dispatch.mjs",
      "scripts/resolve-model.sh",
      "test-framework/evals/tier-1/validate-wi546-cursor-live-acceptance.sh",
      "test-framework/evals/tier-1/validate-task-graph-cross-host.sh"
    ]
  }
];

const PROPOSAL = "proposals/2026-08-10-wi368-execution-controller-v2.md";
const FULL_SWEEP_INPUTS = new Set([
  "AGENTS.md",
  "skills-manifest.json",
  "test-framework/evals/run-all-evals.sh",
  "scripts/lib/json-schema-validator.mjs"
]);

function normalize(candidate) {
  const normalized = path.posix.normalize(candidate.replaceAll("\\", "/").replace(/^\.\//, ""));
  if (!normalized || normalized === "." || normalized === ".." || normalized.startsWith("../") || path.posix.isAbsolute(normalized)) {
    throw new Error(`unsafe changed path ${candidate}`);
  }
  return normalized;
}

function currentChanges(repoRoot) {
  const tracked = execFileSync("git", ["diff", "--name-only", "HEAD"], { cwd: repoRoot, encoding: "utf8" });
  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: repoRoot, encoding: "utf8" });
  return [...new Set(`${tracked}\n${untracked}`.split(/\r?\n/).filter(Boolean).map(normalize))].sort();
}

export function selectTier1Validators(changedPaths) {
  if (!Array.isArray(changedPaths)) return { valid: false, errors: ["changed_paths must be an array"] };
  let changed;
  try {
    changed = [...new Set(changedPaths.map(normalize))].sort();
  } catch (error) {
    return { valid: false, errors: [error.message] };
  }
  const selected = new Set();
  const unknown = [];
  let fallbackFull = false;
  for (const changedPath of changed) {
    if (FULL_SWEEP_INPUTS.has(changedPath)) {
      fallbackFull = true;
      continue;
    }
    if (changedPath === PROPOSAL) {
      CONTRACTS.forEach((contract) => selected.add(contract.validator));
      continue;
    }
    const owners = CONTRACTS.filter((contract) => contract.inputs.includes(changedPath));
    if (owners.length === 0) unknown.push(changedPath);
    else owners.forEach((owner) => selected.add(owner.validator));
  }
  if (unknown.length > 0) fallbackFull = true;
  return {
    valid: true,
    changed_paths: changed,
    selected: fallbackFull ? [] : [...selected].sort(),
    fallback_full: fallbackFull,
    unknown_paths: unknown,
    reason: fallbackFull ? (unknown.length > 0 ? "unknown-input" : "global-runner-input") : "exact-contract-closure"
  };
}

// FP-030: surface-scoped selection — pick only the validators whose contract
// inputs fall under one of the given path prefixes. A surface matches a
// contract input EXACTLY or as a DIRECTORY PREFIX (input === surf ||
// input.startsWith(surf + "/")); pass directory prefixes ("scripts/") rather
// than leaf files when you want every contract under a tree. Unlike
// changed-path mode, an unmatched surface is NOT a full-sweep trigger — it is
// a loud zero-match failure in run-all-evals.sh; the full tier-1 suite remains
// reserved for CP-PRELAND (run-all-evals.sh without --surface).
export function selectTier1ValidatorsForSurfaces(surfacePaths) {
  if (!Array.isArray(surfacePaths)) return { valid: false, errors: ["surface_paths must be an array"] };
  let surfaces;
  try {
    // path.posix.normalize PRESERVES a trailing slash ("schemas/" stays
    // "schemas/"), which would break the surf + "/" prefix test. Strip it.
    surfaces = [...new Set(surfacePaths.map((candidate) => {
      const normalized = normalize(candidate);
      return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
    }))];
  } catch (error) {
    return { valid: false, errors: [error.message] };
  }
  const selected = new Set();
  for (const contract of CONTRACTS) {
    if (contract.inputs.some((input) => surfaces.some((surf) => input === surf || input.startsWith(surf + "/")))) {
      selected.add(contract.validator);
    }
  }
  // NOTE: this function returns PURE contract matches — an empty array means
  // "no contract covers these surfaces". The RUNNER owns adding
  // validate-tier1-selector-v2.mjs and deciding that an empty surface scope is
  // a loud failure rather than a silent pass.
  return {
    valid: true,
    surfaces,
    selected: [...selected].sort(),
    fallback_full: false,
    reason: "surface-scope"
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--") || !argv[index + 1]) throw new Error(`bad argument ${token}`);
    args[token.slice(2)] = argv[index + 1];
    index += 1;
  }
  return args;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const repoRoot = path.resolve(args["repo-root"] ?? process.cwd());
    if (args.surface !== undefined) {
      const surfaces = args.surface.split(",").map((entry) => entry.trim()).filter(Boolean);
      const result = selectTier1ValidatorsForSurfaces(surfaces);
      if (args.format === "lines" && result.valid) process.stdout.write(result.selected.length > 0 ? result.selected.join("\n") + "\n" : "");
      else (result.valid ? process.stdout : process.stderr).write(JSON.stringify(result) + "\n");
      process.exitCode = result.valid ? 0 : 1;
    } else {
    const changed = args["changed-json"] ? JSON.parse(args["changed-json"]) : currentChanges(repoRoot);
    const result = selectTier1Validators(changed);
    if (args.format === "lines" && result.valid) {
      if (result.fallback_full) process.stdout.write("__FULL__\n");
      else if (result.selected.length > 0) process.stdout.write(`${result.selected.join("\n")}\n`);
    } else {
      (result.valid ? process.stdout : process.stderr).write(`${JSON.stringify(result)}\n`);
    }
    process.exitCode = result.valid ? 0 : 1;
    }
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ valid: false, errors: [error.message] })}\n`);
    process.exitCode = 2;
  }
}
