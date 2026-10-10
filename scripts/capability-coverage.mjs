#!/usr/bin/env node
/**
 * capability-coverage.mjs — one row for everything the framework ships, with how (and
 * whether) its value is measured.
 *
 *   node scripts/capability-coverage.mjs build    # add rows for new units, drop rows for removed ones
 *   node scripts/capability-coverage.mjs check    # problems, exit 1 if any
 *   node scripts/capability-coverage.mjs summary  # counts by kind and status
 *   node scripts/capability-coverage.mjs html <out.html>
 *
 * Units come from the repository, not from memory:
 *   skill   every skills-manifest.json includedSkills entry
 *   agent   every agents/*.md
 *   engine  every scripts/*.mjs and scripts/lib/*.mjs over 5 KB, and scripts/orch/*.mjs
 *   hook    every hook id in hooks/hooks.json
 *   claim   hand-entered: the framework's claims about itself (CAPABILITIES.md, FRAMEWORK-STATE.md)
 * `build` never touches hand-entered fields (mechanism, status, evidence, next_eval, value,
 * note); it only adds rows for new units and removes rows whose unit no longer exists.
 *
 * Status (skills, agents, claims):
 *   gain-measured     an established gain against a bare or prior arm
 *   no-gain-measured  measured; no gain, or a loss
 *   ceiling           measured; the bare model already succeeds, so the unit cannot show value there
 *   structural-only   only format/contract validators; no outcome measured
 *   unmeasured        nothing measures it
 * Engines and hooks are infrastructure: `tested` when a tier-1 validator names them
 * (detected), `untested` otherwise.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isMain } from "./lib/is-main.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "references", "capability-coverage.json");
const TIER1 = path.join(ROOT, "test-framework", "evals", "tier-1");
export const OUTCOME_STATUSES = ["gain-measured", "no-gain-measured", "ceiling", "structural-only", "unmeasured"];
export const INFRA_STATUSES = ["tested", "untested"];
const HAND = ["mechanism", "status", "evidence", "next_eval", "value", "note", "claim"];

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const exists = (p) => fs.existsSync(path.join(ROOT, p));

export function discoverUnits(root = ROOT) {
  const r = (p) => fs.readFileSync(path.join(root, p), "utf8");
  const units = [];
  for (const s of JSON.parse(r("skills-manifest.json")).includedSkills) units.push({ id: `skill:${s}`, kind: "skill", source: `skills/${s}/SKILL.md` });
  for (const f of fs.readdirSync(path.join(root, "agents")).filter((f) => f.endsWith(".md")).sort()) units.push({ id: `agent:${f.replace(/\.md$/, "")}`, kind: "agent", source: `agents/${f}` });
  for (const dir of ["scripts", "scripts/lib", "scripts/orch"]) {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs).filter((f) => f.endsWith(".mjs") && !f.endsWith(".test.mjs")).sort()) {
      const rel = `${dir}/${f}`;
      if (dir !== "scripts/orch" && fs.statSync(path.join(root, rel)).size <= 5120) continue;
      units.push({ id: `engine:${rel}`, kind: "engine", source: rel });
    }
  }
  const hooks = JSON.parse(r("hooks/hooks.json")).hooks || {};
  const seen = new Set();
  for (const [event, list] of Object.entries(hooks)) for (const h of list) {
    const id = h.id || h.command;
    if (seen.has(id)) continue;
    seen.add(id);
    units.push({ id: `hook:${id}`, kind: "hook", source: "hooks/hooks.json", event, command: h.command });
  }
  return units;
}

// A test that names a file (by basename) counts as a test of it: tier-1 validators,
// test-framework/tests, and co-located *.test.mjs files.
function tier1Index(root = ROOT) {
  const out = [];
  for (const dir of ["test-framework/evals/tier-1", "test-framework/tests", "scripts/orch", "scripts", "hooks"]) {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs)) {
      const isTest = dir.startsWith("test-framework") ? /\.(sh|mjs)$/.test(f) : /\.test\.mjs$/.test(f);
      if (isTest && fs.statSync(path.join(abs, f)).isFile()) out.push({ f: `${dir}/${f}`, text: fs.readFileSync(path.join(abs, f), "utf8") });
    }
  }
  return out;
}
const testsNaming = (index, base) => index.filter((t) => t.text.includes(base) || path.basename(t.f) === base.replace(/\.mjs$/, ".test.mjs")).map((t) => t.f).slice(0, 3);

export function build(existing = load()) {
  const byId = new Map(existing.rows.map((r) => [r.id, r]));
  const index = tier1Index();
  const rows = [];
  for (const u of discoverUnits()) {
    const prev = byId.get(u.id) || {};
    const row = { ...u, ...Object.fromEntries(HAND.filter((k) => prev[k] !== undefined).map((k) => [k, prev[k]])) };
    if (u.kind === "engine" || u.kind === "hook") {
      const base = path.basename(u.kind === "hook" ? (u.command.match(/[\w./-]+\.(?:mjs|sh)/)?.[0] || u.id) : u.source);
      const tests = testsNaming(index, base);
      row.status = tests.length ? "tested" : "untested";
      row.evidence = tests;
    } else {
      row.status ??= "unmeasured";
      row.evidence ??= [];
    }
    rows.push(row);
    byId.delete(u.id);
  }
  // Hand-entered claim rows have no unit on disk; keep them.
  for (const r of byId.values()) if (r.kind === "claim") rows.push(r);
  return { version: 1, purpose: existing.purpose || "Every unit the framework ships, with how its value is measured. Built by scripts/capability-coverage.mjs; checked by tier-1 validate-capability-coverage.mjs.", rows };
}

export function load() {
  return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { rows: [] };
}

export function check(data = load(), { claimsFile = "references/claims.json", ledger = "docs/analysis/owner-requirements-2026-10-10.md" } = {}) {
  const problems = [];
  const ids = new Set(data.rows.map((r) => r.id));
  for (const u of discoverUnits()) if (!ids.has(u.id)) problems.push(`${u.id}: no row (run: node scripts/capability-coverage.mjs build)`);
  const units = new Set(discoverUnits().map((u) => u.id));
  const claimIds = new Set(JSON.parse(read(claimsFile)).claims.map((c) => c.id));
  for (const r of data.rows) {
    if (r.kind !== "claim" && !units.has(r.id)) problems.push(`${r.id}: row for a unit that no longer exists`);
    const allowed = r.kind === "engine" || r.kind === "hook" ? INFRA_STATUSES : OUTCOME_STATUSES;
    if (!allowed.includes(r.status)) problems.push(`${r.id}: status ${r.status} not one of ${allowed.join(", ")}`);
    for (const e of r.evidence || []) {
      if (e.startsWith("claim:")) { if (!claimIds.has(e.slice(6))) problems.push(`${r.id}: unknown claim ${e}`); }
      else if (!exists(e.split("#")[0])) problems.push(`${r.id}: evidence ${e} does not exist`);
    }
    if (["gain-measured", "no-gain-measured", "ceiling"].includes(r.status) && !(r.evidence || []).length) problems.push(`${r.id}: ${r.status} without evidence`);
    if (["unmeasured", "structural-only", "untested"].includes(r.status) && !r.next_eval) problems.push(`${r.id}: ${r.status} without next_eval`);
    if (r.kind === "claim" && !r.claim) problems.push(`${r.id}: claim row without claim text`);
  }
  // Derived infrastructure status must be current: a stale map hides a new or lost test.
  {
    const fresh = new Map(build(data).rows.map((r) => [r.id, r.status]));
    for (const r of data.rows) if ((r.kind === "engine" || r.kind === "hook") && fresh.has(r.id) && fresh.get(r.id) !== r.status) problems.push(`${r.id}: status ${r.status} is stale (now ${fresh.get(r.id)}); run build`);
  }
  // The owner's request ledger must only cite files that exist.
  if (exists(ledger)) for (const m of read(ledger).matchAll(/`([\w./-]+\.(?:mjs|md|json|sh|html))`/g)) {
    const p = m[1];
    if (p.includes("/") && !exists(p) && !exists(`scripts/${p}`)) problems.push(`${ledger}: cites ${p}, which does not exist`);
  }
  return problems;
}

export function summary(data = load()) {
  const out = {};
  for (const r of data.rows) { out[r.kind] ??= {}; out[r.kind][r.status] = (out[r.kind][r.status] || 0) + 1; }
  return out;
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export function html(data = load()) {
  const s = summary(data);
  const kinds = ["claim", "skill", "agent", "engine", "hook"];
  const order = ["gain-measured", "no-gain-measured", "ceiling", "structural-only", "unmeasured", "tested", "untested"];
  const rows = [...data.rows].sort((a, b) => kinds.indexOf(a.kind) - kinds.indexOf(b.kind) || order.indexOf(a.status) - order.indexOf(b.status) || a.id.localeCompare(b.id));
  const tr = rows.map((r) => `<tr data-kind="${esc(r.kind)}" data-status="${esc(r.status)}"><td>${esc(r.kind)}</td><td><code>${esc(r.id.replace(/^\w+:/, ""))}</code>${r.claim ? `<div class="claim">${esc(r.claim)}</div>` : ""}</td><td><span class="st ${esc(r.status)}">${esc(r.status)}</span></td><td>${esc(r.mechanism || "")}</td><td>${(r.evidence || []).map((e) => `<div><code>${esc(e)}</code></div>`).join("")}${r.note ? `<div class="note">${esc(r.note)}</div>` : ""}</td><td>${esc(r.next_eval || "")}</td></tr>`).join("\n");
  const cards = kinds.filter((k) => s[k]).map((k) => `<div class="card"><h2>${k}s</h2>${Object.entries(s[k]).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])).map(([st, n]) => `<div><span class="st ${st}">${st}</span> ${n}</div>`).join("")}</div>`).join("");
  // Page content only: the artifact host wraps it in a document skeleton.
  return `<title>Capability Coverage</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono:wght@400&display=swap">
<style>
/* Ledger layout: summary of status per kind first, then one filterable table of every unit. */
:root{--bg:#f7f6f2;--fg:#1f1e1b;--mut:#66625a;--line:#e2ddd2;--card:#fffefb;--gain:#1f7a4d;--nogain:#a33b2b;--ceil:#8a6d1d;--struct:#41558a;--un:#7a4b8a;--sans:"IBM Plex Sans",system-ui,sans-serif;--mono:"IBM Plex Mono",ui-monospace,monospace}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#151513;--fg:#ecebe6;--mut:#a39f96;--line:#2d2c28;--card:#1c1b19;--gain:#5cc394;--nogain:#e2826f;--ceil:#d9b85a;--struct:#93a6db;--un:#c79ad8;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#151513;--fg:#ecebe6;--mut:#a39f96;--line:#2d2c28;--card:#1c1b19;--gain:#5cc394;--nogain:#e2826f;--ceil:#d9b85a;--struct:#93a6db;--un:#c79ad8;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:15px/1.5 var(--sans);padding-inline:16px;padding-block:20px}
main{max-width:1200px;margin:0 auto;display:grid;gap:16px}h1{font-size:24px;margin:0;text-wrap:balance}p{color:var(--mut);margin:0;max-width:70ch}
.cards{display:flex;flex-wrap:wrap;gap:12px}.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 14px;min-width:150px;display:grid;gap:4px}.card h2{margin:0;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:var(--mut)}
.card div{display:flex;justify-content:space-between;gap:12px;font-variant-numeric:tabular-nums}
.filters{display:flex;flex-wrap:wrap;gap:8px}select,input{background:var(--card);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:6px 8px;font:inherit}select:focus-visible,input:focus-visible{outline:2px solid var(--struct);outline-offset:1px}
.wrap{overflow-x:auto;min-width:0}table{border-collapse:collapse;width:100%;background:var(--card)}td,th{border-bottom:1px solid var(--line);padding:6px 8px;vertical-align:top;text-align:left;font-size:13px}th{font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--mut)}code{font:12px/1.4 var(--mono);word-break:break-all}
.st{display:inline-block;border-radius:999px;padding:0 8px;font-size:12px;border:1px solid currentColor;white-space:nowrap}.gain-measured{color:var(--gain)}.no-gain-measured{color:var(--nogain)}.ceiling{color:var(--ceil)}.structural-only,.tested{color:var(--struct)}.unmeasured,.untested{color:var(--un)}
.claim,.note{color:var(--mut);margin-top:2px}
</style>
<main><h1>Capability coverage</h1><p>Every skill, agent, engine, hook and self-claim in the framework, with how its value is measured and what evaluates it next. Generated from the repository by <code>scripts/capability-coverage.mjs</code>: ${data.rows.length} rows.</p>
<div class="cards">${cards}</div>
<div class="filters"><select id="k" aria-label="Kind"><option value="">All kinds</option>${kinds.map((k) => `<option>${k}</option>`).join("")}</select><select id="s" aria-label="Status"><option value="">All statuses</option>${order.map((k) => `<option>${k}</option>`).join("")}</select><input id="q" placeholder="Search units, evidence, next steps" aria-label="Search"></div>
<div class="wrap"><table><thead><tr><th>Kind</th><th>Unit</th><th>Status</th><th>Mechanism</th><th>Evidence</th><th>Next evaluation</th></tr></thead><tbody>${tr}</tbody></table></div></main>
<script>const k=document.getElementById("k"),s=document.getElementById("s"),q=document.getElementById("q");function f(){for(const tr of document.querySelectorAll("tbody tr")){tr.hidden=!!((k.value&&tr.dataset.kind!==k.value)||(s.value&&tr.dataset.status!==s.value)||(q.value&&!tr.textContent.toLowerCase().includes(q.value.toLowerCase())));}}[k,s,q].forEach(e=>e.addEventListener("input",f));</script>
`;
}

function main(argv) {
  const cmd = argv[0];
  if (cmd === "build") {
    const data = build();
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n");
    process.stdout.write(JSON.stringify(summary(data)) + "\n");
    return 0;
  }
  if (cmd === "check") {
    const problems = check();
    for (const p of problems) process.stderr.write(p + "\n");
    process.stdout.write(problems.length ? `capability-coverage: ${problems.length} problem(s)\n` : `capability-coverage: ${load().rows.length} rows, complete\n`);
    return problems.length ? 1 : 0;
  }
  if (cmd === "summary") { process.stdout.write(JSON.stringify(summary(), null, 2) + "\n"); return 0; }
  if (cmd === "html") { fs.writeFileSync(argv[1], html()); return 0; }
  process.stderr.write("usage: capability-coverage.mjs build | check | summary | html <out>\n");
  return 2;
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
