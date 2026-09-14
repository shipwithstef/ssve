#!/usr/bin/env node
/**
 * build-feature-graph — parse a feature spec's AC table + journey @AC tags +
 * test @AC tags into the .svc/feature-graph.json RELATIONAL store (WI-390).
 *
 * The join key wiring every product artifact — the AC ID (DISC-01) — is today
 * free text re-typed into 5+ artifacts with NO machine-readable relationship
 * store. This builds one: nodes {ac, journey-scenario, test, ...} + edges. An AC
 * node carries a `file_anchor` POINTER to the prose AC text, NEVER a copy (AC1) —
 * the spec stays the authoritative prose store; the graph is the queryable index.
 * Orphan @-tags (a @AC-99 with no AC node) are an ERROR (AC2). Coverage matrices
 * are RENDERED from this graph (render-coverage-matrix.mjs --check), not hand-
 * maintained — the WI-364 generate-don't-lint pattern, for the product pipeline.
 *
 * FAIL-CLOSED: a spec routed here that has no parseable AC table throws (never
 * emits an empty/partial graph that would then "validate clean").
 *
 * v1 is fenced to svc-native/greenfield specs (the `| AC | Description | QA |
 * E2E | Test |` contract). Brownfield population is a deferred follow-on.
 *
 * Usage:
 *   node scripts/build-feature-graph.mjs build --spec <spec.md> [--journeys "j/*.md"] [--tests "e/*.ts"] --out .svc/feature-graph.json
 *   node scripts/build-feature-graph.mjs validate --graph .svc/feature-graph.json
 */

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { writeJsonAtomic } from "./state-io.mjs";   // atomic .svc/feature-graph.json write (state-io discipline)

const AC_ID_RE = /^[A-Z][A-Z0-9]*-\d+$/;          // DISC-01, US-1, AC-12
// Gemini G6 #1: match BOTH journey tags (@DISC-01) AND test tags (@AC-DISC-01,
// the WI-391 convention), with a trailing word boundary so @DISC-011 can't
// falsely match DISC-01 (it must surface as its own id → orphan if no node).
const TAG_RE = /(?:@AC-|@)([A-Z][A-Z0-9]*-\d+)\b/g;
const stripEmph = (s) => String(s).replace(/[`*_]/g, "");   // G6 #2: markdown emphasis

// Parse the AC table: | AC | Description | QA | E2E | Test |. Returns AC nodes
// that POINT at the spec (file_anchor), carrying NO prose copy.
export function parseAcTable(specText, specPath) {
  const lines = String(specText).split("\n");
  const out = [];
  let inTable = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/^\s*\|/.test(line)) { inTable = false; continue; }
    const cells = line.split("|").map((c) => stripEmph(c).trim());   // G6 #2: tolerate **bold** cells
    // header row: cell[1] ~ "AC", cell[2] ~ "Description"
    if (!inTable && /^ac$/i.test(cells[1] || "") && /description/i.test(cells[2] || "")) { inTable = true; continue; }
    if (!inTable) continue;
    if (/^\s*\|?\s*:?-{2,}/.test(line)) continue;     // separator row
    const id = cells[1] || "";
    if (!AC_ID_RE.test(id)) continue;                 // not an AC data row
    out.push({
      id, type: "ac",
      qa_status: cells[3] || "", e2e_status: cells[4] || "", test_ref: (cells[5] || "").replace(/`/g, ""),
      status: "planned",
      file_anchor: `${specPath}:${i + 1}`,            // POINTER, not a prose copy (AC1)
    });
  }
  return out;
}

function tagsIn(text) {
  const t = new Set();
  let m;
  const re = new RegExp(TAG_RE.source, "g");
  while ((m = re.exec(String(text))) !== null) t.add(m[1].toUpperCase());
  return [...t];
}

// Pure: build the relational graph from a spec + journeys + tests.
// spec = {path, text}; journeys/tests = [{path, text}, ...]. Throws (fail-closed)
// when the spec has no parseable AC table.
export function buildGraph(spec, journeys = [], tests = []) {
  const acNodes = parseAcTable(spec.text, spec.path);
  if (acNodes.length === 0) {
    throw new Error(`build-feature-graph: no AC table parsed from ${spec.path} — v1 requires an svc-native | AC | Description | QA | E2E | Test | table (fail-closed; refusing to emit an empty graph)`);
  }
  const acIds = new Set(acNodes.map((n) => n.id.toUpperCase()));
  const nodes = [...acNodes];
  const edges = [];
  const orphans = [];
  const link = (items, nodeType, edgeType) => {
    for (const it of items) {
      nodes.push({ id: it.path, type: nodeType, file_anchor: `${it.path}:1` });
      for (const tag of tagsIn(it.text)) {
        if (acIds.has(tag)) edges.push({ from: it.path, to: tag, type: edgeType });
        else orphans.push({ tag, source: it.path });   // AC2: @-tag with no AC node
      }
    }
  };
  link(journeys, "journey-scenario", "scenario-covers-ac");
  link(tests, "test", "test-covers-ac");
  return { version: 1, generated_from: spec.path, nodes, edges, orphans };
}

// AC1 (pointer-not-prose) + AC2 (orphan tags). Returns an array of error strings.
const AC_ALLOWED_KEYS = new Set(["id", "type", "qa_status", "e2e_status", "test_ref", "status", "file_anchor"]);
export function validateGraph(graph) {
  const errors = [];
  for (const n of (graph && graph.nodes) || []) {
    if (n.type !== "ac") continue;
    if (!n.file_anchor || !/:\d+$/.test(String(n.file_anchor))) errors.push(`AC ${n.id}: missing file:anchor pointer`);
    // Gemini G6 #3: a strict WHITELIST, not a 4-field blacklist — any field beyond
    // the pointer/status set (e.g. summary, title, text) is a potential prose copy
    // and is rejected, closing the AC1 "pointer-not-prose" invariant completely.
    for (const key of Object.keys(n)) {
      if (!AC_ALLOWED_KEYS.has(key)) errors.push(`AC ${n.id}: carries an unapproved field '${key}' — AC nodes hold POINTERS + status only, never a prose copy (AC1)`);
    }
  }
  for (const o of (graph && graph.orphans) || []) errors.push(`orphan @${o.tag} in ${o.source} — no matching AC node (AC2)`);
  return errors;
}

// ---- CLI ----
function argVal(name) { const i = process.argv.indexOf(name); return i === -1 ? null : process.argv[i + 1] || null; }
function glob(pattern) {
  if (!pattern) return [];
  // G6 #5: sort — `ls` order is locale/OS-dependent; sorting makes the graph
  // (node/edge order) deterministic so rebuilds don't churn the committed file.
  try { return execSync(`ls ${pattern} 2>/dev/null`, { encoding: "utf8" }).split("\n").filter(Boolean).sort(); }
  catch { return []; }
}
function readFiles(paths) { return paths.filter((p) => existsSync(p)).map((p) => ({ path: p, text: readFileSync(p, "utf8") })); }

if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2];
  try {
    if (cmd === "build") {
      const specPath = argVal("--spec");
      if (!specPath || !existsSync(specPath)) { console.error(`build-feature-graph: --spec not found: ${specPath}`); process.exit(2); }
      const graph = buildGraph(
        { path: specPath, text: readFileSync(specPath, "utf8") },
        readFiles(glob(argVal("--journeys"))),
        readFiles(glob(argVal("--tests"))),
      );
      const errors = validateGraph(graph);
      const out = argVal("--out") || ".svc/feature-graph.json";
      writeJsonAtomic(out, graph);
      if (errors.length) { console.error("feature-graph validation errors:\n  " + errors.join("\n  ")); process.exit(1); }
      console.log(`feature-graph written to ${out}: ${graph.nodes.length} nodes, ${graph.edges.length} edges, 0 orphans`);
    } else if (cmd === "validate") {
      const gp = argVal("--graph") || ".svc/feature-graph.json";
      if (!existsSync(gp)) { console.error(`build-feature-graph: --graph not found: ${gp}`); process.exit(2); }
      const errors = validateGraph(JSON.parse(readFileSync(gp, "utf8")));
      if (errors.length) { console.error("feature-graph INVALID:\n  " + errors.join("\n  ")); process.exit(1); }
      console.log("feature-graph valid (pointers-only, no orphan tags)");
    } else {
      console.error("usage: build-feature-graph (build --spec <p> [--journeys <g>] [--tests <g>] --out <p>) | (validate --graph <p>)");
      process.exit(2);
    }
  } catch (e) {
    console.error(String(e && e.message || e));   // fail-closed: throw → non-zero
    process.exit(1);
  }
}
