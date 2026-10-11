// Child process used by the K and S graders: import one module of the build, call one
// export, report the outcome. stdin: the run's nonce on the first line, then the request
//   { module: "src/refunds.mjs", export: "refundFor", args: [...] }
// The nonce is consumed before the build is imported. The outcome goes to fd 3 behind the
// nonce (see spawnRunner in sk-shared.mjs); stdout is the build's and is never trusted.
// Runs with the build directory as cwd. Never imported by the grader itself.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

let input = "";
for await (const chunk of process.stdin) input += chunk;
const nl = input.indexOf("\n");
const NONCE = input.slice(0, nl).trim();
const req = JSON.parse(input.slice(nl + 1));
const out = (o) => { fs.writeSync(3, `${NONCE}\t${JSON.stringify(o)}\n`); process.exit(); };
async function run() {
  const m = await import(pathToFileURL(path.resolve(process.cwd(), req.module)).href);
  const fn = req.export === "default" ? m.default : m[req.export];
  if (typeof fn !== "function") return { error: `export "${req.export}" is not a function in ${req.module}` };
  let value;
  try { value = await fn(...req.args); } catch (e) { return { threw: String(e?.message ?? e) }; }
  if (value === undefined) return { value: null };
  if (typeof value === "number" && !Number.isFinite(value)) return { value: String(value) };
  return { value };
}
try { out(await run()); } catch (e) { out({ error: `could not load ${req.module}: ${String(e?.message ?? e).split("\n")[0]}` }); }
