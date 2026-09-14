#!/usr/bin/env node
/**
 * Regression suite for the design-conformance close gate in audit-story-receipts.mjs.
 * Ported from example-marketplace (main, scripts/audit-story-receipts.test.mjs) for WI-521 Batch A.
 * Codex R2 (2026-07-29) required the adversarial scenarios to live as committed,
 * reproducible tests, not as one-off shell probes in a session log.
 *
 * Run: node --test scripts/audit-story-receipts.test.mjs
 *
 * Each test builds a throwaway git repo (git add is enough — the validator checks
 * the INDEX via ls-files), mutates one thing, and asserts the validator's exit code.
 *
 * svc parameterization note: the validator now loads STAGES/REQUIRED from
 * references/stage-registry.json (cwd-relative — no embedded fallback), so every
 * fixture repo needs its own copy of the real registry alongside the receipts file;
 * `buildRepo()` copies it in from this repo's actual references/stage-registry.json.
 * The registry's "test" story-type profile also folds in the 6 svc essential stages
 * (plan/review-plan/implement/review-exec/spec-sync/index-restamp) that example-marketplace's
 * original REQUIRED.test (['journeys','e2e','ledger']) did not carry, so the GREEN
 * fixture's receipts now pin all nine required stages `done`, not three.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const VALIDATOR = path.resolve(import.meta.dirname, 'audit-story-receipts.mjs');
const REGISTRY_SRC = path.resolve(import.meta.dirname, '..', 'references', 'stage-registry.json');
const WI = 'WI-T-01';

// The svc essential stages plus the "test" profile's own two conditional stages
// (journeys, e2e) — every required stage for story_type "test", per the real
// registry's story_type_profiles.test. Kept as evidence-bearing `done` receipts,
// same shape example-marketplace's fixture already used for journeys/e2e/ledger.
const TEST_PROFILE_STAGES = ['journeys', 'plan', 'review-plan', 'implement', 'review-exec', 'e2e', 'spec-sync', 'ledger', 'index-restamp'];

const GREEN = {
  [`docs/specs/ui/${WI}-screen.md`]: [
    '# Screen spec fixture',
    '',
    '| ID | Requirement |',
    '|---|---|',
    `| UI-${WI}-01 | the first requirement |`,
    `| UI-${WI}-02 | the second requirement |`,
  ].join('\n'),
  'docs/specs/decisions/test/DECISION.md': `# Card\n\ncovers ${WI}.\n\nStatus: SIGNED 2026-07-29\n`,
  [`docs/specs/design-conformance/${WI}.md`]: [
    '# Conformance fixture',
    '',
    '| ID | Spec row | Grade | Citation |',
    '|---|---|---|---|',
    `| UI-${WI}-01 | first | MET | \`docs/evidence.md:1\` |`,
    `| UI-${WI}-02 | second | FILED — WI-DEBT-1 | filed |`,
    '',
    '## Signed clauses',
    '',
    '| Clause | Signed text | Grade | Citation |',
    '|---|---|---|---|',
    '| D1 | the clause (RE-SIGNED wording in prose must not trip) | MET | `docs/evidence.md:1` |',
    '',
    '## Verdict',
    '',
    'All good.',
  ].join('\n'),
  'docs/evidence.md': 'evidence line\n',
  [`docs/specs/receipts/${WI}.receipts.json`]: JSON.stringify({
    wi: WI,
    story_type: 'test',
    scope: 'fixture',
    stages: TEST_PROFILE_STAGES.map((stage) => ({
      stage, status: 'done', evidence: ['docs/evidence.md'], grounded_on: ['code: fixture'], note: '',
    })),
  }, null, 2),
};

function buildRepo(mutate = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'receipts-gate-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  const registry = fs.readFileSync(REGISTRY_SRC, 'utf8');
  const files = { 'references/stage-registry.json': registry, ...GREEN, ...mutate };
  for (const [rel, content] of Object.entries(files)) {
    if (content === null) continue; // null = omit the file entirely
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  execFileSync('git', ['add', '-A'], { cwd: dir });
  return dir;
}

function runGate(dir, { receiptsPath = `docs/specs/receipts/${WI}.receipts.json`, env } = {}) {
  const res = spawnSync(process.execPath, [VALIDATOR, receiptsPath], {
    cwd: dir, encoding: 'utf8', env: env ?? process.env,
  });
  return { code: res.status, out: `${res.stdout}\n${res.stderr}` };
}

test('green fixture passes (incl. RE-SIGNED prose + Verdict section after the walk)', () => {
  const { code, out } = runGate(buildRepo());
  assert.equal(code, 0, out);
  assert.match(out, /1\/2 design rows MET, 1 signed clauses MET/);
});

test('missing conformance report fails when a screen spec exists', () => {
  const { code, out } = runGate(buildRepo({ [`docs/specs/design-conformance/${WI}.md`]: null }));
  assert.equal(code, 1, out);
  assert.match(out, /missing\/untracked/);
});

test('MISSING grade is a blocker', () => {
  const report = GREEN[`docs/specs/design-conformance/${WI}.md`]
    .replace('| MET | `docs/evidence.md:1` |', '| MISSING | — |');
  const { code, out } = runGate(buildRepo({ [`docs/specs/design-conformance/${WI}.md`]: report }));
  assert.equal(code, 1, out);
  assert.match(out, /MISSING \(blocker/);
});

test('a fenced "## Signed clauses" heading does not satisfy the exit-walk', () => {
  const report = GREEN[`docs/specs/design-conformance/${WI}.md`]
    .replace('## Signed clauses', '```\n## Signed clauses');
  const { code, out } = runGate(buildRepo({ [`docs/specs/design-conformance/${WI}.md`]: report }));
  assert.equal(code, 1, out);
  assert.match(out, /no "## Signed clauses" exit-walk/);
});

test('an INDENTED-CODE-BLOCK row does not count as a graded row', () => {
  // Row 02's real grade line is replaced by a 4-space-indented copy: Markdown
  // renders that as code, so the gate must treat ID 02 as UNCOVERED.
  const report = GREEN[`docs/specs/design-conformance/${WI}.md`]
    .replace(`| UI-${WI}-02 | second | FILED — WI-DEBT-1 | filed |`,
      `    | UI-${WI}-02 | second | MET | \`docs/evidence.md:1\` |`);
  const { code, out } = runGate(buildRepo({ [`docs/specs/design-conformance/${WI}.md`]: report }));
  assert.equal(code, 1, out);
  assert.match(out, /no graded report row: UI-WI-T-01-02/);
});

test('MET without a tracked path:line citation fails', () => {
  const report = GREEN[`docs/specs/design-conformance/${WI}.md`]
    .replace('| MET | `docs/evidence.md:1` |\n', '| MET | verified by inspection |\n');
  const { code, out } = runGate(buildRepo({ [`docs/specs/design-conformance/${WI}.md`]: report }));
  assert.equal(code, 1, out);
  assert.match(out, /MET without a tracked path:line citation/);
});

test('a spec ID with no report row fails (coverage, spec -> report)', () => {
  const spec = GREEN[`docs/specs/ui/${WI}-screen.md`] + `\n| UI-${WI}-03 | a third requirement |\n`;
  const { code, out } = runGate(buildRepo({ [`docs/specs/ui/${WI}-screen.md`]: spec }));
  assert.equal(code, 1, out);
  assert.match(out, /no graded report row: UI-WI-T-01-03/);
});

test('a report row the spec never declared fails (coverage, report -> spec)', () => {
  const report = GREEN[`docs/specs/design-conformance/${WI}.md`]
    .replace('## Signed clauses', `| UI-${WI}-09 | padded | MET | \`docs/evidence.md:1\` |\n\n## Signed clauses`);
  const { code, out } = runGate(buildRepo({ [`docs/specs/design-conformance/${WI}.md`]: report }));
  assert.equal(code, 1, out);
  assert.match(out, /does not declare: UI-WI-T-01-09/);
});

test('RE-SIGN in a signed grade cell blocks', () => {
  const report = GREEN[`docs/specs/design-conformance/${WI}.md`]
    .replace('| MET | `docs/evidence.md:1` |\n\n## Verdict', '| RE-SIGN | — |\n\n## Verdict');
  const { code, out } = runGate(buildRepo({ [`docs/specs/design-conformance/${WI}.md`]: report }));
  assert.equal(code, 1, out);
  assert.match(out, /awaiting RE-SIGN/);
});

test('junk WI pointer in PARTIAL/FILED fails the grade enum', () => {
  const report = GREEN[`docs/specs/design-conformance/${WI}.md`]
    .replace('FILED — WI-DEBT-1', 'FILED — WI--');
  const { code, out } = runGate(buildRepo({ [`docs/specs/design-conformance/${WI}.md`]: report }));
  assert.equal(code, 1, out);
  assert.match(out, /is not MET \/ MISSING/);
});

test('ASCII-hyphen pointer form is accepted (documented in story-receipts.md)', () => {
  const report = GREEN[`docs/specs/design-conformance/${WI}.md`]
    .replace('FILED — WI-DEBT-1', 'FILED - WI-DEBT-1');
  const { code, out } = runGate(buildRepo({ [`docs/specs/design-conformance/${WI}.md`]: report }));
  assert.equal(code, 0, out);
});

test('receipt wi that does not match the filename fails', () => {
  const receipts = JSON.parse(GREEN[`docs/specs/receipts/${WI}.receipts.json`]);
  receipts.wi = 'WI-OTHER-9';
  const { code, out } = runGate(buildRepo({
    [`docs/specs/receipts/${WI}.receipts.json`]: JSON.stringify(receipts, null, 2),
  }));
  assert.equal(code, 1, out);
  assert.match(out, /must be a WI id matching the filename/);
});

test('a tab-separated H2 after the walk still bounds the signed section', () => {
  const report = GREEN[`docs/specs/design-conformance/${WI}.md`]
    .replace('## Verdict', '##\tVerdict')
    // junk table under the tab-heading must NOT parse as signed rows
    + '\n| X | y | NOPE | z |\n';
  const { code, out } = runGate(buildRepo({ [`docs/specs/design-conformance/${WI}.md`]: report }));
  assert.equal(code, 0, out);
});

test('git unavailable fails CLOSED, not n/a', () => {
  const dir = buildRepo();
  const { code, out } = runGate(dir, { env: { ...process.env, PATH: '/nonexistent' } });
  assert.equal(code, 1, out);
  assert.match(out, /conformance gate could not run|NOT CLOSABLE/);
});

// ---- Registry sanity guards (FIX 7 — untested guards rot; this batch's whole thesis is
// mechanical enforcement over remembered enforcement). Each mutates a copy of the REAL
// registry so the fixture stays representative rather than a hand-rolled stand-in.
function loadRealRegistry() {
  return JSON.parse(fs.readFileSync(REGISTRY_SRC, 'utf8'));
}

test('registry sanity: duplicate stage key exits 2', () => {
  const reg = loadRealRegistry();
  reg.stages.push({ ...reg.stages[0] });
  const { code, out } = runGate(buildRepo({ 'references/stage-registry.json': JSON.stringify(reg, null, 2) }));
  assert.equal(code, 2, out);
  assert.match(out, /duplicate stage key "vision"/);
});

test('registry sanity: a stage class outside essential|conditional|situational exits 2', () => {
  const reg = loadRealRegistry();
  reg.stages[0].class = 'bogus';
  const { code, out } = runGate(buildRepo({ 'references/stage-registry.json': JSON.stringify(reg, null, 2) }));
  assert.equal(code, 2, out);
  assert.match(out, /must be essential\|conditional\|situational/);
});

test('registry sanity: a profile referencing an unknown stage key exits 2', () => {
  const reg = loadRealRegistry();
  reg.story_type_profiles.test.push('nonexistent-stage-key');
  const { code, out } = runGate(buildRepo({ 'references/stage-registry.json': JSON.stringify(reg, null, 2) }));
  assert.equal(code, 2, out);
  assert.match(out, /references unknown stage key "nonexistent-stage-key"/);
});

test('registry sanity: a missing registry file exits 2', () => {
  const { code, out } = runGate(buildRepo({ 'references/stage-registry.json': null }));
  assert.equal(code, 2, out);
  assert.match(out, /not found or unreadable/);
});
