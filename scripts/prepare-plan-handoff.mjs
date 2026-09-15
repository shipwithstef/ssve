#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {parsePlanBytes,parsePlanManifest,validatePlanBody,projectPlanViews,taskContext,packageCapabilities,containedReader,VIEW_START,VIEW_END} from './lib/plan-manifest-contract.mjs';
import {writeJsonAtomic,withStateLock} from './state-io.mjs';
import {assertCurrentExecution,loadPlanAuthority,recordPlanAuthority} from './lib/receipt-issuance-epoch.mjs';
import {createTransmutationSeal} from './lib/transmutation-seal.mjs';
import {validateControlPlan} from './lib/control-plan-validate.mjs';
import {getObject} from './lib/review-evidence-store.mjs';
function parseSealRef(value) {
 if(/^[a-f0-9]{64}$/.test(value)) return {type:'object',sha256:value};
 const parsed=JSON.parse(value);
 if(!parsed||parsed.type!=='object'||typeof parsed.sha256!=='string'||!/^[a-f0-9]{64}$/.test(parsed.sha256)) throw new Error('invalid --seal-ref');
 return parsed;
}
function objectBytes(root,ref) {
 if(!ref||ref.type!=='object'||typeof ref.sha256!=='string'||!/^[a-f0-9]{64}$/.test(ref.sha256)) throw new Error('invalid object ref');
 const stored=getObject(ref.sha256,{start:root});
 const bytes=Buffer.isBuffer(stored)?stored:stored?.bytes;
 if(!bytes) throw new Error(`unresolved object ${ref.sha256}`);
 return Buffer.from(bytes);
}
function assertUnsealedV5Control(root,body) {
 const pc=body.planning_contract;
 if(pc?.kind!=='two_box') return;
 const control=JSON.parse(objectBytes(root,pc.control_plan_ref).toString('utf8'));
 const result=validateControlPlan({consumerRoot:root,body:control,requirementsRef:pc.original_requirements_ref,sourceSnapshotRef:pc.source_snapshot_ref});
 if(!result?.ok) throw new Error((result?.errors||['invalid control plan']).join('; '));
}
function rejectSymlinksAlong(root,absolute) {
 let cursor=fs.existsSync(absolute)?path.resolve(absolute):path.dirname(path.resolve(absolute));
 while(!fs.existsSync(cursor)) cursor=path.dirname(cursor);
 const stop=path.resolve(root);
 for(;;) {
  const st=fs.lstatSync(cursor);
  if(st.isSymbolicLink()) throw new Error('symlink rejected');
  if(cursor===stop||path.dirname(cursor)===cursor) break;
  cursor=path.dirname(cursor);
 }
}
const args={};
try {
 for(let i=2;i<process.argv.length;i++){
  const a=process.argv[i];
  if(['--check','--write','--capabilities'].includes(a)){if(args[a])throw new Error('duplicate option');args[a]=true;}
  else if(['--manifest','--out','--task','--seal-ref','--seal-after-review'].includes(a)&&process.argv[i+1]&&!process.argv[i+1].startsWith('--')){if(args[a])throw new Error('duplicate option');args[a]=process.argv[++i];}
  else throw new Error('unsupported or incomplete option: '+a);
 }
 const operations=['--check','--write','--capabilities','--task','--seal-after-review'].filter(k=>args[k]);
 if(operations.length!==1||(!args['--capabilities']&&!args['--manifest'])||(args['--write']&&!args['--out']))throw new Error('use --capabilities, or --manifest PATH with --check | --task ID --seal-ref REF | --write --out IGNORED_PATH');
} catch(e){console.error(e.message);process.exit(2);}
try {
 const caps=packageCapabilities();
 if(args['--capabilities']){console.log(JSON.stringify(caps,null,2));process.exit(0);}
 const root=fs.realpathSync(execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim());
 const relative=path.relative(root,path.resolve(args['--manifest']));const read=containedReader(root);const markdown=read(relative),body=parsePlanManifest(markdown);let planBytes=parsePlanBytes(markdown);
 if(body.schema_version===4)planBytes=loadPlanAuthority({consumerRoot:root,body}).planBytes;
 const readers={readSpec:read,readFile:read,consumerRoot:root};
 if(args['--seal-after-review']) {
  if(body.schema_version!==5)throw new Error('only v5 uses a separate transmutation seal');
  const ref=createTransmutationSeal({consumerRoot:root,body,planBytes,manifestPath:relative,reviewReceiptRef:parseSealRef(args['--seal-after-review'])});
  recordPlanAuthority({consumerRoot:root,body,planBytes,manifestPath:relative,sealRef:ref});
  process.stdout.write(JSON.stringify({seal_ref:ref,wi:body.wi})+'\n');process.exit(0);
 }

 if(args['--task']){
  const located=args['--seal-ref']?{}:loadPlanAuthority({consumerRoot:root,body});
  assertCurrentExecution({consumerRoot:root,body,planBytes,manifestPath:relative,sealRef:args['--seal-ref']?parseSealRef(args['--seal-ref']):located.sealRef});
  for(const t of body.task_graph)taskContext(body,t.id,readers);
  process.stdout.write(taskContext(body,args['--task'],readers));process.exit(0);
 }
 if(body.schema_version===5){
  const result=validatePlanBody(body,readers);if(!result.ok)throw new Error(result.errors.join('; '));
  assertUnsealedV5Control(root,body);
 } else if(body.schema_version===4){
  assertCurrentExecution({consumerRoot:root,body,planBytes,manifestPath:relative,sealRef:args['--seal-ref']?parseSealRef(args['--seal-ref']):undefined});
  if(args['--write'])throw new Error('frozen bootstrap cannot be rewritten');
  if(body.mode!=='inline')throw new Error('bootstrap v4 requires explicit inline mode');
  const result=validatePlanBody(body,readers);if(!result.ok)throw new Error(result.errors.join('; '));
 } else {
  throw new Error('preparation issues only current unsealed v5 or authentic bootstrap v4');
 }
 for(const t of body.task_graph)taskContext(body,t.id,readers);
 const view=`${VIEW_START}\n${projectPlanViews(body,readers)}\n${VIEW_END}`;
 const starts=markdown.split(VIEW_START).length-1,ends=markdown.split(VIEW_END).length-1;
 if(starts!==ends||starts>1)throw new Error('duplicate or unterminated generated view');
 let updated;
 if(starts){const a=markdown.indexOf(VIEW_START),b=markdown.indexOf(VIEW_END);if(b<a)throw new Error('malformed generated view');updated=markdown.slice(0,a)+view+markdown.slice(b+VIEW_END.length);}
 else updated=markdown+(markdown.endsWith('\n')?'':'\n')+'\n'+view+'\n';
 if(args['--check']){if(updated!==markdown)throw new Error('generated view is missing or stale; explicitly --write and review the changed candidate');console.log('PLAN HANDOFF PASS');}
 else {
  const output=path.resolve(root,args['--out']),rel=path.relative(root,output);
  if(rel.startsWith('..')||path.isAbsolute(rel)||!rel)throw new Error('receipt-body output must be an ignored file inside the worktree');
  execFileSync('git',['check-ignore','-q','--',rel],{cwd:root});
  // Reject escaping ancestors before creating an ignored projection.
  let ancestor=path.dirname(output);while(!fs.existsSync(ancestor))ancestor=path.dirname(ancestor);
  const real=fs.realpathSync(ancestor);if(real!==root&&!real.startsWith(root+path.sep))throw new Error('output ancestor escapes root');
  rejectSymlinksAlong(root,output);rejectSymlinksAlong(root,path.join(root,relative));
  if(fs.existsSync(output)&&fs.lstatSync(output).isSymbolicLink())throw new Error('output symlink is not allowed');
  const target=path.join(root,relative);
  if(fs.lstatSync(target).isSymbolicLink())throw new Error('manifest symlink is not allowed');
  withStateLock(target,()=>{
   if(fs.readFileSync(target,'utf8')!==markdown)throw new Error('manifest changed during projection; retry from current bytes');
   const temporary=`${target}.${process.pid}.tmp`;
   try {fs.writeFileSync(temporary,updated,{flag:'wx',mode:fs.statSync(target).mode&0o777});fs.renameSync(temporary,target);}
   finally {if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
  });
  withStateLock(output,()=>{
   rejectSymlinksAlong(root,output);
   const temp=`${output}.${process.pid}.tmp`;
   try { const fd=fs.openSync(temp,'wx',0o600);try{fs.writeFileSync(fd,planBytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(temp,output); }
   finally { if(fs.existsSync(temp))fs.unlinkSync(temp); }
  });
  console.log('PLAN HANDOFF WRITTEN; review the resulting candidate before execution');
 }
} catch(e){console.error(`prepare-plan-handoff: ${e.message}`);process.exit(1);}
