#!/usr/bin/env node
import fs from "node:fs";
function deny(reason) { process.stdout.write(`${JSON.stringify({hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:String(reason)}})}\n`); process.exit(0); }
function allow(updatedInput = null) { process.stdout.write(updatedInput ? `${JSON.stringify({hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"allow",updatedInput}})}\n` : "{}\n"); }
function lightPayload(raw){try{const value=JSON.parse(String(raw||"{}"));return value&&typeof value==="object"&&!Array.isArray(value)?value:{};}catch{return {};}}
// EXTREV-EXEC-008: the dispatcher no longer classifies anything itself. Every
// call goes through the engine's single entry point (evaluatePreToolObservation
// owns the ultra-hot read fast path internally); this adapter only translates
// the typed decision envelope to the host protocol.
const payload=lightPayload(fs.readFileSync(0,"utf8"));
async function governed() {
const { parseHookInput, operationHookContext, isReadOnlyTool, mutationPayload, toolName } = await import("./lib/codex-hook-context.mjs");
const { evaluatePreToolObservation, evaluateSelfHealAuthority } = await import("../lib/pretool-decision-engine.mjs");
const { renewControllerIfCurrent, renewalDue, readController, repositoryId, authorityStateRoot, principalId } = await import("../lib/authority-store.mjs");
const { writeToolCallReceipt, canonicalOriginalDigest } = await import("../lib/tool-call-receipt.mjs");
const { resolveOperationScope } = await import("../lib/operation-scope.mjs");
const { resolveWI } = await import("../lib/resolve-wi.mjs");
const { parseBootstrapCommand } = await import("./lib/bootstrap-command.mjs");
const { createBootstrapHandoff } = await import("./lib/session-handoff.mjs");
const { readOwnerLease, renewOwnerLease } = await import("./lib/owner-lease.mjs");
const { authorizeObservedAction } = await import("../../scripts/svc-authorized-action.mjs");
const path = await import("node:path");
const crypto = await import("node:crypto");
const { spawnSync } = await import("node:child_process");
const { fileURLToPath } = await import("node:url");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOOK_ROOT = path.resolve(HERE, "..");
const CHILDREN = [["svc-worktree-isolation-guard.mjs"],["svc-workflow-guard.mjs","--bash-guard"],["svc-workflow-guard.mjs"],["svc-loop-guard.mjs"],["svc-skill-artifact-authenticity.mjs"],["svc-session-contract-freshness.mjs"],["svc-inertia-check.mjs"],["codex","svc-codex-skill-load-enforcer.mjs"],["svc-impact-triad-guard.mjs"]];
// EXTREV-EXEC-006: host identity is wiring-supplied, never hardcoded. The
// shared engine path must produce distinct principals per host and fail closed
// when the identity is missing.
// WI-FW-CODEX-SVC-HOST-DISPATCH-01: ad-hoc `nohup codex exec` lane dispatches
// do not export SVC_HOST into the spawned session, so every governed call was
// denied ("host identity missing") and killed the iOS pipeline lane even with
// BREAK-GLASS armed. When wiring evidence is absent, infer THIS host from
// codex-exclusive signals in strict order — thread id, session id, CODEX_HOME,
// then this dispatcher's own canonical hooks/codex install path. Each signal
// is produced only by a Codex runtime, so inference cannot impersonate a
// foreign host; an explicit but UNKNOWN SVC_HOST still fails closed.
const KNOWN_HOSTS=["codex","claude","kimi","gemini","opencode","mimo-code","antigravity","cursor","grok"];
function hostIdentity(){
const explicit=String(process.env.SVC_HOST||"").toLowerCase();
if(explicit)return KNOWN_HOSTS.includes(explicit)?explicit:"";
if(String(process.env.GROK_SESSION_ID||"").trim())return "grok";
if(String(process.env.CODEX_THREAD_ID||"").trim())return "codex";
if(String(process.env.CODEX_SESSION_ID||"").trim())return "codex";
if(String(process.env.CODEX_HOME||"").trim())return "codex";
try{if(path.basename(HERE)==="codex")return "codex";}catch{}
return "";}
function sidOf(p) { return String(p.session_id || p.sessionId || p.thread_id || p.threadId || process.env.SVC_SESSION_ID || process.env.GROK_SESSION_ID || process.env.CODEX_THREAD_ID || process.env.CODEX_SESSION_ID || ""); }
function worktreeRows(repo) { return (spawnSync("git",["-C",repo,"worktree","list","--porcelain"],{encoding:"utf8"}).stdout||"").split(/\r?\n/).filter(x=>x.startsWith("worktree ")).map(x=>x.slice(9)); }
function baton(repo,sid,payload) { if(!repo)return null; const found=[]; try { for(const root of new Set([repo,...worktreeRows(repo)])){ const candidate=fs.realpathSync(root); const dir=path.join(candidate,".svc","bindings"); try { for(const n of fs.readdirSync(dir)){ if(!n.endsWith(".json"))continue; const f=path.join(dir,n),s=fs.lstatSync(f); if(!s.isFile()||s.isSymbolicLink())continue; const b=JSON.parse(fs.readFileSync(f,"utf8")); if(b.session_id===sid&&b.role==="mutating"&&!b.released_at)found.push({worktree:fs.realpathSync(b.worktree_root),binding:b}); } } catch {} } if(!found.length){ for(const root of new Set([repo,...worktreeRows(repo)])){ const candidate=fs.realpathSync(root); const resolved=resolveWI({...payload,cwd:candidate,session_id:sid},{...process.env,SVC_REQUIRE_SESSION_BINDING:"1"}); if(resolved.authority&&resolved.tuple?.worktree_root===candidate)found.push({worktree:candidate,binding:null}); } } } catch {} return found.length===1?found[0]:found.length>1?{conflict:true}:null; }
function child(spec,payload){const name=spec[0]==="codex"?spec[1]:spec[0];const disabled=String(process.env.SVC_DISABLED_HOOKS||"").split(",").map(s=>s.trim()).filter(Boolean);// EXTREV-R3-008: selective disabling follows the consolidated contract.
if(disabled.some(d=>name===d||name===d+".mjs"||name.startsWith(d)))return "";const a=spec[0]==="codex"?[path.join(HERE,spec[1])]:[path.join(HOOK_ROOT,spec[0])];if(spec[0]!=="codex")a.push(...spec.slice(1));const r=spawnSync(process.execPath,a,{input:JSON.stringify(payload),encoding:"utf8",env:{...process.env,SVC_CODEX_DISPATCHER_CHILD:"1"}});if(r.status!==0)return r.stderr?.trim()||"Codex preflight denied the operation";const t=String(r.stdout||"").trim();if(!t)return "";// EXTREV-R3-005: a child that emits garbage must never be read as allow.
try{const j=JSON.parse(t.split(/\r?\n/).filter(Boolean).at(-1));return (j?.hookSpecificOutput?.permissionDecision||j?.decision)==="deny"?(j.hookSpecificOutput?.permissionDecisionReason||j.reason||"Codex preflight denied the operation"):"";}catch{return "child emitted an unparseable decision; failing closed";}}
try { const key=payload.tool_input?"tool_input":payload.toolInput?"toolInput":payload.arguments?"arguments":"args";{// WI-FW-HOOKS-SAFETY-01 (FP-03/EXTREV-EXEC-008): ONE engine decision. The
// original input is
// per-Git-argv `--no-optional-locks` normalization — never an `export`
// prefix that a sibling classifier could re-read as an unbound mutation.
const observation=evaluatePreToolObservation(payload);if(observation){if(observation.execution_input){allow(observation.execution_input);}else{allow();}process.exit(0);}}const sid=sidOf(payload);if(!sid)deny("Codex session identity is missing; recovery: resume with a stable session_id.");const hostId=hostIdentity();if(!hostId)deny("host identity missing: wiring must set SVC_HOST for this host and no codex session evidence exists; recovery: relaunch detached lanes via scripts/lib/dispatch-codex-lane.sh or reinstall hooks via ./setup --host <host>.");const ctx=operationHookContext(payload,{...process.env,SVC_HOST:hostId});const scope=resolveOperationScope(payload,{host:hostId,env:process.env});if(!scope.ok)deny(`invalid mutation operation scope (${scope.contradictions[0]?.code||"scope contradiction"})`);const repo=scope.operation_repository?.worktree_root||scope.session_repository?.worktree_root||ctx.repo_root;let b=baton(repo,sid,payload);if(b?.conflict)deny("multiple active bindings for this session; recovery: select one WI explicitly.");let effective=payload;const input=payload[key];if(b?.worktree&&!scope.explicit_workdir.present&&input&&typeof input==="object")effective={...payload,[key]:{...input,workdir:b.worktree}};const command=mutationPayload(effective);const boot=parseBootstrapCommand(command);if(boot&&!boot.handoff){// WI-FW-HOOKS-SAFETY-01 (FP-04): operation scope outranks stale session cwd.
// The default-checkout requirement is evaluated against the repository the
// EXPLICIT operation evidence resolves to when present; session cwd is
// context, never mutation authority.
const bootstrapScope=scope.explicit_workdir&&scope.explicit_workdir.present?scope.operation_repository:scope.session_repository;if(!repo||!bootstrapScope||!bootstrapScope.default_worktree_root||bootstrapScope.worktree_root!==bootstrapScope.default_worktree_root)deny("bootstrap must start from the repository default checkout");const base=boot.from==="origin/main"?(spawnSync("git",["-C",repo,"rev-parse","origin/main"],{encoding:"utf8"}).stdout||"").trim():boot.from;const handoff=createBootstrapHandoff({session_id:sid,repo_root:repo,wi:boot.wi,branch:boot.branch,base,command_digest:`sha256:${crypto.createHash("sha256").update(command).digest("hex")}`});const ensure=path.resolve(HERE,"..","..","scripts","svc-ensure-worktree.mjs");effective={...effective,[key]:{...effective[key],command:`SVC_HOST=${hostId} SVC_SESSION_ID=${JSON.stringify(sid)} node ${ensure} --wi ${boot.wi} --branch ${boot.branch} --from ${boot.from} --authority-v2${boot.json?" --json":""}${boot.print_cd?" --print-cd":""} --handoff ${handoff.nonce}`,workdir:repo}};}
const finalScope=resolveOperationScope(effective,{host:hostId,env:process.env});if(!finalScope.ok)deny(`invalid bound mutation scope (${finalScope.contradictions[0]?.code||"scope contradiction"})`);const finalRepo=finalScope.operation_repository?.worktree_root||repo;const explicitAuth=effective[key]?.svc_authorization;const auth=authorizeObservedAction({root:finalRepo,command:mutationPayload(effective),annotation:explicitAuth});if(!auth.allow)deny(auth.reason);const lease=readOwnerLease(finalRepo,sid,process.env);const defaultRoot=finalScope.operation_repository?.default_worktree_root||"";if(lease&&(!b?.worktree||lease.worktree_root===b.worktree)&&(!defaultRoot||lease.worktree_root!==defaultRoot||finalScope.framework_maintenance)){renewOwnerLease(finalRepo,sid,process.env);allow(effective!==payload?effective[key]:null);process.exit(0);}if(!b?.worktree&&!boot){
// WI-FW-HOOKS-SAFETY-01 (FP-05/AC-3): ONE exact self-heal attempt when fresh positive prompt authority agrees; otherwise an actionable denial that never prescribes a command this same policy path would block.
const gate=evaluateSelfHealAuthority(payload,process.env,{repo_root:repo});if(!gate.eligible)deny(`mutation requires a bound WI worktree (AUTH_BINDING_MISSING_SELF_HEAL_INELIGIBLE: ${gate.reason_code}); recovery: say ‘work on <WI>’ from the worktree or arm SVC OWNER OVERRIDE.`);let adopted=null;try{const ensureModule=await import("../../scripts/svc-ensure-worktree.mjs");adopted=ensureModule.adoptExistingWorktree({wi:gate.wi,cwd:repo},{...process.env,SVC_SESSION_ID:sid});}catch(error){deny(`self-heal refused without mutation (${error.message})`);}if(adopted){b=baton(repo,sid,payload);if(b?.conflict)deny("multiple active bindings for this session after self-heal; recovery: select one WI explicitly.");if(b?.worktree&&input&&typeof input==="object"&&!scope.explicit_workdir.present)effective={...payload,[key]:{...input,workdir:b.worktree}};}if(!b?.worktree)deny("self-heal completed but the binding did not resolve; recovery: re-run the operation from the worktree.");}
// WI-FW-HOOKS-SAFETY-01 (T04/AC-4): due lease renewal is part of the SAME
// authorization check for bound mutations — continuity without escalation.
// A stale or failed renewal denies the mutation instead of allowing work on
// expired authority. Reads never reach this path.
// EXTREV-EXEC-005: every deny-capable policy runs BEFORE any renewal. A
// child-denied request must leave lease bytes untouched — denied calls never
// extend authority.
for(const spec of CHILDREN){const reason=child(spec,effective);if(reason)deny(reason);}
// WI-FW-HOOKS-SAFETY-01 (T04/AC-4): due lease renewal is part of the SAME
// authorization check for bound mutations — continuity without escalation.
// A stale or failed renewal denies the mutation instead of allowing work on
// expired authority. Reads never reach this path. Renewal happens here, after
// all deny-capable children passed, immediately before allow.
let currentLease=null;
if(b?.worktree&&b.binding&&b.binding.wi){
try{
const stateRoot=authorityStateRoot(b.worktree,process.env);
const repoId=repositoryId(b.worktree);
const principal=principalId({host:hostId,session_id:sid});
currentLease=readController({stateRoot,repoId,wi:b.binding.wi});
if(currentLease&&currentLease.state==="active"&&String(currentLease.controller_principal)===principal&&renewalDue(currentLease)){
const renewed=renewControllerIfCurrent({stateRoot,repoId,wi:b.binding.wi,worktreeRoot:b.worktree,principal:currentLease.controller_principal,leaseId:currentLease.lease_id,generation:Number(currentLease.generation)});
if(renewed.status!=="renewed")deny(`lease renewal refused (${renewed.status}: ${renewed.reason}); recovery: re-arm authority with ‘work on ${b.binding.wi}’.`);
currentLease=renewed.lease||currentLease;
}
}catch{currentLease=null;}
}
// EXTREV-EXEC-010: a bound v2 mutation must PROVE the exact live controller
// at allow time. Missing, corrupt, non-active, foreign-principal, or
// stale-generation state fails closed — silence never becomes authorization.
if(b?.worktree&&b?.binding?.wi){
const stateRoot=authorityStateRoot(b.worktree,process.env);
const repoId=repositoryId(b.worktree);
const principal=principalId({host:hostId,session_id:sid});
let live=null;
try{live=readController({stateRoot,repoId,wi:b.binding.wi});}catch(e){deny(`controller state unreadable (${e.message}); recovery: re-arm authority with ‘work on ${b.binding.wi}’.`);}
// A null read means NO v2 state exists yet (fresh adoption runs on the v1
// claim/binding until first renewal arms v2) — corruption, by contrast,
// THROWS above. Only EXISTING v2 state must prove liveness here.
if(live){
if(live.state!=="active")deny(`controller lease is ${live.state} for ${b.binding.wi}; recovery: re-arm authority with ‘work on ${b.binding.wi}’.`);
if(String(live.controller_principal)!==principal)deny("controller principal changed; recovery: request handover from the current owner.");
if(currentLease&&Number(live.generation)<Number(currentLease.generation))deny("controller generation moved backwards; possible state corruption; recovery: re-arm authority.");
}
}
// T04/AC-5: private one-time receipt enabling the successful PostToolUse call
// to heartbeat this EXACT authorized tuple. Identifiers only, never content.
// EXTREV-EXEC-001: the correlation digest binds the EXACT EXECUTION INPUT this
// dispatcher authorized (hosts echo the post-update input back on PostToolUse,
// where the heartbeat recomputes it) — a forged success with any other command
// can no longer correlate, because consume now REQUIRES the digest to match.
try{
const toolUseId=String(payload.tool_use_id||payload.toolUseId||"");
if(toolUseId&&b?.worktree&&b?.binding?.wi){
const originalDigest=canonicalOriginalDigest(mutationPayload(effective));
writeToolCallReceipt({session_id:sid,tool_use_id:toolUseId,host:hostId,original_digest,classification:"mutation",lease:{repo_id:repositoryId(b.worktree),wi:b.binding.wi,worktree_root:b.worktree,principal:principalId({host:hostId,session_id:sid}),lease_id:currentLease?String(currentLease.lease_id):null,generation:currentLease?Number(currentLease.generation):null},env:process.env});
}
}catch{}
allow(effective!==payload?effective[key]:null);}catch(e){deny(`Codex preflight failed closed: ${e.message}`);}
}
governed().catch((error) => deny(`Codex preflight failed closed: ${error.message}`));
