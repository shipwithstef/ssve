import path from "node:path";
import { lexSimpleCommand } from "../codex/lib/argv-lex.mjs";
import { WI_ID_RE } from "./wi-id.mjs";

const ORCH_SCRIPT = "scripts/svc-orchestrate.mjs";
const ROLES = new Set(["PLAN", "EXEC", "REVIEW"]);
const ORIGIN_HOSTS = new Set(["cursor", "grok", "codex", "claude", "kimi", "gemini", "opencode"]);

function isOrchestrateScript(token) {
  const normalized = path.posix.normalize(String(token || "").replaceAll("\\", "/"));
  return normalized === ORCH_SCRIPT || normalized.endsWith(`/${ORCH_SCRIPT}`);
}

function safeWorktreeFlag(value) {
  if (!value || typeof value !== "string") return null;
  if (value.includes("\0") || /[\r\n]/.test(value)) return null;
  const resolved = path.resolve(value);
  if (resolved.includes("\0")) return null;
  return resolved;
}

export function parseOrchestrateCommand(command) {
  const lexed = lexSimpleCommand(String(command || ""));
  if (!lexed?.ok) return null;
  const tokens = [...lexed.argv];
  if (tokens.length < 3 || tokens[0] !== "node") return null;
  if (!isOrchestrateScript(tokens[1])) return null;
  const verb = tokens[2];
  if (verb !== "migrate" && verb !== "dispatch" && verb !== "resume") return null;
  const out = { script: tokens[1], verb, wi: "", branch: "", worktree: "", role: "", json: false, dry_run: false, print_cd: false };
  for (let i = 3; i < tokens.length; i += 1) {
    const flag = tokens[i];
    const needsValue = new Set([
      "--wi", "--branch", "--worktree", "--from", "--origin-host",
      "--repo-root", "--role", "--prompt-file", "--origin-cwd", "--review-kind",
    ]);
    if (needsValue.has(flag)) {
      const value = tokens[++i];
      if (!value) return null;
      if (flag === "--wi") out.wi = value;
      else if (flag === "--branch") out.branch = value;
      else if (flag === "--worktree") out.worktree = value;
      else if (flag === "--from") out.from = value;
      else if (flag === "--origin-host") out.origin_host = value;
      else if (flag === "--session-id") out.session_id = value;
      else if (flag === "--repo-root") out.repo_root = value;
      else if (flag === "--role") out.role = value;
      else if (flag === "--prompt-file") out.prompt_file = value;
      else if (flag === "--origin-cwd") out.origin_cwd = value;
      else if (flag === "--review-kind") out.review_kind = value;
      continue;
    }
    if (flag === "--json") { out.json = true; continue; }
    if (flag === "--dry-run") { out.dry_run = true; continue; }
    if (flag === "--print-cd") { out.print_cd = true; continue; }
    if (flag === "--ensure") { out.ensure = true; continue; }
    if (flag === "--spawn") { out.spawn = true; continue; }
    return null;
  }
  if (!WI_ID_RE.test(out.wi)) return null;
  if (verb === "dispatch" && !ROLES.has(out.role)) return null;
  if (out.review_kind && out.review_kind !== "plan" && out.review_kind !== "exec") return null;
  if (out.origin_host && !ORIGIN_HOSTS.has(out.origin_host)) return null;
  if (out.worktree && !safeWorktreeFlag(out.worktree)) return null;
  return out;
}
