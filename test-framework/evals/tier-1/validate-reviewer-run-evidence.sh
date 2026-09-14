#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
node --input-type=module - "$ROOT" <<'NODE'
import assert from "node:assert/strict"; import fs from "node:fs"; import path from "node:path";
const root=process.argv[2];
for(const type of ["review-plan","review-exec"]){const schema=JSON.parse(fs.readFileSync(path.join(root,"schemas/receipts",`${type}.schema.json`)));assert.ok(schema.allOf,"version-gated reviewer evidence schema missing");}
const chain=fs.readFileSync(path.join(root,"scripts/check-chain-receipts.mjs"),"utf8");
assert.match(chain,/verifyReviewerEvidence/);
const launcher=fs.readFileSync(path.join(root,"scripts/run-external-review.mjs"),"utf8");
assert.match(launcher,/reviewer_run/); assert.match(launcher,/command: \{ binary, argv: args \}/);
NODE

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
git -C "$TMP" init -q
git -C "$TMP" config user.name fixture
git -C "$TMP" config user.email fixture@example.invalid
printf 'x\n' > "$TMP/x"; git -C "$TMP" add x; git -C "$TMP" commit -qm init
node --input-type=module - "$ROOT" "$TMP" <<'NODE'
import assert from "node:assert/strict"; import crypto from "node:crypto"; import fs from "node:fs"; import path from "node:path"; import {spawnSync} from "node:child_process"; import {pathToFileURL} from "node:url";
const [root,repo]=process.argv.slice(2);
process.env.SVC_EXTERNAL_REVIEW_PROVENANCE_FIXTURE="1";process.env.SVC_EXTERNAL_REVIEW_ISSUANCE_ROOT=path.join(repo,".svc","external-review-authority-fixture");process.env.SVC_REVIEW_EVIDENCE_STORE=path.join(repo,".svc","review-evidence-store");
const {candidateTreeIdentity,issueExternalReviewProvenance}=await import(pathToFileURL(path.join(root,"scripts/lib/external-review-provenance.mjs")));
const candidate=candidateTreeIdentity(repo,{candidateSha:"HEAD"}).candidate_digest;
const dir=path.join(repo,".svc/external-review-artifacts/plan",candidate,"final");fs.mkdirSync(dir,{recursive:true,mode:0o700});
const sha=(bytes)=>crypto.createHash("sha256").update(bytes).digest("hex");const output=path.join(dir,"findings.json");
const packagePath=path.join(dir,"review-package.bin");fs.writeFileSync(packagePath,Buffer.from(`candidate_digest=${candidate}\n`),{mode:0o600});
const findings={schema_version:1,review_kind:"plan",rubric_score:10,rubric_failures:[],dependencies_needing_read:[],reviewer:{host:"agy",family:"google",model:"Gemini 3.6 Flash (High)",effort:"high"},verdict:"pass",summary:"pass",findings:[],certifications:[]};fs.writeFileSync(output,JSON.stringify(findings),{mode:0o600});
const commands=[{binary:"agy",argv:["review","--frozen",candidate]}];const receiptPath=path.join(dir,"receipt.json");const tuple={orchestrator:"codex",host:"agy",family:"google",model:"Gemini 3.6 Flash (High)",effort:"high"};
const transportPath=path.join(dir,"agy-transport-receipt.json");fs.writeFileSync(transportPath,JSON.stringify({schema_version:1,request_id:crypto.randomUUID(),started_at:"2026-08-15T00:00:00.000Z",finished_at:"2026-08-15T00:00:01.000Z",status:"success",classification:"success",requested_model:tuple.model,requested_effort:tuple.effort,response_schema_sha256:null,model_attestation:{level:"requested_accepted",evidence:"fixture exact argv"},package_sha256:sha(fs.readFileSync(packagePath)),package_bytes:1,transport:"stdin_to_private_mode_0600_file",sandbox:true,mode:"plan",timeout_seconds:1200,identical_json_repetitions_collapsed:0,exit_code:0,signal:null,artifacts:{output,stderr:path.join(dir,"stderr.log")}}),{mode:0o600});
const nilOverride={used:false,authority:null,source:null,path:null,expected_sha256:null,actual_sha256:null};
const receipt={schema_version:2,launcher_version:(await import(pathToFileURL(path.join(root,"scripts/run-external-review.mjs")))).EXTERNAL_REVIEW_LAUNCHER_VERSION,cli_version:"fixture-cli",request_id:crypto.randomUUID(),review_kind:"plan",candidate_digest:candidate,package_sha256:sha(fs.readFileSync(packagePath)),findings_schema_sha256:sha(fs.readFileSync(path.join(root,"schemas/external-review-findings.schema.json"))),findings_sha256:sha(fs.readFileSync(output)),cache_key:"c".repeat(64),fixture_mode:false,started_at:"2026-08-15T00:00:00.000Z",finished_at:"2026-08-15T00:00:01.000Z",status:"success",classification:"success",requested_tuple:tuple,invocation_tuple:tuple,effective_tuple:tuple,attempts:[{index:1,tuple,started_at:"2026-08-15T00:00:00.000Z",finished_at:"2026-08-15T00:00:01.000Z",exit_code:0,classification:"success",command:commands[0],artifacts:{findings:output},usage:{}}],fallback:{eligible:false,used:false,reason:null},override:nilOverride,policy:{version:2,profile:"production:agy",source:"owner-config",resolved_at:"2026-08-15T00:00:00.000Z",effective_window:{starts_at:null,ends_at:null},cutover_utc:null,cutover_local:null,timezone:null,selection_sha256:null,selection_expires_at:null,selection_authority:"repository-owner"},protocol:{process_invocations:1,configured_turn_ceiling:null,configured_budget_usd:null,reported_turns:null,stop_reason:null,terminal_reason:null,errors:[]},route:{kind:"owner_config_primary",switching_enabled:false,cli_fallback_configured:false,evidence:"requested_primary"},effective_effort:{value:"high",provenance:"requested"},model_attestation:{level:"requested_accepted",requested_model:tuple.model,observed_models:[],evidence:"canonical launcher"},phase_guard:{applicable:false,kind:"plan",decision:"not-applicable",reason:null,wi:"WI-T",pre_execution_base:"0".repeat(40),plan_manifest_sha256:candidate,exec_record_present:null,exec_record_path:null,implementation_diverged:null,diverged_files:[],base_resolved:true,override:{...nilOverride,kind:null}},package_context:{version:1,context_root:repo,base_package_sha256:sha(fs.readFileSync(packagePath)),files:[]},cache:{disposition:"published",reusable:true,entry:null},artifacts:{findings:output,receipt:receiptPath,package:packagePath},usage:{agy_transport_receipt:transportPath,agy_transport_receipt_sha256:sha(fs.readFileSync(transportPath))},reviewer_run:{commands,output_artifacts:[output]}};fs.writeFileSync(receiptPath,JSON.stringify(receipt),{mode:0o600});
issueExternalReviewProvenance({receiptPath,packagePath,findingsPath:output});
const artifact=(file)=>({path:path.relative(repo,file),sha256:sha(fs.readFileSync(file))});const base={schema_version:1,wi:"WI-T",candidate_digest:candidate,self_review:{orchestrator:"codex",findings_count:0,notes:"self"},adversarial_review:{primary_reviewer_host:"agy",primary_used:true,fallback_host:"agy",fallback_used:false,findings:[],iteration_count:1},verdict:"pass",reviewer_evidence:{independent:true,submitter_only:false,launcher_receipts:[artifact(receiptPath)],commands,output_artifacts:[artifact(output)],deletion_bearing:false,parse_collect_evidence:[]}};
const emitter=path.join(root,"scripts/emit-receipt.mjs");const run=(body)=>spawnSync(process.execPath,[emitter,"--type","review-plan","--wi","WI-T","--sha","HEAD","--no-note"],{cwd:repo,input:JSON.stringify(body),encoding:"utf8"});
assert.notEqual(run({...base,reviewer_evidence:{...base.reviewer_evidence,launcher_receipts:[{path:".svc/external-review-artifacts/invented.json",sha256:"0".repeat(64)}]}}).status,0,"invented launcher evidence passed");
assert.notEqual(run({...base,candidate_digest:"b".repeat(64)}).status,0,"candidate mismatch passed");
assert.notEqual(run({...base,reviewer_evidence:{...base.reviewer_evidence,commands:[{binary:"agy",argv:["forged"]}]}}).status,0,"forged command passed");
const handcrafted={status:"success",classification:"success",review_kind:"plan",candidate_digest:candidate,findings_sha256:sha(fs.readFileSync(output)),artifacts:{findings:output},effective_tuple:tuple,reviewer_run:{commands,output_artifacts:[output]}};fs.writeFileSync(receiptPath,JSON.stringify(handcrafted),{mode:0o600});base.reviewer_evidence.launcher_receipts=[artifact(receiptPath)];
assert.notEqual(run(base).status,0,"handwritten partial launcher receipt passed");
findings.verdict="fail";findings.findings=[{id:"H",severity:"high",claim:"x",analysis:"x",evidence:[],proposed_fix:"x"}];fs.writeFileSync(output,JSON.stringify(findings),{mode:0o600});receipt.findings_sha256=sha(fs.readFileSync(output));receipt.request_id=crypto.randomUUID();fs.writeFileSync(receiptPath,JSON.stringify(receipt),{mode:0o600});issueExternalReviewProvenance({receiptPath,packagePath,findingsPath:output});base.reviewer_evidence.launcher_receipts=[artifact(receiptPath)];base.reviewer_evidence.output_artifacts=[artifact(output)];
assert.notEqual(run(base).status,0,"failed reviewer findings passed");
findings.verdict="pass";findings.findings=[];fs.writeFileSync(output,JSON.stringify(findings),{mode:0o600});receipt.findings_sha256=sha(fs.readFileSync(output));receipt.request_id=crypto.randomUUID();fs.writeFileSync(receiptPath,JSON.stringify(receipt),{mode:0o600});issueExternalReviewProvenance({receiptPath,packagePath,findingsPath:output});base.reviewer_evidence.launcher_receipts=[artifact(receiptPath)];base.reviewer_evidence.output_artifacts=[artifact(output)];
const realDir=path.join(repo,".svc/external-review-artifacts/real");const symlinkDir=path.join(repo,".svc/external-review-artifacts/link");fs.mkdirSync(realDir,{recursive:true,mode:0o700});fs.writeFileSync(path.join(realDir,"receipt.json"),JSON.stringify(receipt),{mode:0o600});fs.symlinkSync(realDir,symlinkDir,"dir");
assert.notEqual(run({...base,reviewer_evidence:{...base.reviewer_evidence,launcher_receipts:[{path:path.relative(repo,path.join(symlinkDir,"receipt.json")),sha256:sha(fs.readFileSync(path.join(realDir,"receipt.json")))}]}}).status,0,"symlinked evidence subtree passed");
const good=run(base);assert.equal(good.status,0,good.stderr);
const {verifyReviewerEvidence}=await import(pathToFileURL(path.join(root,"scripts/lib/reviewer-evidence.mjs")));assert.deepEqual(verifyReviewerEvidence({root:repo,reviewKind:"plan",body:{...base,schema_version:3}}),[]);
// A cache replay has no new provider call; it must retain a separately signed source.
const cacheSourcePath=path.join(dir,"cache-source.json");
const cacheSource={...receipt,request_id:crypto.randomUUID(),phase_guard:{...receipt.phase_guard,wi:null,plan_manifest_sha256:null},artifacts:{...receipt.artifacts,receipt:cacheSourcePath}};
fs.writeFileSync(cacheSourcePath,JSON.stringify(cacheSource),{mode:0o600});issueExternalReviewProvenance({receiptPath:cacheSourcePath,packagePath,findingsPath:output});
const sourceArtifact=artifact(cacheSourcePath);
const replayPath=path.join(dir,"cache-replay.json");
const replay={...cacheSource,phase_guard:{...receipt.phase_guard,wi:"WI-CACHE"},request_id:crypto.randomUUID(),classification:"cache_hit",attempts:[],
 protocol:{...receipt.protocol,process_invocations:0,terminal_reason:"cache_hit"},
 route:{kind:"cache_hit",switching_enabled:false,cli_fallback_configured:false,evidence:"cache_receipt_replay"},
 model_attestation:{...receipt.model_attestation,level:"cache_replay",evidence:"validated_content_addressed_receipt"},
 cache:{...receipt.cache,disposition:"hit"},artifacts:{...receipt.artifacts,receipt:replayPath},reviewer_run:{commands:[],output_artifacts:[]}};
fs.writeFileSync(replayPath,JSON.stringify(replay),{mode:0o600});issueExternalReviewProvenance({receiptPath:replayPath,packagePath,findingsPath:output});
const replayArtifact=artifact(replayPath);
const cached={...base,wi:"WI-CACHE",schema_version:3,reviewer_evidence:{...base.reviewer_evidence,launcher_receipts:[replayArtifact],cache_sources:[{replay_sha256:replayArtifact.sha256,source:sourceArtifact}]}};
const check=body=>verifyReviewerEvidence({root:repo,reviewKind:"plan",body});
assert.deepEqual(check(cached),[]);
// The historical source may be unbound; the selected replay may never be unbound.
for(const field of ["wi","plan_manifest_sha256"]){
 const badPath=path.join(dir,`cache-missing-${field}.json`);
 const bad={...replay,request_id:crypto.randomUUID(),phase_guard:{...replay.phase_guard,[field]:null},artifacts:{...replay.artifacts,receipt:badPath}};
 fs.writeFileSync(badPath,JSON.stringify(bad),{mode:0o600});issueExternalReviewProvenance({receiptPath:badPath,packagePath,findingsPath:output});
 const badArtifact=artifact(badPath);
 const b=structuredClone(cached);b.reviewer_evidence.launcher_receipts=[badArtifact];b.reviewer_evidence.cache_sources=[{replay_sha256:badArtifact.sha256,source:sourceArtifact}];
 assert.ok(check(b).length,`unbound selected replay accepted: ${field}`);
}

for(const [name,change] of [
 ["missing source",b=>delete b.reviewer_evidence.cache_sources],
 ["tampered source",b=>b.reviewer_evidence.cache_sources[0].source.sha256="0".repeat(64)],
 ["wrong replay",b=>b.reviewer_evidence.cache_sources[0].replay_sha256="0".repeat(64)],
 ["duplicate source",b=>b.reviewer_evidence.cache_sources.push(b.reviewer_evidence.cache_sources[0])],
 ["forged command",b=>b.reviewer_evidence.commands=[{binary:"forged",argv:[]}]],
 ["wrong WI",b=>b.wi="WI-OTHER"],
 ["wrong candidate",b=>b.candidate_digest="0".repeat(64)],
 ["missing output",b=>b.reviewer_evidence.output_artifacts=[]],
]){const b=structuredClone(cached);change(b);assert.ok(check(b).length,`cache replay accepted ${name}`);}
NODE
node -e 'const fs=require("fs"),path=require("path");const f=fs.readdirSync(path.join(process.argv[1],".svc/receipts"))[0];const r=require(path.join(process.argv[1],".svc/receipts",f,"review-plan.json"));if(r.schema_version!==3)process.exit(1)' "$TMP"
echo "PASS: schema-v3 review receipts require candidate-bound launcher receipts, exact commands, hash-bound outputs, and deletion proof"
