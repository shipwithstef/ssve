#!/usr/bin/env node
// WI-552: autonomous restart-boundary continuation lifecycle validator.
// Exercises the full baton lifecycle (create -> stamp-deploy -> launch ->
// consume) plus every fail-closed / hash-bound / phase-scoping guarantee
// from the WI-552 Acceptance Criteria, against a scratch repo root so it
// never touches this repo's own .svc/continuation state.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createBaton,
  stampDeploy,
  launch,
  consume,
  reconcile,
  readBaton,
  isPhaseForbiddenForSession,
  DEFAULT_FORBIDDEN_PHASES,
  DISPATCH_ROLE,
} from '../../../scripts/resolve-continuation.mjs';

const repoRoot = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-wi552-'));

// verify.restart MUST be resolved via the WI-551 resolver (AC-552-1/6): copy
// the real policy schema/resolver contract by pointing SVC_DISPATCH_POLICY at
// a scratch policy that declares the role, never a hand-rolled shortcut.
const policyPath = path.join(tmp, 'dispatch-policy.json');
const enabledHostManifest = path.join(tmp, 'provision', 'hosts', 'grok.json');
const disabledHostManifest = path.join(tmp, 'provision', 'hosts', 'cursor.json');
fs.mkdirSync(path.dirname(enabledHostManifest), { recursive: true });
fs.writeFileSync(enabledHostManifest, JSON.stringify({
  host: 'grok',
  authority_capabilities: { fresh_session_launch: { enabled: true, transport: 'cli-launch', event: 'SessionStart' } },
}, null, 2));
fs.writeFileSync(disabledHostManifest, JSON.stringify({
  host: 'cursor',
  authority_capabilities: { fresh_session_launch: { enabled: false, reason: 'no transport' } },
}, null, 2));

const policy = {
  schema_version: 1,
  authority: 'repository-owner',
  default_mode: 'mixed-grok-cursor',
  deny: { '*': ['claude-sonnet-5'] },
  allow: {},
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
      roles: {
        'verify.restart': { host: 'grok', family: 'xai', model: 'grok-4.6', effort: 'high' },
      },
    },
    'no-restart-route': {
      labels: {
        STRAT: { host: 'cursor', family: 'anthropic', model: 'claude-opus-5', effort: 'high' },
        PLAN: { host: 'cursor', family: 'anthropic', model: 'claude-opus-5', effort: 'high' },
        EXEC: { host: 'cursor', family: 'anthropic', model: 'claude-opus-5', effort: 'high' },
        REVIEW: { host: 'cursor', family: 'anthropic', model: 'claude-opus-5', effort: 'high' },
        SENSE: { host: 'cursor', family: 'anthropic', model: 'claude-opus-5', effort: 'high' },
        DISC: { host: 'cursor', family: 'anthropic', model: 'claude-opus-5', effort: 'high' },
        PASS: { host: 'cursor', family: 'anthropic', model: 'claude-opus-5', effort: 'high' },
      },
      // deliberately no "roles.verify.restart" -> resolver must fail closed.
    },
    'cursor-restart-route': {
      labels: {
        STRAT: { host: 'cursor', family: 'anthropic', model: 'claude-opus-5', effort: 'high' },
        PLAN: { host: 'cursor', family: 'anthropic', model: 'claude-opus-5', effort: 'high' },
        EXEC: { host: 'cursor', family: 'anthropic', model: 'claude-opus-5', effort: 'high' },
        REVIEW: { host: 'cursor', family: 'anthropic', model: 'claude-opus-5', effort: 'high' },
        SENSE: { host: 'cursor', family: 'anthropic', model: 'claude-opus-5', effort: 'high' },
        DISC: { host: 'cursor', family: 'anthropic', model: 'claude-opus-5', effort: 'high' },
        PASS: { host: 'cursor', family: 'anthropic', model: 'claude-opus-5', effort: 'high' },
      },
      // Resolver DOES route verify.restart to cursor here — this is the
      // owner's real policy answer. Cursor's manifest declares
      // fresh_session_launch.enabled=false, so launch must still fail
      // closed on capability, never silently substitute a different host.
      roles: {
        'verify.restart': { host: 'cursor', family: 'anthropic', model: 'claude-opus-5', effort: 'high' },
      },
    },
  },
};
fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`, { mode: 0o600 });

process.env.SVC_DISPATCH_POLICY = policyPath;
process.env.SVC_HOST = 'grok';

// ---------------------------------------------------------------------------
// AC-552-1/9: create persists a hash-bound baton; re-create is idempotent for
// identical core fields and refused for a conflicting re-create.
// ---------------------------------------------------------------------------
const wi = 'WI-9552';
const created = createBaton({
  wi,
  host: 'grok',
  event: 'SessionStart',
  proofQuery: 'does the freshly installed skill respond to a healthcheck',
  sessionId: 'svc-impl-session-a',
  cwd: tmp,
});
assert.equal(created.ok, true);
assert.equal(created.created, true);
assert.equal(created.baton.dispatch_role, DISPATCH_ROLE);
assert.deepEqual(created.baton.forbidden_phases, DEFAULT_FORBIDDEN_PHASES);
assert.equal(created.baton.status, 'pending');

const recreateIdentical = createBaton({
  wi,
  host: 'grok',
  event: 'SessionStart',
  proofQuery: 'does the freshly installed skill respond to a healthcheck',
  sessionId: 'svc-impl-session-a',
  cwd: tmp,
});
assert.equal(recreateIdentical.created, false, 'identical re-create must be a no-op, not a duplicate event');

assert.throws(
  () => createBaton({ wi, host: 'grok', event: 'SessionStart', proofQuery: 'a different proof query', sessionId: 'svc-impl-session-a', cwd: tmp }),
  /different core fields/,
  'AC-552-9: hash-bound baton identity cannot be swapped in place',
);

// Tamper-evidence: every ledger entry is hash-chained to the previous one.
const ledgerFile = path.join(tmp, '.svc', 'continuation', `${wi}.ledger.jsonl`);
const rawEntries = fs.readFileSync(ledgerFile, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
assert.equal(rawEntries[0].prev_sha256, null);
assert.ok(/^[a-f0-9]{64}$/.test(rawEntries[0].event_sha256), 'ledger entries are sha256 hash-bound');

// ---------------------------------------------------------------------------
// AC-552-8: ordinary WIs with no fresh-session boundary never touch this at
// all — reconcile on an absent baton is a pure no-op, zero new sessions.
// ---------------------------------------------------------------------------
const absent = reconcile({ wi: 'WI-NO-BATON-EXISTS', cwd: tmp });
assert.equal(absent.action, 'absent');
assert.equal(absent.baton, null);

// ---------------------------------------------------------------------------
// AC-552-3: launch before deploy-stamp is refused (waiting-for-deploy), never
// silently proceeds.
// ---------------------------------------------------------------------------
const tooEarly = launch({ wi, cwd: tmp, fake: true });
assert.equal(tooEarly.ok, false);
assert.equal(tooEarly.action, 'waiting-for-deploy');

// ---------------------------------------------------------------------------
// AC-552-6: fail-closed when the resolver has no route for the role — no
// silent Claude/Codex remap, one explicit blocked event instead.
// ---------------------------------------------------------------------------
const wiNoRoute = 'WI-9553';
createBaton({
  wi: wiNoRoute, host: 'cursor', event: 'SessionStart', proofQuery: 'q',
  sessionId: 'svc-impl-session-b', cwd: tmp,
});
stampDeploy({ wi: wiNoRoute, mergeSha: 'a'.repeat(40), cwd: tmp });
const blockedNoRoute = launch({ wi: wiNoRoute, cwd: tmp, fake: true, mode: 'no-restart-route' });
assert.equal(blockedNoRoute.ok, false);
assert.equal(blockedNoRoute.action, 'blocked');
assert.equal(blockedNoRoute.baton.status, 'blocked');
assert.match(blockedNoRoute.baton.block_reason, /dispatch resolver refused role "verify\.restart"/);

// ---------------------------------------------------------------------------
// AC-552-6 (continued): fail-closed when the resolved host lacks the
// fresh_session_launch capability — Grok/Cursor/AGY are never silently
// remapped to Claude/Codex; the block is capability_limited, not a fallback.
// ---------------------------------------------------------------------------
const wiNoCapability = 'WI-9554';
createBaton({
  wi: wiNoCapability, host: 'cursor', event: 'SessionStart', proofQuery: 'q',
  sessionId: 'svc-impl-session-c', cwd: tmp,
});
stampDeploy({ wi: wiNoCapability, mergeSha: 'b'.repeat(40), cwd: tmp });
const blockedCapability = launch({
  wi: wiNoCapability, cwd: tmp, fake: true, mode: 'cursor-restart-route',
});
assert.equal(blockedCapability.ok, false);
assert.equal(blockedCapability.baton.block_code, 'capability_limited');
assert.match(blockedCapability.baton.block_reason, /does not declare a fresh_session_launch capability|disabled/);

// ---------------------------------------------------------------------------
// AC-552-1/2/3/5: the happy path — stamp-deploy, launch EXACTLY ONCE via the
// WI-551 resolver, then a second launch/reconcile call must not spawn again.
// ---------------------------------------------------------------------------
const deployStamp = stampDeploy({ wi, mergeSha: 'c'.repeat(40), cwd: tmp });
assert.equal(deployStamp.stamped, true);
assert.equal(deployStamp.baton.status, 'deploy_stamped');

const launched = launch({ wi, cwd: tmp, fake: true });
assert.equal(launched.ok, true);
assert.equal(launched.action, 'launched');
assert.equal(launched.baton.status, 'launched');
assert.equal(launched.entry.tuple.host, 'grok', 'AC-552-1: verify.restart resolved via WI-551, not invented');
assert.equal(launched.entry.transport, 'grok');
const childSessionId = launched.entry.session_id;
assert.notEqual(childSessionId, created.baton.implementation_session_id, 'child session must differ from implementation session');

const secondLaunchAttempt = launch({ wi, cwd: tmp, fake: true });
assert.equal(secondLaunchAttempt.action, 'already-launched', 'AC-552-3: exactly once — never a second spawn while one is outstanding');
assert.equal(readBaton(wi, tmp).launches.length, 1);

const reconcileWhileLaunched = reconcile({ wi, cwd: tmp, fake: true });
assert.equal(reconcileWhileLaunched.action, 'waiting-for-result', 'reconcile must not relaunch while a launch is outstanding');

// ---------------------------------------------------------------------------
// AC-552-4: phase gating — the launched child session is scoped away from
// diagnose-bug/plan-changeset/execute-changeset; the implementation session
// and unrelated sessions are unaffected.
// ---------------------------------------------------------------------------
for (const skill of DEFAULT_FORBIDDEN_PHASES) {
  const outcome = isPhaseForbiddenForSession({ sessionId: childSessionId, skill, cwd: tmp });
  assert.equal(outcome.forbidden, true, `${skill} must be forbidden for the continuation child session`);
}
const alliedOutcome = isPhaseForbiddenForSession({ sessionId: childSessionId, skill: 'verify-promotion', cwd: tmp });
assert.equal(alliedOutcome.forbidden, false, 'verify-promotion itself must remain allowed for the child session');
const implementationOutcome = isPhaseForbiddenForSession({
  sessionId: created.baton.implementation_session_id, skill: 'plan-changeset', cwd: tmp,
});
assert.equal(implementationOutcome.forbidden, false, 'the implementation session is not the launched child and is unaffected');
const strangerOutcome = isPhaseForbiddenForSession({ sessionId: 'totally-unrelated-session', skill: 'plan-changeset', cwd: tmp });
assert.equal(strangerOutcome.forbidden, false);

// ---------------------------------------------------------------------------
// AC-552-2/7: consume enforces freshness + structured evidence. Reject stale/
// foreign sessions, free text, and forbidden-phase self-reports; accept a
// valid structured result exactly once.
// ---------------------------------------------------------------------------
assert.throws(
  () => consume({ wi, cwd: tmp, result: 'looks good, ship it' }),
  /structured result object/,
  'AC-552-7: free text is never valid evidence',
);

assert.throws(
  () => consume({
    wi, cwd: tmp,
    result: {
      schema_version: 1, wi, session_id: created.baton.implementation_session_id,
      started_at: new Date().toISOString(), event_status: 'success',
      proof_query: created.baton.boundary.proof_query,
      ac_mapping: [{ ac: 'AC-552-1', status: 'pass' }], artifacts: [], verdict: 'pass',
    },
  }),
  /not a fresh session/,
  'AC-552-2: result reusing the implementation session id is a freshness violation',
);

assert.throws(
  () => consume({
    wi, cwd: tmp,
    result: {
      schema_version: 1, wi, session_id: 'some-other-session-entirely',
      started_at: new Date().toISOString(), event_status: 'success',
      proof_query: created.baton.boundary.proof_query,
      ac_mapping: [{ ac: 'AC-552-1', status: 'pass' }], artifacts: [], verdict: 'pass',
    },
  }),
  /does not match the launched session/,
  'AC-552-2: foreign session id is rejected',
);

assert.throws(
  () => consume({
    wi, cwd: tmp,
    result: {
      schema_version: 1, wi, session_id: childSessionId,
      started_at: created.baton.deploy_receipt_at || new Date(0).toISOString(),
      event_status: 'success', proof_query: created.baton.boundary.proof_query,
      ac_mapping: [{ ac: 'AC-552-1', status: 'pass' }], artifacts: [], verdict: 'pass',
    },
  }),
  /not strictly after the deploy receipt/,
  'AC-552-2: started_at at-or-before the deploy receipt is stale, not fresh',
);

assert.throws(
  () => consume({
    wi, cwd: tmp,
    result: {
      schema_version: 1, wi, session_id: childSessionId,
      started_at: new Date(Date.now() + 1000).toISOString(), event_status: 'success',
      proof_query: created.baton.boundary.proof_query,
      ac_mapping: [{ ac: 'AC-552-1', status: 'pass' }], artifacts: [],
      verdict: 'pass', tasks_executed: ['plan-changeset'],
    },
  }),
  /forbidden phase/,
  'AC-552-4: a self-reported forbidden-phase execution cannot close the baton',
);

const validResult = {
  schema_version: 1, wi, session_id: childSessionId,
  started_at: new Date(Date.now() + 1000).toISOString(), event_status: 'success',
  proof_query: created.baton.boundary.proof_query,
  ac_mapping: [{ ac: 'AC-552-1', status: 'pass' }, { ac: 'AC-552-2', status: 'pass' }],
  artifacts: ['docs/specs/test-evidence/WI-9552/healthcheck.log'],
  tasks_executed: ['verify-promotion'],
  verdict: 'pass',
};
const closed = consume({ wi, cwd: tmp, result: validResult });
assert.equal(closed.ok, true);
assert.equal(closed.baton.status, 'closed_pass');

// Re-consuming the SAME result is idempotent; the child is no longer scoped.
const reconsumeSame = consume({ wi, cwd: tmp, result: validResult });
assert.equal(reconsumeSame.action, 'already-closed');
const afterCloseOutcome = isPhaseForbiddenForSession({ sessionId: childSessionId, skill: 'plan-changeset', cwd: tmp });
assert.equal(afterCloseOutcome.forbidden, false, 'a closed baton no longer scopes its former child session');

// ---------------------------------------------------------------------------
// AC-552-9: reconcile on a closed baton is a terminal, crash-safe no-op —
// this is what makes recovery after parent process death correct: a fresh
// process re-derives the exact same state from the ledger alone.
// ---------------------------------------------------------------------------
const reconcileClosed = reconcile({ wi, cwd: tmp });
assert.equal(reconcileClosed.action, 'done');

console.log('validate-continuation-lifecycle-wi552: PASS (AC-552-1,2,3,4,6,7,8,9 replay matrix)');
