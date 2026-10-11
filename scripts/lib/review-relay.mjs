// Orchestrator relay for the eval's framework arm. The framework's adversarial review is
// cross-family (Codex) and must never fall back to a same-model reviewer. Inside the builder
// sandbox every foreign agent CLI is a shim that exits 127, so the framework's own launchers
// (scripts/run-external-review.mjs and the two-box planner) cannot run. This module is the
// runner-side answer: a unix-socket server, started per job OUTSIDE the sandbox, that executes
// the REAL `codex` found on the runner's PATH for the framework's review and planning calls
// ONLY. It is not a general model proxy for the builder:
//   - an `exec` call is accepted only when it carries an --output-schema whose content hash is
//     one of the framework's own review/planning schemas (the caller computes the allowlist
//     from the installed framework source); anything else is refused, as is any exec call
//     without --json (usage must be reported);
//   - the sandbox is forced to read-only; write/danger flags, sandbox/approval config and
//     feature enabling are refused, never passed on;
//   - the working directory must be the job's build dir, a path under the job home (the
//     sandbox HOME), or a neutral sandbox /tmp dir (mapped to a fresh empty host dir);
//   - output returned to the sandbox is capped;
//   - each job gets its own CODEX_HOME holding only the runner's auth, so a reviewer sees no
//     other conversation or session;
//   - a per-call timeout, a per-job call cap and a per-call spend ceiling; accounting is kept
//     apart from the bounded diagnostic log, updates as usage events arrive, and reserves an
//     estimate for a running call that has reported none.
// The client half (review-relay-client.mjs) is installed in the job home as the `codex` shim.
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export const SANDBOX_HOME = "/tmp/oe-home";
export const RELAY_DIR = ".oe-relay";
export const RELAY_SOCK = "s";
export const DEFAULT_MAX_CALLS = 12;
export const DEFAULT_CALL_TIMEOUT_MS = 1_800_000;
export const DEFAULT_UNMEASURED_CALL_USD = 0.25;
export const DEFAULT_MAX_CALL_USD = 5;
export const DEFAULT_STDOUT_CAP = 2 * 1024 * 1024;
export const DEFAULT_LAST_MESSAGE_CAP = 512 * 1024;
const STDERR_CAP = 256 * 1024;
const MAX_PROBES = 60;
const MAX_REJECT_LOG = 50;
const MAX_STDIN = 32 * 1024 * 1024;
export const CLIENT_SOURCE = path.join(path.dirname(fileURLToPath(import.meta.url)), "review-relay-client.mjs");

const isUnder = (p, base) => { const r = path.relative(base, p); return r === "" || (!r.startsWith("..") && !path.isAbsolute(r)); };
export const sha256Hex = (b) => crypto.createHash("sha256").update(b).digest("hex");

// --- argv vetting ---------------------------------------------------------------------

const BOOL_FLAGS = new Set(["--skip-git-repo-check", "--ephemeral", "--ignore-user-config", "--ignore-rules", "--strict-config", "--json"]);
const INFO_FLAGS = new Set(["--help", "-h", "--version", "-V"]);
// Flags that take a value, by canonical name.
const VALUE_FLAGS = { "-c": "config", "--config": "config", "-m": "model", "--model": "model", "-s": "sandbox", "--sandbox": "sandbox", "-C": "cd", "--cd": "cd", "--output-schema": "schema", "-o": "last", "--output-last-message": "last", "--color": "color" };
const REFUSED_NOTE = {
  "--dangerously-bypass-approvals-and-sandbox": "write/danger flag", "--full-auto": "write/danger flag", "--yolo": "write/danger flag",
  "--approve-for-me": "write/danger flag", "--dangerously-bypass-hook-trust": "write/danger flag", "--add-dir": "writable directory", "--worktree": "creates a worktree",
};
// Config a review or planning call may set: the model and its reasoning, and the isolation
// settings the two-box planner passes (project docs off, web search off, empty developer
// instructions, features off, skills disabled). Nothing that widens what the model may do.
function configOk(kv) {
  const m = /^([A-Za-z0-9_.]+)=(.*)$/s.exec(kv);
  if (!m) return "not key=value";
  const [, k, v] = m;
  if (/^(model|model_reasoning_effort|model_reasoning_summary|model_verbosity)$/.test(k)) return null;
  if (/^(hide_agent_reasoning|show_raw_agent_reasoning)$/.test(k)) return null;
  if (k === "project_doc_max_bytes") return /^\d+$/.test(v) ? null : "project_doc_max_bytes must be a number";
  if (k === "web_search") return /^"disabled"$/.test(v) ? null : "web_search must stay disabled";
  if (k === "developer_instructions") return v === '""' ? null : "developer_instructions must stay empty";
  if (k === "skills.config") return /^\[.*\]$/s.test(v) && !/enabled\s*=\s*true/.test(v) ? null : "skills.config may only disable skills";
  const f = /^features\.([a-z0-9_]+)$/.exec(k);
  if (f) return (f[1] === "skip_host_skill_discovery" || v === "false") ? null : "features may only be turned off";
  return `${k} may not be overridden`;
}

const refuse = (reason) => ({ ok: false, reason });
const infoCall = (args, extra = {}) => ({ ok: true, kind: "info", info: true, args, cwdArg: null, schema: null, last: null, model: null, json: false, promptChars: 0, ...extra });

// Vet the client's argv. Returns {ok, kind: "exec"|"info", info, args, cwdArg, schema, last,
// model, json, promptChars}; `args` is the argv to run (after `codex`) with -s read-only
// enforced for exec and the file options kept as the client wrote them (the server swaps the
// paths for scratch files).
export function vetCodexArgv(argv) {
  if (!Array.isArray(argv) || argv.some((a) => typeof a !== "string") || argv.length > 200) return refuse("malformed argv");
  if (argv.some((a) => a.length > 4_000_000)) return refuse("argument too large");
  // Probes the launchers make before a paid call: no model is called.
  if (argv.length === 1 && (INFO_FLAGS.has(argv[0]) || argv[0] === "help")) return infoCall([...argv]);
  if (argv.length === 2 && argv[0] === "features" && argv[1] === "list") return infoCall([...argv]);
  if (argv[0] === "debug" && argv[1] === "prompt-input") return vetPromptInput(argv);
  if (argv[0] !== "exec") return refuse("only `codex exec` for review and planning is relayed; this CLI is otherwise blocked in the sandbox");
  const rest = argv.slice(1);
  const out = []; let info = false, sandboxSeen = false, cwdArg = null, schema = null, last = null, model = null, json = false, positional = 0, promptChars = 0;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "-") { positional++; out.push(a); continue; }
    if (!a.startsWith("-")) {
      if (positional === 0 && ["resume", "fork", "review", "help"].includes(a)) return refuse(`codex exec ${a} is not relayed`);
      positional++; promptChars += a.length; out.push(a); continue;
    }
    if (a === "--") return refuse("`--` is not accepted");
    let name = a, val = null;
    const eq = a.startsWith("--") ? a.indexOf("=") : -1;
    if (eq > 0) { name = a.slice(0, eq); val = a.slice(eq + 1); }
    if (REFUSED_NOTE[name]) return refuse(`${name} refused: ${REFUSED_NOTE[name]} (reviews run read-only)`);
    if (INFO_FLAGS.has(name)) { info = true; out.push(name); continue; }
    if (BOOL_FLAGS.has(name) && val == null) { if (name === "--json") json = true; out.push(name); continue; }
    const kind = VALUE_FLAGS[name];
    if (!kind) return refuse(`${name} is not accepted by the review relay`);
    if (val == null) { val = rest[++i]; if (val == null) return refuse(`${name} needs a value`); }
    if (kind === "sandbox") {
      if (val !== "read-only") return refuse(`-s ${val} refused: reviews run read-only`);
      sandboxSeen = true; out.push("-s", "read-only"); continue;
    }
    if (kind === "config") {
      const bad = configOk(val);
      if (bad) return refuse(`-c ${String(val).slice(0, 60)} refused: ${bad}`);
      const m = /^model=(.*)$/s.exec(val);
      if (m) model = m[1].replace(/^"|"$/g, "");
      out.push("-c", val); continue;
    }
    if (kind === "model") {
      if (!/^[A-Za-z0-9._:/-]{1,100}$/.test(val)) return refuse("model name not accepted");
      model = val; out.push("-m", val); continue;
    }
    if (kind === "cd") { cwdArg = val; continue; }
    if (kind === "schema") { schema = val; out.push("--output-schema", val); continue; }
    if (kind === "last") { last = val; out.push("--output-last-message", val); continue; }
    if (kind === "color") { if (!["always", "never", "auto"].includes(val)) return refuse("--color value not accepted"); out.push("--color", val); continue; }
  }
  if (positional > 1) return refuse("more than one prompt argument");
  if (info) return infoCall(["exec", ...out], { model });
  if (!sandboxSeen) out.unshift("-s", "read-only");
  if (!json) return refuse("--json is required so that usage is reported and charged");
  if (schema == null) return refuse("exec calls must carry the framework's review or planning --output-schema; free-form generation is not relayed");
  return { ok: true, kind: "exec", info: false, args: ["exec", ...out], cwdArg, schema, last, model, json, promptChars };
}

// `codex debug prompt-input [-c k=v ...] [--help] [prompt]`: renders the prompt locally; no model.
function vetPromptInput(argv) {
  const rest = argv.slice(2); const out = ["debug", "prompt-input"]; let positional = 0;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (INFO_FLAGS.has(a)) { out.push(a); continue; }
    if (a === "-c" || a === "--config") {
      const v = rest[++i]; const bad = v == null ? "needs a value" : configOk(v);
      if (bad) return refuse(`-c ${String(v).slice(0, 60)} refused: ${bad}`);
      out.push("-c", v); continue;
    }
    if (a.startsWith("-")) return refuse(`${a} is not accepted by the review relay`);
    positional++; out.push(a);
  }
  if (positional > 1) return refuse("more than one prompt argument");
  return infoCall(out);
}

// What the row keeps of a call: flags and values, but no prompt text.
export function sanitizeArgv(argv) {
  if (!Array.isArray(argv)) return [];
  let seenCommand = false;
  return argv.slice(0, 60).map((a) => {
    const s = String(a);
    if (s === "exec" || s === "debug") seenCommand = true;
    if (seenCommand && !s.startsWith("-") && s.length > 60) return `<${s.length} chars>`;
    return s.length > 200 ? `${s.slice(0, 200)}...` : s;
  });
}

// --- usage ----------------------------------------------------------------------------

// Codex prints usage as JSONL when --json is set: a `turn.completed` event carries
// usage {input_tokens, cached_input_tokens, cache_write_input_tokens, output_tokens,
// reasoning_output_tokens} (checked against codex-cli 0.162). A call can run more than one
// turn, so turn totals are summed; an event outside turn.completed with a usage object is used
// only when no turn reported one. Input tokens include the cached ones; output tokens include
// reasoning. Returns null when the output has no usage.
export function parseCodexUsage(lines) {
  const turns = []; let other = null; const models = new Set();
  for (const line of lines) {
    let e; try { e = JSON.parse(line); } catch { continue; }
    if (!e || typeof e !== "object") continue;
    for (const m of [e.model, e.response?.model, e.turn?.model]) if (typeof m === "string") models.add(m);
    if (e.usage && typeof e.usage === "object") { if (e.type === "turn.completed") turns.push(e.usage); else other = e.usage; }
  }
  const use = turns.length ? turns : other ? [other] : [];
  if (!use.length) return null;
  const sum = (k) => use.reduce((n, u) => n + (Number(u[k]) || 0), 0);
  return { input_tokens: sum("input_tokens"), cached_input_tokens: sum("cached_input_tokens"), output_tokens: sum("output_tokens"), reasoning_output_tokens: sum("reasoning_output_tokens"), cache_write_input_tokens: sum("cache_write_input_tokens"), observed_models: [...models] };
}

// Usage in the shape the runner's model_usage uses (and priceUsage takes).
export function usageForPricing(u) {
  const cached = Math.min(u.cached_input_tokens || 0, u.input_tokens || 0);
  return { inputTokens: Math.max(0, (u.input_tokens || 0) - cached), cacheReadInputTokens: cached, outputTokens: u.output_tokens || 0, ...(u.cache_write_input_tokens ? { cacheCreationInputTokens: u.cache_write_input_tokens } : {}) };
}

// --- path mapping ---------------------------------------------------------------------

// Map a sandbox path to a host path, or null. The sandbox HOME is the job home on the host and
// the build dir is bound at the same path. The host path is resolved through symlinks and must
// stay inside one of the two; it must be an existing directory.
export function mapSandboxDir(p, { jobHome, buildDir }) {
  if (typeof p !== "string" || !path.isAbsolute(p)) return null;
  const norm = path.resolve(p);
  let host = null;
  if (isUnder(norm, SANDBOX_HOME)) host = path.join(jobHome, path.relative(SANDBOX_HOME, norm));
  else if (isUnder(norm, buildDir)) host = norm;
  else return null;
  try {
    const real = fs.realpathSync(host);
    if (!fs.statSync(real).isDirectory()) return null;
    const roots = [jobHome, buildDir].map((r) => { try { return fs.realpathSync(r); } catch { return r; } });
    return roots.some((r) => isUnder(real, r)) ? real : null;
  } catch { return null; }
}

// A working directory that lives only in the sandbox's private /tmp (two-box planning runs
// its reviewers from a fresh neutral temp dir there). It has no host counterpart, so it is
// never mapped to a host path: the call gets a new empty directory instead.
export function isNeutralSandboxDir(p, { buildDir }) {
  if (typeof p !== "string" || !path.isAbsolute(p)) return false;
  const norm = path.resolve(p);
  return norm !== "/tmp" && isUnder(norm, "/tmp") && !isUnder(norm, SANDBOX_HOME) && !isUnder(norm, buildDir);
}

// First executable named `name` on pathEnv.
export function findOnPath(name, pathEnv = process.env.PATH) {
  for (const d of String(pathEnv || "").split(path.delimiter).filter(Boolean)) {
    const f = path.join(d, name);
    try { fs.accessSync(f, fs.constants.X_OK); if (fs.statSync(f).isFile()) return f; } catch { /* next */ }
  }
  return null;
}

// --- server ---------------------------------------------------------------------------

function frame(type, payload) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const head = Buffer.alloc(5);
  head.write(type, 0, 1, "latin1");
  head.writeUInt32BE(body.length, 1);
  return Buffer.concat([head, body]);
}

// A per-job Codex state directory: only the runner's login, nothing of its conversations,
// sessions, history or config. Returns the directory (0700).
export function makeIsolatedCodexHome(from = process.env.CODEX_HOME || path.join(os.homedir(), ".codex")) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "oe-codex-home-"));
  fs.chmodSync(d, 0o700);
  const auth = path.join(from, "auth.json");
  try { fs.copyFileSync(auth, path.join(d, "auth.json")); fs.chmodSync(path.join(d, "auth.json"), 0o600); } catch { /* API-key auth in the environment, or none */ }
  return d;
}

// startRelay({ jobHome, buildDir, ... }) -> relay handle. Options:
//   allowedSchemaHashes  sha256 hex of each --output-schema an exec call may carry (a Set or
//                        array); without it no exec call is accepted
//   codexBin       the real codex (default: first `codex` on pathEnv)
//   maxCalls       per-job cap on exec calls (default 12)
//   callTimeoutMs  per-call deadline (default 30 minutes)
//   deadlineAt     epoch ms after which no call may start and a running one is cut short
//   price(model, usage) -> {usd, known, basis}   prices one call's usage
//   unmeasuredCallUsd  estimate charged (and reserved while running) for a call that reports no usage
//   maxCallUsd     a call whose accrued cost passes this is stopped
//   stdoutCap / lastMessageCap   bytes returned to the sandbox per call
//   confine(ctx) -> argv prefix (e.g. a bwrap command) to run codex under; ctx = {cwd, scratch, neutral, codexHome}
//   codexHomeFrom  where the runner's codex login lives (default CODEX_HOME or ~/.codex); the job gets an isolated copy of auth.json only
//   env            environment for codex (default: the runner's, minus SVC_* variables)
export async function startRelay({ jobHome, buildDir, allowedSchemaHashes = null, codexBin = null, pathEnv = process.env.PATH, maxCalls = DEFAULT_MAX_CALLS, callTimeoutMs = DEFAULT_CALL_TIMEOUT_MS, deadlineAt = null, price = null, unmeasuredCallUsd = DEFAULT_UNMEASURED_CALL_USD, maxCallUsd = DEFAULT_MAX_CALL_USD, stdoutCap = DEFAULT_STDOUT_CAP, lastMessageCap = DEFAULT_LAST_MESSAGE_CAP, confine = null, codexHomeFrom = undefined, env = null } = {}) {
  if (!jobHome || !buildDir) throw new Error("startRelay needs jobHome and buildDir");
  const bin = codexBin || findOnPath("codex", pathEnv);
  if (!bin) throw new Error("no codex binary on the runner's PATH");
  const allowed = new Set([...(allowedSchemaHashes || [])]);
  const dir = path.join(jobHome, RELAY_DIR);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const socketPath = path.join(dir, RELAY_SOCK);
  fs.rmSync(socketPath, { force: true });
  const codexHome = makeIsolatedCodexHome(codexHomeFrom);
  const childEnv = { ...(env || Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^SVC_/.test(k) && k !== "CLAUDE_CONFIG_DIR" && k !== "OE_RELAY_SOCK"))), CODEX_HOME: codexHome };
  // Accounting is kept apart from the diagnostic log: the log is bounded, the ledger is not
  // (it holds at most maxCalls exec records), so a flood of refused requests cannot hide a paid call.
  const log = []; let rejectedTotal = 0, probeLogged = 0;
  const ledger = [];            // finished exec calls
  const running = new Set();    // exec calls in flight: {cost}
  const live = new Set();       // child processes
  let used = 0, probes = 0, closed = false;
  const sumLedger = () => ledger.reduce((n, c) => n + (c.cost_usd || 0), 0);
  const runningCost = () => { let n = 0; for (const r of running) n += r.cost; return n; };

  function priceUsage(model, usage) {
    if (!price || !usage) return null;
    try { const p = price(model, usageForPricing(usage)); return { usd: +p.usd.toFixed(6), known: p.known !== false, basis: p.basis || null }; } catch { return null; }
  }

  async function handle(sock) {
    let buf = Buffer.alloc(0), gotRequest = false, child = null, stdinBytes = 0, finished = false;
    const pendingIn = []; let inEnded = false;
    const send = (type, payload) => { if (!sock.destroyed && sock.writable) sock.write(frame(type, payload)); };
    const finish = (rec, exit, lastMessage = null) => {
      if (finished) return; finished = true;
      if (rec.rejected) { rejectedTotal++; if (log.filter((c) => c.rejected).length < MAX_REJECT_LOG) log.push(rec); }
      else if (rec.probe) { if (probeLogged++ < MAX_PROBES) log.push(rec); }
      else { ledger.push(rec); log.push(rec); }
      send("F", JSON.stringify({ exit, last_message: lastMessage }));
      sock.end();
    };
    const reject = (argv, reason) => {
      send("E", `codex: ${reason}\n`);
      finish({ argv_sanitized: sanitizeArgv(argv), exit: 126, wall_ms: 0, usage: null, rejected: reason }, 126);
    };
    async function start(req) {
      const argv = req.argv;
      const vet = vetCodexArgv(argv);
      if (!vet.ok) return reject(argv, vet.reason);
      if (closed) return reject(argv, "the review relay is closed");
      let schemaLabel = null;
      if (vet.info) {
        if (probes >= MAX_PROBES) return reject(argv, "too many probe calls");
      } else {
        if (used >= maxCalls) return reject(argv, `review call cap reached (${maxCalls} per job)`);
        if (deadlineAt != null && Date.now() >= deadlineAt) return reject(argv, "the job's time is spent");
        if (typeof req.schema !== "string") return reject(argv, "--output-schema file was not provided");
        const h = sha256Hex(Buffer.from(req.schema, "utf8"));
        if (!allowed.has(h)) return reject(argv, "--output-schema is not one of the framework's review or planning schemas; free-form generation is not relayed");
        schemaLabel = h.slice(0, 12);
      }
      // Working directory. Info probes and neutral dirs run in a fresh empty directory; exec
      // calls must be in the build dir or the job home.
      let cwd = null, mappedCd = null, neutralCwd = vet.info, neutralCd = false;
      if (!vet.info) {
        const reqCwd = typeof req.cwd === "string" ? req.cwd : "";
        cwd = mapSandboxDir(reqCwd, { jobHome, buildDir });
        if (!cwd) {
          if (isNeutralSandboxDir(reqCwd, { buildDir })) neutralCwd = true;
          else return reject(argv, `working directory ${reqCwd || "<none>"} is outside the job (allowed: the build dir, the job home, or a neutral temp dir)`);
        }
        if (vet.cwdArg != null) {
          const abs = path.resolve(reqCwd, vet.cwdArg);
          mappedCd = mapSandboxDir(abs, { jobHome, buildDir });
          if (!mappedCd) {
            if (isNeutralSandboxDir(abs, { buildDir })) neutralCd = true;
            else return reject(argv, `-C ${vet.cwdArg} is outside the job (allowed: the build dir, the job home, or a neutral temp dir)`);
          }
        }
      }
      if (vet.info) probes++; else used++;
      const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "oe-relay-"));
      const args = [...vet.args];
      let lastFile = null, neutral = null;
      try {
        if (neutralCwd || neutralCd) {
          // A fresh, empty directory per call; never an existing host path.
          neutral = path.join(scratch, "neutral"); fs.mkdirSync(neutral);
          if (neutralCwd) cwd = neutral;
          if (neutralCd) mappedCd = neutral;
        }
        if (vet.schema != null) {
          const f = path.join(scratch, "schema.json"); fs.writeFileSync(f, req.schema);
          args[args.indexOf(vet.schema, args.indexOf("--output-schema"))] = f;
        }
        if (vet.last != null) {
          lastFile = path.join(scratch, "last-message.txt");
          args[args.indexOf(vet.last, args.indexOf("--output-last-message"))] = lastFile;
        }
        if (mappedCd) args.splice(1, 0, "-C", mappedCd);
      } catch (e) { fs.rmSync(scratch, { recursive: true, force: true }); return reject(argv, e.message); }
      const prefix = confine ? confine({ cwd: mappedCd || cwd, scratch, neutral, codexHome, info: vet.info }) : [];
      const cmd = prefix.length ? prefix[0] : bin;
      const cmdArgs = prefix.length ? [...prefix.slice(1), bin, ...args] : args;
      const t0 = Date.now();
      let timedOut = false, stopped = null;
      const limit = Math.max(1, Math.min(callTimeoutMs, deadlineAt != null ? deadlineAt - Date.now() : Infinity));
      const usageLines = []; let partial = "", sentOut = 0, sentErr = 0, truncatedOut = false;
      // A running exec call is charged an estimate until it reports usage.
      const cur = vet.info ? null : { cost: unmeasuredCallUsd };
      if (cur) running.add(cur);
      const model = () => vet.model || null;
      try { child = spawn(cmd, cmdArgs, { cwd, env: childEnv, stdio: ["pipe", "pipe", "pipe"], detached: true }); }
      catch (e) { if (cur) running.delete(cur); fs.rmSync(scratch, { recursive: true, force: true }); return reject(argv, `cannot start codex: ${e.code || e.message}`); }
      live.add(child);
      const killGroup = (sig) => { try { process.kill(-child.pid, sig); } catch { try { child.kill(sig); } catch { /* gone */ } } };
      const stop = (why) => { if (stopped) return; stopped = why; killGroup("SIGTERM"); setTimeout(() => killGroup("SIGKILL"), 1500).unref(); };
      const timer = setTimeout(() => { timedOut = true; stop("timeout"); }, limit);
      // Usage lines are priced as they arrive, so the watchdog sees a running call's spend.
      const noteLine = (l) => {
        if (!l.includes("\"usage\"") && !l.includes("\"model\"")) return;
        usageLines.push(l.length > 20000 ? l.slice(0, 20000) : l);
        if (!cur || !l.includes("\"usage\"")) return;
        const u = parseCodexUsage(usageLines);
        const p = u && priceUsage(model() || u.observed_models[0] || null, u);
        if (p) { cur.cost = p.usd; if (p.usd > maxCallUsd) stop("call-budget"); }
      };
      const absorb = (chunk) => {
        partial += chunk.toString("utf8");
        let nl;
        while ((nl = partial.indexOf("\n")) >= 0) { const l = partial.slice(0, nl); partial = partial.slice(nl + 1); noteLine(l); }
        if (partial.length > 1_000_000) partial = "";
      };
      child.stdout.on("data", (c) => {
        absorb(c);
        // Output past the cap is read (for usage) but not returned to the sandbox.
        const room = stdoutCap - sentOut;
        if (room > 0) { const part = c.length > room ? c.subarray(0, room) : c; sentOut += part.length; send("O", part); }
        if (c.length > room && !truncatedOut) { truncatedOut = true; send("E", `codex: output beyond ${stdoutCap} bytes is not returned to the sandbox\n`); }
      });
      child.stderr.on("data", (c) => { const room = STDERR_CAP - sentErr; if (room > 0) { const part = c.length > room ? c.subarray(0, room) : c; sentErr += part.length; send("E", part); } });
      child.stdin.on("error", () => {});
      child.on("error", (e) => send("E", `codex: ${e.code || e.message}\n`));
      child.on("close", (code, signal) => {
        clearTimeout(timer); live.delete(child);
        if (partial) noteLine(partial);
        let exit = code ?? (signal ? 128 + (os.constants.signals[signal] || 9) : 1);
        if (timedOut) { exit = 124; send("E", `codex: review call exceeded its ${Math.round(limit / 1000)}s limit and was stopped\n`); }
        else if (stopped === "call-budget") { exit = 125; send("E", `codex: review call stopped at its spend ceiling ($${maxCallUsd})\n`); }
        const usage = vet.info ? null : parseCodexUsage(usageLines);
        let rec;
        if (vet.info) rec = { argv_sanitized: sanitizeArgv(argv), exit, wall_ms: Date.now() - t0, usage: null, probe: true };
        else {
          const p = usage ? priceUsage(model() || usage.observed_models[0] || null, usage) : null;
          rec = { argv_sanitized: sanitizeArgv(argv), exit, wall_ms: Date.now() - t0, usage, schema: schemaLabel,
            model: model() || usage?.observed_models?.[0] || null,
            ...(p ? { cost_usd: p.usd, priced: { known: p.known, basis: p.basis } } : { cost_usd: unmeasuredCallUsd, unmeasured: true, priced: { known: false, basis: "estimate: no usage reported" } }),
            ...(timedOut ? { timed_out: true } : {}), ...(stopped === "call-budget" ? { stopped: "call-budget" } : {}) };
        }
        let last = null;
        if (lastFile) {
          try {
            const b = fs.readFileSync(lastFile);
            if (b.length > lastMessageCap) { send("E", `codex: the last message (${b.length} bytes) exceeds the ${lastMessageCap}-byte cap and is not returned\n`); if (exit === 0) exit = 125; rec.exit = exit; rec.output_capped = true; }
            else last = b.toString("base64");
          } catch { /* none written */ }
        }
        if (cur) running.delete(cur);
        fs.rmSync(scratch, { recursive: true, force: true });
        finish(rec, exit, last);
      });
      if (pendingIn.length) { for (const c of pendingIn) child.stdin.write(c); pendingIn.length = 0; }
      if (inEnded) child.stdin.end();
    }
    sock.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= 5) {
        const len = buf.readUInt32BE(1);
        if (len > MAX_STDIN + 1_000_000) { sock.destroy(); return; }
        if (buf.length < 5 + len) break;
        const type = buf.toString("latin1", 0, 1), body = buf.subarray(5, 5 + len);
        buf = buf.subarray(5 + len);
        if (type === "R" && !gotRequest) {
          let req; try { req = JSON.parse(body.toString("utf8")); } catch { sock.destroy(); return; }
          gotRequest = true;
          start(req).catch((e) => { try { reject(req?.argv, `relay error: ${e.message}`); } catch { sock.destroy(); } });
        } else if (type === "I") {
          stdinBytes += body.length;
          if (stdinBytes > MAX_STDIN) { if (child) child.kill("SIGKILL"); sock.destroy(); return; }
          if (child) child.stdin.write(body); else pendingIn.push(Buffer.from(body));
        } else if (type === "Z") {
          inEnded = true; if (child) child.stdin.end();
        }
      }
    });
    sock.on("close", () => { if (child && child.exitCode == null && child.signalCode == null) { try { process.kill(-child.pid, "SIGKILL"); } catch { /* gone */ } } });
    sock.on("error", () => {});
  }

  const server = net.createServer((s) => { handle(s).catch(() => s.destroy()); });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(socketPath, () => { server.off("error", reject); resolve(); }); });
  fs.chmodSync(socketPath, 0o600);

  return {
    socketPath,
    sandboxSocket: path.posix.join(SANDBOX_HOME, RELAY_DIR, RELAY_SOCK),
    codexBin: bin,
    codexHome,
    calls: () => log.slice(),
    execCalls: () => used,
    // Spend so far: finished calls plus every running call (its reported usage, or the reserve).
    costUsd: () => sumLedger() + runningCost(),
    summary() {
      const measured = ledger.filter((c) => !c.unmeasured);
      const unmeasured = ledger.length - measured.length;
      const modelUsage = {};
      for (const c of ledger) {
        if (!c.usage) continue;
        const id = c.model || "codex-unspecified";
        const u = usageForPricing(c.usage);
        const t = (modelUsage[id] ??= { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, costUSD: 0 });
        t.inputTokens += u.inputTokens; t.outputTokens += u.outputTokens; t.cacheReadInputTokens += u.cacheReadInputTokens; t.cacheCreationInputTokens += u.cacheCreationInputTokens || 0; t.costUSD += c.cost_usd || 0;
      }
      return {
        reviewer_calls: log.slice(),
        reviewer_cost_usd: ledger.length === 0 ? 0 : +sumLedger().toFixed(6),
        reviewer_cost_basis: ledger.length === 0 ? null : "estimate",
        reviewer_accounting: unmeasured ? "unmeasured" : "measured",
        reviewer_unpriced_calls: unmeasured,
        reviewer_rejected_calls: rejectedTotal,
        reviewer_wall_ms: ledger.reduce((n, c) => n + (c.wall_ms || 0), 0),
        reviewer_model_usage: modelUsage,
      };
    },
    async close() {
      closed = true;
      for (const c of live) { try { process.kill(-c.pid, "SIGKILL"); } catch { try { c.kill("SIGKILL"); } catch { /* gone */ } } }
      await new Promise((r) => server.close(() => r()));
      fs.rmSync(socketPath, { force: true });
      fs.rmSync(codexHome, { recursive: true, force: true });
    },
  };
}

// The `codex` command placed in a framework-arm job home: runs the client over the relay socket.
export function writeRelayShim(home) {
  const d = path.join(home, ".oe-shims");
  fs.mkdirSync(d, { recursive: true });
  fs.copyFileSync(CLIENT_SOURCE, path.join(d, "codex-relay-client.mjs"));
  const sock = path.posix.join(SANDBOX_HOME, RELAY_DIR, RELAY_SOCK);
  fs.writeFileSync(path.join(d, "codex"), `#!/bin/sh\nOE_RELAY_SOCK=${sock} exec node "$(dirname "$0")/codex-relay-client.mjs" "$@"\n`, { mode: 0o755 });
}
