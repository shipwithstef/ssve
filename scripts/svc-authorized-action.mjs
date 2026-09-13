#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { appendJsonlLine } from "./state-io.mjs";
import { lexSimpleCommand } from "../hooks/codex/lib/argv-lex.mjs";

function lastContract(root) {
  if (!root || typeof root !== "string") return { state: "absent", contract: null };
  const file = path.join(path.resolve(root), ".svc", "session-contract.jsonl");
  if (!fs.existsSync(file)) return { state: "absent", contract: null };
  try {
    const lines = fs.readFileSync(file, "utf8").trim().split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return { state: "invalid", contract: null };
    const contract = JSON.parse(lines.at(-1));
    if (!contract || typeof contract !== "object" || Array.isArray(contract)) return { state: "invalid", contract: null };
    return { state: "valid", contract };
  } catch { return { state: "invalid", contract: null }; }
}
function rulesOf(contract) {
  if (!contract || !Object.prototype.hasOwnProperty.call(contract, "authorization_envelope")) return { state: "absent", rules: [] };
  const envelope = contract?.authorization_envelope;
  if (typeof envelope === "string") return { state: "legacy", rules: [] };
  const rules = Array.isArray(envelope) ? envelope : envelope && typeof envelope === "object" && !Array.isArray(envelope) ? envelope.rules : null;
  if (!Array.isArray(rules)) return { state: "invalid", rules: [] };
  const tuples = new Map();
  for (const rule of rules) {
    if (!rule || typeof rule !== "object" || Array.isArray(rule) || !["action", "environment", "purpose", "decision"].every((key) => typeof rule[key] === "string" && rule[key].trim()) || !["allow", "deny"].includes(rule.decision)) return { state: "invalid", rules: [] };
    const tuple = `${rule.action}\0${rule.environment}\0${rule.purpose}`;
    if (tuples.has(tuple) && tuples.get(tuple) !== rule.decision) return { state: "invalid", rules: [] };
    tuples.set(tuple, rule.decision);
  }
  return { state: "typed", rules };
}

export function authorizationEnvelopeState(root) {
  const loaded = lastContract(root);
  const parsed = rulesOf(loaded.contract);
  return { state: loaded.state === "valid" && parsed.state === "invalid" ? "invalid" : loaded.state, present: parsed.state === "typed", rules: parsed.rules };
}

function commandArgv(segment) {
  const lexed = lexSimpleCommand(segment.trim());
  if (!lexed.ok) return [];
  const argv = [...lexed.argv];
  while (["env", "command", "sudo"].includes(path.basename(argv[0] || ""))) {
    const wrapper = path.basename(argv.shift() || "");
    if (wrapper === "env") {
      while (argv.length) {
        if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(argv[0]) || ["-i", "--ignore-environment", "--null"].includes(argv[0])) { argv.shift(); continue; }
        if (["-u", "--unset", "-C", "--chdir", "-S", "--split-string"].includes(argv[0])) { argv.splice(0, 2); continue; }
        if (/^--(?:unset|chdir|split-string)=/.test(argv[0])) { argv.shift(); continue; }
        break;
      }
    } else if (wrapper === "sudo") {
      while (argv.length) {
        if (["-u", "--user", "-g", "--group", "-h", "--host", "-p", "--prompt", "-C", "--close-from", "-T", "--command-timeout"].includes(argv[0])) { argv.splice(0, 2); continue; }
        if (/^--(?:user|group|host|prompt|close-from|command-timeout)=/.test(argv[0]) || argv[0]?.startsWith("-")) { argv.shift(); continue; }
        break;
      }
    } else {
      while (argv[0]?.startsWith("-")) argv.shift();
    }
  }
  return argv;
}

function gitSubcommand(argv) {
  let index = 1;
  while (index < argv.length) {
    const arg = argv[index];
    if (["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--config-env"].includes(arg)) { index += 2; continue; }
    if (/^--(?:git-dir|work-tree|namespace|config-env)=/.test(arg)) { index += 1; continue; }
    if (arg.startsWith("-")) { index += 1; continue; }
    return arg;
  }
  return "";
}

const OUTWARD_ACTION = Object.freeze({
  "git-push": "push",
  "github-mutation": "github",
  "package-publish": "publish",
  "provider-deploy": "deploy",
  "image-push": "push-image",
  "remote-copy": "remote-copy",
  "http-mutation": "http-mutation",
});

function rawOutwardKind(segment) {
  const wrappers = String.raw`(?:(?:env)(?:\s+(?:[A-Za-z_][A-Za-z0-9_]*=\S+|-(?:i|u|C|S)\s+\S+|--(?:ignore-environment|null)|--(?:unset|chdir|split-string)=\S+))*\s+|(?:command)(?:\s+-\S+)*\s+|(?:sudo)(?:\s+(?:-[ughpCT]\s+\S+|--(?:user|group|host|prompt|close-from|command-timeout)(?:=\S+|\s+\S+)|-\S+))*\s+)*`;
  const begins = (body) => new RegExp(String.raw`^\s*${wrappers}${body}(?:\s|$)`, "i").test(segment);
  if (begins(String.raw`git(?:\s+(?:-C|-c|--git-dir|--work-tree|--namespace|--config-env)(?:=\S+|\s+\S+)|\s+-\S+)*\s+push`)) return "git-push";
  if (begins(String.raw`gh\s+(?:pr\s+(?:create|merge|close|reopen)|release\s+create)`)) return "github-mutation";
  if (begins(String.raw`(?:npm|pnpm|yarn)\s+publish`)) return "package-publish";
  if (begins(String.raw`(?:vercel|netlify|firebase|base44|supabase)\s+(?:deploy|functions\s+deploy|db\s+push)`)) return "provider-deploy";
  if (begins(String.raw`docker\s+push`)) return "image-push";
  if (begins(String.raw`(?:scp|rsync)\b`) && /(?:[A-Za-z0-9_.-]+@[^\s:]+:|\s[^\s:]+:[^/\s])/.test(segment)) return "remote-copy";
  if (begins(String.raw`curl\b`) && /(?:^|\s)(?:-d(?:\S+)?|-F(?:\S+)?|-T(?:\S+)?|--(?:data(?:-[a-z]+)?|form(?:-string)?|upload-file|json)(?:=|\s)|-X(?:POST|PUT|PATCH|DELETE)\b|--request(?:=|\s+)(?:POST|PUT|PATCH|DELETE)\b)/i.test(segment)) return "http-mutation";
  return null;
}

export function classifyOutwardAction(command) {
  const source = String(command || "").trim();
  if (!source) return null;
  for (const segment of source.split(/(?:&&|\|\||(?<!\|)\|(?!\|)|;|\n)/)) {
    const argv = commandArgv(segment); const executable = path.basename(argv[0] || "");
    if (["sh", "bash", "zsh"].includes(executable)) {
      const commandAt = argv.indexOf("-c");
      if (commandAt >= 0 && argv[commandAt + 1]) {
        const nested = classifyOutwardAction(argv[commandAt + 1]);
        if (nested) return nested;
      }
    }
    if (executable === "curl" && argv.slice(1).some((arg, index, rest) =>
      /^(?:-d|-F|-T).+/.test(arg) || /^(?:--data(?:-[a-z]+)?|--form(?:-string)?|--upload-file|--json)=/.test(arg) ||
      ["-d", "-F", "-T", "--data", "--data-raw", "--data-binary", "--data-urlencode", "--form", "--form-string", "--upload-file", "--json"].includes(arg) ||
      /^(?:-X)(?:POST|PUT|PATCH|DELETE)$/i.test(arg) || /^(?:--request)=(?:POST|PUT|PATCH|DELETE)$/i.test(arg) ||
      (["-X", "--request"].includes(arg) && /^(?:POST|PUT|PATCH|DELETE)$/i.test(rest[index + 1] || "")))) return { outward: true, kind: "http-mutation" };
    if (executable === "git" && gitSubcommand(argv) === "push") return { outward: true, kind: "git-push" };
    if (executable === "gh" && ((argv[1] === "pr" && ["create", "merge", "close", "reopen"].includes(argv[2])) || (argv[1] === "release" && argv[2] === "create"))) return { outward: true, kind: "github-mutation" };
    if (["npm", "pnpm", "yarn"].includes(executable) && argv[1] === "publish") return { outward: true, kind: "package-publish" };
    if (["vercel", "netlify", "firebase", "base44", "supabase"].includes(executable) && (argv[1] === "deploy" || (argv[1] === "functions" && argv[2] === "deploy") || (argv[1] === "db" && argv[2] === "push"))) return { outward: true, kind: "provider-deploy" };
    if (executable === "docker" && argv[1] === "push") return { outward: true, kind: "image-push" };
    if (["scp", "rsync"].includes(executable) && argv.slice(1).some((arg) => /[A-Za-z0-9_.-]+@|:[^/]/.test(arg))) return { outward: true, kind: "remote-copy" };
    // The strict lexer deliberately rejects active shell syntax. Once that
    // happens, classify every covered outward family conservatively from raw
    // text so malformed/complex argv can never turn a remote mutation local.
    if (argv.length === 0) { const kind = rawOutwardKind(segment); if (kind) return { outward: true, kind }; }
  }
  return null;
}

export function authorizeObservedAction({ root, command, annotation }) {
  if (!root || typeof root !== "string") {
    const outward = classifyOutwardAction(command);
    if (outward) return { allow: false, decision: "deny", reason: `outward action ${outward.kind} requires a repository root and authorization metadata`, outward };
    if (!annotation) return { allow: true, decision: "local-allow", reason: "operation is not an observable outward mutation", outward: null };
    return { allow: false, decision: "deny", reason: "explicit authorization requires a valid repository root" };
  }
  const envelope = authorizationEnvelopeState(root);
  const outward = classifyOutwardAction(command);
  if (envelope.state === "invalid") return { allow: false, decision: "deny", reason: "session authorization contract is malformed", outward };
  if (!envelope.present) return { allow: true, decision: "legacy-allow", reason: "no typed authorization envelope", outward };
  if (outward && !annotation) {
    return { allow: false, decision: "deny", reason: `outward action ${outward.kind} requires svc_authorization action/environment/purpose metadata` };
  }
  if (!annotation) return { allow: true, decision: "local-allow", reason: "operation is not an observable outward mutation", outward: null };
  if (outward && OUTWARD_ACTION[outward.kind] !== annotation.action) {
    return { allow: false, decision: "deny", reason: `observed ${outward.kind} requires authorization action ${OUTWARD_ACTION[outward.kind]}`, outward };
  }
  return { ...authorizeAction({ root, action: annotation.action, environment: annotation.environment, purpose: annotation.purpose }), outward };
}

export function evaluateAuthorization(contract, request) {
  const parsed = rulesOf(contract); const rules = parsed.rules;
  if (parsed.state === "invalid") return { allow: false, decision: "deny", reason: "typed authorization envelope is malformed or conflicting" };
  if (parsed.state !== "typed") return { allow: true, decision: "legacy-allow", reason: "no typed authorization envelope" };
  const action = String(request?.action || ""); const environment = String(request?.environment || ""); const purpose = String(request?.purpose || "");
  if (!action || !environment || !purpose) return { allow: false, decision: "deny", reason: "explicit envelope requires action, environment, and purpose" };
  const match = rules.find((rule) => rule?.action === action && rule?.environment === environment && rule?.purpose === purpose);
  if (!match) return { allow: false, decision: "deny", reason: `outside authorization envelope: ${action}/${environment}/${purpose}` };
  if (match.decision !== "allow") return { allow: false, decision: "deny", reason: `authorization rule decision is ${match.decision || "unset"}` };
  return { allow: true, decision: "allow", rule_id: match.id || null, reason: "exact authorization rule matched" };
}

export function authorizeAction({ root, action, environment, purpose }) {
  const loaded = lastContract(root);
  if (loaded.state === "invalid") return { allow: false, decision: "deny", reason: "session authorization contract is malformed" };
  return evaluateAuthorization(loaded.contract, { action, environment, purpose });
}

export function recordStopAuthorizationSummary(root) {
  if (!root || typeof root !== "string") throw new Error("repository root must be a non-empty string");
  const loaded = lastContract(root); if (loaded.state === "invalid") throw new Error("session authorization contract is malformed");
  const parsed = rulesOf(loaded.contract); if (parsed.state === "invalid") throw new Error("typed authorization envelope is malformed or conflicting");
  const rules = parsed.rules; const eventsPath = path.join(root, ".svc", "authorization-events.jsonl");
  let used = [];
  try { used = fs.readFileSync(eventsPath, "utf8").trim().split(/\r?\n/).filter(Boolean).map(JSON.parse).filter((e) => e.event === "authorized-action").map((e) => e.rule_id).filter(Boolean); } catch {}
  const unused = rules.map((r) => r.id).filter(Boolean).filter((id) => !used.includes(id));
  const summary = { recorded: true, declared: rules.length, used: new Set(used).size, unused };
  appendJsonlLine(eventsPath, { ts: new Date().toISOString(), event: "stop-authorization-summary", declared: summary.declared, used: summary.used, unused });
  return summary;
}

const value = (argv, flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : ""; };
export function run(argv = process.argv.slice(2)) {
  try {
    const command = argv[0]; const root = path.resolve(value(argv, "--root") || process.cwd());
    if (command === "record-stop") {
      process.stdout.write(JSON.stringify(recordStopAuthorizationSummary(root)) + "\n"); return 0;
    }
    const request = { action: value(argv, "--action"), environment: value(argv, "--environment"), purpose: value(argv, "--purpose") };
    const decision = authorizeAction({ root, ...request });
    if (!decision.allow) { process.stderr.write(`[authorized-action] DENIED: ${decision.reason}\n`); return 3; }
    if (decision.decision === "allow") appendJsonlLine(path.join(root, ".svc", "authorization-events.jsonl"), { ts: new Date().toISOString(), event: "authorized-action", ...request, rule_id: decision.rule_id });
    if (command === "check") { process.stdout.write(JSON.stringify(decision) + "\n"); return 0; }
    if (command === "exec") {
      const separator = argv.indexOf("--"); if (separator < 0 || !argv[separator + 1]) throw new Error("exec requires -- <command> [args]");
      const result = spawnSync(argv[separator + 1], argv.slice(separator + 2), { cwd: root, stdio: "inherit", env: process.env });
      if (result.error) throw result.error; return result.status ?? 1;
    }
    throw new Error("usage: svc-authorized-action.mjs <check|exec|record-stop> --root <repo> [--action A --environment E --purpose P] [-- command args]");
  } catch (error) { process.stderr.write(`[authorized-action] ${error.message}\n`); return 2; }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = run();
