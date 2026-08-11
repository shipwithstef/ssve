#!/usr/bin/env node

/**
 * svc Stop Quality — PostToolUse accumulator + Stop batch checker
 *
 * Source: Pattern from everything-claude-code post:edit:accumulator + stop:format-typecheck
 *   (MIT, Copyright 2026 Affaan M. and contributors).
 * Adapted for svc: stack-aware (not TypeScript-only), integrates with svc Stop hook ordering.
 *
 * Modes:
 *   --accumulate  PostToolUse: append edited file path to .claude/svc-edited-files.json
 *   --check       Stop: batch-run format + typecheck on all accumulated files, then clear
 *
 * Profile: Only runs when SVC_HOOK_PROFILE != "minimal" (default: runs in full profile).
 * Disable: SVC_DISABLED_HOOKS includes "svc-stop-quality".
 *
 * Exit codes (--check mode):
 *   0 — no type errors (format warnings are non-blocking)
 *   1 — type errors found (hard block)
 *
 * Exit codes (--accumulate mode):
 *   0 — always (accumulation never blocks)
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
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

function readStdinSync() {
  try {
    if (process.stdin.isTTY) return "";
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function parsePayload() {
  const stdinRaw = readStdinSync();
  if (stdinRaw && stdinRaw.trim()) {
    try { return JSON.parse(stdinRaw); } catch (e) {}
  }
  return null;
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

function getAccumulatorFile(wi) {
  const svcDir = findSvcDir();
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
// Accumulator (PostToolUse on Edit/Write)
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
  const ext = path.extname(filePath).toLowerCase();
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

  if (!SOURCE_EXTENSIONS.has(ext)) return;

  // Resolve WI using canonical chain
  const { wi } = resolveWI(payload);
  const accumulatorFile = getAccumulatorFile(wi);
  if (!accumulatorFile) return;   // WI-452: not in an svc repo — never seed .svc in cwd

  // Read existing accumulator or create
  let files = [];
  try {
    files = readJsonAtomic(accumulatorFile) || [];
  } catch {
    // File doesn't exist or is corrupt — start fresh
  }

  // Add path (deduplicate)
  const abs = path.resolve(filePath);
  if (!files.includes(abs)) {
    files.push(abs);
  }

  writeJsonAtomic(accumulatorFile, files);
}

// -------------------------------------------------------------------
// Stack detection
// -------------------------------------------------------------------

function detectStack() {
  const stacks = [];
  const cwd = process.cwd();

  // TypeScript / JavaScript
  if (fs.existsSync(path.join(cwd, "tsconfig.json"))) {
    stacks.push("typescript");
  } else if (
    fs.existsSync(path.join(cwd, "package.json")) ||
    fs.existsSync(path.join(cwd, "biome.json"))
  ) {
    stacks.push("javascript");
  }

  // Python
  if (
    fs.existsSync(path.join(cwd, "pyproject.toml")) ||
    fs.existsSync(path.join(cwd, "setup.py")) ||
    fs.existsSync(path.join(cwd, "setup.cfg"))
  ) {
    stacks.push("python");
  }

  // Go
  if (fs.existsSync(path.join(cwd, "go.mod"))) {
    stacks.push("go");
  }

  // Rust
  if (fs.existsSync(path.join(cwd, "Cargo.toml"))) {
    stacks.push("rust");
  }

  return stacks;
}

// -------------------------------------------------------------------
// Checker helpers
// -------------------------------------------------------------------

function runCommand(cmd) {
  try {
    const output = execSync(cmd, {
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

// -------------------------------------------------------------------
// Batch check (Stop hook)
// -------------------------------------------------------------------

async function check() {
  if (!shouldRun()) process.exit(0);

  const { resolveWI } = await import("./lib/resolve-wi.mjs");
  const payload = parsePayload();
  const { wi } = resolveWI(payload);

  const accumulatorFile = getAccumulatorFile(wi);
  if (!accumulatorFile) process.exit(0);   // WI-452: not in an svc repo — nothing to check

  // Read accumulated files
  let files = [];
  try {
    files = JSON.parse(fs.readFileSync(accumulatorFile, "utf8"));
  } catch {
    // No accumulator — nothing was edited this session
    files = [];
  }

  const dispatchDir = path.join(process.cwd(), ".svc", "dispatch");
  if (fs.existsSync(dispatchDir)) {
    for (const name of fs.readdirSync(dispatchDir).filter((file) => file.endsWith(".edits.json"))) {
      try {
        const edits = JSON.parse(fs.readFileSync(path.join(dispatchDir, name), "utf8"));
        for (const file of edits.files || []) {
          const abs = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
          if (!files.includes(abs)) files.push(abs);
        }
      } catch {
        // Ignore malformed worker rollups here; merge-back validation owns shape.
      }
    }
  }

  // Filter to files that still exist (may have been deleted)
  files = files.filter((f) => fs.existsSync(f));

  if (files.length === 0) {
    cleanup(accumulatorFile);
    process.exit(0);
  }

  const stacks = detectStack();
  const errors = [];
  const warnings = [];

  // --- TypeScript ---
  if (stacks.includes("typescript")) {
    const tsFiles = filterByExtension(files, [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
    if (tsFiles.length > 0) {
      // Type check (hard error)
      const tsc = runCommand("npx tsc --noEmit 2>&1 | head -40", "TypeScript typecheck");
      if (!tsc.ok && tsc.output) {
        errors.push(`[TypeScript] Type errors found:\n${tsc.output}`);
      }

      // Format check (soft warning) — try biome first, then prettier
      const biomeExists = fs.existsSync(path.join(process.cwd(), "biome.json"));
      if (biomeExists) {
        const fileArgs = tsFiles.join(" ");
        const fmt = runCommand(`npx biome check --no-errors-on-unmatched ${fileArgs} 2>&1 | head -20`, "Biome format");
        if (!fmt.ok && fmt.output) {
          warnings.push(`[Biome] Format issues:\n${fmt.output}`);
        }
      } else {
        const prettierExists =
          fs.existsSync(path.join(process.cwd(), ".prettierrc")) ||
          fs.existsSync(path.join(process.cwd(), "prettier.config.js")) ||
          fs.existsSync(path.join(process.cwd(), "prettier.config.mjs"));
        if (prettierExists) {
          const fileArgs = tsFiles.join(" ");
          const fmt = runCommand(`npx prettier --check ${fileArgs} 2>&1 | head -20`, "Prettier format");
          if (!fmt.ok && fmt.output) {
            warnings.push(`[Prettier] Format issues:\n${fmt.output}`);
          }
        }
      }
    }
  }

  // --- Python ---
  if (stacks.includes("python")) {
    const pyFiles = filterByExtension(files, [".py", ".pyi"]);
    if (pyFiles.length > 0) {
      // Type check with pyright (hard error)
      const pyright = runCommand("npx pyright 2>&1 | tail -5", "Python typecheck");
      if (!pyright.ok && pyright.output && pyright.output.includes("error")) {
        errors.push(`[Python] Type errors found:\n${pyright.output}`);
      }

      // Format check with ruff (soft warning)
      const fileArgs = pyFiles.join(" ");
      const ruff = runCommand(`ruff check ${fileArgs} 2>&1 | head -20`, "Ruff lint");
      if (!ruff.ok && ruff.output) {
        warnings.push(`[Ruff] Lint issues:\n${ruff.output}`);
      }
    }
  }

  // --- Go ---
  if (stacks.includes("go")) {
    const goFiles = filterByExtension(files, [".go"]);
    if (goFiles.length > 0) {
      const vet = runCommand("go vet ./... 2>&1 | head -20", "Go vet");
      if (!vet.ok && vet.output) {
        errors.push(`[Go] Vet errors:\n${vet.output}`);
      }
    }
  }

  // --- Rust ---
  if (stacks.includes("rust")) {
    const rsFiles = filterByExtension(files, [".rs"]);
    if (rsFiles.length > 0) {
      const check = runCommand("cargo check 2>&1 | tail -10", "Cargo check");
      if (!check.ok && check.output && check.output.includes("error")) {
        errors.push(`[Rust] Compilation errors:\n${check.output}`);
      }
    }
  }

  // --- Report ---
  if (warnings.length > 0) {
    process.stderr.write(
      `\n[svc-stop-quality] Format/lint warnings (${files.length} files checked):\n` +
        warnings.join("\n") +
        "\n\n"
    );
  }

  if (errors.length > 0) {
    // WI-399 A8: baseline-aware blocking. Block only on errors INTRODUCED
    // since the session's first check — pre-existing type debt must not
    // hostage the Stop path (capability audit R9). First check with errors
    // records them as the baseline (warn-only); later checks block only on
    // fingerprints not in the baseline. Semantics live in
    // hooks/lib/stop-quality-baseline.mjs (hermetically tier-1 tested).
    const { extractErrorFingerprints, splitNewErrors } = await import(
      "./lib/stop-quality-baseline.mjs"
    );
    const current = extractErrorFingerprints(errors);
    const baselineFile = path.join(
      path.dirname(accumulatorFile),
      path.basename(accumulatorFile).replace(/^svc-edited-files/, "svc-stop-quality-baseline")
    );
    let baseline = null;
    try {
      baseline = JSON.parse(fs.readFileSync(baselineFile, "utf8"));
    } catch {
      baseline = null;
    }
    const verdict = splitNewErrors(current, baseline);

    if (verdict.baselineMissing) {
      try {
        fs.writeFileSync(baselineFile, JSON.stringify(current));
      } catch {}
      process.stderr.write(
        `\n[svc-stop-quality] ${current.length} pre-existing type-error line(s) recorded as ` +
          `session baseline (${path.basename(baselineFile)}) — not blocking. ` +
          `New errors introduced after this point WILL block.\n`
      );
      cleanup(accumulatorFile);
      process.exit(0);
    }

    if (verdict.newErrors.length > 0) {
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
          session_id: process.env.SVC_SESSION_ID || process.env.CLAUDE_SESSION_ID || "",
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

    process.stderr.write(
      `[svc-stop-quality] ${verdict.preExisting.length} pre-existing type-error line(s) ` +
        `unchanged — no new errors introduced. Not blocking.\n`
    );
    cleanup(accumulatorFile);
    process.exit(0);
  }

  if (warnings.length === 0 && errors.length === 0 && files.length > 0) {
    process.stderr.write(
      `[svc-stop-quality] ${files.length} edited files checked — no issues.\n`
    );
  }

  cleanup(accumulatorFile);
  process.exit(0);
}

function cleanup(accumulatorFile) {
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
    process.stderr.write("Usage: svc-stop-quality.js --accumulate <tool_input> | --check\n");
    process.exit(0);
  }
}

main();
