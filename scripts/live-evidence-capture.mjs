#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error("Usage: node scripts/live-evidence-capture.mjs --init <file>");
  process.exit(2);
}

const args = process.argv.slice(2);
const initIndex = args.indexOf("--init");
if (initIndex === -1 || !args[initIndex + 1]) usage();

const target = args[initIndex + 1];
const template = `#!/usr/bin/env node
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const URL = process.env.SNAP_URL;
const SLOT = process.env.SNAP_SLOT || "landing";
const THEME_KEY = process.env.SNAP_THEME_KEY || "app-theme";
const OUT = process.env.SNAP_OUT || "docs/specs/landing-page/in-app-verification";
if (!URL) throw new Error("SNAP_URL is required");

const VIEWPORTS = [
  { name: "mobile", w: 390, h: 844 },
  { name: "tablet", w: 768, h: 1024 },
  { name: "desktop", w: 1440, h: 900 },
];
const THEMES = ["light", "dark"];
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const outputs = [];
for (const vp of VIEWPORTS) {
  for (const theme of THEMES) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, colorScheme: theme });
    const page = await ctx.newPage();
    await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript((t, k) => localStorage.setItem(k, t), theme, THEME_KEY);
    await page.goto(URL, { timeout: 30000, waitUntil: "networkidle" });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1500);
    const file = path.join(OUT, \`\${SLOT}-\${vp.name}-\${theme}.png\`);
    await page.screenshot({ path: file, fullPage: true });
    outputs.push({ viewport: vp.name, theme, file });
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ url: URL, outputs }, null, 2) + "\\n");
`;

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, template);
fs.chmodSync(target, 0o755);
console.log(`wrote ${target}`);
