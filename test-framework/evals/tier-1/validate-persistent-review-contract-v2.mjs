#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import os from "node:os";

const root = path.resolve(import.meta.dirname, "../../..");
const files = Object.fromEntries([
  "skills/execute-changeset/SKILL.md",
  "skills/diagnose-bug/SKILL.md",
  "DOCTRINE.md",
  "skills/review-plan/SKILL.md",
  "skills/review-exec/SKILL.md",
  "scripts/review-plan-codex.sh",
  "references/change-impact-triad.md",
  "references/plan-review-protocol.md",
  "hooks/svc-impact-triad-guard.mjs",
  "schemas/change-impact-triad.schema.json"
].map((relative) => [relative, fs.readFileSync(path.join(root, relative), "utf8")]));

const checks = [
  [files["skills/execute-changeset/SKILL.md"].includes("independent_review.status: deferred-to-final"), "execute contract binds high task to final review"],
  [files["skills/execute-changeset/SKILL.md"].includes("no per-task quality review"), "execute contract keeps no-per-task-review rule"],
  [!files["skills/execute-changeset/SKILL.md"].includes("For `high`, collect different-family independent review"), "execute contract removes mandatory high per-task reviewer"],
  [files["hooks/svc-impact-triad-guard.mjs"].includes('review.status === "deferred-to-final"'), "impact guard accepts explicit final-review deferral"],
  [files["hooks/svc-impact-triad-guard.mjs"].includes("finalTasks.length !== 1"), "impact guard requires exactly one final review task"],
  [files["schemas/change-impact-triad.schema.json"].includes('"enum": [1, 2]'), "impact schema supports explicit N-1 and v2 receipts"],
  [files["schemas/change-impact-triad.schema.json"].includes('"deferred-to-final"'), "impact schema carries v2 deferral state"],
  [files["hooks/svc-impact-triad-guard.mjs"].includes("schema v2 high receipt must defer"), "impact guard prevents v2 per-task review regression"],
  [!files["DOCTRINE.md"].includes("high requires different-family review plus behavioral/runtime proof"), "doctrine removes per-task high reviewer mandate"],
  [files["DOCTRINE.md"].includes("one final different-family review"), "doctrine preserves final different-family review"],
  [files["skills/diagnose-bug/SKILL.md"].includes("one final different-family `review-exec` task"), "bug lane binds high work to final review"],
  [files["references/change-impact-triad.md"].includes("one final different-family review task"), "impact reference binds high work to final review"],
  [!files["skills/review-plan/SKILL.md"].includes("two consecutive passes surface nothing"), "plan self-review no longer loops on subjective empty passes"],
  [!files["skills/review-plan/SKILL.md"].includes("Tier 3 MANDATORY"), "plan review has no mandatory standalone Tier 3"],
  [files["skills/review-plan/SKILL.md"].includes("one holistic"), "plan review declares one holistic external stage"],
  [!files["skills/review-exec/SKILL.md"].includes("two\nconsecutive passes surface nothing new"), "execution self-review no longer requires two empty passes"],
  [files["skills/review-exec/SKILL.md"].includes("review-topology-v2.mjs plan"), "execution review resolves the owner-configured topology"],
  [files["skills/review-exec/SKILL.md"].includes('REVIEW_ORCHESTRATOR="$(bash scripts/detect-host.sh)"'), "execution review detects the active orchestrator host"],
  [files["skills/review-exec/SKILL.md"].includes('--orchestrator "$REVIEW_ORCHESTRATOR"'), "execution review passes the detected host to owner topology"],
  [!files["skills/review-exec/SKILL.md"].includes("--orchestrator codex"), "execution review does not hardcode Codex topology"],
  [files["skills/review-exec/SKILL.md"].includes("--reviewer-mode production"), "production execution review binds the production owner mode"],
  [files["skills/review-exec/SKILL.md"].includes("same-family Sol station remains advisory"), "same-family Sol is never mislabeled independent"],
  [!files["skills/review-exec/SKILL.md"].includes("bash scripts/resolve-adversarial-reviewer.sh > .svc/review-exec-pair.json"), "execution review no longer starts from the legacy scheduled selector"],
  [files["scripts/review-plan-codex.sh"].includes('SVC_REVIEWER_POLICY:-$HOME/.svc/reviewer-policy-v2.json'), "plan review automatically discovers the owner config"],
  [files["scripts/review-plan-codex.sh"].includes('REVIEWER_STATION="${SVC_REVIEWER_STATION:-}"'), "plan review preserves an explicit owner station override"],
  [files["scripts/review-plan-codex.sh"].includes('(!requested || station.id === requested)'), "explicit plan station remains bound to required independent authority"],
  [files["scripts/review-plan-codex.sh"].includes('review-topology-v2.mjs" plan'), "plan review derives its default station from owner topology"],
  [!files["scripts/review-plan-codex.sh"].includes('SVC_REVIEWER_STATION:-agy'), "plan review has no hardcoded AGY default"],
  [files["scripts/review-plan-codex.sh"].includes('--candidate-digest "$PLAN_SHA"'), "plan review binds configured reviewer evidence to the exact plan digest"],
  [files["scripts/review-plan-codex.sh"].includes('candidate_digest=$PLAN_SHA'), "plan review package carries the exact candidate digest"],
  [files["scripts/review-plan-codex.sh"].includes('fs.readFileSync(process.argv[1],"utf8")'), "plan review reads relative summary paths as files rather than module identifiers"],
  [files["scripts/review-plan-codex.sh"].includes("receipt missing from launcher summary"), "plan review fails closed when the launcher receipt path is absent"],
  [!files["references/plan-review-protocol.md"].includes("### Tier 3"), "canonical protocol removes standalone Tier 3"],
  [files["references/plan-review-protocol.md"].includes("owner/founder"), "product/security disagreement routes to owner authority"]
];

const detected = JSON.parse(execFileSync("bash", [path.join(root, "scripts/resolve-adversarial-reviewer.sh")], {
  encoding: "utf8",
  env: { PATH: process.env.PATH, HOME: process.env.HOME, CODEX_THREAD_ID: "019fe940-ae80-7b70-8cbe-ceb1fa4172b7" },
}));
checks.push([detected.orchestrator === "codex", "plan and execution review agree on CODEX_THREAD_ID host detection"]);

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "svc-review-station-"));
try {
  const plan = path.join(fixture, "WI-531-plan.md");
  const policy = path.join(fixture, "reviewer-policy-v2.json");
  fs.writeFileSync(plan, "# WI-531 plan\n");
  const self = { id: "self", kind: "inline-self", required: true, authority: "advisory", tuple: { host: "current", family: "openai", model: "current", effort: "high" } };
  const optional = { id: "optional", kind: "external", required: false, authority: "independent", tuple: { host: "agy", family: "google", model: "Gemini 3.6 Flash (High)", effort: "high" } };
  const required = { ...optional, id: "required", required: true };
  const phase = { release_authority: true, stations: [self, optional, required] };
  fs.writeFileSync(policy, JSON.stringify({ schema_version: 2, authority: "repository-owner", default_mode: "production", modes: { production: { orchestrators: { codex: { plan: phase, exec: phase } } } } }));
  fs.chmodSync(policy, 0o600);
  let rejected = false;
  let rejectionDetail = "";
  try {
    execFileSync("bash", [path.join(root, "scripts/review-plan-codex.sh"), plan], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, SVC_HOST: "codex", SVC_REVIEWER_POLICY: policy, SVC_REVIEWER_MODE: "production", SVC_REVIEWER_STATION: "optional" },
    });
  } catch (error) {
    rejectionDetail = String(error.stderr || "");
    rejected = rejectionDetail.includes("required independent external station matching optional");
  }
  checks.push([rejected, `plan adapter rejects an optional external station before provider invocation${rejected ? "" : ` (${rejectionDetail.trim()})`}`]);

  const sameFamily = { ...required, id: "same-family", tuple: { host: "codex", family: "openai", model: "gpt-5.6-sol", effort: "high" } };
  const invalidPhase = { release_authority: true, stations: [self, sameFamily, required] };
  fs.writeFileSync(policy, JSON.stringify({ schema_version: 2, authority: "repository-owner", default_mode: "production", modes: { production: { orchestrators: { codex: { plan: invalidPhase, exec: invalidPhase } } } } }));
  fs.chmodSync(policy, 0o600);
  let sameFamilyRejected = false;
  try {
    execFileSync("node", [path.join(root, "scripts/review-topology-v2.mjs"), "plan", "--config", policy, "--orchestrator", "codex", "--phase", "plan", "--mode", "production"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    sameFamilyRejected = String(error.stderr || "").includes("independent external authority must be different-family");
  }
  checks.push([sameFamilyRejected, "same-family external station cannot be labeled independent even when a different-family station also exists"]);
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}

const failures = checks.filter(([passed]) => !passed).map(([, label]) => label);
if (failures.length > 0) {
  process.stderr.write(`${JSON.stringify({ valid: false, failures })}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`persistent review contract v2: ${checks.length} passed, 0 failed\n`);
}
