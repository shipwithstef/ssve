#!/usr/bin/env node
/**
 * render-coverage-matrix — RENDER the AC coverage matrix from the feature graph
 * (WI-390 AC3). generate-don't-lint: the matrix is a derived VIEW of
 * .svc/feature-graph.json, never hand-maintained. Reuses the WI-364 marker engine
 * (<!-- svc:generated:begin <id> --> … <!-- end --> ); `--check` exits 1 on
 * graph↔matrix drift, `--write` rewrites the block in place.
 *
 * Usage:
 *   node scripts/render-coverage-matrix.mjs --graph <graph.json> --target <coverage.md> --check
 *   node scripts/render-coverage-matrix.mjs --graph <graph.json> --target <coverage.md> --write
 *   node scripts/render-coverage-matrix.mjs --graph <graph.json>            # print to stdout
 *
 * (--graph defaults to the feature-graph store; --target is a docs coverage file,
 * NOT svc state — this script's only write is the marker block in that docs file.)
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const MARKER_ID = "feature-coverage-matrix";
const escRe = (id) => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function markerRe(id) {
  const e = escRe(id);
  return new RegExp(`(<!--\\s*svc:generated:begin ${e}[^>]*-->)([\\s\\S]*?)(<!--\\s*svc:generated:end ${e}\\s*-->)`);
}
function markerCount(text, id) {
  const begins = (text.match(new RegExp(`<!--\\s*svc:generated:begin ${escRe(id)}(?=[ \\-])`, "g")) || []).length;
  const ends = (text.match(new RegExp(`<!--\\s*svc:generated:end ${escRe(id)}\\s*-->`, "g")) || []).length;
  return { begins, ends };
}

// Render the matrix from the graph. Deterministic: AC rows sorted by id; journeys
// per AC sorted. The matrix carries the AC ID + status COLUMNS + journey/test
// coverage — all derived from nodes/edges, never a prose copy of the AC text.
export function renderMatrix(graph) {
  const acs = (graph.nodes || []).filter((n) => n.type === "ac").slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const journeysByAc = {}, testsByAc = {};
  for (const e of graph.edges || []) {
    if (e.type === "scenario-covers-ac") (journeysByAc[e.to] = journeysByAc[e.to] || []).push(e.from);
    if (e.type === "test-covers-ac") (testsByAc[e.to] = testsByAc[e.to] || []).push(e.from);
  }
  const base = (p) => String(p).split("/").pop();
  let md = "| AC | QA | E2E | Test | Journeys | Tests |\n|----|----|-----|------|----------|-------|\n";
  for (const ac of acs) {
    const js = (journeysByAc[ac.id] || journeysByAc[ac.id.toUpperCase()] || []).map(base).sort().join(", ");
    const ts = (testsByAc[ac.id] || testsByAc[ac.id.toUpperCase()] || []).map(base).sort().join(", ");
    md += `| ${ac.id} | ${ac.qa_status || ""} | ${ac.e2e_status || ""} | ${ac.test_ref || ""} | ${js} | ${ts} |\n`;
  }
  return md.trimEnd();
}

function argVal(name) { const i = process.argv.indexOf(name); return i === -1 ? null : process.argv[i + 1] || null; }
const has = (n) => process.argv.includes(n);

if (import.meta.url === `file://${process.argv[1]}`) {
  const gp = argVal("--graph") || ".svc/feature-graph.json";
  if (!existsSync(gp)) { console.error(`render-coverage-matrix: --graph not found: ${gp}`); process.exit(2); }
  let graph;
  try { graph = JSON.parse(readFileSync(gp, "utf8")); } catch (e) { console.error(`render-coverage-matrix: graph not valid JSON — ${e.message}`); process.exit(1); }
  const rendered = renderMatrix(graph);
  const target = argVal("--target");
  if (!target) { process.stdout.write(rendered + "\n"); process.exit(0); }
  if (!existsSync(target)) { console.error(`render-coverage-matrix: --target not found: ${target}`); process.exit(2); }
  const text = readFileSync(target, "utf8");
  const { begins, ends } = markerCount(text, MARKER_ID);
  if (begins !== 1 || ends !== 1) {
    console.error(`render-coverage-matrix: expected exactly one '${MARKER_ID}' marker pair in ${target} (found ${begins} begin / ${ends} end)`);
    process.exit(1);
  }
  const m = text.match(markerRe(MARKER_ID));
  // G6 #4: normalize CRLF before comparing — a Windows checkout (autocrlf) would
  // otherwise false-fail --check purely on line endings, not real drift.
  const norm = (s) => String(s).replace(/\r\n/g, "\n").trim();
  const current = norm(m[2] || "");
  const want = norm(rendered);
  if (has("--write")) {
    const next = text.replace(markerRe(MARKER_ID), `$1\n${want}\n$3`);
    writeFileSync(target, next);
    console.log(`render-coverage-matrix: wrote matrix to ${target}`);
    process.exit(0);
  }
  // --check (default when --target given): exit 1 on drift
  if (current !== want) {
    console.error(`render-coverage-matrix: DRIFT — ${target} coverage matrix is stale vs .svc/feature-graph.json. Run with --write (the graph is the source; the matrix is a generated view).`);
    process.exit(1);
  }
  console.log(`render-coverage-matrix: ${target} matrix matches the graph`);
}
