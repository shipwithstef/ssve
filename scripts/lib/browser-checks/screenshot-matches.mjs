// Check: take a screenshot of the page (or a selector region) and optionally compare
// its byte size to a baseline tolerance. The wrapper-level `screenshot_path` captures
// the full-page screenshot; this check is additive for per-element evidence.
//
// v1 — no pixel-diff. Returns pass:true whenever the screenshot was produced; writes
// the evidence file to disk; caller sees only the path.
//
// Shape: { type: 'screenshot-matches', selector?: '...', name?: '...' }
import path from 'node:path';
import fs from 'node:fs';

export async function checkScreenshotMatches(page, { selector, name }, ctx) {
  const slug = (name || selector || 'page').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'page';
  const dir = ctx.evidenceDir;
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${ctx.timestamp}-${slug}.png`);
  const target = selector ? page.locator(selector).first() : page;
  try {
    await target.screenshot({ path: file, timeout: ctx.timeoutMs });
  } catch (err) {
    return { pass: false, detail: `screenshot failed: ${err.message}` };
  }
  return { pass: true, detail: `saved to ${path.relative(ctx.repoRoot, file)}` };
}
