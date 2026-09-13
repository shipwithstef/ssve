#!/usr/bin/env node

import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, execSync } from "node:child_process";
import { claimFreshness, normalizeClaimOwner, readClaimAbsolute } from "./wi-claim.mjs";
import { validateTaskGraphShape } from "./validate-task-graph-shape.mjs";
import { WI_ID_RE } from "./wi-id.mjs";

// Keep authority resolution self-contained because several supported host and
// eval runtimes install this synchronous resolver as a deliberately minimal
// module slice. authority-store.mjs remains the canonical mutation/CAS API;
// these helpers only derive the same keys and securely read a controller lease.
function authorityDigest(value) {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function principalId({ host, session_id, agent_id = null }) {
  if (!String(host || "").trim() || !String(session_id || "").trim()) {
    throw new Error("principal requires host and stable session id");
  }
  return authorityDigest(Buffer.from(`${String(host).trim()}\0${String(session_id).trim()}\0${agent_id ? String(agent_id) : ""}`));
}

function repositoryId(worktreeRoot) {
  const root = fs.realpathSync(worktreeRoot);
  const value = execFileSync("git", ["-C", root, "rev-parse", "--git-common-dir"], { encoding: "utf8" }).trim();
  return authorityDigest(Buffer.from(fs.realpathSync(path.isAbsolute(value) ? value : path.resolve(root, value))));
}

function authorityStateRoot(worktreeRoot, env = process.env) {
  if (env.SVC_AUTHORITY_STATE_ROOT) return path.resolve(env.SVC_AUTHORITY_STATE_ROOT);
  const root = fs.realpathSync(worktreeRoot);
  const value = execFileSync("git", ["-C", root, "rev-parse", "--git-common-dir"], { encoding: "utf8" }).trim();
  return path.join(fs.realpathSync(path.isAbsolute(value) ? value : path.resolve(root, value)), "svc-authority-v2");
}

function assertSecureAuthorityRoot(stateRoot) {
  const absolute = path.resolve(stateRoot);
  const parsed = path.parse(absolute);
  let current = parsed.root;
  for (const segment of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    let stat;
    try { stat = fs.lstatSync(current); }
    catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`unsafe controller authority root: ${current}`);
    if (current === absolute && typeof process.getuid === "function" && stat.uid !== process.getuid()) {
      throw new Error("controller authority root is foreign-owned");
    }
  }
  return absolute;
}

function readController({ stateRoot, repoId, wi }) {
  stateRoot = assertSecureAuthorityRoot(stateRoot);
  const key = crypto.createHash("sha256").update(`${repoId}\0${wi}`).digest("hex");
  const file = path.join(path.resolve(stateRoot), "leases", `${key}.json`);
  let stat;
  try { stat = fs.lstatSync(file); } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("controller lease is not a secure regular file");
  if (typeof process.getuid === "function" && stat.uid !== process.getuid()) throw new Error("controller lease is foreign-owned");
  const lease = JSON.parse(fs.readFileSync(file, "utf8"));
  if (lease?.schema_version !== 2 || lease.repo_id !== repoId || lease.wi !== wi) {
    throw new Error("controller lease identity is invalid");
  }
  return lease;
}

function readControllerByPrincipal({ stateRoot, repoId, worktreeRoot, principal }) {
  stateRoot = assertSecureAuthorityRoot(stateRoot);
  const dir = path.join(path.resolve(stateRoot), "leases");
  if (!fs.existsSync(dir)) return null;
  const matches = [];
  for (const name of fs.readdirSync(dir)) {
    if (!/^[0-9a-f]{64}\.json$/.test(name)) continue;
    const file = path.join(dir, name);
    let stat;
    try { stat = fs.lstatSync(file); } catch { continue; }
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("controller lease index contains an insecure entry");
    if (typeof process.getuid === "function" && stat.uid !== process.getuid()) throw new Error("controller lease index contains a foreign-owned entry");
    const lease = JSON.parse(fs.readFileSync(file, "utf8"));
    if (lease?.schema_version !== 2 || lease.repo_id !== repoId || lease.state !== "active" || lease.controller_principal !== principal) continue;
    let leaseWorktree = "";
    try { leaseWorktree = fs.realpathSync(lease.worktree_root); } catch { throw new Error("controller lease worktree is invalid"); }
    if (leaseWorktree === worktreeRoot) matches.push(lease);
  }
  if (matches.length > 1) throw new Error("multiple active controller leases match this principal and worktree");
  return matches[0] || null;
}

export function findSvcDir(startDir) {
  let dir = path.resolve(startDir || process.cwd());
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, ".svc");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate;
    dir = path.dirname(dir);
  }
  return null;
}

function currentBranch(cwd = process.cwd()) {
  try {
    return execFileSync("git", ["-C", cwd, "branch", "--show-current"], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function currentWorktree(cwd = process.cwd()) {
  try {
    return fs.realpathSync(execFileSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim());
  } catch {
    return "";
  }
}

function repoRootFor(worktreeRoot) {
  try {
    const common = execFileSync("git", ["-C", worktreeRoot, "rev-parse", "--git-common-dir"], { encoding: "utf8" }).trim();
    return fs.realpathSync(path.dirname(path.resolve(worktreeRoot, common)));
  } catch {
    return worktreeRoot;
  }
}

export function sessionId(hookPayload = {}, env = process.env) {
  return String(
    hookPayload.session_id || hookPayload.sessionId || hookPayload.conversation_id || hookPayload.conversationId || hookPayload.thread_id || hookPayload.threadId ||
    env.CURSOR_CONVERSATION_ID || env.CURSOR_SESSION_ID || env.SVC_SESSION_ID || env.GROK_SESSION_ID || env.CODEX_THREAD_ID || env.CODEX_SESSION_ID ||
    env.KIMI_SESSION_ID || env.CLAUDE_SESSION_ID || env.GEMINI_SESSION_ID || ""
  );
}

export function resolveAuthorityHost(payload = {}, env = process.env) {
  const knownHosts = new Set(["codex", "claude", "kimi", "gemini", "opencode", "mimo-code", "antigravity", "cursor", "grok"]);
  const wired = String(env.SVC_HOST || "").toLowerCase();
  if (wired) return knownHosts.has(wired) ? wired : "";
  if (env.CURSOR_CONVERSATION_ID || env.CURSOR_AGENT || payload.conversation_id || payload.cursor_version) return "cursor";
  if (env.GROK_SESSION_ID) return "grok";
  const payloadHost = String(payload.host || "").toLowerCase();
  if (payloadHost) return knownHosts.has(payloadHost) ? payloadHost : "";
  if (env.CODEX_THREAD_ID || env.CODEX_SESSION_ID) return "codex";
  if (env.CLAUDE_SESSION_ID) return "claude";
  if (env.KIMI_SESSION_ID) return "kimi";
  if (env.GEMINI_SESSION_ID) return "gemini";
  if (env.OPENCODE_SESSION_ID) return "opencode";
  return "codex";
}

export function wiFromBranch(cwd = process.cwd()) {
  try {
    const branch = execSync("git symbolic-ref --short HEAD 2>/dev/null", { cwd, encoding: "utf8", timeout: 5000 }).trim();
    const explicit = branch.match(/WI-(\d+)/i);
    if (explicit) return `WI-${explicit[1]}`;
    const legacy = branch.match(/(?:feature|bugfix|refactor)-(\d+)/i);
    return legacy ? `WI-${legacy[1]}` : "";
  } catch {
    return "";
  }
}

export function wiFromClaim(svcDir, token) {
  if (!svcDir || !token) return "";
  const claimsDir = path.join(svcDir, "claims");
  if (!fs.existsSync(claimsDir)) return "";
  try {
    for (const file of fs.readdirSync(claimsDir)) {
      if (!file.endsWith(".claim.json")) continue;
      const claimPath = path.join(claimsDir, file);
      const claim = readClaimAbsolute(path.resolve(claimPath));
      const owner = normalizeClaimOwner(claim || {});
      if (owner.attributable && owner.session_id === token && claimFreshness(claim, claimPath).fresh) {
        return file.replace(".claim.json", "");
      }
    }
  } catch {}
  return "";
}

export function wiFromSingleInProgress(svcDir) {
  if (!svcDir) return "";
  try {
    const active = [];
    for (const file of fs.readdirSync(svcDir).filter((name) =>
      name.startsWith("lane-tasks-") && name.endsWith(".json") && !name.includes(".completed"))) {
      const graph = JSON.parse(fs.readFileSync(path.join(svcDir, file), "utf8"));
      if ((graph.tasks || []).some((task) => task.status === "pending" || task.status === "in_progress")) {
        active.push(graph.wi || file.replace("lane-tasks-", "").replace(".json", ""));
      }
    }
    return active.length === 1 ? active[0] : "";
  } catch {
    return "";
  }
}

export function wiFromLastContract(svcDir) {
  if (!svcDir) return "";
  try {
    const rows = fs.readFileSync(path.join(svcDir, "session-contract.jsonl"), "utf8").split(/\r?\n/).filter(Boolean);
    return rows.length ? String(JSON.parse(rows.at(-1)).wi || "") : "";
  } catch {
    return "";
  }
}

export function sessionRoleFromContract(svcDir) {
  if (!svcDir) return "";
  try {
    const rows = fs.readFileSync(path.join(svcDir, "session-contract.jsonl"), "utf8").split(/\r?\n/).filter(Boolean);
    const last = rows.length ? JSON.parse(rows.at(-1)) : {};
    return String(last.session_role || last.role || "");
  } catch {
    return "";
  }
}

export function readBinding(svcDir, token) {
  if (!svcDir || !token) return null;
  const dir = path.join(svcDir, "bindings");
  if (!fs.existsSync(dir)) return null;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const bindingPath = path.resolve(dir, file);
    const binding = readClaimAbsolute(bindingPath);
    if (binding?.session_id === token && !binding.released_at) return { ...binding, binding_path: bindingPath };
  }
  return null;
}

// Derive and validate the exact graph the binding selects (SIB-04). The graph is
// ALWAYS `<worktree>/.svc/lane-tasks-<WI>.json` — never a repository-wide scan and
// never supplied by any override. When the file exists it is realpath-checked so a
// symlink that escapes the bound worktree denies authority (SIB-06). An optional
// SVC_CODEX_TASK_GRAPH override is a consistency assertion only: it must realpath to
// the exact derived graph or authority is denied (SIB-06/07); it never supplies the
// tuple's graph field.
function graphDecision(binding, worktreeRoot, env) {
  const graphPath = path.join(worktreeRoot, ".svc", `lane-tasks-${binding.wi}.json`);
  // WI-486 (EXEC-001): authority REQUIRES a secure, regular, contained graph
  // file that EXISTS. A missing or insecure (symlink / foreign-owned) graph
  // denies authority — it never falls through to an authoritative tuple. Reads
  // are gated separately (before resolution) and are unaffected by this.
  let stat;
  try { stat = fs.lstatSync(graphPath); }
  catch { return { ok: false, reason: "bound graph is missing" }; }
  if (!stat.isFile() || stat.isSymbolicLink()) return { ok: false, reason: "bound graph is not a regular file" };
  if (typeof process.getuid === "function" && stat.uid !== process.getuid()) {
    return { ok: false, reason: "bound graph is foreign-owned" };
  }
  let graphReal = graphPath;
  try { graphReal = fs.realpathSync(graphPath); } catch { graphReal = graphPath; }
  if (graphReal !== graphPath && !graphReal.startsWith(`${worktreeRoot}${path.sep}`)) {
    return { ok: false, reason: "bound graph escapes worktree" };
  }
  // WI-486 (EXEC-R2-003): a secure, contained graph FILE is necessary but not
  // sufficient — its BYTES must also parse and pass the ONE canonical shape +
  // integrity validator. A graph that lost required fields or gained an unknown
  // status after a receipt was issued denies authority (fail closed), so post-load
  // graph corruption can never satisfy the mutation gate.
  let graphDoc;
  try { graphDoc = JSON.parse(fs.readFileSync(graphReal, "utf8")); }
  catch { return { ok: false, reason: "bound graph is malformed (unparseable bytes)" }; }
  const shape = validateTaskGraphShape(graphDoc);
  if (!shape.ok) return { ok: false, reason: `bound graph is malformed: ${shape.reason}` };
  const override = env && env.SVC_CODEX_TASK_GRAPH ? String(env.SVC_CODEX_TASK_GRAPH) : "";
  if (override) {
    let overrideReal = "";
    try { overrideReal = fs.realpathSync(path.resolve(override)); } catch { overrideReal = path.resolve(override); }
    if (overrideReal !== graphReal) return { ok: false, reason: "graph override mismatch" };
  }
  return { ok: true, graphPath: graphReal };
}

export function bindingDecision(binding, { cwd, svcDir, token, requestedWi, env = process.env } = {}) {
  if (!binding) return { ok: false, reason: "no exact session binding" };
  const worktreeRoot = currentWorktree(cwd);
  const branch = currentBranch(cwd);
  const repoRoot = repoRootFor(worktreeRoot);
  let bindingWorktree = "";
  try {
    bindingWorktree = path.isAbsolute(String(binding.worktree_root || ""))
      ? fs.realpathSync(binding.worktree_root)
      : "";
  } catch {}
  if (!bindingWorktree || bindingWorktree !== worktreeRoot) {
    return { ok: false, reason: "binding worktree mismatch" };
  }
  if (!path.isAbsolute(String(binding.repo_root || "")) || path.resolve(binding.repo_root) !== path.resolve(repoRoot)) {
    return { ok: false, reason: "binding repository mismatch" };
  }
  if (binding.branch !== branch) return { ok: false, reason: "binding branch mismatch" };
  if (binding.session_id !== token) return { ok: false, reason: "binding session mismatch" };
  if (binding.role !== "mutating") return { ok: false, reason: "non-execution role" };
  if (!WI_ID_RE.test(binding.wi)) return { ok: false, reason: "binding WI invalid" };
  if (requestedWi && requestedWi !== binding.wi) return { ok: false, reason: "requested WI differs from binding" };
  if (!path.isAbsolute(String(binding.claim_path || ""))) return { ok: false, reason: "claim path is not absolute" };
  const claim = readClaimAbsolute(binding.claim_path);
  const freshness = claimFreshness(claim, binding.claim_path);
  if (!freshness.fresh) return { ok: false, reason: freshness.reason };
  if (freshness.owner.session_id !== token) return { ok: false, reason: "fresh foreign claim" };
  if (claim.wi && claim.wi !== binding.wi) return { ok: false, reason: "claim WI mismatch" };
  if (path.resolve(claim.worktree_root || "") !== worktreeRoot) return { ok: false, reason: "claim worktree mismatch" };
  if (Number(claim.generation || 0) !== Number(binding.generation || 0)) return { ok: false, reason: "claim and binding generation mismatch" };
  const graph = graphDecision(binding, worktreeRoot, env);
  if (!graph.ok) return { ok: false, reason: graph.reason };
  return { ok: true, worktreeRoot, repoRoot, branch, claim, svcDir, graphPath: graph.graphPath, generation: Number(claim.generation || binding.generation || 0) };
}

// Map a denied binding decision to the SIB-20 classification vocabulary
// (owned/foreign/missing/stale/malformed/mismatch). Diagnostic-only, never authority.
function classifyDecision(binding, reason) {
  if (!binding) return "missing";
  const r = String(reason || "");
  if (r === "no exact session binding") return "missing";
  if (/bound graph is missing/.test(r)) return "missing";
  if (/stale claim/.test(r)) return "stale";
  if (/fresh foreign claim/.test(r)) return "foreign";
  if (/insecure claim path|unattributable owner|bound graph|graph override/.test(r)) return "malformed";
  return "mismatch";
}

export function resolveWI(hookPayload = {}, env = process.env) {
  hookPayload = hookPayload || {};
  env = env || process.env;
  const cwd = path.resolve(hookPayload.cwd || hookPayload.working_directory || env.PWD || process.cwd());
  const svcDir = findSvcDir(cwd);
  const token = sessionId(hookPayload, env);
  const requestedWi = String(env.SVC_WORKER_WI || hookPayload.wi || "");
  const diagnostics = {
    branch_wi: wiFromBranch(cwd),
    single_in_progress: wiFromSingleInProgress(svcDir),
    last_contract: wiFromLastContract(svcDir),
    requested_wi: requestedWi,
  };
  const binding = readBinding(svcDir, token);
  const decision = bindingDecision(binding, { cwd, svcDir, token, requestedWi, env });
  if (decision.ok) {
    let v2 = null;
    try {
      const repoId = repositoryId(decision.worktreeRoot);
      const stateRoot = authorityStateRoot(decision.worktreeRoot, env);
      const lease = readController({ stateRoot, repoId, wi: binding.wi });
      if (lease) {
        const host = resolveAuthorityHost(hookPayload, env);
        const agentId = hookPayload.agent_id || hookPayload.agentId || env.SVC_AGENT_ID || null;
        const principal = principalId({ host, session_id: token, agent_id: agentId });
        if (lease.state !== "active") throw new Error("v2 controller lease is not active");
        if (lease.controller_principal !== principal) throw new Error("v2 controller principal mismatch");
        if (fs.realpathSync(lease.worktree_root) !== decision.worktreeRoot) throw new Error("v2 controller worktree mismatch");
        v2 = { lease, repo_id: repoId, state_root: stateRoot, principal_id: principal };
      }
    } catch (error) {
      return { wi: "", source: "unresolved", authority: false, classification: "mismatch", reason: error.message, diagnostics: { ...diagnostics, reason: error.message }, binding, tuple: null };
    }
    const tuple = {
      repo_root: decision.repoRoot,
      worktree_root: decision.worktreeRoot,
      branch: decision.branch,
      wi: binding.wi,
      graph_path: decision.graphPath,
      session_id: token,
      claim_path: path.resolve(String(binding.claim_path)),
      binding_path: binding.binding_path,
      claim_generation: decision.generation,
      authority_model: v2 ? "controller-lease-v2" : "claim-v1",
      repo_id: v2?.repo_id || null,
      lease_id: v2?.lease.lease_id || null,
      authority_generation: v2?.lease.generation || decision.generation,
      principal_id: v2?.principal_id || null,
    };
    return { wi: binding.wi, source: "session_worktree_binding", authority: true, classification: "owned", reason: "owned", diagnostics, binding, tuple };
  }

  // A successful handover intentionally changes principals without inheriting
  // the source session's v1 claim/binding. Discover the exact active v2 lease by
  // stable principal + repository + canonical worktree; never infer a parent or
  // select by branch/name. Ambiguity and corrupt lease evidence fail closed.
  if (token) {
    try {
      const worktreeRoot = currentWorktree(cwd);
      if (worktreeRoot) {
        const repoId = repositoryId(worktreeRoot);
        const stateRoot = authorityStateRoot(worktreeRoot, env);
        const host = resolveAuthorityHost(hookPayload, env);
        const agentId = hookPayload.agent_id || hookPayload.agentId || env.SVC_AGENT_ID || null;
        const principal = principalId({ host, session_id: token, agent_id: agentId });
        const lease = readControllerByPrincipal({ stateRoot, repoId, worktreeRoot, principal });
        if (lease) {
          if (requestedWi && requestedWi !== lease.wi) throw new Error("requested WI differs from controller lease");
          const graph = graphDecision({ wi: lease.wi }, worktreeRoot, env);
          if (!graph.ok) throw new Error(graph.reason);
          const tuple = {
            repo_root: repoRootFor(worktreeRoot), worktree_root: worktreeRoot,
            branch: currentBranch(worktreeRoot), wi: lease.wi, graph_path: graph.graphPath,
            session_id: token, claim_path: null, binding_path: null, claim_generation: null,
            authority_model: "controller-lease-v2", repo_id: repoId, lease_id: lease.lease_id,
            authority_generation: lease.generation, principal_id: principal,
          };
          return { wi: lease.wi, source: "controller_lease", authority: true, classification: "owned", reason: "owned", diagnostics, binding: null, tuple };
        }
      }
    } catch (error) {
      return { wi: "", source: "unresolved", authority: false, classification: "mismatch", reason: error.message, diagnostics: { ...diagnostics, reason: error.message }, binding, tuple: null };
    }
  }

  const classification = classifyDecision(binding, decision.reason);
  const strict = env.SVC_REQUIRE_SESSION_BINDING === "1" || env.SVC_REQUIRE_SESSION_BINDING === "true";
  if (strict || binding) {
    return { wi: "", source: "unresolved", authority: false, classification, reason: decision.reason, diagnostics: { ...diagnostics, reason: decision.reason }, binding, tuple: null };
  }

  // Legacy compatibility for callers without any host-session identity. These
  // values are diagnostic-only and never carry authority=true (foreign graphs,
  // branch names, and repository inventory are diagnostics, never authority).
  const legacy = (wi, source) => ({ wi, source, authority: false, classification, reason: decision.reason, diagnostics, binding: null, tuple: null });
  if (env.SVC_WORKER_WI) return legacy(env.SVC_WORKER_WI, "SVC_WORKER_WI");
  if (hookPayload.wi) return legacy(hookPayload.wi, "hook_payload");
  if (diagnostics.branch_wi) return legacy(diagnostics.branch_wi, "branch_name");
  if (diagnostics.single_in_progress) return legacy(diagnostics.single_in_progress, "single_in_progress");
  if (diagnostics.last_contract) return legacy(diagnostics.last_contract, "contract_fallback");
  return legacy("", "unresolved");
}

export function isNonExecutionRole(hookPayload = {}, env = process.env) {
  hookPayload = hookPayload || {};
  env = env || process.env;
  const role = String(hookPayload.session_role || hookPayload.role || env.SVC_SESSION_ROLE || "");
  const nonBlocking = new Set(["reviewer", "adversarial", "research", "audit", "cross-model-review"]);
  if (nonBlocking.has(role)) return true;
  const svcDir = findSvcDir(hookPayload.cwd || env.PWD || process.cwd());
  return nonBlocking.has(sessionRoleFromContract(svcDir));
}

// --- JSON CLI serialization (WI-486, SIB-10/19) ------------------------------
// The SAME resolveWI function, serialized to a machine-readable classification so
// the Claude Stop guard consumes ownership through one implementation instead of a
// second embedded resolver. Always emits { authority, classification, reason, ... }
// so callers can gate deterministically. Never throws to stdout — a failure is
// serialized as a non-authoritative `malformed` result.
export function authorityJson(hookPayload = {}, env = process.env) {
  try {
    const r = resolveWI(hookPayload, env);
    return {
      authority: Boolean(r.authority),
      classification: String(r.classification || "missing"),
      reason: String(r.reason || ""),
      wi: r.wi || "",
      source: r.source || "",
      tuple: r.tuple || null,
      diagnostics: r.diagnostics || {},
    };
  } catch (error) {
    return { authority: false, classification: "malformed", reason: String((error && error.message) || error), wi: "", source: "error", tuple: null, diagnostics: {} };
  }
}

function cliMain(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) { args[key] = next; i += 1; }
    else args[key] = true;
  }
  const hookPayload = {};
  if (typeof args.cwd === "string") hookPayload.cwd = args.cwd;
  if (typeof args.wi === "string") hookPayload.wi = args.wi;
  process.stdout.write(`${JSON.stringify(authorityJson(hookPayload, process.env))}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  if (argv.includes("--emit-authority-json")) {
    cliMain(argv.filter((a) => a !== "--emit-authority-json"));
  } else {
    process.stdout.write(`${JSON.stringify({ error: "unknown command; use --emit-authority-json [--cwd DIR] [--wi WI-N]" })}\n`);
    process.exit(2);
  }
}
