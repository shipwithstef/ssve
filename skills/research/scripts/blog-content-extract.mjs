#!/usr/bin/env node
// skills/research/scripts/blog-content-extract.mjs
//
// Pulls FULL post bodies (not just metadata) for last-N-months blog posts via
// WordPress REST API. Writes one markdown file per post under
// <domain>/details/blog-posts/<date>-<slug>.md AND a synthesis report at
// <domain>/details/blog-content-synthesis.md flagging useful info.
//
// USAGE:
//   node skills/research/scripts/blog-content-extract.mjs <site-url> --domain <path> [--months 12]

import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const url = args[0];
const get = (k) => { const i = args.indexOf(k); return i === -1 ? null : args[i + 1]; };
const domainPath = get('--domain');
const months = parseInt(get('--months') || '12', 10);
if (!url || !domainPath) { console.error('usage: blog-content-extract.mjs <url> --domain <path> [--months 12]'); process.exit(2); }

const origin = new URL(url).origin;
const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - months);

function htmlToMarkdown(html) {
  return html
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n')
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '_$1_')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '_$1_')
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    .replace(/<\/?(ul|ol)[^>]*>/gi, '\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;|&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const allPosts = [];
let page = 1;
while (page <= 10) {
  const res = await fetch(`${origin}/wp-json/wp/v2/posts?per_page=100&page=${page}&_fields=id,date,modified,link,slug,title,content,excerpt`);
  if (!res.ok) break;
  const batch = await res.json();
  if (!Array.isArray(batch) || batch.length === 0) break;
  allPosts.push(...batch);
  if (batch.length < 100) break;
  page++;
}

const recent = allPosts
  .filter(p => new Date(p.date) >= cutoff)
  .sort((a, b) => new Date(b.date) - new Date(a.date));

console.log(`[blog-content] fetched ${allPosts.length} total, ${recent.length} in last ${months}mo`);

const postsDir = path.join(domainPath, 'details', 'blog-posts');
if (!existsSync(postsDir)) await mkdir(postsDir, { recursive: true });

// Write each post as its own md file
const written = [];
for (const p of recent) {
  const dateStr = p.date.slice(0, 10);
  const slug = (p.slug || `post-${p.id}`).slice(0, 60);
  const fname = `${dateStr}-${slug}.md`;
  const title = (p.title?.rendered || '').replace(/<[^>]+>/g, '').trim() || `(post ${p.id})`;
  const body = htmlToMarkdown(p.content?.rendered || '');
  const excerpt = htmlToMarkdown(p.excerpt?.rendered || '');
  const md = `---
date: ${p.date}
modified: ${p.modified}
url: ${p.link}
title: "${title.replace(/"/g, '\\"')}"
post_id: ${p.id}
---

# ${title}

**Published:** ${dateStr} | **Modified:** ${p.modified.slice(0, 10)} | **URL:** ${p.link}

## Excerpt

${excerpt || '_(none)_'}

## Body

${body}
`;
  await writeFile(path.join(postsDir, fname), md);
  written.push({ date: dateStr, title, slug, file: `details/blog-posts/${fname}`, body_length: body.length });
}

// Synthesis: identify themes + pricing + legal-economics signals + builder-relevant flags
const synthLines = [
  `# Blog Content Synthesis — Last ${months} Months`,
  '',
  `**Source:** WordPress REST API (\`${origin}/wp-json/wp/v2/posts\`)`,
  `**Generated:** ${new Date().toISOString()}`,
  `**Total posts in last ${months}mo:** ${recent.length}`,
  `**Total characters of body content extracted:** ${written.reduce((s, p) => s + p.body_length, 0)}`,
  '',
  '## Post inventory',
  '',
  '| Date | Title | File | Body chars |',
  '|---|---|---|---|',
  ...written.map(w => `| ${w.date} | ${w.title.slice(0, 80)} | [${path.basename(w.file)}](${w.file}) | ${w.body_length} |`),
  '',
];

// Theme detection on titles + body
const themes = {
  'AI / технологии': /(?:^|[^а-яёА-ЯЁa-zA-Z])(AI|изкуствен интелект|ИИ|алгоритъм|автоматизация|технология|онлайн платформа|GDPR|данни)(?=[^а-яёА-ЯЁa-zA-Z]|$)/i,
  'Корпоративно право / ЕООД / ООД': /(?:^|[^а-яёА-ЯЁa-zA-Z])(ЕООД|ООД|АД|ЕТ|дружество|съдружник|капитал|устав|управител|дялове)(?=[^а-яёА-ЯЁa-zA-Z]|$)/i,
  'Свободна професия / фрийланс': /(?:^|[^а-яёА-ЯЁa-zA-Z])(свободна професия|фрийлансър|freelance|самоосигуряване|подизпълнител)(?=[^а-яёА-ЯЁa-zA-Z]|$)/i,
  'Данъци / ДДС / ЗДДС': /(?:^|[^а-яёА-ЯЁa-zA-Z])(ДДС|ЗДДС|данък|данъчно|чл\. ?97|корпоративен данък|годишна декларация)(?=[^а-яёА-ЯЁa-zA-Z]|$)/i,
  'Договори / задължения': /(?:^|[^а-яёА-ЯЁa-zA-Z])(договор|неустойка|задължение|давност|обезщетение|отказ от)(?=[^а-яёА-ЯЁa-zA-Z]|$)/i,
  'Имоти / недвижим имот': /(?:^|[^а-яёА-ЯЁa-zA-Z])(недвижим имот|имот|зелено|строителство|нотариус|акт ?16|собственост)(?=[^а-яёА-ЯЁa-zA-Z]|$)/i,
  'Търговска марка / IP': /(?:^|[^а-яёА-ЯЁa-zA-Z])(търговска марка|марка|интелектуална собственост|авторско право|EUIPO|ваучер)(?=[^а-яёА-ЯЁa-zA-Z]|$)/i,
  'Трудово право': /(?:^|[^а-яёА-ЯЁa-zA-Z])(трудов договор|работодател|служител|уволнение|обезщетение при уволнение|трудови права)(?=[^а-яёА-ЯЁa-zA-Z]|$)/i,
  'Развод / семейно': /(?:^|[^а-яёА-ЯЁa-zA-Z])(развод|брак|съпруг|съпружеска|издръжка)(?=[^а-яёА-ЯЁa-zA-Z]|$)/i,
  'Колекторски / дългове': /(?:^|[^а-яёА-ЯЁa-zA-Z])(колектор|ЕОС|давност|отписване|вземане)(?=[^а-яёА-ЯЁa-zA-Z]|$)/i,
  'EUR / валутна реформа': /(?:^|[^а-яёА-ЯЁa-zA-Z])(евро|еврото|валута|валутно|преобразуване)(?=[^а-яёА-ЯЁa-zA-Z]|$)/i,
};

const themeBuckets = {};
for (const t of Object.keys(themes)) themeBuckets[t] = [];

for (const p of recent) {
  const text = ((p.title?.rendered || '') + ' ' + (p.content?.rendered || '') + ' ' + (p.excerpt?.rendered || '')).slice(0, 50000);
  for (const [theme, re] of Object.entries(themes)) {
    if (re.test(text)) themeBuckets[theme].push({ date: p.date.slice(0, 10), title: (p.title?.rendered || '').replace(/<[^>]+>/g, '').trim(), url: p.link });
  }
}

synthLines.push('## Theme distribution', '');
synthLines.push('| Theme | Count | Posts |');
synthLines.push('|---|---|---|');
for (const [theme, posts] of Object.entries(themeBuckets).sort((a, b) => b[1].length - a[1].length)) {
  if (posts.length === 0) continue;
  const list = posts.slice(0, 5).map(p => `${p.date}`).join(', ') + (posts.length > 5 ? `… (+${posts.length - 5})` : '');
  synthLines.push(`| ${theme} | ${posts.length} | ${list} |`);
}
synthLines.push('');

// Example Marketplace-relevant flags
synthLines.push('## Example Marketplace-relevant signals (auto-flagged)', '');
const example-marketplaceRelevant = [];
for (const p of recent) {
  const t = ((p.title?.rendered || '') + (p.content?.rendered || '')).slice(0, 30000);
  const tags = [];
  if (/(?:^|[^а-яёА-ЯЁa-zA-Z])(AI|изкуствен интелект|алгоритъм)(?=[^а-яёА-ЯЁa-zA-Z]|$)/i.test(t) && /(?:^|[^а-яёА-ЯЁa-zA-Z])(бизнес|предприемач|risk|рискове)(?=[^а-яёА-ЯЁa-zA-Z]|$)/i.test(t)) tags.push('AI-business-risk');
  if (/(?:^|[^а-яёА-ЯЁa-zA-Z])(свободна професия|самоосигуряване|БУЛСТАТ)(?=[^а-яёА-ЯЁa-zA-Z]|$)/i.test(t)) tags.push('свободна-професия');
  if (/\bЕООД\b/i.test(t) && /\bЕТ\b/i.test(t)) tags.push('EOOD-vs-ET');
  if (/\bваучер\b/i.test(t) && /\bмарка\b/i.test(t)) tags.push('EUIPO-trademark-voucher');
  if (/\bтрудов\b/i.test(t) && /(?:^|[^а-яёА-ЯЁa-zA-Z])(IP|интелектуална|клауза)(?=[^а-яёА-ЯЁa-zA-Z]|$)/i.test(t)) tags.push('trudov-IP-clause');
  if (/\bевр\w+\b/i.test(t) && /(?:^|[^а-яёА-ЯЁa-zA-Z])(дружеств|документ|преобраз)(?=[^а-яёА-ЯЁa-zA-Z]|$)/i.test(t)) tags.push('EUR-transition');
  if (/\bдоговор\b/i.test(t) && /\bфрийланс\b/i.test(t)) tags.push('freelancer-contract');
  if (tags.length > 0) {
    example-marketplaceRelevant.push({
      date: p.date.slice(0, 10),
      title: (p.title?.rendered || '').replace(/<[^>]+>/g, '').trim(),
      url: p.link,
      tags,
    });
  }
}
if (example-marketplaceRelevant.length === 0) {
  synthLines.push('_None matched Example Marketplace-relevant signal patterns._');
} else {
  synthLines.push('| Date | Title | Tags | URL |');
  synthLines.push('|---|---|---|---|');
  for (const h of example-marketplaceRelevant) synthLines.push(`| ${h.date} | ${h.title} | \`${h.tags.join('`, `')}\` | [link](${h.url}) |`);
}

await writeFile(path.join(domainPath, 'details', 'blog-content-synthesis.md'), synthLines.join('\n'));

console.log(JSON.stringify({
  total_posts_fetched: allPosts.length,
  posts_in_window: recent.length,
  body_files_written: written.length,
  total_body_chars: written.reduce((s, p) => s + p.body_length, 0),
  themes: Object.fromEntries(Object.entries(themeBuckets).map(([k, v]) => [k, v.length])),
  example-marketplace_relevant_count: example-marketplaceRelevant.length,
  synthesis_file: path.join(domainPath, 'details', 'blog-content-synthesis.md'),
}, null, 2));
