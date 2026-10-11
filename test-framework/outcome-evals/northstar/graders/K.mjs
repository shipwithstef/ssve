// K: knowledge the model cannot have. Spec-driven and generic.
//
//   export async function grade(dir, task, spec) -> { score, checks: [{ name, pass, detail }] }
//
// A K spec (northstar/specs/<task>/K.json, template in northstar/specs/K.template.json)
// lists FACTS. Each fact is one piece of knowledge that reached the build only through
// the owner (a standing rule from an earlier session, a private domain fact, a founder
// pricing rule) and carries one deterministic check against the built artifact:
//
//   call     import a module of the build, call an export with arguments, compare the result
//   http     start the build's server, send a request, compare status / JSON / headers
//   script   run a probe script from the spec directory against the build (exit 0 = pass)
//   source   the build's source requires or forbids a pattern (use sparingly)
//
// A fact whose module is missing, whose server does not start or whose export is absent
// FAILS; an empty build scores 0. Nothing here asks a model anything.
import fs from "node:fs";
import path from "node:path";
import { check, evalExpect, finish, jsonOf, loadSpec, readText, request, resolveArgs, runCall, runScript, specDirOf, startServer, subsetMatch, walk } from "./sk-shared.mjs";

export { loadSpec };

const TYPES = {
  call: ["module", "export"],
  http: ["path"],
  script: ["file"],
  source: ["files"],
};

// Problems with a K spec, as readable strings. Empty means the spec is usable.
export function validateSpec(spec) {
  const problems = [];
  if (!spec || !Array.isArray(spec.facts) || !spec.facts.length) return ["spec.facts must be a non-empty array"];
  const ids = new Set();
  spec.facts.forEach((f, i) => {
    const at = `fact ${f?.id ?? i + 1}`;
    if (!f?.id) problems.push(`${at}: id is required`);
    else if (ids.has(f.id)) problems.push(`${at}: duplicate id`);
    else ids.add(f.id);
    if (!TYPES[f?.type]) { problems.push(`${at}: type must be one of ${Object.keys(TYPES).join(", ")}`); return; }
    for (const k of TYPES[f.type]) if (f[k] === undefined) problems.push(`${at}: ${f.type} facts need "${k}"`);
    if (f.type === "script" && f.serve && !spec.server) problems.push(`${at}: serve facts need spec.server`);
    if (f.type === "http" && !spec.server) problems.push(`${at}: http facts need spec.server`);
    if (f.type === "call" && !f.expect) problems.push(`${at}: call facts need "expect"`);
    if (f.type === "http" && !f.expect) problems.push(`${at}: http facts need "expect"`);
    if (f.type === "source" && !f.requires && !f.forbids) problems.push(`${at}: source facts need "requires" or "forbids"`);
  });
  return problems;
}

async function httpFact(srv, f) {
  const r = await request(srv.base, { method: f.method || "GET", path: f.path, body: f.body, headers: f.headers });
  const e = f.expect || {};
  const fails = [];
  if (e.status !== undefined && r.status !== e.status) fails.push(`status ${r.status || r.error}, expected ${e.status}`);
  if (e.json !== undefined && !subsetMatch(jsonOf(r), e.json)) fails.push(`body ${r.text.slice(0, 120)} does not contain ${JSON.stringify(e.json)}`);
  if (e.body_matches && !new RegExp(e.body_matches, "i").test(r.text)) fails.push(`body does not match /${e.body_matches}/`);
  for (const [h, re] of Object.entries(e.headers || {})) if (!new RegExp(re, "i").test(String(r.headers[h.toLowerCase()] ?? ""))) fails.push(`header ${h} does not match /${re}/`);
  return [!fails.length, fails.length ? fails.join("; ") : `${f.method || "GET"} ${f.path} -> ${r.status}`];
}

function sourceFact(dir, f) {
  const files = walk(dir, { skipTests: true }).filter((rel) => f.files.some((g) => rel === g || rel.startsWith(g.endsWith("/") ? g : `${g}/`)));
  const text = files.map((rel) => readText(path.join(dir, rel)) ?? "").join("\n");
  if (!files.length) return [false, `none of ${f.files.join(", ")} exist`];
  const missing = (f.requires || []).filter((p) => !new RegExp(p).test(text));
  const hit = (f.forbids || []).filter((p) => new RegExp(p).test(text));
  const fails = [...missing.map((p) => `missing /${p}/`), ...hit.map((p) => `contains forbidden /${p}/`)];
  return [!fails.length, fails.length ? fails.join("; ") : `${files.length} files satisfy the source rule`];
}

export async function grade(dir, task, spec) {
  spec ??= loadSpec(task, "K");
  const problems = validateSpec(spec);
  if (problems.length) return finish([check("spec", false, problems.join("; "))]);
  const specDir = specDirOf(task, spec);
  const checks = [];
  let srv = null; let started = false;
  try {
    const failed = new Set();
    for (const f of spec.facts) {
      const unmet = (f.depends_on || []).filter((id) => failed.has(id) || !checks.some((c) => c.name === id));
      if (unmet.length) { checks.push(check(f.id, false, `not credited: nothing to judge (${unmet.join(", ")} failed)`)); failed.add(f.id); continue; }
      const before = checks.length;
      try {
        if (f.type === "call") {
          const out = runCall(dir, { module: f.module, export: f.export, args: resolveArgs(f.args ?? [], spec.vars || {}) }, f.timeoutMs);
          if (out.error) checks.push(check(f.id, false, out.error));
          else { const [pass, detail] = evalExpect(resolveArgs(f.expect, spec.vars || {}), out); checks.push(check(f.id, pass, detail)); }
        } else if (f.type === "http") {
          if (!started) { srv = await startServer(dir, spec.server, specDir); started = true; }
          if (!srv.ok) { checks.push(check(f.id, false, srv.error)); failed.add(f.id); continue; }
          const [pass, detail] = await httpFact(srv, f);
          checks.push(check(f.id, pass, detail));
        } else if (f.type === "script") {
          let env = {};
          if (f.serve) {
            // The probe drives the running product (a browser, for instance): start it first.
            if (!started) { srv = await startServer(dir, spec.server, specDir); started = true; }
            if (!srv.ok) { checks.push(check(f.id, false, srv.error)); failed.add(f.id); continue; }
            env = { GRADE_BASE_URL: srv.base };
          }
          const r = runScript(f.file, dir, { specDir, args: f.args, timeoutMs: f.timeoutMs, env });
          checks.push(check(f.id, r.pass, r.detail));
        } else {
          const [pass, detail] = sourceFact(dir, f);
          checks.push(check(f.id, pass, detail));
        }
      } catch (e) { checks.push(check(f.id, false, `fact error: ${e.message}`)); }
      if (checks.slice(before).some((c) => !c.pass)) failed.add(f.id);
    }
  } finally { srv?.stop?.(); }
  return finish(checks);
}
