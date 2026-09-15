// Explicit inline v4: preserve reviewed requirements without dictating local code.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {acTableSha256, acSignatures, extractAcSection} from './normalize-ac-table.mjs';
import {validateEvidenceSchema} from './evidence-schema.mjs';
import {getObject} from './review-evidence-store.mjs';
import {evaluateEligibility,canonicalJson,eligibilityDecisionDigest} from './two-box-protocol.mjs';
import {validateControlPlan} from './control-plan-validate.mjs';

export const PLAN_MANIFEST_MAX_VERSION = 5;
const packageRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const schema=JSON.parse(fs.readFileSync(path.join(packageRoot,'schemas/receipts/plan-manifest.schema.json'),'utf8'));
const sha=s=>createHash('sha256').update(s).digest('hex');
const text=x=>typeof x==='string' && x.trim().length>0;
const object=x=>x!==null && typeof x==='object' && !Array.isArray(x);
const exactPath=x=>text(x) && !path.posix.isAbsolute(x) && !x.includes('\\') && !x.includes('\0') && !/[\n\r*?\[\]]/.test(x) && x.split('/').every(p=>p && p!=='.' && p!=='..');
const topLevelKey=x=>typeof x==='string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(x);
const hash=x=>typeof x==='string' && /^[a-f0-9]{64}$/.test(x);
const ids=x=>Array.isArray(x) && x.every(text) && new Set(x).size===x.length;
const bodyMarker='<!-- SVC_PLAN_BODY -->';
const bodyEnd='<!-- /SVC_PLAN_BODY -->';
export const VIEW_START='<!-- SVC_PLAN_VIEWS -->';
export const VIEW_END='<!-- /SVC_PLAN_VIEWS -->';

export function parsePlanBytes(markdown) {
 if(String(markdown).split(bodyMarker).length!==2 || String(markdown).split(bodyEnd).length!==2) throw new Error('exactly one SVC_PLAN_BODY block is required');
 const start=markdown.indexOf(bodyMarker)+bodyMarker.length,end=markdown.indexOf(bodyEnd);
 if(end<start) throw new Error('unterminated SVC_PLAN_BODY');
 const m=markdown.slice(start,end).match(/^\s*```json\r?\n([\s\S]*?)\r?\n```\s*$/);
 if(!m) throw new Error('SVC_PLAN_BODY must contain one fenced JSON object');
 return Buffer.from(m[1],'utf8');
}
export function parsePlanManifest(markdown) {
 const body=JSON.parse(parsePlanBytes(markdown).toString('utf8'));if(!object(body))throw new Error('plan body must be an object');return body;
}

export function containedReader(root) {
 const canonical=fs.realpathSync(root);
 return relative=>{
  if(!exactPath(relative))throw new Error(`invalid repo-relative path: ${relative}`);
  let cursor=canonical,st;
  for(const part of relative.split('/')) {
   cursor=path.join(cursor,part);
   st=fs.lstatSync(cursor);
   if(st.isSymbolicLink()||fs.realpathSync(cursor)!==cursor)throw new Error(`symlink rejected: ${relative}`);
  }
  if(!cursor.startsWith(canonical+path.sep))throw new Error(`path escapes source root: ${relative}`);
  if(!st.isFile())throw new Error(`not a regular source file: ${relative}`);
  return fs.readFileSync(cursor,'utf8');
 };
}

// Detect partial adoption within the trusted source package, not a signing authority.
export function packageCapabilities(root=packageRoot) {
 const source_root=fs.realpathSync(root),read=containedReader(source_root);
 const paths=['scripts/prepare-plan-handoff.mjs','scripts/lib/plan-manifest-contract.mjs','schemas/receipts/plan-manifest.schema.json','scripts/emit-receipt.mjs','scripts/check-chain-receipts.mjs','scripts/lib/review-inputs.mjs'].sort();
 const bytes=new Map(paths.map(p=>[p,read(p)]));
 if(JSON.parse(bytes.get('schemas/receipts/plan-manifest.schema.json')).properties.schema_version.maximum!==5)throw new Error('schema does not support the v5 package contract');
 for(const p of ['scripts/emit-receipt.mjs','scripts/check-chain-receipts.mjs']) {
  if(!/PLAN_MANIFEST_MAX_VERSION\s*=\s*5\b/.test(bytes.get(p)) || !bytes.get(p).includes('validatePlanBody'))throw new Error(`consumer lacks explicit v5 support: ${p}`);
 }
 if(!bytes.get('scripts/lib/review-inputs.mjs').includes('assertCurrentExecution'))throw new Error('package lacks review-inputs current-execution gate');
 if(!bytes.get('scripts/prepare-plan-handoff.mjs').includes('assertCurrentExecution'))throw new Error('package lacks preparation execution gate');
 const files=paths.map(p=>({path:p,sha256:sha(bytes.get(p))}));
 return {schema_version:1,source_root,supported_versions:[1,2,3,4,5],issuance_versions:[5],modes:['inline','dispatch'],files,package_sha256:sha(JSON.stringify(files))};
}

function objectBytes(consumerRoot,ref){
 if(!object(ref)||ref.type!=='object'||!hash(ref.sha256))throw new Error('invalid object ref');
 const stored=getObject(ref.sha256,{start:consumerRoot});
 const bytes=Buffer.isBuffer(stored)?stored:stored?.bytes;
 if(!bytes)throw new Error(`unresolved object ${ref.sha256}`);
 if(stored?.sha256&&stored.sha256!==ref.sha256)throw new Error('object ref digest mismatch');
 return Buffer.from(bytes);
}
function requirementIdsFrom(value){
 if(Array.isArray(value))return value.map(v=>object(v)?v.id:v).filter(text);
 if(object(value)&&Array.isArray(value.requirements))return requirementIdsFrom(value.requirements);
 if(object(value)&&Array.isArray(value.items))return requirementIdsFrom(value.items);
 return [];
}
function selectedSourceIds(control){
 return new Set((control?.chosen_solution?.selected_decisions || []).flatMap(row=>row.source_ids || []));
}
function assertV5LiveBindings(body,consumerRoot){
 const pc=body.planning_contract;
 const original=JSON.parse(objectBytes(consumerRoot,pc.original_requirements_ref).toString('utf8'));
 const requiredIds=requirementIdsFrom(original);
 if(!requiredIds.length)throw new Error('original requirements ref has no requirement IDs');
 const covered=new Set();
 for(const a of body.implementation_approach)for(const id of a.requirement_ids)covered.add(id);
 if(requiredIds.some(id=>!covered.has(id)) || [...covered].some(id=>!requiredIds.includes(id)))throw new Error('implementation_approach must cover every original requirement');
 if(pc.kind==='two_box'){
  objectBytes(consumerRoot,pc.source_snapshot_ref);
  const control=JSON.parse(objectBytes(consumerRoot,pc.control_plan_ref).toString('utf8'));
  const checked = validateControlPlan({consumerRoot,body:control,requirementsRef:pc.original_requirements_ref,sourceSnapshotRef:pc.source_snapshot_ref});
  if (!checked.ok || control.wi !== body.wi) throw new Error(`Invalid control evidence: ${checked.errors.join('; ') || 'WI mismatch'}`);
  const selected=selectedSourceIds(control);
  if(!selected.size)throw new Error('two_box control plan has no selected source IDs');
  for(const a of body.implementation_approach)if(a.source_ids.some(id=>!selected.has(id)))throw new Error(`source_ids must come from assessor-selected source IDs: ${a.id}`);
 } else if(pc.kind==='lightweight'){
  if(pc.eligibility_tree?.type!=='digest'||pc.eligibility_tree.of!=='tree'||!hash(pc.eligibility_tree.sha256))throw new Error('lightweight eligibility_tree must be a tree digest');
  const stored=JSON.parse(objectBytes(consumerRoot,pc.eligibility_ref).toString('utf8'));
  const actual=evaluateEligibility({consumerRoot});
  if(actual.eligible!==true || actual.evidence_class!=="LIVE" || pc.eligibility_tree.sha256!==actual.staged_tree.sha256 || stored.eligible!==true || stored.evidence_class!=="LIVE" || stored.staged_tree?.sha256!==actual.staged_tree.sha256 || eligibilityDecisionDigest(stored,{consumerRoot})!==eligibilityDecisionDigest(actual,{consumerRoot})) throw new Error('lightweight requires matching live staged classifier evidence');
  if(JSON.stringify([...new Set(body.scope.included)].sort())!==JSON.stringify([...new Set(actual.files)].sort()))throw new Error('lightweight plan scope differs from classified staged files');
 }
}
export function validatePlanSchema(body) {
 const errors=[];
 if(!object(body))return {ok:false,errors:['plan body must be an object']};
 if(!Number.isInteger(body.schema_version)||body.schema_version<1||body.schema_version>5)return {ok:false,errors:['unsupported plan schema_version']};
 errors.push(...validateEvidenceSchema(body,{...schema,allOf:undefined},schema));
 const v4=schema.allOf.find(rule=>rule.if?.properties?.schema_version?.const===4)?.then;
 const v5=schema.allOf.find(rule=>rule.if?.properties?.schema_version?.const===5)?.then;
 const seq=v4?.properties?.execution_command_sequence?.items?.oneOf;
 if(body.schema_version===4){
  if(!v4)return {ok:false,errors:['v4 schema branch unavailable']};
  errors.push(...validateEvidenceSchema(body,v4,schema));
  if(Array.isArray(body.execution_command_sequence)&&seq)for(const step of body.execution_command_sequence)errors.push(...validateEvidenceSchema(step,seq[Object.hasOwn(step,'producer')?1:0],schema));
 } else if(body.schema_version===5){
  if(!v5)return {ok:false,errors:['v5 schema branch unavailable']};
  errors.push(...validateEvidenceSchema(body,v5,schema));
  if(body.mode!=='inline'&&!Object.hasOwn(body,'changeset_blueprints'))errors.push('missing changeset_blueprints');
  if(Array.isArray(body.execution_command_sequence)&&seq)for(const step of body.execution_command_sequence)errors.push(...validateEvidenceSchema(step,seq[Object.hasOwn(step,'producer')?1:0],schema));
  if(object(body.planning_contract)&&schema.$defs){
   const branches=['planningContractTwoBox','planningContractLightweight'].map(name=>validateEvidenceSchema(body.planning_contract,schema.$defs[name],schema));
   if(!branches.some(e=>e.length===0))errors.push('planning_contract: no anyOf branch matched');
  }
 }
 return {ok:errors.length===0,errors};
}
export function validatePlanBody(body,{readSpec,readFile=readSpec,consumerRoot}={}) {
 const errors=[],bad=s=>errors.push(s);
 if(!object(body))return {ok:false,errors:['plan body must be an object']};
 if(!Number.isInteger(body.schema_version)||body.schema_version<1||body.schema_version>5)bad('unsupported plan schema_version');
 const required=['receipt_type','schema_version','wi','scope','dependencies','decision_trace','task_graph','validation_plan','risk_rollback','timestamp','execution_command_sequence'];
 if(body.schema_version>=3)required.push('ac_digests');
 if(body.mode!=='inline')required.push('changeset_blueprints');
 if(body.schema_version===5)required.push('mode','planning_contract','implementation_approach','executor_discretion');
 for(const key of required)if(!Object.hasOwn(body,key))bad(`missing ${key}`);
 if(body.receipt_type!=='plan-manifest')bad('receipt_type must be plan-manifest');
 if(body.schema_version!==4 && body.schema_version!==5)return {ok:errors.length===0,errors}; // Legacy semantics stay with their existing consumers.
 if(body.schema_version===5){
  const schemaOnly=validatePlanSchema(body);
  errors.push(...schemaOnly.errors);
  if(errors.length)return {ok:false,errors};
 } else {
 if(body.mode!=='inline')bad('v4 requires explicit inline mode');
 const v4=schema.allOf.find(rule=>rule.if?.properties?.schema_version?.const===4)?.then;
 if(!v4)return {ok:false,errors:['v4 schema branch unavailable']};
 errors.push(...validateEvidenceSchema(body,{...schema,allOf:undefined}),...validateEvidenceSchema(body,v4));
 if(errors.length)return {ok:false,errors};
 for(const step of body.execution_command_sequence) {
  const alternatives=v4.properties.execution_command_sequence.items.oneOf;
  errors.push(...validateEvidenceSchema(step,alternatives[Object.hasOwn(step,'producer')?1:0]));
 }
 if(errors.length)return {ok:false,errors};
 }

 if(!text(body.wi)||!text(body.timestamp)||!Number.isFinite(Date.parse(body.timestamp)))bad('WI and fixed authoring timestamp are required');
 if(!object(body.scope)||!ids(body.scope.included)||!body.scope.included.length||!ids(body.scope.excluded))bad('scope needs included and excluded arrays');
 if(errors.length)return {ok:false,errors};
 if([...body.scope.included,...body.scope.excluded].some(p=>!exactPath(p)))bad('scope entries must be exact repo-relative paths');
 if(!Array.isArray(body.dependencies)||!Array.isArray(body.decision_trace)||!object(body.risk_rollback))bad('dependencies, decisions and rollback have invalid shapes');
 const tasks=Array.isArray(body.task_graph)?body.task_graph:[],validations=Array.isArray(body.validation_plan)?body.validation_plan:[];
 if(!tasks.length||!validations.length)bad('tasks and validation plan must be non-empty');
 const taskIds=tasks.map(t=>t?.id),validationIds=validations.map(v=>v?.id);
 if(!ids(taskIds)||!ids(validationIds))bad('task and validation IDs must be unique strings');
 const taskById=new Map(tasks.map(t=>[t?.id,t]));
 const ac=body.ac_digests;
 let specIds=[];
 if(!object(ac)||!exactPath(ac.spec_path)||!hash(ac.spec_ac_table_sha256)||!Array.isArray(ac.entries))bad('invalid authoritative AC binding');
 else {
  if(typeof readSpec!=='function')bad('authoritative spec reader required');
  else try {
   const source=readSpec(ac.spec_path);
   if(acTableSha256(source)!==ac.spec_ac_table_sha256)bad('stale authoritative AC binding');
   specIds=acSignatures(source).map((s,i)=>s.includes('::')?s.split('::')[0]:String(i+1));
   if(!specIds.length)bad('spec has no parseable acceptance criteria');
   const entries=ac.entries.map(e=>String(e?.ac_id||'').toLowerCase());
   if(new Set(entries).size!==entries.length || entries.length!==specIds.length || specIds.some(id=>!entries.includes(id)))bad('AC entries must cover the exact authoritative AC set');
  } catch(e){bad(`cannot read authoritative spec: ${e.message}`);}
 }
 const known=new Set(specIds),covered=new Set();
 for(const v of validations) {
  if(!object(v)){bad('invalid validation entry');continue;}
  if(!ids(v.ac_ids)||!v.ac_ids.length)bad(`validation ${v.id} requires AC IDs`);
  for(const id of v.ac_ids||[])if(!known.has(String(id).toLowerCase()))bad(`validation ${v.id} references unknown AC ${id}`);
  if(!['source','unit','browser','device','hosted','performance'].includes(v.observation_kind)||!text(v.command)||!text(v.expected_outcome)||!text(v.sufficiency))bad(`validation ${v.id} requires observation, command, outcome and sufficiency`);
 }
 const writes=new Set();
 for(const task of tasks) {
  if(!object(task)){bad('invalid task entry');continue;}
  if(!ids(task.files)||!task.files.length||task.files.some(f=>!exactPath(f)))bad(`task ${task.id} requires exact write paths`);
  for(const f of task.files||[]){if(writes.has(f))bad(`overlapping task write path ${f}`);if(!body.scope.included.includes(f)||body.scope.excluded.includes(f))bad(`task write outside included scope: ${f}`);writes.add(f);}
  if(!ids(task.blocked_by)||task.blocked_by.some(id=>!taskById.has(id)))bad(`task ${task.id} has invalid dependencies`);
  if(!ids(task.ac_ids)||!task.ac_ids.length)bad(`task ${task.id} requires AC IDs`);
  if(!ids(task.validation_ids)||!task.validation_ids.length||task.validation_ids.some(id=>!validationIds.includes(id)))bad(`task ${task.id} has invalid validation references`);
  for(const id of task.ac_ids||[]) {
   const normalized=String(id).toLowerCase();covered.add(normalized);
   if(!known.has(normalized))bad(`task ${task.id} references unknown AC ${id}`);
   if(!validations.some(v=>(task.validation_ids||[]).includes(v?.id)&&(v.ac_ids||[]).some(a=>String(a).toLowerCase()===normalized)))bad(`task ${task.id} AC ${id} has no linked proof`);
  }
  if(!Array.isArray(task.context_refs))bad(`task ${task.id} context_refs must be an array`);
  for(const ref of task.context_refs||[]) {
   if(!object(ref)||!exactPath(ref.path)||!Number.isInteger(ref.start_line)||!Number.isInteger(ref.end_line)||ref.start_line<1||ref.end_line<ref.start_line||!hash(ref.excerpt_sha256)){bad(`task ${task.id} has invalid immutable context reference`);continue;}
   try {
    const lines=readFile(ref.path).split('\n');
    if(ref.end_line>lines.length || sha(lines.slice(ref.start_line-1,ref.end_line).join('\n'))!==ref.excerpt_sha256)bad(`stale context hash/range: ${ref.path}`);
   } catch(e){bad(`cannot read context ${ref.path}: ${e.message}`);}
  }
 }
 for(const f of body.scope.included)if(!writes.has(f))bad(`unused write scope path ${f}`);
 for(const id of known)if(!covered.has(id))bad(`AC ${id} has no implementing task`);
 const visiting=new Set(),done=new Set();
 function visit(id){if(visiting.has(id)){bad(`task dependency cycle at ${id}`);return;}if(done.has(id))return;visiting.add(id);for(const dep of taskById.get(id)?.blocked_by||[])if(taskById.has(dep))visit(dep);visiting.delete(id);done.add(id);}
 for(const id of taskIds)visit(id);
 const sequence=body.execution_command_sequence;
 if(!Array.isArray(sequence)||!sequence.length)bad('execution sequence must be non-empty');
 let prior=0;
 for(const step of Array.isArray(sequence)?sequence:[]) {
  if(!object(step)){bad('invalid execution step');continue;}
  if(!Number.isInteger(step.step)||step.step<=prior)bad('execution step IDs must be unique increasing positive integers');prior=step.step;
  const release=Object.hasOwn(step,'producer');
  const keys=release?['step','producer','verifier','consumer_skill','expected_outcome']:['step','command','expected_outcome'];
  if(Object.keys(step).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(step,k)))bad(`execution step ${step.step} has mixed or unsupported fields`);
  if(!text(step.expected_outcome))bad('execution step needs expected outcome');
  if(!release){if(!text(step.command))bad('execution command required');continue;}
  if(!['land-changeset','verify-promotion'].includes(step.consumer_skill))bad('producer entries require an existing release consumer');
  if(!object(step.producer)||!exactPath(step.producer.artifact)||!topLevelKey(step.producer.field)||!text(step.producer.command))bad('release producer requires artifact, literal field and command');
  if(!object(step.verifier)||!text(step.verifier.command)||!text(step.verifier.expected_outcome))bad('release verifier requires command and expected outcome');
 }
 if(body.schema_version===5){
  const approaches=Array.isArray(body.implementation_approach)?body.implementation_approach:[];
  if(!approaches.length)bad('implementation_approach must be non-empty');
  if(!ids(approaches.map(a=>a?.id)))bad('implementation approach IDs must be unique strings');
  for(const a of approaches){
   if(!object(a)||!text(a.approach)||!text(a.interfaces)||!text(a.state_and_ownership)||!text(a.failure_and_recovery))bad(`implementation approach ${a?.id} needs substantive decision fields`);
   if(!ids(a.requirement_ids)||!a.requirement_ids.length||!ids(a.source_ids)||!a.source_ids.length)bad(`implementation approach ${a?.id} needs unique requirement and source IDs`);
   if(!ids(a.task_ids)||!a.task_ids.length||a.task_ids.some(id=>!taskById.has(id)))bad(`implementation approach ${a?.id} has invalid task_ids`);
   if(!ids(a.validation_ids)||!a.validation_ids.length||a.validation_ids.some(id=>!validationIds.includes(id)))bad(`implementation approach ${a?.id} has invalid validation_ids`);
  }
  const disc=body.executor_discretion;
  if(!object(disc)||!Array.isArray(disc.local_repairs)||!disc.local_repairs.length||!disc.local_repairs.every(text)||!Array.isArray(disc.amendment_triggers)||!disc.amendment_triggers.length||!disc.amendment_triggers.every(text)||!text(disc.disagreement_protocol))bad('executor_discretion requires local_repairs, amendment_triggers and disagreement_protocol');
  if(body.mode!=='inline'){
   const blueprints=Array.isArray(body.changeset_blueprints)?body.changeset_blueprints:[];
   const files=blueprints.map(b=>b?.file);
   if(!ids(files)||files.length!==body.scope.included.length||body.scope.included.some(f=>!files.includes(f)))bad('dispatch blueprints must cover included files exactly once');
   for(const b of blueprints){
    if(!object(b)||!exactPath(b.file)||!['CREATE','MODIFY','DELETE'].includes(b.action)||!text(b.blueprint))bad(`invalid blueprint for ${b?.file}`);
   }
  }
  if(consumerRoot){try{assertV5LiveBindings(body,consumerRoot);}catch(e){bad(e.message);}}
 }
 return {ok:errors.length===0,errors};
}

function checked(body,readers){const v=validatePlanBody(body,readers);if(!v.ok)throw new Error(v.errors.join('; '));}
export function projectPlanViews(body,readers) {
 checked(body,readers);
 const escape=s=>String(s).replaceAll('|','\\|').replace(/[\r\n]/g,' ');
 return ['| Task | AC IDs | Validation IDs | Write paths |','|---|---|---|---|',...body.task_graph.map(t=>`| ${escape(t.id)} | ${escape(t.ac_ids.join(', '))} | ${escape(t.validation_ids.join(', '))} | ${escape(t.files.join(', '))} |`),'','| Validation | AC IDs | Observation | Expected outcome |','|---|---|---|---|',...body.validation_plan.map(v=>`| ${escape(v.id)} | ${escape(v.ac_ids.join(', '))} | ${escape(v.observation_kind)} | ${escape(v.expected_outcome)} |`)].join('\n');
}
export function taskContext(body,taskId,{readSpec,readFile}={}) {
 const snapshots=new Map();
 const sourceReader=readSpec,contextReader=readFile||readSpec;
 readSpec=p=>{if(!snapshots.has(p))snapshots.set(p,sourceReader(p));return snapshots.get(p);};
 readFile=p=>{if(!snapshots.has(p))snapshots.set(p,contextReader(p));return snapshots.get(p);};
 checked(body,{readSpec,readFile});const task=body.task_graph.find(t=>t.id===taskId);if(!task)throw new Error(`unknown task ${taskId}`);
 const chunks=[`Task ${task.id}\nApplicable AC IDs: ${task.ac_ids.join(', ')}\nExact write paths: ${task.files.join(', ')}`,`Authoritative AC section (${body.ac_digests.spec_path}):\n${extractAcSection(readSpec(body.ac_digests.spec_path))}`];
 for(const ref of task.context_refs) {
  const lines=readFile(ref.path).split('\n');
  if(ref.end_line>lines.length)throw new Error(`stale context range: ${ref.path}`);
  const excerpt=lines.slice(ref.start_line-1,ref.end_line).join('\n');
  if(sha(excerpt)!==ref.excerpt_sha256)throw new Error(`stale context hash: ${ref.path}`);
  chunks.push(`Reviewed context ${ref.path}:${ref.start_line}:\n${excerpt}`);
 }
 if(body.schema_version===5){
  chunks.push(`Implementation approaches:\n${JSON.stringify(body.implementation_approach,null,2)}`);
  chunks.push(`Executor discretion:\n${JSON.stringify(body.executor_discretion,null,2)}`);
 }
 return chunks.join('\n\n')+'\n';
}
