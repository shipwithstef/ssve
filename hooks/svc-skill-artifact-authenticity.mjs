#!/usr/bin/env node
/**
 * svc-skill-artifact-authenticity.mjs — G-4 enforcement (PR #28).
 *
 * PreToolUse hook on Edit|Write. When the target path is a CANONICAL output
 * of a particular skill (e.g. docs/specs/features/* belongs to validate-feature
 * or write-spec), require evidence that the corresponding skill ran recently
 * before the write is allowed. Recent = within SVC_SKILL_RECEIPT_WINDOW_MIN
 * minutes (default 90) in `.svc/pipeline-decisions.jsonl`.
 *
 * Counterfeit prevention: agents previously hand-rolled files that look like
 * skill output without invoking the skill. This hook denies that path unless:
 *   1. A receipt exists, OR
 *   2. SVC_SKILL_ARTIFACT_ALLOW=1 is set (e.g. for human edits / refactors).
 *
 * Override:
 *   SVC_SKILL_ARTIFACT_ALLOW=1                — skip the entire check
 *   SVC_SKILL_RECEIPT_WINDOW_MIN=<integer>    — change recency window
 *
 * Exit codes:
 *   0   — pass (path not protected, or receipt found, or override set)
 *   2   — HARD BLOCK
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { readHookPayload, extractFilePath } = await import(
  path.join(__dirname, "lib", "hook-payload.mjs")
);
const { resolveOperationScope } = await import(path.join(__dirname, "lib", "operation-scope.mjs"));
// WI-487 (F-003/AC-487-7): route the block through the 5-field actionable-denial
// envelope + durable receipt (fall back to the legacy prose on older installs).
let emitDenial = null;
try { ({ emitDenial } = await import(path.join(__dirname, "lib", "hook-denial.mjs"))); } catch { /* older install */ }

const call = readHookPayload();
if (!call) process.exit(0);
if (!["Edit", "Write", "Update"].includes(call.toolName)) process.exit(0);

const filePath = extractFilePath(call.toolInput);
if (!filePath) process.exit(0);

const operationHost = call.raw?.host || process.env.SVC_HOST ||
  (process.env.CLAUDE_PLUGIN_ROOT || process.env.CLAUDE_CODE_REMOTE || process.env.CLAUDE_PROJECT_DIR ? "claude" : "codex");
const operationScope = resolveOperationScope({
  ...call.raw, host: operationHost,
  tool_name: call.toolName, tool_input: call.toolInput, cwd: call.session_cwd || call.cwd,
});
if (!operationScope.ok) process.exit(0);
const target = operationScope.targets[0];
const targetRoot = target?.worktree_root || operationScope.operation_repository?.worktree_root || operationScope.operation_cwd;
if (!targetRoot) process.exit(0);

if (process.env.SVC_SKILL_ARTIFACT_ALLOW === "1") process.exit(0);

// Path → required-skill mapping. Each entry can be:
//   - a directory prefix (matches files within)
//   - an exact file path
// Multiple eligible skills are listed; matching ANY satisfies the check.
const SKILL_OUTPUT_PATHS = [
  // Skill canonical output paths
  { match: "docs/specs/features/", skills: ["validate-feature", "write-spec"] },
  { match: "docs/specs/design-ux/", skills: ["design-ux"] },
  { match: "docs/specs/design-ui/", skills: ["design-ui"] },
  { match: "docs/specs/design-tech/", skills: ["design-tech"] },
  { match: "docs/specs/plans/", skills: ["plan-changeset"] },
  { match: "docs/specs/decisions/", skills: ["strategic-decision", "explore-solutions", "decide"] },
  { match: "docs/specs/coverage-audit.md", skills: ["audit-coverage"], exact: true },
  { match: "docs/specs/capability-plan.md", skills: ["plan-capabilities"], exact: true },
  { match: "docs/specs/personas/", skills: ["build-personas"] },
  { match: "docs/specs/journeys/", skills: ["write-journeys"] },
  { match: "docs/specs/research-log.md", skills: ["research"], exact: true },
  // Framework-critical files (require plan-changeset, improve-framework, or evolve-framework receipt)
  { match: "skills-manifest.json", skills: ["plan-changeset", "improve-framework", "evolve-framework", "create-skill"], exact: true },
  { match: "REPO_MODES.md", skills: ["plan-changeset", "improve-framework", "evolve-framework"], exact: true },
  { match: "EXTERNAL_ADDONS.md", skills: ["plan-changeset", "improve-framework", "evolve-framework"], exact: true },
  { match: "DOCTRINE.md", skills: ["plan-changeset", "improve-framework", "evolve-framework"], exact: true },
  { match: "FRAMEWORK-STATE.md", skills: ["plan-changeset", "improve-framework", "evolve-framework"], exact: true },
  { match: "AGENTS.md", skills: ["plan-changeset", "improve-framework", "evolve-framework"], exact: true },
  { match: "skills/route-workflow/SKILL.md", skills: ["route-workflow", "improve-framework", "evolve-framework"], exact: true },
  { match: "references/routing-rules.md", skills: ["route-workflow", "improve-framework", "evolve-framework"], exact: true },
  { match: "references/lane-model.md", skills: ["improve-framework", "evolve-framework"], exact: true },
  { match: "references/intent-routing.md", skills: ["route-workflow", "improve-framework", "evolve-framework"], exact: true },
];

// Find the rule that matches this file_path
function findRule(rel) {
  for (const r of SKILL_OUTPUT_PATHS) {
    if (r.exact) {
      if (rel === r.match) return r;
    } else if (rel.startsWith(r.match)) {
      return r;
    }
  }
  return null;
}

// Normalize file path to repo-relative
const cwd = targetRoot;
let rel = filePath;
if (path.isAbsolute(rel)) {
  rel = path.relative(cwd, target?.canonical || rel);
}
// strip leading ./
if (rel.startsWith("./")) rel = rel.slice(2);

const rule = findRule(rel);
if (!rule) process.exit(0);

// New-file exception: write-spec must be allowed to create the first version
// of a feature spec from scratch. The check is meaningful when the file already
// exists (re-edit) OR when at least one skill in the rule has a recent invocation.
// For brand-new files we still require a recent invocation receipt.

const windowMin = Number.parseInt(
  process.env.SVC_SKILL_RECEIPT_WINDOW_MIN || "90",
  10
);
const cutoff = Date.now() - windowMin * 60 * 1000;

// Read pipeline-decisions.jsonl and look for a recent matching skill invocation
const decisionsPath = path.join(cwd, ".svc", "pipeline-decisions.jsonl");
let recent = false;
let lastSkill = null;
if (fs.existsSync(decisionsPath)) {
  const lines = fs.readFileSync(decisionsPath, "utf8").trim().split("\n");
  // Walk in reverse (most recent first)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const ts = Date.parse(entry.timestamp || "");
    if (Number.isFinite(ts) && ts < cutoff) break; // older than window — stop
    if (entry.skill && rule.skills.includes(entry.skill)) {
      recent = true;
      lastSkill = entry.skill;
      break;
    }
  }
}

if (recent) process.exit(0);

const requiredSkill = rule.skills.length === 1 ? rule.skills[0] : rule.skills.join(" OR ");
const humanReason =
  `❌ svc-skill-artifact-authenticity (G-4): canonical skill-artifact path written without skill invocation.\n\n` +
  `   Target file:    ${rel}\n` +
  `   Required skill: ${requiredSkill}\n` +
  `   Recency window: ${windowMin} minutes (set SVC_SKILL_RECEIPT_WINDOW_MIN to change)\n\n` +
  `   Why blocked: this path is the canonical OUTPUT of the named skill. Writing here without\n` +
  `   invoking the skill produces a 'counterfeit' artifact — it has the format of a skill output\n` +
  `   but no gate-receipts in .svc/pipeline-decisions.jsonl.\n\n` +
  `   Proper paths:\n` +
  `     1. Invoke /skill:${rule.skills[0]} — runs the skill, emits a receipt\n` +
  `     2. Write to a draft path (e.g. docs/drafts/...) — outside protected paths\n` +
  `     3. Set SVC_SKILL_ARTIFACT_ALLOW=1 (for human edits / refactors only — log why)`;

if (emitDenial) {
  emitDenial({
    hook_id: "svc-skill-artifact-authenticity",
    reason_code: "SVC-SKILL-ARTIFACT-UNAUTHENTIC",
    cause: `Canonical skill-artifact path "${rel}" written without a recent ${requiredSkill} invocation (${windowMin}min window) — counterfeit-artifact risk (G-4).`.slice(0, 1200),
    operation: `Edit/Write of ${rel}`,
    recovery: `Invoke /skill:${rule.skills[0]} so the skill runs and emits a receipt, OR write to a draft path outside the protected paths, OR set SVC_SKILL_ARTIFACT_ALLOW=1 for a logged human edit.`,
    resolved_command_path: rel,
    session_id: process.env.SVC_SESSION_ID || process.env.CLAUDE_SESSION_ID || "",
  });
  process.stderr.write(humanReason + "\n");
  process.exit(2);
} else {
  process.stderr.write(humanReason + "\n");
  process.exit(2);
}
