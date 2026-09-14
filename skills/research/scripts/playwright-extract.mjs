#!/usr/bin/env node
// skills/research/scripts/playwright-extract.mjs
//
// Browser-rendered extraction for SPA / accordion / tab content.
// The static HTML fetch + LLM summarization combo silently drops content
// inside collapsed accordions, tabs, modals, and lazy-loaded sections.
// This script uses Playwright to:
//   1. Navigate to the URL with full JS rendering
//   2. Auto-expand all common accordion/tab/details patterns
//   3. Wait for lazy-loaded content
//   4. Dump the fully-rendered DOM text
//
// USAGE:
//   node skills/research/scripts/playwright-extract.mjs <url> [--out <file>]
//
// Output: full visible text after JS render + accordion expansion to stdout
// (or --out file). Page metadata + accordion-found-count printed to stderr.
//
// Failure modes handled:
//   - Page redirects → follow + report
//   - Cloudflare / JS challenges → 30s timeout, report what we got
//   - Sites without accordions → no-op expansion, normal extraction
//
// Patterns expanded:
//   - <details> elements
//   - .accordion .accordion-item .accordion-toggle
//   - [data-toggle="collapse"], [data-bs-toggle="collapse"]
//   - .elementor-toggle .elementor-accordion-item .elementor-tab-title
//   - .faq-item, .faq-question
//   - .et_pb_toggle (Divi), .vc_tta-panel-title (WPBakery)
//   - aria-expanded="false" elements
//   - "Show more" / "Виж повече" / "Прочети повече" buttons (BG)

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const url = args[0];
const get = (k) => { const i = args.indexOf(k); return i === -1 ? null : args[i + 1]; };
const outFile = get('--out');
const timeout = parseInt(get('--timeout') || '30000', 10);

if (!url) {
  console.error('usage: playwright-extract.mjs <url> [--out <file>] [--timeout 30000]');
  process.exit(2);
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch (e) {
  console.error('[playwright-extract] playwright not installed. Run: npm i playwright @playwright/test');
  console.error('[playwright-extract] OR: SVC_RESEARCH_NO_PLAYWRIGHT=1 to fall back to fetch');
  process.exit(2);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  viewport: { width: 1280, height: 1024 },
});
const page = await ctx.newPage();

const result = {
  url,
  finalUrl: null,
  status: null,
  accordionsExpanded: 0,
  textChars: 0,
  errors: [],
};

try {
  console.error(`[playwright-extract] navigating: ${url}`);
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
  result.status = response?.status();
  result.finalUrl = page.url();

  // Wait for body to stabilize
  await page.waitForLoadState('networkidle', { timeout: timeout / 2 }).catch(() => {});

  // Expand all <details> elements
  const detailsExpanded = await page.evaluate(() => {
    const els = document.querySelectorAll('details:not([open])');
    els.forEach(el => el.open = true);
    return els.length;
  });
  result.accordionsExpanded += detailsExpanded;

  // Click common accordion toggles
  const accordionSelectors = [
    '.accordion-toggle',
    '.accordion-button.collapsed',
    '[data-toggle="collapse"]',
    '[data-bs-toggle="collapse"]',
    '.elementor-tab-title:not(.elementor-active)',
    '.elementor-toggle-title:not(.elementor-active)',
    '.faq-question',
    '.et_pb_toggle_title',
    '.vc_tta-panel-title',
    '[aria-expanded="false"]',
  ];

  for (const sel of accordionSelectors) {
    try {
      const elements = await page.$$(sel);
      for (const el of elements) {
        try {
          await el.click({ timeout: 500, force: true });
          result.accordionsExpanded++;
          await page.waitForTimeout(50);
        } catch { /* ignore individual click failures */ }
      }
    } catch { /* selector not on page */ }
  }

  // Wait for any post-click animations
  await page.waitForTimeout(500);

  // Click "show more" / "Виж повече" / "Прочети повече" buttons
  const showMoreSelectors = [
    'button:has-text("Show more")',
    'button:has-text("Виж повече")',
    'button:has-text("Прочети повече")',
    'a:has-text("Виж повече")',
    'a:has-text("Прочети повече")',
  ];
  for (const sel of showMoreSelectors) {
    try {
      const btns = await page.$$(sel);
      for (const btn of btns) {
        try { await btn.click({ timeout: 500 }); result.accordionsExpanded++; await page.waitForTimeout(100); } catch {}
      }
    } catch {}
  }

  // Get full rendered text
  const text = await page.evaluate(() => {
    // Remove script/style tags before reading text
    document.querySelectorAll('script, style, noscript').forEach(el => el.remove());
    return document.body.innerText;
  });
  result.textChars = text.length;

  if (outFile) {
    if (!existsSync(path.dirname(outFile))) await mkdir(path.dirname(outFile), { recursive: true });
    await writeFile(outFile, text);
    console.error(`[playwright-extract] wrote ${text.length} chars to ${outFile}`);
  } else {
    process.stdout.write(text);
  }
} catch (e) {
  result.errors.push(e.message);
  console.error(`[playwright-extract] error: ${e.message}`);
} finally {
  await browser.close();
}

console.error(JSON.stringify(result, null, 2));
process.exit(result.errors.length > 0 ? 1 : 0);
