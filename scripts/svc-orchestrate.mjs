#!/usr/bin/env node
/**
 * WI-FW-CROSS-REPO-ORCH-01 CLI
 *
 *   node scripts/svc-orchestrate.mjs migrate --wi WI-X --worktree PATH [--branch B] [--origin-host cursor] [--session-id ID] [--json] [--print-cd]
 *   node scripts/svc-orchestrate.mjs dispatch --role PLAN|EXEC|REVIEW --wi WI-X --worktree PATH [--dry-run] [--json]
 *   node scripts/svc-orchestrate.mjs resume --wi WI-X --worktree PATH [--json]
 */
import { migrateSession, dispatchRole, parseOrchestrateCommand } from "./lib/cross-repo-orch.mjs";

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) { flags[key.slice(2).replaceAll("-", "_")] = next; i += 1; }
    else flags[key.slice(2).replaceAll("-", "_")] = true;
  }
  return flags;
}

function emit(value, json) {
  process.stdout.write(`${json ? JSON.stringify(value, null, 2) : JSON.stringify(value)}\n`);
}

function main(argv = process.argv.slice(2)) {
  const verb = argv[0];
  if (!verb || verb === "--help" || verb === "-h") {
    process.stdout.write("usage: svc-orchestrate.mjs migrate|dispatch|resume --wi WI-X --worktree PATH [options]\n");
    process.exit(0);
  }
  const parsed = parseOrchestrateCommand(["node", "scripts/svc-orchestrate.mjs", ...argv].join(" "));
  if (!parsed) {
    process.stderr.write("svc-orchestrate: command is not a simple allowed orchestrate CLI (no pipes, unknown flags, or invalid WI)\n");
    process.exit(2);
  }
  const flags = parseFlags(argv.slice(1));
  const json = Boolean(flags.json);
  if (verb === "migrate" || verb === "resume") {
    const baton = migrateSession({
      wi: flags.wi,
      worktree: flags.worktree,
      branch: flags.branch,
      repo_root: flags.repo_root,
      origin_host: flags.origin_host,
      session_id: flags.session_id,
      origin_cwd: flags.origin_cwd || process.cwd(),
      request: flags.request,
    });
    if (flags.print_cd) process.stdout.write(`${baton.absolute_worktree}\n`);
    else emit(baton, json);
    return;
  }
  if (verb === "dispatch") {
    const result = dispatchRole({
      role: flags.role,
      wi: flags.wi,
      worktree: flags.worktree,
      branch: flags.branch,
      repo_root: flags.repo_root,
      prompt_file: flags.prompt_file,
      origin_host: flags.origin_host || "cursor",
      dry_run: Boolean(flags.dry_run),
      spawn: flags.dry_run ? false : true,
      review_kind: flags.review_kind,
    });
    emit(result, json);
    return;
  }
  process.stderr.write(`svc-orchestrate: unknown verb ${verb}\n`);
  process.exit(2);
}

try {
  main();
} catch (error) {
  process.stderr.write(`svc-orchestrate: ${error.message}\n`);
  process.exit(error.code === "orch_foreign" ? 3 : 1);
}
