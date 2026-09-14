#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { selectTier1Validators, selectTier1ValidatorsForSurfaces } from '../../../scripts/select-tier1-validators-v2.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const hash = text => createHash('sha256').update(text).digest('hex');
// Discover consumers from live source, rather than certifying only a hand-picked list.
function markdownFiles(relative) {
  return fs.readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap(entry => {
    const name = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) return markdownFiles(name);
    return entry.isFile() && name.endsWith('.md') ? [name] : [];
  });
}
const consumers = [...markdownFiles('skills'), ...markdownFiles('agents'), ...markdownFiles('_shared'), 'references/elimination-gate-protocol.md']
  .filter(file => file === '_shared/product-question-format.md' || read(file).includes('product-question-format'));
const staleQuota = /12[- ](?:section|canonical sections)|(?:≥|>=)\s*40|(?:≥|>=)\s*20\s*(?:customer|system)|(?:all|asks the|Step 1:)\s*8\s*(?:business|Qs)|5[- ]competitors|all (?:are )?AGREE/i;
for (const file of consumers) {
  assert(!staleQuota.test(read(file)), `stale product-question contract: ${file}`);
  assert(!/No unresolved questions \| grep for TBD, TODO/.test(read(file)), `placeholder presence must not block completion: ${file}`);
  assert(selectTier1Validators([file]).selected.includes('validate-skill-judgment.mjs'), `unmapped live consumer: ${file}`);
}
assert(consumers.includes('agents/strategic-reviewer.md'));
const shared = read('_shared/product-question-format.md');
for (const principle of ['actual implementation evidence','affected','consequential decision','meaningful alternatives','Persona/user fit','reversibility','success signal','Useful innovation','AGREE/OVERRIDE','silence and elapsed time','No unresolved consequential decision','owner-decision-runtime-v2.md','skills/decide/SKILL.md']) {
  assert(shared.toLowerCase().includes(principle.toLowerCase()), `missing shared principle: ${principle}`);
}
// Counterexamples must be rejected even when the rest of the document looks healthy.
for (const regression of ['12-section format','≥40 questions','>=20 customer questions','all are AGREE','asks the 8 business questions','5-competitors']) assert(staleQuota.test(regression), regression);
assert(!staleQuota.test('There is no numeric question floor. Existing AGREE/OVERRIDE history remains valid.'));

function phases(text) {
  const block = text.match(/^phases:\n([\s\S]*?)^inputs:/m)?.[1];
  assert(block, 'phase metadata missing');
  return block.split(/^  - /m).slice(1).map(entry => ({
    id: entry.match(/\bid:\s*([\w.-]+)/)?.[1],
    trigger: entry.match(/\btrigger:\s*([\w-]+)/)?.[1],
    required: entry.match(/required_for_completion:\s*(true|false)/)?.[1] === 'true'
  }));
}
const feature = read('skills/validate-feature/SKILL.md');
assert(!feature.includes('ask "Does this capture it correctly?" after each'));
assert(!feature.includes('confirm direction before proceeding'));
assert(!/section by section/i.test(feature));
assert(feature.includes('For concept fragmentation'));
for (const name of ['write-spec','design-ux','design-tech','plan-changeset','review-gate','execute-changeset','design-ui','test-journeys','sync-spec-code','diagnose-bug']) {
  const contract = read(`skills/${name}/SKILL.md`);
  assert(!/No unresolved questions \| grep for TBD, TODO/.test(contract), `${name}: placeholder presence is not a consequential decision`);
  assert(contract.includes('block missing required AC/state/dependency evidence'));
}
for (const id of ['P3-GateMarketValidation','P4-BusinessBrief','P5-CrossValidationShipDecision']) {
  const phase = phases(feature).find(p => p.id === id);
  assert(phase && phase.trigger !== 'always' && !phase.required, `${id}: bounded accepted work must not force a new business cycle`);
}
assert(feature.includes('authorization alone is not evidence of demand'));
assert(feature.includes('Do not fabricate executed phase receipts'));
assert(feature.includes('P3–P5 commands below are conditional examples'));
assert(feature.includes('Otherwise verify accepted scope remains consistent'));
assert(!feature.includes('| 1 | Ship brief file exists |'));
const advisor = read('skills/svc-advisor/SKILL.md');
const diagnosis = read('skills/diagnose-bug/SKILL.md');
const ap = phases(advisor), dp = phases(diagnosis);
assert(ap.find(p => p.id === 'P1-QuestionClassification')?.required);
assert.equal(ap.find(p => p.id === 'P2b-MechanicalFactVerification')?.trigger, 'counts-or-wiring-claims');
assert.equal(ap.find(p => p.id === 'P2b-MechanicalFactVerification')?.required, false);
assert.equal(ap.find(p => p.id === 'P3-RelevantEvidenceLoad')?.trigger, 'additional-evidence-needed');
assert.equal(ap.find(p => p.id === 'P3-RelevantEvidenceLoad')?.required, false);
assert(!advisor.match(/inputs:\n  required:([\s\S]*?)  optional:/)?.[1].includes('CAPABILITIES.md'));
assert(advisor.includes('Every asserted count/wiring fact was re-derived'));
assert(advisor.includes('Record actual conditional phase evidence only when executed'));
assert(advisor.includes('Existing project competitor data alone does not make it relevant'));
for (const [name, text, sourcePhases] of [['svc-advisor',advisor,ap],['diagnose-bug',diagnosis,dp]]) {
  const summary = text.match(/## Applicability[^\n]*\n([\s\S]*?)(?=\n## )/)?.[1];
  assert(summary, `${name} summary missing`);
  for (const phase of sourcePhases) assert(summary.includes(phase.id), `${name}: source phase absent from summary: ${phase.id}`);
  assert(text.includes('references/task-graph-chaining-protocol.md'));
  assert.equal((text.match(/### Task-graph mode/g) || []).length, 1, `${name}: duplicate continuation returned`);
  assert(text.includes('Self-Verify'));
  console.log(JSON.stringify({skill:name,source_bytes:Buffer.byteLength(text),source_sha256:hash(text),applicability:sourcePhases}));
}
for (const phrase of ['latest reproduction','spec/code conflicts','dependent callers/writers','explicit owner request for diagnosis only','Self-Verify','Risk-Flag Classification','Pillar Revisit']) assert(diagnosis.includes(phrase), phrase);
assert(diagnosis.includes('If implementation is authorized and ALL paths auto-deploy'));
assert(!diagnosis.includes('pair with web_search'));
assert(read('skills/design-ux/SKILL.md').includes('existing-pattern-retained'));
assert(!read('skills/design-ux/SKILL.md').includes('Propose 3 distinct hooks'));
assert(read('skills/design-ui/SKILL.md').includes('For `existing-pattern-retained`'));
const fixture = JSON.parse(read('test-framework/fixtures/skill-judgment/behavior.json'));
assert.deepEqual(fixture.scenarios.map(s => s.id), ['A','B','C','D']);
for (const scenario of fixture.scenarios) {
  assert.equal(hash(scenario.prompt), scenario.prompt_sha256, `${scenario.id}: frozen prompt changed without hash`);
  assert(scenario.invariants.length >= 3);
}
const registeredSkills = JSON.parse(read('skills-manifest.json')).includedSkills;
const sourceSkills = fs.readdirSync(path.join(root, 'skills'), {withFileTypes:true})
  .filter(entry => entry.isDirectory() && fs.existsSync(path.join(root, 'skills', entry.name, 'SKILL.md')))
  .map(entry => entry.name);
assert.equal(new Set(registeredSkills).size, registeredSkills.length);
assert.deepEqual([...registeredSkills].sort(), sourceSkills.sort());
assert.equal(selectTier1Validators(['future/unmapped-skill.md']).fallback_full, true);
assert.equal(selectTier1Validators(['AGENTS.md']).fallback_full, true);
assert.deepEqual(selectTier1ValidatorsForSurfaces(['definitely-unmapped-skill-judgment-surface']).selected, []);
// The selector is a query; the runner owns rejecting a requested surface with no checks.
const selector = spawnSync(process.execPath, ['scripts/select-tier1-validators-v2.mjs','--surface','definitely-unmapped-skill-judgment-surface'], {cwd:root,encoding:'utf8'});
assert.equal(selector.status, 0, selector.stderr);
assert.deepEqual(JSON.parse(selector.stdout).selected, []);
const runner = spawnSync('bash', ['test-framework/evals/run-all-evals.sh','--surface','definitely-unmapped-skill-judgment-surface'], {cwd:root,encoding:'utf8',env:{...process.env,EVALS:'0',FLAKE_CHECK:'0'}});
assert.equal(runner.status, 2, runner.stdout + runner.stderr);
assert.match(runner.stderr, /matched zero runnable contract validators/);
console.log(`PASS skill judgment: ${consumers.length} live consumers; source-derived phase summaries, decision guardrails, frozen fixtures and selector/runner semantics. Behavioral quality requires the separate native evaluation.`);
