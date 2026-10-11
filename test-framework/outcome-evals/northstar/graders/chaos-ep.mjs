// Runs scripts/chaos-probe.mjs in its own process, inside the grader's jail, so the grader can
// kill it at a hard deadline. Before the probe loads, every request is given a time limit
// and every body read a byte cap, and every process the probe starts is tracked and killed
// when this process ends or is told to stop.
//   node chaos-ep.mjs <spec.json>      (cwd = the build copy)  prints one JSON line
import cp from "node:child_process";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REQUEST_MS = 5000, BODY_BYTES = 1_000_000;
const kids = new Set();
const realSpawn = cp.spawn;
cp.spawn = (...a) => { const c = realSpawn(...a); kids.add(c); return c; };
syncBuiltinESMExports();
const killAll = () => { for (const c of kids) { try { process.kill(-c.pid, "SIGKILL"); } catch {} try { c.kill("SIGKILL"); } catch {} } };
process.on("exit", killAll);
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => { killAll(); process.exit(143); });

const realFetch = globalThis.fetch;
globalThis.fetch = (u, o = {}) => realFetch(u, { ...o, signal: o.signal ?? AbortSignal.timeout(REQUEST_MS) });
Response.prototype.arrayBuffer = async function () {
  const reader = this.body?.getReader();
  const parts = []; let total = 0;
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value); total += value.length;
    if (total > BODY_BYTES) { await reader.cancel().catch(() => {}); break; }
  }
  const buf = Buffer.concat(parts);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
};

const spec = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const root = spec.__scripts_root;
delete spec.__scripts_root;
try {
  const { probe } = await import(pathToFileURL(path.join(root, "chaos-probe.mjs")).href);
  const r = await probe(process.cwd(), spec);
  process.stdout.write(`\n${JSON.stringify({ ok: true, ...r })}\n`, () => process.exit(0));
} catch (e) {
  process.stdout.write(`\n${JSON.stringify({ ok: false, error: String(e.message).slice(0, 200) })}\n`, () => process.exit(0));
}
