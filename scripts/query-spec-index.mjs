#!/usr/bin/env node
// query-spec-index — bounded lookup over .svc/spec-index.json (WI-389).
//
// The index is ~692KB / ~28K lines; skills are told to "use it as context-spine
// source #2" but shipped no query tool, so the fallback was loading the WHOLE
// index (a ~170K-token worst case). This returns COMPACT POINTERS — the matching
// `<file>#<anchor>` sections with title + byte_range — hard-capped at ≤2K tokens,
// so an agent reads only the relevant section (via byte_range) instead of the
// whole filing cabinet.
//
// Usage:
//   node scripts/query-spec-index.mjs --wi WI-381            # sections tagged wi:WI-381
//   node scripts/query-spec-index.mjs --surface "baton"      # title/tag/topic/path match
//   node scripts/query-spec-index.mjs --wi WI-381 --json     # machine-readable
//
// DETERMINISTIC (AC1): same index + same query → byte-identical output. Matches
// are sorted by anchor; no timestamps, no randomness; the cap truncates by a
// stable rule. Idempotent (run-twice golden).

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = (() => { try { return execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim(); } catch { return process.cwd(); } })();
const INDEX = join(REPO_ROOT, ".svc", "spec-index.json");
const TOKEN_CAP = 2000;             // ≤2K tokens (the hard contract)
// Conservative char budget: anchor paths are token-DENSE (slashes/dots split),
// ~3 chars/token worst case, so 2000 tokens ≈ 6000 chars. Capping the rendered
// output at 6000 chars GUARANTEES ≤2K tokens even for the densest paths.
const CHAR_CAP = 6000;
const FOOTER_RESERVE = 96;          // space kept for the "(+N more)" footer

function parseArgs(argv) {
  const o = { _: [] };
  // A value that is missing or is itself a flag (e.g. `--wi --surface x`) is NOT
  // a valid value — leave the field unset so the usage check fires (Gemini G6 #5).
  const val = (i) => { const v = argv[i]; return v === undefined || /^--/.test(v) ? undefined : v; };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--wi") { o.wi = val(i + 1); if (o.wi !== undefined) i++; }
    else if (argv[i] === "--surface") { o.surface = val(i + 1); if (o.surface !== undefined) i++; }
    else if (argv[i] === "--json") o.json = true;
    else o._.push(argv[i]);
  }
  return o;
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  if (!o.wi && !o.surface) {
    process.stderr.write("usage: query-spec-index.mjs --wi <WI> | --surface <term> [--json]\n");
    process.exit(2);
  }
  if (!existsSync(INDEX)) { process.stderr.write(`spec-index missing: ${INDEX}\n`); process.exit(1); }
  // Gemini G6 #4: a malformed/empty index must fail gracefully, not stack-trace.
  let idx;
  try { idx = JSON.parse(readFileSync(INDEX, "utf8")); }
  catch (e) { process.stderr.write(`spec-index unreadable/malformed (${INDEX}): ${e.message}\n`); process.exit(1); }
  const sections = (idx && idx.sections) || {};

  const wiNorm = o.wi ? String(o.wi).toUpperCase() : null;
  const term = o.surface ? String(o.surface).toLowerCase() : null;

  const matches = [];
  for (const anchor of Object.keys(sections)) {
    const s = sections[anchor] || {};
    const tags = (s.tags || []).map((t) => String(t).toLowerCase());
    const topics = (s.topics || []).map((t) => String(t).toLowerCase());
    let hit = false;
    if (wiNorm) {
      // tag wi:<WI> (case-normalized) OR the anchor path carries the WI id.
      if (tags.includes(`wi:${wiNorm.toLowerCase()}`) || anchor.toUpperCase().includes(wiNorm)) hit = true;
    }
    if (term) {
      const hay = `${anchor} ${s.title || ""} ${tags.join(" ")} ${topics.join(" ")}`.toLowerCase();
      if (hay.includes(term)) hit = true;
    }
    if (hit) matches.push({ anchor, title: s.title || "", byte_range: s.byte_range || null, tags: s.tags || [] });
  }
  // Deterministic order: by anchor.
  matches.sort((a, b) => (a.anchor < b.anchor ? -1 : a.anchor > b.anchor ? 1 : 0));

  if (o.json) {
    // Cap the FINAL (indented) serialization at ≤ CHAR_CAP — measure the real
    // output, not a compact estimate (indentation inflates it ~1.7x).
    const q = o.wi ? { wi: o.wi } : { surface: o.surface };
    const mk = (kept) => ({ query: q, total: matches.length, returned: kept.length, truncated: kept.length < matches.length, matches: kept });
    const kept = [];
    for (const m of matches) {
      if (JSON.stringify(mk([...kept, m]), null, 2).length > CHAR_CAP) break;
      kept.push(m);
    }
    process.stdout.write(JSON.stringify(mk(kept), null, 2) + "\n");
    return;
  }

  // Human/compact mode: one line per match, capped.
  const header = `spec-index: ${matches.length} section(s) for ${o.wi ? "wi=" + o.wi : 'surface="' + o.surface + '"'}\n`;
  let body = "";
  let shown = 0;
  for (const m of matches) {
    const br = m.byte_range ? ` [${m.byte_range[0]}-${m.byte_range[1]}]` : "";
    const line = `  ${m.anchor}${br}${m.title ? " — " + m.title : ""}\n`;
    if (header.length + body.length + line.length + FOOTER_RESERVE > CHAR_CAP) break;
    body += line; shown++;
  }
  let footer = "";
  if (shown < matches.length) footer = `  … (+${matches.length - shown} more — narrow with a more specific --surface term)\n`;
  process.stdout.write(header + body + footer);
}

main();
