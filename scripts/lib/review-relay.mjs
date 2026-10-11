// Orchestrator relay for the eval's framework arm. The framework's adversarial review is
// cross-family (Codex) and must never fall back to a same-model reviewer. Inside the builder
// sandbox every foreign agent CLI is a shim that exits 127, so the framework's own launcher
// (scripts/run-external-review.mjs, binary `codex`) cannot run. This module is the runner-side
// answer: a unix-socket server, started per job OUTSIDE the sandbox, that executes the REAL
// `codex` found on the runner's PATH (with the runner user's normal Codex auth) for review and
// planning use only:
//   - only `codex exec`, plus the --help/--version probes the launcher makes;
//   - the sandbox is forced to read-only; write/danger flags are refused, never passed on;
//   - the working directory must be the job's build dir or a path under the job home
//     (the sandbox HOME is the job home on the host); anything else is refused;
//   - a per-call timeout and a per-job call cap; refused and probe calls do not use the cap;
//   - every call is recorded (sanitized argv, exit, wall time, usage and price) so the row can
//     charge the framework arm for its reviews.
// The client half (review-relay-client.mjs) is installed in the job home as the `codex` shim.
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
const MAX_PROBES = 60;
const MAX_LOG = 200;
const MAX_STDIN = 32 * 1024 * 1024;
export const CLIENT_SOURCE = path.join(path.dirname(fileURLToPath(import.meta.url)), "review-relay-client.mjs");

const isUnder = (p, base) => { const r = path.relative(base, p); return r === "" || (!r.startsWith("..") && !path.isAbsolute(r)); };

// --- argv vetting ---------------------------------------------------------------------

const BOOL_FLAGS = new Set(["--skip-git-repo-check", "--ephemeral", "--ignore-user-config", "--ignore-rules", "--strict-config", "--json"]);
const INFO_FLAGS = new Set(["--help", "-h", "--version", "-V"]);
// Flags that take a value, by canonical name.
const VALUE_FLAGS = { "-c": "config", "--config": "config", "-m": "model", "--model": "model", "-s": "sandbox", "--sandbox": "sandbox", "-C": "cd", "--cd": "cd", "--output-schema": "schema", "-o": "last", "--output-last-message": "last", "--color": "color" };
// Config keys a reviewer may set. Anything touching sandboxing, approvals, the shell
// environment, tools, MCP servers, hooks or profiles is refused.
const CONFIG_KEY_OK = /^(model|model_reasoning_effort|model_reasoning_summary|model_verbosity|hide_agent_reasoning|show_raw_agent_reasoning)$/;
const REFUSED_NOTE = {
  "--dangerously-bypass-approvals-and-sandbox": "write/danger flag", "--full-auto": "write/danger flag", "--yolo": "write/danger flag",
  "--approve-for-me": "write/danger flag", "--dangerously-bypass-hook-trust": "write/danger flag", "--add-dir": "writable directory", "--worktree": "creates a worktree",
};

const refuse = (reason) => ({ ok: false, reason });

// Vet the client's argv. Returns {ok, info, args, cwdArg, schema, last, model, promptChars} where
// `args` is the argv to run (after `codex`) with -s read-only enforced and the file options kept as
// the client wrote them (the server swaps the paths for scratch files).
export function vetCodexArgv(argv) {
  if (!Array.isArray(argv) || argv.some((a) => typeof a !== "string") || argv.length > 200) return refuse("malformed argv");
  if (argv.some((a) => a.length > 4_000_000)) return refuse("argument too large");
  let rest = argv;
  const lead = [];
  // `codex --version`, `codex -V`, `codex --help`, `codex help` with no exec.
  if (argv[0] !== "exec") {
    if (argv.length === 1 && (INFO_FLAGS.has(argv[0]) || argv[0] === "help")) return { ok: true, info: true, args: [...argv], cwdArg: null, schema: null, last: null, model: null, promptChars: 0 };
    return refuse("only `codex exec` is relayed (review and planning use); this CLI is otherwise blocked in the sandbox");
  }
  rest = argv.slice(1);
  const out = []; let info = false, sandboxSeen = false, cwdArg = null, schema = null, last = null, model = null, positional = 0, promptChars = 0;
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
    if (BOOL_FLAGS.has(name) && val == null) { out.push(name); continue; }
    const kind = VALUE_FLAGS[name];
    if (!kind) return refuse(`${name} is not accepted by the review relay`);
    if (val == null) { val = rest[++i]; if (val == null) return refuse(`${name} needs a value`); }
    if (kind === "sandbox") {
      if (val !== "read-only") return refuse(`-s ${val} refused: reviews run read-only`);
      sandboxSeen = true; out.push("-s", "read-only"); continue;
    }
    if (kind === "config") {
      const m = /^([A-Za-z0-9_.]+)=(.*)$/s.exec(val);
      if (!m || !CONFIG_KEY_OK.test(m[1])) return refuse(`-c ${String(val).slice(0, 60)} refused: only model and reasoning settings may be overridden`);
      if (m[1] === "model") model = m[2].replace(/^"|"$/g, "");
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
  if (!sandboxSeen) out.unshift("-s", "read-only");
  return { ok: true, info, args: ["exec", ...out], cwdArg, schema, last, model, promptChars };
}

// What the row keeps of a call: flags and values, but no prompt text.
export function sanitizeArgv(argv) {
  if (!Array.isArray(argv)) return [];
  let afterExec = false;
  return argv.slice(0, 60).map((a) => {
    const s = String(a);
    if (s === "exec") afterExec = true;
    if (afterExec && !s.startsWith("-") && s.length > 60 && s !== "exec") return `<${s.length} chars>`;
    return s.length > 200 ? `${s.slice(0, 200)}...` : s;
  });
}

// --- usage ----------------------------------------------------------------------------

// Codex prints usage as JSONL when --json is set: a `turn.completed` event carries
// usage {input_tokens, cached_input_tokens, output_tokens, reasoning_output_tokens}, the shape
// run-external-review.mjs reads as `event.usage`. A call can run more than one turn, so turn
// totals are summed; an event outside turn.completed with a usage object is used only when no
// turn reported one. Input tokens include the cached ones (provider convention), output tokens
// include reasoning. Returns null when the output has no usage (no --json, or none printed).
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
  return { input_tokens: sum("input_tokens"), cached_input_tokens: sum("cached_input_tokens"), output_tokens: sum("output_tokens"), reasoning_output_tokens: sum("reasoning_output_tokens"), observed_models: [...models] };
}

// Usage in the shape priceUsage() takes.
export function usageForPricing(u) {
  const cached = Math.min(u.cached_input_tokens || 0, u.input_tokens || 0);
  return { inputTokens: Math.max(0, (u.input_tokens || 0) - cached), cacheReadInputTokens: cached, outputTokens: u.output_tokens || 0 };
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

// First executable named `name` on pathEnv (a link is resolved so the call is stable).
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

// startRelay({ jobHome, buildDir, ... }) -> relay handle. Options:
//   codexBin       the real codex (default: first `codex` on pathEnv)
//   maxCalls       per-job cap on exec calls (default 12)
//   callTimeoutMs  per-call deadline (default 30 minutes)
//   deadlineAt     epoch ms after which no call may start and a running one is cut short
//   price(model, usage) -> {usd, known}   prices one call's usage; absent: calls carry no cost
//   confine(ctx) -> argv prefix (e.g. a bwrap command) to run codex under; ctx = {cwd, scratch}
//   env            environment for codex (default: the runner's, minus SVC_* variables)
export async function startRelay({ jobHome, buildDir, codexBin = null, pathEnv = process.env.PATH, maxCalls = DEFAULT_MAX_CALLS, callTimeoutMs = DEFAULT_CALL_TIMEOUT_MS, deadlineAt = null, price = null, confine = null, env = null } = {}) {
  if (!jobHome || !buildDir) throw new Error("startRelay needs jobHome and buildDir");
  const bin = codexBin || findOnPath("codex", pathEnv);
  if (!bin) throw new Error("no codex binary on the runner's PATH");
  const dir = path.join(jobHome, RELAY_DIR);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const socketPath = path.join(dir, RELAY_SOCK);
  fs.rmSync(socketPath, { force: true });
  const childEnv = env || Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^SVC_/.test(k) && k !== "CLAUDE_CONFIG_DIR" && k !== "OE_RELAY_SOCK"));
  const log = []; const live = new Set(); let used = 0, probes = 0, closed = false;
  const record = (r) => { if (log.length < MAX_LOG) log.push(r); };

  async function handle(sock) {
    let buf = Buffer.alloc(0), gotRequest = false, child = null, stdinBytes = 0;
    let finished = false;
    const send = (type, payload) => { if (!sock.destroyed && sock.writable) sock.write(frame(type, payload)); };
    const finish = (rec, exit, lastMessage = null) => {
      if (finished) return; finished = true;
      record(rec);
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
      if (vet.info) {
        if (probes >= MAX_PROBES) return reject(argv, "too many probe calls");
        probes++;
      } else {
        if (used >= maxCalls) return reject(argv, `review call cap reached (${maxCalls} per job)`);
        if (deadlineAt != null && Date.now() >= deadlineAt) return reject(argv, "the job's time is spent");
      }
      // Working directory: the info probes run in the job home; exec calls must be in the job.
      let cwd, mappedCd = null;
      if (vet.info) cwd = fs.realpathSync(jobHome);
      else {
        const reqCwd = typeof req.cwd === "string" ? req.cwd : "";
        cwd = mapSandboxDir(reqCwd, { jobHome, buildDir });
        if (!cwd) return reject(argv, `working directory ${reqCwd || "<none>"} is outside the job (allowed: the build dir and the job home)`);
        if (vet.cwdArg != null) {
          mappedCd = mapSandboxDir(path.resolve(reqCwd, vet.cwdArg), { jobHome, buildDir });
          if (!mappedCd) return reject(argv, `-C ${vet.cwdArg} is outside the job (allowed: the build dir and the job home)`);
        }
        used++;
      }
      const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "oe-relay-"));
      const args = [...vet.args];
      let lastFile = null;
      try {
        if (vet.schema != null) {
          if (typeof req.schema !== "string") throw new Error("--output-schema file was not provided");
          const f = path.join(scratch, "schema.json"); fs.writeFileSync(f, req.schema);
          args[args.indexOf(vet.schema, args.indexOf("--output-schema"))] = f;
        }
        if (vet.last != null) {
          lastFile = path.join(scratch, "last-message.txt");
          args[args.indexOf(vet.last, args.indexOf("--output-last-message"))] = lastFile;
        }
        if (mappedCd) args.splice(1, 0, "-C", mappedCd);
      } catch (e) { fs.rmSync(scratch, { recursive: true, force: true }); return reject(argv, e.message); }
      const prefix = confine && !vet.info ? confine({ cwd: mappedCd || cwd, scratch }) : [];
      const cmd = prefix.length ? prefix[0] : bin;
      const cmdArgs = prefix.length ? [...prefix.slice(1), bin, ...args] : args;
      const t0 = Date.now();
      let timedOut = false;
      const limit = Math.max(1, Math.min(callTimeoutMs, deadlineAt != null ? deadlineAt - Date.now() : Infinity));
      const usageLines = []; let partial = "";
      try { child = spawn(cmd, cmdArgs, { cwd, env: childEnv, stdio: ["pipe", "pipe", "pipe"], detached: true }); }
      catch (e) { fs.rmSync(scratch, { recursive: true, force: true }); return reject(argv, `cannot start codex: ${e.code || e.message}`); }
      live.add(child);
      const killGroup = (sig) => { try { process.kill(-child.pid, sig); } catch { try { child.kill(sig); } catch { /* gone */ } } };
      const timer = setTimeout(() => { timedOut = true; killGroup("SIGTERM"); setTimeout(() => killGroup("SIGKILL"), 1500).unref(); }, limit);
      const absorb = (chunk) => {
        partial += chunk.toString("utf8");
        let nl;
        while ((nl = partial.indexOf("\n")) >= 0) { const l = partial.slice(0, nl); partial = partial.slice(nl + 1); if (l.includes("\"usage\"") || l.includes("\"model\"")) usageLines.push(l.length > 20000 ? l.slice(0, 20000) : l); }
        if (partial.length > 1_000_000) partial = "";
      };
      child.stdout.on("data", (c) => { absorb(c); send("O", c); });
      child.stderr.on("data", (c) => send("E", c));
      child.stdin.on("error", () => {});
      child.on("error", (e) => send("E", `codex: ${e.code || e.message}\n`));
      child.on("close", (code, signal) => {
        clearTimeout(timer); live.delete(child);
        if (partial.includes("\"usage\"") || partial.includes("\"model\"")) usageLines.push(partial);
        let exit = code ?? (signal ? 128 + (os.constants.signals[signal] || 9) : 1);
        if (timedOut) { exit = 124; send("E", `codex: review call exceeded its ${Math.round(limit / 1000)}s limit and was stopped\n`); }
        const usage = vet.info ? null : parseCodexUsage(usageLines);
        let costUsd = null, priced = null;
        if (usage && price) {
          const model = vet.model || usage.observed_models[0] || null;
          try { const p = price(model, usageForPricing(usage)); costUsd = +p.usd.toFixed(6); priced = { model, known: p.known !== false }; } catch { /* unpriced */ }
        }
        let last = null;
        if (lastFile) { try { last = fs.readFileSync(lastFile).toString("base64"); } catch { /* none written */ } }
        fs.rmSync(scratch, { recursive: true, force: true });
        finish({ argv_sanitized: sanitizeArgv(argv), exit, wall_ms: Date.now() - t0, usage, ...(costUsd != null ? { cost_usd: costUsd, priced } : {}), ...(timedOut ? { timed_out: true } : {}), ...(vet.info ? { probe: true } : {}) }, exit, last);
      });
      // Whatever the client sent while the call was being vetted goes in now.
      if (pendingIn.length) { for (const c of pendingIn) child.stdin.write(c); pendingIn.length = 0; }
      if (inEnded) child.stdin.end();
    }
    const pendingIn = []; let inEnded = false;
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
    calls: () => log.slice(),
    execCalls: () => used,
    costUsd: () => log.reduce((n, c) => n + (c.cost_usd || 0), 0),
    summary() {
      const exec = log.filter((c) => !c.probe && !c.rejected);
      const priced = exec.filter((c) => c.cost_usd != null);
      return {
        reviewer_calls: log.slice(),
        reviewer_cost_usd: exec.length === 0 ? 0 : priced.length ? +priced.reduce((n, c) => n + c.cost_usd, 0).toFixed(6) : null,
        reviewer_unpriced_calls: exec.length - priced.length,
        reviewer_wall_ms: exec.reduce((n, c) => n + (c.wall_ms || 0), 0),
      };
    },
    async close() {
      closed = true;
      for (const c of live) { try { process.kill(-c.pid, "SIGKILL"); } catch { try { c.kill("SIGKILL"); } catch { /* gone */ } } }
      await new Promise((r) => server.close(() => r()));
      fs.rmSync(socketPath, { force: true });
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
