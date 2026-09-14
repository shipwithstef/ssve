// Report repair is not a new review or permission to change its judgment.
import { isDeepStrictEqual } from 'node:util';

export function hasNegativeReviewEvidence(findings) {
  if (!findings || typeof findings !== 'object') return false;
  const unsafe = (value, negative = () => true) => value != null
    && (!Array.isArray(value) || value.some(negative));
  return (findings.verdict !== undefined && !['pass', 'pass-with-findings'].includes(findings.verdict))
    || unsafe(findings.findings)
    || unsafe(findings.certifications, c => c?.certified !== true)
    || unsafe(findings.rubric_failures)
    || unsafe(findings.dependencies_needing_read);
}

// null means the transport has no dollar-ceiling facility, never zero cost.
export function remainingReportRepairBudget(host, configured, spent, explicitDollarLimit = false) {
  if (host !== 'claude') return explicitDollarLimit ? 0 : null;
  return typeof spent === 'number' && Number.isFinite(spent) && spent >= 0
    ? Math.max(0, configured - spent) : 0;
}

export function isIncompleteReviewReport(findings) {
  if (isUnscoredProgressReport(findings)) return true;
  return Array.isArray(findings?.findings) && findings.findings.length === 0
    && /^\s*(?:placeholder\b|inspection in progress\b|(?:the )?review (?:is )?not (?:yet )?complete\b)/i.test(findings.summary || '');
}

export function isUnscoredProgressReport(report) {
  const empty = value => value == null || (Array.isArray(value) && value.length === 0);
  return report?.rubric_score === null
    && Array.isArray(report.findings) && report.findings.length === 0
    && Array.isArray(report.certifications) && report.certifications.length === 0
    && empty(report.rubric_failures) && empty(report.dependencies_needing_read)
    && /^\s*(?:Loading|Reviewing)\s+[^.!?\n]{1,180}(?:\.)?\s*$/i.test(report.summary || '')
    && !/\b(?:fail(?:ed|ure)?|error|missing|unsafe|incorrect|blocked|cannot|unable)\b/i.test(report.summary);
}

export function reportRepairKind(findings) {
  if (!findings || typeof findings !== 'object') return null;
  if (isUnscoredProgressReport(findings)) return 'incomplete';
  if (isIncompleteReviewReport(findings)) return hasNegativeReviewEvidence(findings) ? null : 'incomplete';
  if (!['pass', 'pass-with-findings'].includes(findings.verdict) || !Array.isArray(findings.certifications)) return null;
  // An unbound certification is not evidence of a failed candidate check.
  // Ask the reviewer to correct it; never change a false value to true locally.
  if (findings.certifications.some(c => c?.certified === false && c.for_content_sha === null)) return 'certification-scope';
  return null;
}

export function validateReportRepair(before, after, kind) {
  if (kind !== 'certification-scope') return []; // Incomplete report requires full normal validation.
  const { certifications: oldCerts, ...oldJudgment } = before;
  const { certifications: newCerts, ...newJudgment } = after || {};
  if (!isDeepStrictEqual(oldJudgment, newJudgment)) return ['report repair changed the substantive review judgment'];
  if (!Array.isArray(newCerts)) return ['report repair omitted certifications array'];
  const retained = oldCerts.filter(c => !(c?.certified === false && c.for_content_sha === null));
  return isDeepStrictEqual(retained, newCerts) ? [] : ['report repair changed a bound certification or invented evidence'];
}

export function reportRepairPrompt(findings, kind) {
  const instruction = kind === 'certification-scope'
    ? 'Correct only the certification scope in your completed report below. Return ALL other fields byte-equivalent as JSON values, including summary, verdict, findings and dependencies. Remove ONLY false certifications with for_content_sha:null that describe unobserved/out-of-scope obligations. Keep every other certification identical. Do not turn false into true. If any such entry means a real negative source observation, retain it: the launcher will block rather than erase it. Do not perform another source review.'
    : 'Your prior response is an incomplete placeholder, not a review. Complete the original read-only source review now using the original package below. Return exactly one final schema JSON; no progress messages. Do not claim checks you did not perform.';
  return `${instruction}\nOriginal unmodified report:\n${JSON.stringify(findings)}\n`;
}

export function isZeroCallReviewReplay(receipt) {
  return receipt?.classification === 'cache_hit' && receipt.status === 'success'
    && receipt.protocol?.process_invocations === 0 && Array.isArray(receipt.attempts) && receipt.attempts.length === 0
    && Array.isArray(receipt.reviewer_run?.commands) && receipt.reviewer_run.commands.length === 0;
}
