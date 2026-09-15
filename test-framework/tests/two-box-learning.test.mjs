// Offline candidate promotion regression; no provider calls.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import {hasFrameworkLearningCredit} from '../../scripts/learning-lifecycle.mjs';
const script=new URL('../../scripts/learning-lifecycle.mjs', import.meta.url).pathname;
test('box candidates can be captured but cannot become learning credit without observed outcomes and evaluation',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ssve-learning-origin-'));fs.mkdirSync(path.join(root,'.svc'));
 try{for(const origin of ['open_box','contract_box']){
  const key='candidate-'+origin;const r=spawnSync(process.execPath,[script,'capture','--root',root,'--key',key,'--origin',origin],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
  assert.equal(JSON.parse(r.stdout).elevated,false);assert.equal(hasFrameworkLearningCredit(root,key),false);
  const promote=spawnSync(process.execPath,[script,'elevate','--root',root,'--key',key,'--origin',origin],{encoding:'utf8'});assert.notEqual(promote.status,0);assert.equal(hasFrameworkLearningCredit(root,key),false);
 }}finally{fs.rmSync(root,{recursive:true,force:true});}
});
