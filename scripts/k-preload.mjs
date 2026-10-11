#!/usr/bin/env node
/**
 * K preload for delivery agents (plan and execute).
 *
 * Reads private project knowledge already in the repo and prints a compact,
 * deterministic, size-capped digest. Each fact is marked as a requirement and
 * carries its repo-relative source path. This script never writes.
 *
 *   node scripts/k-preload.mjs --root .
 *   node scripts/k-preload.mjs --root . --cap 2048
 *
 * Sources, in keep-order (lowest priority is dropped first when the cap binds):
 *   .svc/standing-rules.md
 *   OWNER-NOTES.md and docs/owner*
 *   NOTES* at the repo root and under docs/
 *   decision logs (.svc/pipeline-decisions.jsonl, .svc/agent-decisions.jsonl,
 *   other .svc decision logs, and docs/decisions/)
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const DEFAULT_CAP_BYTES = 2048;
const MAX_FACT_CHARS = 240;
const MAX_MARKDOWN_BYTES = 64 * 1024;
const MAX_JSONL_BYTES = 128 * 1024;
const MAX_DOCS_DEPTH = 4;

const RANK = {
  "standing-rules": 0,
  "owner-notes": 1,
  notes: 2,
  decisions: 3,
};

const DECISION_FILES = [
  ".svc/pipeline-decisions.jsonl",
  ".svc/agent-decisions.jsonl",
  ".svc/decisions.jsonl",
  ".svc/decision-log.jsonl",
  ".svc/decision-log.md",
];

const CREDENTIAL = String.raw`(?:api[_-]?key|secret|token|password)`;
// Quoted values keep backslash escapes (\" and \') inside the secret so a
// quote in the value cannot end redaction early.
const QUOTED_VALUE = String.raw`(?:"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')`;
const SECRET = new RegExp(
  [
    String.raw`(?:sk|pk|rk|ghp|gho|github_pat)_[A-Za-z0-9_-]{8,}`,
    String.raw`(?:sk|pk|rk)-[A-Za-z0-9_-]{8,}`,
    String.raw`AKIA[0-9A-Z]{16}`,
    String.raw`Bearer\s+[A-Za-z0-9._-]{8,}`,
    `["']?${CREDENTIAL}["']?\\s*[:=]\\s*${QUOTED_VALUE}`,
    `${CREDENTIAL}\\s*[:=]\\s*\\S+`,
  ].join("|"),
  "gi",
);

function redact(text) {
  SECRET.lastIndex = 0;
  return text.replace(SECRET, "[redacted]");
}

function normalizeFact(raw) {
  if (typeof raw !== "string") return "";
  let text = raw.replace(/\s+/g, " ").trim();
  text = text.replace(/^(?:>\s*)+/, "");
  text = text.replace(/^(?:[-*+]|\d+[.)])\s+/, "");
  text = redact(text).trim();
  if (text.length < 8) return "";
  if (text.length > MAX_FACT_CHARS) {
    const cut = text.lastIndexOf(" ", MAX_FACT_CHARS - 1);
    const at = cut > 40 ? cut : MAX_FACT_CHARS - 1;
    text = `${text.slice(0, at).trimEnd()}…`;
  }
  return text;
}

function extractMarkdownFacts(source) {
  const lines = [];
  let fence = false;
  let comment = false;
  for (const raw of source.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (!comment && /^```/.test(trimmed)) {
      fence = !fence;
      continue;
    }
    if (fence) continue;
    if (comment) {
      if (trimmed.includes("-->")) comment = false;
      continue;
    }
    if (trimmed.includes("<!--")) {
      if (!trimmed.includes("-->")) comment = true;
      continue;
    }
    lines.push(raw);
  }

  const facts = [];
  let paragraph = [];
  let bullet = null;
  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    facts.push(paragraph.join(" "));
    paragraph = [];
  };
  const flushBullet = () => {
    if (bullet === null) return;
    facts.push(bullet);
    bullet = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || /^---+$/.test(line)) {
      flushParagraph();
      flushBullet();
      continue;
    }
    const bulletMatch = line.match(/^(?:[-*+]|\d+[.)])\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      flushBullet();
      bullet = bulletMatch[1];
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      flushParagraph();
      flushBullet();
      continue;
    }
    const content = line.replace(/^(?:>\s*)+/, "");
    if (!content) continue;
    if (bullet !== null && /^\s+\S/.test(raw)) {
      bullet = `${bullet} ${content}`;
      continue;
    }
    flushBullet();
    paragraph.push(content);
  }
  flushParagraph();
  flushBullet();
  return facts.map(normalizeFact).filter(Boolean);
}

function decisionText(obj) {
  if (typeof obj.decision === "string" && obj.decision.trim()) return obj.decision;
  const point = typeof obj.decision_point === "string" ? obj.decision_point.trim() : "";
  const choice = typeof obj.choice === "string" ? obj.choice.trim() : "";
  if (point && choice) return `${point}: ${choice}`;
  return choice || point;
}

function extractJsonlFacts(source) {
  const facts = [];
  for (const line of source.split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) continue;
    const fact = normalizeFact(decisionText(obj));
    if (fact) facts.push(fact);
  }
  return facts;
}

function classify(rel) {
  if (rel === ".svc/standing-rules.md") return "standing-rules";
  if (DECISION_FILES.includes(rel) || rel.startsWith("docs/decisions/")) return "decisions";
  const base = rel.slice(rel.lastIndexOf("/") + 1);
  if (base === "OWNER-NOTES.md" && (rel === "OWNER-NOTES.md" || rel.startsWith("docs/"))) return "owner-notes";
  if (rel.startsWith("docs/owner")) return "owner-notes";
  if (base.startsWith("NOTES") && (!rel.includes("/") || rel.startsWith("docs/"))) return "notes";
  return null;
}

function allowed(rel) {
  if (rel.endsWith(".jsonl")) return true;
  if (rel.endsWith(".md") || rel.endsWith(".txt") || rel.endsWith(".markdown")) return true;
  return !path.posix.basename(rel).includes(".");
}

function contained(rootReal, absPath) {
  let real;
  try {
    real = fs.realpathSync(absPath);
  } catch {
    return false;
  }
  const rel = path.relative(rootReal, real);
  return rel === "" || (!rel.startsWith(`..${path.sep}`) && rel !== ".." && !path.isAbsolute(rel));
}

function readCapped(absPath, maxBytes, fromEnd) {
  let st;
  try {
    st = fs.lstatSync(absPath);
  } catch {
    return null;
  }
  if (st.isSymbolicLink() || !st.isFile()) return null;
  const fh = fs.openSync(absPath, "r");
  try {
    const size = st.size;
    const n = Math.min(size, maxBytes);
    const buf = Buffer.alloc(n);
    const start = fromEnd ? Math.max(0, size - n) : 0;
    fs.readSync(fh, buf, 0, n, start);
    if (buf.includes(0)) return null;
    let text = buf.toString("utf8");
    if (fromEnd && start > 0) {
      const nl = text.indexOf("\n");
      text = nl === -1 ? "" : text.slice(nl + 1);
    }
    return text;
  } finally {
    fs.closeSync(fh);
  }
}

function listFiles(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((ent) => !ent.isSymbolicLink() && ent.isFile())
    .map((ent) => ent.name)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function walkDocs(dir, rel, depth, out) {
  if (depth > MAX_DOCS_DEPTH) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const ent of entries) {
    if (ent.isSymbolicLink()) continue;
    const childRel = `${rel}/${ent.name}`;
    const childAbs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".git") continue;
      walkDocs(childAbs, childRel, depth + 1, out);
      continue;
    }
    if (ent.isFile()) out.push(childRel);
  }
}

function collectFacts(rootReal) {
  const rels = new Set();
  for (const name of listFiles(rootReal)) {
    if (name === "OWNER-NOTES.md" || name.startsWith("NOTES")) rels.add(name);
  }
  rels.add(".svc/standing-rules.md");
  for (const rel of DECISION_FILES) rels.add(rel);
  walkDocs(path.join(rootReal, "docs"), "docs", 1, {
    push(rel) { rels.add(rel); },
  });

  const facts = [];
  const ordered = [...rels].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const rel of ordered) {
    const kind = classify(rel);
    if (!kind || !allowed(rel)) continue;
    const absPath = path.join(rootReal, ...rel.split("/"));
    let st;
    try {
      st = fs.lstatSync(absPath);
    } catch {
      continue;
    }
    if (st.isSymbolicLink() || !st.isFile()) continue;
    if (!contained(rootReal, absPath)) continue;
    const jsonl = rel.endsWith(".jsonl");
    const text = readCapped(absPath, jsonl ? MAX_JSONL_BYTES : MAX_MARKDOWN_BYTES, jsonl);
    if (!text) continue;
    const extracted = jsonl ? extractJsonlFacts(text) : extractMarkdownFacts(text);
    extracted.forEach((fact, index) => {
      facts.push({ rank: RANK[kind], source: rel, text: fact, index });
    });
  }
  facts.sort((a, b) => a.rank - b.rank || (a.source < b.source ? -1 : a.source > b.source ? 1 : 0) || a.index - b.index);
  return facts;
}

function assemble(kept, cap, omitted) {
  const body = kept.map((fact) => `- requirement: ${fact.text} (${fact.source})`).join("\n");
  let shown = 0;
  let text = "";
  for (let i = 0; i < 4; i += 1) {
    const header = `k-preload facts=${kept.length} bytes=${shown} cap=${cap} truncated=${omitted}`;
    text = body ? `${header}\n${body}\n` : `${header}\n`;
    const next = Buffer.byteLength(text, "utf8");
    if (next === shown) return text;
    shown = next;
  }
  return text;
}

function dropLowest(kept) {
  let maxRank = -1;
  for (const fact of kept) if (fact.rank > maxRank) maxRank = fact.rank;
  const idx = kept.findIndex((fact) => fact.rank === maxRank);
  if (idx >= 0) kept.splice(idx, 1);
}

function finish(facts, cap) {
  const kept = facts.slice();
  for (let guard = kept.length + 1; guard >= 0; guard -= 1) {
    const omitted = facts.length - kept.length;
    const text = assemble(kept, cap, omitted);
    const bytes = Buffer.byteLength(text, "utf8");
    if (bytes <= cap) {
      return {
        text,
        bytes,
        cap,
        truncated: omitted,
        facts: kept.map((fact) => ({ text: fact.text, source: fact.source })),
      };
    }
    if (kept.length === 0) break;
    dropLowest(kept);
  }
  throw new Error("cap is smaller than the digest header");
}

export function preloadKnowledge(root, options = {}) {
  if (typeof root !== "string" || root.trim() === "") throw new Error("root is required");
  const capNumber = options.cap === undefined ? DEFAULT_CAP_BYTES : Number(options.cap);
  if (!Number.isInteger(capNumber) || capNumber < 1 || capNumber > 1_000_000) {
    throw new Error("cap must be an integer from 1 to 1000000");
  }
  const abs = path.resolve(root);
  let st;
  try {
    st = fs.lstatSync(abs);
  } catch {
    throw new Error("root not found");
  }
  if (st.isSymbolicLink() || !st.isDirectory()) throw new Error("root must be a real directory");
  const rootReal = fs.realpathSync(abs);
  return finish(collectFacts(rootReal), capNumber);
}

function parseArgs(argv) {
  const out = { root: ".", cap: String(DEFAULT_CAP_BYTES) };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--root") out.root = argv[++i];
    else if (arg.startsWith("--root=")) out.root = arg.slice("--root=".length);
    else if (arg === "--cap") out.cap = argv[++i];
    else if (arg.startsWith("--cap=")) out.cap = arg.slice("--cap=".length);
    else return { error: `unknown argument: ${arg}` };
  }
  if (out.root === undefined || out.cap === undefined) return { error: "missing value" };
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.error) {
    process.stderr.write(`k-preload: ${args.error}\n`);
    process.exit(2);
  }
  if (args.help) {
    process.stdout.write("usage: node scripts/k-preload.mjs --root <dir> [--cap <bytes>]\n");
    return;
  }
  try {
    const digest = preloadKnowledge(args.root, { cap: Number(args.cap) });
    process.stdout.write(digest.text);
  } catch (err) {
    process.stderr.write(`k-preload: ${err.message}\n`);
    process.exit(1);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
