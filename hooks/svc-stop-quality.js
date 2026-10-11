#!/usr/bin/env node

/**
 * svc Stop Quality — the generic quality check of files changed this session.
 *
 * Source: Pattern from everything-claude-code post:edit:accumulator + stop:format-typecheck
 *   (MIT, Copyright 2026 Affaan M. and contributors).
 * Adapted for svc: stack-aware (not TypeScript-only), integrates with svc Stop hook ordering.
 *
 * Modes:
 *   --check       Stop: format + typecheck the source files changed in the working
 *                 tree (git diff vs HEAD + untracked), plus any files a host
 *                 accumulator or dispatch rollup recorded. Works in any git repo;
 *                 writes nothing into the project.
 *   --accumulate  PostToolUse (Kimi only; Claude derives files from git): append
 *                 the edited file path to .svc/svc-edited-files[-<WI>].json.
 *
 * Speed: only checkers installed in the project (node_modules/.bin) or on PATH run;
 * nothing is downloaded. The set of changed files is fingerprinted (path, size,
 * mtime) per repository and session, and an unchanged set is not checked twice,
 * so a Stop with nothing new costs one `git status`.
 *
 * Output: silent when there is nothing to report. New type errors block Stop in
 * enforce mode (exit 2 + denial envelope); in advisory mode (the default) they and
 * format findings are reported as a systemMessage and Stop continues.
 *
 * Profile: Only runs when SVC_HOOK_PROFILE != "minimal" (default: runs in full profile).
 * Disable: SVC_DISABLED_HOOKS includes "svc-stop-quality".
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync, execFileSync } = require("child_process");
const os = require("os");
// WI-452: never treat the system temp ROOT as an svc repo (pollution lives at /tmp/.svc).
const TEMP_ROOTS = (() => {
  const s = new Set();
  for (const t of [os.tmpdir(), "/tmp", process.env.TMPDIR]) {
    if (!t) continue;
    try { s.add(path.resolve(t)); } catch {}
    try { s.add(fs.realpathSync(t)); } catch {}
  }
  return s;
})();

const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".pyi",
  ".go",
  ".rs",
  ".java", ".kt", ".kts",
  ".cs",
  ".swift",
  ".rb",
  ".php",
]);
const MAX_FILES = 200;

function readStdinSync() {
  try {
    if (process.stdin.isTTY) return "";
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

let payloadCache;
function parsePayload() {
  if (payloadCache !== undefined) return payloadCache;
  payloadCache = null;
  const stdinRaw = readStdinSync();
  if (stdinRaw && stdinRaw.trim()) {
    try { payloadCache = JSON.parse(stdinRaw); } catch (e) {}
  }
  return payloadCache;
}

function findSvcDir(startDir) {
  // WI-452: return the nearest ancestor's existing .svc dir, else null. NEVER
  // fall back to creating .svc in an arbitrary cwd — that seeded /tmp/.svc and
  // broke the freshness gate. Requiring a pre-existing .svc breaks the seed cycle.
  let dir = path.resolve(startDir || process.cwd());
  while (dir !== path.dirname(dir)) {
    if (!TEMP_ROOTS.has(dir)) {
      try {
        if (fs.statSync(path.join(dir, ".svc")).isDirectory()) {
          return path.join(dir, ".svc");
        }
      } catch {}
    }
    dir = path.dirname(dir);
  }
  return null;
}

function getAccumulatorFile(wi, startDir) {
  const svcDir = findSvcDir(startDir);
  if (!svcDir) return null;   // WI-452: not in an svc repo — caller skips
  if (wi) {
    return path.join(svcDir, `svc-edited-files-${wi}.json`);
  }
  return path.join(svcDir, "svc-edited-files.json");
}

// -------------------------------------------------------------------
// Profile check
// -------------------------------------------------------------------

function shouldRun() {
  const profile = (process.env.SVC_HOOK_PROFILE || "full").toLowerCase();
  if (profile === "minimal") return false;
  const disabled = (process.env.SVC_DISABLED_HOOKS || "").split(",").map((s) => s.trim());
  return !disabled.includes("svc-stop-quality");
}

// -------------------------------------------------------------------
// Accumulator (Kimi PostToolUse on Edit/Write)
// -------------------------------------------------------------------

async function accumulate(toolInput) {
  if (!shouldRun()) return;
  const { readJsonAtomic, writeJsonAtomic } = await import("../scripts/state-io.mjs");
  const { resolveWI } = await import("./lib/resolve-wi.mjs");

  let filePath = null;

  const payload = parsePayload();
  if (payload) {
    const toolInputParsed = payload.tool_input || payload.toolInput || payload.arguments || payload.args || payload.input || null;
    if (toolInputParsed) {
      filePath = toolInputParsed.file_path || toolInputParsed.filePath || toolInputParsed.path || toolInputParsed.file || null;
    }
  }

  if (!filePath && toolInput) {
    try {
      const input = typeof toolInput === "string" ? JSON.parse(toolInput) : toolInput;
      filePath = input.file_path || input.path || null;
    } catch {}
  }

  if (!filePath) return;

  // Only track source files, not docs/configs/images
  if (!SOURCE_EXTENSIONS.has(path.extname(filePath).toLowerCase())) return;

  // Resolve WI using canonical chain
  const { wi } = resolveWI(payload);
  const accumulatorFile = getAccumulatorFile(wi);
  if (!accumulatorFile) return;   // WI-452: not in an svc repo — never seed .svc in cwd

  let files = [];
  try {
    files = readJsonAtomic(accumulatorFile) || [];
  } catch {
    // File doesn't exist or is corrupt — start fresh
  }

  const abs = path.resolve(filePath);
  if (!files.includes(abs)) {
    files.push(abs);
  }

  writeJsonAtomic(accumulatorFile, files);
}

// -------------------------------------------------------------------
// Changed files, stack detection and checkers
// -------------------------------------------------------------------

function gitRoot(cwd) {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000 }).trim() || null;
  } catch {
    return null;
  }
}

// Modified, added, renamed and untracked files in the working tree (not deleted).
function gitChangedFiles(root) {
  let out = "";
  try {
    out = execFileSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], {
      cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 10000, maxBuffer: 16 * 1024 * 1024,
    });
  } catch {
    return [];
  }
  const entries = out.split("\0");
  const files = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.length < 4) continue;
    const status = entry.slice(0, 2);
    const file = entry.slice(3);
    if (status[0] === "R" || status[0] === "C") i++;   // the next entry is the rename source
    if (status.includes("D")) continue;
    files.push(path.join(root, file));
  }
  return files;
}

function detectStack(root) {
  const stacks = [];
  const has = (f) => fs.existsSync(path.join(root, f));
  if (has("tsconfig.json")) stacks.push("typescript");
  else if (has("package.json") || has("biome.json")) stacks.push("javascript");
  if (has("pyproject.toml") || has("setup.py") || has("setup.cfg")) stacks.push("python");
  if (has("go.mod")) stacks.push("go");
  if (has("Cargo.toml")) stacks.push("rust");
  return stacks;
}

// A checker binary installed in the project or on PATH; never a download.
function localBin(root, name) {
  const local = path.join(root, "node_modules", ".bin", name);
  if (fs.existsSync(local)) return local;
  return null;
}
function pathBin(name) {
  for (const dir of String(process.env.PATH || "").split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, name);
    try { fs.accessSync(candidate, fs.constants.X_OK); if (fs.statSync(candidate).isFile()) return candidate; } catch {}
  }
  return null;
}

const shq = (s) => `'${String(s).replace(/'/g, "'\\''")}'`;

function runCommand(cmd, cwd) {
  try {
    const output = execSync(cmd, {
      cwd,
      encoding: "utf8",
      timeout: 120_000, // 2 minutes max per check
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { ok: true, output: output.trim() };
  } catch (err) {
    return { ok: false, output: (err.stderr || err.stdout || err.message || "").trim() };
  }
}

function filterByExtension(files, extensions) {
  return files.filter((f) => extensions.includes(path.extname(f).toLowerCase()));
}

function cacheFile(root, sessionId) {
  const base = process.env.XDG_CACHE_HOME ? path.resolve(process.env.XDG_CACHE_HOME) : path.join(os.homedir(), ".cache");
  const key = crypto.createHash("sha256").update(`${root}\0${sessionId || ""}`).digest("hex").slice(0, 32);
  return path.join(base, "svc", "stop-quality", `${key}.json`);
}
function readCache(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")) || {}; } catch { return {}; }
}
function writeCache(file, value) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value), { mode: 0o600 });
    fs.renameSync(tmp, file);
  } catch { /* a missing cache only costs a re-check */ }
}

// -------------------------------------------------------------------
// Batch check (Stop hook)
// -------------------------------------------------------------------

async function check() {
  if (!shouldRun()) process.exit(0);

  const payload = parsePayload() || {};
  if (payload.stop_hook_active === true) process.exit(0);   // our own block re-triggered Stop
  const cwd = path.resolve(payload.cwd || process.cwd());
  const sessionId = String(payload.session_id || payload.sessionId || process.env.SVC_SESSION_ID || process.env.CLAUDE_SESSION_ID || "");
  const root = gitRoot(cwd) || cwd;

  let files = gitChangedFiles(root);

  // Host accumulator (Kimi) and dispatch-worker rollups, when present.
  let accumulatorFile = null;
  if (findSvcDir(cwd)) {
    const { resolveWI } = await import("./lib/resolve-wi.mjs");
    const { wi } = resolveWI(payload);
    accumulatorFile = getAccumulatorFile(wi, cwd);
    try {
      for (const f of JSON.parse(fs.readFileSync(accumulatorFile, "utf8"))) files.push(path.resolve(f));
    } catch { /* no accumulator */ }
    const dispatchDir = path.join(root, ".svc", "dispatch");
    if (fs.existsSync(dispatchDir)) {
      for (const name of fs.readdirSync(dispatchDir).filter((file) => file.endsWith(".edits.json"))) {
        try {
          const edits = JSON.parse(fs.readFileSync(path.join(dispatchDir, name), "utf8"));
          for (const file of edits.files || []) files.push(path.isAbsolute(file) ? file : path.resolve(root, file));
        } catch {
          // Ignore malformed worker rollups here; merge-back validation owns shape.
        }
      }
    }
  }

  files = [...new Set(files)]
    .filter((f) => SOURCE_EXTENSIONS.has(path.extname(f).toLowerCase()))
    .filter((f) => !f.split(path.sep).includes("node_modules"))
    .filter((f) => { try { return fs.statSync(f).isFile(); } catch { return false; } })
    .sort()
    .slice(0, MAX_FILES);

  if (files.length === 0) {
    cleanup(accumulatorFile);
    process.exit(0);
  }

  const stacks = detectStack(root);
  const cachePath = cacheFile(root, sessionId);
  const cache = readCache(cachePath);
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify([stacks, files.map((f) => {
    const st = fs.statSync(f);
    return [f, st.size, st.mtimeMs];
  })])).digest("hex");
  if (cache.fingerprint === fingerprint) {
    cleanup(accumulatorFile);
    process.exit(0);   // these exact file states were already checked this session
  }

  const errors = [];
  const warnings = [];

  // --- TypeScript ---
  if (stacks.includes("typescript")) {
    const tsFiles = filterByExtension(files, [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
    const tsc = localBin(root, "tsc");
    if (tsFiles.length > 0 && tsc) {
      const result = runCommand(`${shq(tsc)} --noEmit 2>&1 | head -40`, root);
      // `| head` masks the exit status; tsc prints "error TS" only on errors.
      if (/error TS\d+/.test(result.output)) errors.push(`[TypeScript] Type errors found:\n${result.output}`);
    }
  }
  // --- Format (TS/JS) — biome first, then prettier; local installs only ---
  if (stacks.includes("typescript") || stacks.includes("javascript")) {
    const jsFiles = filterByExtension(files, [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
    const biome = fs.existsSync(path.join(root, "biome.json")) ? localBin(root, "biome") : null;
    const prettierConfigured = [".prettierrc", ".prettierrc.json", "prettier.config.js", "prettier.config.mjs"].some((f) => fs.existsSync(path.join(root, f)));
    const prettier = !biome && prettierConfigured ? localBin(root, "prettier") : null;
    const fileArgs = jsFiles.map(shq).join(" ");
    if (jsFiles.length > 0 && biome) {
      const fmt = runCommand(`${shq(biome)} check --no-errors-on-unmatched ${fileArgs} 2>&1 | head -20`, root);
      if (!fmt.ok && fmt.output) warnings.push(`[Biome] Format issues:\n${fmt.output}`);
    } else if (jsFiles.length > 0 && prettier) {
      const fmt = runCommand(`${shq(prettier)} --check ${fileArgs} 2>&1 | head -20`, root);
      if (/\[warn\]/.test(fmt.output)) warnings.push(`[Prettier] Format issues:\n${fmt.output}`);
    }
  }

  // --- Python ---
  if (stacks.includes("python")) {
    const pyFiles = filterByExtension(files, [".py", ".pyi"]);
    if (pyFiles.length > 0) {
      const pyright = localBin(root, "pyright") || pathBin("pyright");
      if (pyright) {
        const result = runCommand(`${shq(pyright)} 2>&1 | tail -5`, root);
        if (/\b[1-9]\d* errors?\b/.test(result.output)) errors.push(`[Python] Type errors found:\n${result.output}`);
      }
      const ruff = pathBin("ruff");
      if (ruff) {
        const lint = runCommand(`${shq(ruff)} check ${pyFiles.map(shq).join(" ")} 2>&1 | head -20`, root);
        if (/\b[1-9]\d* errors?\b|Found [1-9]/.test(lint.output)) warnings.push(`[Ruff] Lint issues:\n${lint.output}`);
      }
    }
  }

  // --- Go ---
  if (stacks.includes("go") && filterByExtension(files, [".go"]).length > 0 && pathBin("go")) {
    const vet = runCommand("go vet ./... 2>&1 | head -20", root);
    if (vet.output) errors.push(`[Go] Vet errors:\n${vet.output}`);
  }

  // --- Rust ---
  if (stacks.includes("rust") && filterByExtension(files, [".rs"]).length > 0 && pathBin("cargo")) {
    const result = runCommand("cargo check 2>&1 | tail -10", root);
    if (/^error/m.test(result.output)) errors.push(`[Rust] Compilation errors:\n${result.output}`);
  }

  const { resolveHookMode } = await import("./lib/hook-policy.mjs");
  const advisory = resolveHookMode().mode !== "enforce";
  const record = (extra = {}) => writeCache(cachePath, { ...cache, fingerprint, ...extra });
  const advice = [];
  if (warnings.length > 0) advice.push(`Format/lint findings in ${files.length} changed file(s) (not blocking):\n${warnings.join("\n")}`);

  if (errors.length > 0) {
    // WI-399 A8: baseline-aware blocking. Block only on errors INTRODUCED
    // since the session's first check — pre-existing type debt must not
    // hostage the Stop path (capability audit R9). First check with errors
    // records them as the baseline; later checks report only fingerprints not
    // in the baseline. Semantics live in hooks/lib/stop-quality-baseline.mjs
    // (hermetically tier-1 tested). The baseline lives in the user cache, keyed
    // by repository and session, never in the project.
    const { extractErrorFingerprints, splitNewErrors } = await import("./lib/stop-quality-baseline.mjs");
    const current = extractErrorFingerprints(errors);
    const verdict = splitNewErrors(current, Array.isArray(cache.baseline) ? cache.baseline : null);

    if (verdict.baselineMissing) {
      record({ baseline: current });
      emitAdvice(advice, advisory);
      cleanup(accumulatorFile);
      process.exit(0);
    }

    if (verdict.newErrors.length > 0) {
      record();
      if (advisory) {
        advice.unshift(`${verdict.newErrors.length} new type error(s) since this session's first check (${verdict.preExisting.length} pre-existing ignored):\n${verdict.newErrors.join("\n")}`);
        emitAdvice(advice, true);
        cleanup(accumulatorFile);
        process.exit(0);
      }
      // WI-487 (F-003/AC-487-7): route the block through the canonical emitDenial
      // (5-field {hook_id,reason_code,cause,operation,recovery} envelope on stderr
      // + a DURABLE per-session receipt via enforcement-core) instead of an
      // anonymous exit, then hard-block with the canonical exit 2. Dynamic ESM
      // import from a CJS module; fall back to a direct 5-field write if absent.
      const cause =
        `NEW TYPE ERRORS introduced this session (${verdict.newErrors.length} new, ` +
        `${verdict.preExisting.length} pre-existing ignored): ` + verdict.newErrors.join("; ");
      const recovery =
        "Fix the NEW type errors listed above before stopping (pre-existing errors are ignored).";
      let emitted = false;
      try {
        const { emitDenial } = await import("./lib/hook-denial.mjs");
        emitDenial({
          hook_id: "svc-stop-quality",
          reason_code: "SVC-STOP-QUALITY-BLOCK",
          cause: cause.slice(0, 1200),
          operation: "session Stop with unresolved new type errors",
          recovery,
          resolved_command_path: "svc-stop-quality:new-type-errors",
          session_id: sessionId,
        });
        emitted = true;
      } catch {
        // hook-denial.mjs unavailable (older install) — write the 5-field envelope directly.
      }
      if (!emitted) {
        process.stderr.write(
          JSON.stringify({
            svc_denial: true,
            hook_id: "svc-stop-quality",
            reason_code: "SVC-STOP-QUALITY-BLOCK",
            cause,
            operation: "session Stop with unresolved new type errors",
            recovery,
          }) + "\n"
        );
      }
      process.stderr.write(
        `\n[svc-stop-quality] SVC DENIAL svc-stop-quality SVC-STOP-QUALITY-BLOCK: ${verdict.newErrors.length} new type error(s). ` +
          `Fix the NEW type errors before continuing:\n` + verdict.newErrors.join("\n") + "\n"
      );
      cleanup(accumulatorFile);
      process.exit(2);
    }
  }

  // A clean check is the session's baseline too: errors that appear after it
  // were introduced this session, not pre-existing.
  record(errors.length === 0 && !Array.isArray(cache.baseline) ? { baseline: [] } : {});
  emitAdvice(advice, advisory);
  cleanup(accumulatorFile);
  process.exit(0);
}

// Advice reaches the user as a systemMessage; nothing is printed when empty.
function emitAdvice(advice, advisory) {
  if (advice.length === 0) return;
  const text = `[svc-stop-quality] ${advice.join("\n\n")}`.slice(0, 4000);
  if (advisory) process.stdout.write(JSON.stringify({ systemMessage: text }) + "\n");
  else process.stderr.write(`\n${text}\n`);
}

function cleanup(accumulatorFile) {
  if (!accumulatorFile) return;
  try {
    fs.unlinkSync(accumulatorFile);
  } catch {
    // Already gone or never existed
  }
}

// -------------------------------------------------------------------
// Main
// -------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const mode = args.find((a) => a.startsWith("--"));
  const toolInput = args.find((a) => !a.startsWith("--"));

  if (mode === "--accumulate") {
    await accumulate(toolInput);
    process.exit(0);
  } else if (mode === "--check") {
    await check();
  } else {
    process.stderr.write("Usage: svc-stop-quality.js --check | --accumulate <tool_input>\n");
    process.exit(0);
  }
}

main();
