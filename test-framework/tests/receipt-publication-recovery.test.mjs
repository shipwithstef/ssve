import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { publishReceiptNotes } from '../../scripts/lib/publish-receipt-notes.mjs';

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-notes-recovery-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(dir, 'init', '--bare', 'remote');
  for (const name of ['a', 'b']) {
    git(dir, 'clone', path.join(dir, 'remote'), name);
    git(path.join(dir,name), 'config', 'user.email', 'test@example.invalid');
    git(path.join(dir,name), 'config', 'user.name', 'Test');
  }
  const a = path.join(dir,'a'), b = path.join(dir,'b');
  git(a, 'commit', '--allow-empty', '-m', 'one');
  const one = git(a,'rev-parse','HEAD');
  git(a, 'commit', '--allow-empty', '-m', 'two');
  const two = git(a,'rev-parse','HEAD');
  git(a,'push','origin','HEAD:refs/heads/main');
  git(b,'fetch','origin','main');
  const read = (sha) => JSON.parse(git(path.join(dir,'remote'),'notes','--ref=svc-receipts','show',sha));
  return { dir, a,b,git,one,two,read };
}

test('stale local cache and divergent local notes cannot discard remote collaborators', t => {
  const f = fixture(t);
  publishReceiptNotes(f.a,{[f.one]:{ownerA:{pass:true}}});
  f.git(f.a,'fetch','origin','refs/notes/svc-receipts:refs/notes/svc-receipts-remote-view');
  publishReceiptNotes(f.b,{[f.two]:{ownerB:{pass:true}}});
  f.git(f.a,'notes','--ref=svc-receipts','add','-m','{"localOnly":true}',f.two);
  publishReceiptNotes(f.a,{[f.one]:{newSlot:{pass:true}}});
  assert.deepEqual(f.read(f.one),{ownerA:{pass:true},newSlot:{pass:true}});
  assert.deepEqual(f.read(f.two),{ownerB:{pass:true}});
  publishReceiptNotes(f.a,{[f.one]:{newSlot:{pass:true}}});
  assert.deepEqual(f.read(f.two),{ownerB:{pass:true}});
});

test('conflicting evidence is refused and remote history remains unchanged', t => {
  const f = fixture(t);
  publishReceiptNotes(f.a,{[f.one]:{review:{pass:true}}});
  const before=f.git(path.join(f.dir,'remote'),'rev-parse','refs/notes/svc-receipts');
  assert.throws(()=>publishReceiptNotes(f.b,{[f.one]:{review:{pass:false}}}),/Conflicting receipt/);
  assert.equal(f.git(path.join(f.dir,'remote'),'rev-parse','refs/notes/svc-receipts'),before);
});

test('a competing publisher between fetch and push is preserved on retry', t => {
  const f = fixture(t);
  publishReceiptNotes(f.a,{[f.one]:{first:true}});
  f.git(f.b,'fetch','origin','refs/notes/svc-receipts:refs/notes/svc-receipts');
  f.git(f.b,'notes','--ref=svc-receipts','add','-m','{"competitor":true}',f.two);
  const hook=path.join(f.a,'.git/hooks/pre-push');
  fs.writeFileSync(hook,`#!/bin/sh\nrm -- "$0"\ngit -C '${f.b}' push origin refs/notes/svc-receipts:refs/notes/svc-receipts\n`);
  fs.chmodSync(hook,0o755);
  publishReceiptNotes(f.a,{[f.one]:{second:true}});
  assert.deepEqual(f.read(f.one),{first:true,second:true});
  assert.deepEqual(f.read(f.two),{competitor:true});
});

test('coverage replay preserves prior evidence timestamp but refuses changed proof', t => {
  const f = fixture(t);
  const proof={receipt_type:'skill-coverage',graph_digest:'same',generated_at:'first'};
  publishReceiptNotes(f.a,{[f.one]:{coverage:proof}});
  publishReceiptNotes(f.b,{[f.one]:{coverage:{...proof,generated_at:'later'}}});
  assert.deepEqual(f.read(f.one).coverage,proof);
  assert.throws(()=>publishReceiptNotes(f.b,{[f.one]:{coverage:{...proof,graph_digest:'changed'}}}),/Conflicting receipt/);
});

test('already merged PR skips merge and freshness, binds candidate instead of checkout HEAD', t => {
  const f=fixture(t);
  const bin=path.join(f.dir,'bin');fs.mkdirSync(bin);
  const log=path.join(f.dir,'gh-calls');
  const meta={state:'MERGED',baseRefOid:f.two,headRefOid:f.one,headRefName:'feature',mergeCommit:{oid:f.two}};
  fs.writeFileSync(path.join(bin,'gh'),`#!/bin/sh\nprintf '%s\\n' "$*" >> '${log}'\nif [ "$1 $2" = 'pr view' ]; then\ncat <<'JSON'\n${JSON.stringify(meta)}\nJSON\nelse\nexit 97\nfi\n`);fs.chmodSync(path.join(bin,'gh'),0o755);
  fs.mkdirSync(path.join(f.a,'.svc/review-receipts'),{recursive:true});
  fs.writeFileSync(path.join(f.a,'proof.txt'),'review evidence');
  fs.writeFileSync(path.join(f.a,'.svc/review-receipts/pr-1.json'),JSON.stringify({pr:1,review_gate_required:true,review_gate_task:'G5',reviewer:'independent',reviewed_at:new Date().toISOString(),result:'PASS',self_review:false,evidence:['proof.txt']}));
  const script=new URL('../../scripts/merge-pr-with-review-receipt.mjs',import.meta.url).pathname;
  let output='';
  try {execFileSync(process.execPath,[script,'--root',f.a,'--pr','1','--repo','fixture/repo','--squash','--subject','fix','--body','none','--net-files','code.mjs'],{env:{...process.env,PATH:`${bin}:${process.env.PATH}`},encoding:'utf8',stdio:['ignore','pipe','pipe']});}
  catch(e){output=e.stdout+e.stderr;assert.equal(e.status,3,output);}
  assert.match(output,/PR already merged; resuming receipt finalization/);
  assert.match(output,/coverage verify failed/); // Deliberately absent chain receipts: no false success/publication.
  assert.doesNotMatch(fs.readFileSync(log,'utf8'),/pr merge|^api /m);
  assert.throws(()=>f.git(path.join(f.dir,'remote'),'rev-parse','--verify','refs/notes/svc-receipts'));
});

for (const [lag,stale] of [[false,false],[true,false],[false,true]]) test(`fresh clone recovers exact candidate object and published proof; GitHub lag=${lag}, stale local=${stale}`, t => {
  const f=fixture(t);
  fs.writeFileSync(path.join(f.a,'feature.txt'),'reviewed feature');
  f.git(f.a,'add','feature.txt');f.git(f.a,'commit','-m','candidate');
  const candidate=f.git(f.a,'rev-parse','HEAD'),tree=f.git(f.a,'rev-parse','HEAD^{tree}');
  const squash=f.git(f.a,'commit-tree',tree,'-p',f.two,'-m','squashed');
  f.git(f.a,'push','origin',`${candidate}:refs/pull/1/head`,`${squash}:refs/heads/main`);
  publishReceiptNotes(f.a,{[candidate]:{sentinel:{candidate}}});
  f.git(f.dir,'clone','--no-local','--single-branch','--branch','main',path.join(f.dir,'remote'),'fresh');
  const fresh=path.join(f.dir,'fresh');
  f.git(fresh,'config','user.email','test@example.invalid');f.git(fresh,'config','user.name','Test');
  assert.throws(()=>f.git(fresh,'cat-file','-e',candidate));
  fs.writeFileSync(path.join(fresh,'other.txt'),'unrelated checkout head');f.git(fresh,'add','other.txt');f.git(fresh,'commit','-m','different HEAD');
  if (stale) f.git(fresh,'notes','--ref=svc-receipts','add','-m','{"localOnly":true}',candidate);
  const bin=path.join(f.dir,'bin');fs.mkdirSync(bin);const log=path.join(f.dir,'gh-calls');
  const meta={state:'MERGED',baseRefOid:f.two,headRefOid:candidate,headRefName:'feature',mergeCommit:{oid:squash}};
  const first={...meta,mergeCommit:lag?null:meta.mergeCommit};
  fs.writeFileSync(path.join(bin,'gh'),`#!/bin/sh\nprintf '%s\\n' "$*" >> '${log}'\nif [ "$1 $2" != 'pr view' ]; then exit 97; fi\ncase "$*" in\n *baseRefOid*) printf '%s\\n' '${JSON.stringify(first)}' ;;\n *) printf '%s\\n' '${JSON.stringify(meta)}' ;;\nesac\n`);fs.chmodSync(path.join(bin,'gh'),0o755);
  fs.mkdirSync(path.join(fresh,'.svc/review-receipts'),{recursive:true});fs.writeFileSync(path.join(fresh,'proof.txt'),'reviewed');
  fs.writeFileSync(path.join(fresh,'.svc/review-receipts/pr-1.json'),JSON.stringify({pr:1,review_gate_required:true,review_gate_task:'G5',reviewer:'independent',reviewed_at:new Date().toISOString(),result:'PASS',self_review:false,evidence:['proof.txt']}));
  const script=new URL('../../scripts/merge-pr-with-review-receipt.mjs',import.meta.url).pathname;
  assert.throws(()=>execFileSync(process.execPath,[script,'--root',fresh,'--pr','1','--repo','fixture/repo','--squash','--subject','fix','--body','none','--net-files','code.mjs'],{env:{...process.env,PATH:`${bin}:${process.env.PATH}`},encoding:'utf8',stdio:['ignore','pipe','pipe']}),e=>{
    assert.equal(e.status,3,e.stdout+e.stderr);assert.match(e.stdout,/already merged/);assert.match(e.stderr,/coverage verify failed/);return true;
  });
  assert.equal(f.git(fresh,'rev-parse',`${candidate}^{tree}`),tree);
  assert.deepEqual(JSON.parse(f.git(fresh,'notes','--ref=svc-receipts','show',squash)),{sentinel:{candidate},...(stale?{localOnly:true}:{})});
  assert.doesNotMatch(fs.readFileSync(log,'utf8'),/pr merge|^api /m);
  assert.throws(()=>f.read(squash)); // Incomplete proof never published.
});
