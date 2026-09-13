#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  acceptHandover, authorityStateRoot, bootstrapController, migrateV1Claim,
  prepareHandover, principalId, readController, recoverController,
  releaseController, repositoryId, resumeController, rollbackV1Migration, takeoverController,
} from "../hooks/lib/authority-store.mjs";
import { resolveAuthorityHost } from "../hooks/lib/resolve-wi.mjs";
import { writeSessionBinding } from "../hooks/lib/wi-claim.mjs";

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) { positional.push(token); continue; }
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith("--")) { flags[token] = next; index += 1; }
    else flags[token] = true;
  }
  return { positional, flags };
}

function required(flags, name) {
  const value = flags[name];
  if (!value || value === true) throw new Error(`missing ${name}`);
  return String(value);
}

function identity(flags, env = process.env) {
  const trustedSession = String(env.CURSOR_CONVERSATION_ID || env.CURSOR_SESSION_ID || env.SVC_SESSION_ID || env.GROK_SESSION_ID || env.CODEX_THREAD_ID || env.CODEX_SESSION_ID || env.CLAUDE_SESSION_ID || env.KIMI_SESSION_ID || env.GEMINI_SESSION_ID || "");
  if (flags["--session-id"] && String(flags["--session-id"]) !== trustedSession) throw new Error("--session-id does not match trusted host session identity");
  if (flags["--host"] && String(flags["--host"]).toLowerCase() !== resolveAuthorityHost({}, env)) throw new Error("--host does not match trusted host identity");
  const host = resolveAuthorityHost({ host: flags["--host"] || null }, env);
  if (!host) throw new Error("trusted host identity is missing or unsupported");
  const session_id = String(flags["--session-id"] || trustedSession);
  const agent_id = flags["--agent-id"] || env.SVC_AGENT_ID || null;
  return { host, session_id, agent_id, principal: principalId({ host, session_id, agent_id }) };
}

function context(flags) {
  const worktreeRoot = fs.realpathSync(path.resolve(String(flags["--worktree"] || process.cwd())));
  const repoId = String(flags["--repo-id"] || repositoryId(worktreeRoot));
  const stateRoot = path.resolve(String(flags["--state-root"] || authorityStateRoot(worktreeRoot)));
  const wi = required(flags, "--wi");
  return { worktreeRoot, repoId, stateRoot, wi };
}

function emit(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function syncBinding(ctx, actor) {
  try {
    if (ctx.worktreeRoot && fs.existsSync(path.join(ctx.worktreeRoot, ".svc"))) {
      writeSessionBinding({
        worktree_root: ctx.worktreeRoot,
        session_id: actor.session_id,
        role: "mutating",
        wi: ctx.wi,
        host: actor.host,
      });
    }
  } catch {}
}

export function run(argv = process.argv.slice(2), env = process.env) {
  const { positional, flags } = parseArgs(argv);
  const command = positional.join(" ");
  if (command === "rollback") return emit(rollbackV1Migration({ migrationReceiptPath: required(flags, "--receipt") }));
  const ctx = context(flags);
  if (command === "status") return emit({ lease: readController(ctx), state_root: ctx.stateRoot, repo_id: ctx.repoId });
  const actor = identity(flags, env);
  if (command === "bootstrap") {
    const res = bootstrapController({ ...ctx, principal: actor.principal });
    syncBinding(ctx, actor);
    return emit(res);
  }
  if (command === "resume" || command === "renew") {
    const res = resumeController({ ...ctx, principal: actor.principal });
    syncBinding(ctx, actor);
    return emit(res);
  }
  if (command === "handover prepare") {
    const intended = flags["--target-session-id"]
      ? principalId({ host: String(flags["--target-host"] || actor.host), session_id: String(flags["--target-session-id"]), agent_id: flags["--target-agent-id"] || null })
      : null;
    return emit(prepareHandover({ ...ctx, principal: actor.principal, intendedPrincipal: intended }));
  }
  if (command === "handover accept") {
    const res = acceptHandover({ ...ctx, principal: actor.principal, token: required(flags, "--token") });
    syncBinding(ctx, actor);
    return emit(res);
  }
  if (command === "takeover") {
    const res = takeoverController({ ...ctx, principal: actor.principal,
      expectedPrincipal: required(flags, "--expected-principal"),
      expectedGeneration: Number(required(flags, "--expected-generation")), reason: required(flags, "--reason"),
      ttlMs: Math.min(30 * 60_000, Math.max(1, Number(flags["--ttl-min"] || 15)) * 60_000) });
    syncBinding(ctx, actor);
    return emit(res);
  }
  if (command === "recover") {
    const evidencePath = required(flags, "--evidence");
    const evidence = JSON.parse(fs.readFileSync(path.resolve(evidencePath), "utf8"));
    const res = recoverController({ ...ctx, principal: actor.principal, reason: required(flags, "--reason"), evidence });
    syncBinding(ctx, actor);
    return emit(res);
  }
  if (command === "migrate") {
    return emit(migrateV1Claim({ ...ctx, claimPath: required(flags, "--claim"), host: actor.host }));
  }
  if (command === "release") return emit(releaseController({ ...ctx, principal: actor.principal }));
  throw new Error("Usage: svc-authority.mjs <status|bootstrap|resume|renew|handover prepare|handover accept|takeover|recover|migrate|rollback|release> --wi WI-N [options]");
}

function isMainModule(argvPath, moduleUrl) {
  if (!argvPath) return false;
  try {
    return fs.realpathSync(argvPath) === fs.realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return path.resolve(argvPath) === path.resolve(fileURLToPath(moduleUrl));
  }
}

if (isMainModule(process.argv[1], import.meta.url)) {
  try { run(); } catch (error) { process.stderr.write(`[svc-authority] ${error.message}\n`); process.exit(2); }
}
