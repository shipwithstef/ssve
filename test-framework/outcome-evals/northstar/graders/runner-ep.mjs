// One grader case in its own process: `node runner-ep.mjs <case.json>` with the build as cwd.
// A case is a list of steps over the build's exported functions (and, for servers, HTTP
// requests). Specs are written by the grader author, so `$js` expressions in them are trusted
// code; the build under test is the only untrusted party, and it runs here, in a child.
//
//   { module, env, steps: [
//     { op: "call", fn, module?, args: [...], expect: "ok"|"throws"|"clean"|"any",
//       errorMatch?, crash?: ["TypeError", ...], save?, equals?, assert?: "expr" | ["expr"] },
//     { op: "listen", target: "srv", save: "base" },
//     { op: "http", method, path, body?, status?: n | [lo, hi], save?, assert? },
//     { op: "eval", js } , { op: "assert", js } ] }
//
// In expressions: `v` is the saved variables, `r` the step's result (or the thrown error).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const kase = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const vars = {};
const servers = [];
const modules = new Map();

async function load(name) {
  const rel = name || kase.module;
  if (!rel) throw new Error("no module named for this step");
  if (!modules.has(rel)) modules.set(rel, await import(pathToFileURL(path.resolve(rel)).href));
  return modules.get(rel);
}
const evalJs = (code, r) => new AsyncFunction("v", "r", `return (${code});`)(vars, r);
async function resolve(x) {
  if (Array.isArray(x)) return Promise.all(x.map(resolve));
  if (x && typeof x === "object") {
    if ("$js" in x) return evalJs(x.$js);
    if ("$var" in x) return vars[x.$var];
    const o = {};
    for (const k of Object.keys(x)) o[k] = await resolve(x[k]);
    return o;
  }
  return x;
}
const asserts = async (step, r) => {
  for (const expr of [].concat(step.assert || [])) if (!(await evalJs(expr, r))) throw new Error(`assertion failed: ${expr}`);
};
const describe = (e) => `${e?.name || "Error"}: ${String(e?.message ?? e).slice(0, 140)}`;

async function run(step) {
  const op = step.op || "call";
  if (op === "eval") { await evalJs(step.js); return; }
  if (op === "assert") { if (!(await evalJs(step.js))) throw new Error(`assertion failed: ${step.js}`); return; }
  if (op === "listen") {
    const srv = vars[step.target];
    if (!srv || typeof srv.listen !== "function") throw new Error(`"${step.target}" is not a server`);
    await new Promise((res, rej) => { srv.once("error", rej); srv.listen(0, "127.0.0.1", res); });
    servers.push(srv);
    vars[step.save || "base"] = `http://127.0.0.1:${srv.address().port}`;
    return;
  }
  if (op === "http") {
    const url = (vars.base || "") + (step.path || "/");
    const res = await fetch(url, { method: step.method || "GET", body: step.body, headers: step.headers, signal: AbortSignal.timeout(5000) });
    // At most one megabyte is read, whatever the build streams.
    let text = ""; { const reader = res.body?.getReader(); let n = 0; const parts = []; while (reader) { const { done, value } = await reader.read(); if (done) break; parts.push(value); n += value.length; if (n > 1_000_000) { await reader.cancel().catch(() => {}); break; } } text = Buffer.concat(parts).toString("utf8"); }
    let json; try { json = JSON.parse(text); } catch {}
    const r = { status: res.status, text, json };
    if (step.save) vars[step.save] = r;
    if (step.status !== undefined) {
      const [lo, hi] = Array.isArray(step.status) ? step.status : [step.status, step.status];
      if (r.status < lo || r.status > hi) throw new Error(`${step.method || "GET"} ${step.path} answered ${r.status}, wanted ${lo === hi ? lo : `${lo}-${hi}`}`);
    }
    await asserts(step, r);
    return;
  }
  const m = await load(step.module);
  const fn = m[step.fn];
  if (typeof fn !== "function") throw new Error(`the module does not export ${step.fn}()`);
  const args = await resolve(step.args || []);
  let out, threw = null;
  try { out = await fn(...args); } catch (e) { threw = e; }
  const crash = step.crash || ["TypeError", "ReferenceError"];
  const expect = step.expect || "ok";
  const crashed = threw && (!(threw instanceof Error) || crash.includes(threw.name));
  if (expect === "ok" && threw) throw new Error(`${step.fn}() threw ${describe(threw)}`);
  if (expect === "throws") {
    if (!threw) throw new Error(`${step.fn}() should have thrown`);
    if (crashed) throw new Error(`${step.fn}() crashed instead of rejecting cleanly: ${describe(threw)}`);
    if (step.errorMatch && !new RegExp(step.errorMatch, "i").test(threw.message)) throw new Error(`${step.fn}() threw ${describe(threw)}, wanted /${step.errorMatch}/`);
  }
  if (expect === "clean" && crashed) throw new Error(`${step.fn}() crashed: ${describe(threw)}`);
  if (step.save) vars[step.save] = threw ?? out;
  if (step.equals !== undefined && !threw) {
    try { assert.deepStrictEqual(out, step.equals); } catch { throw new Error(`${step.fn}() returned ${JSON.stringify(out)?.slice(0, 160)}, wanted ${JSON.stringify(step.equals).slice(0, 160)}`); }
  }
  await asserts(step, threw ?? out);
}

let result;
try {
  for (const [i, step] of kase.steps.entries()) {
    try { await run(step); } catch (e) { result = { ok: false, detail: `step ${i + 1}${step.fn ? ` (${step.fn})` : step.op ? ` (${step.op})` : ""}: ${describe(e)}` }; break; }
  }
  result ??= { ok: true, detail: "ok" };
} catch (e) { result = { ok: false, detail: describe(e) }; }
for (const s of servers) { try { s.closeAllConnections?.(); s.close(); } catch {} }
process.stdout.write(`\n${JSON.stringify(result)}\n`, () => process.exit(0));
