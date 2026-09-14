#!/usr/bin/env node
/**
 * init-project-state.mjs
 *
 * Idempotently initializes a project's .svc/ directory from framework templates.
 * Run after onboarding a repo to svc or when adding state management to an
 * existing project.
 *
 * Usage:
 *   node init-project-state.mjs [--surface-only] [project-path]
 *
 * If project-path is omitted, uses $PWD.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { appendJsonlLine, writeJsonAtomic } from "./state-io.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRAMEWORK_ROOT = path.resolve(__dirname, "..");
const TEMPLATES_DIR = path.join(FRAMEWORK_ROOT, "templates", ".svc");

const cliArgs = process.argv.slice(2);
const surfaceOnly = cliArgs.includes("--surface-only");
const projectPath = cliArgs.find((arg) => !arg.startsWith("--")) || process.cwd();
const targetSvc = path.resolve(projectPath, ".svc");

function gitOutput(args) {
  const result = spawnSync("git", ["-C", projectPath, ...args], { encoding: "utf8" });
  return result.status === 0 ? (result.stdout || "").trim() : "";
}

function repositorySlug(remote, fallback) {
  const clean = String(remote || "")
    .replace(/^https?:\/\/[^/@]+@/, "https://")
    .replace(/\.git$/, "")
    .replace(/^git@([^:]+):/, "$1/");
  const match = clean.match(/(?:^|\/)([^/]+\/[^/]+)$/);
  return match ? match[1] : fallback;
}

function ensureContainedDirectory(root, parts) {
  let current = root;
  for (const part of parts) {
    const next = path.join(current, part);
    if (fs.existsSync(next)) {
      const stat = fs.lstatSync(next);
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        throw new Error(`refusing project surface outside repository: ${next} is not a real directory`);
      }
    } else {
      fs.mkdirSync(next);
    }
    current = next;
  }
  return current;
}

function assertContainedFile(file) {
  if (!fs.existsSync(file)) return;
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`refusing project surface outside repository: ${file} is not a real file`);
  }
}

function provisionProjectSurface() {
  const projectRoot = fs.realpathSync(projectPath);
  const remote = gitOutput(["remote", "get-url", "origin"]);
  const slug = repositorySlug(remote, path.basename(projectRoot));
  const repositoryName = slug.split("/").at(-1);
  ensureContainedDirectory(projectRoot, [".agents", "skills", "repo-context"]);
  const identityPath = path.join(projectRoot, ".agents", "repository.json");
  const agentsPath = path.join(projectRoot, "AGENTS.md");
  const localSkillPath = path.join(projectRoot, ".agents", "skills", "repo-context", "SKILL.md");
  for (const file of [identityPath, agentsPath, localSkillPath]) assertContainedFile(file);
  if (!fs.existsSync(identityPath)) {
    writeJsonAtomic(identityPath, {
      schema_version: 1,
      repository_name: repositoryName,
      repository_slug: slug,
      canonical_root: ".",
      context_files: ["AGENTS.md", "CLAUDE.md", "docs/specs/router-context.md"],
      project_skills_directory: ".agents/skills",
      framework_execution_source: "central-install-only",
    });
    console.log(`CREATE: ${identityPath}`);
  } else {
    console.log(`SKIP (exists): ${identityPath}`);
  }

  if (!fs.existsSync(agentsPath)) {
    fs.writeFileSync(agentsPath, `# AGENTS.md — ${repositoryName}\n\n` +
      `This checkout is **${repositoryName}**. Repository identity is recorded in \`.agents/repository.json\`.\n\n` +
      `- Read and follow \`CLAUDE.md\` when present.\n` +
      `- Read \`docs/specs/router-context.md\` before routing, deployment, or environment work.\n` +
      `- Use \`.agents/skills/\` only for project-local knowledge and workflows.\n` +
      `- Resolve svc framework executables only from the centrally installed skills source; never treat this consumer checkout as the enforcement source.\n`, "utf8");
    console.log(`CREATE: ${agentsPath}`);
  } else {
    console.log(`SKIP (exists): ${agentsPath}`);
  }

  if (!fs.existsSync(localSkillPath)) {
    fs.writeFileSync(localSkillPath, `---\n` +
      `name: repo-context\n` +
      `description: Use when work in ${repositoryName} needs repository identity, local routing rules, deployment boundaries, or project-specific conventions.\n` +
      `inputs:\n  required:\n    - { path: ".agents/repository.json", artifact: repository-identity }\n` +
      `outputs:\n  produces: []\n` +
      `chain:\n  progressive: false\n  self_verify: true\n  human_checkpoint: false\n---\n\n` +
      `# Repository Context\n\n` +
      `**Announce at start:** "I'm using the repo-context skill to bind this work to ${repositoryName}."\n\n` +
      `1. Read \`.agents/repository.json\`, \`AGENTS.md\`, and \`docs/specs/router-context.md\` when present.\n` +
      `2. Confirm \`git rev-parse --show-toplevel\` names this checkout before any write.\n` +
      `3. Treat this directory as project knowledge only. Never execute svc enforcement helpers from the consumer repository.\n\n` +
      `## Self-Verify\n\n| # | Check | How | PASS/FAIL |\n|---|---|---|---|\n| 1 | Identity loaded | Read \`.agents/repository.json\` | |\n| 2 | Routing loaded | Read router context when present | |\n| 3 | Framework source safe | Central installed source only | |\n\n` +
      `## Pipeline Continuation\n\nContinue through \`route-workflow\` using the repository's existing \`.svc/lane-tasks-<WI>.json\`; this skill does not create or claim a WI.\n`, "utf8");
    console.log(`CREATE: ${localSkillPath}`);
  } else {
    console.log(`SKIP (exists): ${localSkillPath}`);
  }
}

if (!fs.existsSync(projectPath)) {
  console.error(`Project path does not exist: ${projectPath}`);
  process.exit(1);
}

if (!fs.existsSync(TEMPLATES_DIR)) {
  console.error(`Templates directory missing: ${TEMPLATES_DIR}`);
  process.exit(1);
}

fs.mkdirSync(targetSvc, { recursive: true });

if (surfaceOnly) {
  provisionProjectSurface();
  console.log(`\nProject consumer surface initialized at: ${path.resolve(projectPath)}`);
  process.exit(0);
}

const now = new Date().toISOString();
const templates = fs.readdirSync(TEMPLATES_DIR);

for (const file of templates) {
  const src = path.join(TEMPLATES_DIR, file);
  const dst = path.join(targetSvc, file);

  if (fs.existsSync(dst)) {
    console.log(`SKIP (exists): ${dst}`);
    continue;
  }

  let content = fs.readFileSync(src, "utf8");
  content = content.replace(/"<ISO-8601 timestamp>"/g, `"${now}"`);
  content = content.replace(/"<ISO-8601>"/g, `"${now}"`);

  if (file.endsWith(".json")) {
    writeJsonAtomic(dst, JSON.parse(content));
  } else if (file.endsWith(".jsonl") && content.trim()) {
    for (const line of content.split("\n").filter(Boolean)) {
      appendJsonlLine(dst, JSON.parse(line));
    }
  } else {
    fs.writeFileSync(dst, content, "utf8");
  }
  console.log(`CREATE: ${dst}`);
}

provisionProjectSurface();


// Idempotently provision root .gitignore
const gitignoreTemplatePath = path.join(FRAMEWORK_ROOT, "templates", ".gitignore.template");
if (fs.existsSync(gitignoreTemplatePath)) {
  const templateContent = fs.readFileSync(gitignoreTemplatePath, "utf8").trim();
  const targetGitignore = path.join(projectPath, ".gitignore");
  const startMarker = "# === BEGIN SERIOUS VIBE CODING IGNORES ===";
  const endMarker = "# === END SERIOUS VIBE CODING IGNORES ===";

  if (!fs.existsSync(targetGitignore)) {
    // State A: File does not exist
    fs.writeFileSync(targetGitignore, templateContent + "\n", "utf8");
    console.log(`CREATE: ${targetGitignore}`);
  } else {
    let existingContent = fs.readFileSync(targetGitignore, "utf8");
    if (!existingContent.includes(startMarker) || !existingContent.includes(endMarker)) {
      // State B: File exists, envelope missing
      let newContent = existingContent;
      if (newContent && !newContent.endsWith("\n")) {
        newContent += "\n";
      }
      newContent += "\n" + templateContent + "\n";
      fs.writeFileSync(targetGitignore, newContent, "utf8");
      console.log(`UPDATE (append ignores): ${targetGitignore}`);
    } else {
      // State C: File exists, envelope present
      const startIdx = existingContent.indexOf(startMarker);
      const endIdx = existingContent.indexOf(endMarker) + endMarker.length;
      const newContent = existingContent.slice(0, startIdx) + templateContent + existingContent.slice(endIdx);
      fs.writeFileSync(targetGitignore, newContent, "utf8");
      console.log(`UPDATE (sync ignores): ${targetGitignore}`);
    }
  }
} else {
  console.log("WARN: .gitignore template missing, skipping root ignore provisioning.");
}

// Idempotently provision .gitattributes + register the .svc/*.json merge driver
// (WI-398) so parallel orchestrator sessions in THIS project don't corrupt each
// other's mutable .svc state on merge. Marker-enveloped like .gitignore above.
const gaTemplatePath = path.join(FRAMEWORK_ROOT, "templates", ".gitattributes.template");
if (fs.existsSync(gaTemplatePath)) {
  const gaTemplate = fs.readFileSync(gaTemplatePath, "utf8").trim();
  const targetGa = path.join(projectPath, ".gitattributes");
  const gaStart = "# === BEGIN SERIOUS VIBE CODING ATTRIBUTES ===";
  const gaEnd = "# === END SERIOUS VIBE CODING ATTRIBUTES ===";
  if (!fs.existsSync(targetGa)) {
    fs.writeFileSync(targetGa, gaTemplate + "\n", "utf8");
    console.log(`CREATE: ${targetGa}`);
  } else {
    const existing = fs.readFileSync(targetGa, "utf8");
    if (!existing.includes(gaStart) || !existing.includes(gaEnd)) {
      const sep = existing && !existing.endsWith("\n") ? "\n" : "";
      fs.writeFileSync(targetGa, existing + sep + "\n" + gaTemplate + "\n", "utf8");
      console.log(`UPDATE (append attributes): ${targetGa}`);
    } else {
      const s = existing.indexOf(gaStart);
      const e = existing.indexOf(gaEnd) + gaEnd.length;
      const rest = existing.slice(e);
      // gaTemplate is trimmed (no trailing newline); guarantee exactly one
      // newline after the END marker so following rules aren't jammed onto the
      // marker line (Gemini G6 #5).
      const joiner = rest === "" ? "\n" : (rest.startsWith("\n") ? "" : "\n");
      fs.writeFileSync(targetGa, existing.slice(0, s) + gaTemplate + joiner + rest, "utf8");
      console.log(`UPDATE (sync attributes): ${targetGa}`);
    }
  }
  // Register the driver COMMAND in the project's .git/config, pointing at the
  // framework's absolute driver path (the project itself has no driver script).
  // Best-effort: not a git repo / driver missing → git's safe default applies.
  const driverPath = path.join(FRAMEWORK_ROOT, "scripts", "svc-json-merge-driver.mjs");
  const installer = path.join(FRAMEWORK_ROOT, "scripts", "install-svc-merge-driver.sh");
  if (fs.existsSync(installer) && fs.existsSync(driverPath)) {
    const r = spawnSync("bash", [installer, "--repo", path.resolve(projectPath), "--driver", driverPath], { encoding: "utf8" });
    if (r.status === 0) console.log(`REGISTER: .svc/*.json merge driver (svc-json)`);
    else console.log(`SKIP: merge driver registration (${(r.stderr || "").trim() || "not a git repo"})`);
  }
} else {
  console.log("WARN: .gitattributes template missing, skipping merge-protocol provisioning.");
}

console.log(`\nProject state initialized at: ${targetSvc}`);
