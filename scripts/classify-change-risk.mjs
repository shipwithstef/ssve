#!/usr/bin/env node
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CLASSIFIER_VERSION = 1;
const HIGH_PATH_RULES = [
  [/(^|\/)(auth|authorization|permissions?|rls|polic(?:y|ies)|security|rbac|acl|oauth|jwt|sso|login|sessions?|guards?|middleware|access[-_]?control)(\/|\.|$)/i, "auth-policy-security"],
  [/(^|\/)(billing|payments?|checkout|money|pricing)(\/|\.|$)/i, "billing-money"],
  [/(^|\/)(schemas?|migrations?|database|db)(\/|\.|$)/i, "schema-migration"],
  [/(^|\/)(shared|common)\/(components?|layout)(\/|\.|$)|(^|\/)layout\.[^.]+$/i, "shared-layout-component"],
  [/(feature[-_.]?flags?|flags?\.json)/i, "feature-flag"],
  [/^(hooks?|agents?)(\/|\.|$)|(^|\/)\.git\/hooks?(\/|$)|^\.svc\/lane-tasks-|session-worktree-binding/i, "host-hook-task-graph"],
  [/(^|\/)(release|signing|provisioning|version(?:code|name)?)(\/|\.|$)|(^|\/)(build\.gradle|info\.plist|app\.json)$/i, "release-signing-version"],
];
const EXECUTABLE_EXT = /\.(?:[cm]?[jt]sx?|sh|bash|zsh|py|rb|go|rs|java|kt|swift|c|cc|cpp|h|hpp|sql|toml|ya?ml|html|css|scss|json|jsonl)$/i;
const TEXT_EXT = /\.(?:md|mdx|txt|rst|adoc)$/i;
// Documents whose text changes behavior (agent instructions, rules, skills) or the contract (spec ACs).
const SEMANTIC_DOC_RULES = [
  [/^skills\//i, "semantic-document-path"],
  [/^rules\//i, "semantic-document-path"],
  [/(^|\/)(?:CLAUDE|AGENTS)\.md$/i, "semantic-document-path"],
];
const SPEC_PATH = /^docs\/specs\/.*\.(?:md|mdx|txt|rst|adoc)$/i;
const AC_LINE = /\bAC[-_ ]?\d+(?:\.\d+)?\b|acceptance[- ]criteri|^[+-]\s*(?:[-*]\s*)?(?:\*\*)?(?:given|when|then)\b/im;
const AC_HEADING = /^#{1,6}\s.*(?:acceptance[- ]criteri|\bACs?\b|success criteria|definition of done)/i;
const STRUCTURAL = /(^|\n)[+-](?![+-])\s*(?:import|export|function|class|interface|type|enum|const|let|var|if|else|for|while|switch|case|return|throw|try|catch|async|await)\b|=>|\b(?:function|class)\s+\w+/m;

function runGit(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
}

function parseRows(text) {
  return text.split(/\r?\n/).filter(Boolean).map((line) => {
    const parts = line.split("\t");
    return { status: parts[0], paths: parts.slice(1) };
  });
}

function higherTier(a, b) {
  const rank = { cosmetic: 0, logic: 1, high: 2 };
  return rank[a] >= rank[b] ? a : b;
}

function splitDiffByFile(diff) {
  const sections = new Map();
  let current = null;
  for (const line of String(diff).split(/\r?\n/)) {
    const m = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (m) { current = m[2]; sections.set(current, []); continue; }
    if (!current) continue;
    const body = sections.get(current);
    if (body.length || line.startsWith("@@")) body.push(line); // skip ---/+++ file headers
  }
  return sections;
}

// True when a spec edit touches acceptance criteria: an AC-looking changed line,
// or (when the new file content is available) a hunk inside an AC section.
function specTouchesAcceptanceCriteria(lines, content) {
  const changed = lines.filter((l) => /^[+-]/.test(l) && !/^(?:---|\+\+\+) [ab\/]/.test(l));
  if (AC_LINE.test(changed.join("\n"))) return true;
  if (typeof content !== "string") return false;
  const fileLines = content.split(/\r?\n/);
  // inAc[n]: line n sits inside an AC section, including nested sub-headings, which
  // end only at a heading of the same or higher level.
  const inAc = [];
  const stack = [];
  let fence = false;
  fileLines.forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) fence = !fence;
    const h = !fence && l.match(/^(#{1,6})\s/);
    if (h) {
      while (stack.length && stack[stack.length - 1].level >= h[1].length) stack.pop();
      stack.push({ level: h[1].length, ac: AC_HEADING.test(l) });
    }
    inAc[i + 1] = stack.some((e) => e.ac);
  });
  for (const l of lines) {
    const h = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (!h) continue;
    const start = Number(h[1]);
    const count = h[2] === undefined ? 1 : Number(h[2]);
    const end = count === 0 ? start : start + count - 1;
    for (let n = Math.max(1, start); n <= end; n += 1) if (inAc[n]) return true;
  }
  return false;
}

function classifyPath(file, ctx = {}) {
  const reasons = [];
  for (const [pattern, reason] of HIGH_PATH_RULES) if (pattern.test(file)) reasons.push(reason);
  if (reasons.length) return { tier: "high", reasons };
  for (const [pattern, reason] of SEMANTIC_DOC_RULES) if (pattern.test(file)) return { tier: "logic", reasons: [reason] };
  if (SPEC_PATH.test(file) && ctx.specLines && specTouchesAcceptanceCriteria(ctx.specLines, ctx.content)) {
    return { tier: "logic", reasons: ["spec-acceptance-criteria"] };
  }
  if (/^(?:\.svc|references|docs\/learnings)\/.*\.jsonl$/i.test(file)) return { tier: "cosmetic", reasons: ["append-ledger-path"] };
  if (/^(docs|references|proposals)\//i.test(file) && TEXT_EXT.test(file)) return { tier: "cosmetic", reasons: ["text-or-document-path"] };
  if (EXECUTABLE_EXT.test(file)) return { tier: "logic", reasons: ["executable-or-config-path"] };
  if (TEXT_EXT.test(file)) return { tier: "cosmetic", reasons: ["text-or-document-path"] };
  return { tier: "logic", reasons: ["unknown-extension-not-cosmetic"] };
}

export function classifyChangeRisk({ diff, rows, numstat = "", readNew = null }) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("no changed paths to classify");
  let tier = "cosmetic";
  const reasons = new Set();
  const paths = [];
  const sections = splitDiffByFile(diff);
  const wholeDiff = String(diff).split(/\r?\n/);
  const ctxFor = (file) => {
    if (!SPEC_PATH.test(file)) return {};
    let content;
    try { content = readNew ? readNew(file) : undefined; } catch { content = undefined; }
    // No per-file section (headerless diff): examine the whole diff, the conservative choice.
    return { specLines: sections.get(file) ?? wholeDiff, content };
  };
  for (const row of rows) {
    if (!row.paths.length) throw new Error("malformed name-status row");
    const renameOrDelete = /^R|^C|^D/.test(row.status);
    for (const file of row.paths) {
      paths.push(file);
      const result = classifyPath(file, ctxFor(file));
      tier = higherTier(tier, result.tier);
      result.reasons.forEach((reason) => reasons.add(reason));
    }
    if (renameOrDelete) reasons.add("rename-or-delete-inherits-highest-path-risk");
  }
  const binary = /(^|\n)-\t-\t/.test(numstat) || /^(?:GIT binary patch|Binary files .* differ)$/m.test(diff);
  if (binary) { tier = "high"; reasons.add("binary-or-generated-ambiguity"); }
  const symbolSignals = [];
  const changedLines = String(diff).split(/\r?\n/).filter((line) => /^[+-](?![+-])/.test(line)).join("\n");
  if (STRUCTURAL.test(changedLines) && paths.some((file) => classifyPath(file, ctxFor(file)).tier !== "cosmetic")) symbolSignals.push("structural-symbol-or-control-flow");
  if (symbolSignals.length && tier === "cosmetic") tier = "logic";
  symbolSignals.forEach((signal) => reasons.add(signal));
  const normalized = JSON.stringify({ version: CLASSIFIER_VERSION, rows, diff: String(diff).replace(/\r\n/g, "\n") });
  const sha256 = crypto.createHash("sha256").update(normalized).digest("hex");
  const requiredProof = tier === "high"
    ? ["different-family-independent-review", "behavioral-runtime-proof"]
    : tier === "logic" ? ["mapped-test"] : ["static-diff-proof"];
  return {
    classifier_version: CLASSIFIER_VERSION,
    tier,
    reasons: [...reasons].sort(),
    paths: [...new Set(paths)],
    symbol_signals: symbolSignals,
    never_fast_lane: tier !== "cosmetic",
    required_proof: requiredProof,
    sha256,
  };
}

export function classifyFromGit({ cwd = process.cwd(), staged = true, range = null } = {}) {
  const root = runGit(["rev-parse", "--show-toplevel"], cwd).trim();
  const common = staged ? ["--cached"] : [range];
  const rows = parseRows(runGit(["diff", ...common, "--name-status", "-M", "-C"], root));
  const diff = runGit(["diff", ...common, "--binary", "--unified=0"], root);
  const numstat = runGit(["diff", ...common, "--numstat", "-M", "-C"], root);
  const rev = staged ? "" : range.split("...")[1];
  const readNew = (file) => runGit(["show", `${rev}:${file}`], root);
  return classifyChangeRisk({ diff, rows, numstat, readNew });
}

function parseArgs(argv) {
  const args = { staged: true, range: null, json: false, explain: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--staged") args.staged = true;
    else if (argv[i] === "--diff") { args.range = argv[++i]; args.staged = false; }
    else if (argv[i] === "--json") args.json = true;
    else if (argv[i] === "--explain") args.explain = true;
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  if (!args.staged && (!args.range || !args.range.includes("..."))) throw new Error("--diff requires BASE...HEAD");
  return args;
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = classifyFromGit(args);
    if (args.explain && !args.json) {
      process.stdout.write(`${result.tier}: ${result.reasons.join(", ")}\n`);
    } else {
      process.stdout.write(`${JSON.stringify(result, null, args.json ? 2 : 0)}\n`);
    }
  } catch (error) {
    process.stderr.write(`classify-change-risk: ${error.message}\n`);
    process.exit(2);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
