#!/usr/bin/env node
// compact-meta-to-skill.mjs — Meta-Learning feedback path (cutting-edge technique #8)
// Compacts a high-confidence process meta-learning into the target skill's
// "## Process Learnings" section. Confidence < 0.7 is skipped. The category maps
// to the skill that owns that process. This is the feedback step that closes the
// meta-learning loop (write-decision --type meta-learning → here → skill doc).
// Usage: node scripts/compact-meta-to-skill.mjs <category> "<observation>" <confidence>

import fs from "node:fs";
import path from "node:path";

const projectDir = process.env.SVC_PROJECT_DIR || ".";

const META_SKILL_MAP = {
  research_strategy: "skills/research/SKILL.md",
  verification_approach: "skills/review-gate/SKILL.md",
  decomposition_pattern: "skills/plan-changeset/SKILL.md",
  model_routing: "rules/common/model-selection.md",
  context_management: "references/context-budget.md",
  error_recovery: "skills/diagnose-bug/SKILL.md",
  review_effectiveness: "skills/review-gate/SKILL.md",
  tool_usage: "references/agent-patterns.md",
};

function compactMetaToSkill(category, observation, confidence) {
  if (!(confidence >= 0.7)) {
    console.error(`confidence ${confidence} < 0.7 — skipping compaction`);
    return false;
  }
  const targetFile = META_SKILL_MAP[category];
  if (!targetFile) {
    console.error(`no target skill for category: ${category} (known: ${Object.keys(META_SKILL_MAP).join(", ")})`);
    return false;
  }
  const skillPath = path.join(projectDir, targetFile);
  if (!fs.existsSync(skillPath)) {
    console.error(`target not found: ${skillPath}`);
    return false;
  }
  const content = fs.readFileSync(skillPath, "utf8");
  const marker = "## Process Learnings";
  const entry = `- [${category}] ${observation}\n`;
  let updated;
  if (content.includes(marker)) {
    const idx = content.indexOf(marker);
    const nextSection = content.indexOf("\n## ", idx + marker.length);
    const insertAt = nextSection >= 0 ? nextSection : content.length;
    updated = content.slice(0, insertAt) + entry + content.slice(insertAt);
  } else {
    const pipeIdx = content.indexOf("## Pipeline Continuation");
    const insertAt = pipeIdx >= 0 ? pipeIdx : content.length;
    updated = content.slice(0, insertAt) + marker + "\n\n" + entry + "\n" + content.slice(insertAt);
  }
  fs.writeFileSync(skillPath, updated);
  console.log(JSON.stringify({ ok: true, target: targetFile, appended: entry.trim() }));
  return true;
}

const [, , category, observation, confidenceRaw] = process.argv;
if (!category || !observation || confidenceRaw === undefined) {
  console.error('Usage: compact-meta-to-skill.mjs <category> "<observation>" <confidence>');
  process.exit(1);
}
const ok = compactMetaToSkill(category, observation, Number(confidenceRaw));
process.exit(ok ? 0 : 2);
