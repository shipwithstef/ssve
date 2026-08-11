import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { lexSimpleCommand } from "./argv-lex.mjs";
import { findSvcDir, resolveWI } from "../../lib/resolve-wi.mjs";
import { validateTaskGraphShape } from "../../lib/validate-task-graph-shape.mjs";
import { isValidWiId, WI_ID_BODY } from "../../lib/wi-id.mjs";
import { resolveOperationScope } from "../../lib/operation-scope.mjs";
import { assertPrivateDirectory, ensurePrivateDirectory, resolveRuntimeDirectory } from "../../lib/svc-runtime-root.mjs";

export const SCHEMA_VERSION = 1;

export function parseHookInput(raw) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
  try {
    const value = JSON.parse(String(raw || "{}"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function sessionId(payload, env = process.env) {
  return String(payload?.session_id || payload?.sessionId || env.CODEX_THREAD_ID || env.CODEX_SESSION_ID || "");
}

export function turnId(payload) {
  return String(payload?.turn_id || payload?.turnId || "");
}

export function toolName(payload) {
  return String(payload?.tool_name || payload?.toolName || payload?.tool?.name || payload?.tool || "");
}

export function mutationPayload(payload) {
  const input = payload?.tool_input || payload?.toolInput || payload?.arguments || payload?.args || payload?.input || {};
  if (typeof input === "string") return input;
  return String(input.command || input.cmd || input.patch || input.input || input.content || input.new_string || "");
}

export function findRepoRoot(cwd) {
  try {
    return fs.realpathSync(execFileSync("git", ["-C", path.resolve(cwd || process.cwd()), "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim());
  } catch {
    return null;
  }
}

export function sha256(value) {
  return `sha256:${crypto.createHash("sha256").update(String(value)).digest("hex")}`;
}

function readRepositorySkill(repoRoot, candidate) {
  try {
    const root = fs.realpathSync(repoRoot);
    const absolute = path.resolve(candidate);
    const relative = path.relative(root, absolute);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
    let current = root;
    for (const part of relative.split(path.sep)) {
      current = path.join(current, part);
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) return null;
    }
    const stat = fs.lstatSync(absolute);
    if (!stat.isFile()) return null;
    const realpath = fs.realpathSync(absolute);
    const realRelative = path.relative(root, realpath);
    if (!realRelative || realRelative.startsWith("..") || path.isAbsolute(realRelative)) return null;
    const content = fs.readFileSync(realpath, "utf8");
    return { path: realpath, hash: sha256(content), content };
  } catch {
    return null;
  }
}

function gitCommonDir(root) {
  try {
    const value = execFileSync("git", ["-C", root, "rev-parse", "--git-common-dir"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return fs.realpathSync(path.isAbsolute(value) ? value : path.resolve(root, value));
  } catch {
    return null;
  }
}

function isAuthorizedFrameworkCheckout(repoRoot, installedRoots) {
  let repositoryReal;
  try { repositoryReal = fs.realpathSync(repoRoot); } catch { return false; }
  const repositoryCommon = gitCommonDir(repositoryReal);
  for (const installedRoot of installedRoots) {
    try {
      const pointer = path.join(installedRoot, ".source-repo");
      const pointerStat = fs.lstatSync(pointer);
      if (!pointerStat.isFile() || pointerStat.isSymbolicLink()) continue;
      const sourceReal = fs.realpathSync(fs.readFileSync(pointer, "utf8").trim());
      if (sourceReal === repositoryReal) return true;
      const sourceCommon = gitCommonDir(sourceReal);
      if (repositoryCommon && sourceCommon && repositoryCommon === sourceCommon) return true;
    } catch { /* invalid or absent central source pointer */ }
  }
  return false;
}

export function resolveCanonicalSkill(repoRoot, skill, env = process.env) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(String(skill || ""))) return null;
  const installedRoots = [
    env.CODEX_SKILLS_DIR && path.resolve(env.CODEX_SKILLS_DIR),
    path.join(env.CODEX_HOME || path.join(os.homedir(), ".codex"), "skills"),
  ].filter(Boolean);
  const installed = installedRoots.map((root) => path.join(root, skill, "SKILL.md"));
  const repository = path.join(repoRoot, "skills", skill, "SKILL.md");
  const readable = installed.flatMap((candidate) => {
    try {
      const realpath = fs.realpathSync(candidate);
      const content = fs.readFileSync(realpath, "utf8");
      return [{ path: realpath, hash: sha256(content), content }];
    } catch { return []; }
  });
  // A repository-local skill is executable prompt code. It must be a regular
  // file reached without traversing symlinks and remain inside the canonical
  // repository root. Installed skill farms retain their separately governed
  // symlink layout above; an untrusted consumer repository may not use that
  // layout to make the loader disclose an arbitrary readable host file.
  const repositoryEvidence = isAuthorizedFrameworkCheckout(repoRoot, installedRoots)
    ? readRepositorySkill(repoRoot, repository)
    : null;
  const canonical = repositoryEvidence || readable[0];
  if (!canonical) return null;
  const allowedPaths = new Set(readable.filter((item) => item.hash === canonical.hash).map((item) => item.path));
  allowedPaths.add(canonical.path);
  return { ...canonical, allowedPaths };
}

export function repoIdentity(repoRoot) {
  return crypto.createHash("sha256").update(fs.realpathSync(repoRoot)).digest("hex").slice(0, 24);
}

function ensureSecureDirectory(dir) {
  if (fs.existsSync(dir)) {
    assertPrivateDirectory(dir);
    return;
  }
  const parent = path.dirname(dir);
  ensurePrivateDirectory(dir, { parent });
}

export function runtimeRoot(env = process.env) {
  return resolveRuntimeDirectory({
    env,
    leaf: "svc-codex",
    legacyCodexDirect: true,
    legacyCodexHome: true,
  }).path;
}

function safeSegment(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 32);
}

export function sessionDir(repoRoot, sid, env = process.env) {
  if (!repoRoot || !sid) throw new Error("missing repository or Codex session identity");
  const repoDir = path.join(runtimeRoot(env), repoIdentity(repoRoot));
  ensureSecureDirectory(repoDir);
  const dir = path.join(repoDir, safeSegment(sid));
  ensureSecureDirectory(dir);
  return dir;
}

export function authorityPath(ctx) { return path.join(ctx.session_dir, "prompt-authority.json"); }
export function skillReceiptPath(ctx) { return path.join(ctx.session_dir, "skill-load.json"); }

export function atomicWriteJson(file, value) {
  const dir = path.dirname(file);
  ensureSecureDirectory(dir);
  const temp = path.join(dir, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  const fd = fs.openSync(temp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
  try {
    fs.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(temp, file);
  fs.chmodSync(file, 0o600);
  try {
    const dfd = fs.openSync(dir, "r");
    fs.fsyncSync(dfd);
    fs.closeSync(dfd);
  } catch {}
}

export function readJson(file) {
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) return null;
    if (typeof stat.uid === "number" && typeof process.getuid === "function" && stat.uid !== process.getuid()) return null;
    if ((stat.mode & 0o777) !== 0o600) return null;
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function explicitWI(text) {
  const m = String(text || "").match(new RegExp("(?<![A-Za-z0-9._:/-])" + WI_ID_BODY + "(?![A-Za-z0-9._:/-])"));
  const cand = m ? m[0].toUpperCase() : "";
  return isValidWiId(cand) ? cand : "";
}

export function continuationIntent(text) {
  const value = String(text || "");
  const continuationVerb = "(?:continue|continuing|resume|resuming|finish|finishing|complete|completing)";
  const negativeIntent = [
    new RegExp(`\\b(?:do\\s+not|don['’]?t|dont)\\s+(?:(?:try(?:ing)?|attempt(?:ing)?|plan(?:ning)?|need|want)\\s+to\\s+|bother\\s+)?${continuationVerb}\\b`, "i"),
    new RegExp(`\\b(?:never|avoid|without)\\s+${continuationVerb}\\b`, "i"),
    new RegExp(`\\bno\\s+need\\s+to\\s+${continuationVerb}\\b`, "i"),
    new RegExp(`\\bstop\\s+trying\\s+to\\s+${continuationVerb}\\b`, "i"),
    new RegExp(`\\brefrain\\s+from\\s+${continuationVerb}\\b`, "i"),
    new RegExp(`\\b(?:we\\s+)?should\\s+not\\s+${continuationVerb}\\b`, "i"),
    new RegExp(`\\b(?:i(?:'d|\\s+would)\\s+rather|let['’]?s)\\s+not\\s+${continuationVerb}\\b`, "i"),
    new RegExp(`\\bi\\s+don['’]?t\\s+think\\s+we\\s+should\\s+${continuationVerb}\\b`, "i"),
  ];
  if (negativeIntent.some((pattern) => pattern.test(value))) return "none";
  if (/\bend[_ -]?to[_ -]?end\b/i.test(value)) return "end_to_end";
  if (/\bresume\b/i.test(value)) return "resume";
  if (/\bcontinue\b/i.test(value)) return "continue";
  return "none";
}

const READ_ONLY_TOOLS = new Set(["Read", "Glob", "Grep", "Search", "View", "view_image"]);
const SAFE_BASH = [
  /^(ls|pwd|cat|head|tail|wc|sha256sum|stat|realpath|readlink|dirname|basename|cut|tr)(?:\s+[^;&|`$<>]*)?$/,
  /^test(?:\s+[^;&|`$<>]*)+$/,
];

function words(command) {
  return command.split(/\s+/).filter(Boolean);
}

function isSafeGit(argv) {
  const tokens = Array.isArray(argv) ? argv : words(argv);
  if (tokens[0] !== "git") return false;
  let index = 1;
  while (index < tokens.length) {
    const token = tokens[index];
    if (token === "-C" || token === "--git-dir" || token === "--work-tree") {
      if (!tokens[index + 1]) return false;
      index += 2;
      continue;
    }
    if (token.startsWith("--git-dir=") || token.startsWith("--work-tree=") || token === "--no-pager") {
      if (token.endsWith("=")) return false;
      index += 1;
      continue;
    }
    break;
  }
  const subcommand = tokens[index];
  const args = tokens.slice(index + 1);
  const alwaysRead = new Set(["status", "log", "diff", "show", "rev-parse", "ls-files", "ls-tree"]);
  const branchRead = subcommand === "branch" && (args.length === 0 || args.some((token) =>
    token === "--show-current" || token === "--list" || token === "-a" || token === "-r" ||
    token.startsWith("--list=") || token.startsWith("--contains") || token.startsWith("--merged") ||
    token.startsWith("--no-contains") || token.startsWith("--no-merged") || token.startsWith("--points-at")));
  const worktreeRead = subcommand === "worktree" && args[0] === "list";
  if (!alwaysRead.has(subcommand) && !branchRead && !worktreeRead) return false;
  return !args.some((token) =>
    token === "-o" ||
    token === "--output" ||
    token.startsWith("--output=") ||
    token === "--ext-diff" ||
    token === "--textconv"
  );
}

function isSafeSort(argv) {
  if (argv[0] !== "sort") return false;
  return !argv.slice(1).some((token) =>
    token === "-o" || token.startsWith("-o") ||
    token === "--output" || token.startsWith("--output=") ||
    token === "--compress-program" || token.startsWith("--compress-program="));
}

function isSafeUniq(argv) {
  if (argv[0] !== "uniq") return false;
  let operands = 0;
  for (let i = 1; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--") {
      operands += argv.length - i - 1;
      break;
    }
    if (token === "-f" || token === "-s" || token === "-w" ||
        token === "--skip-fields" || token === "--skip-chars" || token === "--check-chars") {
      if (!argv[++i]) return false;
      continue;
    }
    if (token.startsWith("-")) continue;
    operands++;
  }
  return operands <= 1;
}

function isSafeFile(argv) {
  if (argv[0] !== "file") return false;
  return !argv.slice(1).some((token) =>
    token.startsWith("-C") || token === "--compile" || token.startsWith("--compile="));
}

function isSafeSed(argv) {
  if (argv[0] !== "sed") return false;
  if (argv.some((token) => token === "-i" || token.startsWith("-i") || token === "--in-place" || token.startsWith("--in-place="))) return false;
  const quiet = argv[1] === "-n" || argv[1] === "--quiet" || argv[1] === "--silent";
  if (!quiet || argv.length !== 4 || argv[3].startsWith("-")) return false;
  const script = argv[2];
  // Deliberately narrow: line/range printing only. GNU sed's e/w commands can
  // execute or write, so broader scripts remain governed mutations.
  return /^(?:\d+|\$)(?:,(?:\d+|\$))?p$/.test(script);
}

function isSafeJq(argv) {
  return argv[0] === "jq" && !argv.some((token) => token === "--run-tests" || token === "-L" || token.startsWith("--library-path"));
}

function isSafeVersionProbe(argv) {
  if (argv.length !== 2 || !new Set(["--version", "-v", "-V", "--help", "-h"]).has(argv[1])) return false;
  return new Set(["node", "bash", "git", "rg", "jq", "sed", "python3", "gh"]).has(argv[0]);
}

function isSafeRg(command, env = process.env) {
  const tokens = words(command);
  if (tokens[0] !== "rg") return false;
  const args = tokens.slice(1);
  // WI-501 R3-F001: `-z/--search-zip` makes ripgrep SHELL OUT to decompressor binaries,
  // so it must be denied — but exact-token matching (`token === "-z"`) misses POSIX
  // short-option CLUSTERS: `rg -iz needle f` is accepted by ripgrep and was classified
  // read-only. Any single-dash cluster of short flags containing `z` is rejected.
  const clustersZ = (token) => /^-[A-Za-z]+$/.test(token) && token.slice(1).includes("z");
  if (args.some((token) =>
    token === "--pre" ||
    token.startsWith("--pre=") ||
    token === "--hostname-bin" ||
    token.startsWith("--hostname-bin=") ||
    token === "-z" ||
    token === "--search-zip" ||
    clustersZ(token)
  )) return false;
  // WI-501 R3-F001: RIPGREP_CONFIG_PATH prepends arbitrary arguments (including --pre)
  // from a file we do not read, so the decoded argv is no longer the effective argv.
  // Only trust the invocation when it explicitly opts out of config injection.
  if (env && env.RIPGREP_CONFIG_PATH && !args.includes("--no-config")) return false;
  return true;
}

function isSafeFind(command) {
  if (!/^find(?:\s+[^;&|`$<>]*)*$/.test(command)) return false;
  return !/(?:^|\s)-(?:delete|exec(?:dir)?|ok(?:dir)?|fprint(?:f|0)?|fls)(?=\s|$)/.test(command);
}

// WI-501: no-op segments that routinely terminate a read-only chain (`... || true`).
// They execute nothing and cannot mutate.
const TRIVIAL_SAFE_SEGMENTS = new Set(["true", "false", ":"]);

// WI-501: split a command on shell control operators (&&, ||, |, ;) that appear
// OUTSIDE single/double quotes. Quoted operators are literal argument text.
// Returns trimmed, non-empty segments.
function splitUnquoted(command) {
  const segments = [];
  let current = "";
  let quote = null; // "'" | '"' | null
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') { quote = ch; current += ch; continue; }
    if (ch === "&" && (command[i + 1] === ">" || (command[i - 1] === ">" && /^[012]$/.test(command[i + 1] || "")))) {
      current += ch;
      continue;
    }
    if (ch === ";" || ch === "|" || ch === "&") {
      // consume a paired operator (&& / ||) as one delimiter
      if ((ch === "|" || ch === "&") && command[i + 1] === ch) i++;
      segments.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  segments.push(current);
  // An unterminated quote means we could not classify reliably → refuse.
  if (quote) return [];
  return segments.map((segment) => segment.trim()).filter(Boolean);
}

// Shell diagnostics commonly end in `2>/dev/null`, `2>&1`, or both. Strip
// only exact fd duplication and fd-to-/dev/null suffixes before lexing; every
// file target remains a governed mutation.
function stripDevNullRedirections(segment) {
  let value = segment;
  const suffix = /(?:^|\s)(?:(?:[012]?>|&>)\s*\/dev\/null|[012]?>&[012])\s*$/;
  while (suffix.test(value)) value = value.replace(suffix, "").trim();
  return value;
}

export function isReadOnlyTool(ctx) {
  const name = toolName(ctx);
  if (READ_ONLY_TOOLS.has(name)) return true;
  if (name !== "Bash") return false;
  const command = mutationPayload(ctx).trim();
  if (!command) return false;
  // WI-501: classify EVERY SEGMENT of a compound command instead of rejecting the
  // whole command on sight of an operator or a quote. The previous lexical fast path
  // rejected `;&|$<>'"\` outright, so `pwd && rg -n "x" README.md` — a pure read —
  // was classified a governed mutation and denied. Agents chain and quote constantly,
  // which made read-only exploration impossible before a task graph existed (the
  // bootstrap deadlock: you must read files to create the task that permits reading).
  //
  // The split is QUOTE-AWARE: an operator inside a quoted argument (e.g. the
  // alternation in `rg -n "alpha|beta" f.md`) is an argument, not a shell operator.
  const segments = splitUnquoted(command);
  if (!segments.length) return false;
  return segments.every((segment) => {
    // WI-501 R1-F001 (CRITICAL): classify the argv the shell will ACTUALLY execute,
    // never the raw segment text. Raw-text matching is bypassable by dequoting —
    // quote-concatenation and expansion both collapse into a mutating flag that the
    // raw string never matches, so the allowlist never sees it. lexSimpleCommand()
    // is the WI-494 hardened lexer: it REJECTS every unquoted shell-active construct
    // (expansion, substitution, redirect, glob, brace, tilde, history, comment,
    // escape, control char) and otherwise returns decoded argv, so an accepted
    // segment's runtime argv is provably identical to what we classify here.
    const classifiedSegment = stripDevNullRedirections(segment);
    if (!classifiedSegment) return false;
    const lexed = lexSimpleCommand(classifiedSegment);
    if (!lexed || lexed.ok !== true || !Array.isArray(lexed.argv) || !lexed.argv.length) return false;
    // Re-joining decoded argv can only SPLIT an embedded space into more tokens, never
    // merge two — the allowlist therefore sees at least as many candidate flags as run.
    // Safe direction: over-rejection costs a receipt, under-rejection is a bypass.
    const readArgv = lexed.argv[0] === "SVC_SUBAGENT=1" ? lexed.argv.slice(1) : lexed.argv;
    if (!readArgv.length) return false;
    const decoded = readArgv.join(" ");
    if (TRIVIAL_SAFE_SEGMENTS.has(decoded)) return true;
    return isSafeGit(readArgv) || isSafeRg(decoded) || isSafeFind(decoded)
      || isSafeSort(readArgv) || isSafeUniq(readArgv) || isSafeFile(readArgv)
      || isSafeSed(readArgv) || isSafeJq(readArgv) || isSafeVersionProbe(readArgv)
      || SAFE_BASH.some((pattern) => pattern.test(decoded));
  });
}

export function laneGraphs(repoRoot, env = process.env) {
  // WI-486 (EXEC-001): the ONLY non-resolver graph source is the hermetic test
  // override (SVC_CODEX_TEST_MODE=1). The former production shortcut — honoring
  // any SVC_CODEX_TASK_GRAPH merely because it sits under repoRoot — is removed:
  // it supplied a governed graph WITHOUT the ownership tuple, letting a bound
  // session point governance at an arbitrary in-repo file. In production the
  // override is only a consistency assertion, enforced inside resolve-wi's
  // graphDecision; it never selects the graph here.
  if (env.SVC_CODEX_TEST_MODE === "1" && env.SVC_CODEX_TASK_GRAPH) {
    const explicit = path.resolve(env.SVC_CODEX_TASK_GRAPH);
    return fs.existsSync(explicit) ? [explicit] : [];
  }
  // WI-486 (SIB-08): repository-wide graph inventory is NOT an authority source.
  // Derive the single active graph exclusively from the validated ownership tuple
  // via the shared resolver — a non-owned result yields no governed graph.
  const resolved = resolveWI({ cwd: repoRoot }, env);
  const graphPath = resolved && resolved.authority && resolved.tuple ? resolved.tuple.graph_path : "";
  return graphPath && fs.existsSync(graphPath) ? [graphPath] : [];
}

export function activeTask(repoRoot, env = process.env) {
  const found = [];
  for (const graphPath of laneGraphs(repoRoot, env)) {
    try {
      const graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));
      // WI-486 (EXEC-R2-003): NEVER return authority from a malformed graph. Run
      // the ONE canonical shape + integrity validator before selecting any
      // in_progress task — a graph that lost required fields or carries an unknown
      // status/duplicate id/dangling blocker yields NO active task (fail closed),
      // so post-load corruption cannot keep a stale skill-load receipt authoritative.
      if (!validateTaskGraphShape(graph).ok) continue;
      for (const task of graph.tasks || []) {
        if (task.status === "in_progress") found.push({ graph_path: fs.realpathSync(graphPath), graph, task });
      }
    } catch {}
  }
  let scoped = found;
  try {
    const branch = execFileSync("git", ["-C", repoRoot, "branch", "--show-current"], { encoding: "utf8" }).trim();
    const branchWI = explicitWI(branch);
    if (branchWI) {
      const matching = found.filter((entry) => String(entry.graph.wi || "").toUpperCase() === branchWI);
      if (matching.length) scoped = matching;
    }
  } catch {}
  if (scoped.length !== 1) return { ok: false, diagnostic: scoped.length ? "ambiguous active tasks" : "no active task", matches: scoped };
  return { ok: true, ...scoped[0] };
}

export function bindingFor(repoRoot, sid, turn = "", env = process.env) {
  const configured = env.SVC_CODEX_SESSION_CONTRACT ? path.resolve(env.SVC_CODEX_SESSION_CONTRACT) : "";
  const testOverride = env.SVC_CODEX_TEST_MODE === "1";
  const file = configured && (configured.startsWith(`${repoRoot}${path.sep}`) || testOverride)
    ? configured
    : path.join(repoRoot, ".svc", "session-contract.jsonl");
  try {
    const rows = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    const matches = rows.filter((row) => {
      const rowSession = String(row.session_token || row.session_id || "");
      const rowTurn = String(row.turn_id || row.turn || "");
      return rowSession === sid && (!turn || rowTurn === turn) && row.wi;
    });
    return matches.at(-1) || null;
  } catch {
    return null;
  }
}

// Lifecycle hooks do not carry a mutation target, so they cannot use an
// operation-cwd inference as authority.  They may, however, locate one exact
// authoritative child binding for advisory/state lookup.  This is deliberately
// not used by operationHookContext or any mutation decision.
export function governanceBinding(payload, env = process.env) {
  const sessionCwd = path.resolve(payload?.cwd || payload?.working_directory || process.cwd());
  const sessionRoot = findRepoRoot(sessionCwd);
  const sid = sessionId(payload, env);
  if (!sessionRoot || !sid) return null;
  const svcDir = findSvcDir(sessionRoot);
  if (!svcDir) return null;
  const bindingsDir = path.join(svcDir, "bindings");
  const matches = [];
  try {
    for (const name of fs.readdirSync(bindingsDir)) {
      if (!name.endsWith(".json")) continue;
      const file = path.join(bindingsDir, name);
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink()) continue;
      const binding = JSON.parse(fs.readFileSync(file, "utf8"));
      if (String(binding.session_id || "") !== sid || binding.released_at) continue;
      if (String(binding.role || "") !== "mutating" || !path.isAbsolute(String(binding.worktree_root || ""))) continue;
      let worktree;
      try { worktree = fs.realpathSync(binding.worktree_root); } catch { continue; }
      const resolved = resolveWI({ ...payload, cwd: worktree, session_id: sid, host: "codex" }, {
        ...env, PWD: worktree, SVC_REQUIRE_SESSION_BINDING: "1",
      });
      if (!resolved.authority || resolved.classification !== "owned" || resolved.tuple?.worktree_root !== worktree) continue;
      matches.push({ binding, tuple: resolved.tuple, worktree });
    }
  } catch {
    return null;
  }
  return matches.length === 1 ? matches[0] : null;
}

export function hookContext(payload, env = process.env) {
  const cwd = path.resolve(payload?.cwd || payload?.working_directory || process.cwd());
  const repoRoot = findRepoRoot(cwd);
  const sid = sessionId(payload, env);
  const turn = turnId(payload);
  const governance = governanceBinding(payload, env);
  if (!repoRoot || !sid) return {
    cwd, session_cwd: cwd, repo_root: repoRoot, governance_worktree: governance?.worktree || null,
    governance_tuple: governance?.tuple || null, session_id: sid, turn_id: turn, session_dir: null,
  };
  return {
    cwd, session_cwd: cwd, repo_root: repoRoot, governance_worktree: governance?.worktree || null,
    governance_tuple: governance?.tuple || null, session_id: sid, turn_id: turn,
    session_dir: sessionDir(repoRoot, sid, env),
  };
}

export function operationHookContext(payload, env = process.env) {
  const session = hookContext(payload, env);
  const operation_scope = resolveOperationScope(payload, { host: "codex", env });
  const repoRoot = operation_scope.operation_repository?.worktree_root || null;
  const sid = session.session_id;
  return {
    ...session,
    cwd: operation_scope.operation_cwd || session.cwd,
    operation_cwd: operation_scope.operation_cwd || session.cwd,
    repo_root: repoRoot,
    session_repo_root: session.repo_root,
    operation_scope,
    session_dir: repoRoot && sid ? sessionDir(repoRoot, sid, env) : null,
  };
}
