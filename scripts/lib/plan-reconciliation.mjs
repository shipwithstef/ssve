#!/usr/bin/env node

/**
 * Governed Planner-Reviewer Reconciliation & Bounded Dispute Engine.
 *
 * Implements session/context reuse for the planner model during plan reconciliation,
 * avoiding expensive full-repository rereads, and strictly bounds any disagreement
 * to a maximum of 1 follow-up round before human escalation.
 */

export const MAX_DISPUTE_ROUNDS = 1;

/**
 * Parse an authoritative markdown review report (e.g. from Fable, Sol, or Opus)
 * into a structured findings object.
 */
export function parseReviewReport(markdown) {
  if (typeof markdown !== 'string') {
    return { verdict: 'UNKNOWN', counts: { critical: 0, high: 0, medium: 0, low: 0 }, findings: [], requiredRevisions: [] };
  }

  // Extract verdict
  let verdict = 'UNKNOWN';
  const verdictMatch = markdown.match(/(?:##\s*)?verdict:\s*[*_`]*([A-Z][A-Z_ ]+)[*_`]*/i);
  if (verdictMatch) {
    verdict = verdictMatch[1].trim().toUpperCase();
  }

  // Extract counts
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  const countsMatch = markdown.match(/critical:\s*(\d+)\s+high:\s*(\d+)\s+medium:\s*(\d+)\s+low:\s*(\d+)/i);
  if (countsMatch) {
    counts.critical = parseInt(countsMatch[1], 10);
    counts.high = parseInt(countsMatch[2], 10);
    counts.medium = parseInt(countsMatch[3], 10);
    counts.low = parseInt(countsMatch[4], 10);
  }

  // Extract table rows: | ID | Sev | Finding | Evidence |
  const findings = [];
  const tableRowRegex = /\|\s*(\*{0,2}[A-Z0-9_-]+\*{0,2})\s*\|\s*(\*{0,2}[A-Za-z]+\*{0,2})\s*\|\s*([^|]+)\|\s*([^|]+)\|/g;
  let match;
  while ((match = tableRowRegex.exec(markdown)) !== null) {
    const rawId = match[1].replace(/\*/g, '').trim();
    const rawSev = match[2].replace(/\*/g, '').trim();
    const text = match[3].trim();
    const evidence = match[4].trim();
    if (['ID', '---', ':---:'].includes(rawId) || ['Sev', '---'].includes(rawSev)) continue;
    findings.push({
      id: rawId,
      severity: rawSev,
      finding: text,
      evidence: evidence,
    });
  }

  // Extract required revisions
  const requiredRevisions = [];
  const reqSection = markdown.match(/## Required revisions[^\n]*\n([\s\S]*?)(?=\n```|\n##|\n---|$)/i);
  if (reqSection) {
    const lines = reqSection[1].split('\n');
    for (const line of lines) {
      const itemMatch = line.match(/^\s*\d+\.\s*(.+)/);
      if (itemMatch) {
        requiredRevisions.push(itemMatch[1].trim());
      }
    }
  }

  return {
    verdict,
    counts,
    findings,
    requiredRevisions,
  };
}

/**
 * Format a targeted reconciliation prompt for the planner.
 * Injects the review findings and instructs the planner to mark each ACCEPT or JUSTIFY_REFUTE,
 * patch the manifest in place, and preserve session context.
 */
export function formatReconciliationPrompt({
  manifestPath,
  reviewReportPath,
  parsedReport,
  iteration = 0,
}) {
  const findingsList = parsedReport.findings.length > 0
    ? parsedReport.findings.map(f => `- **${f.id}** [${f.severity}]: ${f.finding} (Evidence: \`${f.evidence}\`)`).join('\n')
    : '(No structured table findings detected)';

  const reqList = parsedReport.requiredRevisions.length > 0
    ? parsedReport.requiredRevisions.map((r, i) => `${i + 1}. ${r}`).join('\n')
    : '(Follow findings table)';

  return `# Planner Reconciliation Directive (Iteration ${iteration + 1})

You are the Primary Planner reviewing feedback from the Independent Triangulation Auditor.
The review report has been saved to: \`${reviewReportPath}\`.
Target manifest to update: \`${manifestPath}\`.

**Review Verdict:** \`${parsedReport.verdict}\`
**Severity Counts:** Critical: ${parsedReport.counts.critical}, High: ${parsedReport.counts.high}, Medium: ${parsedReport.counts.medium}, Low: ${parsedReport.counts.low}

## Findings to Reconcile:
${findingsList}

## Required Action Items:
${reqList}

---

## Instructions for this Reconciliation Turn:
1. **Reuse Your Session & Context:** You already have the repository context in your working memory. Do not re-read unrelated files from scratch.
2. **Evaluate Each Finding:**
   - **ACCEPT:** Apply the required correction directly to \`${manifestPath}\`.
   - **JUSTIFY_REFUTE:** If a finding is factually incorrect or based on a misinterpretation of code/contracts, provide concrete code evidence why the current design is correct.
3. **Output Summary:**
   Output a structured reconciliation disposition table:
   \`\`\`markdown
   | Finding ID | Disposition (ACCEPT / JUSTIFY_REFUTE) | Action Taken / Rationale |
   \`\`\`
   And declare whether the manifest is updated and ready for review verification.
`;
}

/**
 * Return native command-line session continuation flags for supported host CLIs.
 */
export function reconciliationSessionFlags({ host, sessionId = null }) {
  switch (host) {
    case 'grok':
      return sessionId ? ['--resume', sessionId, '--always-approve'] : ['--continue', '--always-approve'];
    case 'cursor':
      return sessionId ? ['--resume', sessionId] : ['--continue'];
    case 'claude':
      return ['--continue'];
    default:
      return [];
  }
}

/**
 * Evaluate dispute status between planner justifications and auditor findings.
 * Enforces the strict maximum 1-round dispute boundary.
 */
export function evaluateDisputeStatus({
  disputedFindings = [],
  currentIteration = 0,
}) {
  if (disputedFindings.length === 0) {
    return {
      status: 'RECONCILED',
      disputedFindings: [],
      canProceedToAuditorRecheck: false,
      escalateToOwner: false,
      reason: 'All findings were accepted and applied to manifest.',
    };
  }

  if (currentIteration >= MAX_DISPUTE_ROUNDS) {
    return {
      status: 'ESCALATE_TO_OWNER',
      disputedFindings,
      canProceedToAuditorRecheck: false,
      escalateToOwner: true,
      reason: `Dispute on ${disputedFindings.length} finding(s) unresolved after ${currentIteration + 1} rounds. Human owner checkpoint required.`,
    };
  }

  return {
    status: 'DISPUTE_RECHECK_NEEDED',
    disputedFindings,
    canProceedToAuditorRecheck: true,
    escalateToOwner: false,
    reason: `Planner justified ${disputedFindings.length} finding(s). Handing back to auditor for single final recheck.`,
  };
}

/**
 * Format prompt for auditor when re-evaluating only disputed items (bounded 1 turn).
 */
export function formatAuditorDisputeRecheckPrompt({
  disputedFindings,
  plannerJustifications,
  manifestPath,
}) {
  return `# Auditor Final Dispute Recheck (Bounded Round)

You previously raised findings on \`${manifestPath}\`.
The planner has accepted non-disputed findings and provided justifications for the following disputed items:

${disputedFindings.map(f => `### Disputed Item: ${f.id} [${f.severity}]\n- **Original Finding:** ${f.finding}\n- **Planner Justification:** ${plannerJustifications[f.id] || 'See planner log'}`).join('\n\n')}

---

## Your Directive:
Perform a single, final evaluation of the planner's evidence:
1. For each disputed item, declare either:
   - **CONCEDED:** The planner's evidence is valid. Finding withdrawn.
   - **CONFIRMED:** The planner's rationale does not address the underlying risk. Finding stands.
2. Issue your final verdict (PASS, PASS WITH FINDINGS, or REVISE).
`;
}
