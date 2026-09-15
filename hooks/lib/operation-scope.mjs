import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isShellTool } from "./shell-tools.mjs";

export const OPERATION_SCOPE_SCHEMA_VERSION = 1;

const PATCH_TOOLS = new Set(["apply_patch", "ApplyPatch"]);
const TRUSTED_WORKDIR_FIELDS = {
  // Codex exposes the effective tool directory through several aliases across
  // CLI/API payload versions.  Other hosts retain their historical contract so
  // Claude's golden fixtures remain byte-identical.
  codex: new Set(["workdir", "cwd", "working_directory"]),
  claude: new Set(["workdir"]),
  kimi: new Set(["workdir"]),
  gemini: new Set(["workdir"]),
  opencode: new Set(["workdir"]),
  antigravity: new Set(["workdir"]),
  cursor: new Set(["workdir", "cwd", "workingDirectory", "working_directory"]),
  "mimo-code": new Set(["workdir"]),
  grok: new Set(["workdir"]),
};

function digest(value) {
  return `sha256:${crypto.createHash("sha256").update(String(value)).digest("hex")}`;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function inside(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function canonicalExistingDirectory(value) {
  const absolute = path.resolve(value);
  const stat = fs.statSync(absolute);
  if (!stat.isDirectory()) throw new Error("path is not a directory");
  return fs.realpathSync(absolute);
}

export function canonicalTarget(value, base, { mustExist = false } = {}) {
  const requested = String(value || "").trim();
  if (!requested || requested.includes("\0")) throw new Error("invalid empty target");
  if (requested.replaceAll("\\", "/").split("/").includes("..")) throw new Error("mutation target contains a parent traversal segment");
  const absolute = path.isAbsolute(requested) ? path.normalize(requested) : path.resolve(base, requested);
  let cursor = absolute;
  const remainder = [];
  while (true) {
    try {
      fs.lstatSync(cursor);
      break;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) throw new Error("target has no existing parent");
    remainder.unshift(path.basename(cursor));
    cursor = parent;
  }
  if (mustExist && remainder.length) throw new Error("required target is missing");
  const resolvedCursor = fs.realpathSync(cursor);
  const anchorStat = fs.statSync(resolvedCursor);
  const anchorBase = anchorStat.isDirectory() ? resolvedCursor : path.dirname(resolvedCursor);
  const canonicalAnchor = fs.realpathSync(anchorBase);
  const canonical = remainder.length
    ? path.resolve(canonicalAnchor, ...(anchorStat.isDirectory() ? remainder : [path.basename(resolvedCursor), ...remainder]))
    : resolvedCursor;
  return { requested, absolute, canonical_anchor: canonicalAnchor, canonical };
}

export function gitIdentity(candidate, cache = null) {
  let cursor = path.resolve(candidate);
  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) return null;
    cursor = parent;
  }
  const cacheKey = cursor;
  if (cache?.has(cacheKey)) return cache.get(cacheKey);
  try {
    if (!fs.statSync(cursor).isDirectory()) cursor = path.dirname(cursor);
    const worktreeRoot = fs.realpathSync(execFileSync("git", ["-C", cursor, "rev-parse", "--show-toplevel"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim());
    const commonText = execFileSync("git", ["-C", worktreeRoot, "rev-parse", "--git-common-dir"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const commonGitDir = fs.realpathSync(path.isAbsolute(commonText) ? commonText : path.resolve(worktreeRoot, commonText));
    const roots = execFileSync("git", ["-C", worktreeRoot, "worktree", "list", "--porcelain"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).split(/\r?\n/).filter((line) => line.startsWith("worktree ")).map((line) => {
      try { return fs.realpathSync(line.slice("worktree ".length)); } catch { return ""; }
    }).filter(Boolean);
    const identity = {
      repo_id: digest(commonGitDir),
      common_git_dir: commonGitDir,
      worktree_root: worktreeRoot,
      default_worktree_root: roots[0] || worktreeRoot,
      worktree_roots: unique(roots),
    };
    cache?.set(cacheKey, identity);
    cache?.set(worktreeRoot, identity);
    return identity;
  } catch {
    cache?.set(cacheKey, null);
    return null;
  }
}

export function parsePatchTargets(text) {
  const targets = [];
  let lastUpdate = null;
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    let match = line.match(/^\*\*\* (Update|Add|Delete) File: (.+)$/);
    if (match) {
      const role = match[1].toLowerCase();
      targets.push({ role, requested: match[2].trim(), must_exist: role !== "add" });
      lastUpdate = role === "update" ? match[2].trim() : null;
      continue;
    }
    match = line.match(/^\*\*\* (?:Move|Rename) File: (.+?)(?: -> | to )(.+)$/i);
    if (match) {
      targets.push({ role: "move_source", requested: match[1].trim(), must_exist: true });
      targets.push({ role: "move_destination", requested: match[2].trim(), must_exist: false });
      lastUpdate = null;
      continue;
    }
    match = line.match(/^\*\*\* Move to: (.+)$/i);
    if (match && lastUpdate) {
      targets.push({ role: "move_source", requested: lastUpdate, must_exist: true });
      targets.push({ role: "move_destination", requested: match[1].trim(), must_exist: false });
    }
  }
  return targets;
}

function directTargets(input) {
  const found = [];
  for (const key of ["file_path", "filePath", "path", "file"]) {
    if (typeof input[key] === "string" && input[key].trim()) found.push({ role: "path", requested: input[key].trim(), must_exist: false });
  }
  for (const key of ["paths", "file_paths", "filePaths", "files"]) {
    if (!Array.isArray(input[key])) continue;
    for (const value of input[key]) {
      if (typeof value === "string" && value.trim()) found.push({ role: "path", requested: value.trim(), must_exist: false });
      else if (value && typeof value === "object") {
        const candidate = value.file_path || value.filePath || value.path || value.file;
        if (typeof candidate === "string" && candidate.trim()) found.push({ role: "path", requested: candidate.trim(), must_exist: false });
      }
    }
  }
  return found;
}

function toolInput(payload) {
  const input = payload?.tool_input ?? payload?.toolInput ?? payload?.arguments ?? payload?.args ?? payload?.input ?? {};
  return input && typeof input === "object" && !Array.isArray(input) ? input : {};
}

function canonicalToolName(payload) {
  return String(payload?.tool_name || payload?.toolName || payload?.tool?.name || payload?.tool || "");
}

function shellCommand(input) {
  return String(input.command || input.cmd || input.shell || "");
}

function isFrameworkSourceRoot(root) {
  return [
    "skills-manifest.json",
    "FRAMEWORK-STATE.md",
    "hooks/hooks.json",
    "setup",
  ].every((entry) => {
    try { return fs.statSync(path.join(root, entry)).isFile(); } catch { return false; }
  });
}

function runningFrameworkRoot() {
  try {
    return fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."));
  } catch {
    return "";
  }
}

function isMainWorktree(identity) {
  if (!identity || identity.worktree_root !== identity.default_worktree_root) return false;
  try {
    return execFileSync("git", ["-C", identity.worktree_root, "branch", "--show-current"], { encoding: "utf8" }).trim() === "main";
  } catch { return false; }
}

function unquote(value) {
  const text = String(value || "").trim();
  if ((text.startsWith("\"") && text.endsWith("\"")) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1);
  }
  return text;
}

function commandDirectoryEvidence(command, sessionCwd) {
  const evidence = [];
  const text = String(command || "").trim();
  if (!text) return evidence;

  // A leading directory change is execution evidence.  Relative values are
  // resolved against the session cwd; absolute values are canonicalized below.
  const leadingCd = text.match(/^(?:cd|pushd)\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/);
  if (leadingCd) evidence.push({ source: "leading-cd", requested: leadingCd[1] || leadingCd[2] || leadingCd[3] });

  // git -C is an explicit per-command repository selector.  Capture every
  // occurrence so two selectors cannot silently disagree.
  for (const match of text.matchAll(/\bgit\s+-C\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/g)) {
    evidence.push({ source: "git-C", requested: match[1] || match[2] || match[3] });
  }

  return evidence.map((item) => {
    try {
      const requested = unquote(item.requested);
      const candidate = path.isAbsolute(requested) ? requested : path.resolve(sessionCwd, requested);
      return { ...item, requested, canonical: canonicalExistingDirectory(candidate) };
    } catch (error) {
      return { ...item, requested: unquote(item.requested), canonical: null, error: error.message };
    }
  });
}

function targetDirectoryEvidence(descriptor, sessionCwd, identityCache = null) {
  const requested = String(descriptor?.requested || "").trim();
  if (!path.isAbsolute(requested)) return null;
  try {
    const canonical = canonicalTarget(requested, sessionCwd, { mustExist: descriptor.must_exist });
    let directory = canonical.canonical;
    try {
      if (!fs.statSync(directory).isDirectory()) directory = path.dirname(directory);
    } catch {
      // A write target may introduce multiple path components. Its nearest
      // existing, no-follow canonical anchor is enough to identify the
      // operation worktree; realpathSync on the missing parent would turn a
      // governed denial into the opaque invalid-target result.
      directory = canonical.canonical_anchor;
    }
    const realDir = fs.realpathSync(directory);
    const gitId = gitIdentity(realDir, identityCache);
    const operationDir = gitId?.worktree_root || realDir;
    return { source: "absolute-target", requested, canonical: operationDir };
  } catch (error) {
    return { source: "absolute-target", requested, canonical: null, error: error.message };
  }
}

export function analyzeShellBoundary(command, { authorityRoot = "", initialDirectory = "" } = {}) {
  const root = authorityRoot ? path.resolve(authorityRoot) : "";
  const violations = [];
  const targets = [];
  let currentDirectory = initialDirectory ? path.resolve(initialDirectory) : (root || process.cwd());
  const addPath = (code, requested, base = currentDirectory) => {
    const resolved = path.isAbsolute(requested) ? path.resolve(requested) : path.resolve(base, requested);
    targets.push(resolved);
    if (!root || !inside(resolved, root)) violations.push({ code, requested, resolved });
    return resolved;
  };
  for (const rawSegment of String(command || "").split(/&&|\|\||;|\n/)) {
    const segment = rawSegment.trim();
    const cd = segment.match(/^\s*(?:cd|pushd)\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/);
    if (cd) {
      const requested = cd[1] || cd[2] || cd[3];
      const resolved = addPath("directory-change-cross-root", requested);
      if (root && inside(resolved, root)) currentDirectory = resolved;
      continue;
    }
    for (const match of segment.matchAll(/\bgit\s+-C\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/g)) addPath("git-c-cross-root", match[1] || match[2] || match[3]);
    if (/\b(?:svc-authority|dispatch-execution-task|validate-execution-merge-back|svc-ensure-worktree)\.mjs\b/.test(segment)) {
      const structuredFlags = new Set(["--worktree", "--repo", "--graph", "--lease", "--integration-worktree", "--inner-root", "--claim", "--evidence"]);
      const tokens = segment.match(/"[^"]+"|'[^']+'|[^\s;&|]+/g) || [];
      for (let index = 0; index < tokens.length - 1; index += 1) {
        if (structuredFlags.has(tokens[index])) addPath("structured-command-cross-root", tokens[index + 1].replace(/^['"]|['"]$/g, ""));
      }
    }
    const mutation = segment.match(/^(?:touch|mkdir|rm|rmdir|cp|mv|install|truncate|tee|ln|chmod|chown)\b(.*)$/);
    if (mutation) {
      const operands = mutation[1].match(/"[^"]+"|'[^']+'|[^\s;&|]+/g) || [];
      for (const operand of operands.filter((value) => !value.startsWith("-"))) addPath("mutation-operand-cross-root", operand.replace(/^['"]|['"]$/g, ""));
    }
    for (const match of segment.matchAll(/(?:>|>>|1>|2>)\s*([^\s;&|]+)/g)) addPath("output-redirection-cross-root", match[1].replace(/^['"]|['"]$/g, ""));
    for (const match of segment.matchAll(/\bdd\b[^|]*?\bof=((?:\/|\.\.\/)[^\s;&|]+)/g)) addPath("dd-output-cross-root", match[1]);
  }
  return {
    ok: violations.length === 0,
    violations,
    targets: [...new Set(targets)],
    completeContainment: false,
    limitation: "syntax inspection is an authority guardrail, not a complete shell security boundary",
  };
}

export function resolveOperationScope(payload, { host = "", env = process.env } = {}) {
  const contradictions = [];
  const identityCache = new Map();
  const inferredHost = String(host || payload?.host || env.SVC_HOST || "codex").toLowerCase();
  const name = canonicalToolName(payload);
  const input = toolInput(payload);
  let sessionCwd = path.resolve(payload?.cwd || payload?.working_directory || process.cwd());
  try { sessionCwd = canonicalExistingDirectory(sessionCwd); }
  catch (error) { contradictions.push({ code: "invalid-session-cwd", message: error.message }); }
  const sessionRepository = gitIdentity(sessionCwd, identityCache);

  const trusted = TRUSTED_WORKDIR_FIELDS[inferredHost] || new Set();
  const explicitSignals = [];
  for (const key of trusted) {
    if (!(key in input)) continue;
    const requested = input[key];
    const signal = { present: true, source: `tool_input.${key}`, requested, canonical: null };
    if (typeof requested !== "string" || !requested.trim()) {
      contradictions.push({ code: "invalid-explicit-workdir", message: "explicit workdir must be a non-empty string" });
      explicitSignals.push(signal);
      continue;
    }
    try {
      const candidate = path.isAbsolute(requested) ? requested : path.resolve(sessionCwd, requested);
      signal.canonical = canonicalExistingDirectory(candidate);
    } catch (error) {
      contradictions.push({ code: "invalid-explicit-workdir", message: error.message });
    }
    explicitSignals.push(signal);
  }
  const explicit = explicitSignals[0] || { present: false, source: null, requested: null, canonical: null };
  const explicitCanonical = unique(explicitSignals.map((signal) => signal.canonical));
  if (explicitCanonical.length > 1) {
    contradictions.push({ code: "conflicting-operation-cwd", sources: explicitSignals.filter((signal) => signal.canonical).map((signal) => signal.source) });
  }

  const descriptors = [
    ...directTargets(input),
    ...(PATCH_TOOLS.has(name) || typeof input.patch === "string" || /^\*\*\* Begin Patch/m.test(shellCommand(input))
      ? parsePatchTargets(input.patch || shellCommand(input)) : []),
  ];
  const commandEvidence = isShellTool(name) ? commandDirectoryEvidence(shellCommand(input), sessionCwd) : [];
  for (const item of commandEvidence) {
    if (item.error) contradictions.push({ code: "invalid-operation-cwd", source: item.source, requested: item.requested, message: item.error });
  }
  const commandCanonical = unique(commandEvidence.map((item) => item.canonical));
  const targetEvidence = descriptors.map((descriptor) => targetDirectoryEvidence(descriptor, sessionCwd, identityCache)).filter(Boolean);
  for (const item of targetEvidence) {
    if (item.error) contradictions.push({ code: "invalid-target", role: "path", requested: item.requested, message: item.error });
  }
  const targetCanonical = unique(targetEvidence.map((item) => item.canonical));
  const operationEvidence = [
    ...explicitSignals.filter((signal) => signal.canonical).map((signal) => ({ source: signal.source, canonical: signal.canonical })),
    ...commandEvidence.filter((item) => item.canonical).map((item) => ({ source: item.source, canonical: item.canonical })),
    ...targetEvidence.filter((item) => item.canonical),
  ];
  const operationCanonical = unique(operationEvidence.map((item) => item.canonical));
  if (commandCanonical.length > 1 || targetCanonical.length > 1 || operationCanonical.length > 1) {
    contradictions.push({ code: "conflicting-operation-cwd", evidence: operationEvidence });
  }
  const effectiveWorkdir = operationCanonical[0] || sessionCwd;

  const targets = [];
  const base = effectiveWorkdir || sessionCwd;
  for (const descriptor of descriptors) {
    try {
      const canonical = canonicalTarget(descriptor.requested, base, { mustExist: descriptor.must_exist });
      const repository = gitIdentity(canonical.canonical, identityCache);
      targets.push({ ...descriptor, ...canonical, ...(repository || { repo_id: null, worktree_root: null, common_git_dir: null }) });
    } catch (error) {
      contradictions.push({ code: "invalid-target", role: descriptor.role, requested: descriptor.requested, message: error.message });
    }
  }

  const targetRepos = unique(targets.map((target) => target.repo_id));
  const targetWorktrees = unique(targets.map((target) => target.worktree_root));
  if (targets.some((target) => !target.worktree_root) && targetWorktrees.length) contradictions.push({ code: "mixed-git-and-non-git-targets" });
  if (targetRepos.length > 1) contradictions.push({ code: "mixed-repositories", repositories: targetRepos });
  if (targetWorktrees.length > 1) contradictions.push({ code: "mixed-worktrees", worktrees: targetWorktrees });

  const workdirRepository = effectiveWorkdir ? gitIdentity(effectiveWorkdir, identityCache) : null;
  if (workdirRepository) {
    for (const target of targets) {
      if (!inside(target.canonical, workdirRepository.worktree_root)) {
        contradictions.push({ code: "workdir-target-mismatch", workdir: workdirRepository.worktree_root, target: target.canonical });
      }
    }
  }
  if (explicit.present && explicit.canonical && workdirRepository && targetWorktrees.length === 1 && targetWorktrees[0] !== workdirRepository.worktree_root) {
    contradictions.push({ code: "workdir-target-mismatch", workdir: workdirRepository.worktree_root, target: targetWorktrees[0] });
  }
  if (explicit.present && explicit.canonical && !workdirRepository && targetWorktrees.length) {
    contradictions.push({ code: "workdir-target-mismatch", workdir: null, target: targetWorktrees[0] });
  }

  let operationRepository = null;
  if (targets.length && targetWorktrees.length === 1) operationRepository = gitIdentity(targetWorktrees[0], identityCache);
  else if (!targets.length && workdirRepository) operationRepository = workdirRepository;
  else if (!targets.length && !explicit.present && sessionRepository) operationRepository = sessionRepository;

  const shellBoundary = isShellTool(name)
    ? analyzeShellBoundary(shellCommand(input), {
      authorityRoot: operationRepository?.worktree_root || effectiveWorkdir || sessionCwd,
      initialDirectory: explicit.canonical || sessionCwd,
    })
    : null;
  if (shellBoundary && !shellBoundary.ok) contradictions.push(...shellBoundary.violations);

  const frameworkMaintenance = Boolean(
    inferredHost === "codex" &&
    contradictions.length === 0 &&
    operationRepository &&
    operationRepository.worktree_root === runningFrameworkRoot() &&
    isFrameworkSourceRoot(operationRepository.worktree_root) &&
    isMainWorktree(operationRepository),
  );

  return {
    schema_version: OPERATION_SCOPE_SCHEMA_VERSION,
    ok: contradictions.length === 0,
    host: inferredHost,
    tool_name: name,
    session_cwd: sessionCwd,
    session_repository: sessionRepository,
    explicit_workdir: explicit,
    operation_cwd: effectiveWorkdir,
    effective_workdir: effectiveWorkdir,
    operation_cwd_evidence: operationEvidence,
    targets,
    operation_repository: operationRepository,
    framework_maintenance: frameworkMaintenance,
    shell_boundary: shellBoundary,
    contradictions,
  };
}
