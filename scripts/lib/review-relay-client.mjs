#!/usr/bin/env node
// Client half of the eval's reviewer relay. It is copied into a framework-arm job home as the
// `codex` command, so inside the builder sandbox `codex ...` reaches the runner over a unix
// socket instead of exiting 127. It sends its argv, working directory and stdin, streams
// stdout and stderr back, writes the --output-last-message file the server read for it, and
// exits with the real exit code. Only node builtins: it runs from a bare job home.
//
// Frames (both ways): 1 type byte, u32 big-endian length, payload.
//   client to server  R request JSON {argv, cwd, schema}   I stdin bytes   Z end of stdin
//   server to client  O stdout bytes   E stderr bytes   F final JSON {exit, last_message}
//                     C capture-preflight result JSON {port, nonce, models_hits, bodies[base64]}:
//                       the runner ran the capture itself; this client replays what codex wrote to the
//                       capture server the sandbox-side framework opened (127.0.0.1:port), as codex would
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";

const SOCK = process.env.OE_RELAY_SOCK;
const fail = (msg, code = 127) => { process.stderr.write(`codex: ${msg}\n`); process.exit(code); };
if (!SOCK) fail("reviewer relay is not configured in this sandbox (codex is blocked here)");

function frame(type, payload) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const head = Buffer.alloc(5);
  head.write(type, 0, 1, "latin1");
  head.writeUInt32BE(body.length, 1);
  return Buffer.concat([head, body]);
}

// Flag value of --output-schema (or --output-schema=...) so its file contents can travel with the call.
function optionValue(argv, long) {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === long) return argv[i + 1] ?? null;
    if (argv[i].startsWith(`${long}=`)) return argv[i].slice(long.length + 1);
  }
  return null;
}
function optionValueShort(argv, long, short) {
  return optionValue(argv, long) ?? (() => { const i = argv.indexOf(short); return i >= 0 ? (argv[i + 1] ?? null) : null; })();
}

const argv = process.argv.slice(2);
let schema = null;
const schemaPath = optionValue(argv, "--output-schema");
if (schemaPath) { try { schema = fs.readFileSync(path.resolve(process.cwd(), schemaPath), "utf8"); } catch (e) { fail(`cannot read --output-schema file: ${e.code || e.message}`, 2); } }
const lastPath = optionValueShort(argv, "--output-last-message", "-o");

const sock = net.createConnection(SOCK);
let buf = Buffer.alloc(0);
let done = false;
let capture = null;
// Replay a capture result to the sandbox-side capture server, in order: /models once, then each request body.
async function replayCapture(c) {
  const base = `/ssve-capture/${c.nonce}/v1`;
  const call = (method, p, body) => new Promise((resolve) => {
    const rq = http.request({ hostname: "127.0.0.1", port: c.port, path: base + p, method, headers: body ? { "content-type": "application/json", "content-length": body.length } : {} }, (rs) => { rs.resume(); rs.on("end", resolve); });
    rq.on("error", resolve); rq.end(body);
  });
  if (c.models_hits > 0) await call("GET", "/models");
  for (const b of c.bodies || []) await call("POST", "/responses", Buffer.from(b, "base64"));
}
sock.on("error", (e) => { if (!done) fail(`reviewer relay unavailable (${e.code || e.message})`); });
sock.on("connect", () => {
  sock.write(frame("R", JSON.stringify({ argv, cwd: process.cwd(), schema })));
  if (process.stdin.isTTY) { sock.write(frame("Z", "")); return; }
  process.stdin.on("data", (c) => sock.write(frame("I", c)));
  process.stdin.on("end", () => sock.write(frame("Z", "")));
  process.stdin.on("error", () => sock.write(frame("Z", "")));
});
sock.on("data", (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  while (buf.length >= 5) {
    const len = buf.readUInt32BE(1);
    if (buf.length < 5 + len) break;
    const type = buf.toString("latin1", 0, 1);
    const body = buf.subarray(5, 5 + len);
    buf = buf.subarray(5 + len);
    if (type === "O") process.stdout.write(body);
    else if (type === "E") process.stderr.write(body);
    else if (type === "C") { try { capture = JSON.parse(body.toString("utf8")); } catch { /* ignored */ } }
    else if (type === "F") {
      done = true;
      let fin = {};
      try { fin = JSON.parse(body.toString("utf8")); } catch { /* treated as a failure below */ }
      if (fin.last_message != null && lastPath) {
        try { const p = path.resolve(process.cwd(), lastPath); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, Buffer.from(fin.last_message, "base64")); }
        catch (e) { process.stderr.write(`codex: cannot write ${lastPath}: ${e.code || e.message}\n`); }
      }
      sock.end();
      // Let stdout and stderr drain before exiting with the relayed code.
      const exitNow = () => process.stdout.write("", () => process.stderr.write("", () => process.exit(Number.isInteger(fin.exit) ? fin.exit : 1)));
      if (capture) replayCapture(capture).then(exitNow, exitNow); else exitNow();
    }
  }
});
sock.on("close", () => { if (!done) fail("reviewer relay closed the connection before the call finished", 1); });
