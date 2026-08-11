#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseHookInput, hookContext, operationHookContext, isReadOnlyTool, activeTask, laneGraphs, skillReceiptPath, readJson, sha256, toolName, mutationPayload, resolveCanonicalSkill } from "./lib/codex-hook-context.mjs";
import { validateTaskGraphShape, recoverableId } from "../lib/validate-task-graph-shape.mjs";
import { lexSimpleCommand } from "./lib/argv-lex.mjs";
import { markerPathFor, readMarker, secureAncestors } from "./lib/bootstrap-marker.mjs";
import { WI_ID_RE } from "../lib/wi-id.mjs";
import { resolveWI } from "../lib/resolve-wi.mjs";
import { inspectBootstrapHandoff } from "./lib/session-handoff.mjs";

function allow() { process.stdout.write("{}\n"); }
// WI-496: the running enforcer's OWN sibling copy of the worktree-ensure script --
// the installed skills root in a provisioned host, the repo itself when the enforcer
// runs from a framework checkout. Same trusted-source derivation as the WI-487
// durable-source pre-check below (import.meta.url), so neither env, payload, nor
// governed-repo content can move it. Single source of truth for BOTH the Arm B
// authorization (bootstrapShapeInner) and the deny() recovery renderer.
function installedEnsureWorktree() {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    return fs.realpathSync(path.join(here, "..", "..", "scripts", "svc-ensure-worktree.mjs"));
  } catch { return null; }
}
// WI-496: same trusted-source derivation for the skill-load CLI -- onboarded
// product repos do not vendor scripts/codex-load-skill.mjs either, so the loader
// token gets the same two-arm treatment as the bootstrap script.
function installedLoadSkill() {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    return fs.realpathSync(path.join(here, "..", "..", "scripts", "codex-load-skill.mjs"));
  } catch { return null; }
}
// WI-498 (F-001): the enforcer's own self-located install root — two levels up
// from hooks/codex/ — realpath'd through the ~/.codex farm symlink to the REAL
// install. This is the ONLY thing that decides whether a repo-relative token may
// resolve to trusted code: the relative spelling is safe ONLY when the effective
// repo IS the install (framework checkout, repo==install), so node's cwd-relative
// resolution can never land on a consumer-planted shadow.
function selfInstallRoot() {
  try {
    const here = fs.realpathSync(path.dirname(fileURLToPath(import.meta.url)));
    return fs.realpathSync(path.join(here, "..", ".."));
  } catch { return null; }
}
function gitCommonDir(root) {
  try {
    const value = execFileSync("git", ["-C", root, "rev-parse", "--git-common-dir"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return fs.realpathSync(path.isAbsolute(value) ? value : path.resolve(root, value));
  } catch { return null; }
}
function repoRootIsInstall(ctx) {
  if (!ctx || !ctx.repo_root) return false;
  const root = selfInstallRoot();
  if (root === null) return false;
  try {
    const repo = fs.realpathSync(ctx.repo_root);
    if (repo === root) return true;
    const repoCommon = gitCommonDir(repo);
    const installCommon = gitCommonDir(root);
    return Boolean(repoCommon && installCommon && repoCommon === installCommon);
  } catch { return false; }
}
// WI-498 (F-001/F-011): accepts the loader token as (a) an absolute path
// realpath-equal to the enforcer's installed sibling loader, OR (b) the relative
// canonical spelling ONLY when realpath(cwd)===repo_root AND repo_root IS the
// install AND the actually-resolved file equals the installed sibling. The former
// unconditional relative acceptance authorized a consumer-planted
// scripts/codex-load-skill.mjs (ACE) — closed here.
function isLoaderToken(token, ctx) {
  const installed = installedLoadSkill();
  if (installed === null) return false;
  if (path.isAbsolute(token)) {
    try { return fs.realpathSync(token) === installed; } catch { return false; }
  }
  if (token !== "scripts/codex-load-skill.mjs") return false;
  if (!ctx || !ctx.repo_root) return false;
  let cwdReal;
  try { cwdReal = fs.realpathSync(ctx.cwd); } catch { return false; }
  if (cwdReal !== ctx.repo_root) return false;
  if (!repoRootIsInstall(ctx)) return false;
  try {
    const candidate = fs.realpathSync(path.resolve(ctx.repo_root, token));
    if (candidate === installed) return true;
    // A linked worktree of the exact framework repository is trusted only when
    // its loader bytes still match the installed canonical loader. Consumer
    // repositories have a different git-common-dir and never reach this arm.
    return sha256(fs.readFileSync(candidate)) === sha256(fs.readFileSync(installed));
  } catch { return false; }
}
function deny(reason, active, ctx) {
  // WI-494: the zero-state recovery string used to be "resolve the active task
  // graph before mutation" -- advice that cannot be followed when no graph exists
  // yet, which left a live agent looping for ~6 turns (the deadlock this WI fixes).
  // Name the actual exit: bootstrap a graph via the canonical worktree-ensure command.
  // WI-496: onboarded product repos do not vendor svc scripts, so the relative
  // spelling is un-runnable there. Probe the governed repo (ctx.repo_root -- already
  // realpath'd; NOT process cwd) and print whichever spelling is paste-runnable in
  // THAT repo. The probe selects display text only; authorization lives solely in
  // bootstrapShapeInner. With no ctx (parse-failure deny) fall back to the installed
  // form, which is runnable everywhere the enforcer is.
  // G6-F001 (WI-496): the command must be paste-runnable BYTE-FOR-BYTE (minus the
  // <N>/<branch> placeholders) -- a trailing "# comment" would be rejected by the
  // bootstrap lexer, so the "no task graph yet" note lives in prose, never in the
  // command string itself.
  // WI-498 (G6-F002): the relative bootstrap spelling is authorized ONLY when
  // repo_root IS the install; in a consumer repo that merely VENDORS/plants
  // scripts/svc-ensure-worktree.mjs the enforcer rejects the relative form, so the
  // recovery must render the install-absolute path there. Render relative only in a
  // genuine framework checkout (repo==install); otherwise install-absolute, with a
  // fail-closed diagnostic if the sibling is unresolvable.
  // WI-498 (G6-F002): ALWAYS render the install-absolute bootstrap path. The
  // relative form is authorized only when repo==install AND cwd===repo_root; a
  // nested cwd under the install (or any consumer repo) would be advised an
  // un-runnable command. install-absolute is runnable everywhere the enforcer is;
  // fail-closed to an explicit diagnostic when the sibling is unresolvable.
  const installedEnsure = installedEnsureWorktree();
  const bootstrapCmd = installedEnsure
    ? `no task graph yet -- bootstrap one (WI-496): node ${installedEnsure} --wi WI-<N> --branch <branch>`
    : "no task graph yet -- bootstrap one: <UNRESOLVED: reinstall svc; svc-ensure-worktree.mjs not found next to the enforcer>";
  // WI-498 (F-002): the loader token is authorized as install-absolute (the relative
  // spelling only in a framework checkout, repo==install). The recovery therefore
  // ALWAYS renders the install-absolute path so the printed command is one the
  // enforcer accepts in ANY repo. Fail-closed to an explicit diagnostic if the
  // installed sibling cannot be resolved -- never emit an unrunnable spelling.
  const installedLoader = installedLoadSkill();
  const loaderSpelling = installedLoader || "<UNRESOLVED: reinstall svc; codex-load-skill.mjs not found next to the enforcer>";
  const command = active?.ok
    ? `node ${loaderSpelling} --graph ${active.graph_path} --task ${active.task.id} --skill ${active.task.metadata?.skill || active.task.skill}`
    : bootstrapCmd;
  process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: `${reason}. Recovery: ${command}` } })}\n`);
}

function isExactSkillLoad(payload, active, ctx) {
  if (toolName(payload) !== "Bash" || !active?.ok) return false;
  const command = mutationPayload(payload).trim();
  if (!command || /[;&|`$<>\n'"\\]/.test(command)) return false;
  const tokens = command.split(/\s+/);
  const expectedSkill = String(active.task.metadata?.skill || active.task.skill || "");
  if (tokens.length !== 8 && tokens.length !== 10) return false;
  if (tokens[0] !== "node" || !isLoaderToken(tokens[1], ctx)) return false;  // WI-496: relative OR installed-absolute loader
  if (tokens[2] !== "--graph" || tokens[3] !== active.graph_path) return false;
  if (tokens[4] !== "--task" || recoverableId(tokens[5]) === null || recoverableId(tokens[5]) !== recoverableId(active.task.id)) return false;
  if (tokens[6] !== "--skill" || tokens[7] !== expectedSkill) return false;
  return tokens.length === 8 || (tokens[8] === "--turn" && tokens[9] === ctx.turn_id);
}

// The first pending task whose blockers are all completed, but ONLY when no task
// is in_progress (a pre-first-load branch). Anything else -> null (no bootstrap load).
function firstRunnablePendingTask(graph) {
  const tasks = graph.tasks || [];
  if (tasks.some((t) => t.status === "in_progress")) return null;
  const byId = new Map(tasks.map((t) => [String(t.id), t]));
  for (const t of tasks) {
    if (t.status !== "pending") continue;
    const runnable = (t.blocked_by || []).every((b) => byId.get(String(b))?.status === "completed");
    if (runnable) return t;
  }
  return null;
}

// WI-486 (EXEC-001 + EXEC-R2-002): the well-formed skill-loader command, allowed as
// the sole bootstrap exception when NO task is yet in_progress so the FIRST skill
// can load. EXEC-R2-002 hardens this: lexical shape is NOT sufficient. The loader
// may ONLY target the session's OWNED graph (test override or the validated
// ownership tuple) — a loader pointed at ANOTHER worktree's graph is refused here,
// before the load CLI could write a receipt into it. We further require the named
// task to be the EXACT first runnable pending task, the declared skill to match
// that task, the graph to be canonically well-formed, and (when present) --turn to
// equal the current turn. When a task IS in_progress the stricter isExactSkillLoad
// governs instead.
function isSkillLoaderShape(payload, ctx, env = process.env) {
  if (toolName(payload) !== "Bash") return false;
  const command = mutationPayload(payload).trim();
  if (!command || /[;&|`$<>\n'"\\]/.test(command)) return false;
  const tokens = command.split(/\s+/);
  if (tokens.length !== 8 && tokens.length !== 10) return false;
  if (tokens[0] !== "node" || !isLoaderToken(tokens[1], ctx)) return false;  // WI-496: relative OR installed-absolute loader
  if (tokens[2] !== "--graph" || !tokens[3]) return false;
  // EXEC-R3-001: the --task token must be a shell-safe recoverable id (string OR
  // number domain, per validateTaskGraphShape) — NOT numeric-only. A bootstrap
  // placeholder task legitimately carries either a numeric id or a string id, and
  // the loader command must be acceptable for both so the FIRST skill can load.
  if (tokens[4] !== "--task" || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(tokens[5])) return false;
  if (tokens[6] !== "--skill" || !/^[a-z0-9][a-z0-9-]*$/.test(tokens[7])) return false;
  if (tokens.length === 10 && tokens[8] !== "--turn") return false;
  // The loader's --graph MUST realpath-equal the session's single owned graph.
  // Codex can carry the effective workdir in the tool envelope separately from
  // the hook's session cwd. In that case ctx.repo_root still names the original
  // checkout even though the canonical graph points at the owned child worktree.
  // Resolve ownership from the graph's own worktree first, then require the same
  // claim/binding tuple and exact graph path. This remains Codex-only (this file is
  // the Codex enforcer); Claude's enforcement path is untouched.
  let ownedReal;
  let argReal;
  try { argReal = fs.realpathSync(path.resolve(tokens[3])); } catch { return false; }
  if (path.basename(path.dirname(argReal)) !== ".svc") return false;
  const graphWorktree = path.dirname(path.dirname(argReal));
  let graphAuthority;
  try {
    graphAuthority = resolveWI(
      { cwd: graphWorktree, session_id: ctx.session_id },
      {
        ...env,
        CODEX_SESSION_ID: ctx.session_id,
        CODEX_THREAD_ID: "",
        SVC_SESSION_ID: ctx.session_id,
        SVC_REQUIRE_SESSION_BINDING: "1",
      },
    );
  } catch { return false; }
  if (!graphAuthority?.authority || graphAuthority.classification !== "owned") return false;
  try { ownedReal = fs.realpathSync(graphAuthority.tuple?.graph_path || ""); } catch { return false; }
  if (ownedReal !== argReal) return false;
  // The owned graph must be canonically valid, and the named task/skill must be the
  // exact first runnable pending task (turn-checked when supplied).
  let graph;
  try { graph = JSON.parse(fs.readFileSync(ownedReal, "utf8")); } catch { return false; }
  if (!validateTaskGraphShape(graph).ok) return false;
  const target = firstRunnablePendingTask(graph);
  if (!target) return false;
  if (recoverableId(tokens[5]) === null || recoverableId(tokens[5]) !== recoverableId(target.id)) return false;
  const expectedSkill = String(target.metadata?.skill || target.skill || "");
  if (!expectedSkill || tokens[7] !== expectedSkill) return false;
  if (tokens.length === 10 && tokens[9] !== ctx.turn_id) return false;
  return true;
}

// WI-494 (CED-01/02): the SECOND and FINAL bootstrap exception. WI-486 authorized the
// first skill LOAD with no in_progress task; it never authorized first graph CREATION,
// so `laneGraphs()` returned [] forever and isSkillLoaderShape could never pass --
// the graph could not exist until it existed (WI-494 defect A).
//
// This authorizes EXACTLY ONE command shape: the canonical worktree bootstrap. It is
// strictly narrower than isSkillLoaderShape in the dimension that matters: it applies
// ONLY in zero-state (no owned graph at all). The instant a graph is owned this
// returns false and isSkillLoaderShape governs -- the two can never both apply.
//
// F-001: the ENTIRE body is wrapped so any fs/graph/path/marker exception returns
// false (fail-closed), and a valid session identity is REQUIRED before any
// authorization -- a missing/blank ctx.session_id can never bootstrap.
function isBootstrapShape(payload, ctx, env = process.env) {
  try { return bootstrapShapeInner(payload, ctx, env); } catch { return false; }
}
function bootstrapShapeInner(payload, ctx, env) {
  if (toolName(payload) !== "Bash") return false;
  // F-001: a format-valid, non-empty session identity is a precondition. Codex session
  // ids are non-trivial tokens; require the same minimum the receipt path enforces.
  if (!ctx.session_id || String(ctx.session_id).length < 8) return false;
  const lexed = lexSimpleCommand(mutationPayload(payload).trim());
  if (!lexed.ok) return false;
  const argv = lexed.argv;
  if (argv[0] !== "node") return false;

  // F-001 (round 2, CONFIRMED CRITICAL): the script path argv[1] is a RELATIVE
  // path. This predicate resolves it against ctx.repo_root to bless the canonical
  // copy, but when the blessed command is actually EXECUTED, node resolves that
  // same relative path against the Bash tool's EFFECTIVE cwd -- which the
  // predicate never verified. From cwd=<repo>/nested with a hostile
  // nested/scripts/svc-ensure-worktree.mjs shadow present, this predicate blessed
  // repo_root's canonical copy while node would actually run the attacker's file:
  // arbitrary code execution with no owned task. The bootstrap exception is
  // therefore authorized ONLY when the effective Bash cwd IS the repo root --
  // node's relative-path resolution and this predicate's resolution then agree by
  // construction, so a shadowed copy anywhere else can never be reached through
  // this exit. ctx.cwd is realpath'd here (hookContext only path.resolve()s it);
  // ctx.repo_root is already realpath'd (findRepoRoot).
  //
  // R2-F001 (round 2 re-review): a reviewer flagged that this still trusts
  // payload.cwd as a proxy for the Bash tool's true effective per-call workdir,
  // and suggested binding to an absolute canonical script path instead to drop
  // that trust entirely. ACCEPTED AS A DOCUMENTED RESIDUAL, not applied: the
  // reviewer could not reproduce a bypass against svc's own documented Codex
  // PreToolUse contract (single top-level payload.cwd, no per-call workdir
  // field), and the priority for this WI is that the LEGITIMATE bootstrap exit
  // (the natural relative-path command an agent actually types from the repo
  // root) keeps working without requiring an unfamiliar absolute-path spelling.
  // If svc's Codex hook contract ever grows a per-call workdir distinct from
  // payload.cwd, this predicate must be revisited.
  // WI-496: TWO mutually exclusive canonical spellings. Onboarded product repos do
  // not vendor svc scripts, so WI-494's repo-local-only binding meant the bootstrap
  // exit could never fire outside the framework repo -- the guard denied its own
  // recovery command there (live-reproduced in example-marketplace). Arm A keeps the
  // WI-494 repo-local semantics byte-for-byte (framework repo / any repo that
  // vendors the script). Arm B accepts exactly ONE absolute path: the running
  // enforcer's own installed sibling script (installedEnsureWorktree(), the WI-487
  // import.meta.url trusted-source derivation) -- unreachable via env, payload, or
  // governed-repo content. Anything else (relative-but-different, absolute-but-
  // different, symlink resolving elsewhere) refuses.
  let cwdReal;
  try { cwdReal = fs.realpathSync(ctx.cwd); } catch { return false; }
  if (cwdReal !== ctx.repo_root) return false;
  if (argv[1] === "scripts/svc-ensure-worktree.mjs") {
    // Arm A -- repo-local relative spelling. WI-498 (F-001): authorize the relative
    // form ONLY when repo_root IS the install (framework checkout). Otherwise a
    // consumer repo that plants scripts/svc-ensure-worktree.mjs at its own root
    // (cwd===repo_root holds) would have `scriptReal===canonicalReal` against ITS
    // OWN planted copy and be authorized (ACE). In a real consumer repo this arm
    // now refuses and control falls to Arm B (install-absolute).
    if (!repoRootIsInstall(ctx)) return false;
    let scriptReal, canonicalReal;
    try { scriptReal = fs.realpathSync(path.resolve(ctx.repo_root, argv[1])); } catch { return false; }
    try { canonicalReal = fs.realpathSync(path.join(ctx.repo_root, "scripts", "svc-ensure-worktree.mjs")); } catch { return false; }
    if (scriptReal !== canonicalReal) return false;
    if (!scriptReal.startsWith(`${ctx.repo_root}${path.sep}`)) return false;
  } else if (path.isAbsolute(argv[1])) {
    // Arm B -- installed absolute spelling (WI-496): realpath-equal to the
    // enforcer's own sibling script, nothing else.
    const installed = installedEnsureWorktree();
    if (installed === null) return false;
    let scriptReal;
    try { scriptReal = fs.realpathSync(argv[1]); } catch { return false; }
    if (scriptReal !== installed) return false;
  } else {
    return false;
  }

  // Flags: --wi and --branch REQUIRED; --from is optional and value-bearing;
  // --json/--print-cd are optional VALUELESS output-format flags the script itself
  // defines (no side effect beyond what is printed to stdout -- see scripts/
  // svc-ensure-worktree.mjs `main()` usage string). Nothing else. An unknown flag
  // is a refusal, so a future ensure-worktree flag cannot silently widen this exit.
  const flags = Object.create(null);
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--json" || key === "--print-cd" || key === "--authority-v2") {
      if (flags[key]) return false;              // no duplicate flags
      flags[key] = true;
      continue;
    }
    if (key !== "--wi" && key !== "--branch" && key !== "--from" && key !== "--handoff") return false;
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) return false;
    if (flags[key]) return false;               // no duplicate flags
    flags[key] = value; i += 1;
  }
  if (!flags["--wi"] || !flags["--branch"]) return false;
  // Mirrors svc-ensure-worktree.mjs WI_RE / BRANCH_RE.
  if (!WI_ID_RE.test(flags["--wi"])) return false;
  if (!/^[A-Za-z0-9._-]+$/.test(flags["--branch"])) return false;   // slash-free
  if (flags["--branch"].includes("..")) return false;
  if (flags["--from"] && !/^[A-Za-z0-9._\/-]+$/.test(flags["--from"])) return false;
  if (flags["--from"] && flags["--from"].includes("..")) return false;

  // ZERO-STATE ONLY: if any graph is owned, this exception does not exist.
  if (flags["--handoff"]) {
    try { inspectBootstrapHandoff(flags["--handoff"], { session_id: ctx.session_id, repo_root: ctx.repo_root, wi: flags["--wi"], branch: flags["--branch"] }, { env }); return true; }
    catch { return false; }
  }
  if (laneGraphs(ctx.repo_root, env).length !== 0) return false;

  // CED-02 + F-001 TRI-STATE marker: the shared readMarker returns {state, marker}
  // where state ∈ absent | valid | invalid. Only `absent` (true zero-state, script
  // will create it under its lock) or a `valid` SAME-SESSION marker may authorize.
  // `invalid` (malformed JSON, symlink, non-regular file, wrong uid, read error) is a
  // DENY -- never conflated with ENOENT (the F-001 fail-closed requirement). session_id/
  // wi/branch/target_worktree are real marker fields; owner_token/pid are
  // process-liveness, so a same-session rerun after the writer exited still passes.
  const markerPath = markerPathFor(ctx.repo_root, flags["--wi"]);
  // F-004: fail closed if any EXISTING ancestor of the marker path (.svc,
  // .svc/bootstrap-intent) is a symlink or foreign-owned -- never trust a marker
  // reached through a redirected parent directory.
  if (!secureAncestors(ctx.repo_root, markerPath)) return false;
  const { state, marker } = readMarker(markerPath);
  if (state === "invalid") return false;
  if (state === "valid") {
    if (String(marker.session_id) !== String(ctx.session_id)) return false;   // both proven non-empty above
    if (String(marker.wi || "") !== flags["--wi"]) return false;
    if (String(marker.branch || "") !== flags["--branch"]) return false;
    let tReal;
    try { tReal = fs.realpathSync(String(marker.target_worktree || "")); } catch { return false; }
    if (tReal !== ctx.repo_root && !tReal.startsWith(`${ctx.repo_root}${path.sep}`)) return false;
  }
  // state === "absent" falls through to allow.
  return true;
}

// WI-487 (AC-487-2/7/7A): fail-closed enforcement-source guard. setup routes this
// enforcer through the durable launcher (`node $LAUNCHER svc-codex-skill-load-enforcer`);
// this in-file pre-check is the second layer for when the enforcer IS reachable. If
// its OWN installed enforcement source is ephemeral/worktree-bound/dangling, DENY
// visibly with an actionable diagnostic + durable receipt instead of proceeding.
// A durable canonical source passes straight through; missing WI-487 libs (older /
// uncommitted install) skip this check and leave the launcher as the hard layer.
try {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dsPath = path.join(here, "..", "lib", "durable-source.mjs");
  const hdPath = path.join(here, "..", "lib", "hook-denial.mjs");
  if (fs.existsSync(dsPath) && fs.existsSync(hdPath)) {
    const ds = await import(pathToFileURL(dsPath).href);
    const source = path.resolve(here, "..", "..");
    const decision = ds.guardEnforcementSource({ hook_id: "svc-codex-skill-load-enforcer", source_path: source, operation: "governed mutation (PreToolUse)", session_id: process.env.SVC_SESSION_ID || process.env.CODEX_SESSION_ID || "" });
    if (decision.decision === "deny") {
      const hd = await import(pathToFileURL(hdPath).href);
      const d = hd.emitDenial({ ...decision, session_id: process.env.SVC_SESSION_ID || process.env.CODEX_SESSION_ID || "" });
      process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: d.host_message || d.message } })}\n`);
      process.exit(0);
    }
  }
} catch { /* skip: the durable launcher remains the hard fail-closed layer */ }

const payload = parseHookInput(fs.readFileSync(0, "utf8"));
// Inspection is authority-free. Classify it before hookContext(), whose
// sessionDir lookup may materialize runtime directories for governed writes.
if (isReadOnlyTool(payload)) { allow(); process.exit(0); }
let ctx;
try { ctx = hookContext(payload); } catch (error) { deny(error.message, null); process.exit(0); }
// WI-499 (session-id bridge): live Codex passes the session id in the PAYLOAD
// (stdin), NOT the environment — but ownership resolution
// (activeTask -> laneGraphs -> resolveWI) reads the session id from the ENV. Without
// a bridge, resolveWI sees no session, finds no owned graph, and denies EVERY
// governed mutation ("no active task"). ctx.session_id is derived from the payload
// (the trusted hookContext), so mirror it into env when the env carries no session
// id — never overriding a real env session (preserves test/CI overrides).
if (ctx.session_id && !process.env.SVC_SESSION_ID && !process.env.CODEX_THREAD_ID && !process.env.CODEX_SESSION_ID) {
  process.env.CODEX_SESSION_ID = ctx.session_id;
}
try { ctx = operationHookContext(payload); } catch (error) { deny(error.message, null, ctx); process.exit(0); }
if (!ctx.operation_scope.ok) {
  deny(`invalid mutation operation scope (${ctx.operation_scope.contradictions.map((item) => item.code).join(", ")})`, null, ctx);
  process.exit(0);
}
// Permanent, narrow framework-maintenance lane: the canonical SVC source repo
// on its main worktree may repair its own enforcement without a product WI.
// This never authorizes a product repository, child worktree, ambiguous scope,
// or any target outside the resolver's canonical operation repository.
if (ctx.operation_scope.framework_maintenance) { allow(); process.exit(0); }
if (!ctx.repo_root) { allow(); process.exit(0); }
const active = activeTask(ctx.repo_root);
// WI-486 (EXEC-001): governed mutations are DENIED unless a secure, contained,
// well-formed graph with a current (in_progress) task is owned. A missing /
// malformed / no-current-task graph fails CLOSED. The exact generated loader
// command (task in_progress) and the well-formed loader SHAPE (no task yet, for
// first-load bootstrap) are the sole exceptions; the load CLI validates source.
if (active.ok) {
  if (isExactSkillLoad(payload, active, ctx)) { allow(); process.exit(0); }
} else {
  if (isSkillLoaderShape(payload, ctx, process.env)) { allow(); process.exit(0); }
  if (isBootstrapShape(payload, ctx, process.env)) { allow(); process.exit(0); }   // WI-494 CED-01
  if (active.diagnostic === "ambiguous active tasks") { deny(active.diagnostic, active, ctx); process.exit(0); }
  deny(`governed mutation denied without an owned in_progress task (${active.diagnostic || "no active task"})`, active, ctx);
  process.exit(0);
}
if (!ctx.session_id || !ctx.session_dir) { deny("missing Codex session identity for governed mutation", active, ctx); process.exit(0); }
const receipt = readJson(skillReceiptPath(ctx));
if (!receipt) { deny("missing or insecure Codex skill-load receipt", active, ctx); process.exit(0); }
const expectedSkill = String(active.task.metadata?.skill || active.task.skill || "");
let actualHash = "";
let actualPath = "";
try { actualHash = sha256(fs.readFileSync(receipt.skill_path, "utf8")); } catch {}
try { actualPath = fs.realpathSync(receipt.skill_path); } catch {}
const canonical = resolveCanonicalSkill(ctx.repo_root, expectedSkill, process.env);
const currentAuthority = resolveWI({ cwd: ctx.repo_root, session_id: ctx.session_id, host: "codex" }, {
  ...process.env, PWD: ctx.repo_root, SVC_REQUIRE_SESSION_BINDING: "1",
});
let fixtureRepoMatches = false;
try { fixtureRepoMatches = fs.realpathSync(process.env.SVC_CODEX_TEST_REPO || "") === ctx.repo_root; } catch {}
const fixtureAuthority = process.env.NODE_ENV === "test" && process.env.SVC_CODEX_TEST_MODE === "1" &&
  fixtureRepoMatches && receipt.authority_model === "test-fixture";
const legacyAuthority = currentAuthority.tuple?.authority_model === "claim-v1" && !receipt.authority_model;
const checks = [
  [receipt.session_id === ctx.session_id, "session"],
  [receipt.task_graph === active.graph_path, "task graph"],
  [recoverableId(receipt.task_id) !== null && recoverableId(receipt.task_id) === recoverableId(active.task.id), "task id"],
  [receipt.skill === expectedSkill, "skill"],
  [receipt.worktree === ctx.repo_root, "worktree"],
  [receipt.skill_sha256 === actualHash, "skill hash"],
  [canonical?.hash === receipt.skill_sha256, "canonical skill hash"],
  [canonical?.allowedPaths.has(actualPath), "canonical skill path"],
  [fixtureAuthority || (currentAuthority.authority && currentAuthority.tuple), "current authority tuple"],
  [fixtureAuthority || legacyAuthority || Number(receipt.authority_generation || 0) === Number(currentAuthority.tuple?.authority_generation || 0), "authority generation"],
  [fixtureAuthority || legacyAuthority || String(receipt.lease_id || "") === String(currentAuthority.tuple?.lease_id || ""), "controller lease"],
];
const failed = checks.find(([ok]) => !ok);
if (failed) { deny(`Codex skill-load receipt mismatch: ${failed[1]}`, active, ctx); process.exit(0); }
allow();
