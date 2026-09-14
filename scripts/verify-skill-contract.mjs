#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

function die(message) {
  console.error(message);
  process.exit(1);
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    die(`${filePath}: ${error.message}`);
  }
}

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token.startsWith("--")) {
      die(`Unexpected argument: ${token}`);
    }
    const key = token.slice(2);
    const next = args[i + 1];
    if (next == null || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }
    if (flags[key] === undefined) {
      flags[key] = next;
    } else if (Array.isArray(flags[key])) {
      flags[key].push(next);
    } else {
      flags[key] = [flags[key], next];
    }
    i += 1;
  }
  return flags;
}

function toArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function walk(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function escapeRegex(literal) {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function frontmatterBlock(skillPath) {
  const content = readText(skillPath);
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) die(`${skillPath}: missing frontmatter`);
  return match[1];
}

function outputPathsFromSkill(skillPath) {
  const fm = frontmatterBlock(skillPath);
  const outputsBlock = fm.match(/\noutputs:\n([\s\S]*?)\nchain:/);
  if (!outputsBlock) {
    return [];
  }
  return Array.from(outputsBlock[1].matchAll(/path:\s*"([^"]+)"/g), (m) => m[1]);
}

function pathPatternToRegex(pattern) {
  let value = escapeRegex(pattern);
  value = value.replace(/<[^>]+>/g, "[^/]+");
  value = value.replace(/\\\*/g, "[^/]*");
  if (pattern.endsWith("/")) {
    return new RegExp(`^${value}.+`);
  }
  return new RegExp(`^${value}$`);
}

function artifactFamily(skillName, flags) {
  const root = path.resolve(String(flags.root || process.cwd()));
  const skillPath = path.join(REPO_ROOT, "skills", skillName, "SKILL.md");
  if (!fs.existsSync(skillPath)) {
    die(`Skill not found: ${skillPath}`);
  }
  const patterns = outputPathsFromSkill(skillPath);
  if (patterns.length === 0) {
    die(`${skillName}: no output paths found in frontmatter`);
  }
  const files = walk(root).map((filePath) => path.relative(root, filePath).replace(/\\/g, "/"));
  const matches = [];
  for (const pattern of patterns) {
    const regex = pathPatternToRegex(pattern);
    const matched = files.filter((file) => regex.test(file));
    if (matched.length > 0) {
      matches.push({ pattern, matched });
    }
  }
  if (matches.length === 0) {
    die(
      JSON.stringify(
        {
          ok: false,
          skill: skillName,
          root,
          checked_patterns: patterns,
          message: "No declared output family matched any emitted artifact",
        },
        null,
        2
      )
    );
  }
  console.log(
    JSON.stringify(
      {
        ok: true,
        skill: skillName,
        root,
        matched_families: matches,
      },
      null,
      2
    )
  );
}

function parseInteger(content, regex, label) {
  const match = content.match(regex);
  if (!match) {
    die(`Missing ${label}`);
  }
  const value = Number(match[1]);
  if (!Number.isInteger(value)) {
    die(`Invalid ${label}: ${match[1]}`);
  }
  return value;
}

function countIssueRows(section) {
  return section
    .split(/\r?\n/)
    .filter((line) => /^\|/.test(line))
    .filter((line) => !/^\|[-\s|]+\|?$/.test(line))
    .filter((line) => !/\|\s*File\s*\|\s*Area\s*\|/i.test(line)).length;
}

function sectionBetween(content, startHeading, endHeading) {
  const escapedStart = escapeRegex(startHeading);
  const escapedEnd = escapeRegex(endHeading);
  const match = content.match(new RegExp(`${escapedStart}\\n([\\s\\S]*?)\\n${escapedEnd}`));
  return match ? match[1] : "";
}

function visualReviewCloseout(flags) {
  if (!flags.report || !flags["screenshots-dir"]) {
    die("visual-review-closeout requires --report and --screenshots-dir");
  }
  const reportPath = path.resolve(String(flags.report));
  const screenshotsDir = path.resolve(String(flags["screenshots-dir"]));
  const content = readText(reportPath);
  const screenshotFiles = walk(screenshotsDir).filter((file) => /\.(png|jpg|jpeg|webp)$/i.test(file));
  const filesReviewed = parseInteger(content, /\*\*Files reviewed:\*\*\s+(\d+)/, "Files reviewed");
  const critical = parseInteger(content, /-\s+Critical:\s+(\d+)/, "Critical count");
  const high = parseInteger(content, /-\s+High:\s+(\d+)/, "High count");
  const low = parseInteger(content, /-\s+Low:\s+(\d+)/, "Low count");
  const totalIssues = parseInteger(content, /-\s+Total issues:\s+(\d+)/, "Total issues");
  const clean = parseInteger(content, /-\s+Clean:\s+(\d+)\s*\/\s*(\d+)/, "Clean count");
  const cleanTotal = Number((content.match(/-\s+Clean:\s+(\d+)\s*\/\s*(\d+)/) || [])[2]);
  if (!Number.isInteger(cleanTotal)) {
    die("Missing Clean total");
  }
  const criticalRows = countIssueRows(sectionBetween(content, "### Critical", "### High"));
  const highRows = countIssueRows(sectionBetween(content, "### High", "### Low"));
  const lowRows = countIssueRows(sectionBetween(content, "### Low", "## Clean Screenshots"));

  if (filesReviewed !== screenshotFiles.length) {
    die(`Files reviewed (${filesReviewed}) does not match screenshot count (${screenshotFiles.length})`);
  }
  if (cleanTotal !== filesReviewed) {
    die(`Clean total (${cleanTotal}) does not match files reviewed (${filesReviewed})`);
  }
  if (critical !== criticalRows) {
    die(`Critical summary (${critical}) does not match critical table rows (${criticalRows})`);
  }
  if (high !== highRows) {
    die(`High summary (${high}) does not match high table rows (${highRows})`);
  }
  if (low !== lowRows) {
    die(`Low summary (${low}) does not match low table rows (${lowRows})`);
  }
  if (totalIssues !== critical + high + low) {
    die(`Total issues (${totalIssues}) does not equal Critical+High+Low (${critical + high + low})`);
  }
  if (clean < 0 || clean > filesReviewed) {
    die(`Clean count (${clean}) is out of range for ${filesReviewed} reviewed files`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        report: reportPath,
        screenshots_dir: screenshotsDir,
        screenshots: screenshotFiles.length,
        files_reviewed: filesReviewed,
        critical,
        high,
        low,
        total_issues: totalIssues,
        clean,
      },
      null,
      2
    )
  );
}

const TERMINAL_SCENARIO_STATUSES = new Set([
  "executed",
  "skipped-infeasible",
  "skipped-user-approved",
]);

const ALLOWED_NEXT_SKILLS = {
  "test-journeys": new Set([
    "audit-ac",
    "write-journeys",
    "sync-spec-code",
    "diagnose-bug",
    "write-e2e",
    "quick-fix",
  ]),
};

function testJourneysCloseout(flags) {
  if (!flags.summary || !flags.scenarios) {
    die("test-journeys-closeout requires --summary and --scenarios");
  }
  const summaryPath = path.resolve(String(flags.summary));
  const scenariosPath = path.resolve(String(flags.scenarios));
  if (!fs.existsSync(summaryPath)) {
    die(`Missing summary: ${summaryPath}`);
  }
  const scenarios = JSON.parse(readText(scenariosPath));
  if (!Array.isArray(scenarios)) {
    die(`${scenariosPath}: scenarios must be an array`);
  }
  const invalid = scenarios.filter((scenario) => !TERMINAL_SCENARIO_STATUSES.has(scenario.status));
  if (invalid.length > 0) {
    die(`Non-terminal scenarios present: ${invalid.map((s) => s.id || "<unknown>").join(", ")}`);
  }
  const infeasibleWithoutWi = scenarios.filter(
    (scenario) => scenario.status === "skipped-infeasible" && !scenario.wi_path
  );
  if (infeasibleWithoutWi.length > 0) {
    die(
      `Skipped-infeasible scenarios missing wi_path: ${infeasibleWithoutWi
        .map((s) => s.id || "<unknown>")
        .join(", ")}`
    );
  }
  const nextSkills = toArray(flags.next).map(String);
  const allowed = ALLOWED_NEXT_SKILLS["test-journeys"];
  const invalidNext = nextSkills.filter((skill) => !allowed.has(skill));
  if (invalidNext.length > 0) {
    die(
      `Disallowed next skills for test-journeys: ${invalidNext.join(", ")} (allowed: ${Array.from(
        allowed
      ).join(", ")})`
    );
  }
  console.log(
    JSON.stringify(
      {
        ok: true,
        summary: summaryPath,
        scenarios: scenariosPath,
        total_scenarios: scenarios.length,
        next_skills: nextSkills,
      },
      null,
      2
    )
  );
}

const [command, ...rest] = process.argv.slice(2);
if (!command) {
  die(
    "Usage: node scripts/verify-skill-contract.mjs <artifact-family|visual-review-closeout|test-journeys-closeout> [...]"
  );
}

if (command === "artifact-family") {
  const [skillName, ...flagArgs] = rest;
  if (!skillName) {
    die("artifact-family requires <skill-name>");
  }
  artifactFamily(skillName, parseFlags(flagArgs));
  process.exit(0);
}

if (command === "visual-review-closeout") {
  visualReviewCloseout(parseFlags(rest));
  process.exit(0);
}

if (command === "test-journeys-closeout") {
  testJourneysCloseout(parseFlags(rest));
  process.exit(0);
}

die(`Unknown command: ${command}`);
