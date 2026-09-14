import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {acTableSha256} from '../../scripts/lib/normalize-ac-table.mjs';
import {parsePlanManifest, validatePlanBody, projectPlanViews, taskContext, packageCapabilities, containedReader} from '../../scripts/lib/plan-manifest-contract.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const hash=s=>createHash('sha256').update(s).digest('hex');
const spec='# Feature\n## Acceptance Criteria\n| ID | Requirement |\n|---|---|\n| AC-1 | Back and Clear must not re-arm an explicitly disabled Scouted choice. |\n| AC-2 | Check the fee and mutate the same profile row in the same transaction. |\n';
const fixture=()=>({receipt_type:'plan-manifest',schema_version:4,wi:'WI-DP-TEST',mode:'inline',scope:{included:['src/choice.mjs'],excluded:[]},dependencies:[],decision_trace:[],task_graph:[{id:'T1',files:['src/choice.mjs'],blocked_by:[],ac_ids:['AC-1','AC-2'],validation_ids:['V1'],context_refs:[]}],validation_plan:[{id:'V1',ac_ids:['AC-1','AC-2'],observation_kind:'unit',command:'node --test choice.test.mjs',expected_outcome:'manual intent and atomic transaction assertions pass',sufficiency:'Pure controller/transaction contract; native app observation remains a separate release obligation.'}],risk_rollback:{action:'revert the candidate'},timestamp:'2026-09-07T20:30:00Z',execution_command_sequence:[{step:1,producer:{artifact:'.svc/release.json',field:'sha',command:'node scripts/release-identity.mjs'},verifier:{command:'node scripts/verify-release.mjs',expected_outcome:'exact reviewed candidate'},consumer_skill:'land-changeset',expected_outcome:'existing adapter lands the verified candidate'}],ac_digests:{spec_path:'spec.md',spec_ac_table_sha256:acTableSha256(spec),entries:[{ac_id:'AC-1',digest:'manual choice'},{ac_id:'AC-2',digest:'atomic fee'}]}});
const readers={readSpec:()=>spec,readFile:()=>spec};
const manifest=b=>'# Plan\n<!-- SVC_PLAN_BODY -->\n```json\n'+JSON.stringify(b,null,2)+'\n```\n<!-- /SVC_PLAN_BODY -->\n';

test('paired same-input replay preserves the original manual-choice and transaction requirements',()=>{
 const b=fixture(); assert.equal(validatePlanBody(b,readers).ok,true);
 const legacyPacket=spec+'\nComplete implementation packet';
 const inlinePacket=taskContext(b,'T1',readers);
 for(const clause of ['Back and Clear must not re-arm','same profile row in the same transaction']) {
  assert.ok(legacyPacket.includes(clause));assert.ok(inlinePacket.includes(clause));
 }
 assert.ok(inlinePacket.includes(spec.split('## Acceptance Criteria\n')[1].trim()));
 assert.ok(inlinePacket.includes('src/choice.mjs'));
 assert.equal(JSON.stringify(parsePlanManifest(manifest(b))),JSON.stringify(b));
 assert.equal(projectPlanViews(b,readers),projectPlanViews(b,readers));
});

test('reject ambiguous markers, malformed release entries, cycles and lost coverage',()=>{
 const b=fixture();assert.throws(()=>parsePlanManifest(manifest(b)+manifest(b)),/one|duplicate/i);
 assert.throws(()=>parsePlanManifest(manifest(b).replace('<!-- /SVC_PLAN_BODY -->','')));
 const mutations=[x=>x.mode='dispatch',x=>x.schema_version=5,x=>x.execution_command_sequence[0].command='echo bypass',x=>x.execution_command_sequence[0].consumer_skill='execute-changeset',x=>x.execution_command_sequence[0].producer_task=1,x=>x.task_graph[0].blocked_by=['T1'],x=>x.task_graph[0].ac_ids=['AC-1'],x=>x.task_graph[0].validation_ids=['missing'],x=>x.validation_plan[0].ac_ids=['AC-1'],x=>x.task_graph[0].files=['../escape'],x=>x.ac_digests.entries.pop(),x=>x.scope.included.push('../escape'),x=>x.scope.included.push('/absolute'),x=>x.scope.included.push('src/*'),x=>x.scope.included.push('unused.mjs'),x=>x.execution_command_sequence[0].producer.field='foo.bar',x=>x.execution_command_sequence[0].producer.field='sha; id'];
 for(const mutate of mutations){const x=structuredClone(b);mutate(x);assert.equal(validatePlanBody(x,readers).ok,false,JSON.stringify(x));}
});

test('requirement and same-line context drift fail instead of silently regenerating',()=>{
 const b=fixture();b.task_graph[0].context_refs=[{path:'ux.md',start_line:1,end_line:1,excerpt_sha256:hash('Manual off survives Back.')}];
 const readFile=()=> 'Manual off survives Back.\n';
 assert.ok(taskContext(b,'T1',{...readers,readFile}).includes('Manual off survives Back.'));
 assert.throws(()=>taskContext(b,'T1',{...readers,readFile:()=> 'Back re-arms auto.\n'}),/stale|hash/i);
 assert.equal(validatePlanBody(b,{readSpec:()=>spec.replace('must not re-arm','may re-arm')}).ok,false);
});

test('contained reads reject escaping symlinks and capabilities reject mixed consumers',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'delivery-cap-'));
 try {
  fs.mkdirSync(path.join(tmp,'repo'));fs.writeFileSync(path.join(tmp,'outside'),'private');fs.symlinkSync('../outside',path.join(tmp,'repo/link'));
  assert.throws(()=>containedReader(path.join(tmp,'repo'))('link'),/escape|outside/i);
  const cap=packageCapabilities(root);assert.deepEqual(cap.issuance_versions,[4]);assert.equal(cap.files.length,5);
  for(const f of cap.files){fs.mkdirSync(path.dirname(path.join(tmp,'repo',f.path)),{recursive:true});fs.copyFileSync(path.join(root,f.path),path.join(tmp,'repo',f.path));}
  fs.writeFileSync(path.join(tmp,'repo/scripts/check-chain-receipts.mjs'),'// old checker');
  assert.throws(()=>packageCapabilities(path.join(tmp,'repo')),/support|version|consumer/i);
 } finally {fs.rmSync(tmp,{recursive:true,force:true});}
});

test('actual preparation CLI preserves prose and rejects a stale generated view',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'delivery-handoff-'));
 try {
  execFileSync('git',['init','-q',tmp]);fs.writeFileSync(path.join(tmp,'.gitignore'),'.svc/external-review-artifacts/\n');fs.writeFileSync(path.join(tmp,'spec.md'),spec);fs.writeFileSync(path.join(tmp,'plan.md'),manifest(fixture())+'\nOwner prose stays byte-identical.\n## Prerequisite Alignment Matrix\n| Task | Source |\n|---|---|\n| T1 | spec.md |\n');
  const run=args=>spawnSync(process.execPath,[path.join(root,'scripts/prepare-plan-handoff.mjs'),'--manifest','plan.md',...args],{cwd:tmp,encoding:'utf8'});
  let r=run(['--write','--out','.svc/external-review-artifacts/plan-handoff/body.json']);assert.equal(r.status,0,r.stderr);
  assert.equal(run(['--check']).status,0);
  const mechanical=spawnSync('bash',[path.join(root,'scripts/verify-plan-mechanical.sh'),path.join(tmp,'plan.md'),tmp,'--phase','plan'],{cwd:tmp,encoding:'utf8'});assert.equal(mechanical.status,0,mechanical.stdout+mechanical.stderr);
  assert.ok(fs.readFileSync(path.join(tmp,'plan.md'),'utf8').includes('Owner prose stays byte-identical.'));
  fs.appendFileSync(path.join(tmp,'spec.md'),'| AC-3 | Never fabricate native proof. |\n');assert.notEqual(run(['--check']).status,0);
 } finally {fs.rmSync(tmp,{recursive:true,force:true});}
});

export {fixture, spec};

test('actual schema, emitter and checker agree; checker reads the Git candidate rather than working ACs',async()=>{
 const {writeReceiptMirror}=await import('../../scripts/emit-receipt.mjs');
 const {validateReceipt}=await import('../../scripts/check-chain-receipts.mjs');
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'delivery-receipt-')),previous=process.cwd();
 try {
  execFileSync('git',['init','-q',tmp]);fs.writeFileSync(path.join(tmp,'spec.md'),spec);
  execFileSync('git',['-C',tmp,'add','spec.md']);execFileSync('git',['-C',tmp,'-c','user.name=Fixture','-c','user.email=fixture@invalid','-c','core.hooksPath=/dev/null','commit','-qm','fixture']);
  const candidate=execFileSync('git',['-C',tmp,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
  assert.deepEqual(execFileSync('git',['-C',tmp,'ls-tree','--name-only',candidate],{encoding:'utf8'}).trim().split('\n'),['spec.md'],'product candidates do not vendor the installed framework package');
  process.chdir(tmp);const b=fixture();
  const emitted=writeReceiptMirror({type:'plan-manifest',wi:b.wi,body:b,targetShaOverride:candidate});assert.ok(fs.existsSync(emitted.mirror_path));
  assert.equal(validateReceipt('plan-manifest',b,candidate).valid,true);
  fs.writeFileSync('spec.md',spec.replace('must not re-arm','may re-arm'));
  assert.equal(validateReceipt('plan-manifest',b,candidate).valid,true,'candidate read must ignore changed cwd spec');
  assert.ok(writeReceiptMirror({type:'plan-manifest',wi:b.wi,body:b}),'unstaged drift must not change a valid index candidate');
  execFileSync('git',['add','spec.md']);
  assert.throws(()=>writeReceiptMirror({type:'plan-manifest',wi:b.wi,body:b}),/stale/,'staged drift must reject the old body');
  fs.writeFileSync('spec.md',spec); // Good working bytes cannot certify the wrong index.
  assert.throws(()=>writeReceiptMirror({type:'plan-manifest',wi:b.wi,body:b}),/stale/);
  const revisedSpec=spec.replace('must not re-arm','may re-arm'),revised=fixture();
  revised.ac_digests.spec_ac_table_sha256=acTableSha256(revisedSpec);
  fs.writeFileSync('spec.md',revisedSpec);fs.writeFileSync('ux.md','Preserve manual selection.');
  revised.task_graph[0].context_refs=[{path:'ux.md',start_line:1,end_line:1,excerpt_sha256:hash('Preserve manual selection.')}];
  fs.writeFileSync('plan.md',manifest(revised));execFileSync('git',['add','spec.md','ux.md','plan.md']);
  fs.writeFileSync('body.json',JSON.stringify(revised));
  const cliArgs=[path.join(root,'scripts/emit-receipt.mjs'),'--type','plan-manifest','--wi',revised.wi,'--body','body.json'];
  const cli=spawnSync(process.execPath,cliArgs,{cwd:tmp,encoding:'utf8'});assert.equal(cli.status,0,cli.stdout+cli.stderr);
  const result=JSON.parse(cli.stdout),stagedTree=execFileSync('git',['write-tree'],{encoding:'utf8'}).trim();
  assert.equal(result.staging,true);assert.ok(result.mirror_path.includes('/staging/'+stagedTree+'/'));
  const wrongTarget=spawnSync(process.execPath,[...cliArgs,'--sha',candidate],{cwd:tmp,encoding:'utf8'});
  assert.notEqual(wrongTarget.status,0,'prior HEAD cannot certify new staged AC/context');assert.match(wrongTarget.stderr,/stale|cannot read/i);
  const bad=fixture();bad.task_graph[0].context_refs=[{path:'ux.md',start_line:1,end_line:0,excerpt_sha256:'a'.repeat(64)}];
  assert.equal(validateReceipt('plan-manifest',bad,candidate).valid,false);
  assert.throws(()=>writeReceiptMirror({type:'plan-manifest',wi:b.wi,body:bad,targetShaOverride:candidate}));
  const python=spawnSync('python3',['-c','import json,sys,jsonschema; s=json.load(open(sys.argv[1])); cases=json.load(sys.stdin); v=jsonschema.Draft7Validator(s); print(json.dumps([v.is_valid(x) for x in cases]))',path.join(root,'schemas/receipts/plan-manifest.schema.json')],{input:JSON.stringify([b,bad]),encoding:'utf8'});
  assert.equal(python.status,0,python.stderr);assert.deepEqual(JSON.parse(python.stdout),[true,false]);
 } finally {process.chdir(previous);fs.rmSync(tmp,{recursive:true,force:true});}
});

test('handoff emits the same source snapshot it validated',()=>{
 let reads=0;const packet=taskContext(fixture(),'T1',{readSpec:()=>++reads===1?spec:spec.replace('must not re-arm','may re-arm')});
 assert.ok(packet.includes('must not re-arm'));assert.equal(reads,1);
});

test('failed concurrent projection preserves prior output and the intervening author edit',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'delivery-projection-race-'));
 try {
  execFileSync('git',['init','-q',tmp]);fs.mkdirSync(path.join(tmp,'.svc'));fs.writeFileSync(path.join(tmp,'.gitignore'),'.svc/\n');fs.writeFileSync(path.join(tmp,'spec.md'),spec);fs.writeFileSync(path.join(tmp,'plan.md'),manifest(fixture()));fs.writeFileSync(path.join(tmp,'.svc/body.json'),'prior output');
  const inject="import fs from 'node:fs';const read=fs.readFileSync;let fired=false;fs.readFileSync=function(p,...a){const result=read.call(this,p,...a);if(!fired&&String(p).endsWith('/plan.md')){fired=true;fs.appendFileSync(p,'\\nConcurrent author edit.\\n');}return result;};";
  const r=spawnSync(process.execPath,['--import','data:text/javascript,'+encodeURIComponent(inject),path.join(root,'scripts/prepare-plan-handoff.mjs'),'--manifest','plan.md','--write','--out','.svc/body.json'],{cwd:tmp,encoding:'utf8'});
  assert.notEqual(r.status,0);assert.match(r.stderr,/manifest changed/);assert.equal(fs.readFileSync(path.join(tmp,'.svc/body.json'),'utf8'),'prior output');assert.ok(fs.readFileSync(path.join(tmp,'plan.md'),'utf8').includes('Concurrent author edit.'));
 } finally {fs.rmSync(tmp,{recursive:true,force:true});}
});


test('review preflight validates the actual schema and includes declared source before dispatch', async () => {
 const {prepareReviewInputs}=await import('../../scripts/lib/review-inputs.mjs');
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'review-inputs-'));
 try {
  fs.writeFileSync(path.join(tmp,'spec.md'),spec);fs.mkdirSync(path.join(tmp,'src'));fs.writeFileSync(path.join(tmp,'src/choice.mjs'),'export const actual = true;');
  const write=b=>fs.writeFileSync(path.join(tmp,'plan.json'),JSON.stringify(b));write(fixture());
  assert.throws(()=>prepareReviewInputs(tmp,{planFile:'plan.json',reviewKind:'exec'}),/not staged/);
  execFileSync('git',['init','-q',tmp]);
  execFileSync('git',['-C',tmp,'add','src/choice.mjs']);
  const prepared=prepareReviewInputs(tmp,{planFile:'plan.json',reviewKind:'exec'});
  assert.ok(prepared.files.some(f=>f.label==='source:src/choice.mjs'&&f.bytes.toString().includes('actual')));
  fs.writeFileSync(path.join(tmp,'src/choice.mjs'),'export const actual = false;');
  assert.throws(()=>prepareReviewInputs(tmp,{planFile:'plan.json',reviewKind:'exec'}),/differs from staged/);
  fs.writeFileSync(path.join(tmp,'src/choice.mjs'),'export const actual = true;');
  const invalid=fixture();invalid.validation_plan[0].named_case='not a schema field';write(invalid);
  assert.throws(()=>prepareReviewInputs(tmp,{planFile:'plan.json'}),/unexpected named_case/);
  const artifacts=path.join(tmp,'must-not-be-created');
  const bad=spawnSync(process.execPath,[path.join(root,'scripts/run-external-review.mjs'),'--preflight','--plan-file','plan.json','--review-kind','plan','--orchestrator','codex','--context-root',tmp,'--artifacts-dir',artifacts],{input:'review',encoding:'utf8'});
  assert.notEqual(bad.status,0);assert.match(bad.stderr,/unexpected named_case/);assert.equal(fs.existsSync(artifacts),false);
  const missing=fixture();missing.dependencies=[{artifact:'absent.mjs',citation:'absent.mjs:1'}];write(missing);assert.throws(()=>prepareReviewInputs(tmp,{planFile:'plan.json'}),/ENOENT/);
  write(fixture());fs.unlinkSync(path.join(tmp,'src/choice.mjs'));assert.doesNotThrow(()=>prepareReviewInputs(tmp,{planFile:'plan.json',reviewKind:'plan'}));assert.throws(()=>prepareReviewInputs(tmp,{planFile:'plan.json',reviewKind:'exec'}),/Missing executed/);
  fs.writeFileSync(path.join(tmp,'inputs.json'),JSON.stringify(['../outside']));assert.throws(()=>prepareReviewInputs(tmp,{contextFiles:'inputs.json'}),/repository-relative/);
  fs.writeFileSync(path.join(tmp,'.env'),'secret');fs.writeFileSync(path.join(tmp,'inputs.json'),JSON.stringify(['.env']));assert.throws(()=>prepareReviewInputs(tmp,{contextFiles:'inputs.json'}),/Private environment/);
 } finally {fs.rmSync(tmp,{recursive:true,force:true});}
});
