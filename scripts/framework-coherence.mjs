#!/usr/bin/env node
/**
 * framework-coherence.mjs — find the places where the framework disagrees with itself.
 *
 *   node scripts/framework-coherence.mjs [--json]      # report, exit 1 on any finding
 *   node scripts/framework-coherence.mjs --fix-chains  # rewrite SKILL.md chain prev/next from the lanes
 *
 * Each check compares a statement against the thing that enforces it, so the code or
 * the manifest stays the single source and prose follows:
 *   chains        every skill's chain.lanes prev/next equals its neighbours in the
 *                 effective lane order (manifest lane + the mandatory delivery chain,
 *                 as scripts/lib/mandatory-delivery-chain.mjs inserts it)
 *   lane-layers   the delivery-graph compiler's required steps are an ordered subset of
 *                 the manifest lane; mandatory-chain skills absent from every lane are
 *                 declared in mandatoryChainOutOfLane
 *   round-cap     every "N-round cap" in skills, references and DOCTRINE equals the CAP
 *                 that scripts/check-review-round-cap.mjs enforces
 *   skips         skip-conditions.json never lets an essential stage's owner skill skip
 *   counts        stated counts of skills, hosts, lanes and always-on rules match the repo
 *   paths         repository files named in skills, agents, rules and root docs exist
 * The framework lane is a decision tree (manifestArrayRoles), so its skills carry only
 * positions and are not checked for prev/next.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isMain } from "./lib/is-main.mjs";
import { MANDATORY_DELIVERY_CHAIN, injectMandatoryDeliveryChain } from "./lib/mandatory-delivery-chain.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const manifest = () => JSON.parse(read("skills-manifest.json"));
const DECISION_TREE_LANES = new Set(["framework"]);

// The order a lane actually runs in. The mandatory delivery chain is inserted contiguously
// (scripts/lib/mandatory-delivery-chain.mjs); a non-chain skill the manifest lists after the
// chain has started (track-visuals diff, benchmark-landing) runs as a process step inside a
// chain stage (compile-delivery-graph.mjs: the visual diff runs before review-gate), so it
// has no lane neighbours of its own.
// A lane declared `kind: "non-code"` (research, strategy, writing: no delivery graph) keeps
// its own steps; the code-delivery chain is injected only into code lanes.
export const isNonCode = (def) => !Array.isArray(def) && def.kind === "non-code";

export function effectiveLanes(m = manifest()) {
  const chain = new Set(MANDATORY_DELIVERY_CHAIN);
  return Object.fromEntries(Object.entries(m.laneDefinitions).map(([lane, def]) => {
    const skills = def.skills || def;
    if (isNonCode(def)) return [lane, [...skills]];
    const first = skills.findIndex((s) => chain.has(s));
    const upstream = first < 0 ? skills : skills.slice(0, first);
    return [lane, injectMandatoryDeliveryChain(upstream)];
  }));
}

export function processSteps(m = manifest()) {
  const chain = new Set(MANDATORY_DELIVERY_CHAIN);
  return Object.fromEntries(Object.entries(m.laneDefinitions).map(([lane, def]) => {
    const skills = def.skills || def;
    const first = skills.findIndex((s) => chain.has(s));
    return [lane, first < 0 ? [] : skills.slice(first).filter((s) => !chain.has(s))];
  }));
}

// The chain.lanes map from a SKILL.md frontmatter: { lane: { position, prev, next } }.
export function chainBlock(text) {
  const fm = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] || "";
  const out = {};
  const block = /^chain:\n((?:[ \t]+.*\n?)*)/m.exec(fm)?.[1] || "";
  for (const m of block.matchAll(/^\s{4}([\w-]+):\s*\{([^}]*)\}/gm)) {
    const fields = Object.fromEntries(m[2].split(",").map((kv) => kv.split(":").map((x) => x.trim())).filter((kv) => kv.length === 2));
    const val = (v) => (v == null || v === "null" || v === "~" || v === "" ? null : v);
    out[m[1]] = { position: fields.position ? Number(fields.position) : null, prev: val(fields.prev), next: val(fields.next) };
  }
  return out;
}

export function expectedNeighbours(order, skill) {
  const i = order.indexOf(skill);
  return i < 0 ? null : { position: i + 1, prev: order[i - 1] ?? null, next: order[i + 1] ?? null };
}

export function checkChains(m = manifest()) {
  const findings = [];
  for (const [lane, order] of Object.entries(effectiveLanes(m))) {
    if (DECISION_TREE_LANES.has(lane)) continue;
    for (const skill of new Set(order)) {
      const file = `skills/${skill}/SKILL.md`;
      if (!exists(file)) { findings.push({ check: "chains", file, msg: `lane ${lane} names ${skill}, which has no SKILL.md` }); continue; }
      const got = chainBlock(read(file))[lane];
      const laneList = m.laneDefinitions[lane].skills || m.laneDefinitions[lane];
      const pos = laneList.indexOf(skill) + 1;
      // Out-of-lane gates (review-plan, review-exec) carry no lane entry; a skill the manifest
      // lane lists must.
      if (!got) { if (pos > 0) findings.push({ check: "chains", file, lane, msg: `has no chain entry for lane ${lane}, which lists it at position ${pos}` }); continue; }
      const want = expectedNeighbours(order, skill);
      for (const k of ["prev", "next"]) if ((got[k] || null) !== (want[k] || null)) findings.push({ check: "chains", file, lane, field: k, got: got[k], want: want[k], msg: `${lane}.${k} is ${got[k]}, the lane says ${want[k]}` });
      if (pos > 0 && got.position !== pos) findings.push({ check: "chains", file, lane, field: "position", msg: `${lane}.position is ${got.position}, the manifest lane says ${pos}` });
    }
  }
  return findings;
}

// Process steps (skills the manifest lists after the chain starts) have no lane neighbours,
// but their declared position still follows the manifest lane.
export function checkProcessPositions(m = manifest(), fix = false) {
  const findings = [];
  for (const [lane, steps] of Object.entries(processSteps(m))) {
    if (DECISION_TREE_LANES.has(lane)) continue;
    const laneList = m.laneDefinitions[lane].skills || m.laneDefinitions[lane];
    for (const skill of new Set(steps)) {
      const file = `skills/${skill}/SKILL.md`;
      if (!exists(file) || effectiveLanes(m)[lane].includes(skill)) continue;
      const text = read(file);
      const got = chainBlock(text)[lane];
      const valid = laneList.map((s, i) => (s === skill ? i + 1 : 0)).filter(Boolean);
      if (!got || valid.includes(got.position)) continue;
      const want = valid[valid.length - 1];
      if (fix) fs.writeFileSync(path.join(ROOT, file), text.replace(new RegExp(`^(\\s{4}${lane}:\\s*\\{\\s*position:\\s*)\\d+`, "m"), `$1${want}`));
      else findings.push({ check: "chains", file, lane, msg: `${lane}.position is ${got.position}, the manifest lane lists it at ${valid.join(" or ")}` });
    }
  }
  return findings;
}

export function fixChains(m = manifest()) {
  let changed = 0;
  for (const [lane, order] of Object.entries(effectiveLanes(m))) {
    if (DECISION_TREE_LANES.has(lane)) continue;
    const laneList = m.laneDefinitions[lane].skills || m.laneDefinitions[lane];
    for (const skill of new Set(order)) {
      const file = path.join(ROOT, `skills/${skill}/SKILL.md`);
      if (!fs.existsSync(file)) continue;
      const text = fs.readFileSync(file, "utf8");
      const want = expectedNeighbours(order, skill);
      const pos = laneList.indexOf(skill) + 1;
      const re = new RegExp(`^(\\s{4}${lane}:\\s*\\{)([^}]*)(\\})`, "m");
      const hit = re.exec(text);
      let next = text;
      if (hit) {
        const fields = hit[2].split(",").map((kv) => kv.trim()).filter(Boolean).filter((kv) => !/^(position|prev|next):/.test(kv));
        const position = pos > 0 ? pos : chainBlock(text)[lane]?.position ?? want.position;
        const parts = [`position: ${position}`, ...(want.prev ? [`prev: ${want.prev}`] : []), ...(want.next ? [`next: ${want.next}`] : []), ...fields];
        next = text.replace(re, `$1 ${parts.join(", ")} $3`);
      } else if (pos > 0) {
        // Add the missing lane entry after the last existing one in chain.lanes.
        const fm = /^---\n[\s\S]*?\n---/.exec(text)?.[0] || "";
        const lanes = /^chain:\n\s{2}lanes:\n((?:\s{4}[\w-]+:.*\n)*)/m.exec(fm);
        if (!lanes) continue;
        const entry = `    ${lane}: { ${[`position: ${pos}`, ...(want.prev ? [`prev: ${want.prev}`] : []), ...(want.next ? [`next: ${want.next}`] : [])].join(", ")} }\n`;
        next = text.replace(lanes[0], lanes[0] + entry);
      }
      if (next !== text) { fs.writeFileSync(file, next); changed++; }
    }
  }
  return changed;
}

export function checkLaneLayers(m = manifest()) {
  const findings = [];
  // Lane lists live in references/delivery-lanes.json. Parsing a JS object
  // literal out of the compiler misses the data switch and reports nothing.
  const compiled = JSON.parse(read("references/delivery-lanes.json")).lanes || {};
  for (const [lane, required] of Object.entries(compiled)) {
    const full = effectiveLanes(m)[lane];
    if (!full) { findings.push({ check: "lane-layers", file: "scripts/compile-delivery-graph.mjs", msg: `compiler lane ${lane} is not in laneDefinitions` }); continue; }
    // The compiler lifts these out of order into audit-implementation's pre-land process
    // steps (buildTaskSteps), so they need lane membership, not position.
    const processSteps = new Set(["test-framework", "review-security", "audit-session-execution"]);
    for (const s of required.filter((x) => processSteps.has(x))) {
      if (!full.includes(s)) findings.push({ check: "lane-layers", file: "scripts/compile-delivery-graph.mjs", msg: `${lane}: process step ${s} is not in the manifest lane` });
    }
    let at = -1;
    for (const s of required.filter((x) => !processSteps.has(x))) {
      const i = full.indexOf(s, at + 1);
      if (i < 0) { findings.push({ check: "lane-layers", file: "scripts/compile-delivery-graph.mjs", msg: `${lane}: required step ${s} is not in the manifest lane (or is out of order)` }); break; }
      at = i;
    }
  }
  const inSomeLane = new Set(Object.values(m.laneDefinitions).flatMap((d) => d.skills || d));
  const declared = new Set(Object.keys(m.mandatoryChainOutOfLane || {}));
  for (const s of MANDATORY_DELIVERY_CHAIN) if (!inSomeLane.has(s) && !declared.has(s)) findings.push({ check: "lane-layers", file: "skills-manifest.json", msg: `${s} is in the mandatory chain and in no lane, but not declared in mandatoryChainOutOfLane` });
  return findings;
}

const PROSE = ["DOCTRINE.md", "CLAUDE.md", "AGENTS.md", "REPO_MODES.md", "README.md", "EXTERNAL_ADDONS.md", "GEMINI.md", "KIMI.md"];
function proseFiles() {
  const out = [...PROSE.filter(exists)];
  const walk = (dir) => { for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) { if (!["knowledge", "fixtures", "node_modules"].includes(e.name)) walk(rel); }
    else if (e.name.endsWith(".md")) out.push(rel);
  } };
  ["skills", "references", "agents", "rules"].forEach(walk);
  return out;
}

export function checkRoundCap() {
  const cap = Number(/const CAP = (\d+);/.exec(read("scripts/check-review-round-cap.mjs"))?.[1]);
  const words = { two: 2, three: 3, four: 4 };
  const findings = [];
  for (const f of proseFiles()) read(f).split("\n").forEach((line, i) => {
    for (const mm of line.matchAll(/\b(\d|two|three|four)[- ](?:substantive[- ])?round (?:hard )?cap\b|\bhard (\d)-round cap\b|\bmaximum (\d) iterations\b|\bcapped at (\d) rounds\b|\brounds_run == (\d)\b|\bat most \*{0,2}(\d)\*{0,2} (?:adversarial )?rounds\b/gi)) {
      const n = Number(mm[1] ? (words[mm[1].toLowerCase()] ?? mm[1]) : mm.slice(2).find(Boolean));
      if (n !== cap && !/historical|was |previously|before rv1/i.test(line)) findings.push({ check: "round-cap", file: f, line: i + 1, msg: `states a ${n}-round cap; scripts/check-review-round-cap.mjs enforces ${cap}` });
    }
  });
  return findings;
}

export function checkSkips() {
  const stages = JSON.parse(read("references/stage-registry.json"));
  const essentialOwners = new Set((stages.stages || []).filter((s) => s.class === "essential").flatMap((s) => [s.owner_skill, ...(s.lane_skills || [])]).filter(Boolean));
  const skips = JSON.parse(read("references/skip-conditions.json")).skills || {};
  return Object.keys(skips).filter((s) => essentialOwners.has(s)).map((s) => ({ check: "skips", file: "references/skip-conditions.json", msg: `${s} owns an essential stage (stage-registry.json) but skip-conditions lets it skip` }));
}

export function truth(m = manifest()) {
  return {
    skills: m.includedSkills.length,
    hosts: fs.readdirSync(path.join(ROOT, "provision/hosts")).filter((f) => f.endsWith(".json")).length,
    lanes: Object.keys(m.laneDefinitions).length,
    always_rules: (m.rulesRegistry?.entries || []).filter((e) => e.auto_inject === "always").length,
  };
}

export function checkCounts(m = manifest()) {
  const t = truth(m);
  const findings = [];
  const files = [...PROSE, "references/knowledge/svc/CAPABILITIES.md", "references/advisor/framework-knowledge-index.md"].filter(exists);
  const words = { five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
  const num = (s) => words[s.toLowerCase()] ?? Number(s);
  for (const f of files) read(f).split("\n").forEach((line, i) => {
    if (/historical|was |previously|\bat the time\b|\bmeasurement 20\d\d|restamp|refreshed 20\d\d/i.test(line)) return;
    for (const mm of line.matchAll(/\b(\d{2,3})[- ]skill(?:s)?\b(?! (?:description|listing|scenario|pipeline|steps))/gi)) if (Number(mm[1]) >= 90 && Number(mm[1]) !== t.skills) findings.push({ check: "counts", file: f, line: i + 1, msg: `says ${mm[1]} skills; the manifest has ${t.skills}` });
    for (const mm of line.matchAll(/\ball (\w+) host manifests\b|\b(\w+) supported hosts\b/gi)) { const n = num(mm[1] || mm[2]); if (n && n !== t.hosts) findings.push({ check: "counts", file: f, line: i + 1, msg: `says ${n} hosts; provision/hosts has ${t.hosts}` }); }
    for (const mm of line.matchAll(/\b(\w+) workflow lanes\b/gi)) { const n = num(mm[1]); if (n && n !== t.lanes) findings.push({ check: "counts", file: f, line: i + 1, msg: `says ${n} lanes; laneDefinitions has ${t.lanes}` }); }
    for (const mm of line.matchAll(/\b(\w+) always-on (?:behavioral )?rules\b/gi)) { const n = num(mm[1]); if (n && n !== t.always_rules) findings.push({ check: "counts", file: f, line: i + 1, msg: `says ${n} always-on rules; rulesRegistry has ${t.always_rules}` }); }
  });
  return findings;
}

// Repository paths named in prose that do not exist. Placeholders (<...>, *, {}),
// examples and paths created at runtime in a consumer project are not checked.
const RUNTIME = /^(schemas\/mobile-build-contract\.json$|docs\/(specs|plans|learnings|analysis\/onboarding)|\.svc\/|company-state\/|src\/|test\/|app\/|templates\/project)/;
// A line that names a path as an example, as a file in the consumer's repo, as a dated
// changelog entry or as something not built yet is not a broken reference.
const NOT_A_REFERENCE = /\be\.g\.|consumer repo|product repo|app-workspaces|exists yet|no motion-capture script|proposed in|proposed, not built|^\s*- 20\d\d-\d\d-\d\d:|\bsee `references\/edge-cases\.md` for the full handling matrix/i;
// Docs that describe a consumer project's own workspace, not this repo.
const CONSUMER_DOCS = new Set(["skills/base44-environment/references/environment-reference.md"]);
export function checkPaths() {
  const findings = [];
  for (const f of proseFiles()) {
    if (CONSUMER_DOCS.has(f)) continue;
    read(f).split("\n").forEach((line) => {
      if (NOT_A_REFERENCE.test(line)) return;
      for (const mm of line.matchAll(/`((?:scripts|schemas|references|templates|proposals|hooks|agents|rules)\/[\w./-]+\.(?:mjs|js|sh|json|md|yaml|yml))`/g)) {
        const p = mm[1];
        if (/[<>*{}]/.test(p) || RUNTIME.test(p)) continue;
        if (!exists(p) && !exists(`skills/${path.dirname(f).split("/")[1]}/${p}`) && !exists(path.join(path.dirname(f), p))) findings.push({ check: "paths", file: f, msg: `names ${p}, which does not exist` });
      }
    });
  }
  return findings;
}

export function runAll() {
  return [...checkChains(), ...checkProcessPositions(), ...checkLaneLayers(), ...checkRoundCap(), ...checkSkips(), ...checkCounts(), ...checkPaths()];
}

function main(argv) {
  if (argv.includes("--fix-chains")) { const n = fixChains(); checkProcessPositions(manifest(), true); process.stdout.write(`rewrote chain blocks in ${n} skill(s)\n`); return 0; }
  const findings = runAll();
  if (argv.includes("--json")) process.stdout.write(JSON.stringify(findings, null, 2) + "\n");
  else {
    const by = {};
    for (const f of findings) (by[f.check] ??= []).push(f);
    for (const [check, list] of Object.entries(by)) { process.stdout.write(`\n${check}: ${list.length}\n`); for (const f of list) process.stdout.write(`  ${f.file}${f.line ? `:${f.line}` : ""} ${f.msg}\n`); }
    process.stdout.write(`\nframework-coherence: ${findings.length} finding(s)\n`);
  }
  return findings.length ? 1 : 0;
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
