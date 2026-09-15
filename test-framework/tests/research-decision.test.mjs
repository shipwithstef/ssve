// Offline regression evidence; these fixtures never authorize a live receipt.
import test from 'node:test';
import assert from 'node:assert/strict';
import {compileDeliveryGraph} from '../../scripts/compile-delivery-graph.mjs';
const input={wi:'WI-OFFLINE-RESEARCH-PROBE',user_intent:'Clarify an already inspected local interface',lane:'framework',change_type:'framework',solution_confidence:{required:true,mode:'design_auto'}};
test('requiring solution analysis without a question does not dispatch external research',()=>{
 const graph=compileDeliveryGraph(structuredClone(input));
 assert.equal(graph.tasks.filter(t=>t.metadata?.skill==='research').length,0);
 assert.ok(graph.tasks.some(t=>t.metadata?.skill==='design-tech'));
});
test('missing confidence is not an external research requirement',()=>{
 const graph=compileDeliveryGraph({...input,solution_confidence:{...input.solution_confidence,questions:[{id:'local-api',claim:'Which function owns the local state?',evidence:[],consequential:true,external_resolvable:false,confidence:null,explicit_request:false,freshness_required:false}]}});
 assert.equal(graph.tasks.filter(t=>t.metadata?.skill==='research').length,0);
});
import {researchDecision,validateResearchGraph} from '../../scripts/lib/research-decision.mjs';
const q={id:'cancel',claim:'Does the external API support cancellation?',evidence:[],consequential:true,external_resolvable:true,confidence:6,explicit_request:false,freshness_required:false};
const evidence=[{source:'https://example.invalid/fixture',basis:'OFFLINE example cancellation contract',verified:true,freshness:'current'}];
const research=g=>g.tasks.find(t=>t.metadata?.skill==='research');
test('explicit request and necessary freshness work with an omitted ordinary score',()=>{
 const {confidence,...rest}=q;
 assert.equal(researchDecision({...rest,explicit_request:true}),'external_research_required');
 assert.equal(researchDecision({...rest,freshness_required:true,freshness_reason:'Version-sensitive API semantics'}),'external_research_required');
});
test('external decision creates one reusable task and keeps unrelated completed evidence',()=>{
 const g=compileDeliveryGraph({...input,questions:[q]});const r=research(g);assert.ok(r);assert.ok(g.tasks.find(t=>t.id===r.metadata.requesting_task_id).blocked_by.includes(r.id));
 const extra={id:900,subject:'Other observed proof',status:'completed',blocked_by:[],metadata:{skill:'audit-session-execution'},skill_receipt:{skill:'audit-session-execution',phases_executed:[]}};g.tasks.push(extra);
 const again=compileDeliveryGraph({...input,existing_graph:g,questions:[q]});assert.equal(research(again).id,r.id);assert.equal(again.tasks.filter(t=>t.metadata?.skill==='research').length,1);assert.deepEqual(again.tasks.find(t=>t.id===900),extra);assert.deepEqual(validateResearchGraph(again),[]);
});
test('completed but unresolved research cannot unlock requester; resolved question removes only its own block',()=>{
 const g=compileDeliveryGraph({...input,questions:[q]});const r=research(g);r.status='completed';r.metadata.observed_confidence=8;r.metadata.observed_evidence=[];
 const requester=g.tasks.find(t=>t.id===r.metadata.requesting_task_id);const extra={id:901,subject:'Other prerequisite',status:'pending',blocked_by:[],metadata:{skill:'security-ops'}};g.tasks.push(extra);requester.blocked_by.push(901);
 const unresolved=compileDeliveryGraph({...input,existing_graph:g,questions:[q]});assert.equal(unresolved.tasks.find(t=>t.id===requester.id).status,'blocked');
 const done=research(unresolved);done.metadata.observed_evidence=evidence;done.metadata.observed_confidence=8;
 const resolved=compileDeliveryGraph({...input,existing_graph:unresolved,questions:[q]});const after=resolved.tasks.find(t=>t.id===requester.id);assert.ok(after.blocked_by.includes(901));assert.ok(!after.blocked_by.includes(r.id));assert.equal(research(resolved).id,r.id);assert.deepEqual(validateResearchGraph(resolved),[]);
});
test('foreign-WI resume is rejected before adopting phase receipts',()=>{
 const other=compileDeliveryGraph({...input,wi:'WI-OTHER'});assert.throws(()=>compileDeliveryGraph({...input,existing_graph:other}),/WI|identity|different/i);
});
test('malformed question evidence is visible to the validator',()=>{
 const g=compileDeliveryGraph({...input,questions:[{...q,evidence:['not evidence']}]});assert.ok(validateResearchGraph(g).some(s=>/invalid.*question|question.*invalid/i.test(s)));
});
test('changed question cannot reuse completed research about the old claim',()=>{
 const g=compileDeliveryGraph({...input,questions:[q]});const r=research(g);r.status='completed';r.skill_receipt={skill:'research',phases_executed:[]};r.metadata.observed_evidence=evidence;r.metadata.observed_confidence=8;
 const changed={...q,claim:'Does the NEW API version preserve cancellation?'};
 const again=compileDeliveryGraph({...input,existing_graph:g,questions:[changed]});const current=research(again);
 assert.equal(current.id,r.id);assert.equal(current.status,'pending');assert.equal(current.skill_receipt,undefined);assert.equal(current.metadata.research_history.length,1);assert.equal(current.metadata.research_trigger_question.claim,changed.claim);
 assert.equal(again.tasks.find(t=>t.id===current.metadata.requesting_task_id).status,'blocked');
});

test('the graph spends externally only for an evidenced reason, never a bare score or local unknown',()=>{
 const cases=[
  ['local low score',{...q,external_resolvable:false,confidence:1},0],
  ['nonconsequential low score',{...q,consequential:false},0],
  ['missing score',{...q,confidence:null},0],
  ['invalid fractional score',{...q,confidence:6.5},0],
  ['high score without evidence',{...q,confidence:9},0],
  ['resolved current evidence',{...q,confidence:8,evidence},0],
  ['explicit request despite high score',{...q,confidence:9,evidence,explicit_request:true},1],
  ['necessary freshness without score',{...q,confidence:null,freshness_required:{necessary:true,reason:'Released version changed'}},1],
 ];
 for(const [name,question,count] of cases){
  const g=compileDeliveryGraph({...input,questions:[question]});
  assert.equal(g.tasks.filter(t=>t.metadata?.skill==='research').length,count,name);
 }
 assert.equal(researchDecision({...q,confidence:9}), 'analysis_required');
 assert.equal(researchDecision({...q,confidence:9,evidence}), 'resolved');
});

test('an explicit request is fulfilled once and keeps its original provenance on resume',()=>{
 const question={...q,confidence:null,explicit_request:true,requested_scope:'Read the current cancellation contract'};
 const g=compileDeliveryGraph({...input,questions:[question]});const r=research(g);
 r.status='completed';r.metadata.observed_evidence=evidence;r.metadata.observed_confidence=8;r.metadata.fulfilled_scope=question.requested_scope;
 const next=compileDeliveryGraph({...input,existing_graph:g,questions:[question]});
 assert.equal(next.tasks.filter(t=>t.metadata?.skill==='research').length,1);
 assert.equal(research(next).status,'completed');
 assert.equal(research(next).metadata.research_trigger_question.explicit_request,true);
 assert.ok(!next.tasks.find(t=>t.id===r.metadata.requesting_task_id).blocked_by.includes(r.id));
 assert.deepEqual(validateResearchGraph(next),[]);
});

test('a skip label or completed local receipt cannot replace required external evidence',()=>{
 const g=compileDeliveryGraph({...input,questions:[q]});const r=research(g);
 g.tasks=g.tasks.filter(t=>t.id!==r.id);for(const t of g.tasks)t.blocked_by=t.blocked_by.filter(id=>id!==r.id);
 g.delivery_graph.skipped_skills.push({skill:'research',skip_condition_id:'no-ui'});
 assert.ok(validateResearchGraph(g).some(s=>s.includes('lacks research task')));
 const fake=compileDeliveryGraph({...input,questions:[q]});const task=research(fake);
 task.status='completed';task.skill_receipt={skill:'research',phases_executed:[]};task.metadata.research_trigger_question={...q,external_resolvable:false};
 assert.ok(validateResearchGraph(fake).some(s=>s.includes('fabricated completed research receipt')));
});

test('the actual knowledge-gap CLI does not turn a missing topic into external research',async()=>{
 const fs=await import('node:fs');const os=await import('node:os');const path=await import('node:path');const {spawnSync}=await import('node:child_process');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ssve-research-gap-'));
 try{
  fs.mkdirSync(path.join(root,'.svc'));const file=path.join(root,'.svc','lane-tasks.json');
  const graph=compileDeliveryGraph(input);fs.writeFileSync(file,JSON.stringify(graph));const original=fs.readFileSync(file);
  const r=spawnSync(process.execPath,[new URL('../../scripts/spine-gap-spawn.mjs',import.meta.url).pathname,file,'design-tech','local-state-owner',input.wi],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).decision,'analysis_required');
  assert.deepEqual(fs.readFileSync(file),original,'analysis-only recall must not insert research or rewrite unrelated task state');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('the knowledge-gap CLI binds and reuses one real requesting decision',async()=>{
 const fs=await import('node:fs');const os=await import('node:os');const path=await import('node:path');const {spawnSync}=await import('node:child_process');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ssve-research-gap-'));
 try{
  fs.mkdirSync(path.join(root,'.svc'));const file=path.join(root,'.svc','lane-tasks.json');const questionFile=path.join(root,'question.json');
  const graph=compileDeliveryGraph(input);fs.writeFileSync(file,JSON.stringify(graph));fs.writeFileSync(questionFile,JSON.stringify(q));
  const args=[new URL('../../scripts/spine-gap-spawn.mjs',import.meta.url).pathname,file,'design-tech','cancellation',input.wi,'--question',questionFile];
  for(let i=0;i<2;i++){const r=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
  const after=JSON.parse(fs.readFileSync(file));const tasks=after.tasks.filter(t=>(t.metadata?.skill||t.skill)==='research');assert.equal(tasks.length,1);
  const task=tasks[0];assert.equal(task.metadata.requesting_decision_id,q.id);assert.ok(after.tasks.find(t=>t.id===task.metadata.requesting_task_id).blocked_by.includes(task.id));
  assert.deepEqual(validateResearchGraph(after),[]);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('a replacement question does not inherit an omitted confidence or old evidence',async()=>{
 const {mergeQuestionById}=await import('../../scripts/spine-gap-spawn.mjs');
 const {confidence,...replacement}={...q,claim:'Which local function now owns cancellation?',external_resolvable:false};
 const merged=mergeQuestionById([{...q,evidence}],replacement);
 assert.equal(merged[0].confidence,undefined);assert.deepEqual(merged[0].evidence,[]);assert.equal(researchDecision(merged[0]),'analysis_required');
});

test('repeated resume preserves superseded research and prior graph history',()=>{
 const initial=compileDeliveryGraph({...input,questions:[q]});
 const changed={...q,claim:'Which local owner handles this now?',external_resolvable:false,confidence:null};
 const next=compileDeliveryGraph({...input,questions:[changed],existing_graph:initial});
 assert.ok(next.delivery_graph.research.superseded_tasks.length);
 const again=compileDeliveryGraph({...input,questions:[changed],existing_graph:next});
 assert.deepEqual(again.delivery_graph.research.superseded_tasks,next.delivery_graph.research.superseded_tasks);
 assert.deepEqual(again.delivery_graph.mutation_history.slice(0,-1),next.delivery_graph.mutation_history);
});
