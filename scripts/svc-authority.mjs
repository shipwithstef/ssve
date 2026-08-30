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
  const trustedSession = String(env.SVC_SESSION_ID || env.GROK_SESSION_ID || env.CODEX_THREAD_ID || env.CODEX_SESSION_ID || env.CLAUDE_SESSION_ID || env.KIMI_SESSION_ID || env.GEMINI_SESSION_ID || "");
  if (flags["--session-id"] && String(flags["--session-id"]) !== trustedSession) throw new Error("--session-id does not match trusted host session identity");
  if (flags["--host"] && String(flags["--host"]).toLowerCase() !== resolveAuthorityHost({}, env)) throw new Error("--host does not match trusted host identity");
  const host = resolveAuthorityHost({ host: flags["--host"] || null }, env);
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

export function run(argv = process.argv.slice(2), env = process.env) {
  const { positional, flags } = parseArgs(argv);
  const command = positional.join(" ");
  if (command === "rollback") return emit(rollbackV1Migration({ migrationReceiptPath: required(flags, "--receipt") }));
  const ctx = context(flags);
  if (command === "status") return emit({ lease: readController(ctx), state_root: ctx.stateRoot, repo_id: ctx.repoId });
  const actor = identity(flags, env);
  if (command === "bootstrap") return emit(bootstrapController({ ...ctx, principal: actor.principal }));
  if (command === "resume" || command === "renew") return emit(resumeController({ ...ctx, principal: actor.principal }));
  if (command === "handover prepare") {
    const intended = flags["--target-session-id"]
      ? principalId({ host: String(flags["--target-host"] || actor.host), session_id: String(flags["--target-session-id"]), agent_id: flags["--target-agent-id"] || null })
      : null;
    return emit(prepareHandover({ ...ctx, principal: actor.principal, intendedPrincipal: intended }));
  }
  if (command === "handover accept") return emit(acceptHandover({ ...ctx, principal: actor.principal, token: required(flags, "--token") }));
  if (command === "takeover") return emit(takeoverController({ ...ctx, principal: actor.principal,
    expectedPrincipal: required(flags, "--expected-principal"),
    expectedGeneration: Number(required(flags, "--expected-generation")), reason: required(flags, "--reason"),
    ttlMs: Math.min(30 * 60_000, Math.max(1, Number(flags["--ttl-min"] || 15)) * 60_000) }));
  if (command === "recover") {
    const evidencePath = required(flags, "--evidence");
    const evidence = JSON.parse(fs.readFileSync(path.resolve(evidencePath), "utf8"));
    return emit(recoverController({ ...ctx, principal: actor.principal, reason: required(flags, "--reason"), evidence }));
  }
  if (command === "migrate") {
    return emit(migrateV1Claim({ ...ctx, claimPath: required(flags, "--claim"), host: actor.host }));
  }
  if (command === "release") return emit(releaseController({ ...ctx, principal: actor.principal }));
  throw new Error("Usage: svc-authority.mjs <status|bootstrap|resume|renew|handover prepare|handover accept|takeover|recover|migrate|rollback|release> --wi WI-N [options]");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { run(); } catch (error) { process.stderr.write(`[svc-authority] ${error.message}\n`); process.exit(2); }
}
