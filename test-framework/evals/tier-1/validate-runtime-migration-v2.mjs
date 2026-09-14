#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validate } from '../../../scripts/lib/json-schema-validator.mjs';
import { projectLegacyViews } from '../../../scripts/svc-host-runtime-adapter-v2.mjs';
import { appendRuntimeEvent, readRuntimeJournal, replayRuntimeJournal } from '../../../scripts/svc-runtime-v2.mjs';
import { appendMigrationAcceptedPrefix, compileMigrationReport, importLegacyAcceptedPrefix, projectV2ToLegacy } from '../../../scripts/svc-runtime-migrate-v2.mjs';

const fixturePath = 'test-framework/fixtures/execution-controller-v2/sample-accepted-prefix-v1.json';
const sourceBytes = fs.readFileSync(fixturePath);
const legacy = JSON.parse(sourceBytes);
const generations = Object.fromEntries(['protocol_generation_digest','product_generation_digest','context_generation_digest','concern_generation_digest','control_generation_digest','authority_generation_digest','layer_inventory_digest'].map((key, i) => [key, String(i + 1).repeat(64)]));
const report = compileMigrationReport(legacy, { generation_bindings: generations });
const schema = JSON.parse(fs.readFileSync('schemas/runtime-migration-report-v2.schema.json', 'utf8'));
assert.equal(validate(schema, report).valid, true);
assert.equal(report.product_writes, false); assert.equal(report.imported_prefix.length, 3);
assert(report.imported_prefix.every(row => row.state === 'ACCEPTED' && row.consumed === false));
assert(report.imported_prefix.every(row => /^[a-f0-9]{64}$/.test(row.source_task_digest)));
assert(report.imported_prefix.flatMap(row => row.evidence_references).every(row => row.resolution === 'REFERENCE_ONLY' && /^[a-f0-9]{64}$/.test(row.source_reference_digest)));
assert.equal(report.differential.graph_equivalent, true); assert.equal(report.differential.receipts_preserved, true);
assert.equal(report.differential.false_closeout_prevented, true); assert.equal(report.rollback_projection.closeout, 'in_progress');
assert.deepEqual(report.compatibility.readable_versions, [2, 1]);
assert.equal(report.compatibility.accepted_prefix_nonterminal, true);
assert.equal(report.compatibility.canonical_truth, 'V2_JOURNAL');
assert.equal(report.journal_import_events.length, report.imported_prefix.length);
assert.throws(() => importLegacyAcceptedPrefix({ ...legacy, schema_version: 0 }, generations), /N-1/);
assert.equal(projectV2ToLegacy({ run_id: 'r', tasks: [], delivery_verified: true }).production_proof, true);

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-runtime-migrate-v2-'));
const paths = { runDir: root, journal: path.join(root, 'journal.jsonl'), journalLock: path.join(root, '.journal.lock') };
const compiled = appendRuntimeEvent(paths, {
  run_id: legacy.run_id, type: 'RUN_COMPILED', task_id: null, observed_at: '2026-08-10T00:00:00.000Z',
  idempotency_key: 'migration-compile', generation_bindings: generations, payload: { manifest_digest: crypto.createHash('sha256').update('migration-manifest').digest('hex') }
});
assert.equal(compiled.valid, true, compiled.errors?.join('; '));
const imported = appendMigrationAcceptedPrefix(paths, report, '2026-08-10T00:00:01.000Z');
assert.equal(imported.valid, true, imported.errors?.join('; '));
assert.equal(imported.appended.length, 3);
const replay = replayRuntimeJournal(readRuntimeJournal(paths.journal), { run_id: legacy.run_id, generation_bindings: generations });
assert.equal(replay.valid, true, replay.errors?.join('; '));
assert.deepEqual(Object.values(replay.state.tasks).map(task => task.status), ['ACCEPTED', 'ACCEPTED', 'ACCEPTED']);
assert(Object.values(replay.state.tasks).every(task => task.legacy_import.consumed === false));
assert.equal(replay.state.status, 'COMPILED');

const manifest = { run_id: legacy.run_id, generation_bindings: generations, capsules: legacy.tasks.map(task => ({ task_id: task.id, dependencies: [] })) };
const projection = projectLegacyViews(manifest, readRuntimeJournal(paths.journal));
assert.equal(projection.valid, true, projection.errors?.join('; '));
assert.equal(projection.lane_tasks.source.event_count, 4);
assert.equal(projection.lane_tasks.source.journal_digest, readRuntimeJournal(paths.journal).at(-1).event_digest);
assert.deepEqual(projection.lane_tasks.tasks.slice(0, 3).map(task => task.status), ['ACCEPTED', 'ACCEPTED', 'ACCEPTED']);

const idempotent = appendMigrationAcceptedPrefix(paths, report, '2026-08-10T00:00:02.000Z');
assert.equal(idempotent.valid, true);
assert(idempotent.appended.every(row => row.idempotent));
assert.equal(readRuntimeJournal(paths.journal).length, 4);
const tampered = structuredClone(report); tampered.imported_prefix[0].consumed = true;
assert.throws(() => appendMigrationAcceptedPrefix(paths, tampered), /digest mismatch/);
assert.deepEqual(fs.readFileSync(fixturePath), sourceBytes, 'migration must not mutate the legacy/product source');

const forgedRoot = path.join(root, 'forged');
fs.mkdirSync(forgedRoot, { recursive: true });
const forgedPaths = { runDir: forgedRoot, journal: path.join(forgedRoot, 'journal.jsonl'), journalLock: path.join(forgedRoot, '.journal.lock') };
assert.equal(appendRuntimeEvent(forgedPaths, {
  run_id: 'forged-import', type: 'RUN_COMPILED', observed_at: '2026-08-10T00:00:00.000Z', idempotency_key: 'compile', generation_bindings: generations, payload: { manifest_digest: 'a'.repeat(64) }
}).valid, true);
const forged = appendRuntimeEvent(forgedPaths, {
  run_id: 'forged-import', type: 'TASK_LEGACY_ACCEPTED_IMPORTED', task_id: 'legacy', observed_at: '2026-08-10T00:00:01.000Z',
  idempotency_key: 'forged', generation_bindings: generations,
  payload: { source_version: 1, source_digest: 'b'.repeat(64), source_task_digest: 'c'.repeat(64), migration_report_digest: 'd'.repeat(64), consumed: true, evidence_references: [] }
});
assert.equal(forged.valid, false);
assert(forged.errors.some(error => error.includes('cannot claim product consumption')));
console.log('PASS validate-runtime-migration-v2');
