import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { reportRepairKind, isIncompleteReviewReport, validateReportRepair, isZeroCallReviewReplay, hasNegativeReviewEvidence, remainingReportRepairBudget } from '../../scripts/lib/review-report-recovery.mjs';
import { createExternalReviewFixture } from '../evals/tier-1/fixtures/external-review-fixture.mjs';
import { issueExternalReviewProvenance, externalReviewCycleCapacity, reserveExternalReviewRound, verifyExternalReviewProvenance, listExternalReviewCycleProvenance, externalReviewCycleIdFromReceipt } from '../../scripts/lib/external-review-provenance.mjs';
const frameworkRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const digest = 'a'.repeat(64);
const source = () => ({ verdict:'pass', summary:'Source review complete; install is downstream.', findings:[], dependencies_needing_read:[], certifications:[{key:'source',certified:true,for_content_sha:digest},{key:'installation',certified:false,for_content_sha:null}] });

test('report repair retains actual judgments and bound evidence', () => {
 const before=source(),after={...before,certifications:before.certifications.slice(0,1)};
 assert.equal(reportRepairKind(before),'certification-scope');
 assert.deepEqual(validateReportRepair(before,after,'certification-scope'),[]);
 for(const changed of [{...after,verdict:'fail'},{...after,summary:'rewritten'},{...after,findings:[{severity:'high'}]},{...after,certifications:[{...before.certifications[0],certified:false}]}]) assert.ok(validateReportRepair(before,changed,'certification-scope').length);
 assert.ok(validateReportRepair(before,{...before,certifications:before.certifications.map(c=>({...c,certified:true}))},'certification-scope').length,'never promote false to true');
 const failed=source();failed.certifications[1].for_content_sha=digest;
 assert.equal(reportRepairKind(failed),null,'a bound failed candidate check cannot be automatically removed');
 assert.equal(reportRepairKind({...source(),verdict:'fail',findings:[{id:'real',severity:'high'}]}),null);
});

test('placeholder recovery cannot hide a real finding; unchanged bad reports still fail', () => {
 assert.equal(reportRepairKind({...source(),certifications:[],summary:'Placeholder until source is read'}),'incomplete');
 assert.equal(reportRepairKind({...source(),verdict:'fail',summary:'Placeholder',findings:[{severity:'critical'}]}),null);
 assert.ok(validateReportRepair(source(),source(),'certification-scope').length);
});

test('replay classification requires zero actual calls, not a caller label', () => {
 const replay={classification:'cache_hit',status:'success',protocol:{process_invocations:0},attempts:[],reviewer_run:{commands:[]}};
 assert.equal(isZeroCallReviewReplay(replay),true);
 assert.equal(isZeroCallReviewReplay({...replay,attempts:[{}]}),false);
 assert.equal(isZeroCallReviewReplay({...replay,protocol:{process_invocations:1}}),false);
 assert.equal(isZeroCallReviewReplay({...replay,classification:'success'}),false);
});

test('signed cache replays preserve history without consuming substantive round capacity', () => {
 const repo=fs.mkdtempSync(path.join(os.tmpdir(),'review-round-replay-'));
 const keys=['SVC_EXTERNAL_REVIEW_PROVENANCE_FIXTURE','SVC_EXTERNAL_REVIEW_ISSUANCE_ROOT','SVC_REVIEW_EVIDENCE_STORE'];
 const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 process.env.SVC_EXTERNAL_REVIEW_PROVENANCE_FIXTURE='1';process.env.SVC_EXTERNAL_REVIEW_ISSUANCE_ROOT=path.join(repo,'.svc/authority');process.env.SVC_REVIEW_EVIDENCE_STORE=path.join(repo,'.svc/store');
 try {
  const make=label=>createExternalReviewFixture({frameworkRoot,repo,wi:'WI-REPLAY-TEST',candidateDigestOverride:digest,roundLabel:label});
  const first=make('first'),raw=fs.readFileSync(first.receiptPath),r=JSON.parse(raw);
  const replay=label=>{
   const dir=path.join(repo,'.svc/external-review-artifacts',label);fs.mkdirSync(dir,{recursive:true,mode:0o700});
   const receiptPath=path.join(dir,'receipt.json'),packagePath=path.join(dir,'review-package.bin'),findingsPath=path.join(dir,'findings.json');
   fs.copyFileSync(r.artifacts.package,packagePath);fs.copyFileSync(r.artifacts.findings,findingsPath);
   const cache={...r,request_id:crypto.randomUUID(),classification:'cache_hit',attempts:[],protocol:{...r.protocol,process_invocations:0},reviewer_run:{commands:[],output_artifacts:[]},route:{...r.route,kind:'cache_hit',evidence:'cache_receipt_replay'},model_attestation:{...r.model_attestation,level:'cache_replay'},artifacts:{...r.artifacts,receipt:receiptPath,package:packagePath,findings:findingsPath}};
   fs.writeFileSync(receiptPath,JSON.stringify(cache),{mode:0o600});issueExternalReviewProvenance({receiptPath,packagePath,findingsPath});verifyExternalReviewProvenance({receiptPath,packagePath,findingsPath});
  };
  replay('replay-one');replay('replay-two');
  assert.equal(externalReviewCycleCapacity(r,{receiptPath:first.receiptPath}).issued,1);
  make('second');
  assert.equal(externalReviewCycleCapacity(r,{receiptPath:first.receiptPath}).allowed,false);
  assert.throws(()=>make('third'),/hard cap/);
  replay('replay-at-cap');
  assert.equal(externalReviewCycleCapacity(r,{receiptPath:first.receiptPath}).issued,2);
  const rows=listExternalReviewCycleProvenance({receiptPath:first.receiptPath,wi:'WI-REPLAY-TEST',reviewKind:r.review_kind,cycleId:externalReviewCycleIdFromReceipt(r)});
  assert.deepEqual(rows.map(row=>row.cycle_sequence),[1,2,3,4,5],'raw issuance order survives zero-call filtering');
  assert.deepEqual(rows.map(row=>row.counts_as_round),[true,false,false,true,false]);
  assert.deepEqual(fs.readFileSync(first.receiptPath),raw,'historical signed source is never rewritten');
 } finally { for(const k of keys)if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];fs.rmSync(repo,{recursive:true,force:true}); }
});

test('placeholder completion retains every existing negative observation', () => {
 const empty={verdict:'pass',summary:'Placeholder',findings:[],certifications:[],rubric_failures:[],dependencies_needing_read:[]};
 for(const negative of [{verdict:'fail'},{findings:[{severity:'high'}]},{certifications:[{certified:false,for_content_sha:digest}]},{rubric_failures:[3]},{dependencies_needing_read:['missing-proof.md']},{findings:{id:'real',severity:'high'}},{certifications:{certified:false}},{rubric_failures:3},{dependencies_needing_read:'missing-proof.md'}]) {
  const before={...empty,...negative};assert.equal(hasNegativeReviewEvidence(before),true);assert.equal(reportRepairKind(before),null);
 }
});

test('repair budget respects supported ceilings and exposes unsupported transports', () => {
 assert.equal(remainingReportRepairBudget('claude',50,12),38);
 for(const spent of [undefined,null,NaN,-1,Infinity,50,60])assert.equal(remainingReportRepairBudget('claude',50,spent),0);
 for(const host of ['codex','agy','cursor','grok']) {
  assert.equal(remainingReportRepairBudget(host,50,undefined),null,'no enforceable dollar ceiling; not a zero-cost claim');
  for(const spent of [undefined,0,12])assert.equal(remainingReportRepairBudget(host,50,spent,true),0,'explicit unsupported dollar cap cannot authorize another call');
 }
});

test('a completed review discussing placeholder handling is not an incomplete report', () => {
 const report={...source(),certifications:[],summary:'The fixes hold. validateFindings rejects an unrepaired placeholder and prevents publication.'};
 assert.equal(isIncompleteReviewReport(report),false);assert.equal(reportRepairKind(report),null);
 for(const summary of ['Placeholder until the source is read','Inspection in progress','Review is not yet complete'])assert.equal(isIncompleteReviewReport({...report,summary}),true);
});


test('observed unscored Loading responses complete once without hiding negative evidence', () => {
 const progress={verdict:'fail',rubric_score:null,summary:'Loading bounded publisher diff and consumers for independent exec review.',findings:[],certifications:[],rubric_failures:null,dependencies_needing_read:null};
 assert.equal(isIncompleteReviewReport(progress),true);
 assert.equal(reportRepairKind(progress),'incomplete');
 for(const change of [{rubric_score:0},{findings:[{severity:'high'}]},{certifications:[{certified:false}]},{rubric_failures:[1]},{dependencies_needing_read:['source.mjs']},{summary:'Loading failed because source is missing.'}])assert.equal(reportRepairKind({...progress,...change}),null);
});


test('two feature reservations survive digest, kind, reviewer, session and WI aliases; incomplete counts', () => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rv1-feature-rounds-'));
 const keys=['SVC_EXTERNAL_REVIEW_PROVENANCE_FIXTURE','SVC_EXTERNAL_REVIEW_ISSUANCE_ROOT'];
 const old=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 process.env.SVC_EXTERNAL_REVIEW_PROVENANCE_FIXTURE='1';process.env.SVC_EXTERNAL_REVIEW_ISSUANCE_ROOT=path.join(dir,'authority');
 try {
  const make=(wi,kind,digestChar,host)=>({request_id:crypto.randomUUID(),phase_guard:{wi},protocol:{feature_id:'feature-RV1'},review_kind:kind,candidate_digest:digestChar.repeat(64),effective_tuple:{orchestrator:'codex',host,family:host==='cursor'?'xai':'anthropic'}});
  const first=make('WI-RV1','exec','a','cursor');
  assert.equal(reserveExternalReviewRound(first).round,1); // No result issued: incomplete still consumes a round.
  const second=make('WI-RV1-ALIAS','design','b','agy');
  assert.equal(reserveExternalReviewRound(second).round,2);
  const third=make('WI-RV1','plan','c','cursor');
  assert.equal(externalReviewCycleCapacity(third).allowed,false);
  assert.throws(()=>reserveExternalReviewRound(third),/hard cap/);
  assert.throws(()=>reserveExternalReviewRound({...first,request_id:crypto.randomUUID(),protocol:{feature_id:'new-cycle'}}),/cannot be reset/);
 } finally {for(const key of keys)if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];fs.rmSync(dir,{recursive:true,force:true});}
});


test('authenticated phase-cycle issuance reads through feature-cycle classification without losing two-round accounting', () => {
 const repo=fs.mkdtempSync(path.join(os.tmpdir(),'review-historical-cycle-'));
 const keys=['SVC_EXTERNAL_REVIEW_PROVENANCE_FIXTURE','SVC_EXTERNAL_REVIEW_ISSUANCE_ROOT','SVC_REVIEW_EVIDENCE_STORE'];
 const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 process.env.SVC_EXTERNAL_REVIEW_PROVENANCE_FIXTURE='1';
 process.env.SVC_EXTERNAL_REVIEW_ISSUANCE_ROOT=path.join(repo,'.svc/authority');
 process.env.SVC_REVIEW_EVIDENCE_STORE=path.join(repo,'.svc/store');
 try {
  const wi='WI-HISTORICAL-PHASE';
  const base='b'.repeat(40);
  const make=(label,which=wi)=>createExternalReviewFixture({frameworkRoot,repo,wi:which,reviewKind:'plan',
   candidateDigestOverride:digest,preExecutionBaseOverride:base,roundLabel:label,launcherVersion:'2.5.3'});
  const first=make('first');
  const receiptBytes=fs.readFileSync(first.receiptPath);
  const receipt=JSON.parse(receiptBytes);
  const authority=process.env.SVC_EXTERNAL_REVIEW_ISSUANCE_ROOT;
  const markerPath=path.join(authority,'issuance',`${receipt.request_id}.json`);
  const classificationPath=path.join(authority,'classifications',`${receipt.request_id}.json`);
  const originalClassification=fs.readFileSync(classificationPath);
  const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:value&&typeof value==='object'?`{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`:JSON.stringify(value);
  const sign=body=>crypto.createHmac('sha256',fs.readFileSync(path.join(authority,'authority.key'))).update(canonical(body)).digest('hex');
  const marker=JSON.parse(fs.readFileSync(markerPath));
  delete marker.authority_hmac_sha256;
  marker.review_cycle_id=crypto.createHash('sha256').update(`external-review-cycle:v1:plan:${wi}:${base}:no-override`).digest('hex');
  delete marker.review_authority;
  fs.writeFileSync(markerPath,JSON.stringify({...marker,authority_hmac_sha256:sign(marker)}),{mode:0o600});
  const historicalMarkerBytes=fs.readFileSync(markerPath);
  const currentCycle=externalReviewCycleIdFromReceipt(receipt);
  assert.notEqual(marker.review_cycle_id,currentCycle);
  assert.equal(JSON.parse(originalClassification).review_cycle_id,currentCycle);
  const oldIndex=JSON.parse(originalClassification);
  delete oldIndex.authority_hmac_sha256;
  oldIndex.review_cycle_id=marker.review_cycle_id;
  fs.writeFileSync(classificationPath,JSON.stringify({...oldIndex,authority_hmac_sha256:sign(oldIndex)}),{mode:0o600});
  assert.equal(externalReviewCycleCapacity(receipt,{receiptPath:first.receiptPath}).issued,1);
  assert.deepEqual(listExternalReviewCycleProvenance({receiptPath:first.receiptPath,wi,reviewKind:'plan',cycleId:currentCycle}).map(r=>r.request_id),[receipt.request_id]);
  assert.deepEqual(fs.readFileSync(markerPath),historicalMarkerBytes);
  fs.unlinkSync(classificationPath);
  assert.equal(externalReviewCycleCapacity(receipt,{receiptPath:first.receiptPath}).issued,1);
  const rebuilt=JSON.parse(fs.readFileSync(classificationPath));
  const {authority_hmac_sha256:rebuiltTag,...rebuiltBody}=rebuilt;
  assert.equal(rebuiltTag,sign(rebuiltBody));
  assert.equal(rebuilt.review_cycle_id,currentCycle);
  assert.deepEqual(rebuilt,JSON.parse(originalClassification));
  assert.deepEqual(fs.readFileSync(markerPath),historicalMarkerBytes);

  assert.equal(externalReviewCycleCapacity(receipt,{receiptPath:first.receiptPath}).issued,1);
  assert.equal(listExternalReviewCycleProvenance({receiptPath:first.receiptPath,wi,reviewKind:'plan',cycleId:currentCycle}).length,1);
  const unrelated=make('unrelated','WI-UNRELATED');
  assert.equal(externalReviewCycleCapacity(JSON.parse(fs.readFileSync(unrelated.receiptPath)),{receiptPath:unrelated.receiptPath}).issued,1);
  const execSecond=createExternalReviewFixture({frameworkRoot,repo,wi,reviewKind:'exec',
    candidateDigestOverride:'e'.repeat(64),roundLabel:'exec-second'});
  const execReceipt=JSON.parse(fs.readFileSync(execSecond.receiptPath));
  assert.equal(externalReviewCycleIdFromReceipt(execReceipt),currentCycle);
  assert.deepEqual(listExternalReviewCycleProvenance({receiptPath:first.receiptPath,wi,reviewKind:'plan',cycleId:currentCycle})
    .map(r=>r.cycle_sequence),[1,2]);
  assert.equal(externalReviewCycleCapacity(receipt,{receiptPath:first.receiptPath}).issued,2);
  assert.equal(externalReviewCycleCapacity(receipt,{receiptPath:first.receiptPath}).allowed,false);
  assert.throws(()=>make('third'),/hard cap reached/);
  assert.deepEqual(fs.readFileSync(first.receiptPath),receiptBytes);
  assert.deepEqual(fs.readFileSync(markerPath),historicalMarkerBytes);
  assert.deepEqual(fs.readFileSync(classificationPath),originalClassification);
  const wrong=JSON.parse(originalClassification);delete wrong.authority_hmac_sha256;
  wrong.review_cycle_id='f'.repeat(64);
  fs.writeFileSync(classificationPath,JSON.stringify({...wrong,authority_hmac_sha256:sign(wrong)}),{mode:0o600});
  assert.throws(()=>externalReviewCycleCapacity(receipt,{receiptPath:first.receiptPath}),/classification conflicts with issuance marker/);
  fs.writeFileSync(classificationPath,originalClassification);
  for (const badGuard of [{...receipt.phase_guard,pre_execution_base:null}, {...receipt.phase_guard,override:{actual_sha256:'invalid'}}]) {
    const malformed={...receipt,phase_guard:badGuard};const bytes=Buffer.from(JSON.stringify(malformed));
    fs.writeFileSync(first.receiptPath,bytes,{mode:0o600});
    const malformedMarker={...marker,review_cycle_id:null,receipt_sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
    fs.writeFileSync(markerPath,JSON.stringify({...malformedMarker,authority_hmac_sha256:sign(malformedMarker)}),{mode:0o600});
    assert.throws(()=>externalReviewCycleCapacity(receipt,{receiptPath:first.receiptPath}),/classification conflicts with issuance marker/);
  }
 } finally {
  for(const k of keys)if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];
  fs.rmSync(repo,{recursive:true,force:true});
 }
});


test('missing signed phase-v1 receipt and CAS refuse opposite-phase admission before any second issuance', () => {
 const keys=['SVC_EXTERNAL_REVIEW_PROVENANCE_FIXTURE','SVC_EXTERNAL_REVIEW_ISSUANCE_ROOT','SVC_REVIEW_EVIDENCE_STORE'];
 const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try {
 for (const [legacyKind,incomingKind] of [['plan','exec'],['exec','plan']]) {
  const repo=fs.mkdtempSync(path.join(os.tmpdir(),`review-missing-${legacyKind}-`));
  process.env.SVC_EXTERNAL_REVIEW_PROVENANCE_FIXTURE='1';
  process.env.SVC_EXTERNAL_REVIEW_ISSUANCE_ROOT=path.join(repo,'.svc/authority');
  process.env.SVC_REVIEW_EVIDENCE_STORE=path.join(repo,'.svc/store');
  try {
   const wi=`WI-MISSING-${legacyKind.toUpperCase()}`,base='b'.repeat(40),authority=process.env.SVC_EXTERNAL_REVIEW_ISSUANCE_ROOT;
   const make=(label,kind,which,candidate)=>createExternalReviewFixture({frameworkRoot,repo,wi:which,reviewKind:kind,
    candidateDigestOverride:candidate.repeat(64),preExecutionBaseOverride:base,roundLabel:label,launcherVersion:'2.5.3'});
   const legacy=make('only-issued',legacyKind,wi,'a');
   const legacyReceipt=JSON.parse(fs.readFileSync(legacy.receiptPath));
   assert.equal(externalReviewCycleCapacity(legacyReceipt,{receiptPath:legacy.receiptPath}).issued,1);
   const markerPath=path.join(authority,'issuance',`${legacyReceipt.request_id}.json`);
   const classificationPath=path.join(authority,'classifications',`${legacyReceipt.request_id}.json`);
   const currentIndexBytes=fs.readFileSync(classificationPath);
   const marker=JSON.parse(fs.readFileSync(markerPath));delete marker.authority_hmac_sha256;
   const subject=legacyKind==='plan'?`${base}:no-override`:legacyReceipt.candidate_digest;
   marker.review_cycle_id=crypto.createHash('sha256').update(`external-review-cycle:v1:${legacyKind}:${wi}:${subject}`).digest('hex');
   delete marker.review_authority;
   const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:value&&typeof value==='object'?`{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`:JSON.stringify(value);
   const sign=body=>crypto.createHmac('sha256',fs.readFileSync(path.join(authority,'authority.key'))).update(canonical(body)).digest('hex');
   fs.writeFileSync(markerPath,JSON.stringify({...marker,authority_hmac_sha256:sign(marker)}),{mode:0o600});
   const signedOldMarker=fs.readFileSync(markerPath);
   const oldIndex=JSON.parse(currentIndexBytes);delete oldIndex.authority_hmac_sha256;
   oldIndex.review_cycle_id=marker.review_cycle_id;
   fs.writeFileSync(classificationPath,JSON.stringify({...oldIndex,authority_hmac_sha256:sign(oldIndex)}),{mode:0o600});
   const casPath=path.join(process.env.SVC_REVIEW_EVIDENCE_STORE,'objects',marker.receipt_sha256.slice(0,2),marker.receipt_sha256.slice(2));
   assert.ok(fs.existsSync(casPath),'the only issued receipt was retained in fixture CAS');
   fs.unlinkSync(legacy.receiptPath);fs.unlinkSync(casPath);
   const provisionalPath=path.join(repo,'.svc/provisional',`${incomingKind}.json`);
   fs.mkdirSync(path.dirname(provisionalPath),{recursive:true,mode:0o700});
   const provisional={...legacyReceipt,request_id:crypto.randomUUID(),review_kind:incomingKind,candidate_digest:'e'.repeat(64),
    phase_guard:{...legacyReceipt.phase_guard,kind:incomingKind,plan_manifest_sha256:incomingKind==='plan'?'e'.repeat(64):null},
    artifacts:{...legacyReceipt.artifacts,receipt:provisionalPath}};
   fs.writeFileSync(provisionalPath,JSON.stringify(provisional),{mode:0o600});
   const cycleId=externalReviewCycleIdFromReceipt(provisional);
   assert.notEqual(marker.review_cycle_id,cycleId);
   assert.equal(fs.readdirSync(path.join(authority,'issuance')).filter(n=>n.endsWith('.json')).length,1,
    'a modern second receipt cannot mask the missing-history undercount');
   assert.throws(()=>listExternalReviewCycleProvenance({receiptPath:provisionalPath,wi,reviewKind:incomingKind,cycleId,candidateDigests:[]}),
    /cycle receipt is unavailable or digest-mismatched/);
   assert.throws(()=>externalReviewCycleCapacity(provisional,{receiptPath:provisionalPath}),
    /cycle receipt is unavailable or digest-mismatched/);
   assert.throws(()=>reserveExternalReviewRound(provisional,{receiptPath:provisionalPath}),
    /cycle receipt is unavailable or digest-mismatched/);
   const rounds=path.join(authority,'rounds');
   assert.deepEqual(fs.existsSync(rounds)?fs.readdirSync(rounds):[],[],'refusal precedes any feature-round reservation');
   fs.unlinkSync(classificationPath);
   assert.throws(()=>issueExternalReviewProvenance({receiptPath:provisionalPath,
    packagePath:legacyReceipt.artifacts.package,findingsPath:legacyReceipt.artifacts.findings}),
    /legacy receipt is unavailable or digest-mismatched/,
    'issuer also refuses same-WI cross-phase missing history when no classification exists');
   assert.equal(fs.existsSync(path.join(authority,'issuance',`${provisional.request_id}.json`)),false,
    'refused issuer created no new signed marker');
   const unrelated=make('unrelated',incomingKind,'WI-GENUINELY-UNRELATED','c');
   const unrelatedReceipt=JSON.parse(fs.readFileSync(unrelated.receiptPath));
   assert.equal(externalReviewCycleCapacity(unrelatedReceipt,{receiptPath:unrelated.receiptPath}).issued,1,
    'consistent unrelated history remains admissible with missing index');
   fs.writeFileSync(classificationPath,JSON.stringify({...oldIndex,authority_hmac_sha256:sign(oldIndex)}),{mode:0o600});
   assert.equal(externalReviewCycleCapacity(unrelatedReceipt,{receiptPath:unrelated.receiptPath}).issued,1,
    'consistent unrelated history remains admissible with signed old index');
   fs.writeFileSync(classificationPath,currentIndexBytes,{mode:0o600});
   assert.throws(()=>externalReviewCycleCapacity(unrelatedReceipt,{receiptPath:unrelated.receiptPath}),
    /classification conflicts with issuance marker/,
    'unreconcilable old marker/current index fails even for an unrelated WI');
   assert.throws(()=>make('conflicted-index',incomingKind,'WI-ANOTHER-UNRELATED','d'),
    /classification conflicts with issuance marker/);
   assert.deepEqual(fs.readFileSync(markerPath),signedOldMarker,'signed historical marker remains byte-identical');
   assert.deepEqual(fs.existsSync(rounds)?fs.readdirSync(rounds):[],[],'neither direction created a reservation');
  } finally {fs.rmSync(repo,{recursive:true,force:true});}
 }
 } finally {
  for(const k of keys)if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];
 }
});
