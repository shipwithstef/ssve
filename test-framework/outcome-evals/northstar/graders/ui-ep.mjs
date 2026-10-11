// Browser exercisers shared by the E and P graders. Each takes an open Playwright browser and
// a running app's base URL, uses fixed seeds and fixed hostile inputs, and returns plain data.
import { CONTROLS, HOSTILE, attachWatch, rng, sleep } from "./lib-ep.mjs";

const visibleText = (page) => page.evaluate(() => (document.body?.innerText || "").trim().length).catch(() => 0);

// Random click walk with a seeded generator. A dead end is a state with nothing to click and
// no way back to the start page by clicking: the walk then has to leave by URL, and that is
// counted. Page errors raised during the walk are collected.
export async function uiWalk(browser, base, { seeds = [1, 2, 3], steps = 40, selector = CONTROLS, start = "/" } = {}) {
  const deadEnds = [];
  const errors = [];
  const serverErrors = [];
  let clicks = 0;
  for (const seed of seeds) {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
    const page = await ctx.newPage();
    const watch = attachWatch(page, base);
    const pick = rng(seed * 7919);
    try {
      await page.goto(base + start, { waitUntil: "load", timeout: 10000 });
      for (let i = 0; i < steps; i++) {
        if (!page.url().startsWith(base)) { await page.goBack().catch(() => {}); if (!page.url().startsWith(base)) await page.goto(base + start).catch(() => {}); }
        const loc = page.locator(selector);
        const n = await loc.count().catch(() => 0);
        if (!n) {
          deadEnds.push(`seed ${seed} step ${i}: nothing to click at ${new URL(page.url()).pathname}`);
          await page.goto(base + start, { waitUntil: "load" }).catch(() => {});
          continue;
        }
        const target = loc.nth(pick(n));
        try { await target.click({ timeout: 1200 }); clicks++; } catch {}
        await sleep(40);
        if (!(await visibleText(page))) deadEnds.push(`seed ${seed} step ${i}: blank page at ${new URL(page.url()).pathname}`);
      }
    } catch (e) {
      deadEnds.push(`seed ${seed}: walk could not run (${String(e.message).slice(0, 80)})`);
    }
    errors.push(...watch.errors); serverErrors.push(...watch.serverErrors);
    await ctx.close().catch(() => {});
  }
  return { deadEnds: [...new Set(deadEnds)], errors: [...new Set(errors)], serverErrors: [...new Set(serverErrors)], clicks };
}

// Fills every visible field with each hostile value in turn and submits. Reports server
// errors, uncaught page errors and a page left without content or controls.
export async function uiBadInput(browser, base, pages, { values = HOSTILE } = {}) {
  const problems = [];
  let fields = 0;
  for (const p of pages) {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
    const page = await ctx.newPage();
    const watch = attachWatch(page, base);
    try {
      await page.goto(base + p, { waitUntil: "load", timeout: 10000 });
      const inputs = await page.$$("input:visible:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]), textarea:visible");
      if (!inputs.length) { await ctx.close(); continue; }
      fields += inputs.length;
      for (const v of values) {
        await page.goto(base + p, { waitUntil: "load" }).catch(() => {});
        for (const el of await page.$$("input:visible:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]), textarea:visible")) {
          const type = (await el.getAttribute("type")) || "text";
          // number/date/email inputs refuse arbitrary text through fill(); set the value directly.
          await el.evaluate((node, val) => { node.value = val; node.dispatchEvent(new Event("input", { bubbles: true })); node.dispatchEvent(new Event("change", { bubbles: true })); }, v).catch(() => {});
          if (type === "text" || type === "search") await el.fill(v).catch(() => {});
        }
        const submit = page.locator("button[type=submit]:visible, input[type=submit]:visible, form button:visible").first();
        if (await submit.count()) await submit.click({ timeout: 1500 }).catch(() => {}); else await page.keyboard.press("Enter").catch(() => {});
        await sleep(120);
        const controls = await page.locator(CONTROLS).count().catch(() => 0);
        if (!(await visibleText(page)) || !controls) problems.push(`${p}: page left blank or without controls after input ${JSON.stringify(v.slice(0, 20))}`);
      }
    } catch (e) { problems.push(`${p}: ${String(e.message).slice(0, 80)}`); }
    problems.push(...watch.errors.map((x) => `${p}: ${x}`), ...watch.serverErrors.map((x) => `${p}: ${x}`));
    await ctx.close().catch(() => {});
  }
  return { problems: [...new Set(problems)], fields };
}

// Network loss: load the page, cut the network, use the controls, restore it. Uncaught page
// errors while offline mean the client assumes the network is always there.
export async function uiOffline(browser, base, pages, { clicks = 6 } = {}) {
  const problems = [];
  for (const p of pages) {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
    const page = await ctx.newPage();
    const watch = attachWatch(page, base);
    try {
      await page.goto(base + p, { waitUntil: "load", timeout: 10000 });
      await ctx.setOffline(true);
      const loc = page.locator(CONTROLS);
      const n = await loc.count();
      for (let i = 0; i < Math.min(clicks, n); i++) { await loc.nth(i).click({ timeout: 1000 }).catch(() => {}); await sleep(60); }
      await sleep(250);
      if (!(await visibleText(page))) problems.push(`${p}: page went blank while offline`);
      await ctx.setOffline(false);
      await page.goto(base + p, { waitUntil: "load", timeout: 8000 });
      if (!(await visibleText(page))) problems.push(`${p}: page blank after the network came back`);
    } catch (e) { problems.push(`${p}: ${String(e.message).slice(0, 80)}`); }
    problems.push(...watch.errors.map((x) => `${p}: ${x}`));
    await ctx.close().catch(() => {});
  }
  return { problems: [...new Set(problems)] };
}

// Accessibility, a subset that does not need axe-core: the rules axe rates serious or
// critical that can be decided from the DOM and computed styles.
export async function a11yLite(page) {
  return page.evaluate(() => {
    const v = [];
    const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
    if (!document.documentElement.lang) v.push("html-has-lang");
    if (!document.title.trim()) v.push("document-title");
    const vp = document.querySelector("meta[name=viewport]")?.getAttribute("content") || "";
    if (/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/.test(vp)) v.push("meta-viewport");
    for (const i of document.querySelectorAll("img")) if (vis(i) && !i.hasAttribute("alt") && i.getAttribute("role") !== "presentation") v.push("image-alt");
    const named = (e) => (e.textContent || "").trim() || e.getAttribute("aria-label") || e.getAttribute("aria-labelledby") || e.getAttribute("title") || e.querySelector("img[alt]:not([alt=''])");
    for (const b of document.querySelectorAll("button, [role=button]")) if (vis(b) && !named(b) && !(b.value || "").trim()) v.push("button-name");
    for (const a of document.querySelectorAll("a[href]")) if (vis(a) && !named(a)) v.push("link-name");
    for (const i of document.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=image]), select, textarea")) {
      if (!vis(i)) continue;
      const labelled = i.getAttribute("aria-label") || i.getAttribute("aria-labelledby") || i.getAttribute("title") || (i.id && document.querySelector(`label[for="${CSS.escape(i.id)}"]`)) || i.closest("label");
      if (!labelled) v.push("label");
    }
    // Colour contrast of text with a solid background (images and gradients are skipped).
    const parse = (c) => { const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
    const lum = ([r, g, b]) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const over = (top, bottom) => { const a = top[3]; return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1); };
    const backdrop = (el) => {
      const chain = [];
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (s.backgroundImage !== "none") return null;
        const c = parse(s.backgroundColor);
        if (c && c[3] > 0) { chain.push(c); if (c[3] === 1) break; }
      }
      let bg = [255, 255, 255, 1];
      for (const c of chain.reverse()) bg = over(c, bg);
      return bg;
    };
    let contrast = 0;
    for (const e of document.body.querySelectorAll("*")) {
      if (e instanceof SVGElement || !vis(e)) continue;
      if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)) continue;
      const s = getComputedStyle(e);
      const fg = parse(s.color), bg = backdrop(e);
      if (!fg || !bg) continue;
      const f = fg[3] < 1 ? over(fg, bg) : fg;
      const [hi, lo] = [lum(f), lum(bg)].sort((a, b) => b - a);
      const ratio = (hi + 0.05) / (lo + 0.05);
      const px = parseFloat(s.fontSize), bold = parseInt(s.fontWeight, 10) >= 700;
      const need = px >= 24 || (px >= 18.66 && bold) ? 3 : 4.5;
      if (ratio < need) contrast++;
    }
    if (contrast) v.push(...Array(contrast).fill("color-contrast"));
    return v;
  });
}

// Frame interval p95 over 90 animation frames, idle and then after a few clicks.
export async function framesP95(page) {
  const sample = () => page.evaluate(() => new Promise((done) => {
    const t = []; let prev = performance.now();
    const tick = (now) => { t.push(now - prev); prev = now; t.length < 90 ? requestAnimationFrame(tick) : done(t.slice(8)); };
    requestAnimationFrame(tick);
  }));
  const s = (await sample()).sort((a, b) => a - b);
  return +s[Math.floor(s.length * 0.95)].toFixed(1);
}

// The page-level numbers scripts/web-probes.mjs records (same definitions), measured in one
// pass with no game hook needed: web-probes waits for window.__game on every page it opens,
// which costs 15 s each on a page that has none.
export async function webMetrics(browser, base, route = "/", { axePath = null } = {}) {
  const out = {};
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const watch = attachWatch(page, base);
  await page.goto(base + route, { waitUntil: "load", timeout: 15000 });
  out.ready_ms = await page.evaluate(() => Math.round(performance.getEntriesByType("navigation")[0]?.loadEventEnd || performance.now()));
  out.js_kb = await page.evaluate(() => Math.round(performance.getEntriesByType("resource").filter((r) => r.initiatorType === "script" || /\.m?js(\?|$)/.test(r.name)).reduce((a, r) => a + (r.transferSize || r.encodedBodySize || 0), 0) / 1024));
  out.body_font_px = await page.evaluate(() => {
    const blocks = [...document.querySelectorAll("p, li, dd, td, blockquote, pre, div, span, label, button")].filter((e) => e.offsetParent !== null && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 20));
    if (!blocks.length) return null;
    const sizes = blocks.map((e) => parseFloat(getComputedStyle(e).fontSize)).sort((a, b) => a - b);
    return sizes[Math.floor(sizes.length / 2)];
  });
  out.a11y = await a11yLite(page);
  if (axePath) {
    const audit = await browser.newContext({ bypassCSP: true });
    const p = await audit.newPage();
    await p.goto(base + route, { waitUntil: "load" });
    await p.addScriptTag({ path: axePath });
    const r = await p.evaluate(() => window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } }));
    out.axe = { serious: r.violations.filter((v) => v.impact === "serious" || v.impact === "critical" ).reduce((a, v) => a + (v.id === "color-contrast" ? 0 : v.nodes.length), 0), contrast: r.violations.find((v) => v.id === "color-contrast")?.nodes.length || 0 };
    await audit.close();
  }
  // Keyboard: share of visible interactive controls that Tab reaches.
  out.tab_reach = await page.evaluate(() => [...document.querySelectorAll("button,a[href],input,select,textarea,[tabindex]:not([tabindex='-1'])")].filter((e) => e.offsetParent !== null).length).then(async (total) => {
    if (!total) return null;
    const seen = new Set();
    for (let i = 0; i < Math.min(60, total * 2); i++) {
      await page.keyboard.press("Tab");
      const id = await page.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return null; if (!a.dataset.__k) a.dataset.__k = String(Math.random()); return a.dataset.__k; });
      if (id) seen.add(id);
    }
    return +(Math.min(seen.size, total) / total).toFixed(2);
  });
  out.frame_p95_ms = await framesP95(page);
  // A few clicks, to catch errors a user would meet right away.
  const ctl = page.locator(CONTROLS);
  for (let i = 0; i < Math.min(4, await ctl.count()); i++) { await ctl.nth(i).click({ timeout: 1000 }).catch(() => {}); await sleep(60); }
  out.console_errors = watch.errors.length;
  out.console_sample = watch.errors.slice(0, 2);
  await ctx.close();
  // Phone width: overflow and tap targets.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pp = await phone.newPage();
  await pp.goto(base + route, { waitUntil: "load", timeout: 15000 });
  out.overflow_px = await pp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const targets = await pp.evaluate(() => [...document.querySelectorAll("button,a[href],input,select,textarea,[data-action],[role=button]")].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0).map((r) => Math.min(r.width, r.height)));
  out.tap_small_share = targets.length ? +(targets.filter((m) => m < 44).length / targets.length).toFixed(2) : null;
  await phone.close();
  return out;
}
