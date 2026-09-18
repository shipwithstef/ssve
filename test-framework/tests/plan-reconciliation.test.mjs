import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseReviewReport,
  formatReconciliationPrompt,
  reconciliationSessionFlags,
  evaluateDisputeStatus,
  formatAuditorDisputeRecheckPrompt,
  MAX_DISPUTE_ROUNDS,
} from '../../scripts/lib/plan-reconciliation.mjs';

test('parseReviewReport correctly extracts verdict, counts, findings, and revisions', () => {
  const sampleReport = `
# Review Report

Reviewer: Claude Fable 5.1 Medium

## Verdict: **REVISE**

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| C-01 | Critical | Task 25 cannot close as declared. | lane-tasks:8204 |
| H-01 | High | Location key conflation in Task 28. | useUrlState.jsx:57 |

## Required revisions before Task 26
1. C-01: schedule two-box-plan rerun post-quota.
2. H-01: split Explore-marker key from managed-location key.

\`\`\`text
verdict: REVISE
critical: 1  high: 1  medium: 0  low: 0
\`\`\`
`;

  const parsed = parseReviewReport(sampleReport);
  assert.equal(parsed.verdict, 'REVISE');
  assert.equal(parsed.counts.critical, 1);
  assert.equal(parsed.counts.high, 1);
  assert.equal(parsed.counts.medium, 0);
  assert.equal(parsed.counts.low, 0);
  assert.equal(parsed.findings.length, 2);
  assert.equal(parsed.findings[0].id, 'C-01');
  assert.equal(parsed.findings[0].severity, 'Critical');
  assert.equal(parsed.findings[1].id, 'H-01');
  assert.equal(parsed.findings[1].severity, 'High');
  assert.equal(parsed.requiredRevisions.length, 2);
  assert.match(parsed.requiredRevisions[0], /schedule two-box-plan/);
});

test('formatReconciliationPrompt constructs targeted prompt preserving session context', () => {
  const parsedReport = {
    verdict: 'REVISE',
    counts: { critical: 1, high: 0, medium: 0, low: 0 },
    findings: [{ id: 'C-01', severity: 'Critical', finding: 'Missing seal', evidence: 'file:1' }],
    requiredRevisions: ['Fix seal'],
  };

  const prompt = formatReconciliationPrompt({
    manifestPath: 'docs/plans/manifest.v5.md',
    reviewReportPath: 'docs/plans/fable-plan-review.md',
    parsedReport,
    iteration: 0,
  });

  assert.match(prompt, /Planner Reconciliation Directive \(Iteration 1\)/);
  assert.match(prompt, /docs\/plans\/manifest\.v5\.md/);
  assert.match(prompt, /C-01/);
  assert.match(prompt, /Reuse Your Session & Context/);
});

test('reconciliationSessionFlags returns correct flags for grok, cursor, claude', () => {
  assert.deepEqual(reconciliationSessionFlags({ host: 'grok' }), ['--continue', '--always-approve']);
  assert.deepEqual(reconciliationSessionFlags({ host: 'grok', sessionId: '123-abc' }), ['--resume', '123-abc', '--always-approve']);
  assert.deepEqual(reconciliationSessionFlags({ host: 'grok', effort: 'xhigh' }), ['--continue', '--always-approve', '--reasoning-effort', 'xhigh']);
  assert.deepEqual(reconciliationSessionFlags({ host: 'grok', sessionId: '123-abc', effort: 'high' }), ['--resume', '123-abc', '--always-approve', '--reasoning-effort', 'high']);
  assert.deepEqual(reconciliationSessionFlags({ host: 'cursor' }), ['--continue']);
  assert.deepEqual(reconciliationSessionFlags({ host: 'cursor', sessionId: '456-def' }), ['--resume', '456-def']);
  assert.deepEqual(reconciliationSessionFlags({ host: 'claude' }), ['--continue']);
});

test('evaluateDisputeStatus bounds disputes to MAX_DISPUTE_ROUNDS (1 round)', () => {
  // Case 1: No disputed findings (all accepted)
  const allAccepted = evaluateDisputeStatus({ disputedFindings: [], currentIteration: 0 });
  assert.equal(allAccepted.status, 'RECONCILED');
  assert.equal(allAccepted.escalateToOwner, false);

  // Case 2: Disputed findings on iteration 0 -> allowed to recheck
  const round0 = evaluateDisputeStatus({ disputedFindings: [{ id: 'H-01' }], currentIteration: 0 });
  assert.equal(round0.status, 'DISPUTE_RECHECK_NEEDED');
  assert.equal(round0.canProceedToAuditorRecheck, true);
  assert.equal(round0.escalateToOwner, false);

  // Case 3: Disputed findings on iteration 1 -> MAX_DISPUTE_ROUNDS reached -> ESCALATE
  const round1 = evaluateDisputeStatus({ disputedFindings: [{ id: 'H-01' }], currentIteration: 1 });
  assert.equal(round1.status, 'ESCALATE_TO_OWNER');
  assert.equal(round1.canProceedToAuditorRecheck, false);
  assert.equal(round1.escalateToOwner, true);
  assert.match(round1.reason, /Human owner checkpoint required/);
});

test('formatAuditorDisputeRecheckPrompt formats auditor recheck prompt', () => {
  const prompt = formatAuditorDisputeRecheckPrompt({
    disputedFindings: [{ id: 'H-01', severity: 'High', finding: 'Risk of marker loss' }],
    plannerJustifications: { 'H-01': 'Explore markers are decoupled in separate key' },
    manifestPath: 'docs/plans/manifest.v5.md',
  });

  assert.match(prompt, /Auditor Final Dispute Recheck/);
  assert.match(prompt, /H-01/);
  assert.match(prompt, /Explore markers are decoupled/);
  assert.match(prompt, /CONCEDED/);
  assert.match(prompt, /CONFIRMED/);
});
