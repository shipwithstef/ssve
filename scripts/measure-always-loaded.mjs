#!/usr/bin/env node
/**
 * measure-always-loaded — deterministic report of the context svc adds to a
 * model's turn, so slimming work is measured instead of asserted.
 *
 * Sections (chars; tokens are a chars/4 ESTIMATE, not a tokenizer count):
 *   per_turn.skill_descriptions  model-invocable skill descriptions (Claude lists
 *                                these every turn; disable-model-invocation skips)
 *   per_turn.agent_descriptions  agents/*.md descriptions (subagent type listing)
 *   per_turn.always_rules        rulesRegistry auto_inject:"always" rule files
 *   per_session.rule_injection   replays a fixed event corpus through the REAL
 *                                hooks/svc-rule-injector.mjs (fresh session per
 *                                event, hermetic HOME) and sums injected text
 *
 * Usage: node scripts/measure-always-loaded.mjs [--root DIR] [--corpus FILE]
 *          [--no-injection] [--json] [--compare BASELINE.json]
 * --compare prints a before/after delta against an earlier --json output.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(HERE, "..");

function parseArgs(argv) {
  const o = { root: DEFAULT_ROOT, corpus: null, injection: true, json: false, compare: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") o.json = true;
    else if (a === "--no-injection") o.injection = false;
    else if (a === "--help" || a === "-h") o.help = true;
    else if (["--root", "--corpus", "--compare"].includes(a)) {
      const v = argv[++i];
      if (!v || v.startsWith("--")) throw new Error(`${a} requires a value`);
      o[a.slice(2)] = v;
    } else throw new Error(`unknown option: ${a}`);
  }
  o.root = path.resolve(o.root);
  o.corpus = path.resolve(o.corpus || path.join(o.root, "test-framework/fixtures/always-loaded/events.json"));
  return o;
}

/** Frontmatter description (folded or inline), normalized like measure-skill-budget. */
export function frontmatter(text) {
  const t = text.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const fm = t.match(/^---\n([\s\S]*?)\n---(?:\n|$)/)?.[1];
  if (fm === undefined) return null;
  const desc = fm.match(/^description:\s*([\s\S]*?)(?=^\w[\w-]*:|(?![\s\S]))/m)?.[1].trim() || "";
  return { desc: desc.replace(/^[>|][-+]?\s*/, "").replace(/\s+/g, " ").trim(),
    dmi: /^disable-model-invocation:\s*true\s*(?:#.*)?$/m.test(fm) };
}

export function skillDescriptions(root) {
  const m = JSON.parse(fs.readFileSync(path.join(root, "skills-manifest.json"), "utf8"));
  const rows = [];
  for (const name of m.includedSkills) {
    const file = path.join(root, "skills", name, "SKILL.md");
    const f = fs.existsSync(file) ? frontmatter(fs.readFileSync(file, "utf8")) : null;
    if (!f) throw new Error(`unreadable skill frontmatter: ${name}`);
    rows.push({ name, chars: f.desc.length, dmi: f.dmi });
  }
  const active = rows.filter((r) => !r.dmi);
  return { skills: rows.length, active: active.length, chars: active.reduce((s, r) => s + r.chars, 0),
    largest: [...active].sort((a, b) => b.chars - a.chars || a.name.localeCompare(b.name)).slice(0, 10) };
}

export function agentDescriptions(root) {
  const dir = path.join(root, "agents");
  let chars = 0; let n = 0;
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []) {
    if (!f.endsWith(".md") || f === "README.md") continue;
    const fm = frontmatter(fs.readFileSync(path.join(dir, f), "utf8"));
    if (fm) { chars += fm.desc.length; n++; }
  }
  return { agents: n, chars };
}

export function alwaysRules(root) {
  const m = JSON.parse(fs.readFileSync(path.join(root, "skills-manifest.json"), "utf8"));
  const rows = m.rulesRegistry.entries.filter((e) => e.auto_inject === "always")
    .map((e) => ({ path: e.path, chars: fs.readFileSync(path.join(root, e.path), "utf8").length }));
  return { rules: rows.length, chars: rows.reduce((s, r) => s + r.chars, 0), rows };
}

/** Fixture repos are created fresh so marker-gated rules see a known repo shape. */
function makeFixture(base, name, files) {
  const dir = path.join(base, name);
  for (const [rel, body] of Object.entries(files || {})) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body); // fixture source files only
  }
  fs.mkdirSync(dir, { recursive: true });
  spawnSync("git", ["init", "-q", dir]);
  // The injector only acts inside an svc-governed repo (an empty marker dir).
  fs.mkdirSync(path.join(dir, ".svc"), { recursive: true });
  return dir;
}

export function ruleInjection(root, corpusFile) {
  const corpus = JSON.parse(fs.readFileSync(corpusFile, "utf8"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "svc-always-loaded-"));
  try {
    const home = path.join(tmp, "home"); fs.mkdirSync(home, { mode: 0o700 });
    const repos = {};
    for (const [name, files] of Object.entries(corpus.repos || {})) repos[name] = makeFixture(tmp, name, files);
    const events = [];
    let i = 0;
    for (const ev of corpus.events) {
      const cwd = repos[ev.repo];
      if (!cwd) throw new Error(`event ${ev.id}: unknown repo ${ev.repo}`);
      const payload = { hook_event_name: ev.event || "PreToolUse", tool_name: ev.tool, tool_input: ev.input,
        session_id: `always-loaded-${process.pid}-${i++}`, cwd };
      const r = spawnSync(process.execPath, [path.join(root, "hooks/svc-rule-injector.mjs")], {
        input: JSON.stringify(payload), encoding: "utf8", cwd, timeout: 15000,
        env: { PATH: process.env.PATH, HOME: home, SVC_HOST: "claude", TMPDIR: tmp },
      });
      let ctx = "";
      try { ctx = r.stdout.trim() ? JSON.parse(r.stdout).hookSpecificOutput.additionalContext || "" : ""; } catch { ctx = ""; }
      const rules = [...ctx.matchAll(/^--- (rules\/\S+) ---$/gm)].map((x) => x[1]);
      const pointers = (ctx.match(/Also applicable \(Read before relying\): (.*)/)?.[1] || "").split(", ").filter(Boolean);
      events.push({ id: ev.id, relevant: ev.relevant || [], rules: [...rules, ...pointers], chars: ctx.length,
        irrelevant: [...rules, ...pointers].filter((p) => !(ev.relevant || []).includes(p)) });
    }
    return { events: events.length, chars: events.reduce((s, e) => s + e.chars, 0),
      irrelevant_injections: events.reduce((s, e) => s + e.irrelevant.length, 0), rows: events };
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

export function report(o) {
  const skills = skillDescriptions(o.root);
  const agents = agentDescriptions(o.root);
  const rules = alwaysRules(o.root);
  const perTurn = skills.chars + agents.chars + rules.chars;
  const out = { per_turn: { skill_descriptions: skills, agent_descriptions: agents, always_rules: rules,
    total_chars: perTurn, est_tokens: Math.round(perTurn / 4) } };
  if (o.injection) out.per_session = { rule_injection: ruleInjection(o.root, o.corpus) };
  return out;
}

function delta(before, after) {
  const pick = (r) => ({ skills: r.per_turn.skill_descriptions.chars, agents: r.per_turn.agent_descriptions.chars,
    always_rules: r.per_turn.always_rules.chars, per_turn_total: r.per_turn.total_chars,
    injection: r.per_session?.rule_injection?.chars ?? null,
    irrelevant: r.per_session?.rule_injection?.irrelevant_injections ?? null });
  const a = pick(before); const b = pick(after); const rows = {};
  for (const k of Object.keys(a)) rows[k] = { before: a[k], after: b[k], saved: a[k] === null || b[k] === null ? null : a[k] - b[k] };
  return rows;
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  let o;
  try { o = parseArgs(process.argv.slice(2)); } catch (e) { console.error(`measure-always-loaded: ${e.message}`); process.exit(2); }
  if (o.help) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").match(/\/\*\*([\s\S]*?)\*\//)[1]); process.exit(0); }
  try {
    const r = report(o);
    if (o.compare) r.delta = delta(JSON.parse(fs.readFileSync(o.compare, "utf8")), r);
    if (o.json) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }
    const t = r.per_turn;
    console.log(`per-turn: ${t.total_chars} chars ≈ ${t.est_tokens} tokens (estimate)`);
    console.log(`  skill descriptions ${t.skill_descriptions.chars} (${t.skill_descriptions.active}/${t.skill_descriptions.skills} model-invocable)`);
    console.log(`  agent descriptions ${t.agent_descriptions.chars} (${t.agent_descriptions.agents} agents)`);
    console.log(`  always-on rules    ${t.always_rules.chars} (${t.always_rules.rules} rules)`);
    if (r.per_session) {
      const ri = r.per_session.rule_injection;
      console.log(`rule injection over ${ri.events} corpus events: ${ri.chars} chars, ${ri.irrelevant_injections} irrelevant rule deliveries`);
      for (const e of ri.rows.filter((x) => x.irrelevant.length)) console.log(`  ${e.id}: ${e.irrelevant.join(", ")}`);
    }
    if (r.delta) for (const [k, v] of Object.entries(r.delta)) console.log(`  Δ ${k}: ${v.before} → ${v.after} (saved ${v.saved})`);
  } catch (e) { console.error(`measure-always-loaded: ${e.message}`); process.exit(1); }
}
