// @organism-suite
// P1.3b: the AC digest includes later user stories, and plan-changeset's
// output section carries a Done means checklist that audit-implementation checks.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { acSignatures } from "../../scripts/lib/normalize-ac-table.mjs";

const laterStorySpec = `# Feature: accounts

## User Stories

### US-1: Log in

#### Acceptance Criteria

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| EARLY-01 | Member can log in with email and password | — | 🔲 | — |

### US-2: Delete account

#### Acceptance Criteria

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| LATE-01 | Only the owner can delete the account | — | 🔲 | — |
| LATE-02 | A bad password is rejected and the account stays | — | 🔲 | — |
`;

test("a later user story's ACs appear in the digest", () => {
  const sigs = acSignatures(laterStorySpec);
  assert.deepEqual(sigs, [
    "early-01::member can log in with email and password",
    "late-01::only the owner can delete the account",
    "late-02::a bad password is rejected and the account stays",
  ]);
});

function h2(md, heading) {
  const lines = md.split("\n");
  const start = lines.findIndex((line) => line === heading);
  assert.ok(start >= 0, `missing ${heading}`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## [^#]/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

test("the done-means checklist sits inside the plan output section", () => {
  const md = fs.readFileSync("skills/plan-changeset/SKILL.md", "utf8");
  const output = h2(md, "## Output");
  assert.match(output, /### Done means/);
  assert.match(output, /Every acceptance criterion maps to a check that proves it/);
  assert.match(output, /hidden-behaviour edge cases \(bad input, failure paths\)/);
  assert.match(output, /Done means every check passes/);
  assert.match(output, /journeys, empty and error states, auth, payments, data lifecycle, and phone/);
  const outputAt = md.indexOf("## Output");
  const lastH2 = md.lastIndexOf("\n## ");
  assert.ok(outputAt >= 0 && outputAt < lastH2, "checklist must not be the file's final section");
  assert.doesNotMatch(md.slice(lastH2), /### Done means/);
});

test("audit-implementation verifies the plan's done-means checklist in one sentence", () => {
  const md = fs.readFileSync("skills/audit-implementation/SKILL.md", "utf8");
  const phase = h2(md, "## Process");
  const hits = phase.match(/When the plan includes a Done means checklist, verify every acceptance criterion maps to a check that proves it, that hidden-behaviour edge cases \(bad input, failure paths\) are listed, and that done means every check passes\./g);
  assert.equal(hits?.length, 1);
  assert.doesNotMatch(md, /^## Review procedure/im);
});
