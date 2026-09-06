import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { classifyProviderFailure } from '../../scripts/run-external-review.mjs';
import { createReviewerPolicy, validateReviewerPolicy } from '../../scripts/review-topology-v2.mjs';
import { reviewerAvailability, recordReviewerFailure } from '../../scripts/lib/reviewer-resources.mjs';
const tuple = { host:'cursor', family:'xai', model:'cursor-grok-4.6-high', effort:'high' };
const input = () => ({orchestrator:'codex',self:{host:'current',family:'openai',model:'gpt-6-astra',effort:'medium'},advisories:[{id:'sol',kind:'subagent',required:true,authority:'advisory',tuple:{host:'codex',family:'openai',model:'gpt-5.6-sol',effort:'high'}}],reviewer:{id:'cursor',kind:'external',required:true,authority:'independent',identity_requirement:'requested_accepted',tuple:{...tuple}}});
test('builder supplies valid self-first phases and permits only exact Cursor opt-in',()=>{
 const policy=createReviewerPolicy(input());
 for(const phase of ['plan','exec']) { const stations=policy.modes.production.orchestrators.codex[phase].stations; assert.equal(stations[0].kind,'inline-self');assert.equal(stations[1].id,'sol');assert.equal(stations[1].required,true);assert.equal(stations[1].authority,'advisory'); }
 for(const [key,value] of [['family','openai'],['model','cursor-auto'],['effort','medium']]) {const i=input();i.reviewer.tuple[key]=value;assert.throws(()=>createReviewerPolicy(i));}
 const missing=input();delete missing.reviewer.identity_requirement;assert.throws(()=>createReviewerPolicy(missing));
 policy.modes.production.orchestrators.codex.plan.stations.shift();assert.throws(()=>validateReviewerPolicy(policy),/self-review/);
});
for(const [message,classification] of [['Not logged in · Please run /login','authentication'],['Quota exhausted','shared_quota'],['Not entitled to use the requested model','model_entitlement'],['Provider overloaded','provider_overload'],['Network error','network'],['Invalid configuration value','config_invalid']]) test(`terminal ${classification} and quoted successful output`,()=>{
 assert.equal(classifyProviderFailure(JSON.stringify({type:'result',is_error:true,result:message}),'',false),classification);
 assert.equal(classifyProviderFailure(JSON.stringify({type:'result',subtype:'success',is_error:false,result:`Quoted: ${message}`}),'',false),'unknown_provider');
});
test('structured codes remain compatible; genuine unspecified review failure stays unknown',()=>{
 assert.equal(classifyProviderFailure('{"error":{"code":"provider_overload"}}','',false),'provider_overload');
 assert.equal(classifyProviderFailure('{"type":"result","is_error":true,"result":"Review found a defect"}','',false),'unknown_provider');
});
test('pool suppression, precedence, unknown balances and owner provenance',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'svc-resources-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const resource={routes:[{...tuple,pool_id:'cursor-subscription'},{host:'cursor',model:'second',pool_id:'cursor-subscription'},{host:'grok',model:'grok-4.6',pool_id:'standalone'}],observations:{'cursor-subscription':{status:'unknown',observed_at:'2026-09-06T00:00:00Z',remaining:null},standalone:{status:'unavailable',classification:'shared_quota',observed_at:'2026-09-06T00:00:00Z',remaining:null}}};
 const ctx={configPath:path.join(dir,'policy.json'),policySha256:'a'.repeat(64),resource,tuple,now:Date.parse('2026-09-06T01:00:00Z')};
 assert.equal(reviewerAvailability(ctx).allowed,true);
 assert.equal(reviewerAvailability({...ctx,tuple:{host:'claude',model:'opus'}}).allowed,false);
 assert.equal(reviewerAvailability({...ctx,tuple:{host:'grok',model:'grok-4.6'}}).allowed,false);
 recordReviewerFailure({...ctx,classification:'shared_quota'});assert.equal(reviewerAvailability(ctx).allowed,false);
 assert.equal(reviewerAvailability({...ctx,policySha256:'b'.repeat(64),tuple:{host:'cursor',model:'second'}}).allowed,false);
 resource.observations['cursor-subscription']={status:'available',observed_at:'2026-09-06T01:00:00Z'};
 assert.equal(reviewerAvailability(ctx).allowed,false);
 resource.observations['cursor-subscription'].observed_at='2026-09-06T01:00:01Z';assert.equal(reviewerAvailability(ctx).allowed,true);assert.equal(reviewerAvailability(ctx).remaining,null);
 recordReviewerFailure({...ctx,now:ctx.now+2000,classification:'authentication',retryAfter:'2026-09-06T02:00:00Z'});
 assert.equal(reviewerAvailability({...ctx,now:Date.parse('2026-09-06T02:00:00Z')}).status,'unknown');
 const file=ctx.configPath+'.resources.json';const state=JSON.parse(fs.readFileSync(file));state.failures['cursor-subscription'].source='owner';state.failures['cursor-subscription'].status='available';fs.writeFileSync(file,JSON.stringify(state));assert.throws(()=>reviewerAvailability(ctx),/only classified invocation failures/);
});

test('governed launcher classifies code-zero auth and suppresses repeat before all spawns', async t=>{
 const {execFileSync,spawnSync,spawn}=await import('node:child_process');
 const root=path.resolve(import.meta.dirname,'../..');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'svc-launch-resource-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 execFileSync('git',['init','-q',dir]);fs.writeFileSync(path.join(dir,'AGENTS.md'),'Read-only fixture review.');
 const binary=path.join(dir,'cursor-agent');const calls=path.join(dir,'calls');
 fs.writeFileSync(binary,`#!/usr/bin/env node\nconst fs=require('node:fs');fs.appendFileSync(${JSON.stringify(calls)},JSON.stringify(process.argv.slice(2))+'\\n');if(process.argv.includes('--help'))console.log('--print --output-format --mode --model --sandbox --workspace --trust');else if(process.argv.includes('--version'))console.log('2026.08.25-fixture');else {fs.readFileSync(0);console.log(JSON.stringify({subtype:'error',is_error:true,result:'Not logged in · Please run /login'}));}\n`,{mode:0o700});
 const builder=input();builder.resource_policy={routes:[{...tuple,pool_id:'cursor'}],observations:{cursor:{status:'unknown',observed_at:'2026-01-01T00:00:00Z',remaining:null}}};
 const config=path.join(dir,'policy.json');fs.writeFileSync(config,JSON.stringify(createReviewerPolicy(builder)),{mode:0o600});
 const env={...Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith("SVC_EXTERNAL_REVIEW_") && !key.startsWith("SVC_FAKE_"))),SVC_EXTERNAL_REVIEW_FIXTURE:'1',SVC_EXTERNAL_REVIEW_FIXTURE_ROOT:dir,SVC_EXTERNAL_REVIEW_POLICY_DIR:path.join(dir,'selection'),SVC_EXTERNAL_REVIEW_CURSOR_BIN:binary,SVC_EXTERNAL_REVIEW_CACHE_DIR:path.join(dir,'cache'),SVC_EXTERNAL_REVIEW_TIMEOUT_SECONDS:'10',SVC_EXTERNAL_REVIEW_LOCK_STALE_SECONDS:'90'};
 const run=n=>{const output=path.join(dir,`out-${n}`);const result=spawnSync('node',[path.join(root,'scripts/run-external-review.mjs'),'--orchestrator','codex','--review-kind','generic','--candidate-digest','a'.repeat(64),'--context-root',dir,'--reviewer-config',config,'--reviewer-phase','exec','--reviewer-station','cursor','--artifacts-dir',output],{env,cwd:dir,input:'candidate_digest='+ 'a'.repeat(64)+'\nReview fixture',encoding:'utf8'});assert.equal(result.status,1,result.stderr);assert.ok(fs.existsSync(path.join(output,'receipt.json')),result.stderr);return JSON.parse(fs.readFileSync(path.join(output,'receipt.json')));};
 const first=run(1);assert.equal(first.classification,'authentication');assert.equal(first.attempts.length,1);assert.equal(first.effective_tuple,null);assert.equal(first.findings_sha256,null);
 const count=fs.readFileSync(calls,'utf8');const second=run(2);assert.equal(second.classification,'authentication');assert.equal(second.attempts.length,0);assert.equal(fs.readFileSync(calls,'utf8'),count,'no capability or provider spawn after classified failure');
 fs.unlinkSync(config+'.resources.json');fs.writeFileSync(calls,'');
 const concurrent=n=>new Promise((resolve,reject)=>{
   const digest=String(n).repeat(64);const out=path.join(dir,`concurrent-${n}`);
   const child=spawn('node',[path.join(root,'scripts/run-external-review.mjs'),'--orchestrator','codex','--review-kind','generic','--candidate-digest',digest,'--context-root',dir,'--reviewer-config',config,'--reviewer-phase','exec','--reviewer-station','cursor','--artifacts-dir',out],{env,cwd:dir,stdio:['pipe','pipe','pipe']});
   child.stdout.resume();child.stderr.resume();child.on('error',reject);child.on('close',code=>{try{assert.equal(code,1);resolve(JSON.parse(fs.readFileSync(path.join(out,'receipt.json'))));}catch(error){reject(error);}});child.stdin.end('candidate_digest='+digest+'\nReview concurrent fixture');
 });
 const concurrentResults=await Promise.all([concurrent(3),concurrent(4)]);
 assert.equal(concurrentResults.reduce((n,r)=>n+r.attempts.length,0),1,'different candidate keys share one pool lock');
 assert.equal(fs.readFileSync(calls,'utf8').trim().split('\n').filter(line=>JSON.parse(line).includes('--print')).length,1);
 // Same-candidate advisory evidence cannot be upgraded by editing owner policy.
 fs.unlinkSync(config+'.resources.json');fs.writeFileSync(calls,'');
 const findings={schema_version:1,review_kind:'generic',rubric_score:10,rubric_failures:null,dependencies_needing_read:null,reviewer:tuple,verdict:'pass',summary:'Quoted Not logged in is source text',findings:[],certifications:[]};
 fs.writeFileSync(binary,`#!/usr/bin/env node\nconst fs=require('node:fs');fs.appendFileSync(${JSON.stringify(calls)},JSON.stringify(process.argv.slice(2))+'\\n');if(process.argv.includes('--help'))console.log('--print --output-format --mode --model --sandbox --workspace --trust');else if(process.argv.includes('--version'))console.log('2026.08.25-fixture');else {fs.readFileSync(0);console.log(JSON.stringify({type:'result',subtype:'success',is_error:false,result:${JSON.stringify(JSON.stringify(findings))}}));}\n`,{mode:0o700});
 const success=n=>{const out=path.join(dir,`success-${n}`);const r=spawnSync('node',[path.join(root,'scripts/run-external-review.mjs'),'--orchestrator','codex','--review-kind','generic','--candidate-digest','7'.repeat(64),'--context-root',dir,'--reviewer-config',config,'--reviewer-phase','exec','--reviewer-station','cursor','--artifacts-dir',out],{env,cwd:dir,input:'candidate_digest='+'7'.repeat(64)+'\nSame review',encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(fs.readFileSync(path.join(out,'receipt.json')));};
 builder.reviewer.authority='advisory';fs.writeFileSync(config,JSON.stringify(createReviewerPolicy(builder)));
 const advisory=success(1);builder.reviewer.authority='independent';fs.writeFileSync(config,JSON.stringify(createReviewerPolicy(builder)));const independent=success(2);
 assert.notEqual(advisory.cache_key,independent.cache_key);assert.equal(independent.classification,'success');assert.equal(independent.model_attestation.level,'requested_accepted');
 assert.equal(fs.readFileSync(calls,'utf8').trim().split('\n').filter(line=>JSON.parse(line).includes('--print')).length,2);
 assert.equal(success(3).classification,'cache_hit');


});
