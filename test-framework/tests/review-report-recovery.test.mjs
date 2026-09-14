import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { reportRepairKind, isIncompleteReviewReport, validateReportRepair, isZeroCallReviewReplay, hasNegativeReviewEvidence, remainingReportRepairBudget } from '../../scripts/lib/review-report-recovery.mjs';
import { createExternalReviewFixture } from '../evals/tier-1/fixtures/external-review-fixture.mjs';
import { issueExternalReviewProvenance, externalReviewCycleCapacity, verifyExternalReviewProvenance, listExternalReviewCycleProvenance, externalReviewCycleIdFromReceipt } from '../../scripts/lib/external-review-provenance.mjs';
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
  make('second');make('third');
  assert.equal(externalReviewCycleCapacity(r,{receiptPath:first.receiptPath}).allowed,false);
  assert.throws(()=>make('fourth'),/hard cap/);
  replay('replay-at-cap');
  assert.equal(externalReviewCycleCapacity(r,{receiptPath:first.receiptPath}).issued,3);
  const rows=listExternalReviewCycleProvenance({receiptPath:first.receiptPath,wi:'WI-REPLAY-TEST',reviewKind:r.review_kind,cycleId:externalReviewCycleIdFromReceipt(r)});
  assert.deepEqual(rows.map(row=>row.cycle_sequence),[1,2,3,4,5,6],'raw issuance order survives zero-call filtering');
  assert.deepEqual(rows.map(row=>row.counts_as_round),[true,false,false,true,true,false]);
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
