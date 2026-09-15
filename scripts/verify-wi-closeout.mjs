#!/usr/bin/env node
/**
 * verify-wi-closeout.mjs — Hard close-out gate for framework-lane WIs.
 *
 * Given a WI number, verify every close-out artifact is present + consistent.
 * Exit 0 on PASS, exit 1 on FAIL (with diagnostic lines on stderr).
 *
 * v1 scope — framework lane only. URL-Playwright portion of WI-095 is deferred
 * until WI-097 (browser-verify doctrine + wrapper) lands.
 *
 * Checks:
 *   1. docs/specs/work-items/WI-NNN.md exists and Status is in DONE bucket
 *   2. docs/specs/work-items/DONE.md contains a row for WI-NNN
 *   3. docs/specs/work-items/INDEX.md shows WI-NNN as a DONE-bucket status
 *   4. Main git history contains a commit whose subject/body references WI-NNN
 *      and, when present, one starting with "chore(WI-NNN):" (closeout)
 *
 * Override: if WI-NNN.md frontmatter contains a `**Close-Override:** <reason>`
 *           line, all other checks are skipped and the override reason is
 *           echoed to stdout for audit trail.
 *
 * Usage:
 *   node scripts/verify-wi-closeout.mjs WI-100
 *   node scripts/verify-wi-closeout.mjs 100
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const REPO_ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const WI_DIR = path.join(REPO_ROOT, "docs/specs/work-items");
const DONE_STATUSES = new Set([
  "verified",
  "done",
  "closed",
  "baselined",
  "shipped",
  "completed",
  "implemented",
  "resolved",
  "merged",
  "released",
]);

function die(msg, code = 1) {
  process.stderr.write(`verify-wi-closeout: ${msg}\n`);
  process.exit(code);
}

const raw = process.argv[2];
if (!raw) die("usage: verify-wi-closeout.mjs <WI-NNN|NNN>", 2);
const match = raw.match(/^(?:WI-)?(\d+)$/);
if (!match) die(`invalid WI identifier: ${raw}`, 2);
const wiNum = match[1].padStart(3, "0");
const wiId = `WI-${wiNum}`;
const wiPath = path.join(WI_DIR, `${wiId}.md`);

const failures = [];
function check(cond, msg) {
  if (!cond) failures.push(msg);
}

function statusKey(rawStatus) {
  return String(rawStatus || "")
    .trim()
    .split(/[\s—–\-(,]/)[0]
    .toLowerCase();
}

function extractWiStatus(text) {
  const markdown = text.match(/^\*\*Status:\*\*\s*(.+?)\s*$/im)?.[1];
  const frontmatter = text.match(/^status:\s*(.+?)\s*$/im)?.[1];
  return (markdown || frontmatter || "").trim();
}

function isDoneStatus(rawStatus) {
  return DONE_STATUSES.has(statusKey(rawStatus));
}

// (1) WI file exists + Status is in DONE bucket
if (!fs.existsSync(wiPath)) die(`${wiId}.md not found`, 1);
const wiText = fs.readFileSync(wiPath, "utf8");

const overrideMatch = wiText.match(/^\*\*Close-Override:\*\*\s*(.+)$/m);
if (overrideMatch) {
  process.stdout.write(`${wiId}: CLOSE-OVERRIDE applied — ${overrideMatch[1].trim()}\n`);
  process.exit(0);
}

check(
  isDoneStatus(extractWiStatus(wiText)),
  `${wiId}.md Status is not in DONE bucket (frontmatter/body check)`,
);

// (2) DONE.md has a row for this WI
const donePath = path.join(WI_DIR, "DONE.md");
if (fs.existsSync(donePath)) {
  const doneText = fs.readFileSync(donePath, "utf8");
  check(
    new RegExp(`\\|\\s*\\[${wiId}\\]`, "m").test(doneText),
    `DONE.md has no row for ${wiId}`,
  );
} else {
  failures.push("DONE.md does not exist");
}

// (3) INDEX.md shows a DONE-bucket status
const indexPath = path.join(WI_DIR, "INDEX.md");
if (fs.existsSync(indexPath)) {
  const indexText = fs.readFileSync(indexPath, "utf8");
  const indexRow = indexText.match(new RegExp(`^-\\s*\\[${wiId}\\].*$`, "m"));
  check(indexRow !== null, `INDEX.md has no row for ${wiId}`);
  if (indexRow) {
    const indexStatus = indexRow[0].match(/status:\s*([^)\],\s]+)/i)?.[1] || "";
    check(
      isDoneStatus(indexStatus),
      `INDEX.md row for ${wiId} is not a DONE-bucket status`,
    );
  }
} else {
  failures.push("INDEX.md does not exist");
}

// (4) Commit trail: feature commit + closeout commit on main
try {
  // Use current-branch ancestry so pre-merge branches (including the one
  // landing this WI) count their own commits. On main, this == main history.
  const log = execSync(`git log --format=%H%x09%s%n%b HEAD`, {
    encoding: "utf8",
    cwd: REPO_ROOT,
  });
  // Accept any commit whose subject references the WI by ID. Older WIs
  // (pre-convention) may use subjects like "chore: close WI-NNN ..." or
  // "<skill>: ... WI-NNN ..."; newer ones use "WI-NNN: ...". Either is
  // sufficient evidence of merged work.
  const isWipedHistory = /wipe history|convert private to public/i.test(log);
  const hasMention = new RegExp(`\\b${wiId}\\b`, "m").test(log);
  const hasCloseout = new RegExp(`^[0-9a-f]+\\tchore\\(${wiId}\\):`, "m").test(log);
  if (!hasMention && isWipedHistory) {
    process.stderr.write(
      `verify-wi-closeout: note — git commit trail for ${wiId} was truncated in history wipe; accepting documented DONE/INDEX state\n`,
    );
  } else {
    check(
      hasMention,
      `no commit referencing "${wiId}" found on main`,
    );
  }
  if (!hasCloseout) {
    // Closeout may be missing if squash merge bundled it — warn but don't fail
    // if feature commit exists and DONE.md/INDEX.md rows are present.
    process.stderr.write(
      `verify-wi-closeout: note — no separate "chore(${wiId}): ..." commit; assuming squash-bundled closeout since DONE/INDEX rows present\n`,
    );
  }
} catch (e) {
  failures.push(`git log failed: ${e.message}`);
}

if (failures.length === 0) {
  process.stdout.write(`${wiId}: PASS — all close-out artifacts consistent\n`);
  process.exit(0);
}

process.stderr.write(`${wiId}: FAIL — ${failures.length} issue(s)\n`);
for (const f of failures) process.stderr.write(`  - ${f}\n`);
process.exit(1);
