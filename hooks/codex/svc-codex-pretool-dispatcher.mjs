#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runtimeRoot, atomicWriteJson, sessionId, hookContext } from "./lib/codex-hook-context.mjs";
import { renewSlidingPromptAuthority } from "../lib/pretool-decision-engine.mjs";
import { autoProvisionMissingBinding, isPreProvisionIsolationDenial, rebindMutationPayload } from "../lib/auto-provision-worktree.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KNOWN_HOSTS = ["codex", "claude", "kimi", "gemini", "opencode", "mimo-code", "antigravity", "cursor", "grok"];

function hostIdentity(p = null) {
  const explicit = String(process.env.SVC_HOST || "").toLowerCase();
  if (explicit) return KNOWN_HOSTS.includes(explicit) ? explicit : "";
  if (p?.cursor_version || p?.conversation_id || String(process.env.CURSOR_CONVERSATION_ID || "").trim() || String(process.env.CURSOR_AGENT || "").trim() || String(process.env.CURSOR_TRACE_ID || "").trim()) return "cursor";
  if (String(process.env.GROK_SESSION_ID || "").trim()) return "grok";
  if (String(process.env.CODEX_THREAD_ID || "").trim()) return "codex";
  if (String(process.env.CODEX_SESSION_ID || "").trim()) return "codex";
  if (String(process.env.CODEX_HOME || "").trim()) return "codex";
  try { if (path.basename(HERE) === "codex") return "codex"; } catch {}
  return "";
}

let currentSessionId = "";
let currentHookContext = null;

function trackDenial(reason, sid, env = process.env) {
  if (!sid) return false;
  try {
    const root = runtimeRoot(env);
    if (!root) return false;
    const file = path.join(root, "deny-storm-tracker.json");
    let tracker = {};
    if (fs.existsSync(file)) {
      try { tracker = JSON.parse(fs.readFileSync(file, "utf8")) || {}; } catch {}
    }
    const current = tracker[sid] || { lastReason: "", count: 0, lastTs: 0 };
    const now = Date.now();
    if (current.lastReason === reason && (now - current.lastTs < 300_000)) {
      current.count += 1;
      current.lastTs = now;
      tracker[sid] = current;
      atomicWriteJson(file, tracker);
      return current.count >= 2;
    } else {
      tracker[sid] = { lastReason: reason, count: 1, lastTs: now };
      atomicWriteJson(file, tracker);
      return false;
    }
  } catch {
    return false;
  }
}

function resetDenial(sid, env = process.env) {
  if (!sid) return;
  try {
    const root = runtimeRoot(env);
    if (!root) return;
    const file = path.join(root, "deny-storm-tracker.json");
    if (fs.existsSync(file)) {
      let tracker = JSON.parse(fs.readFileSync(file, "utf8")) || {};
      if (tracker[sid]) {
        delete tracker[sid];
        atomicWriteJson(file, tracker);
      }
    }
  } catch {}
}

function deny(reason, host = "") {
  let finalReason = String(reason);
  let halt = false;
  if (currentSessionId && !isPreProvisionIsolationDenial(finalReason) && trackDenial(finalReason, currentSessionId, process.env)) {
    halt = true;
    finalReason = `[SSVE CIRCUIT BREAKER] Deny storm halted: consecutive identical denial detected. Recovery: invoke node scripts/svc-ensure-worktree.mjs for the bound WI (harness self-heal). (${finalReason})`;
  }
  if (host === "cursor") {
    const body = { permission: "deny", user_message: finalReason };
    if (halt) body.continue = false;
    process.stdout.write(`${JSON.stringify(body)}\n`);
    process.exit(0);
  }
  const body = { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: finalReason } };
  if (halt) body.continue = false;
  process.stdout.write(`${JSON.stringify(body)}\n`);
  process.exit(0);
}
function allow(updatedInput = null, host = "", options = {}) {
  if (!options.observation) {
    if (currentSessionId) resetDenial(currentSessionId, process.env);
    const hostId = host || hostIdentity(payload);
    renewSlidingPromptAuthority(options.ctx || hookContext(payload, { ...process.env, SVC_HOST: hostId }));
  }
  if (host === "cursor") { process.stdout.write(updatedInput ? `${JSON.stringify({permission:"allow",updated_input:updatedInput})}\n` : "{}\n"); process.exit(0); }
  process.stdout.write(updatedInput ? `${JSON.stringify({hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"allow",updatedInput}})}\n` : "{}\n");
}
function lightPayload(raw){try{const value=JSON.parse(String(raw||"{}"));return value&&typeof value==="object"&&!Array.isArray(value)?value:{};}catch{return {};}}
// EXTREV-EXEC-008: the dispatcher no longer classifies anything itself. Every
// call goes through the engine's single entry point (evaluatePreToolObservation
// owns the ultra-hot read fast path internally); this adapter only translates
// the typed decision envelope to the host protocol.
const payload=lightPayload(fs.readFileSync(0,"utf8"));
async function governed() {
const { parseHookInput, operationHookContext, isReadOnlyTool, mutationPayload, toolName, sessionId, runtimeRoot, atomicWriteJson } = await import("./lib/codex-hook-context.mjs");
const { evaluatePreToolObservation, evaluateSelfHealAuthority, evaluateExactWorktreeRecovery } = await import("../lib/pretool-decision-engine.mjs");
const { renewControllerIfCurrent, renewalDue, readController, repositoryId, authorityStateRoot, principalId } = await import("../lib/authority-store.mjs");
const { writeToolCallReceipt, canonicalOriginalDigest } = await import("../lib/tool-call-receipt.mjs");
const { resolveOperationScope } = await import("../lib/operation-scope.mjs");
const { collectSessionBatons } = await import("../lib/authoritative-binding.mjs");
const { parseBootstrapCommand } = await import("./lib/bootstrap-command.mjs");
const { encodeSimpleCommand } = await import("./lib/argv-encode.mjs");
const { createBootstrapHandoff } = await import("./lib/session-handoff.mjs");
const { readOwnerLease, renewOwnerLease } = await import("./lib/owner-lease.mjs");
const { authorizeObservedAction } = await import("../../scripts/svc-authorized-action.mjs");
const { spawnSync } = await import("node:child_process");
const HOOK_ROOT = path.resolve(HERE, "..");
const CHILDREN = [["svc-worktree-isolation-guard.mjs"],["svc-workflow-guard.mjs","--bash-guard"],["svc-workflow-guard.mjs"],["svc-loop-guard.mjs"],["svc-skill-artifact-authenticity.mjs"],["svc-session-contract-freshness.mjs"],["svc-inertia-check.mjs"],["codex","svc-codex-skill-load-enforcer.mjs"],["svc-impact-triad-guard.mjs"]];
function sidOf(p) {
  return sessionId(p, process.env);
}
function worktreeRows(repo) { const rows=[]; for(const x of (spawnSync("git",["-C",repo,"worktree","list","--porcelain"],{encoding:"utf8"}).stdout||"").split(/\r?\n/)){ if(x.startsWith("worktree ")){ try { rows.push(fs.realpathSync(x.slice(9))); } catch {} } } return rows; }
function baton(repo,sid,payload,host,explicitWorktree) { return collectSessionBatons({repo,sessionId:sid,host,agentId:payload.agent_id||payload.agentId||process.env.SVC_AGENT_ID||null,env:process.env,explicitWorktree}); }
function child(spec,payload){const name=spec[0]==="codex"?spec[1]:spec[0];const disabled=String(process.env.SVC_DISABLED_HOOKS||"").split(",").map(s=>s.trim()).filter(Boolean);// EXTREV-R3-008: selective disabling follows the consolidated contract.
if(disabled.some(d=>name===d||name===d+".mjs"||name.startsWith(d)))return "";const a=spec[0]==="codex"?[path.join(HERE,spec[1])]:[path.join(HOOK_ROOT,spec[0])];if(spec[0]!=="codex")a.push(...spec.slice(1));const r=spawnSync(process.execPath,a,{input:JSON.stringify(payload),encoding:"utf8",env:{...process.env,SVC_CODEX_DISPATCHER_CHILD:"1"}});if(r.status!==0)return r.stderr?.trim()||"Codex preflight denied the operation";const t=String(r.stdout||"").trim();if(!t)return "";// EXTREV-R3-005: a child that emits garbage must never be read as allow.
try{const j=JSON.parse(t.split(/\r?\n/).filter(Boolean).at(-1));return (j?.hookSpecificOutput?.permissionDecision||j?.permission||j?.decision)==="deny"?(j.hookSpecificOutput?.permissionDecisionReason||j.user_message||j.reason||"Codex preflight denied the operation"):"";}catch{return "child emitted an unparseable decision; failing closed";}}
async function loadRecoverySkill(worktree,gate,input,ctx,sid,host=""){
const ensureModule=await import("../../scripts/svc-ensure-worktree.mjs");
const recovery=ensureModule.prepareRecoveredSession({worktree:worktree,wi:gate.wi,sessionId:sid,turnId:ctx.turn_id,authorization:gate,agentId:payload.agent_id||payload.agentId||process.env.SVC_AGENT_ID||null,host,env:{...process.env,SVC_HOST:host||process.env.SVC_HOST||"",SVC_SESSION_ID:sid}});
const loader=encodeSimpleCommand([process.execPath,path.resolve(HERE,"..","..","scripts","codex-load-skill.mjs"),"--graph",recovery.graphPath,"--task",String(recovery.taskId),"--skill",recovery.skill,"--turn",String(ctx.turn_id||""),"--session",sid,...(host?["--host",host]:[])]);
if(input && (Object.hasOwn(input,"command") || Object.hasOwn(input,"cmd"))){
const field=Object.hasOwn(input,"cmd")?"cmd":"command";
if(host==="cursor"){
process.stdout.write(JSON.stringify({permission:"allow",updated_input:{...input,[field]:loader,workdir:worktree},user_message:"SSVE restored the authorized WI. This call loads its current skill; the original operation has not run. Read the skill output, then retry the original operation."})+"\n");process.exit(0);
}
process.stdout.write(JSON.stringify({systemMessage:"SSVE restored the authorized WI. This call loads its current skill; the original operation has not run. Read the skill output, then retry the original operation.",hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"allow",updatedInput:{...input,[field]:loader,workdir:worktree}}})+"\n");process.exit(0);
}
deny(`SSVE restored the authorized WI. Load its current skill before retrying: ${loader}`, host);
}
const hostId = hostIdentity(payload);
try { const key=payload.tool_input?"tool_input":payload.toolInput?"toolInput":payload.arguments?"arguments":"args";{
const observation=evaluatePreToolObservation(payload);if(observation){if(observation.execution_input){allow(observation.execution_input,hostId,{observation:true});}else{allow(null,hostId,{observation:true});}process.exit(0);}}const sid=sidOf(payload);currentSessionId=sid;if(!sid)deny("Codex session identity is missing; recovery: resume with a stable session_id.",hostId);if(!hostId)deny("host identity missing: wiring must set SVC_HOST for this host and no codex session evidence exists; recovery: relaunch detached lanes via scripts/lib/dispatch-codex-lane.sh or reinstall hooks via ./setup --host <host>.",hostId);currentHookContext=hookContext(payload,{...process.env,SVC_HOST:hostId});const ctx=operationHookContext(payload,{...process.env,SVC_HOST:hostId});const scope=resolveOperationScope(payload,{host:hostId,env:process.env});if(!scope.ok)deny(`invalid mutation operation scope (${scope.contradictions[0]?.code||"scope contradiction"})`,hostId);const repo=scope.operation_repository?.worktree_root||scope.session_repository?.worktree_root||ctx.repo_root;const boundRoot=scope.explicit_workdir?.present?(scope.operation_repository?.worktree_root||scope.explicit_workdir.canonical):null;let b=baton(repo,sid,payload,hostId,boundRoot);if(b?.conflict)deny("multiple active bindings for this session; recovery: select one WI explicitly.",hostId);let effective=payload;const input=payload[key];if(b?.worktree&&!scope.explicit_workdir.present&&input&&typeof input==="object")effective={...payload,[key]:{...input,workdir:b.worktree}};const command=mutationPayload(effective);const boot=parseBootstrapCommand(command);if(boot&&!boot.handoff){// WI-FW-HOOKS-SAFETY-01 (FP-04): operation scope outranks stale session cwd.
// The default-checkout requirement is evaluated against the repository the
// EXPLICIT operation evidence resolves to when present; session cwd is
// context, never mutation authority.
// An existing WI is a resume, even when an older recovery hint called it bootstrap.
const resumeGate=evaluateSelfHealAuthority(payload,process.env,{repo_root:repo});
if(!b?.worktree&&resumeGate.eligible&&resumeGate.wi===boot.wi&&worktreeRows(repo).some(w=>fs.existsSync(path.join(w,".svc",`lane-tasks-${boot.wi}.json`)))){
const ensureModule=await import("../../scripts/svc-ensure-worktree.mjs");
const adopted=ensureModule.adoptExistingWorktree({wi:boot.wi,cwd:repo,prepareSession:true,sessionId:sid},{...process.env,SVC_SESSION_ID:sid,SVC_AGENT_ID:payload.agent_id||payload.agentId||process.env.SVC_AGENT_ID||""});
await loadRecoverySkill(adopted.absolute_worktree,resumeGate,input,ctx,sid,hostId);
}
const bootstrapScope=scope.explicit_workdir&&scope.explicit_workdir.present?scope.operation_repository:scope.session_repository;if(!repo||!bootstrapScope||!bootstrapScope.default_worktree_root||bootstrapScope.worktree_root!==bootstrapScope.default_worktree_root)deny(`New-worktree bootstrap must use workdir ${bootstrapScope?.default_worktree_root||"the repository default checkout"}. For an existing WI, resume its registered worktree; the agent should perform this routing.`,hostId);const base=boot.from==="origin/main"?(spawnSync("git",["-C",repo,"rev-parse","origin/main"],{encoding:"utf8"}).stdout||"").trim():boot.from;if(!/^[0-9a-f]{40}$/.test(base))deny("bootstrap base did not resolve to an exact commit",hostId);const handoff=createBootstrapHandoff({session_id:sid,host:hostId,repo_root:repo,wi:boot.wi,branch:boot.branch,base});const ensure=path.resolve(HERE,"..","..","scripts","svc-ensure-worktree.mjs");const bootstrapArgv=["node",ensure,"--wi",boot.wi,"--branch",boot.branch,"--from",base,"--authority-v2",...(boot.json?["--json"]:[]),...(boot.print_cd?["--print-cd"]:[]),"--handoff",handoff.nonce];effective={...effective,[key]:{...effective[key],[Object.hasOwn(input||{},"cmd")?"cmd":"command"]:`SVC_HOST=${hostId} ${encodeSimpleCommand(bootstrapArgv)}`,workdir:repo}};}else if(boot?.handoff){if(Object.keys(boot.identity||{}).length!==1||boot.identity.SVC_HOST!==hostId)deny("bootstrap handoff host identity mismatch",hostId);}
const finalScope=resolveOperationScope(effective,{host:hostId,env:process.env});if(!finalScope.ok)deny(`invalid bound mutation scope (${finalScope.contradictions[0]?.code||"scope contradiction"})`,hostId);const finalRepo=finalScope.operation_repository?.worktree_root||repo;if(!finalRepo)deny("mutation requires a repository root",hostId);const explicitAuth=effective[key]?.svc_authorization;const auth=authorizeObservedAction({root:finalRepo,command:mutationPayload(effective),annotation:explicitAuth});if(!auth.allow)deny(auth.reason,hostId);const lease=readOwnerLease(finalRepo,sid,process.env);const defaultRoot=finalScope.operation_repository?.default_worktree_root||"";if(lease&&(!b?.worktree||lease.worktree_root===b.worktree)&&(!defaultRoot||lease.worktree_root!==defaultRoot||finalScope.framework_maintenance)){renewOwnerLease(finalRepo,sid,process.env);allow(effective!==payload?effective[key]:null,hostId);process.exit(0);}if(!b?.worktree&&!boot){
// Same-owner exact-worktree recovery does not require a fresh magic phrase.
// Prompt-authority self-heal remains the first path; when it is ineligible,
// a unique registered non-default worktree with this session's released or
// active controller may re-arm. Foreign live owners and default checkout stay denied.
const gate=evaluateSelfHealAuthority(payload,process.env,{repo_root:repo});
const recoveryRoot=(scope.operation_repository && scope.operation_repository.default_worktree_root && scope.operation_repository.worktree_root!==scope.operation_repository.default_worktree_root)
  ?scope.operation_repository.worktree_root
  :(scope.explicit_workdir?.present
    ?(scope.operation_repository?.worktree_root||scope.explicit_workdir.canonical)
    :(scope.session_repository && scope.session_repository.default_worktree_root && scope.session_repository.worktree_root!==scope.session_repository.default_worktree_root
      ?scope.session_repository.worktree_root
      :null));
const exact=(!gate.eligible && recoveryRoot)
  ?evaluateExactWorktreeRecovery(payload,process.env,{worktree_root:recoveryRoot})
  :{eligible:false,reason_code:"NOT_ATTEMPTED"};
const chosen=gate.eligible?gate:exact;
if(chosen?.eligible){
let adopted=null;try{const ensureModule=await import("../../scripts/svc-ensure-worktree.mjs");adopted=ensureModule.adoptExistingWorktree({wi:chosen.wi,cwd:repo,prepareSession:true,sessionId:sid},{...process.env,SVC_SESSION_ID:sid,SVC_AGENT_ID:payload.agent_id||payload.agentId||process.env.SVC_AGENT_ID||""});}catch(error){deny(`self-heal could not complete (${error.message})`,hostId);}if(adopted)await loadRecoverySkill(adopted.absolute_worktree,chosen,input,ctx,sid,hostId);
deny("self-heal completed but the binding did not resolve; inspect the WI ownership before retrying.",hostId);}
if(exact.reason_code==="FOREIGN_LIVE_OWNER")deny("FOREIGN_LIVE_OWNER: a provably live owner cannot be displaced",hostId);
const provisioned=await autoProvisionMissingBinding({payload:effective,env:process.env,repo,sessionId:sid,host:hostId});
if(!provisioned.ok)deny(`mutation requires a bound WI worktree (AUTH_BINDING_MISSING_SELF_HEAL_INELIGIBLE: ${gate.reason_code}; EXACT_WORKTREE_RECOVERY: ${exact.reason_code}; SELF_PROVISION_ATTEMPTED: ${provisioned.reason})`,hostId);
effective=rebindMutationPayload(effective,provisioned.defaultRoot,provisioned.worktree);
b=baton(provisioned.worktree,sid,payload,hostId,provisioned.worktree);
}
// A crash after controller recovery must not strand the now-owned session.
// Reuse the actual enforcer's receipt decision instead of duplicating its rules.
if(b?.worktree&&!boot){
const gate=evaluateSelfHealAuthority(payload,process.env,{repo_root:repo});
const exact=(!gate.eligible)
  ?evaluateExactWorktreeRecovery(payload,process.env,{worktree_root:b.worktree})
  :{eligible:false,reason_code:"NOT_ATTEMPTED"};
const chosen=gate.eligible?gate:exact;
if(chosen?.eligible&&chosen.wi===b.binding?.wi){
const receiptProblem=child(["codex","svc-codex-skill-load-enforcer.mjs"],effective);
if(/missing or insecure Codex skill-load receipt|Codex skill-load receipt mismatch|governed mutation denied without an owned in_progress task/.test(receiptProblem))await loadRecoverySkill(b.worktree,chosen,input,ctx,sid,hostId);
}
}
// WI-FW-HOOKS-SAFETY-01 (T04/AC-4): due lease renewal is part of the SAME
// authorization check for bound mutations — continuity without escalation.
// A stale or failed renewal denies the mutation instead of allowing work on
// expired authority. Reads never reach this path.
// EXTREV-EXEC-005: every deny-capable policy runs BEFORE any renewal. A
// child-denied request must leave lease bytes untouched — denied calls never
// extend authority.
for(const spec of CHILDREN){const reason=child(spec,effective);if(reason)deny(reason,hostId);}
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
const principal=principalId({host:hostId,session_id:sid,agent_id:payload.agent_id||payload.agentId||process.env.SVC_AGENT_ID||null});
currentLease=readController({stateRoot,repoId,wi:b.binding.wi});
if(currentLease&&currentLease.state==="active"&&String(currentLease.controller_principal)===principal&&renewalDue(currentLease)){
const renewed=renewControllerIfCurrent({stateRoot,repoId,wi:b.binding.wi,worktreeRoot:b.worktree,principal:currentLease.controller_principal,leaseId:currentLease.lease_id,generation:Number(currentLease.generation)});
if(renewed.status!=="renewed")deny(`lease renewal refused (${renewed.status}: ${renewed.reason}); recovery: invoke node scripts/svc-ensure-worktree.mjs --wi ${b.binding.wi}`,hostId);
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
const principal=principalId({host:hostId,session_id:sid,agent_id:payload.agent_id||payload.agentId||process.env.SVC_AGENT_ID||null});
let live=null;
try{live=readController({stateRoot,repoId,wi:b.binding.wi});}catch(e){deny(`controller state unreadable (${e.message}); recovery: invoke node scripts/svc-ensure-worktree.mjs --wi ${b.binding.wi}`,hostId);}
// A null read means NO v2 state exists yet (fresh adoption runs on the v1
// claim/binding until first renewal arms v2) — corruption, by contrast,
// THROWS above. Only EXISTING v2 state must prove liveness here.
if(live){
if(live.state!=="active")deny(`controller lease is ${live.state} for ${b.binding.wi}; recovery: invoke node scripts/svc-ensure-worktree.mjs --wi ${b.binding.wi}`,hostId);
if(String(live.controller_principal)!==principal)deny("controller principal changed; recovery: request handover from the current owner.",hostId);
if(currentLease&&Number(live.generation)<Number(currentLease.generation))deny("controller generation moved backwards; possible state corruption; recovery: re-arm authority.",hostId);
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
writeToolCallReceipt({session_id:sid,tool_use_id:toolUseId,host:hostId,original_digest:originalDigest,classification:"mutation",lease:{repo_id:repositoryId(b.worktree),wi:b.binding.wi,worktree_root:b.worktree,principal:principalId({host:hostId,session_id:sid,agent_id:payload.agent_id||payload.agentId||process.env.SVC_AGENT_ID||null}),lease_id:currentLease?String(currentLease.lease_id):null,generation:currentLease?Number(currentLease.generation):null},env:process.env});
}
}catch{}
allow(effective!==payload?effective[key]:null,hostId);}catch(e){deny(`Codex preflight failed closed: ${e.message}`,hostId);}
}
governed().catch((error) => deny(`Codex preflight failed closed: ${error.message}`,hostIdentity(payload)));
