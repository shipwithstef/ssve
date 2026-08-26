#!/usr/bin/env node
/**
 * audit-framework-docs.mjs — mechanical docs-drift detector (WI-FW-DOCS-AUDIT-01).
 *
 * Detects the failure classes found in proposals/2026-08-26-framework-docs-audit-findings.md:
 *   A. Broken internal markdown links in live docs (historical dirs excluded)
 *   B. FRAMEWORK-STATE.md over its own WI-362 50KB ceiling        → WARN only
 *      (promote to FAIL after the queued diet WI lands)
 *   C. Countable claims vs disk/manifest truth (agents, rules, reference docs)
 *   D. HOSTS.md host rows vs provision/hosts/*.json
 *   E. FRAMEWORK-STATE.md references to archive paths that don't exist
 *   F. Knowledge INDEX entries older than 90 days                  → WARN only
 *
 * Exit codes: 0 = pass/warn-only, 1 = fail.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const fails = [];
const warns = [];

// Historical record dirs: never rewritten, absolute old-machine paths allowed.
const HISTORICAL_PREFIXES = ["proposals/done/", "docs/plans/", "docs/specs/research-prescope-", ".worktrees/", "node_modules/", ".git/", "test-framework/results/"];

function isHistorical(rel) {
  return HISTORICAL_PREFIXES.some((p) => rel.startsWith(p));
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git", "node_modules", ".worktrees", "results"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

// --- A. broken internal links -------------------------------------------------
function checkLinks() {
  const files = walk(ROOT);
  let broken = 0;
  for (const f of files) {
    const rel = path.relative(ROOT, f).replaceAll("\\", "/");
    if (isHistorical(rel)) continue;
    const src = fs.readFileSync(f, "utf8");
    // strip inline code spans and fenced blocks to avoid regex-looking text
    const clean = src.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
    const re = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    let m;
    while ((m = re.exec(clean))) {
      const raw = m[1];
      if (/^(https?:|mailto:|#|file:)/.test(raw)) continue;
      if (raw.startsWith("/")) continue; // root-relative external-site anchors (posthog etc.) — ambiguous class
      // `file://` targets are machine-absolute historical records (old /workspace
      // layouts) — unresolvable by design, accepted-as-historical per findings F13.
      const target = raw.split("#")[0];
      if (!target) continue;
      const absNoHash = path.resolve(path.dirname(f), target);
      // Raw-capture provenance citations (knowledge extraction scratch files that
      // are deliberately not committed) — warn, don't fail.
      if (/\/scratch\//.test(absNoHash) && !fs.existsSync(absNoHash)) {
        warns.push(`A-raw-citation [${rel}]: ${raw} (uncommitted raw capture — provenance pointer only)`);
        continue;
      }
      let t = target;
      try { t = decodeURIComponent(target); } catch { /* keep raw */ }
      // Percent-encoded on-disk names: the literal encoded string is the filename.
      if (!fs.existsSync(absNoHash) && !fs.existsSync(path.resolve(path.dirname(f), t))) {
        fails.push(`A broken-link [${rel}]: ${raw}`);
        broken++;
        if (broken > 20) return; // bounded output
      }
    }
  }
}

// --- B. size ceiling (warn) ----------------------------------------------------
function checkSize() {
  const p = path.join(ROOT, "FRAMEWORK-STATE.md");
  const kb = fs.statSync(p).size / 1024;
  if (kb > 50) warns.push(`B FRAMEWORK-STATE.md is ${kb.toFixed(0)}KB > its own 50KB WI-362 ceiling (diet WI queued; WARN until then)`);
}

// --- C. countable claims --------------------------------------------------------
function countAgents() {
  let n = 0;
  for (const f of fs.readdirSync(path.join(ROOT, "agents"))) {
    if (!f.endsWith(".md") || f === "README.md") continue;
    const head = fs.readFileSync(path.join(ROOT, "agents", f), "utf8").slice(0, 200);
    if (/^---/.test(head)) n++;
  }
  return n;
}
function countRulesFromManifest() {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, "skills-manifest.json"), "utf8"));
  return (m.rulesRegistry?.entries || []).length;
}
function countRefdocs() {
  return fs.readdirSync(path.join(ROOT, "references")).filter((f) => f.endsWith(".md")).length;
}
function countTier1Scripts() {
  const d = path.join(ROOT, "test-framework", "evals", "tier-1");
  return fs.readdirSync(d).filter((f) => f.endsWith(".sh") || f.endsWith(".mjs")).length;
}

function claimIn(file, regex) {
  const s = fs.readFileSync(path.join(ROOT, file), "utf8");
  const m = regex.exec(s);
  return m ? parseInt(m[1], 10) : null;
}

function checkCounts() {
  const agents = countAgents();
  for (const [file, re] of [
    ["FRAMEWORK-STATE.md", /\*\*Agents:\*\* (\d+)/],
    ["AGENTS.md", /(\d+) agent definitions?\b/],
  ]) {
    const c = claimIn(file, re);
    if (c !== null && c !== agents) fails.push(`C ${file} claims ${c} agents, disk has ${agents}`);
    else if (c === null) fails.push(`C ${file} missing parseable agents-count claim`);
  }
  const rules = countRulesFromManifest();
  for (const [file, re] of [
    ["FRAMEWORK-STATE.md", /\*\*Rules:\*\* (\d+) registered/],
    ["AGENTS.md", /(\d+) registered rules\b/],
  ]) {
    const c = claimIn(file, re);
    if (c !== null && c !== rules) fails.push(`C ${file} claims ${c} rules, manifest has ${rules}`);
    else if (c === null) fails.push(`C ${file} missing parseable rules-count claim`);
  }
  const refdocs = countRefdocs();
  const c = claimIn("FRAMEWORK-STATE.md", /\*\*Reference docs:\*\* (\d+)/);
  if (c !== null && c !== refdocs) fails.push(`C FRAMEWORK-STATE.md claims ${c} reference docs, disk has ${refdocs}`);
  else if (c === null) fails.push(`C FRAMEWORK-STATE.md missing parseable reference-docs-count claim`);
  const t1 = countTier1Scripts();
  const c1 = claimIn("FRAMEWORK-STATE.md", /(\d+) tier-1 scripts/);
  if (c1 !== null && c1 !== t1) fails.push(`C FRAMEWORK-STATE.md claims ${c1} tier-1 scripts, disk has ${t1}`);
  else if (c1 === null) fails.push(`C FRAMEWORK-STATE.md missing parseable tier-1-scripts-count claim`);
}

// --- D. HOSTS.md rows vs provision/hosts --------------------------------------
function checkHosts() {
  const hosts = fs.readdirSync(path.join(ROOT, "provision", "hosts"))
    .filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
  const table = fs.readFileSync(path.join(ROOT, "HOSTS.md"), "utf8");
  for (const h of hosts) {
    if (!table.includes(h)) fails.push(`D HOSTS.md missing provisioned host "${h}"`);
  }
}

// --- E. archive-path existence --------------------------------------------------
function checkArchiveRefs() {
  const s = fs.readFileSync(path.join(ROOT, "FRAMEWORK-STATE.md"), "utf8");
  const re = /FRAMEWORK-STATE-ARCHIVE\/([A-Za-z0-9._-]+\.(?:md|mjs|sh|json))/g;
  let m;
  while ((m = re.exec(s))) {
    if (!fs.existsSync(path.join(ROOT, "FRAMEWORK-STATE-ARCHIVE", m[1]))) {
      fails.push(`E FRAMEWORK-STATE.md references nonexistent archive file ${m[1]}`);
    }
  }
}

// --- F. knowledge freshness (warn) ----------------------------------------------
function checkKnowledgeFreshness() {
  const idx = path.join(ROOT, "references", "knowledge", "INDEX.md");
  if (!fs.existsSync(idx)) return warns.push("F references/knowledge/INDEX.md missing");
  const now = Date.now();
  const dates = [...new Set([...fs.readFileSync(idx, "utf8").matchAll(/\b(20\d\d-\d\d-\d\d)\b/g)].map((m) => m[1]))];
  const stale = dates.filter((d) => now - new Date(d).getTime() > 90 * 86400000);
  if (stale.length) warns.push(`F knowledge INDEX carries ${stale.length} date(s) older than 90d (${stale.slice(0, 3).join(", ")}…) — verify before host-wiring use`);
}

checkLinks();
checkSize();
checkCounts();
checkHosts();
checkArchiveRefs();
checkKnowledgeFreshness();

for (const w of warns) console.log(`WARN ${w}`);
if (fails.length) {
  for (const f of fails) console.log(`FAIL ${f}`);
  console.log(`RESULT: FAIL (${fails.length} finding(s), ${warns.length} warning(s))`);
  process.exit(1);
}
console.log(`RESULT: PASS (0 findings, ${warns.length} warning(s))`);
