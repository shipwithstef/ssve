#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  resolveDispatchExternalReviewer,
  resolveDispatchModel,
  resolveDispatchReviewTopology,
} from '../../../scripts/resolve-dispatch.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-wi551-'));
const policyPath = path.join(tmp, 'dispatch-policy.json');
const overlayPath = path.join(tmp, 'overlay-wi551.json');
const overridePath = path.join(tmp, 'session-override.json');
const overrideReceiptPath = path.join(tmp, 'session-override-receipt.json');
const sessionId = 'svc-impl-wi551-test';

const writeJson = (file, value) => {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
};

const fileSha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const writeBoundReceipt = ({ sessionId: sid, wi, overrideFile, receiptFile }) => {
  writeJson(receiptFile, {
    type: 'dispatch-session-override',
    authority: 'repository-owner',
    session_id: sid,
    wi,
    reason: 'owner request',
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    override_sha256: fileSha256(overrideFile),
  });
};

const basePolicy = {
  schema_version: 1,
  authority: 'repository-owner',
  default_mode: 'mixed-grok-cursor',
  deny: {
    '*': ['claude-sonnet-5'],
    implementor: ['claude-opus-5'],
    'review.plan': ['claude-opus-5'],
    'review.exec': ['claude-opus-5'],
  },
  allow: {
    'review.design': ['claude-opus-5'],
  },
  modes: {
    'mixed-grok-cursor': {
      labels: {
        STRAT: { host: 'grok', family: 'xai', model: 'grok-4.6', effort: 'high' },
        PLAN: { host: 'grok', family: 'xai', model: 'grok-4.6', effort: 'high' },
        EXEC: { host: 'grok', family: 'xai', model: 'grok-4.6', effort: 'high' },
        REVIEW: { host: 'grok', family: 'xai', model: 'grok-4.6', effort: 'high' },
        SENSE: { host: 'grok', family: 'xai', model: 'grok-code-fast', effort: 'high' },
        DISC: { host: 'grok', family: 'xai', model: 'web_search', effort: 'high' },
        PASS: { host: 'grok', family: 'xai', model: 'grok-code-fast', effort: 'high' },
      },
      review: {
        plan: {
          release_authority: true,
          stations: [
            { id: 'grok-self', kind: 'inline-self', required: true, authority: 'advisory', tuple: { host: 'grok', family: 'xai', model: 'grok-4.6', effort: 'high' } },
            { id: 'fable', kind: 'external', required: true, authority: 'independent', tuple: { host: 'cursor', family: 'anthropic', model: 'claude-fable-5', effort: 'high' }, max_invocations: 1, round_trip: false },
            { id: 'sol-high', kind: 'external', required: true, authority: 'independent', tuple: { host: 'cursor', family: 'openai', model: 'gpt-5.6-sol', effort: 'high' } },
            { id: 'agy-gemini-3.7-high', kind: 'external', required: false, authority: 'independent', tuple: { host: 'agy', family: 'google', model: 'Gemini 3.7 Flash (High)', effort: 'high' }, fallback_only: true, explicit_request_only: true },
          ],
        },
        exec: {
          release_authority: true,
          stations: [
            { id: 'grok-self', kind: 'inline-self', required: true, authority: 'advisory', tuple: { host: 'grok', family: 'xai', model: 'grok-4.6', effort: 'high' } },
            { id: 'fable', kind: 'external', required: true, authority: 'independent', tuple: { host: 'cursor', family: 'anthropic', model: 'claude-fable-5', effort: 'high' }, max_invocations: 1, round_trip: false },
            { id: 'sol-high', kind: 'external', required: true, authority: 'independent', tuple: { host: 'cursor', family: 'openai', model: 'gpt-5.6-sol', effort: 'high' } },
            { id: 'agy-gemini-3.7-high', kind: 'external', required: false, authority: 'independent', tuple: { host: 'agy', family: 'google', model: 'Gemini 3.7 Flash (High)', effort: 'high' }, fallback_only: true, explicit_request_only: true },
          ],
        },
        design: {
          release_authority: false,
          stations: [
            { id: 'grok-self', kind: 'inline-self', required: true, authority: 'advisory', tuple: { host: 'grok', family: 'xai', model: 'grok-4.6', effort: 'high' } },
            { id: 'opus-5-design', kind: 'external', required: true, authority: 'advisory', tuple: { host: 'cursor', family: 'anthropic', model: 'claude-opus-5', effort: 'high' } },
          ],
        },
      },
    },
  },
};

writeJson(policyPath, basePolicy);

// AC-10 (1): global-only snapshot
const globalOnly = resolveDispatchModel({ configPath: policyPath, label: 'EXEC', orchestrator: 'grok' });
assert.equal(globalOnly.tuple.host, 'grok');
assert.equal(globalOnly.tuple.model, 'grok-4.6');

// AC-10 (2): edit global file, next resolve differs.
const editedPolicy = structuredClone(basePolicy);
editedPolicy.modes['mixed-grok-cursor'].labels.EXEC.model = 'grok-4.6-patch';
writeJson(policyPath, editedPolicy);
const edited = resolveDispatchModel({ configPath: policyPath, label: 'EXEC', orchestrator: 'grok' });
assert.equal(edited.tuple.model, 'grok-4.6-patch');
assert.notEqual(edited.tuple.model, globalOnly.tuple.model);

// AC-10 (3): session override requested + receipted changes result.
writeJson(overridePath, {
  patch: {
    modes: {
      'mixed-grok-cursor': {
        labels: {
          EXEC: { host: 'cursor', family: 'openai', model: 'composer-2.5-fast', effort: 'high' },
        },
      },
    },
  },
});
writeBoundReceipt({
  sessionId,
  wi: 'WI-551',
  overrideFile: overridePath,
  receiptFile: overrideReceiptPath,
});
const overrideApplied = resolveDispatchModel({
  configPath: policyPath,
  label: 'EXEC',
  orchestrator: 'grok',
  wi: 'WI-551',
  sessionId,
  sessionOverrideSpec: overridePath,
  sessionOverrideRequested: 'true',
  sessionOverrideReceiptSpec: overrideReceiptPath,
});
assert.equal(overrideApplied.tuple.host, 'cursor');
assert.equal(overrideApplied.tuple.model, 'composer-2.5-fast');

// AC-10 (4): override payload without explicit request does not apply.
const noRequest = resolveDispatchModel({
  configPath: policyPath,
  label: 'EXEC',
  orchestrator: 'grok',
  wi: 'WI-551',
  sessionId,
  sessionOverrideSpec: overridePath,
  sessionOverrideRequested: 'false',
  sessionOverrideReceiptSpec: overrideReceiptPath,
});
assert.equal(noRequest.tuple.model, 'grok-4.6-patch');

// AC-10 (5): WI-scoped work overlay does not leak.
writeJson(overlayPath, {
  scope: { wi: 'WI-551' },
  patch: {
    modes: {
      'mixed-grok-cursor': {
        labels: {
          EXEC: { host: 'grok', family: 'xai', model: 'grok-4.6-overlay', effort: 'high' },
        },
      },
    },
  },
});
const withOverlay = resolveDispatchModel({
  configPath: policyPath,
  label: 'EXEC',
  orchestrator: 'grok',
  wi: 'WI-551',
  workOverlayPath: overlayPath,
});
const leakedOverlay = resolveDispatchModel({
  configPath: policyPath,
  label: 'EXEC',
  orchestrator: 'grok',
  wi: 'WI-999',
  workOverlayPath: overlayPath,
});
assert.equal(withOverlay.tuple.model, 'grok-4.6-overlay');
assert.equal(leakedOverlay.tuple.model, 'grok-4.6-patch');
assert.throws(
  () => resolveDispatchModel({
    configPath: policyPath,
    label: 'EXEC',
    orchestrator: 'grok',
    workOverlayPath: overlayPath,
  }),
  /scoped work overlay requires the current WI/,
  'SOL-E008: scoped overlay without a caller WI must not apply globally',
);

const unscopedOverlayPath = path.join(tmp, 'overlay-unscoped.json');
writeJson(unscopedOverlayPath, {
  patch: {
    modes: {
      'mixed-grok-cursor': {
        labels: {
          EXEC: { host: 'grok', family: 'xai', model: 'grok-4.6-unscoped', effort: 'high' },
        },
      },
    },
  },
});
assert.throws(
  () => resolveDispatchModel({
    configPath: policyPath,
    label: 'EXEC',
    orchestrator: 'grok',
    wi: 'WI-551',
    workOverlayPath: unscopedOverlayPath,
  }),
  /scope\.wi/,
  'SOL-R2-006 / FAB-548-005: unscoped work overlay must not apply globally',
);

// AC-10 (6): deny-list beats defaults (no silent bypass).
const deniedPolicy = structuredClone(basePolicy);
deniedPolicy.modes['mixed-grok-cursor'].labels.EXEC = { host: 'claude', family: 'anthropic', model: 'claude-sonnet-5', effort: 'high' };
writeJson(policyPath, deniedPolicy);
assert.throws(
  () => resolveDispatchModel({ configPath: policyPath, label: 'EXEC', orchestrator: 'grok' }),
  /denied for role "implementor"/
);

// AC-10 (7): missing global file refuses.
assert.throws(
  () => resolveDispatchModel({ configPath: path.join(tmp, 'missing-policy.json'), label: 'EXEC', orchestrator: 'grok' }),
  /missing/
);

// Restore baseline for review topology and AGY tests.
writeJson(policyPath, editedPolicy);

// AC-10 (8): preferred unavailable -> next allowed station.
const normalExternal = resolveDispatchExternalReviewer({
  configPath: policyPath,
  orchestrator: 'grok',
  phase: 'plan',
});
assert.equal(normalExternal.station.id, 'fable');
const fallbackExternal = resolveDispatchExternalReviewer({
  configPath: policyPath,
  orchestrator: 'grok',
  phase: 'plan',
  unavailableStations: ['fable', 'sol-high'],
});
assert.equal(fallbackExternal.station.id, 'agy-gemini-3.7-high');

// AC-10 (9): Opus 5 allowed for design review but denied for EXEC.
const designTopology = resolveDispatchReviewTopology({
  configPath: policyPath,
  orchestrator: 'grok',
  phase: 'design',
});
assert.ok(designTopology.stations.some((station) => station.id === 'opus-5-design'));
writeJson(overridePath, {
  patch: {
    modes: {
      'mixed-grok-cursor': {
        labels: {
          EXEC: { host: 'cursor', family: 'anthropic', model: 'claude-opus-5', effort: 'high' },
        },
      },
    },
  },
});
writeBoundReceipt({
  sessionId,
  wi: 'WI-551',
  overrideFile: overridePath,
  receiptFile: overrideReceiptPath,
});
assert.throws(
  () => resolveDispatchModel({
    configPath: policyPath,
    label: 'EXEC',
    orchestrator: 'grok',
    wi: 'WI-551',
    sessionId,
    sessionOverrideSpec: overridePath,
    sessionOverrideRequested: 'true',
    sessionOverrideReceiptSpec: JSON.stringify({
      type: 'dispatch-session-override',
      authority: 'repository-owner',
      session_id: sessionId,
      wi: 'WI-551',
      override_sha256: fileSha256(overridePath),
      issued_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    }),
  }),
  /protected owner file, not inline JSON/,
  'SOL-E007: inline owner receipts cannot authorize a session override',
);
assert.throws(
  () => resolveDispatchModel({
    configPath: policyPath,
    label: 'EXEC',
    orchestrator: 'grok',
    wi: 'WI-551',
    sessionId,
    sessionOverrideSpec: overridePath,
    sessionOverrideRequested: 'true',
    sessionOverrideReceiptSpec: overrideReceiptPath,
  }),
  /denied for role "implementor"/
);

// AC-10 (10): Gemini skipped while preferred exists; allowed as fallback or explicit ask.
const geminiSkipped = resolveDispatchExternalReviewer({
  configPath: policyPath,
  orchestrator: 'grok',
  phase: 'exec',
});
assert.notEqual(geminiSkipped.station.id, 'agy-gemini-3.7-high');
const geminiFallback = resolveDispatchExternalReviewer({
  configPath: policyPath,
  orchestrator: 'grok',
  phase: 'exec',
  unavailableStations: ['fable', 'sol-high'],
});
assert.equal(geminiFallback.station.id, 'agy-gemini-3.7-high');
const geminiExplicitAnyHost = resolveDispatchExternalReviewer({
  configPath: policyPath,
  orchestrator: 'cursor',
  phase: 'exec',
  explicitAsk: true,
});
assert.equal(geminiExplicitAnyHost.station.id, 'agy-gemini-3.7-high');
const geminiExplicitStationAsk = resolveDispatchExternalReviewer({
  configPath: policyPath,
  orchestrator: 'cursor',
  phase: 'exec',
  stationId: 'agy-gemini-3.7-high',
  explicitAsk: true,
});
assert.equal(geminiExplicitStationAsk.station.id, 'agy-gemini-3.7-high');

console.log('validate-dispatch-resolver-wi551: PASS (AC-551-1..9 + proposal AC-10 replay matrix)');
