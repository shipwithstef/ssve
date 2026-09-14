import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
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
