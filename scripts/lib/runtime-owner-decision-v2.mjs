#!/usr/bin/env node

import crypto from 'node:crypto';

export const DECISION_TECHNIQUE_ORDER = Object.freeze([
  'hard-constraint',
  'evidence',
  'expected-product-value',
  'value-of-information',
  'minimax-regret',
  'reversibility',
  'critical-path-fit',
]);

const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

function fail(message) {
  throw new Error(`owner-decision-v2: ${message}`);
}

export function rankOwnerOptions(options, remainingActiveMinutes = 60) {
  if (!Array.isArray(options) || options.length < 2) fail('at least two real options are required');
  const ids = new Set();
  for (const option of options) {
    if (!option?.option_id || ids.has(option.option_id)) fail('option IDs must be present and unique');
    ids.add(option.option_id);
  }
  const eligible = options.filter(option => option.hard_constraints_pass === true && option.critical_path_minutes <= remainingActiveMinutes);
  if (eligible.length === 0) fail('no complete option fits the remaining active-minute budget');
  return [...eligible].sort((left, right) =>
    (right.evidence_weight - left.evidence_weight) ||
    (right.expected_product_value - left.expected_product_value) ||
    (right.value_of_information - left.value_of_information) ||
    (left.max_regret - right.max_regret) ||
    (right.reversibility - left.reversibility) ||
    (left.critical_path_minutes - right.critical_path_minutes) ||
    left.option_id.localeCompare(right.option_id)
  );
}

export function unresolvedDecisionDigest({ question, options, evidence_ids = [], uncertainty_ids = [] }) {
  return digest({ question, options, evidence_ids: [...evidence_ids].sort(), uncertainty_ids: [...uncertainty_ids].sort() });
}

export function compileOwnerDecision(input, priorQuestionDigests = []) {
  const required = ['decision_id', 'run_id', 'mode', 'language', 'question', 'options', 'authority', 'evidence_ids', 'generation_bindings'];
  for (const key of required) if (input?.[key] === undefined) fail(`missing ${key}`);
  if (!['autonomous', 'strategic'].includes(input.mode)) fail('mode must be autonomous or strategic');
  if (input.authority.surface !== 'decide') fail('decide is the sole owner-facing decision surface');

  const question_digest = unresolvedDecisionDigest(input);
  if (priorQuestionDigests.includes(question_digest)) fail('unresolved owner question repeats without new causal state');

  const ranked = rankOwnerOptions(input.options, input.remaining_active_minutes ?? 60);
  const selected = input.selected_option_id ?? ranked[0].option_id;
  if (selected !== ranked[0].option_id) fail('selected option is not the deterministic top-ranked eligible option');
  if (input.mode === 'autonomous' && input.authority.within_delegation !== true) {
    fail('autonomous decision exceeds signed delegation; route one localized question through decide');
  }
  if (input.mode === 'strategic' && input.owner_signature !== true) {
    fail('strategic decision requires explicit owner signature');
  }

  const rejected_option_ids = input.options.map(option => option.option_id).filter(id => id !== selected).sort();
  return {
    schema_version: 'owner-decision-v2',
    decision_id: input.decision_id,
    run_id: input.run_id,
    mode: input.mode,
    language: input.language,
    question_digest,
    question: input.question,
    options: input.options,
    selected_option_id: selected,
    rejected_option_ids,
    technique_order: [...DECISION_TECHNIQUE_ORDER],
    authority: input.authority,
    evidence_ids: [...new Set(input.evidence_ids)].sort(),
    uncertainty_ids: [...new Set(input.uncertainty_ids ?? [])].sort(),
    generation_bindings: input.generation_bindings,
  };
}

export function compileResearchEvidence(input) {
  const forbidden = ['effects', 'writes', 'commands', 'mutations', 'dispatch'];
  for (const key of forbidden) if (key in (input ?? {})) fail(`nested research is side-effect-free; forbidden field ${key}`);
  if (!input?.uncertainty_id || !input?.consumer_id || !input?.source || !input?.fresh_until) {
    fail('research evidence requires uncertainty_id, consumer_id, source and fresh_until');
  }
  return {
    schema_version: 'research-evidence-v2',
    evidence_id: `research-${digest(input).slice(0, 20)}`,
    uncertainty_id: input.uncertainty_id,
    consumer_ids: [input.consumer_id],
    claim: input.claim,
    contradiction: input.contradiction ?? null,
    source: input.source,
    trust: input.trust ?? 'untrusted',
    fresh_until: input.fresh_until,
    disposition: 'resolved-for-decision',
  };
}
