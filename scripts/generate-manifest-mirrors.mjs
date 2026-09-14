#!/usr/bin/env node
/**
 * generate-manifest-mirrors (WI-364): render manifest/registry-sourced sections
 * into marker-delimited blocks across the 7 mirror docs.
 *
 * Sources: skills-manifest.json (lists), references/model-registry.json (model tables).
 * --check: regenerate in-memory, exit 1 on drift, message points at the sources.
 * --write: rewrite marker block contents in place.
 * Deterministic: no timestamps, no environment reads; two --write runs are byte-identical.
 *
 * README note: the included-skills block preserves the hand-curated " — description"
 * suffix per bullet (names+order+membership come from the manifest; descriptions are
 * presentation content carried by the block itself — WI-364 GREEN amendment).
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(path.join(ROOT, "skills-manifest.json"), "utf8"));
const registry = JSON.parse(readFileSync(path.join(ROOT, "references", "model-registry.json"), "utf8"));

const LABELS = ["STRAT", "PLAN", "EXEC", "REVIEW", "SENSE", "DISC", "PASS"];
const SOURCES_MSG = "edit skills-manifest.json / references/model-registry.json, then run: node scripts/generate-manifest-mirrors.mjs --write";

const bullets = (xs) => xs.map((s) => "- `" + s + "`").join("\n");
const numbered = (xs) => xs.map((s, i) => `${i + 1}. \`${s}\``).join("\n");

/** Preserve " — description" suffixes from the current block content (README). */
function bulletsWithPreservedSuffix(xs, currentBody) {
  const suffix = new Map();
  for (const line of (currentBody || "").split("\n")) {
    const m = line.match(/^- `([^`]+)`(.*)$/);
    if (m) suffix.set(m[1], m[2]);
  }
  return xs.map((s) => "- `" + s + "`" + (suffix.get(s) || "")).join("\n");
}

function disp(harness, modelKey) {
  const h = registry.harnesses[harness] || {};
  const hn = h.displayName || harness;
  if (harness === "native") return { h: hn, m: modelKey || "web_search" };
  const m = (h.models || {})[modelKey] || {};
  return { h: hn, m: m.displayName || modelKey };
}

/** svc-default table. variant: "plain" (CLAUDE.md 3-col) | "rationale" (model-routing 4-col + inline icons). */
function renderSvcDefault(variant) {
  const labels = registry.profiles["svc-default"].labels;
  const rows = LABELS.map((L) => {
    const e = labels[L] || {};
    const icon = (registry.cognitiveLabels[L] || {}).icon || "";
    const { h, m } = disp(e.harness, e.model || e.tool);
    const bold = L === "SENSE";
    const hh = bold ? `**${h}**` : h;
    const mm = bold ? `**${m}**` : m;
    if (variant === "rationale") {
      const r = e.displayRationale || e.rationale || "";
      return `| ${icon} **[${L}]** | ${hh} | ${mm} | ${r} |`;
    }
    return `| **[${L}]** | ${hh} | ${mm} |`;
  });
  return variant === "rationale"
    ? ["| Label | Harness | Model | Rationale |", "|-------|---------|-------|-----------|", ...rows].join("\n")
    : ["| Label | Harness | Model |", "|-------|---------|-------|", ...rows].join("\n");
}

/** Cognitive labels. variant: "table" (model-selection 4-col) | "numbered" (model-routing prose list). */
function renderCognitiveLabels(variant) {
  if (variant === "numbered") {
    return LABELS.map((L, i) => {
      const c = registry.cognitiveLabels[L] || {};
      const [title, blurb = ""] = (c.description || "").split(" — ");
      const cap = blurb.charAt(0).toUpperCase() + blurb.slice(1);
      return `${i + 1}.  ${c.icon || ""} **[${L}] ${title}:** ${cap}.`;
    }).join("\n");
  }
  const rows = LABELS.map((L) => {
    const c = registry.cognitiveLabels[L] || {};
    const res = L === "DISC" ? "Native web tools (no model)" : `\`scripts/resolve-model.sh ${L}\``;
    return `| **[${L}]** | ${c.icon || ""} | ${c.useFor || ""} | ${res} |`;
  });
  return ["| Label | Icon | Use for | Host Resolution |", "|-------|------|---------|-----------------|", ...rows].join("\n");
}

function renderQuickRef() {
  return [
    "```bash",
    "# Resolve the current host's model for a cognitive label",
    "bash scripts/resolve-model.sh STRAT   # Strategic reasoning",
    "bash scripts/resolve-model.sh EXEC    # File editing / execution",
    "bash scripts/resolve-model.sh REVIEW  # Code review / verification",
    "bash scripts/resolve-model.sh PASS    # Lightweight extraction",
    "```",
  ].join("\n");
}

const BLOCKS = {
  "readme-included-skills": { file: "README.md", render: (body) => bulletsWithPreservedSuffix(manifest.includedSkills, body) },
  "external-core-pack": { file: "EXTERNAL_ADDONS.md", render: () => bullets(manifest.includedSkills) },
  "repo-modes-bootstrap": { file: "REPO_MODES.md", render: () => numbered(manifest.bootstrapStartSequence) },
  "routing-rules-core-pack": { file: "skills/route-workflow/references/routing-rules.md", render: () => bullets(manifest.corePackForRouting) },
  "claude-md-svc-default": { file: "CLAUDE.md", render: () => renderSvcDefault("plain") },
  "model-selection-quick-ref": { file: "rules/common/model-selection.md", render: () => renderQuickRef() },
  "model-selection-cognitive-labels": { file: "rules/common/model-selection.md", render: () => renderCognitiveLabels("table") },
  "model-routing-svc-default": { file: "references/model-routing.md", render: () => renderSvcDefault("rationale") },
  "model-routing-cognitive-labels": { file: "references/model-routing.md", render: () => renderCognitiveLabels("numbered") },
};

const escRe = (id) => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function markerRe(id) {
  const esc = escRe(id);
  return new RegExp(`(<!--\\s*svc:generated:begin ${esc}[^>]*-->)([\\s\\S]*?)(<!--\\s*svc:generated:end ${esc}\\s*-->)`);
}

/** WI364-G6-003: a duplicated marker pair would leave the second block stale/undetected. */
function markerCount(text, id) {
  const begins = (text.match(new RegExp(`<!--\\s*svc:generated:begin ${escRe(id)}(?=[ \\-])`, "g")) || []).length;
  const ends = (text.match(new RegExp(`<!--\\s*svc:generated:end ${escRe(id)}\\s*-->`, "g")) || []).length;
  return { begins, ends };
}

function run(write) {
  const drift = [];
  const byFile = new Map();
  for (const [id, b] of Object.entries(BLOCKS)) {
    if (!byFile.has(b.file)) byFile.set(b.file, readFileSync(path.join(ROOT, b.file), "utf8"));
    const text = byFile.get(b.file);
    const { begins, ends } = markerCount(text, id);
    if (begins !== 1 || ends !== 1) {
      drift.push(`${id}: expected exactly one marker pair in ${b.file} (found ${begins} begin / ${ends} end) — ${SOURCES_MSG}`);
      continue;
    }
    const m = text.match(markerRe(id));
    if (!m) { drift.push(`${id}: markers missing in ${b.file} — ${SOURCES_MSG}`); continue; }
    const body = m[2].replace(/^\n/, "").replace(/\n$/, "");
    const want = `\n${b.render(body)}\n`;
    if (m[2] !== want) {
      if (write) byFile.set(b.file, text.replace(markerRe(id), `$1${want.replace(/\$/g, "$$$$")}$3`));
      else drift.push(`${id}: stale content in ${b.file} — ${SOURCES_MSG}`);
    }
  }
  if (write) { for (const [f, t] of byFile) writeFileSync(path.join(ROOT, f), t); console.log("mirrors regenerated"); return; }
  if (drift.length) { console.error(drift.join("\n")); process.exit(1); }
  console.log("mirrors fresh");
}

run(process.argv.includes("--write"));
