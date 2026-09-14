#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const digest = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
function fail(message) { throw new Error(`memory-company-v2: ${message}`); }

export function compileMemoryEvidence(input, repoRoot) {
  if (!input?.source_path || path.isAbsolute(input.source_path) || input.source_path.split(path.sep).includes('..')) fail('memory source must be a repository-relative file');
  const resolved = path.resolve(repoRoot, input.source_path);
  const root = path.resolve(repoRoot);
  if (!(resolved === root || resolved.startsWith(`${root}${path.sep}`)) || !fs.statSync(resolved).isFile()) fail('memory source does not resolve inside repository');
  const body = fs.readFileSync(resolved, 'utf8');
  if (!input.consumer_id || !input.fresh_until) fail('memory evidence requires a named consumer and freshness bound');
  return {
    schema_version: 'memory-evidence-v2', evidence_id: input.evidence_id ?? `memory-${digest({ path: input.source_path, body }).slice(0, 20)}`,
    source_path: input.source_path, source_digest: digest({ path: input.source_path, body }), content_digest: digest(body),
    consumer_id: input.consumer_id, fresh_until: input.fresh_until, trust: input.trust ?? 'untrusted',
    disposition: 'pending', generation_bindings: input.generation_bindings,
  };
}

export function disposeMemoryEvidence(evidence, disposition, reason) {
  if (!['used', 'ignored'].includes(disposition) || !reason) fail('memory evidence must be explicitly used or ignored with a reason');
  if (evidence.disposition !== 'pending') fail('memory evidence disposition is immutable');
  return { ...evidence, disposition, disposition_reason: reason };
}

export function compileApprovedCompanyRoute(card, input) {
  if (card?.status !== 'approved' || card?.evidence_resolved !== true) fail('only an evidence-resolved approved company card can create a product route');
  if (!input?.product_id || !input?.authority_principal || !input?.generation_bindings) fail('product identity, authority and generations are required');
  return {
    schema_version: 'company-product-route-v2', route_id: input.route_id ?? `route-${digest(card).slice(0, 20)}`,
    company_card_id: card.id, company_card_digest: digest(card), verdict: 'approved', product_id: input.product_id,
    direction: card.recommendation, authority_principal: input.authority_principal, generation_bindings: input.generation_bindings,
  };
}

export function compileOutcomeLearning(input) {
  if (input?.source_consumption?.state !== 'consumed' || !input.source_consumption.ack_id || !input.source_consumption.product_consumer_id) fail('learning source must already be consumed by a product consumer');
  if (input?.outcome?.state !== 'OUTCOME_OBSERVED' || !input.outcome.evidence_id || !input.outcome.next_decision_id) fail('observed outcome and next decision are required before learning promotion');
  return {
    schema_version: 'outcome-learning-v2', learning_id: input.learning_id,
    product_id: input.product_id, source_evidence_id: input.source_consumption.evidence_id,
    product_consumer_id: input.source_consumption.product_consumer_id, consumption_ack_id: input.source_consumption.ack_id,
    outcome_evidence_id: input.outcome.evidence_id, next_decision_id: input.outcome.next_decision_id, promoted: true,
  };
}

export function companyOutcomeEffect(input) {
  if (!input?.company_state_dir || !input?.company_decision_id || input?.outcome?.state !== 'OUTCOME_OBSERVED' || !input.outcome.evidence_id) {
    fail('company outcome write requires state directory, originating decision and observed outcome evidence');
  }
  const metric = input.outcome.metric_id && Number.isFinite(input.outcome.observed)
    ? [`--metric`, `${input.outcome.metric_id}=${input.outcome.observed}`] : [];
  return {
    kind: 'company-outcome-command-v2',
    argv: ['node', 'scripts/company-state.mjs', 'record-outcome', '--state-dir', input.company_state_dir, '--id', input.company_decision_id, '--result', input.outcome.result, '--worked', input.outcome.worked ?? 'partial', ...metric],
    evidence_id: input.outcome.evidence_id,
    authorization_required: true,
    execute_via: 'typed-effect-runner'
  };
}
