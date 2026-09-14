#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
node --input-type=module - "$ROOT" "$TMP" <<'NODE'
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
const [root, tmp] = process.argv.slice(2); const repo=path.join(tmp,"repo"); const stateRoot=path.join(repo,".svc","runtime");
const git=(args)=>execFileSync("git",["-C",repo,...args],{encoding:"utf8"}).trim();
fs.mkdirSync(repo,{recursive:true}); execFileSync("git",["-C",repo,"init","-q"]); git(["config","user.name","fixture"]); git(["config","user.email","fixture@example.invalid"]);
git(["remote","add","origin","git@github.com:fixture/repo.git"]);fs.mkdirSync(path.join(repo,"scripts"));for(const name of ["merge-pr-with-review-receipt.mjs","svc-auto-drive.mjs"])fs.writeFileSync(path.join(repo,"scripts",name),"// fixture\n");
fs.writeFileSync(path.join(repo,"base"),"base\n"); git(["add","base"]); git(["commit","-qm","base"]); git(["branch","-M","feature-a"]);
for(const dir of [path.join(repo,".svc","claims"),path.join(repo,".svc","bindings"),stateRoot])fs.mkdirSync(dir,{recursive:true});
const session="session-a", wi="WI-541", generation=4, taskId="12", now=new Date().toISOString();
const claim={schema_version:1,wi,generation,repo_root:repo,worktree_root:repo,branch:"feature-a",session_id:session,role:"mutating",started_at:now,renewed_at:now,ttl_hours:24};
const claimPath=path.join(repo,".svc","claims",`${wi}.claim.json`);fs.writeFileSync(claimPath,JSON.stringify(claim),{mode:0o600});
fs.writeFileSync(path.join(repo,".svc","bindings","session.json"),JSON.stringify({schema_version:1,session_id:session,role:"mutating",wi,repo_root:repo,worktree_root:repo,branch:"feature-a",claim_path:claimPath,generation}),{mode:0o600});
fs.writeFileSync(path.join(repo,".svc",`lane-tasks-${wi}.json`),JSON.stringify({schema_version:1,wi,tasks:[{id:12,status:"in_progress",metadata:{skill:"land-changeset"}}]}));
fs.writeFileSync(path.join(repo,"candidate"),"candidate\n");git(["add","candidate"]);
const api=await import(pathToFileURL(path.join(root,"hooks/codex/lib/promotion-capability.mjs")));
const command=["git","commit","-m","local land fixture"];
const tuple=api.currentPromotionTuple({repoRoot:repo,worktreeRoot:repo,wi,sessionId:session,generation,taskId,environment:"local",operation:"local-land",commandArgv:command});
for(const widened of [["git","commit","-n","-m","x"],["git","commit","-a","-m","x"],["git","commit","--amend","-m","x"]]) assert.throws(()=>api.currentPromotionTuple({repoRoot:repo,worktreeRoot:repo,wi,sessionId:session,generation,taskId,environment:"local",operation:"local-land",commandArgv:widened}),/permits only/);
assert.throws(()=>api.currentPromotionTuple({repoRoot:repo,worktreeRoot:repo,wi,sessionId:session,generation,taskId,environment:"remote",operation:"remote-promotion",commandArgv:["git","push","--force","origin","feature-a"]}),/permits only/);
assert.throws(()=>api.currentPromotionTuple({repoRoot:repo,worktreeRoot:repo,wi,sessionId:session,generation,taskId,environment:"remote",operation:"remote-promotion",commandArgv:["git","push","-u","origin","feature-a"]}),/permits only/);
assert.throws(()=>api.currentPromotionTuple({repoRoot:repo,worktreeRoot:repo,wi,sessionId:session,generation,taskId,environment:"remote",operation:"remote-promotion",commandArgv:["gh","pr","merge","123","--squash","--delete-branch"]}),/permits only/);
assert.doesNotThrow(()=>api.currentPromotionTuple({repoRoot:repo,worktreeRoot:repo,wi,sessionId:session,generation,taskId,environment:"remote",operation:"remote-promotion",commandArgv:["git","push","origin",`${tuple.head_sha}:refs/heads/feature-a`]}));
assert.doesNotThrow(()=>api.currentPromotionTuple({repoRoot:repo,worktreeRoot:repo,wi,sessionId:session,generation,taskId,environment:"remote",operation:"remote-promotion",commandArgv:["node","scripts/merge-pr-with-review-receipt.mjs","--pr","123","--squash","--delete-branch","--expected-repo","fixture/repo","--expected-head","feature-a","--expected-head-sha",tuple.head_sha]}));
const foreign=path.join(tmp,"foreign","scripts");fs.mkdirSync(foreign,{recursive:true});fs.writeFileSync(path.join(foreign,"svc-auto-drive.mjs"),"// foreign\n");
assert.throws(()=>api.currentPromotionTuple({repoRoot:repo,worktreeRoot:repo,wi,sessionId:session,generation,taskId,environment:"production",operation:"production-verify",commandArgv:["node",path.join(foreign,"svc-auto-drive.mjs"),tuple.head_sha]}),/canonical in-worktree/);
assert.throws(()=>api.currentPromotionTuple({repoRoot:repo,worktreeRoot:repo,wi,sessionId:session,generation,taskId,environment:"production",operation:"production-verify",commandArgv:["node","scripts/not-verify-promotion.mjs",git(["rev-parse","HEAD"])]}),/permits only|ENOENT/);
const issued=api.mintPromotionCapability({stateRoot,tuple,ttlMs:1000});
assert.equal(api.consumePromotionCapability({stateRoot,capabilityId:issued.capability.capability_id,token:issued.token,expected:tuple}).state,"consumed");
assert.throws(()=>api.consumePromotionCapability({stateRoot,capabilityId:issued.capability.capability_id,token:issued.token,expected:tuple}),/consumed|missing/);
assert.throws(()=>api.mintPromotionCapability({stateRoot,tuple:{...tuple,branch:"foreign"}}),/branch mismatch/);
assert.throws(()=>api.mintPromotionCapability({stateRoot,tuple:{...tuple,generation:999}}),/claim tuple mismatch/);
assert.throws(()=>api.mintPromotionCapability({stateRoot,tuple:{...tuple,worktree_root:path.join(tmp,"missing")}}),/ENOENT|insecure/);
const traversal=api.mintPromotionCapability({stateRoot,tuple,ttlMs:1000});assert.throws(()=>api.consumePromotionCapability({stateRoot,capabilityId:"../claims/WI-541.claim",token:traversal.token,expected:tuple}),/UUID/);assert.ok(fs.existsSync(claimPath));
const forgedId=crypto.randomUUID();const forgedToken="forged";const forgedRecord={schema_version:2,capability_id:forgedId,tuple,token_sha256:crypto.createHash("sha256").update(forgedToken).digest("hex"),issued_at:new Date().toISOString(),expires_at:new Date(Date.now()+1000).toISOString(),state:"issued"};fs.mkdirSync(path.join(stateRoot,"promotion-capabilities"),{recursive:true});fs.writeFileSync(path.join(stateRoot,"promotion-capabilities",`${forgedId}.json`),JSON.stringify(forgedRecord),{mode:0o600});
assert.throws(()=>api.consumePromotionCapability({stateRoot,capabilityId:forgedId,token:forgedToken,expected:tuple}),/issuance|ENOENT|no such file/i);
const reordered=Object.fromEntries(Object.entries(tuple).reverse());const orderSafe=api.mintPromotionCapability({stateRoot,tuple,ttlMs:1000});assert.equal(api.consumePromotionCapability({stateRoot,capabilityId:orderSafe.capability.capability_id,token:orderSafe.token,expected:reordered}).state,"consumed");
const malformed=api.mintPromotionCapability({stateRoot,tuple,ttlMs:1000});const malformedPath=path.join(stateRoot,"promotion-capabilities",`${malformed.capability.capability_id}.json`);const malformedRecord=JSON.parse(fs.readFileSync(malformedPath,"utf8"));malformedRecord.expires_at="not-a-timestamp";fs.writeFileSync(malformedPath,JSON.stringify(malformedRecord));
assert.throws(()=>api.consumePromotionCapability({stateRoot,capabilityId:malformed.capability.capability_id,token:malformed.token,expected:tuple}),/lifetime is invalid/);
const drifted=api.mintPromotionCapability({stateRoot,tuple,ttlMs:1000});fs.appendFileSync(path.join(repo,"candidate"),"drift\n");git(["add","candidate"]);
assert.throws(()=>api.consumePromotionCapability({stateRoot,capabilityId:drifted.capability.capability_id,token:drifted.token,expected:tuple}),/tree changed/);
fs.writeFileSync(path.join(repo,"candidate"),"candidate\n");git(["add","candidate"]);

// The capability is consumed by the real local-land boundary before git commit.
const cli=path.join(root,"scripts/svc-owner-recovery.mjs"); const common=["--repo",repo,"--worktree",repo,"--state-root",stateRoot,"--wi",wi,"--generation",String(generation),"--task",taskId,"--environment","local","--operation","local-land"];
const env={...process.env,SVC_SESSION_ID:session}; const mint=spawnSync(process.execPath,[cli,"promote-mint",...common,"--",...command],{encoding:"utf8",env});assert.equal(mint.status,0,mint.stderr);const cap=JSON.parse(mint.stdout);
const widenedExec=spawnSync(process.execPath,[cli,"promote-exec",...common,"--capability",cap.capability.capability_id,"--token",cap.token,"--","git","commit","-a","-m","local land fixture"],{encoding:"utf8",env});assert.notEqual(widenedExec.status,0);assert.equal(git(["log","-1","--pretty=%s"]),"base");
const landed=spawnSync(process.execPath,[cli,"promote-exec",...common,"--capability",cap.capability.capability_id,"--token",cap.token,"--",...command],{encoding:"utf8",env});
assert.equal(landed.status,0,landed.stderr);assert.equal(git(["log","-1","--pretty=%s"]),"local land fixture");
const landSkill=fs.readFileSync(path.join(root,"skills/land-changeset/SKILL.md"),"utf8");assert.doesNotMatch(landSkill,/^git push(?:\s+-u)?\s+origin/m);assert.match(landSkill,/COMMAND=\(git push origin "\$HEAD_SHA:refs\/heads\/\$BRANCH"\)[\s\S]*promote-exec/);assert.match(landSkill,/COMMAND=\(node scripts\/merge-pr-with-review-receipt\.mjs[\s\S]*--expected-head-sha[\s\S]*promote-exec/);
console.log("PASS: promotion authority is current-repo/lease/branch/generation/head/tree/environment/operation bound and consumed by the mutation boundary");
NODE
