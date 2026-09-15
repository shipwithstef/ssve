import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {acTableSha256} from '../../scripts/lib/normalize-ac-table.mjs';
import {validatePlanBody, validatePlanSchema, parsePlanManifest} from '../../scripts/lib/plan-manifest-contract.mjs';
import {semanticContractDigest, createTransmutationSeal, verifyTransmutationSeal, verifyCandidatePackageBinding} from '../../scripts/lib/transmutation-seal.mjs';
import {assertCurrentIssuance, assertCurrentExecution, validateHistoricalFixture, readHistoricalReceipt, BOOTSTRAP_SNAPSHOT_SHA256} from '../../scripts/lib/receipt-issuance-epoch.mjs';
import {evaluateEligibility, evaluateCommittedEligibility, eligibilityDecisionDigest, persistOriginalInputs, canonicalJson, objectRef} from '../../scripts/lib/two-box-protocol.mjs';
import {putObject, getObject, repositoryIdentity} from '../../scripts/lib/review-evidence-store.mjs';
import {writeReceiptMirror} from '../../scripts/emit-receipt.mjs';
import {verifyCurrentPlanExecution, selectStageReceipt, verifyStageReceipt} from '../../scripts/stage-segment.mjs';
import {prepareReviewInputs} from '../../scripts/lib/review-inputs.mjs';
import {sessionId} from '../../hooks/lib/resolve-wi.mjs';
import {sessionShaped} from '../../hooks/lib/claim-owner.mjs';
import {processStartToken} from '../../hooks/lib/wi-claim.mjs';
import {classifyFromGit} from '../../scripts/classify-change-risk.mjs';
import {createExternalReviewFixture} from '../evals/tier-1/fixtures/external-review-fixture.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const spec='# Feature\n## Acceptance Criteria\n| ID | Requirement |\n|---|---|\n| AC-1 | Back and Clear must not re-arm an explicitly disabled Scouted choice. |\n| AC-2 | Check the fee and mutate the same profile row in the same transaction. |\n';
const readers={readSpec:()=>spec,readFile:()=>spec};
const sha=s=>createHash('sha256').update(s).digest('hex');
const dummy={type:'object',sha256:'a'.repeat(64)};
const dummyTree={type:'digest',of:'tree',sha256:'b'.repeat(64)};
const emit=path.join(root,'scripts/emit-receipt.mjs');
const prepare=path.join(root,'scripts/prepare-plan-handoff.mjs');
function v5Plan(mode='inline'){
 const body={receipt_type:'plan-manifest',schema_version:5,wi:'WI-DP-TEST',mode,scope:{included:['src/choice.mjs'],excluded:[]},dependencies:[],decision_trace:[],task_graph:[{id:'T1',files:['src/choice.mjs'],blocked_by:[],ac_ids:['AC-1','AC-2'],validation_ids:['V1'],context_refs:[]}],validation_plan:[{id:'V1',ac_ids:['AC-1','AC-2'],observation_kind:'unit',command:'node --test choice.test.mjs',expected_outcome:'manual intent and atomic transaction assertions pass',sufficiency:'Pure controller/transaction contract; native app observation remains a separate release obligation.'}],risk_rollback:{risks:['regressed manual choice'],rollback:'revert the candidate',verification:'re-run the unit proof'},timestamp:'2026-09-07T20:30:00Z',execution_command_sequence:[{step:1,producer:{artifact:'.svc/release.json',field:'sha',command:'node scripts/release-identity.mjs'},verifier:{command:'node scripts/verify-release.mjs',expected_outcome:'exact reviewed candidate'},consumer_skill:'land-changeset',expected_outcome:'existing adapter lands the verified candidate'}],ac_digests:{spec_path:'spec.md',spec_ac_table_sha256:acTableSha256(spec),entries:[{ac_id:'AC-1',digest:'manual choice'},{ac_id:'AC-2',digest:'atomic fee'}]},planning_contract:{kind:'lightweight',original_requirements_ref:dummy,eligibility_ref:{type:'object',sha256:'c'.repeat(64)},eligibility_tree:dummyTree},implementation_approach:[{id:'A1',requirement_ids:['AC-1','AC-2'],source_ids:['S1'],approach:'Keep the existing controller and transaction.',interfaces:'choice.mjs public exports stay the existing functions.',state_and_ownership:'The named profile row remains the only mutated record.',failure_and_recovery:'Abort the transaction and leave the row unchanged.',task_ids:['T1'],validation_ids:['V1']}],executor_discretion:{local_repairs:['Fix adjacent type errors in choice.mjs'],amendment_triggers:['A new original requirement appears'],disagreement_protocol:'Stop and return the exact conflict to planning.'}};
 if(mode==='dispatch') body.changeset_blueprints=[{file:'src/choice.mjs',action:'MODIFY',blueprint:'Preserve manual off and the atomic fee mutation.'}];
 return body;
}
function v4Plan(){
 return {receipt_type:'plan-manifest',schema_version:4,wi:'WI-DP-TEST',mode:'inline',scope:{included:['src/choice.mjs'],excluded:[]},dependencies:[],decision_trace:[],task_graph:[{id:'T1',files:['src/choice.mjs'],blocked_by:[],ac_ids:['AC-1','AC-2'],validation_ids:['V1'],context_refs:[]}],validation_plan:[{id:'V1',ac_ids:['AC-1','AC-2'],observation_kind:'unit',command:'node --test choice.test.mjs',expected_outcome:'manual intent and atomic transaction assertions pass',sufficiency:'Pure controller/transaction contract; native app observation remains a separate release obligation.'}],risk_rollback:{action:'revert the candidate'},timestamp:'2026-09-07T20:30:00Z',execution_command_sequence:[{step:1,producer:{artifact:'.svc/release.json',field:'sha',command:'node scripts/release-identity.mjs'},verifier:{command:'node scripts/verify-release.mjs',expected_outcome:'exact reviewed candidate'},consumer_skill:'land-changeset',expected_outcome:'existing adapter lands the verified candidate'}],ac_digests:{spec_path:'spec.md',spec_ac_table_sha256:acTableSha256(spec),entries:[{ac_id:'AC-1',digest:'manual choice'},{ac_id:'AC-2',digest:'atomic fee'}]}};
}
function v1Control(){
 return {receipt_type:'control-plan',schema_version:1,wi:'WI-410',blind_model:'offline-blind',framework_model:'offline-framework',profile:'svc-default',registry_version:'fixture',floor_verdict:'pass',element_ledger:{kept:['kept-element'],added:[],refined:[],removed:[],altered:[]},judge:{reviewer_host:'codex',reviewer_family:'openai',certifications:[{key:'k1',certified_strict_improvement:true,reviewer_family:'openai'}]},tree_hash:'c'.repeat(40),timestamp:'2026-09-07T20:30:00Z'};
}
function manifest(b){return '# Plan\n<!-- SVC_PLAN_BODY -->\n```json\n'+JSON.stringify(b,null,2)+'\n```\n<!-- /SVC_PLAN_BODY -->\n';}
function gitInit(dir){
 execFileSync('git',['init','-q',dir]);
 execFileSync('git',['-C',dir,'config','user.name','Fixture']);
 execFileSync('git',['-C',dir,'config','user.email','fixture@invalid']);
 execFileSync('git',['-C',dir,'config','core.hooksPath','/dev/null']);
}

test('semantic digest v5 inline and dispatch binds required fields and excludes only known metadata',()=>{
 for(const mode of ['inline','dispatch']){
  const body=v5Plan(mode);
  assert.equal(validatePlanSchema(body).ok,true,mode);
  assert.equal(validatePlanBody(body,readers).ok,true,mode);
  const base=semanticContractDigest(body);
  const meta=structuredClone(body);
  meta.timestamp='2099-01-01T00:00:00Z';meta.tree_hash='0'.repeat(40);meta.target_sha='1'.repeat(40);
  meta.planning_contract.sealed=true;meta.planning_contract.sealed_at='2099-01-01T00:00:00Z';meta.planning_contract.semantic_contract_sha256='f'.repeat(64);
  assert.equal(semanticContractDigest(meta),base);
  const order=structuredClone(body);order.implementation_approach[0].requirement_ids=['AC-2','AC-1'];
  assert.notEqual(semanticContractDigest(order),base);
  for(const mutate of [
   x=>{x.implementation_approach[0].approach='Different approach';},
   x=>{x.implementation_approach[0].interfaces='Different interface';},
   x=>{x.implementation_approach[0].failure_and_recovery='Different recovery';},
   x=>{x.implementation_approach[0].requirement_ids=['AC-1'];},
   x=>{x.implementation_approach[0].task_ids=['T1','T1'];},
   x=>{x.executor_discretion.local_repairs=['Different repair'];},
   x=>{x.validation_plan[0].expected_outcome='Different proof';},
   x=>{x.planning_contract.original_requirements_ref={type:'object',sha256:'d'.repeat(64)};},
  ]){
   const x=structuredClone(body);mutate(x);
   if(validatePlanSchema(x).ok) assert.notEqual(semanticContractDigest(x),base); else assert.throws(()=>semanticContractDigest(x),/v5 schema invalid/);
  }
  const unknown=structuredClone(body);unknown.ghost='no';
  assert.throws(()=>semanticContractDigest(unknown),/v5 schema invalid/);
  const deep=structuredClone(body);deep.implementation_approach[0].ghost='no';
  assert.throws(()=>semanticContractDigest(deep),/v5 schema invalid/);
 }
 assert.notEqual(semanticContractDigest(v5Plan('inline')),semanticContractDigest(v5Plan('dispatch')));
 assert.throws(()=>semanticContractDigest(v4Plan()),/schema_version 5|v5 schema/);
});

test('historical v1 fixture loader is non-executable; corrupt enum and missing judge fail',()=>{
 const body=v1Control();
 const got=validateHistoricalFixture({body,receiptType:'control-plan',evidence_class:'OFFLINE'});
 assert.equal(got.executable,false);assert.equal(got.kind,'fixture');assert.equal(got.schema_version,1);
 assert.throws(()=>validateHistoricalFixture({body,receiptType:'control-plan',evidence_class:'LIVE'}),/OFFLINE/);
 const badEnum=structuredClone(body);badEnum.floor_verdict='shipped';
 assert.throws(()=>validateHistoricalFixture({body:badEnum,receiptType:'control-plan',evidence_class:'OFFLINE'}));
 const missing=structuredClone(body);delete missing.judge;
 assert.throws(()=>validateHistoricalFixture({body:missing,receiptType:'control-plan',evidence_class:'OFFLINE'}));
});

test('historical branch loader reads synthetic temp-repo notes and stays non-executable',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'two-box-hist-'));
 try {
  gitInit(tmp);fs.writeFileSync(path.join(tmp,'seed.md'),'seed\n');
  execFileSync('git',['-C',tmp,'add','seed.md']);execFileSync('git',['-C',tmp,'commit','-qm','seed']);
  const commit=execFileSync('git',['-C',tmp,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const notePath=path.join(tmp,'note.json');fs.writeFileSync(notePath,JSON.stringify(v1Control()));
  execFileSync('git',['-C',tmp,'notes','--ref=svc-receipts','add','-F',notePath,commit]);
  const got=readHistoricalReceipt({consumerRoot:tmp,commitSha:commit,receiptType:'control-plan',wi:'WI-410'});
  assert.equal(got.executable,false);assert.equal(got.kind,'historical');assert.equal(got.body.floor_verdict,'pass');
 } finally {fs.rmSync(tmp,{recursive:true,force:true});}
});

test('actual emit CLI and writeReceiptMirror reject new v1/v3/v4 plan and v1 control issuance',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'two-box-emit-')),previous=process.cwd();
 try {
  gitInit(tmp);fs.writeFileSync(path.join(tmp,'spec.md'),spec);
  execFileSync('git',['-C',tmp,'add','spec.md']);execFileSync('git',['-C',tmp,'commit','-qm','seed']);
  process.chdir(tmp);
  const run=(body,type)=>{fs.writeFileSync('body.json',JSON.stringify(body));return spawnSync(process.execPath,[emit,'--type',type,'--wi',body.wi,'--body','body.json'],{cwd:tmp,encoding:'utf8'});};
  for(const [body,type] of [[v4Plan(),'plan-manifest'],[{...v4Plan(),schema_version:3},'plan-manifest'],[{...v4Plan(),schema_version:1},'plan-manifest'],[v1Control(),'control-plan']]){
   const r=run(body,type);assert.notEqual(r.status,0,r.stderr);
   assert.throws(()=>writeReceiptMirror({type,wi:body.wi,body}),/issuance|schema_version|bootstrap|LIVE|seal|current|v2/);
  }
 } finally {process.chdir(previous);fs.rmSync(tmp,{recursive:true,force:true});}
});

test('prepare --task and review inputs reject non-v5 current work; stage presence does not authorize',async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'two-box-prep-'));
 try {
  gitInit(tmp);fs.writeFileSync(path.join(tmp,'spec.md'),spec);fs.mkdirSync(path.join(tmp,'src'));fs.writeFileSync(path.join(tmp,'src/choice.mjs'),'export const actual = true;\n');
  fs.writeFileSync(path.join(tmp,'plan.md'),manifest(v4Plan()));fs.writeFileSync(path.join(tmp,'plan.json'),JSON.stringify(v4Plan()));
  fs.writeFileSync(path.join(tmp,'inputs.json'),JSON.stringify(['plan.md']));
  const task=spawnSync(process.execPath,[prepare,'--manifest','plan.md','--task','T1'],{cwd:tmp,encoding:'utf8'});
  assert.notEqual(task.status,0,task.stderr);
  assert.throws(()=>prepareReviewInputs(tmp,{planFile:'plan.json',contextFiles:'inputs.json',reviewKind:'plan'}),/bootstrap|issuance|schema_version|current|seal|execution|public root|WI mismatch/);
  execFileSync('git',['-C',tmp,'add','spec.md','src/choice.mjs']);execFileSync('git',['-C',tmp,'commit','-qm','seed']);
  const commit=execFileSync('git',['-C',tmp,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const notePath=path.join(tmp,'note.json');const slot=`slot::plan-manifest::WI-DP-TEST::${commit}`;fs.writeFileSync(notePath,JSON.stringify({[slot]:v4Plan(),digests:{'plan-manifest::WI-DP-TEST':sha(JSON.stringify(v4Plan()))}}));
  execFileSync('git',['-C',tmp,'notes','--ref=svc-receipts','add','-F',notePath,commit]);
  assert.equal(verifyStageReceipt(commit,'plan-manifest',tmp,'WI-DP-TEST').present,true);
  const mismatched=await verifyCurrentPlanExecution({sha:commit,repoRoot:tmp,body:{...v4Plan(),timestamp:'2099-01-01T00:00:00Z'}});
  assert.match(mismatched.reason,/supplied plan body differs/);
  const stage=await verifyCurrentPlanExecution({sha:commit,repoRoot:tmp});
  assert.equal(stage.present,true);assert.equal(stage.ok,false);assert.equal(stage.executable,false);
 } finally {fs.rmSync(tmp,{recursive:true,force:true});}
});

test('transmutation seal negatives use the actual module; mocked positive envelope is omitted',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'two-box-seal-'));
 try {
  gitInit(tmp);fs.writeFileSync(path.join(tmp,'spec.md'),spec);fs.mkdirSync(path.join(tmp,'src'));fs.writeFileSync(path.join(tmp,'src/choice.mjs'),'export const actual = true;\n');
  const body=v5Plan();const pretty=JSON.stringify(body,null,2);
  fs.writeFileSync(path.join(tmp,'plan.md'),manifest(body));
  assert.throws(()=>createTransmutationSeal({verified:true,consumerRoot:tmp,body,planBytes:Buffer.from(pretty),manifestPath:'plan.md',reviewReceiptRef:dummy}),/unsigned supplied verified/);
  assert.throws(()=>createTransmutationSeal({consumerRoot:tmp,body,planBytes:Buffer.from(JSON.stringify(body)),manifestPath:'plan.md',reviewReceiptRef:dummy}),/do not match prepared planBytes|SVC_PLAN_BODY/);
  assert.throws(()=>createTransmutationSeal({consumerRoot:tmp,body,planBytes:Buffer.from(pretty),manifestPath:'plan.md',reviewReceiptRef:{type:'digest',sha256:dummy.sha256,of:'bytes'}}),/ObjectRef/);
  assert.throws(()=>verifyTransmutationSeal({consumerRoot:tmp,body,planBytes:Buffer.from(pretty),manifestPath:'plan.md',sealRef:{type:'digest',sha256:dummy.sha256,of:'bytes'}}),/ObjectRef|sealRef/);
  const missing=putObject(Buffer.from(JSON.stringify({receipt_type:'review-plan',wi:body.wi,schema_version:3,verdict:'pass'})),{start:tmp});
  assert.throws(()=>createTransmutationSeal({consumerRoot:tmp,body,planBytes:Buffer.from(pretty),manifestPath:'plan.md',reviewReceiptRef:objectRef(missing.sha256)}),/reviewer evidence|launcher|failed|unsigned/);
  const unsigned=putObject(Buffer.from(JSON.stringify({receipt_type:'review-plan',wi:body.wi,verified:true})),{start:tmp});
  assert.throws(()=>createTransmutationSeal({consumerRoot:tmp,body,planBytes:Buffer.from(pretty),manifestPath:'plan.md',reviewReceiptRef:objectRef(unsigned.sha256)}),/unsigned supplied verified/);
  const wrongWi=putObject(Buffer.from(JSON.stringify({receipt_type:'review-plan',wi:'WI-OTHER',schema_version:3,verdict:'pass'})),{start:tmp});
  assert.throws(()=>createTransmutationSeal({consumerRoot:tmp,body,planBytes:Buffer.from(pretty),manifestPath:'plan.md',reviewReceiptRef:objectRef(wrongWi.sha256)}),/reviewer evidence|WI|launcher|failed/);
 } finally {fs.rmSync(tmp,{recursive:true,force:true});}
});

test('transmutation seal positive creation, verification, and committed replay with tree binding',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'two-box-seal-pos-'));
 const oldEnv={...process.env};
 try {
  gitInit(tmp);
  fs.writeFileSync(path.join(tmp,'spec.md'),spec);
  fs.mkdirSync(path.join(tmp,'src'));
  fs.writeFileSync(path.join(tmp,'src/choice.mjs'),'export const actual = true;\n');
  execFileSync('git',['-C',tmp,'add','spec.md','src/choice.mjs']);
  execFileSync('git',['-C',tmp,'commit','-qm','seed']);
  const candidateSha=execFileSync('git',['-C',tmp,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const tree=execFileSync('git',['-C',tmp,'rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim();
  const treeDigest=sha(`git-tree:${tree}\n`);

  const body=v5Plan('inline');
  const pretty=JSON.stringify(body,null,2);
  const planBytes=Buffer.from(pretty);
  const artifactSha=sha(planBytes);

  fs.writeFileSync(path.join(tmp,'plan.md'),manifest(body));
  const manifestBytes=fs.readFileSync(path.join(tmp,'plan.md'));
  const manifestSha=sha(manifestBytes);

  const candidateTreeBytes=Buffer.from(JSON.stringify({tree_hash:tree,candidate_digest:treeDigest})+'\n');
  const packageFiles=[
   {path:'artifact:plan.json',sha256:artifactSha,bytes:planBytes.length},
   {path:'plan.md',sha256:manifestSha,bytes:manifestBytes.length},
   {path:'candidate:git-tree',sha256:sha(candidateTreeBytes),bytes:candidateTreeBytes.length},
  ];

  const fixture=createExternalReviewFixture({
   frameworkRoot:root,
   repo:tmp,
   reviewKind:'plan',
   candidateDigestOverride:artifactSha,
   candidateSha,
   wi:body.wi,
   packageFilesOverride:packageFiles,
  });

  putObject(fs.readFileSync(fixture.receiptPath),{start:tmp});

  const reviewPlan={
   receipt_type:'review-plan',
   schema_version:3,
   wi:body.wi,
   candidate_digest:treeDigest,
   candidate_sha:candidateSha,
   tree_hash:tree,
   reviewed_plan_digest:artifactSha,
   self_review:{orchestrator:'codex',findings_count:0,notes:'self'},
   adversarial_review:{
    primary_reviewer_host:'agy',
    primary_used:true,
    fallback_host:'agy',
    fallback_used:false,
    findings:[],
    iteration_count:1,
   },
   verdict:'pass',
   timestamp:new Date().toISOString(),
   reviewer_evidence:fixture.reviewerEvidence,
  };

  const reviewPut=putObject(Buffer.from(JSON.stringify(reviewPlan)),{start:tmp});
  const reviewReceiptRef=objectRef(reviewPut.sha256);

  const sealRef=createTransmutationSeal({consumerRoot:tmp,body,planBytes,manifestPath:'plan.md',reviewReceiptRef});
  assert.ok(sealRef.sha256);

  const verified=verifyTransmutationSeal({consumerRoot:tmp,body,planBytes,manifestPath:'plan.md',sealRef});
  assert.equal(verified.wi,body.wi);
  assert.equal(verified.candidate.sha256,treeDigest);

  execFileSync('git',['-C',tmp,'add','plan.md']);
  execFileSync('git',['-C',tmp,'commit','-qm','commit plan']);
  const planCommit=execFileSync('git',['-C',tmp,'rev-parse','HEAD'],{encoding:'utf8'}).trim();

  const replayed=verifyTransmutationSeal({consumerRoot:tmp,body,planBytes,manifestPath:'plan.md',sealRef,candidateSha:planCommit});
  assert.equal(replayed.wi,body.wi);
  assert.equal(replayed.candidate.sha256,treeDigest);

  assert.throws(()=>verifyTransmutationSeal({consumerRoot:tmp,body:{...body,wi:'WI-TAMPER'},planBytes,manifestPath:'plan.md',sealRef,candidateSha:planCommit}));
 } finally {
  process.env=oldEnv;
  fs.rmSync(tmp,{recursive:true,force:true});
 }
});

test('LIVE classifier eligible fixture yields a complete v5 lightweight plan; unsigned issuance still rejects',(t)=>{
 const host=sessionId({},process.env).trim();
 if(host && !sessionShaped(host)){t.skip('host session identity is not session-shaped for claim attribution');return;}
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'two-box-elig-'));
 const previous=process.env.SVC_SESSION_ID;
 try {
  const token=sessionShaped(host)?host:'019f6001-5463-7dc0-a1f5-73104831606a';
  if(!host) process.env.SVC_SESSION_ID=token;
  gitInit(tmp);
  const real=fs.realpathSync(tmp);
  fs.writeFileSync(path.join(tmp,'.gitignore'),'.svc/\n');
  fs.mkdirSync(path.join(tmp,'docs/specs'),{recursive:true});fs.mkdirSync(path.join(tmp,'src'));
  fs.writeFileSync(path.join(tmp,'spec.md'),spec);fs.writeFileSync(path.join(tmp,'src/choice.mjs'),'export const actual = true;\n');
  fs.writeFileSync(path.join(tmp,'docs/specs/note.md'),'seed note\n');
  execFileSync('git',['-C',tmp,'add','spec.md','src/choice.mjs','docs/specs/note.md','.gitignore']);
  execFileSync('git',['-C',tmp,'commit','-qm','seed']);
  let branch=execFileSync('git',['-C',tmp,'branch','--show-current'],{encoding:'utf8'}).trim();
  if(!branch) branch=execFileSync('git',['-C',tmp,'symbolic-ref','--short','HEAD'],{encoding:'utf8'}).trim();
  fs.appendFileSync(path.join(tmp,'.git/info/exclude'),'.svc/bindings/\n.svc/claims/\n.svc/impact-triad/\n.svc/lane-tasks-WI-DP-TEST.json\n');
  fs.mkdirSync(path.join(tmp,'.svc/bindings'),{recursive:true});fs.mkdirSync(path.join(tmp,'.svc/claims'),{recursive:true});
  const graphPath=path.join(real,'.svc/lane-tasks-WI-DP-TEST.json');
  fs.writeFileSync(graphPath,JSON.stringify({wi:'WI-DP-TEST',lane:'framework',status:'in_progress',tasks:[{id:1,skill:'execute-changeset',metadata:{skill:'execute-changeset',wi:'WI-DP-TEST'},status:'in_progress',blocked_by:[],skill_receipt:{skill:'execute-changeset',loaded_at:'2026-09-07T20:30:00Z',loaded_via:'fixture'}}]}));
  const claimPath=path.join(real,'.svc/claims/WI-DP-TEST.claim.json');
  const now=new Date().toISOString();
  fs.writeFileSync(claimPath,JSON.stringify({schema_version:1,wi:'WI-DP-TEST',generation:1,repo_root:real,worktree_root:real,branch,session_id:token,role:'mutating',started_at:now,renewed_at:now,ttl_hours:24,hostname:os.hostname(),pid:process.pid,process_start_token:processStartToken(process.pid)}));
  fs.writeFileSync(path.join(tmp,'.svc/bindings/test.json'),JSON.stringify({schema_version:1,session_id:token,role:'mutating',wi:'WI-DP-TEST',repo_root:real,worktree_root:real,branch,claim_path:claimPath,created_at:now,updated_at:now,generation:1}));
  fs.appendFileSync(path.join(tmp,'docs/specs/note.md'),'eligible docs edit\n');
  execFileSync('git',['-C',tmp,'add','docs/specs/note.md']);
  const classified=classifyFromGit({cwd:tmp,staged:true});
  assert.equal(classified.tier,'cosmetic');
  fs.mkdirSync(path.join(tmp,'.svc/impact-triad/WI-DP-TEST'),{recursive:true});
  fs.writeFileSync(path.join(tmp,'.svc/impact-triad/WI-DP-TEST/task-1.json'),JSON.stringify({schema_version:1,wi:'WI-DP-TEST',session_id:token,worktree_root:real,task_graph:graphPath,task_id:1,diff_sha256:classified.sha256,risk_tier:classified.tier,risk_reasons:classified.reasons,breaks_what:{answer:'docs note copy',sources:['git diff --cached'],evidence:['two-box-receipts.test.mjs']},intended_behavior:{answer:'keep the existing choice contract',sources:['spec.md'],evidence:['AC-1']},product_surface:{answer:'headless eligibility fixture',sources:['scripts/quick-fix-eligibility.mjs'],evidence:['mechanical fixture']},coverage_tasks:[{id:'fixture',status:'completed',owner:'test',validation:'two-box-receipts.test.mjs'}],independent_review:{status:'n/a',executor_family:'n/a',reviewer_family:'n/a',artifacts:[]},runtime_proof:{status:'pass',kind:'static',artifacts:['docs/specs/note.md']},created_at:now}));
  const eligibility=evaluateEligibility({consumerRoot:tmp});
  assert.equal(eligibility.eligible,true);assert.equal(eligibility.evidence_class,'LIVE');
  fs.rmSync(path.join(tmp,'.svc/receipts'),{recursive:true,force:true});
  const persisted=persistOriginalInputs({originalRequirements:[{id:'AC-1'},{id:'AC-2'}],facts:{annotations:{change_archetype:'feature'}}},{start:tmp});
  const stored=putObject(Buffer.from(canonicalJson(eligibility),'utf8'),{start:tmp});
  const body=v5Plan('inline');
  body.scope.included=['docs/specs/note.md'];body.task_graph[0].files=['docs/specs/note.md'];
  body.planning_contract={kind:'lightweight',original_requirements_ref:persisted.original_requirements_ref,eligibility_ref:objectRef(stored.sha256),eligibility_tree:eligibility.staged_tree};
  assert.equal(validatePlanSchema(body).ok,true);
  assert.equal(validatePlanBody(body,readers).ok,true);
  fs.writeFileSync(path.join(tmp,'plan.md'),manifest(body));
  const planBytes=Buffer.from(JSON.stringify(body,null,2));
  assert.equal(JSON.stringify(parsePlanManifest(fs.readFileSync(path.join(tmp,'plan.md'),'utf8'))),JSON.stringify(body));
  const mismatchedScope=structuredClone(body);mismatchedScope.scope.included=['src/choice.mjs'];mismatchedScope.task_graph[0].files=['src/choice.mjs'];
  const localReaders={readSpec:p=>fs.readFileSync(path.join(tmp,p),'utf8'),readFile:p=>fs.readFileSync(path.join(tmp,p),'utf8'),consumerRoot:tmp};
  assert.match(validatePlanBody(mismatchedScope,localReaders).errors.join(';'),/scope differs/);
  const prepared=spawnSync(process.execPath,[prepare,'--manifest','plan.md','--write','--out','.svc/prepared.json'],{cwd:tmp,encoding:'utf8'});
  assert.equal(prepared.status,0,prepared.stderr);
  assert.deepEqual(fs.readFileSync(path.join(tmp,'.svc/prepared.json')),planBytes);
  const checked=spawnSync(process.execPath,[prepare,'--manifest','plan.md','--check'],{cwd:tmp,encoding:'utf8'});
  assert.equal(checked.status,0,checked.stderr);
  fs.writeFileSync(path.join(tmp,'inputs.json'),JSON.stringify(['plan.md']));
  const reviewed=prepareReviewInputs(tmp,{planFile:'.svc/prepared.json',contextFiles:'inputs.json',reviewKind:'plan'});
  assert.ok(reviewed.files.some(f=>f.label==='source:docs/specs/note.md'));
  const concurrent="import fs from 'node:fs';const read=fs.readFileSync;let fired=false;fs.readFileSync=function(p,...a){const out=read.call(this,p,...a);if(!fired&&String(p).endsWith('/plan.md')){fired=true;fs.appendFileSync(p,'\\nConcurrent edit.\\n');}return out;};";
  const raced=spawnSync(process.execPath,['--import','data:text/javascript,'+encodeURIComponent(concurrent),prepare,'--manifest','plan.md','--write','--out','.svc/prepared.json'],{cwd:tmp,encoding:'utf8'});
  assert.notEqual(raced.status,0);assert.match(raced.stderr,/manifest changed/);
  assert.deepEqual(fs.readFileSync(path.join(tmp,'.svc/prepared.json')),planBytes);

  assert.throws(()=>assertCurrentIssuance({consumerRoot:tmp,receiptType:'plan-manifest',body,planBytes,manifestPath:'plan.md'}),/seal|review|ObjectRef|issuance|current/);
  assert.throws(()=>assertCurrentExecution({consumerRoot:tmp,body,planBytes,manifestPath:'plan.md'}),/seal|review|ObjectRef|issuance|current/);
  const wrong=putObject(Buffer.from(canonicalJson({eligible:false,evidence_class:'LIVE',staged_tree:{type:'digest',of:'tree',sha256:'e'.repeat(64)},eligibility_output:{type:'object',sha256:'f'.repeat(64)}}),'utf8'),{start:tmp});
  const rejected=structuredClone(body);rejected.planning_contract.eligibility_ref=objectRef(wrong.sha256);
  assert.equal(validatePlanBody(rejected,{readSpec:p=>fs.readFileSync(path.join(tmp,p),'utf8'),readFile:p=>fs.readFileSync(path.join(tmp,p),'utf8'),consumerRoot:tmp}).ok,false);
  execFileSync('git',['-C',tmp,'commit','-qm','same eligible candidate']);
  const candidateSha=execFileSync('git',['-C',tmp,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const replay=evaluateCommittedEligibility({consumerRoot:tmp,candidateSha});
  assert.equal(replay.eligible,true);
  assert.equal(eligibilityDecisionDigest(replay,{consumerRoot:tmp}),eligibilityDecisionDigest(eligibility,{consumerRoot:tmp}));
  assert.throws(()=>evaluateCommittedEligibility({consumerRoot:tmp,candidateSha:'HEAD'}),/resolved/);
  assert.throws(()=>evaluateCommittedEligibility({consumerRoot:tmp,candidateSha:execFileSync('git',['-C',tmp,'rev-parse','HEAD^'],{encoding:'utf8'}).trim()}),/exactly one parent/);
  fs.appendFileSync(path.join(tmp,'docs/specs/note.md'),'later unrelated candidate\n');
  execFileSync('git',['-C',tmp,'add','docs/specs/note.md']);
  assert.equal(eligibilityDecisionDigest(evaluateCommittedEligibility({consumerRoot:tmp,candidateSha}),{consumerRoot:tmp}),eligibilityDecisionDigest(replay,{consumerRoot:tmp}));
  assert.throws(()=>assertCurrentExecution({consumerRoot:tmp,body,planBytes,manifestPath:'plan.md'}),/eligibility tree/);

 } finally {
  if(previous===undefined) delete process.env.SVC_SESSION_ID; else process.env.SVC_SESSION_ID=previous;
  fs.rmSync(tmp,{recursive:true,force:true});
 }
});

test('frozen bootstrap positive uses pinned snapshot CAS when present; tampered clones stay negative',(t)=>{
 const snapPath=path.join(root,'docs/specs/privacy/v4-bootstrap-snapshot.json');
 const bytes=fs.readFileSync(snapPath);
 assert.equal(sha(bytes),BOOTSTRAP_SNAPSHOT_SHA256);
 const snapshot=JSON.parse(bytes.toString('utf8'));
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'two-box-boot-'));
 try {
  gitInit(tmp);fs.writeFileSync(path.join(tmp,'plan.md'),manifest(v4Plan()));
  assert.throws(()=>assertCurrentExecution({consumerRoot:tmp,body:v4Plan(),planBytes:Buffer.from(JSON.stringify(v4Plan(),null,2)),manifestPath:'plan.md'}),/bootstrap|public root|identity|digest|issuance|current/);
  const clone=structuredClone(snapshot);clone.plan_body_sha256='0'.repeat(64);
  assert.notEqual(sha(JSON.stringify(clone)),BOOTSTRAP_SNAPSHOT_SHA256);
 } finally {fs.rmSync(tmp,{recursive:true,force:true});}
 let frozen;
 try {frozen=getObject(snapshot.reviewed_plan.sha256,{start:root});}
 catch(error){t.skip(`generic installed consumer has no actual bootstrap CAS: ${error.message}`);return;}
 const identity=repositoryIdentity(root);
 let roots=[];
 try {roots=execFileSync('git',['-C',identity.checkout,'rev-list','--max-parents=0','HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);}
 catch(error){t.skip(`trusted main worktree public root is not available: ${error.message}`);return;}
 if(!roots.includes(snapshot.public_root)){t.skip('trusted main worktree public root is not available in this checkout');return;}
 const repoId=sha(`${identity.gitCommonDir}\n${snapshot.public_root}\n`);
 if(repoId!==snapshot.consumer_repository_id){t.skip('trusted main worktree repository identity is not available in this checkout');return;}
 const body=JSON.parse(frozen.bytes.toString('utf8'));
 let evidence;
 try { evidence=assertCurrentExecution({consumerRoot:root,body,planBytes:frozen.bytes,manifestPath:'docs/plans/two-box-transmutation/manifest.md'}); }
 catch(error) { if(error.message.includes('external review authority key is missing')) { t.skip('hermetic consumer has no actual bootstrap verification key; separately verified in the source worktree'); return; } throw error; }
 assert.equal(evidence.executable,true);assert.equal(evidence.kind,'bootstrap_v4');
 const tampered=structuredClone(body);tampered.wi='WI-TAMPERED';
 assert.throws(()=>assertCurrentExecution({consumerRoot:root,body:tampered,planBytes:Buffer.from(JSON.stringify(tampered)),manifestPath:'docs/plans/two-box-transmutation/manifest.md'}));
});

// Pure binding mechanics only: these OFFLINE structures carry no authority.
test('OFFLINE signed-package shape binds a distinct Git-tree digest and rejects transplant',()=>{
 const tree='a'.repeat(40),digest=sha(`git-tree:${tree}\n`),review={tree_hash:tree,candidate_digest:digest};
 const bytes=Buffer.from(JSON.stringify(review)+'\n');
 const entry={path:'candidate:git-tree',sha256:sha(bytes),bytes:bytes.length};
 assert.equal(verifyCandidatePackageBinding(review,[entry]),digest);
 assert.throws(()=>verifyCandidatePackageBinding(review,[]),/signed package/);
 assert.throws(()=>verifyCandidatePackageBinding(review,[entry,entry]),/signed package/);
 assert.throws(()=>verifyCandidatePackageBinding({...review,tree_hash:'b'.repeat(40),candidate_digest:sha(`git-tree:${'b'.repeat(40)}\n`)},[entry]),/signed package/);
 assert.throws(()=>verifyCandidatePackageBinding({candidate_digest:sha('plan bytes')},[entry]),/tree_hash/);
});

test('canonical stage slots select WI and SHA, reject ambiguity, aliases, and altered bytes',()=>{
 const candidate='a'.repeat(40),body=v4Plan(),other={...body,wi:'WI-OTHER'};
 const slot=b=>`slot::plan-manifest::${b.wi}::${candidate}`;
 const envelope={[slot(body)]:body,[slot(other)]:other,digests:{'plan-manifest::WI-DP-TEST':sha(JSON.stringify(body)),'plan-manifest::WI-OTHER':sha(JSON.stringify(other))}};
 assert.deepEqual(selectStageReceipt(envelope,{sha:candidate,expectedType:'plan-manifest',wi:body.wi}),body);
 assert.throws(()=>selectStageReceipt(envelope,{sha:candidate,expectedType:'plan-manifest'}),/ambiguous/);
 assert.throws(()=>selectStageReceipt(envelope,{sha:'b'.repeat(40),expectedType:'plan-manifest',wi:body.wi}),/identity/);
 assert.throws(()=>selectStageReceipt(envelope,{sha:candidate,expectedType:'plan-manifest',wi:'WI-MISSING'}),/missing/);
 assert.throws(()=>selectStageReceipt({...envelope,'plan-manifest':{...body,timestamp:'changed'}},{sha:candidate,expectedType:'plan-manifest',wi:body.wi}),/ambiguous/);
 assert.throws(()=>selectStageReceipt({...envelope,digests:{}},{sha:candidate,expectedType:'plan-manifest',wi:body.wi}),/digest/);
});
