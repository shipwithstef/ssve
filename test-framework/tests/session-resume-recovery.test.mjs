import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {bootstrapController,writeControllerForTest,authorityStateRoot,repositoryId,principalId,readController} from '../../hooks/lib/authority-store.mjs';
import {writeSessionBinding} from '../../hooks/lib/wi-claim.mjs';
import {adoptExistingWorktree,prepareRecoveredSession} from '../../scripts/svc-ensure-worktree.mjs';
import {isReadOnlyTool} from '../../hooks/codex/lib/codex-hook-context.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const wi='WI-RECOVERY-TEST-01',oldSid='019a0000-0000-7000-8000-000000000001',sid='019a0000-0000-7000-8000-000000000002';
function fixture({v2=true}={}){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'svc-recover-'));const repo=path.join(tmp,'repo'),old=path.join(repo,'.worktrees','old'),target=path.join(tmp,'different-parent','current');fs.mkdirSync(repo);
 const git=(...a)=>execFileSync('git',['-C',repo,...a],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();git('init','-b','main');git('config','user.name','fixture');git('config','user.email','fixture@example.invalid');fs.writeFileSync(path.join(repo,'base'),'base');git('add','.');git('commit','-qm','base');git('update-ref','refs/remotes/origin/main','HEAD');git('worktree','add','-b','old',old);git('worktree','add','-b','fix/recovery',target);
 fs.mkdirSync(path.join(target,'.svc'));
 const bind=writeSessionBinding({worktree_root:target,repo_root:repo,wi,branch:'fix/recovery',session_id:oldSid,role:'mutating',host:'codex'});assert.equal(bind.ok,true,JSON.stringify(bind));
 const claimPath=bind.binding.claim_path;const claim=JSON.parse(fs.readFileSync(claimPath));claim.started_at=claim.renewed_at=new Date(Date.now()-3*86400000).toISOString();fs.writeFileSync(claimPath,JSON.stringify(claim));
 const graph={schema_version:1,wi,lane:'bugfix',status:'in_progress',tasks:[{id:1,skill:'land-changeset',subject:'resume',status:'in_progress',blocked_by:[]}]};fs.writeFileSync(path.join(target,'.svc',`lane-tasks-${wi}.json`),JSON.stringify(graph));
 fs.writeFileSync(path.join(target,'.svc','session-contract.jsonl'),JSON.stringify({wi,ts:'2020-01-01T00:00:00Z',authorization_envelope:{rules:[{decision:'deny',action:'activate-production',environment:'production',purpose:'keep dark'}]}})+'\n');fs.writeFileSync(path.join(target,'uncommitted'),'keep');
 const ctx={stateRoot:authorityStateRoot(target),repoId:repositoryId(target),wi};let lease=bootstrapController({...ctx,worktreeRoot:old,principal:principalId({host:'codex',session_id:oldSid}),now:Date.now()-3*86400000});
 process.env.NODE_ENV='test';lease=writeControllerForTest({...ctx,lease:{...lease,owner_process:{hostname:os.hostname(),pid:2147483647,start_token:'missing'}},expectedRevision:lease.backend_revision});git('worktree','remove',old);
 if(!v2)fs.rmSync(ctx.stateRoot,{recursive:true,force:true});
 return {tmp,repo,target,ctx,lease,env:{...process.env,SVC_HOST:'codex',SVC_SESSION_ID:sid,CODEX_THREAD_ID:sid}};
}
test('expired v2 at deleted path recovers exact registered external worktree; repeat preserves generation and files',()=>{
 const f=fixture();try{
  const r=adoptExistingWorktree({wi,cwd:f.repo},f.env);assert.equal(r.absolute_worktree,f.target);assert.equal(r.authority_v2.lease.generation,2);assert.equal(fs.readFileSync(path.join(f.target,'uncommitted'),'utf8'),'keep');
  const second=adoptExistingWorktree({wi,cwd:f.target},f.env);assert.equal(second.authority_v2.lease.generation,2);
  const p=prepareRecoveredSession({worktree:f.target,wi,sessionId:sid,turnId:'turn2',authorization:{eligible:true,wi}});assert.equal(p.skill,'land-changeset');const lines=fs.readFileSync(path.join(f.target,'.svc','session-contract.jsonl'),'utf8').trim().split('\n');assert.equal(JSON.parse(lines.at(-1)).authorization_envelope.rules[0].decision,'deny');
 }finally{fs.rmSync(f.tmp,{recursive:true,force:true});}
});
test('live owner refuses without changing lease',()=>{
 const f=fixture();try{
  let x=readController(f.ctx);writeControllerForTest({...f.ctx,lease:{...x,owner_process:{hostname:os.hostname(),pid:process.pid}},expectedRevision:x.backend_revision});x=readController(f.ctx);
  assert.throws(()=>adoptExistingWorktree({wi,cwd:f.repo},f.env),/live owner/);assert.deepEqual(readController(f.ctx),x);
 }finally{fs.rmSync(f.tmp,{recursive:true,force:true});}
});
test('remote read allowed; compound mutation remains governed',()=>{
 assert.equal(isReadOnlyTool({tool_name:'Bash',tool_input:{command:'git ls-remote origin refs/heads/main'}}),true);
 assert.equal(isReadOnlyTool({tool_name:'Bash',tool_input:{command:'git ls-remote origin && touch surprise'}}),false);
 assert.equal(isReadOnlyTool({tool_name:'Bash',tool_input:{command:'git ls-remote --upload-pack=custom origin'}}),false);
 for(const option of ['--exec=custom','--exec custom','-u/tmp/custom'])assert.equal(isReadOnlyTool({tool_name:'Bash',tool_input:{command:`git ls-remote ${option} origin`}}),false);
});
test('real prompt hook retains resume across clarification, revokes on stop',()=>{
 const f=fixture();try{
  const runtime=path.join(f.tmp,'runtime');fs.mkdirSync(runtime,{mode:0o700});const env={...f.env,SVC_CODEX_RUNTIME_DIR:runtime};
  for(const [turn,prompt] of [['1',`Resume ${wi} in this worktree.`],['2','what is the current state?'],['3','please autorecover']]){const r=spawnSync(process.execPath,[path.join(root,'hooks/codex/svc-codex-prompt-authority.mjs')],{env,input:JSON.stringify({cwd:f.target,session_id:sid,turn_id:turn,prompt}),encoding:'utf8'});assert.equal(r.status,0);}
  const files=(d)=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(d,e.name)):[path.join(d,e.name)]);const p=files(runtime).find(p=>p.endsWith('prompt-authority.json'));assert.ok(p);assert.equal(JSON.parse(fs.readFileSync(p)).explicit_wi,wi);
  spawnSync(process.execPath,[path.join(root,'hooks/codex/svc-codex-prompt-authority.mjs')],{env,input:JSON.stringify({cwd:f.target,session_id:sid,turn_id:'4',prompt:'stop this task'}),encoding:'utf8'});assert.equal(JSON.parse(fs.readFileSync(p)).continuation_intent,'none');
 }finally{fs.rmSync(f.tmp,{recursive:true,force:true});}
});

for (const [bootstrap,pending] of [[false,false],[true,false],[false,true]]) test(`native dispatcher restores state and routes exactly to loader before original mutation (bootstrap=${bootstrap}, pending=${pending})`,()=>{
 const f=fixture();try{
  const runtime=path.join(f.tmp,'runtime');fs.mkdirSync(runtime,{mode:0o700});const env={...f.env,SVC_CODEX_RUNTIME_DIR:runtime};
  if(pending){const gp=path.join(f.target,'.svc',`lane-tasks-${wi}.json`);const graph=JSON.parse(fs.readFileSync(gp));graph.tasks[0].status='pending';graph.status='pending';fs.writeFileSync(gp,JSON.stringify(graph));}
  const payload={cwd:f.target,session_id:sid,turn_id:'native',tool_use_id:'native-1',tool_name:'exec_command',tool_input:{cmd:bootstrap?`node ${path.join(root,'scripts/svc-ensure-worktree.mjs')} --wi ${wi} --branch fix/recovery`:'touch recovery-probe',workdir:f.target}};
  const prompt=spawnSync(process.execPath,[path.join(root,'hooks/codex/svc-codex-prompt-authority.mjs')],{env,input:JSON.stringify({...payload,prompt:`Resume ${wi} in this worktree.`}),encoding:'utf8'});assert.equal(prompt.status,0);
  const dispatch=()=>{const r=spawnSync(process.execPath,[path.join(root,'hooks/codex/svc-codex-pretool-dispatcher.mjs')],{env,input:JSON.stringify(payload),encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
  const out=dispatch();assert.equal(out.hookSpecificOutput?.permissionDecision,'allow',JSON.stringify(out));assert.match(out.hookSpecificOutput.updatedInput.cmd,/codex-load-skill/);assert.equal(fs.existsSync(path.join(f.target,'recovery-probe')),false);
  // Simulate interruption after lease/contract recovery but before skill load.
  payload.tool_input.cmd='touch recovery-probe';
  const interrupted=dispatch();assert.equal(interrupted.hookSpecificOutput?.permissionDecision,'allow',JSON.stringify(interrupted));assert.match(interrupted.hookSpecificOutput.updatedInput.cmd,/codex-load-skill/);assert.equal(readController(f.ctx).generation,2);
  const loaded=spawnSync('bash',['-c',interrupted.hookSpecificOutput.updatedInput.cmd],{cwd:f.target,env,encoding:'utf8'});assert.equal(loaded.status,0,loaded.stderr);
  const again=dispatch();assert.notEqual(again.hookSpecificOutput?.permissionDecision,'deny',JSON.stringify(again));assert.ok(!again.hookSpecificOutput?.updatedInput?.cmd?.includes('codex-load-skill'),JSON.stringify(again));
 }finally{fs.rmSync(f.tmp,{recursive:true,force:true});}
});

test('legacy expired exact tuple recovers external worktree without parent approval',()=>{
 const f=fixture({v2:false});try{
  execFileSync('git',['-C',f.repo,'config','user.name','fixture']);
  fs.writeFileSync(path.join(f.repo,'.gitignore'),'.worktrees/\n');
  const r=adoptExistingWorktree({wi,cwd:f.target},f.env);assert.equal(r.absolute_worktree,f.target);assert.equal(fs.readFileSync(path.join(f.target,'uncommitted'),'utf8'),'keep');
 }finally{fs.rmSync(f.tmp,{recursive:true,force:true});}
});

test('ambiguous graph denies without changing controller',()=>{
 const f=fixture();try{
  fs.mkdirSync(path.join(f.repo,'.svc'));fs.copyFileSync(path.join(f.target,'.svc',`lane-tasks-${wi}.json`),path.join(f.repo,'.svc',`lane-tasks-${wi}.json`));
  const before=readController(f.ctx);assert.throws(()=>adoptExistingWorktree({wi,cwd:f.target},f.env),/ambiguous|default/i);assert.deepEqual(readController(f.ctx),before);
 }finally{fs.rmSync(f.tmp,{recursive:true,force:true});}
});
test('prompt restrictions pause recovery, status does not rearm, explicit continuation resumes retained WI',()=>{
 const f=fixture();try{
  const runtime=path.join(f.tmp,'runtime');fs.mkdirSync(runtime,{mode:0o700});const env={...f.env,SVC_CODEX_RUNTIME_DIR:runtime};
  const files=(d)=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(d,e.name)):[path.join(d,e.name)]);
  for(const [prompt,expected] of [[`Resume ${wi}`,'resume'],['switch the log level instead of removing logs','resume'],['we should not continue','none'],['continue','continue'],['hold off on resuming','none'],['continue','continue'],['cancel that','none'],['continue','continue'],["don't touch anything; just give me an update",'none'],['continue','continue'],['only inspect; no changes','none'],['what is the status?','none'],['continue','continue']]){
   const r=spawnSync(process.execPath,[path.join(root,'hooks/codex/svc-codex-prompt-authority.mjs')],{env,input:JSON.stringify({cwd:f.target,session_id:sid,turn_id:prompt,prompt}),encoding:'utf8'});assert.equal(r.status,0);
   const doc=JSON.parse(fs.readFileSync(files(runtime).find(p=>p.endsWith('prompt-authority.json'))));assert.equal(doc.explicit_wi,wi);assert.equal(doc.continuation_intent,expected,prompt);
  }
 }finally{fs.rmSync(f.tmp,{recursive:true,force:true});}
});
test('missing heartbeat receipt is quiet for reads and visible for mutations',()=>{
 for(const [command,quiet] of [['git ls-remote origin',true],['touch changed',false]]){
 const r=spawnSync(process.execPath,[path.join(root,'hooks/codex/svc-codex-posttool-heartbeat.mjs')],{input:JSON.stringify({session_id:sid,tool_use_id:'missing-test',tool_name:'Bash',tool_input:{command},success:true}),encoding:'utf8'});assert.equal(r.status,0);assert.equal(Boolean(JSON.parse(r.stdout).systemMessage),!quiet);
 }
});

for(const status of ['completed','blocked'])test(`unrunnable ${status} graph refuses before controller transfer`,()=>{
 const f=fixture();try{const gp=path.join(f.target,'.svc',`lane-tasks-${wi}.json`);const graph=JSON.parse(fs.readFileSync(gp));graph.tasks[0].status=status;fs.writeFileSync(gp,JSON.stringify(graph));const before=readController(f.ctx);assert.throws(()=>adoptExistingWorktree({wi,cwd:f.target,prepareSession:true},f.env),/runnable task/);assert.deepEqual(readController(f.ctx),before);}finally{fs.rmSync(f.tmp,{recursive:true,force:true});}
});
test('missing session contract refuses before controller transfer',()=>{
 const f=fixture();try{fs.unlinkSync(path.join(f.target,'.svc','session-contract.jsonl'));const before=readController(f.ctx);assert.throws(()=>adoptExistingWorktree({wi,cwd:f.target,prepareSession:true},f.env));assert.deepEqual(readController(f.ctx),before);}finally{fs.rmSync(f.tmp,{recursive:true,force:true});}
});

test('agent-scoped principal agrees with resolver during controller recovery',()=>{
 const f=fixture();try{const env={...f.env,SVC_AGENT_ID:'recovery-agent'};const r=adoptExistingWorktree({wi,cwd:f.target,prepareSession:true},env);assert.equal(r.authority_v2.lease.controller_principal,principalId({host:'codex',session_id:sid,agent_id:'recovery-agent'}));}finally{fs.rmSync(f.tmp,{recursive:true,force:true});}
});
