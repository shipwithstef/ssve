/**
 * scripts/lib/risk-flags.mjs — WI-553 shared risk-flag table.
 *
 * Single source of truth for the AC-553-1 risk-flag set consumed by
 * `diagnose-bug`, `route-workflow`'s lane compiler / lane-model, `plan-
 * changeset`'s plan-contract, and the mechanical validators
 * (`validate-task-graph-lane.mjs`, `validate-plan-contract.mjs`).
 *
 * Design constraint (proposals/2026-08-17-framework-improvement-risk-
 * triggered-plan-exec-contracts.md): unaffected work pays zero extra model
 * review. These flags are cheap, mechanical, and additive — absence of every
 * flag means none of WI-553's extra contracts or checks apply.
 */

// The six canonical flags. `cross_runtime_integration` is pre-existing (kept
// here so callers enumerate the FULL set from one place); its own old/new-
// path evidence protocol is untouched by WI-553 — it is listed for
// completeness per AC-553-1, not re-implemented.
export const RISK_FLAGS = Object.freeze([
  "runtime_concurrency",
  "external_state_writer",
  "config_schema_migration",
  "lossless_rmw",
  "idempotent_rewriter",
  "cross_runtime_integration",
]);

export const RISK_FLAG_SET = new Set(RISK_FLAGS);

// Flags newly introduced by WI-553 (excludes the pre-existing
// cross_runtime_integration, whose design-tech insertion already existed via
// the lane compiler's "concurrency" / "external-integration" signals).
export const WI_553_RISK_FLAGS = Object.freeze(RISK_FLAGS.filter((flag) => flag !== "cross_runtime_integration"));

// A design-tech skip_reason is denied when it claims "no product surface" AND
// at least one AC-553-1 flag is in effect. Matches the skip phrasing named by
// AC-553-2 ("no product UI / no data model / framework chrome").
export const DESIGN_TECH_SKIP_DENY_PATTERN = /no product ui|no data model|framework chrome/i;

// File-path heuristics that IMPLY a flag even when the author never declared
// it — the mechanical half of AC-553-2 ("or implied by the planned files:
// host wirer, hook that coordinates parallel events, config
// parser/serializer"). Intentionally narrow: false negatives are safe (the
// author can still declare the flag explicitly); false positives cost one
// design-tech pass, which is why the patterns stay tight.
const IMPLIED_FLAG_PATTERNS = Object.freeze([
  { flag: "runtime_concurrency", pattern: /(?:^|\/)hooks\/.*(?:session-?start|session-?end|parallel)[^/]*\.(?:mjs|js|cjs|ts|sh)$/i },
  { flag: "external_state_writer", pattern: /(?:^|\/)(?:provision\/hosts|hooks)\/.*(?:wirer|wire-hooks|healthcheck)[^/]*\.(?:mjs|js|cjs|ts|sh)$/i },
  { flag: "config_schema_migration", pattern: /(?:^|\/)(?:[^/]*(?:parse|serialize)[-_]?config[^/]*|[^/]*config[-_]?(?:parser|serializer)[^/]*)\.(?:mjs|js|cjs|ts)$/i },
]);

/**
 * Returns the subset of AC-553-1 flags implied by a list of planned/changed
 * file paths, per the IMPLIED_FLAG_PATTERNS table above.
 */
export function impliedRiskFlags(plannedFiles = []) {
  const implied = new Set();
  for (const file of plannedFiles) {
    if (typeof file !== "string" || !file) continue;
    for (const { flag, pattern } of IMPLIED_FLAG_PATTERNS) {
      if (pattern.test(file)) implied.add(flag);
    }
  }
  return implied;
}

/**
 * Returns the set of AC-553-1 flags in effect: declared flags (already
 * filtered against RISK_FLAG_SET) unioned with flags implied by the
 * planned/changed file set. Unknown/foreign flag strings in `declaredFlags`
 * are ignored here — callers that need strict validation of unknown flag
 * names should reject them themselves (see validate-plan-contract.mjs).
 */
export function effectiveRiskFlags({ declaredFlags = [], plannedFiles = [] } = {}) {
  const effective = new Set();
  for (const flag of declaredFlags) if (RISK_FLAG_SET.has(flag)) effective.add(flag);
  for (const flag of impliedRiskFlags(plannedFiles)) effective.add(flag);
  return effective;
}

/**
 * AC-553-2: a design-tech skip is denied when the skip_reason matches the
 * "no product surface" family AND at least one AC-553-1 flag is in effect.
 * Returns the matched flags (non-empty => denied) or an empty array (this
 * skip_reason is not the denied family — a different reason may still be
 * invalid for other cause, which is outside this helper's scope).
 */
export function designTechSkipDenialFlags(skipReason, effectiveFlags) {
  if (typeof skipReason !== "string" || !DESIGN_TECH_SKIP_DENY_PATTERN.test(skipReason)) return [];
  return Array.from(effectiveFlags ?? []);
}
