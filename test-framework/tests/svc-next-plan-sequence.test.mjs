// @organism-suite
// The plan-manifest EMIT sequence svc-next prints, run for real in a temp project that starts from
// a bootstrapped root commit. The only step the test supplies itself is the cross-family reviewer's
// launcher artifacts (a signed fixture, as in two-box-receipts.test.mjs); every other printed
// command runs verbatim, and the receipt it produces is accepted by svc-next with the REAL emitter
// validation. The planning contract is the lightweight one (the live staged-tree classifier says
// eligible); two-box live planning needs the external reviewer CLI and is not reproducible offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { compileDeliveryGraph } from '../../scripts/compile-delivery-graph.mjs';
import { run, recipeFor, __testing } from '../../scripts/svc-next.mjs';
import { acTableSha256 } from '../../scripts/lib/normalize-ac-table.mjs';
import { createTransmutationSeal } from '../../scripts/lib/transmutation-seal.mjs';
import { evaluateEligibility, persistOriginalInputs, canonicalJson, objectRef } from '../../scripts/lib/two-box-protocol.mjs';
import { putObject } from '../../scripts/lib/review-evidence-store.mjs';
import { classifyFromGit } from '../../scripts/classify-change-risk.mjs';
import { sessionId } from '../../hooks/lib/resolve-wi.mjs';
import { sessionShaped } from '../../hooks/lib/claim-owner.mjs';
import { processStartToken } from '../../hooks/lib/wi-claim.mjs';
import { createExternalReviewFixture } from '../evals/tier-1/fixtures/external-review-fixture.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WI = 'WI-DP-TEST';
const spec = '# Feature\n## Acceptance Criteria\n| ID | Requirement |\n|---|---|\n| AC-1 | Back and Clear must not re-arm an explicitly disabled Scouted choice. |\n| AC-2 | Check the fee and mutate the same profile row in the same transaction. |\n';
const sha = (b) => createHash('sha256').update(b).digest('hex');
const git = (dir, ...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).trim();

function planBody(note) {
  return {
    receipt_type: 'plan-manifest', schema_version: 5, wi: WI, mode: 'inline',
    scope: { included: [note], excluded: [] }, dependencies: [], decision_trace: [],
    task_graph: [{ id: 'T1', files: [note], blocked_by: [], ac_ids: ['AC-1', 'AC-2'], validation_ids: ['V1'], context_refs: [] }],
    validation_plan: [{ id: 'V1', ac_ids: ['AC-1', 'AC-2'], observation_kind: 'unit', command: 'node --test choice.test.mjs', expected_outcome: 'manual intent and atomic transaction assertions pass', sufficiency: 'Pure controller/transaction contract; native app observation remains a separate release obligation.' }],
    risk_rollback: { risks: ['regressed manual choice'], rollback: 'revert the candidate', verification: 're-run the unit proof' },
    timestamp: '2026-09-07T20:30:00Z',
    execution_command_sequence: [{ step: 1, producer: { artifact: '.svc/release.json', field: 'sha', command: 'node scripts/release-identity.mjs' }, verifier: { command: 'node scripts/verify-release.mjs', expected_outcome: 'exact reviewed candidate' }, consumer_skill: 'land-changeset', expected_outcome: 'existing adapter lands the verified candidate' }],
    ac_digests: { spec_path: 'spec.md', spec_ac_table_sha256: acTableSha256(spec), entries: [{ ac_id: 'AC-1', digest: 'manual choice' }, { ac_id: 'AC-2', digest: 'atomic fee' }] },
    implementation_approach: [{ id: 'A1', requirement_ids: ['AC-1', 'AC-2'], source_ids: ['S1'], approach: 'Keep the existing controller and transaction.', interfaces: 'choice.mjs public exports stay the existing functions.', state_and_ownership: 'The named profile row remains the only mutated record.', failure_and_recovery: 'Abort the transaction and leave the row unchanged.', task_ids: ['T1'], validation_ids: ['V1'] }],
    executor_discretion: { local_repairs: ['Fix adjacent type errors in choice.mjs'], amendment_triggers: ['A new original requirement appears'], disagreement_protocol: 'Stop and return the exact conflict to planning.' },
  };
}

test('the printed plan-manifest sequence produces a receipt svc-next accepts (real emitter validation, fresh bootstrapped repo)', (t) => {
  const host = sessionId({}, process.env).trim();
  if (host && !sessionShaped(host)) { t.skip('host session identity is not session-shaped for claim attribution'); return; }
  const token = sessionShaped(host) ? host : '019f6001-5463-7dc0-a1f5-73104831606a';
  const savedEnv = { ...process.env };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-next-plan-'));
  try {
    if (!host) process.env.SVC_SESSION_ID = token;
    process.env.SVC_ROOT = ROOT;
    // one evidence store for the in-process fixture and every spawned command
    process.env.SVC_REVIEW_EVIDENCE_STORE = path.join(tmp, '.svc', 'review-evidence-store');
    // bootstrap: a repo with a root commit, .svc ignored
    execFileSync('git', ['init', '-q', tmp]);
    git(tmp, 'config', 'user.name', 'Fixture');
    git(tmp, 'config', 'user.email', 'fixture@invalid');
    git(tmp, 'config', 'core.hooksPath', '/dev/null');
    const real = fs.realpathSync(tmp);
    fs.writeFileSync(path.join(tmp, '.gitignore'), '.svc/\n');
    fs.mkdirSync(path.join(tmp, 'docs/specs'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'spec.md'), spec);
    fs.writeFileSync(path.join(tmp, 'docs/specs/note.md'), 'seed note\n');
    git(tmp, 'add', '-A');
    git(tmp, 'commit', '-qm', 'root');
    let branch = git(tmp, 'branch', '--show-current');
    if (!branch) branch = git(tmp, 'symbolic-ref', '--short', 'HEAD');
    fs.appendFileSync(path.join(tmp, '.git/info/exclude'), '.svc/bindings/\n.svc/claims/\n.svc/impact-triad/\n');

    // the compiled lane graph svc-next drives; execute-changeset is the task the classifier evidence binds to
    const graph = compileDeliveryGraph({ wi: WI, lane: 'bugfix', change_type: 'bugfix', user_intent: 'x' });
    const exec = graph.tasks.find((x) => x.metadata.skill === 'execute-changeset');
    exec.status = 'in_progress';
    exec.skill_receipt = { skill: 'execute-changeset', loaded_at: '2026-09-07T20:30:00Z', loaded_via: 'fixture' };
    graph.tasks[0].status = 'completed';
    graph.tasks[0].skill_receipt = { skill: 'diagnose-bug', loaded_at: '2026-09-07T20:30:00Z', loaded_via: 'fixture' };
    graph.tasks[0].chain_receipt = { type: 'load-skill' };
    const graphPath = path.join(real, '.svc', `lane-tasks-${WI}.json`);
    fs.mkdirSync(path.join(tmp, '.svc/bindings'), { recursive: true });
    fs.mkdirSync(path.join(tmp, '.svc/claims'), { recursive: true });
    fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2));
    const now = new Date().toISOString();
    const claimPath = path.join(real, `.svc/claims/${WI}.claim.json`);
    fs.writeFileSync(claimPath, JSON.stringify({ schema_version: 1, wi: WI, generation: 1, repo_root: real, worktree_root: real, branch, session_id: token, role: 'mutating', started_at: now, renewed_at: now, ttl_hours: 24, hostname: os.hostname(), pid: process.pid, process_start_token: processStartToken(process.pid) }));
    fs.writeFileSync(path.join(tmp, '.svc/bindings/test.json'), JSON.stringify({ schema_version: 1, session_id: token, role: 'mutating', wi: WI, repo_root: real, worktree_root: real, branch, claim_path: claimPath, created_at: now, updated_at: now, generation: 1 }));

    // the staged candidate: a docs edit the live classifier calls eligible
    fs.appendFileSync(path.join(tmp, 'docs/specs/note.md'), 'eligible docs edit\n');
    git(tmp, 'add', 'docs/specs/note.md');
    const classified = classifyFromGit({ cwd: tmp, staged: true });
    assert.equal(classified.tier, 'cosmetic');
    fs.mkdirSync(path.join(tmp, `.svc/impact-triad/${WI}`), { recursive: true });
    fs.writeFileSync(path.join(tmp, `.svc/impact-triad/${WI}/task-${exec.id}.json`), JSON.stringify({ schema_version: 1, wi: WI, session_id: token, worktree_root: real, task_graph: graphPath, task_id: exec.id, diff_sha256: classified.sha256, risk_tier: classified.tier, risk_reasons: classified.reasons, breaks_what: { answer: 'docs note copy', sources: ['git diff --cached'], evidence: ['svc-next-plan-sequence.test.mjs'] }, intended_behavior: { answer: 'keep the existing contract', sources: ['spec.md'], evidence: ['AC-1'] }, product_surface: { answer: 'headless eligibility fixture', sources: ['scripts/quick-fix-eligibility.mjs'], evidence: ['mechanical fixture'] }, coverage_tasks: [{ id: 'fixture', status: 'completed', owner: 'test', validation: 'svc-next-plan-sequence.test.mjs' }], independent_review: { status: 'n/a', executor_family: 'n/a', reviewer_family: 'n/a', artifacts: [] }, runtime_proof: { status: 'pass', kind: 'static', artifacts: ['docs/specs/note.md'] }, created_at: now }));
    const eligibility = evaluateEligibility({ consumerRoot: tmp });
    assert.equal(eligibility.eligible, true);
    const persisted = persistOriginalInputs({ originalRequirements: [{ id: 'AC-1' }, { id: 'AC-2' }], facts: { annotations: { change_archetype: 'feature' } } }, { start: tmp });
    const stored = putObject(Buffer.from(canonicalJson(eligibility), 'utf8'), { start: tmp });

    // STEP 1 of the printed sequence (MODEL): the manifest body
    const body = planBody('docs/specs/note.md');
    body.planning_contract = { kind: 'lightweight', original_requirements_ref: persisted.original_requirements_ref, eligibility_ref: objectRef(stored.sha256), eligibility_tree: eligibility.staged_tree };
    const manifestRel = `docs/plans/${WI}/manifest.md`;
    fs.mkdirSync(path.join(tmp, path.dirname(manifestRel)), { recursive: true });
    fs.writeFileSync(path.join(tmp, manifestRel), `# Plan\n<!-- SVC_PLAN_BODY -->\n\`\`\`json\n${JSON.stringify(body, null, 2)}\n\`\`\`\n<!-- /SVC_PLAN_BODY -->\n`);

    // The printed sequence, split into its numbered steps.
    const steps = recipeFor('plan-manifest', { rootArg: '.', wi: WI }).filter((l) => /^\d+\. /.test(l));
    const find = (needle) => {
      const line = steps.find((l) => l.includes(needle));
      assert.ok(line, `printed sequence has a step with ${needle}`);
      return line.replace(/^\d+\. /, '').replace(/\s+#.*$/, '');
    };
    const sh = (command) => {
      const r = spawnSync('bash', ['-c', command], { cwd: tmp, encoding: 'utf8', env: { ...process.env, SVC_ROOT: ROOT } });
      assert.equal(r.status, 0, `${command}\n${r.stderr}${r.stdout}`);
      return r.stdout;
    };
    sh(find('git add -A'));
    assert.equal(git(tmp, 'diff', '--cached', '--name-only'), 'docs/specs/note.md', 'only the candidate is staged; the manifest stays out');
    sh(find('--write --out'));
    const bodyPath = path.join(tmp, '.svc/external-review-artifacts/plan-handoff/body.json');
    const planBytes = fs.readFileSync(bodyPath);

    // STEP 5 (cross-family review): the launcher's signed artifacts, supplied by the fixture. The
    // printed step 6 then builds, proves and stores the canonical review-plan body from them.
    process.env.SVC_HOST = 'codex';
    const tree = git(tmp, 'write-tree');
    const treeDigest = sha(`git-tree:${tree}\n`);
    const manifestBytes = fs.readFileSync(path.join(tmp, manifestRel));
    const candidateTreeBytes = Buffer.from(JSON.stringify({ tree_hash: tree, candidate_digest: treeDigest }) + '\n');
    const head = git(tmp, 'rev-parse', 'HEAD');
    const fixture = createExternalReviewFixture({
      frameworkRoot: ROOT, repo: tmp, reviewKind: 'plan', candidateDigestOverride: sha(planBytes), candidateSha: head, wi: WI,
      packageFilesOverride: [
        { path: 'artifact:plan.json', sha256: sha(planBytes), bytes: planBytes.length },
        { path: manifestRel, sha256: sha(manifestBytes), bytes: manifestBytes.length },
        { path: 'candidate:git-tree', sha256: sha(candidateTreeBytes), bytes: candidateTreeBytes.length },
      ],
    });
    putObject(fs.readFileSync(fixture.receiptPath), { start: tmp });
    const summaryDir = path.join(tmp, '.svc/external-review-artifacts/plan-review');
    fs.mkdirSync(summaryDir, { recursive: true });
    fs.writeFileSync(path.join(summaryDir, 'summary.json'), JSON.stringify({ ok: true, findings: fixture.output, receipt: fixture.receiptPath }));
    const built = sh(find('--build-review plan'));
    const reviewRef = /^review_ref ([0-9a-f]{64})$/m.exec(built)?.[1];
    assert.ok(reviewRef, built);
    assert.equal(JSON.parse(fs.readFileSync(path.join(tmp, '.svc/review-plan.body.json'), 'utf8')).schema_version, 3);

    // STEPS 7-9: seal, emit, print the closeout digest
    const sealOut = sh(find('--seal-after-review').replace('<review_ref>', reviewRef));
    const sealRef = JSON.stringify(JSON.parse(sealOut.trim().split('\n').pop()).seal_ref);
    sh(find('emit-receipt.mjs --type plan-manifest').replace(/'<seal_ref as printed>'/, `'${sealRef}'`));
    const closeout = sh(find('--sha plan-manifest')).trim();
    assert.match(closeout, /^plan-manifest:[0-9a-f]{64}$/);

    // svc-next accepts exactly that receipt, with the real emitter validation in force.
    assert.equal(__testing.emitterValidator, null);
    const out = [];
    const ow = process.stdout.write;
    process.stdout.write = (c) => { out.push(String(c)); return true; };
    let code;
    try { code = run(['--root', tmp, '--wi', WI, '--done', 'plan-changeset', '--receipt', closeout]); } finally { process.stdout.write = ow; }
    assert.equal(code, 0, out.join(''));
    assert.match(out.join(''), /^SKILL review-plan$/m);
    const done = JSON.parse(fs.readFileSync(graphPath, 'utf8')).tasks.find((x) => x.metadata.skill === 'plan-changeset');
    assert.equal(done.status, 'completed');
    assert.equal(`plan-manifest:${done.chain_receipt.sha256}`, closeout);
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in savedEnv)) delete process.env[k];
    Object.assign(process.env, savedEnv);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
