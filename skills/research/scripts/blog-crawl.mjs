#!/usr/bin/env node
// skills/research/scripts/blog-crawl.mjs
//
// Crawls the last N months of blog/news posts from a website source,
// extracts dates + titles + URLs, and writes:
//   1. <domain>/details/blog-recent.md      — readable blog inventory with dates
//   2. <domain>/.activity.json              — activity scorecard (post counts, freshness)
//
// Detection paths (in order):
//   1. WordPress REST API (/wp-json/wp/v2/posts) — preferred
//   2. RSS feed (/feed/, /rss/, /atom.xml) — fallback
//   3. Sitemap.xml news / posts section — last fallback
//
// Activity scorecard fields:
//   {
//     posts_in_last_12mo: <n>,
//     posts_in_last_6mo: <n>,
//     posts_in_last_3mo: <n>,
//     latest_post_date: "<ISO>",
//     latest_post_url: "<url>",
//     activity_verdict: "active" | "dormant" | "abandoned",
//     verdict_reason: "<sentence>"
//   }
//
// Activity rules (default):
//   - active     = post in last 6 months
//   - dormant    = post in last 6-12 months but no post in last 6 months
//   - abandoned  = no post in last 12 months
//
// USAGE:
//   node skills/research/scripts/blog-crawl.mjs <site-url> --domain <knowledge-domain-path> [--months 12]
//
// EXIT 0 always (writes outputs even on partial success); reports failures via stderr.

import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { resolveKnowledgePath } from './lib/knowledge-paths.mjs';

const args = process.argv.slice(2);
const url = args[0];
const get = (k) => { const i = args.indexOf(k); return i === -1 ? null : args[i + 1]; };
const domainPathArg = get('--domain');
const monthsArg = parseInt(get('--months') || '12', 10);
if (!url || !domainPathArg) {
  console.error('usage: blog-crawl.mjs <site-url> --domain <path> [--months 12]');
  process.exit(2);
}
const domainPath = resolveKnowledgePath(domainPathArg);

const u = new URL(url);
const origin = u.origin;
const now = new Date();
const cutoffMonths = (m) => new Date(now.getFullYear(), now.getMonth() - m, now.getDate());
const cutoff12 = cutoffMonths(monthsArg);
const cutoff6 = cutoffMonths(6);
const cutoff3 = cutoffMonths(3);

async function fetchJSON(target) {
  try {
    const res = await fetch(target, { redirect: 'follow', headers: { 'User-Agent': 'svc-research-blog-crawl/1.0', 'Accept': 'application/json' } });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, status: res.status, data: await res.json() };
  } catch (e) { return { ok: false, status: 0, error: e.message }; }
}
async function fetchText(target) {
  try {
    const res = await fetch(target, { redirect: 'follow', headers: { 'User-Agent': 'svc-research-blog-crawl/1.0' } });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, status: res.status, body: await res.text() };
  } catch (e) { return { ok: false, status: 0, error: e.message }; }
}

const posts = [];
let source = null;

// 1. Try WP REST API
console.log(`[blog-crawl] trying WP REST API: ${origin}/wp-json/wp/v2/posts`);
let page = 1;
const perPage = 100;
while (true) {
  const r = await fetchJSON(`${origin}/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}&_fields=id,date,modified,link,title`);
  if (!r.ok || !Array.isArray(r.data) || r.data.length === 0) break;
  for (const post of r.data) {
    posts.push({
      url: post.link,
      title: typeof post.title === 'object' ? post.title.rendered : post.title,
      date: post.date,
      modified: post.modified,
    });
  }
  if (r.data.length < perPage) break;
  page++;
  if (page > 20) break; // safety cap (~2000 posts)
}
if (posts.length > 0) source = 'wp-json';

// 2. Fallback: RSS
if (posts.length === 0) {
  console.log(`[blog-crawl] WP REST empty, trying RSS: ${origin}/feed/`);
  for (const feedPath of ['/feed/', '/rss/', '/feed/atom/', '/atom.xml']) {
    const r = await fetchText(origin + feedPath);
    if (!r.ok) continue;
    for (const m of r.body.matchAll(/<item>[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>[\s\S]*?<link>([^<]+)<\/link>[\s\S]*?<pubDate>([^<]+)<\/pubDate>[\s\S]*?<\/item>/g)) {
      posts.push({ title: m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim(), url: m[2].trim(), date: new Date(m[3]).toISOString(), modified: null });
    }
    if (posts.length > 0) { source = 'rss'; break; }
  }
}

// 3. Fallback: sitemap with image:image / video:video / news:news heuristics
if (posts.length === 0) {
  console.log(`[blog-crawl] RSS empty, trying sitemap: ${origin}/sitemap.xml`);
  const r = await fetchText(origin + '/sitemap.xml');
  if (r.ok) {
    for (const m of r.body.matchAll(/<url>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<lastmod>([^<]+)<\/lastmod>[\s\S]*?<\/url>/g)) {
      const link = m[1].trim();
      // Heuristic: blog post URLs often have /YYYY/MM/ or /blog/ or /news/ in slug
      if (/(blog|news|articles?|posts?|\/\d{4}\/\d{2}\/)/i.test(link)) {
        posts.push({ url: link, title: link.split('/').filter(Boolean).pop(), date: m[2].trim(), modified: m[2].trim() });
      }
    }
    if (posts.length > 0) source = 'sitemap';
  }
}

console.log(`[blog-crawl] source: ${source || 'none'}; posts found: ${posts.length}`);

// Filter to last N months
const recent = posts.filter(p => {
  const d = new Date(p.date);
  return !isNaN(d) && d >= cutoff12;
}).sort((a, b) => new Date(b.date) - new Date(a.date));

const inLast6 = recent.filter(p => new Date(p.date) >= cutoff6);
const inLast3 = recent.filter(p => new Date(p.date) >= cutoff3);

// Activity verdict
let verdict, verdictReason;
if (inLast6.length > 0) {
  verdict = 'active';
  verdictReason = `${inLast6.length} post(s) in last 6 months; latest ${recent[0]?.date}`;
} else if (recent.length > 0) {
  verdict = 'dormant';
  verdictReason = `last post ${recent[0].date}; nothing in last 6 months`;
} else if (posts.length > 0) {
  verdict = 'abandoned';
  const lastEver = posts.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  verdictReason = `last post ever was ${lastEver?.date} (>${monthsArg} months ago)`;
} else {
  verdict = 'unknown';
  verdictReason = 'no blog source detected (no wp-json, RSS, or sitemap blog URLs)';
}

const scorecard = {
  source,
  total_posts_found: posts.length,
  posts_in_last_12mo: recent.length,
  posts_in_last_6mo: inLast6.length,
  posts_in_last_3mo: inLast3.length,
  latest_post_date: recent[0]?.date || posts.sort((a, b) => new Date(b.date) - new Date(a.date))[0]?.date || null,
  latest_post_url: recent[0]?.url || null,
  activity_verdict: verdict,
  verdict_reason: verdictReason,
  generated_at: new Date().toISOString(),
};

// Write activity.json
if (!existsSync(domainPath)) await mkdir(domainPath, { recursive: true });
await writeFile(path.join(domainPath, '.activity.json'), JSON.stringify(scorecard, null, 2));

// Write blog-recent.md
const detailsDir = path.join(domainPath, 'details');
if (!existsSync(detailsDir)) await mkdir(detailsDir, { recursive: true });
const md = `# Blog — Recent Posts (last ${monthsArg} months)

**Source:** ${source || 'NONE — no blog source detected'}
**Generated:** ${scorecard.generated_at}
**Total posts found (all time):** ${scorecard.total_posts_found}
**Posts in last 12mo:** ${scorecard.posts_in_last_12mo}
**Posts in last 6mo:** ${scorecard.posts_in_last_6mo}
**Posts in last 3mo:** ${scorecard.posts_in_last_3mo}

## Activity verdict: **${verdict.toUpperCase()}**

${verdictReason}

Activity rules:
- **active** = ≥1 post in last 6 months
- **dormant** = posts in last 6-12 months but nothing fresher
- **abandoned** = no post in last 12 months
- **unknown** = no detectable blog source

## Recent posts (chronological, newest first)

${recent.length === 0 ? '_None._' : recent.map(p => `- **${p.date.slice(0,10)}** — [${p.title}](${p.url})`).join('\n')}

## L4 pointers

- WP REST API base: \`${origin}/wp-json/wp/v2/posts\`
- RSS: \`${origin}/feed/\`
- Sitemap: \`${origin}/sitemap.xml\`
`;
await writeFile(path.join(detailsDir, 'blog-recent.md'), md);

console.log(JSON.stringify(scorecard, null, 2));
