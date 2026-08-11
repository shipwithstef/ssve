#!/usr/bin/env node
// skills/research/scripts/synthesize-meaning.mjs
//
// POST-ANALYSIS DISTILLATION step. After raw extraction + classification,
// dispatches the canonical AGY launcher to read every detail file + sample of raw extractions
// for a knowledge domain, and produces:
//   <domain>/details/applied-knowledge.md
//
// Output structure (enforced by prompt + validator):
//   1. Top distilled positions per theme — verbatim quote + 1-line interpretation
//   2. Cross-domain implications — connections to project context (if --project-context provided)
//   3. Contradictions / open questions
//   4. Recency-weighted insights — newer > older
//   5. Source map — each insight cites the file+line it came from
//
// USAGE:
//   node skills/research/scripts/synthesize-meaning.mjs \
//     --domain references/knowledge/<domain>/ \
//     [--project-context "<one paragraph describing applied context, e.g. Example Marketplace fact pattern>"]

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveKnowledgePath } from './lib/knowledge-paths.mjs';

const args = process.argv.slice(2);
const get = (k) => { const i = args.indexOf(k); return i === -1 ? null : args[i + 1]; };
const domainArg = get('--domain');
const projectContext = get('--project-context') || '';
if (!domainArg) { console.error('usage: synthesize-meaning.mjs --domain <path> [--project-context "<text>"]'); process.exit(2); }
const domain = resolveKnowledgePath(domainArg);

if (!existsSync(domain)) { console.error(`domain dir not found: ${domain}`); process.exit(2); }
const detailsDir = path.join(domain, 'details');
if (!existsSync(detailsDir)) { console.error(`details/ not found in ${domain}`); process.exit(2); }

// Inventory existing detail files (skip blog-posts/ — too many; skip applied-knowledge.md to avoid recursion)
const detailFiles = [];
async function walk(dir, depth = 0) {
  if (depth > 2) return;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'blog-posts') continue; // sample handled separately
      await walk(full, depth + 1);
    } else if (e.name.endsWith('.md') && e.name !== 'applied-knowledge.md') {
      detailFiles.push(full);
    }
  }
}
await walk(detailsDir);

// Sample blog posts (newest 5)
const blogPostsDir = path.join(detailsDir, 'blog-posts');
let blogSamples = [];
if (existsSync(blogPostsDir)) {
  const all = (await readdir(blogPostsDir)).filter(f => f.endsWith('.md')).sort().reverse();
  blogSamples = all.slice(0, 5).map(f => path.join(blogPostsDir, f));
}

// Read CAPABILITIES.md as anchor
const capsPath = path.join(domain, 'CAPABILITIES.md');
const caps = existsSync(capsPath) ? await readFile(capsPath, 'utf8') : '';

console.log(`[synthesize] domain: ${domain}`);
console.log(`[synthesize] detail files: ${detailFiles.length}`);
console.log(`[synthesize] blog samples (newest 5): ${blogSamples.length}`);
console.log(`[synthesize] capabilities: ${caps.length} chars`);

// Build the input package
const sections = [];
sections.push(`# CAPABILITIES.md (anchor)\n\n${caps}`);
for (const f of detailFiles) {
  const rel = path.relative(domain, f);
  const body = await readFile(f, 'utf8');
  sections.push(`# details/${path.basename(f)}\n\n_(path: ${rel})_\n\n${body}`);
}
for (const f of blogSamples) {
  const rel = path.relative(domain, f);
  const body = await readFile(f, 'utf8');
  sections.push(`# ${rel} (sample)\n\n${body}`);
}
const inputPackage = sections.join('\n\n---\n\n');

const prompt = `You are doing the POST-ANALYSIS DISTILLATION pass for a research-skill knowledge domain. Raw + classified data already exists. Your job is to produce ONE file — applied-knowledge.md — that captures the meaningful insight WITHOUT loss.

Output sections (mandatory):

## 1. Distilled positions per theme

For each major theme (use themes from blog-content-synthesis.md if present, otherwise infer from CAPABILITIES.md):
- 3-7 verbatim quotes capturing the core legal/business position
- Each quote followed by ONE line of interpretation
- Cite source file+section the quote came from

## 2. Cross-domain implications

${projectContext ? `Project context: ${projectContext}\n\nFor each distilled position, ask: "How does this apply to the project context above?" Produce concrete actionable implications.` : 'No project context provided. List general applicability for any business reading this knowledge.'}

## 3. Contradictions / open questions

Anything the source contradicts itself on, or that the extraction left unresolved. Be honest: if the source IS internally consistent, say so.

## 4. Recency-weighted insights

Anything from posts in last 6 months that supersedes older content (legal positions evolve). Recent > old.

## 5. Source map

For each insight in section 1, the file:section reference. This lets future agents trace any claim back.

## 6. What this distillation does NOT capture

Be explicit about what was set aside (e.g., older blog posts, machine endpoints, generic SEO content). No-loss claim is only valid if the gaps are named.

CRITICAL RULES:
- Quote VERBATIM. Do NOT paraphrase legal text or prices.
- Cite source file:section for every quoted claim.
- If two sources contradict, surface the contradiction explicitly.
- Recency-weight: a 2026-04 post supersedes a 2025-06 post on the same topic.
- DO NOT invent insights not in the source files. If the source doesn't say it, don't write it.

Input package follows. The CAPABILITIES.md is the anchor; details/ files are the breadth; blog samples are the recency check.

---

${inputPackage}`;

const out = path.join(detailsDir, 'applied-knowledge.md');
console.error(`[synthesize] dispatching agy-cli; output → ${out}`);

const dispatcher = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dispatch-agy.mjs');
const result = spawnSync(process.execPath, [dispatcher, '--stdin', '--model', 'Gemini 3.5 Flash (High)', '--timeout-seconds', '1200'], {
  input: prompt,
  encoding: 'utf8',
  maxBuffer: 50 * 1024 * 1024,
  stdio: ['pipe', 'pipe', 'inherit'],
});

if (result.status !== 0) {
  console.error(`[synthesize] agy exit ${result.status}`);
  process.exit(result.status || 1);
}

await writeFile(out, result.stdout);
console.log(`[synthesize] wrote ${out} (${result.stdout.length} chars)`);
console.log(JSON.stringify({ verdict: 'ok', output: out, chars: result.stdout.length, detail_files_consumed: detailFiles.length, blog_samples: blogSamples.length }));
