#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { issueDelegation, readDelegation } from "../../../hooks/lib/delegation-authority.mjs";
import { resolveChildTransport, verifyPersistedDelegation } from "../../../scripts/resolve-child-transport.mjs";

const host = { capabilities: { agents: true }, authority_capabilities: {
  stable_child_identity: true, mutating_child_execution: true, filesystem_containment: "wrapper",
} };
assert.equal(resolveChildTransport({ mutation: false, host }).decision, "read-only-native");
assert.equal(resolveChildTransport({ mutation: true, host }).decision, "controller", "generic agents flag cannot authorize mutation");

const asserted = { delegation_id: "invented", child_principal: "child-1", owner_generation: 3, worktree: "/repo/x", allowed_paths: ["src"], token: "invented", containment_probe: "pass", completion_receipt: "/tmp/x" };
assert.equal(resolveChildTransport({ mutation: true, host, delegation: asserted }).decision, "controller", "caller assertions cannot authorize mutation");

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"svc-child-transport-"));
const stateRoot=path.join(tmp,"state"); const inner=path.join(tmp,"inner"); fs.mkdirSync(stateRoot); fs.mkdirSync(inner);
const lease={state:"active",lease_id:crypto.randomUUID(),generation:3,repo_id:"repo-1",wi:"WI-541"};
const issued=issueDelegation({stateRoot,lease,childPrincipal:"child-1",taskId:"T04",waveId:"wave-1",innerWorktree:inner,allowedPaths:["src/**"],baseSha:"a".repeat(40)});
assert.throws(()=>readDelegation({stateRoot,delegationId:"../../forged"}),/UUID/);
const forgedId=crypto.randomUUID();const forgedOutside=path.join(tmp,"forged.json");fs.writeFileSync(forgedOutside,"{}",{mode:0o600});fs.symlinkSync(forgedOutside,path.join(stateRoot,"delegations",`${forgedId}.json`));
assert.throws(()=>readDelegation({stateRoot,delegationId:forgedId}),/insecure/);
const completion=path.join(stateRoot,"completion",`${issued.capability.delegation_id}.json`); fs.mkdirSync(path.dirname(completion));
const delegation=verifyPersistedDelegation({stateRoot,delegationId:issued.capability.delegation_id,childPrincipal:"child-1",token:issued.token,worktree:inner,completionReceipt:completion,hostManifest:host,containmentProbe:()=>({available:true,backend:"fixture"})});
const resolved = resolveChildTransport({ mutation: true, host, delegation });
assert.equal(resolved.decision, "delegated-wrapper");
assert.equal(resolved.mutating_child_authorized, true);
const exactFileDelegation={...delegation,allowed_paths:["src/new-file.txt"]};
const exactFallback=resolveChildTransport({mutation:true,host,delegation:exactFileDelegation});
assert.equal(exactFallback.decision,"controller");assert.match(exactFallback.reason,/exact-file mutation remains controller-owned/);
assert.throws(()=>verifyPersistedDelegation({stateRoot,delegationId:issued.capability.delegation_id,childPrincipal:"child-1",token:"wrong",worktree:inner,completionReceipt:completion,hostManifest:host,containmentProbe:()=>({available:true})}),/token mismatch/);
assert.throws(()=>verifyPersistedDelegation({stateRoot,delegationId:issued.capability.delegation_id,childPrincipal:"child-1",token:issued.token,worktree:inner,completionReceipt:path.join(tmp,"escape.json"),hostManifest:host,containmentProbe:()=>({available:true})}),/escapes/);
const delegationPath=path.join(stateRoot,"delegations",`${issued.capability.delegation_id}.json`);
const persisted=JSON.parse(fs.readFileSync(delegationPath,"utf8"));fs.writeFileSync(delegationPath,JSON.stringify({...persisted,expires_at:"not-a-timestamp"}));
assert.throws(()=>verifyPersistedDelegation({stateRoot,delegationId:issued.capability.delegation_id,childPrincipal:"child-1",token:issued.token,worktree:inner,completionReceipt:completion,hostManifest:host,containmentProbe:()=>({available:true})}),/expiry is invalid/);
fs.writeFileSync(delegationPath,JSON.stringify(persisted));
const policyPath=path.join(stateRoot,"transport-policy.json");fs.writeFileSync(policyPath,JSON.stringify({decision:"delegated-wrapper",allowed_paths:["src/**"]}));fs.mkdirSync(path.join(inner,".svc"));
const contained=spawnSync(process.execPath,[path.resolve("scripts/svc-contained-exec.mjs"),"run","--root",inner,"--policy",policyPath,"--","sh","-c","touch src/allowed.txt; touch .svc/denied.txt"],{encoding:"utf8"});
assert.notEqual(contained.status,0,`out-of-grant write unexpectedly passed: ${contained.stderr}`);assert.ok(fs.existsSync(path.join(inner,"src/allowed.txt")));assert.ok(!fs.existsSync(path.join(inner,".svc/denied.txt")));
const exactPolicy=path.join(stateRoot,"exact-policy.json");fs.writeFileSync(exactPolicy,JSON.stringify({decision:"delegated-wrapper",allowed_paths:["src/new-file.txt"]}));
const exactRun=spawnSync(process.execPath,[path.resolve("scripts/svc-contained-exec.mjs"),"run","--root",inner,"--policy",exactPolicy,"--","touch","src/new-file.txt"],{encoding:"utf8"});
assert.notEqual(exactRun.status,0);assert.match(exactRun.stderr,/exact files remain controller-owned/);
const launcher=fs.readFileSync(path.resolve("scripts/dispatch-worker.sh"),"utf8");
const preflight=launcher.indexOf("resolve-child-transport.mjs"); const accept=launcher.indexOf("dispatch-execution-task.mjs\" accept"); const launch=launcher.indexOf("CONTAINMENT_ARGV");
assert.ok(preflight>=0 && accept>preflight && launch>accept,"persisted resolver must run before token acceptance and contained launch");
const refused=spawnSync("bash",[path.resolve("scripts/dispatch-worker.sh"),"fixture"],{cwd:inner,encoding:"utf8",env:{...process.env,SVC_WORKER_SKILL:"execute-changeset",SVC_WORKER_MUTATION:"true"}});
assert.equal(refused.status,2);assert.match(refused.stderr,/persisted SVC_DELEGATION_ID/);
const missingWi=spawnSync("bash",[path.resolve("scripts/dispatch-worker.sh"),"fixture"],{cwd:inner,encoding:"utf8",env:{...process.env,SVC_WORKER_SKILL:"execute-changeset",SVC_WORKER_MUTATION:"true",SVC_DELEGATION_ID:issued.capability.delegation_id}});
assert.notEqual(missingWi.status,0);assert.match(missingWi.stderr,/SVC_WORKER_WI/);
assert.match(fs.readFileSync(path.resolve("skills/execute-changeset/references/subagent-dispatch.md"),"utf8"),/SVC_WORKER_WI=/);
const assertedRequest=path.join(tmp,"asserted.json");fs.writeFileSync(assertedRequest,JSON.stringify({mutation:true,host,delegation:asserted}));
const assertedCli=spawnSync(process.execPath,[path.resolve("scripts/resolve-child-transport.mjs"),"--request",assertedRequest],{encoding:"utf8"});assert.equal(assertedCli.status,2);assert.match(assertedCli.stderr,/not authority/);
fs.rmSync(tmp,{recursive:true,force:true});

console.log("PASS: child transport is read-only native, fully delegated+contained, or controller-owned");
