#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateGenerationBindings } from './lib/generation-bindings-v2.mjs';
import { appendRuntimeEvent } from './svc-runtime-v2.mjs';

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
const digest = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : stable(value)).digest('hex');
function fail(message) { throw new Error(`runtime-migrate-v2: ${message}`); }

function evidenceReferences(task, sourceDigest) {
  return [...new Set(task.evidence ?? [])].sort().map(id => ({
    id,
    resolution: 'REFERENCE_ONLY',
    source_reference_digest: digest({ source_digest: sourceDigest, task_id: task.id, evidence_id: id })
  }));
}

export function importLegacyAcceptedPrefix(legacy, generationBindings, sourceDigest = digest(legacy)) {
  if (![1, 2].includes(legacy?.schema_version)) fail('only current v2 and N-1 v1 are readable');
  if (!legacy.run_id || !Array.isArray(legacy.tasks)) fail('legacy run_id and tasks are required');
  const bindingErrors = validateGenerationBindings(generationBindings);
  if (bindingErrors.length) fail(bindingErrors.join('; '));
  const seen = new Set();
  const imported_prefix = [];
  for (const task of legacy.tasks) {
    if (!task.id || seen.has(task.id)) fail('legacy task IDs must be present and unique');
    seen.add(task.id);
    if (task.status !== 'completed') continue;
    const references = evidenceReferences(task, sourceDigest);
    imported_prefix.push({
      task_id: task.id, state: 'ACCEPTED', consumed: false,
      evidence_ids: references.map(reference => reference.id),
      evidence_references: references,
      source_task_digest: digest(task),
      import_reason: 'legacy completion has no v2 product-consumption acknowledgement',
      generation_bindings: generationBindings,
    });
  }
  return imported_prefix;
}

export function projectV2ToLegacy(run) {
  return {
    schema_version: 1, run_id: run.run_id,
    tasks: run.tasks.map(task => ({ id: task.task_id, status: ['ACCEPTED', 'CONSUMED'].includes(task.state) ? 'completed' : 'pending', evidence: task.evidence_ids ?? [] })),
    closeout: run.delivery_verified === true ? 'completed' : 'in_progress',
    production_proof: run.delivery_verified === true,
  };
}

export function compileMigrationReport(legacy, input) {
  const source_digest = digest(legacy);
  const imported_prefix = importLegacyAcceptedPrefix(legacy, input.generation_bindings, source_digest);
  const v2 = { run_id: legacy.run_id, tasks: imported_prefix, delivery_verified: false };
  const rollback_projection = projectV2ToLegacy(v2);
  const legacyCompletedIds = legacy.tasks.filter(task => task.status === 'completed').map(task => task.id).sort();
  const projectedCompletedIds = rollback_projection.tasks.filter(task => task.status === 'completed').map(task => task.id).sort();
  const receipts_preserved = imported_prefix.every(task => task.evidence_ids.length === new Set(legacy.tasks.find(row => row.id === task.task_id)?.evidence ?? []).size);
  const graph_equivalent = JSON.stringify(legacyCompletedIds) === JSON.stringify(projectedCompletedIds);
  const false_closeout_prevented = legacy.closeout !== 'completed' || legacy.production_proof === true || rollback_projection.closeout === 'in_progress';
  const core = {
    schema_version: 'runtime-migration-report-v2', source_version: legacy.schema_version, target_version: 2,
    run_id: legacy.run_id, source_digest, source_immutable: true, imported_prefix,
    differential: { graph_equivalent, receipts_preserved, false_closeout_prevented, differences: legacy.closeout === 'completed' && !legacy.production_proof ? ['legacy completion intentionally remains delivery-open without production proof'] : [] },
    compatibility: { readable_versions: [2, 1], rollback_reader_version: 1, accepted_prefix_nonterminal: true, canonical_truth: 'V2_JOURNAL' },
    rollback_projection, rollback_projection_digest: digest(rollback_projection), product_writes: false,
    generation_bindings: input.generation_bindings,
  };
  const report_digest = digest(core);
  const journal_import_events = imported_prefix.map(task => ({
    type: 'TASK_LEGACY_ACCEPTED_IMPORTED', task_id: task.task_id,
    idempotency_key: `migration:${report_digest}:${task.task_id}`,
    payload: {
      source_version: legacy.schema_version, source_digest, source_task_digest: task.source_task_digest,
      migration_report_digest: report_digest, consumed: false, evidence_references: task.evidence_references
    }
  }));
  return { ...core, report_digest, journal_import_events };
}

export function appendMigrationAcceptedPrefix(paths, report, observedAt = new Date().toISOString()) {
  const { report_digest, journal_import_events, ...core } = report;
  if (digest(core) !== report_digest) fail('migration report digest mismatch');
  if (report.product_writes !== false || report.source_immutable !== true) fail('migration must be source-immutable and product-write-free');
  const appended = [];
  for (const event of journal_import_events) {
    const result = appendRuntimeEvent(paths, {
      run_id: report.run_id, type: event.type, task_id: event.task_id, observed_at: observedAt,
      idempotency_key: event.idempotency_key, generation_bindings: report.generation_bindings,
      payload: event.payload
    });
    if (!result.valid) return result;
    appended.push({ task_id: event.task_id, event_digest: result.event.event_digest, idempotent: result.idempotent });
  }
  return { valid: true, errors: [], report_digest, appended };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2); const at = flag => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null; };
  const legacy = JSON.parse(fs.readFileSync(path.resolve(at('--legacy')), 'utf8'));
  const generations = JSON.parse(fs.readFileSync(path.resolve(at('--generations')), 'utf8'));
  process.stdout.write(`${JSON.stringify(compileMigrationReport(legacy, { generation_bindings: generations }), null, 2)}\n`);
}
