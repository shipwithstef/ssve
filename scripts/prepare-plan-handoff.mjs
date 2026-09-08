#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {parsePlanManifest,validatePlanBody,projectPlanViews,taskContext,packageCapabilities,containedReader,VIEW_START,VIEW_END} from './lib/plan-manifest-contract.mjs';
import {writeJsonAtomic,withStateLock} from './state-io.mjs';
const args={};
try {
 for(let i=2;i<process.argv.length;i++){
  const a=process.argv[i];
  if(['--check','--write','--capabilities'].includes(a)){if(args[a])throw new Error('duplicate option');args[a]=true;}
  else if(['--manifest','--out','--task'].includes(a)&&process.argv[i+1]&&!process.argv[i+1].startsWith('--')){if(args[a])throw new Error('duplicate option');args[a]=process.argv[++i];}
  else throw new Error('unsupported or incomplete option: '+a);
 }
 const operations=['--check','--write','--capabilities','--task'].filter(k=>args[k]);
 if(operations.length!==1||(!args['--capabilities']&&!args['--manifest'])||(args['--write']&&!args['--out']))throw new Error('use --capabilities, or --manifest PATH with --check | --task ID | --write --out IGNORED_PATH');
} catch(e){console.error(e.message);process.exit(2);}
try {
 const caps=packageCapabilities();
 if(args['--capabilities']){console.log(JSON.stringify(caps,null,2));process.exit(0);}
 const root=fs.realpathSync(execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim());
 const relative=path.relative(root,path.resolve(args['--manifest']));const read=containedReader(root);const markdown=read(relative),body=parsePlanManifest(markdown);
 if(body.schema_version!==4||body.mode!=='inline')throw new Error('preparation issues only explicit inline v4; legacy plans keep their current consumers');
 const readers={readSpec:read,readFile:read};const result=validatePlanBody(body,readers);if(!result.ok)throw new Error(result.errors.join('; '));
 // Validate every immutable reference, including tasks not selected for immediate handoff.
 for(const t of body.task_graph)taskContext(body,t.id,readers);
 if(args['--task']){process.stdout.write(taskContext(body,args['--task'],readers));process.exit(0);}
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
  if(fs.existsSync(output)&&fs.lstatSync(output).isSymbolicLink())throw new Error('output symlink is not allowed');
  // The manifest was read through a contained reader; only its generated region changes.
  const target=fs.realpathSync(path.join(root,relative));
  withStateLock(target,()=>{
   if(fs.readFileSync(target,'utf8')!==markdown)throw new Error('manifest changed during projection; retry from current bytes');
   const temporary=`${target}.${process.pid}.tmp`;
   try {fs.writeFileSync(temporary,updated,{flag:'wx',mode:fs.statSync(target).mode&0o777});fs.renameSync(temporary,target);}
   finally {if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
   writeJsonAtomic(output,body); // Publish only after the locked manifest compare/update succeeds.
  });
  console.log('PLAN HANDOFF WRITTEN; review the resulting candidate before execution');
 }
} catch(e){console.error(`prepare-plan-handoff: ${e.message}`);process.exit(1);}
