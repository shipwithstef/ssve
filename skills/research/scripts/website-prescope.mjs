#!/usr/bin/env node
// skills/research/scripts/website-prescope.mjs
//
// Generates a pre-scope manifest for a website source by:
//   1. Fetching robots.txt → finds sitemap URL(s)
//   2. Fetching sitemap.xml → enumerates ALL URLs
//   3. Fetching homepage HTML → grep for footer/imprint patterns (BULSTAT, EIK, VAT, ДДС)
//      and any links not in sitemap
//   4. Writing docs/specs/research-prescope-<slug>.md with the full URL checklist
//
// Catches: "agent forgot to enumerate sub-pages" failure mode.
//
// USAGE:
//   node skills/research/scripts/website-prescope.mjs <url> [--domain <domain>]
//
// EXIT 0 on success; non-zero on fetch errors.

import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { getKnowledgeRoot } from './lib/knowledge-paths.mjs';

const args = process.argv.slice(2);
const url = args[0];
if (!url) {
  console.error('usage: website-prescope.mjs <url> [--domain <domain>]');
  process.exit(2);
}
const domainArg = args.indexOf('--domain') !== -1 ? args[args.indexOf('--domain') + 1] : null;
const knowledgeRoot = getKnowledgeRoot();

const u = new URL(url);
const origin = u.origin;
const slug = u.hostname.replace(/[^a-z0-9]/gi, '-').toLowerCase();

async function fetchText(target) {
  try {
    const res = await fetch(target, { redirect: 'follow', headers: { 'User-Agent': 'svc-research/1.0' } });
    if (!res.ok) return { ok: false, status: res.status, body: '' };
    return { ok: true, status: res.status, body: await res.text() };
  } catch (e) {
    return { ok: false, status: 0, body: '', error: e.message };
  }
}

console.log(`[prescope] origin: ${origin}`);

// 1. robots.txt
const robots = await fetchText(`${origin}/robots.txt`);
const sitemapUrls = [];
if (robots.ok) {
  for (const line of robots.body.split('\n')) {
    const m = line.match(/^Sitemap:\s*(\S+)/i);
    if (m) sitemapUrls.push(m[1]);
  }
}
if (sitemapUrls.length === 0) sitemapUrls.push(`${origin}/sitemap.xml`);
console.log(`[prescope] sitemap URLs: ${sitemapUrls.join(', ')}`);

// 2. sitemap(s) — recursive index handling
const allUrls = new Set();
async function expandSitemap(sm) {
  const r = await fetchText(sm);
  if (!r.ok) return;
  // sitemapindex
  for (const m of r.body.matchAll(/<sitemap>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/sitemap>/g)) {
    await expandSitemap(m[1]);
  }
  // urlset
  for (const m of r.body.matchAll(/<url>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/url>/g)) {
    allUrls.add(m[1].trim());
  }
}
for (const sm of sitemapUrls) await expandSitemap(sm);
console.log(`[prescope] sitemap URLs found: ${allUrls.size}`);

// 3. Homepage — extract internal links + grep for imprint
const home = await fetchText(origin + '/');
if (home.ok) {
  for (const m of home.body.matchAll(/href=["']([^"']+)["']/g)) {
    let link = m[1];
    if (link.startsWith('/')) link = origin + link;
    if (link.startsWith(origin) && !link.match(/\.(jpg|png|gif|css|js|svg|webp|ico|pdf)/i) && !link.includes('#')) {
      allUrls.add(link.split('?')[0]);
    }
  }
}

// 3b. Imprint hunt — grep ALL likely-imprint pages, not just homepage
// (homepage often skips legal info; общи-условия / за-нас / контакти carry it)
const imprintCandidates = [
  origin + '/',
  origin + '/общи-условия/',
  origin + '/контакти/',
  origin + '/за-нас/',
  origin + '/about/',
  origin + '/contact/',
  origin + '/terms/',
  origin + '/политика-за-поверителност/',
  origin + '/privacy/',
  origin + '/imprint/',
];
// Add any sitemap URLs that look legal-page-ish
for (const u of allUrls) {
  if (/общи|услов|terms|legal|privacy|политик|за-нас|about|impr|контакт|contact/i.test(u)) {
    imprintCandidates.push(u);
  }
}
const uniqCandidates = [...new Set(imprintCandidates)];

const imprintFindings = [];
const imprintPatterns = [
  /BULSTAT[:\s№]*[0-9]{9,13}/gi,
  /БУЛСТАТ[:\s№]*[0-9]{9,13}/gi,
  /ЕИК[:\s№]*[0-9]{9,13}/gi,
  /EIK[:\s№]*[0-9]{9,13}/gi,
  /ДДС[\s№:]*BG[0-9]{9,13}/gi,
  /VAT[:\s№]*BG[0-9]{9,13}/gi,
  /адвокат\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+(\s+[А-ЯЁ][а-яё]+)?/gi,
  /[Аа]двокатска\s+колегия\s*[—–-]?\s*[А-Яа-я]+/g,
  /рег\.\s*№[:\s]*[0-9]+/gi,
];
const imprintSourceMap = {};
for (const candidate of uniqCandidates) {
  const enc = encodeURI(candidate);
  const r = await fetchText(enc);
  if (!r.ok) continue;
  for (const re of imprintPatterns) {
    const matches = r.body.match(re);
    if (matches) {
      for (const m of matches) {
        imprintFindings.push(m.trim());
        imprintSourceMap[m.trim()] = candidate;
      }
    }
  }
}
// Dedupe imprint findings
const dedupedImprint = [...new Set(imprintFindings)];

const urlList = [...allUrls].sort();
console.log(`[prescope] total unique URLs: ${urlList.length}`);
console.log(`[prescope] imprint pages probed: ${uniqCandidates.length}`);
console.log(`[prescope] imprint patterns found (deduped): ${dedupedImprint.length}`);
for (const m of dedupedImprint) console.log(`  ${m}  (from ${imprintSourceMap[m]})`);

// 4. Write prescope artifact
const outDir = path.resolve(process.cwd(), 'docs/specs');
if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, `research-prescope-${slug}.md`);

const ts = new Date().toISOString();
const md = `# Research Pre-Scope — ${u.hostname}

**Generated:** ${ts}
**Source:** ${origin}
**Generator:** skills/research/scripts/website-prescope.mjs
**Proposed domain:** ${domainArg || 'TBD — run domain-gate.mjs'}

## Sub-agent selection

- **Primary:** agy-cli (per rules/research-must-use-agy-cli.md)
- **Selected for this run:** agy-cli — long-context site extraction
- **Fallback if agy-cli fails:** Claude in-session via WebFetch loop

## Volume estimate

- Sitemap URLs found: ${urlList.length}
- Imprint pattern matches on homepage: ${imprintFindings.length}
- robots.txt fetched: ${robots.ok ? 'yes' : 'no'}
- Homepage fetched: ${home.ok ? 'yes' : 'no'}

## Imprint patterns detected (across homepage + likely-imprint pages)

Pages probed: ${uniqCandidates.length}
- ${uniqCandidates.join('\n- ')}

Matches (deduped, with source):
${dedupedImprint.length === 0 ? '_None matched. Either site has no public imprint OR patterns need extension. Verify manually before declaring "no EIK"._' : dedupedImprint.map(m => `- \`${m}\` _(from ${imprintSourceMap[m]})_`).join('\n')}

## File checklist (URLs to extract)

Every URL below MUST be fetched, read in full, and have an extraction entry in the corresponding details/ file or CAPABILITIES.md.

${urlList.map(u => `- [ ] ${u}`).join('\n')}

## Extraction plan

- Output domain: \`${path.join(knowledgeRoot, domainArg || '<TBD>')}/\`
- CAPABILITIES.md: site identity, services, pricing, legal status
- details/about.md: ownership, advocate names, Bar registration, EIK/BULSTAT, VAT
- details/services.md: each service with verbatim pricing
- details/legal.md: T&C, refund policy, disclaimers, supervisory authority
- details/contact.md: contact methods, address, sub-pages list

## Expected output artifacts

- \`references/knowledge/<domain>/CAPABILITIES.md\`
- \`references/knowledge/<domain>/details/*.md\` (one per area)
- \`references/knowledge/<domain>/.version\`
- \`references/knowledge/<domain>/.sources.jsonl\` (one entry per URL above)
- \`docs/specs/research-log.md\` (append entry)
- INDEX.md updated

## Coverage gate

After extraction, run:
\`\`\`
node skills/research/scripts/coverage-check.mjs --prescope ${outPath} --domain references/knowledge/<domain>/
\`\`\`
Coverage must be 100% (every checklist URL appears in .sources.jsonl).
`;

await writeFile(outPath, md);
console.log(`[prescope] wrote ${outPath}`);
console.log(JSON.stringify({ verdict: 'ok', prescope: outPath, urls: urlList.length, imprint_matches: imprintFindings.length }));
