import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {deliveryCycleReport} from '../../scripts/mine-receipts.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const iso=m=>new Date(Date.UTC(2026,8,7)+m*60000).toISOString();
const cycle={root_wi:'WI-TIME',cycle_started_at:iso(0)};
const event=(id,task,phase,transition,at,attempt=1)=>({payload:{delivery_phase:{schema_version:1,event_id:id,root_wi:'WI-TIME',task_id:task,phase,transition,at:iso(at),attempt}}});

test('resume, overlapping reviews and an unknown gap stay in one cumulative cycle',()=>{
 const events=[event('a',1,'planning','start',0),event('b',1,'planning','end',35),event('c',2,'planning','start',5),event('d',2,'planning','end',20),event('e',3,'implementation','start',40),event('f',3,'implementation','end',165),event('g',3,'implementation','start',170,2),event('h',3,'implementation','end',180,2),event('i',4,'finalization','start',180),event('j',4,'finalization','end',192)];
 const r=deliveryCycleReport({cycle,events:[...events,events[0]],now:iso(192)});
 assert.equal(r.total_elapsed_ms,192*60000);assert.equal(r.phase_ms.planning,35*60000);assert.equal(r.phase_ms.implementation,135*60000);assert.equal(r.unknown_ms,10*60000);assert.equal(r.observed_retries,1);assert.deepEqual(r.target_missed,{planning:true,implementation:true,finalization:true});assert.equal(r.duplicate_events,1);
});

test('missing start, unclosed work and contradictory events are not fabricated zeroes',()=>{
 const r=deliveryCycleReport({cycle:{root_wi:'WI-TIME'},events:[],now:iso(10)});assert.equal(r.total_elapsed_ms,null);assert.equal(r.target_missed.planning,null);
 const observed=deliveryCycleReport({cycle:{root_wi:'WI-TIME'},events:[event('a',1,'planning','start',1),event('b',1,'planning','end',4)],now:iso(10)});assert.equal(observed.phase_ms.planning,3*60000);assert.equal(observed.total_elapsed_ms,null);
 const open=deliveryCycleReport({cycle,events:[event('a',1,'planning','start',0)],now:iso(10)});assert.equal(open.phase_ms.planning,0);assert.equal(open.unknown_ms,10*60000);assert.equal(open.unclosed_intervals,1);
 const conflict=deliveryCycleReport({cycle,events:[event('same',1,'planning','start',0),event('same',1,'planning','end',5)],now:iso(10)});assert.ok(conflict.problems.length);
});

test('actual graph activation is idempotent and emits only actual status transitions',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'delivery-timing-'));
 try {
  fs.mkdirSync(path.join(tmp,'.svc'));const graph=path.join(tmp,'.svc/lane-tasks-WI-TIME.json');
  fs.writeFileSync(graph,JSON.stringify({schema_version:1,wi:'WI-TIME',lane:'framework',status:'pending',delivery_cycle:cycle,tasks:[{id:1,skill:'route-workflow',subject:'route',status:'pending',blocked_by:[]}]}));
  const run=args=>{const r=spawnSync(process.execPath,[path.join(root,'scripts/task-graph.mjs'),...args],{cwd:tmp,encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);};
  run(['activate-skill',graph,'1','route-workflow']);run(['activate-skill',graph,'1','route-workflow']);run(['set-status',graph,'1','completed']);run(['set-status',graph,'1','completed']);
  const events=fs.readFileSync(path.join(tmp,'.svc/pipeline-decisions.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(events.length,2);assert.deepEqual(events.map(e=>e.payload.delivery_phase.transition),['start','end']);assert.ok(events.every(e=>e.kind==='mechanical'&&e.type==='mechanical'));
 } finally {fs.rmSync(tmp,{recursive:true,force:true});}
});

test('external waiting is explicit and unioned, while time remains in the whole cycle',()=>{
 const waits=[{payload:{delivery_phase:{schema_version:1,event_id:'wait1',root_wi:'WI-TIME',transition:'wait',at:iso(10),started_at:iso(2),ended_at:iso(10),reason:'provider processing'}}},{payload:{delivery_phase:{schema_version:1,event_id:'wait2',root_wi:'WI-TIME',transition:'wait',at:iso(12),started_at:iso(6),ended_at:iso(12),reason:'provider observation'}}}];
 const r=deliveryCycleReport({cycle,events:waits,now:iso(15)});assert.equal(r.observed_external_wait_ms,10*60000);assert.equal(r.unknown_ms,5*60000);assert.equal(r.total_elapsed_ms,15*60000);
});

test('bind intake once, inherit a split WI, record decisions and waits without resetting',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'delivery-cycle-bind-'));
 try {
  fs.mkdirSync(path.join(tmp,'.svc'));const graph=path.join(tmp,'.svc/lane-tasks-WI-TIME.json');const child=path.join(tmp,'.svc/lane-tasks-WI-CHILD.json');
  const template=wi=>({schema_version:1,wi,lane:'framework',change_type:'enabler',status:'pending',tasks:[{id:1,skill:'test-journeys',subject:'QA',status:'pending',blocked_by:[]}]});
  fs.writeFileSync(graph,JSON.stringify(template('WI-TIME')));fs.writeFileSync(child,JSON.stringify(template('WI-CHILD')));
  const run=(args,ok=true)=>{const r=spawnSync(process.execPath,[path.join(root,'scripts/task-graph.mjs'),...args],{cwd:tmp,encoding:'utf8'});assert.equal(r.status===0,ok,r.stdout+r.stderr);return r;};
  run(['bind-delivery-cycle',graph,'--started-at',iso(0)]);const initial=fs.readFileSync(graph,'utf8');run(['bind-delivery-cycle',graph,'--started-at',iso(0)]);assert.equal(fs.readFileSync(graph,'utf8'),initial);
  run(['bind-delivery-cycle',graph,'--started-at',iso(1)],false);run(['bind-delivery-cycle',child,'--inherit',graph]);assert.deepEqual(JSON.parse(fs.readFileSync(child)).delivery_cycle,cycle);
  run(['activate-skill',child,'1','test-journeys']);run(['set-status',child,'1','completed']);
  const decision=['record-delivery-event',child,'--id','decision-1','--kind','reopened-decision','--reason','Observed new API constraint'];run(decision);run(decision);
  run(['record-delivery-event',child,'--id','wait-1','--kind','wait','--reason','Provider result','--started-at',iso(2),'--ended-at',iso(4)]);
  run(['record-delivery-event',child,'--id','amendment-1','--kind','amendment','--reason','Related split']);
  const events=fs.readFileSync(path.join(tmp,'.svc/pipeline-decisions.jsonl'),'utf8').trim().split('\n').map(JSON.parse);assert.equal(events.length,5);assert.equal(events[0].payload.delivery_phase.phase,'implementation');
  const r=deliveryCycleReport({cycle,events,now:new Date().toISOString()});assert.equal(r.observed_reopened_decisions,1);assert.equal(r.observed_amendments,1);assert.equal(r.observed_external_wait_ms,2*60000);
 } finally {fs.rmSync(tmp,{recursive:true,force:true});}
});

test('uninstrumented graphs gain actual phase events while intake remains unknown',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'delivery-cycle-unknown-'));
 try {
  fs.mkdirSync(path.join(tmp,'.svc'));const graph=path.join(tmp,'.svc/lane-tasks-WI-TIME.json');fs.writeFileSync(graph,JSON.stringify({schema_version:1,wi:'WI-TIME',lane:'framework',status:'pending',tasks:[{id:1,skill:'route-workflow',subject:'route',status:'pending',blocked_by:[]}]}));
  const r=spawnSync(process.execPath,[path.join(root,'scripts/task-graph.mjs'),'activate-skill',graph,'1','route-workflow'],{cwd:tmp,encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(fs.readFileSync(graph)).delivery_cycle,{root_wi:'WI-TIME',cycle_started_at:null});assert.ok(fs.readFileSync(path.join(tmp,'.svc/pipeline-decisions.jsonl'),'utf8').includes('delivery_phase'));
 } finally {fs.rmSync(tmp,{recursive:true,force:true});}
});

test('terminal graphs use their observed completion; legacy endpoints remain unknown',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'delivery-completion-'));
 try {
  for(const allSkipped of [false,true]) {
   const cwd=path.join(tmp,String(allSkipped));fs.mkdirSync(path.join(cwd,'.svc'),{recursive:true});const graph=path.join(cwd,'.svc/lane-tasks-WI-TIME.json');
   const tasks=allSkipped?[]:[{id:1,skill:'research',subject:'prior work',status:'completed',completed_at:iso(3),blocked_by:[],skill_receipt:{skill:'research',loaded_at:iso(1),loaded_via:'fixture'}}];
   tasks.push({id:2,skill:'research',subject:'optional final probe',status:'pending',blocked_by:[]});fs.writeFileSync(graph,JSON.stringify({schema_version:1,wi:'WI-TIME',lane:'framework',change_type:'enabler',status:'pending',delivery_cycle:cycle,tasks}));
   const end=spawnSync(process.execPath,[path.join(root,'scripts/task-graph.mjs'),'set-status',graph,'2','skipped'],{cwd,encoding:'utf8'});assert.equal(end.status,0,end.stderr);
   const g=JSON.parse(fs.readFileSync(graph));assert.ok(Number.isFinite(Date.parse(g.completed_at)));
   const report=()=>{const r=spawnSync(process.execPath,[path.join(root,'scripts/mine-receipts.mjs'),'--delivery-cycle','WI-TIME','--json','--now',iso(10000)],{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
   assert.equal(report().total_elapsed_ms,Date.parse(g.completed_at)-Date.parse(cycle.cycle_started_at));
   delete g.completed_at;fs.writeFileSync(graph,JSON.stringify(g));const legacy=report();assert.equal(legacy.total_elapsed_ms,null);assert.ok(legacy.problems.some(p=>p.includes('completion boundary unknown')));
  }
 } finally {fs.rmSync(tmp,{recursive:true,force:true});}
});
