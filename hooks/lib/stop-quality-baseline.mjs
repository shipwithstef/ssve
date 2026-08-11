/**
 * stop-quality baseline diff — WI-399 A8.
 *
 * Pure functions so the tier-1 validator can test the blocking semantics
 * hermetically (canned checker output, no tsc/pyright launch on the hot path).
 *
 * Problem fixed: svc-stop-quality --check hard-blocked Stop on ANY type error
 * in the project, including errors that pre-date the session — a session in a
 * repo with legacy type debt could never end (capability audit R9). The gate
 * now blocks only on errors INTRODUCED since the session's first check.
 *
 * Fingerprint = normalized output line (whitespace-collapsed). Line/column
 * numbers stay IN the fingerprint deliberately: an edit that moves a
 * pre-existing error is treated as new — strictly safer (fail-closed) than
 * fuzzy matching, and self-heals on the next baseline reset.
 */

/**
 * Extract normalized error fingerprints from checker outputs.
 * @param {string[]} outputs - raw stderr/stdout blocks from type checkers
 * @returns {string[]} sorted unique fingerprints
 */
export function extractErrorFingerprints(outputs) {
  // Fingerprint EVERY non-empty line of the error blocks. The blocks are
  // already error-classified by the per-stack checker logic in the hook, and
  // word-matching "error" is both over-broad ("non-error") and under-broad
  // (go vet lines carry no "error" token at all). Stable header/noise lines
  // are baseline-neutral: present on both sides of the diff.
  const fps = new Set();
  for (const block of outputs || []) {
    for (const line of String(block || "").split(/\r?\n/)) {
      const norm = line.replace(/\s+/g, " ").trim();
      if (!norm) continue;
      fps.add(norm);
    }
  }
  return [...fps].sort();
}

/**
 * Split current fingerprints into new-vs-baseline.
 * @param {string[]} current
 * @param {string[]|null|undefined} baseline - null/undefined = no baseline yet
 * @returns {{newErrors: string[], preExisting: string[], baselineMissing: boolean}}
 */
export function splitNewErrors(current, baseline) {
  if (!Array.isArray(baseline)) {
    return { newErrors: [], preExisting: current.slice(), baselineMissing: true };
  }
  const base = new Set(baseline);
  const newErrors = [];
  const preExisting = [];
  for (const fp of current) {
    (base.has(fp) ? preExisting : newErrors).push(fp);
  }
  return { newErrors, preExisting, baselineMissing: false };
}
