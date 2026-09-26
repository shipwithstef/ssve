import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { derivePrReviewReceipt, generatePrReviewReceipt } from '../../scripts/lib/pr-review-receipt.mjs';

test('PR compatibility metadata derives from exact passing G5 evidence', () => {
 const sha='a'.repeat(40),review={receipt_type:'review-exec',target_sha:sha,wi:'WI-TEST',verdict:'pass-with-findings',timestamp:'2026-09-08T10:00:00Z',adversarial_review:{primary_reviewer_host:'grok'}};
 const input={pr:8,sha,repo:'fixture/repo',envelope:{review},chain:{ok:true,results:[{sha,ok:true}]}};
 const result=derivePrReviewReceipt(input);assert.equal(result.schema_version,1);assert.equal(result.candidate_sha,sha);assert.equal(result.reviewer,'grok');assert.equal(result.reviewed_at,review.timestamp);assert.deepEqual(result.source_wis,['WI-TEST']);
 for(const changed of [{chain:{ok:false}},{chain:{ok:true,results:[]}},{chain:{ok:true,results:[{sha:'b'.repeat(40),ok:true}]}},{envelope:{review:{...review,target_sha:'b'.repeat(40)}}},{envelope:{review:{...review,verdict:'fail'}}}])assert.throws(()=>derivePrReviewReceipt({...input,...changed}));
});

test('matching GitHub metadata alone never generates approval without canonical receipts', () => {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pr-proof-'));
 const priorPath=process.env.PATH;
 try {
  const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:'pipe'}).trim();
  git('init');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid');git('commit','--allow-empty','-m','fixture');const sha=git('rev-parse','HEAD');
  const bin=path.join(root,'bin');fs.mkdirSync(bin);fs.writeFileSync(path.join(bin,'gh'),'#!/bin/sh\ncat <<\'JSON\'\n'+JSON.stringify({headRefOid:sha,headRefName:'feature'})+'\nJSON\n',{mode:0o700});process.env.PATH=bin+path.delimiter+priorPath;
  assert.throws(()=>generatePrReviewReceipt({root,pr:8,repo:'fixture/repo',expectedHead:'feature',expectedSha:sha}));
  assert.equal(fs.existsSync(path.join(root,'.svc/review-receipts/pr-8.json')),false);
  assert.throws(()=>generatePrReviewReceipt({root,pr:8,repo:'fixture/repo',expectedHead:'other',expectedSha:sha}),/identity differs/);
 } finally {process.env.PATH=priorPath;fs.rmSync(root,{recursive:true,force:true});}
});


test('merge wrapper dry run binds named and adopted WI IDs to exact net-diff evidence', () => {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pr-named-wi-'));
 const wrapper=path.resolve('scripts/merge-pr-with-review-receipt.mjs');
 try {
  const receiptDir=path.join(root,'.svc/review-receipts');fs.mkdirSync(receiptDir,{recursive:true});
  fs.writeFileSync(path.join(receiptDir,'pr-8.json'),JSON.stringify({schema_version:1,pr:8,reviewed_at:'2026-09-26T00:00:00Z',review_gate_task:'review-exec',reviewer:'fixture independent reviewer',result:'PASS',evidence:['fixture review artifact'],review_gate_required:true}));
  const run=(subject,body,files)=>spawnSync(process.execPath,[wrapper,'--pr','8','--root',root,'--repo','fixture/repo','--dry-run','--subject',subject,'--body',body,'--net-files',files],{cwd:root,encoding:'utf8'});
  const adopted=run('Deliver WI-GH-42','Related to #42','docs/specs/work-items/WI-GH-42.md');
  assert.equal(adopted.status,0,adopted.stderr);assert.match(adopted.stdout,/DRY-RUN: gh pr merge/);
  const prefixCollision=run('Deliver WI-GH-4','Related to #4','docs/specs/work-items/WI-GH-42.md');
  assert.equal(prefixCollision.status,2);assert.match(prefixCollision.stderr,/WI-GH-4.*no net-diff evidence/);
  const named=run('Deliver WI-SPINE-003 and WI-570','Related to #42','docs/specs/work-items/WI-SPINE-003.md,docs/specs/work-items/WI-570.md');
  assert.equal(named.status,0,named.stderr);
  const omitted=run('Discuss WI-GH-42','omitted: WI-GH-42','docs/readme.md');
  assert.equal(omitted.status,0,omitted.stderr);
  const missing=run('Discuss WI-GH-42','Related to #42','docs/readme.md');
  assert.equal(missing.status,2);assert.match(missing.stderr,/WI-GH-42.*no net-diff evidence/);
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});
