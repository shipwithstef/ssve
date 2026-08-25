#!/usr/bin/env node
import fs from "node:fs";
function deny(reason) { process.stdout.write(`${JSON.stringify({hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:String(reason)}})}\n`); process.exit(0); }
function allow(updatedInput = null) { process.stdout.write(updatedInput ? `${JSON.stringify({hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"allow",updatedInput}})}\n` : "{}\n"); }
function lightPayload(raw){try{const value=JSON.parse(String(raw||"{}"));return value&&typeof value==="object"&&!Array.isArray(value)?value:{};}catch{return {};}}
function lightRead(payload){
  const name=String(payload.tool_name||payload.toolName||payload.tool?.name||payload.tool||"");
  if(new Set(["Read","Glob","Grep","Search","View","view_image"]).has(name))return true;
  if(name!=="Bash")return false;
  const input=payload.tool_input||payload.toolInput||payload.arguments||payload.args||{};
  const command=String(input.command||input.cmd||"").trim();
  // Ultra-hot, deliberately narrow path: quoted sed line/range print only,
  // with an ordinary input path and optional diagnostic redirection. Anything
  // ambiguous falls through to the complete argv-aware classifier below.
  return /^sed\s+-n\s+(['"])(?:\d+|\$)(?:,(?:\d+|\$))?p\1\s+[A-Za-z0-9_./~][^;&|`$<>\s]*(?:\s+(?:[012]?>\s*\/dev\/null|[012]?>&[012]))*$/.test(command);
}
const payload=lightPayload(fs.readFileSync(0,"utf8"));
if(lightRead(payload)){allow();process.exit(0);}
async function governed() {
const { parseHookInput, operationHookContext, isReadOnlyTool, mutationPayload, toolName } = await import("./lib/codex-hook-context.mjs");
const { evaluatePreToolObservation, evaluateSelfHealAuthority } = await import("../lib/pretool-decision-engine.mjs");
const { resolveOperationScope } = await import("../lib/operation-scope.mjs");
const { resolveWI } = await import("../lib/resolve-wi.mjs");
const { parseBootstrapCommand } = await import("./lib/bootstrap-command.mjs");
const { createBootstrapHandoff } = await import("./lib/session-handoff.mjs");
const { readOwnerLease } = await import("./lib/owner-lease.mjs");
const { authorizeObservedAction } = await import("../../scripts/svc-authorized-action.mjs");
const path = await import("node:path");
const crypto = await import("node:crypto");
const { spawnSync } = await import("node:child_process");
const { fileURLToPath } = await import("node:url");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOOK_ROOT = path.resolve(HERE, "..");
const CHILDREN = [["svc-worktree-isolation-guard.mjs"],["svc-workflow-guard.mjs","--bash-guard"],["svc-workflow-guard.mjs"],["svc-loop-guard.mjs"],["svc-skill-artifact-authenticity.mjs"],["svc-session-contract-freshness.mjs"],["svc-inertia-check.mjs"],["codex","svc-codex-skill-load-enforcer.mjs"],["svc-impact-triad-guard.mjs"]];
function sidOf(p) { return String(p.session_id || p.sessionId || p.thread_id || p.threadId || process.env.SVC_SESSION_ID || process.env.CODEX_THREAD_ID || process.env.CODEX_SESSION_ID || ""); }
function worktreeRows(repo) { return (spawnSync("git",["-C",repo,"worktree","list","--porcelain"],{encoding:"utf8"}).stdout||"").split(/\r?\n/).filter(x=>x.startsWith("worktree ")).map(x=>x.slice(9)); }
function baton(repo,sid,payload) { if(!repo)return null; const found=[]; try { for(const root of new Set([repo,...worktreeRows(repo)])){ const candidate=fs.realpathSync(root); const dir=path.join(candidate,".svc","bindings"); try { for(const n of fs.readdirSync(dir)){ if(!n.endsWith(".json"))continue; const f=path.join(dir,n),s=fs.lstatSync(f); if(!s.isFile()||s.isSymbolicLink())continue; const b=JSON.parse(fs.readFileSync(f,"utf8")); if(b.session_id===sid&&b.role==="mutating"&&!b.released_at)found.push({worktree:fs.realpathSync(b.worktree_root),binding:b}); } } catch {} } if(!found.length){ for(const root of new Set([repo,...worktreeRows(repo)])){ const candidate=fs.realpathSync(root); const resolved=resolveWI({...payload,cwd:candidate,session_id:sid},{...process.env,SVC_REQUIRE_SESSION_BINDING:"1"}); if(resolved.authority&&resolved.tuple?.worktree_root===candidate)found.push({worktree:candidate,binding:null}); } } } catch {} return found.length===1?found[0]:found.length>1?{conflict:true}:null; }
function child(spec,payload){const a=spec[0]==="codex"?[path.join(HERE,spec[1])]:[path.join(HOOK_ROOT,spec[0])];if(spec[0]!=="codex")a.push(...spec.slice(1));const r=spawnSync(process.execPath,a,{input:JSON.stringify(payload),encoding:"utf8",env:{...process.env,SVC_CODEX_DISPATCHER_CHILD:"1"}});if(r.status!==0)return r.stderr?.trim()||"Codex preflight denied the operation";const t=String(r.stdout||"").trim();if(!t||t==="{}")return "";try{const j=JSON.parse(t.split(/\r?\n/).filter(Boolean).at(-1));return (j?.hookSpecificOutput?.permissionDecision||j?.decision)==="deny"?(j.hookSpecificOutput?.permissionDecisionReason||j.reason||"Codex preflight denied the operation"):"";}catch{return "";}}
try { const key=payload.tool_input?"tool_input":payload.toolInput?"toolInput":payload.arguments?"arguments":"args";if(isReadOnlyTool(payload)){// WI-FW-HOOKS-SAFETY-01 (FP-03): ONE engine decision. The original input is
// immutable evidence; the only permitted rewrite is the engine's proven
// per-Git-argv `--no-optional-locks` normalization — never an `export`
// prefix that a sibling classifier could re-read as an unbound mutation.
const observation=evaluatePreToolObservation(payload);if(observation&&observation.execution_input){allow(observation.execution_input);}else allow();process.exit(0);}const sid=sidOf(payload);if(!sid)deny("Codex session identity is missing; recovery: resume with a stable session_id.");const ctx=operationHookContext(payload,{...process.env,SVC_HOST:"codex"});const scope=resolveOperationScope(payload,{host:"codex",env:process.env});if(!scope.ok)deny(`invalid mutation operation scope (${scope.contradictions[0]?.code||"scope contradiction"})`);const repo=scope.operation_repository?.worktree_root||scope.session_repository?.worktree_root||ctx.repo_root;let b=baton(repo,sid,payload);if(b?.conflict)deny("multiple active bindings for this session; recovery: select one WI explicitly.");let effective=payload;const input=payload[key];if(b?.worktree&&!scope.explicit_workdir.present&&input&&typeof input==="object")effective={...payload,[key]:{...input,workdir:b.worktree}};const command=mutationPayload(effective);const boot=parseBootstrapCommand(command);if(boot&&!boot.handoff){// WI-FW-HOOKS-SAFETY-01 (FP-04): operation scope outranks stale session cwd.
// The default-checkout requirement is evaluated against the repository the
// EXPLICIT operation evidence resolves to when present; session cwd is
// context, never mutation authority.
const bootstrapScope=scope.explicit_workdir&&scope.explicit_workdir.present?scope.operation_repository:scope.session_repository;if(!repo||!bootstrapScope||!bootstrapScope.default_worktree_root||bootstrapScope.worktree_root!==bootstrapScope.default_worktree_root)deny("bootstrap must start from the repository default checkout");const base=boot.from==="origin/main"?(spawnSync("git",["-C",repo,"rev-parse","origin/main"],{encoding:"utf8"}).stdout||"").trim():boot.from;const handoff=createBootstrapHandoff({session_id:sid,repo_root:repo,wi:boot.wi,branch:boot.branch,base,command_digest:`sha256:${crypto.createHash("sha256").update(command).digest("hex")}`});const ensure=path.resolve(HERE,"..","..","scripts","svc-ensure-worktree.mjs");effective={...effective,[key]:{...effective[key],command:`node ${ensure} --wi ${boot.wi} --branch ${boot.branch} --from ${boot.from} --authority-v2${boot.json?" --json":""}${boot.print_cd?" --print-cd":""} --handoff ${handoff.nonce}`,workdir:repo}};}
const finalScope=resolveOperationScope(effective,{host:"codex",env:process.env});if(!finalScope.ok)deny(`invalid bound mutation scope (${finalScope.contradictions[0]?.code||"scope contradiction"})`);const finalRepo=finalScope.operation_repository?.worktree_root||repo;const explicitAuth=effective[key]?.svc_authorization;const auth=authorizeObservedAction({root:finalRepo,command:mutationPayload(effective),annotation:explicitAuth});if(!auth.allow)deny(auth.reason);const lease=readOwnerLease(finalRepo,sid,process.env);const defaultRoot=finalScope.operation_repository?.default_worktree_root||"";if(lease&&(!b?.worktree||lease.worktree_root===b.worktree)&&(!defaultRoot||lease.worktree_root!==defaultRoot||finalScope.framework_maintenance)){allow(effective!==payload?effective[key]:null);process.exit(0);}if(!b?.worktree&&!boot){
// WI-FW-HOOKS-SAFETY-01 (FP-05/AC-3): ONE exact self-heal attempt when fresh positive prompt authority agrees; otherwise an actionable denial that never prescribes a command this same policy path would block.
const gate=evaluateSelfHealAuthority(payload,process.env);if(!gate.eligible)deny(`mutation requires a bound WI worktree (AUTH_BINDING_MISSING_SELF_HEAL_INELIGIBLE: ${gate.reason_code}); recovery: say ‘work on <WI>’ from the worktree or arm SVC OWNER OVERRIDE.`);let adopted=null;try{const ensureModule=await import("../../scripts/svc-ensure-worktree.mjs");adopted=ensureModule.adoptExistingWorktree({wi:gate.wi,cwd:repo},{...process.env,SVC_SESSION_ID:sid});}catch(error){deny(`self-heal refused without mutation (${error.message})`);}if(adopted){b=baton(repo,sid,payload);if(b?.conflict)deny("multiple active bindings for this session after self-heal; recovery: select one WI explicitly.");if(b?.worktree&&input&&typeof input==="object"&&!scope.explicit_workdir.present)effective={...payload,[key]:{...input,workdir:b.worktree}};}if(!b?.worktree)deny("self-heal completed but the binding did not resolve; recovery: re-run the operation from the worktree.");}for(const spec of CHILDREN){const reason=child(spec,effective);if(reason)deny(reason);}allow(effective!==payload?effective[key]:null);}catch(e){deny(`Codex preflight failed closed: ${e.message}`);}
}
governed().catch((error) => deny(`Codex preflight failed closed: ${error.message}`));
