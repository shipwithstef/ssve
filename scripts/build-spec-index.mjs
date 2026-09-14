#!/usr/bin/env node
/**
 * build-spec-index.mjs — Knowledge Spine: spec-index builder
 *
 * Scans docs/specs/**\/*.md and emits .svc/spec-index.json mapping each
 * heading-anchored section to {tags, topics, last_modified, byte_range}.
 *
 * Usage:
 *   node scripts/build-spec-index.mjs                # full scan
 *   node scripts/build-spec-index.mjs --incremental <path>  # update one file
 *   node scripts/build-spec-index.mjs --check        # exit non-zero if stale
 *
 * Source: proposals/done/2026-04-30-infra-project-support.md § 3.2
 * Schema: { "<file>#<slug>": { tags[], topics[], last_modified, byte_range[start,end] } }
 *
 * Tag extraction:
 *   - Frontmatter `tags:` array (yaml-style) → tags[]
 *   - Frontmatter `topics:` array → topics[]
 *   - Heading inline tags `[#tag-name]` → tags[]
 *   - Path-derived tags: docs/specs/features/<name>.md → "feature:<name>"
 *                        docs/specs/journeys/<name>.feature.md → "journey:<name>"
 *                        docs/specs/work-items/<WI>.md → "wi:<WI>"
 *
 * The index is best-effort. Skills fall back to direct Read if index missing.
 */

import { readFileSync, statSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";
import { argv, exit, cwd } from "node:process";
import { writeJsonAtomic } from "./state-io.mjs";

const REPO_ROOT = cwd();
const SPEC_GLOB_ROOTS = ["docs/specs"];
const INDEX_PATH = ".svc/spec-index.json";

function contentSha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function walk(root) {
  const out = [];
  if (!existsSync(root)) return out;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

function slugify(s) {
  return s.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pathDerivedTags(relPath) {
  const tags = [];
  const m1 = relPath.match(/^docs\/specs\/features\/([^/]+)\.md$/);
  if (m1) tags.push(`feature:${m1[1]}`);
  const m2 = relPath.match(/^docs\/specs\/journeys\/([^/]+)\.feature\.md$/);
  if (m2) tags.push(`journey:${m2[1]}`);
  const m3 = relPath.match(/^docs\/specs\/work-items\/(WI-[^.]+)\.md$/);
  if (m3) tags.push(`wi:${m3[1]}`);
  const m4 = relPath.match(/^docs\/specs\/decisions\/([^/]+)\//);
  if (m4) tags.push(`decision:${m4[1]}`);
  return tags;
}

function parseFrontmatter(content) {
  if (!content.startsWith("---")) return { fm: {}, bodyOffset: 0 };
  const end = content.indexOf("\n---", 3);
  if (end < 0) return { fm: {}, bodyOffset: 0 };
  const block = content.slice(3, end);
  const fm = {};
  for (const line of block.split("\n")) {
    const m = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (!m) continue;
    const k = m[1].trim();
    const v = m[2].trim();
    if (v.startsWith("[") && v.endsWith("]")) {
      fm[k] = v.slice(1, -1).split(",").map(s => s.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
    } else {
      fm[k] = v.replace(/^['"]|['"]$/g, "");
    }
  }
  return { fm, bodyOffset: end + 4 };
}

function extractTopicsFromContent(text) {
  // Match `topics: [a, b, c]` lines anywhere in body
  const out = new Set();
  const re = /(?:^|\n)\s*topics?:\s*\[([^\]]+)\]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    m[1].split(",").map(s => s.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean).forEach(t => out.add(t));
  }
  return [...out];
}

function indexFile(absPath) {
  const relPath = relative(REPO_ROOT, absPath);
  const stat = statSync(absPath);
  const content = readFileSync(absPath, "utf8");
  const { fm, bodyOffset } = parseFrontmatter(content);
  const fileTags = [
    ...(Array.isArray(fm.tags) ? fm.tags : []),
    ...pathDerivedTags(relPath)
  ];
  const fileTopics = [
    ...(Array.isArray(fm.topics) ? fm.topics : []),
    ...extractTopicsFromContent(content)
  ];

  const sections = {};
  // Match all headings (## and below) with their byte offsets
  const headingRe = /^(#{2,6})\s+(.+)$/gm;
  const matches = [];
  let m;
  while ((m = headingRe.exec(content)) !== null) {
    matches.push({ idx: m.index, depth: m[1].length, title: m[2].trim() });
  }

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const next = matches[i + 1];
    const start = cur.idx;
    const end = next ? next.idx : content.length;
    // Inline tag in heading: "## Foo [#bar]"
    const inlineTags = [...cur.title.matchAll(/\[#([a-z0-9-]+)\]/gi)].map(x => x[1]);
    const cleanTitle = cur.title.replace(/\s*\[#[a-z0-9-]+\]/gi, "").trim();
    const slug = slugify(cleanTitle);
    if (!slug) continue;
    const key = `${relPath}#${slug}`;
    sections[key] = {
      title: cleanTitle,
      depth: cur.depth,
      tags: [...fileTags, ...inlineTags],
      topics: fileTopics,
      last_modified: stat.mtime.toISOString(),
      byte_range: [start, end]
    };
  }

  // Also index the file itself (no section)
  if (Object.keys(sections).length === 0) {
    sections[relPath] = {
      title: fm.title || relPath,
      depth: 1,
      tags: fileTags,
      topics: fileTopics,
      last_modified: stat.mtime.toISOString(),
      byte_range: [bodyOffset, content.length]
    };
  }

  return sections;
}

function loadIndex() {
  if (!existsSync(INDEX_PATH)) return { version: 1, generated: null, files: {}, sections: {} };
  try {
    return JSON.parse(readFileSync(INDEX_PATH, "utf8"));
  } catch {
    return { version: 1, generated: null, files: {}, sections: {} };
  }
}

function saveIndex(idx) {
  writeJsonAtomic(INDEX_PATH, idx);
}

function fullScan() {
  const idx = { version: 1, generated: new Date().toISOString(), files: {}, sections: {} };
  let totalFiles = 0;
  let totalSections = 0;
  for (const root of SPEC_GLOB_ROOTS) {
    for (const file of walk(root)) {
      const rel = relative(REPO_ROOT, file);
      const sections = indexFile(file);
      idx.files[rel] = {
        sections: Object.keys(sections).length,
        last_modified: statSync(file).mtime.toISOString(),
        content_sha256: contentSha256(file),
      };
      Object.assign(idx.sections, sections);
      totalFiles++;
      totalSections += Object.keys(sections).length;
    }
  }
  saveIndex(idx);
  return { files: totalFiles, sections: totalSections };
}

function incrementalUpdate(path) {
  if (!existsSync(path)) {
    // File deleted — remove its sections
    const idx = loadIndex();
    const rel = relative(REPO_ROOT, path);
    delete idx.files[rel];
    for (const k of Object.keys(idx.sections)) {
      if (k.startsWith(rel + "#") || k === rel) delete idx.sections[k];
    }
    idx.generated = new Date().toISOString();
    saveIndex(idx);
    return { removed: rel };
  }
  if (!path.endsWith(".md")) return { skipped: path };
  const rel = relative(REPO_ROOT, path);
  if (!rel.startsWith("docs/specs/")) return { skipped: rel };
  const idx = loadIndex();
  // Drop old sections from this file
  for (const k of Object.keys(idx.sections)) {
    if (k.startsWith(rel + "#") || k === rel) delete idx.sections[k];
  }
  const sections = indexFile(path);
  Object.assign(idx.sections, sections);
  idx.files[rel] = {
    sections: Object.keys(sections).length,
    last_modified: statSync(path).mtime.toISOString(),
    content_sha256: contentSha256(path),
  };
  idx.generated = new Date().toISOString();
  saveIndex(idx);
  return { updated: rel, sections: Object.keys(sections).length };
}

function check() {
  if (!existsSync(INDEX_PATH)) {
    console.error("FAIL: spec-index missing. Run: node scripts/build-spec-index.mjs");
    exit(1);
  }
  const idx = loadIndex();
  let stale = 0;
  for (const [rel, meta] of Object.entries(idx.files)) {
    if (!existsSync(rel)) { stale++; continue; }
    // Filesystem mtimes are checkout-local and change in every clone/worktree.
    // Bind freshness to bytes so a clean Git snapshot is portable.
    if (typeof meta.content_sha256 !== "string" || contentSha256(rel) !== meta.content_sha256) stale++;
  }
  if (stale > 0) {
    console.error(`FAIL: ${stale} indexed files are stale or missing. Run full scan.`);
    exit(1);
  }
  console.log(`OK: ${Object.keys(idx.files).length} files, ${Object.keys(idx.sections).length} sections, generated ${idx.generated}`);
}

const args = argv.slice(2);
if (args[0] === "--incremental" && args[1]) {
  const result = incrementalUpdate(args[1]);
  console.log(JSON.stringify(result));
} else if (args[0] === "--check") {
  check();
} else {
  const stats = fullScan();
  console.log(`spec-index built: ${stats.files} files, ${stats.sections} sections`);
}
