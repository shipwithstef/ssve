// The AC digest must see every story's acceptance criteria, not only the first section
// (review 6108295729). The spec template writes one "Acceptance Criteria" section per
// user story, so a change in story 2 must change the digest.
import test from "node:test";
import assert from "node:assert/strict";
import { acSignatures, acTableSha256, acDuplicateIds, extractAcSection } from "../../scripts/lib/normalize-ac-table.mjs";

const spec = (second = "Only owner can delete account", extra = "") => `# Feature: accounts

## User Stories

### US-1: Log in
As a member I log in.

### Acceptance Criteria — US-1: Log in

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| ACCT-01 | Member can log in with email and password | — | 🔲 | — |

### US-2: Delete account
As a member I delete my account.

### Acceptance Criteria — US-2: Delete account

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| ACCT-02 | ${second} | — | 🔲 | — |
${extra}
## Persona Trace
P1 drives US-1 and US-2.
`;

test("reproduction: a requirement change in the second story changes the digest", () => {
  assert.notEqual(acTableSha256(spec()), acTableSha256(spec("Any user can delete account")));
});

test("signatures include every story's criteria in order", () => {
  assert.deepEqual(acSignatures(spec()), [
    "acct-01::member can log in with email and password",
    "acct-02::only owner can delete account",
  ]);
});

test("a story added after the first section changes the digest", () => {
  const added = spec("Only owner can delete account", "| ACCT-03 | Deleted data is purged within 30 days | — | 🔲 | — |\n");
  assert.notEqual(acTableSha256(spec()), acTableSha256(added));
  assert.equal(acSignatures(added).length, 3);
  const third = spec() .replace("## Persona Trace", "### US-3: Export\n\n### Acceptance Criteria — US-3: Export\n\n| AC | Description |\n|----|----|\n| ACCT-04 | Member can export data | \n\n## Persona Trace");
  assert.notEqual(acTableSha256(spec()), acTableSha256(third));
});

test("removing a later story's criteria changes the digest", () => {
  const removed = spec().replace(/\| ACCT-02 .*\n/, "");
  assert.notEqual(acTableSha256(spec()), acTableSha256(removed));
});

test("status, proof and heading-only edits stay digest-neutral across stories", () => {
  const base = acTableSha256(spec());
  assert.equal(acTableSha256(spec().replace(/\| — \| 🔲 \| — \|/g, "| pass | ✅ | t.spec.ts |")), base);
  assert.equal(acTableSha256(spec().replace("Acceptance Criteria — US-2: Delete account", "Acceptance Criteria — US-2: Remove account")), base);
});

test("one umbrella section with story subheadings is not counted twice", () => {
  const umbrella = `## Acceptance Criteria\n### US-1\n| AC | Description |\n|--|--|\n| A-01 | one |\n### Acceptance Criteria — US-2\n| AC | Description |\n|--|--|\n| A-02 | two |\n## Other\n`;
  assert.deepEqual(acSignatures(umbrella), ["a-01::one", "a-02::two"]);
});

test("checklist and labeled criteria in later sections are bound too", () => {
  const mixed = `## Acceptance Criteria\n- [ ] first thing works\n\n## Notes\nprose\n\n## Acceptance Criteria (continued)\n- **AC-9-2:** second thing works\n`;
  assert.deepEqual(acSignatures(mixed), ["first thing works", "ac-9-2::second thing works"]);
});

test("a spec with no acceptance criteria section still hashes the empty binding", () => {
  assert.deepEqual(acSignatures("# nothing here\n"), []);
  assert.equal(extractAcSection("# nothing here\n"), "");
});

test("duplicate AC ids across stories are reported", () => {
  const dup = spec().replace("ACCT-02", "ACCT-01");
  assert.deepEqual(acDuplicateIds(dup), ["acct-01"]);
  assert.deepEqual(acDuplicateIds(spec()), []);
});

test("extractAcSection returns every section, so handoff text carries all stories", () => {
  const text = extractAcSection(spec());
  assert.match(text, /ACCT-01/);
  assert.match(text, /ACCT-02/);
});
