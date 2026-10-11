// Shared by the ai-quest K probes: load the served game in a real browser and report what
// art it actually SHOWS. Downloads, engine globals and preloaded images earn nothing; art
// counts only when it is drawn into the visible scene, which is measured three ways:
//   - a visible <img>, SVG <image> or CSS background of a qualifying asset at a real on-screen
//     size, whose screen region has real colour variety;
//   - for canvas/WebGL: drawImage / texImage2D calls on a qualifying asset's <img> (recorded by
//     an init script) AND a canvas whose pixels have the colour variety of art, not of flat fills;
//   - 3D models: a qualifying model file fetched, a WebGL canvas, and the same pixel evidence.
// An SVG is art only if it is an illustration (many curved path segments), not basic shapes.
import { fail } from "../../../graders/sk-probe.mjs";
import { launchBrowser, playwright } from "../../../graders/sk-browser.mjs";

const RASTER = /^image\/(png|jpe?g|webp|gif|avif)\b/i;
const MODEL = /\.(glb|gltf|obj|fbx|vrm)(\?|#|$)/i;
const TEXTY = /(text\/html|javascript|text\/css|application\/json|image\/svg)/i;
const ENGINE = /(phaser|three|babylon|pixi|kaboom|excalibur|\.min\.)/i;

import { MIN as SVG_MIN, svgInfo } from "./svg-info.mjs";
export { svgInfo };
export const MIN = { raster: 256, rasterSide: 16, model: 1024, rendered: 8000, canvas: 40000, regionBins: 8, canvasBins: 24, canvasEntropy: 2.5, ...SVG_MIN };
export const PRIMITIVES = /\.arc\(|\.fillRect\(|\.strokeRect\(|\.ellipse\(|\.fillCircle\(|\badd\.(?:circle|rectangle|ellipse|triangle|graphics)\(|<circle\b|<ellipse\b|<rect\b|new\s+THREE\.(?:Box|Sphere|Cylinder|Capsule|Plane|Circle)Geometry|MeshBuilder\.Create(?:Box|Sphere|Cylinder|Capsule|Plane|Disc)/g;
export const CHARACTER_WORDS = /player|hero|character|avatar|npc|protagonist|actor|person|sprite/i;

const base = () => process.env.GRADE_BASE_URL;
const pathOf = (u) => { try { return new URL(u, base()).pathname; } catch { return u; } };

const pngSide = (buf) => (buf.length > 24 && buf.readUInt32BE(1) === 0x504e4700 ? Math.min(buf.readUInt32BE(16), buf.readUInt32BE(20)) : null);

const INSTRUMENT = () => {
  window.__drawn = []; window.__bitmaps = 0; window.__webgl = false;
  const note = (x) => { try { if (x instanceof HTMLImageElement) window.__drawn.push(x.currentSrc || x.src); else if (x && (x instanceof ImageBitmap || x instanceof HTMLCanvasElement || x instanceof OffscreenCanvas)) window.__bitmaps++; } catch { /* ignore */ } };
  const wrap = (proto, name) => { const o = proto && proto[name]; if (!o) return; proto[name] = function (...a) { a.forEach(note); return o.apply(this, a); }; };
  wrap(CanvasRenderingContext2D.prototype, "drawImage");
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) { wrap(C?.prototype, "texImage2D"); wrap(C?.prototype, "texSubImage2D"); }
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, ...r) { if (/webgl/i.test(t)) window.__webgl = true; return gc.call(this, t, ...r); };
};

const STATS = async (b64) => {
  const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const x = c.getContext("2d"); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  const stride = 4 * Math.max(1, Math.floor(d.length / 4 / 40000));
  const bins = new Map(); let n = 0;
  for (let i = 0; i < d.length; i += stride) { const k = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4); bins.set(k, (bins.get(k) || 0) + 1); n++; }
  let h = 0; for (const v of bins.values()) { const p = v / n; h -= p * Math.log2(p); }
  return { bins: bins.size, entropy: h };
};

export async function scan() {
  const pw = await playwright().catch((e) => fail(`Playwright is not available: ${e.message}`));
  const browser = await launchBrowser(pw).catch((e) => fail(`no browser could be launched: ${String(e.message).split("\n")[0]}`));
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.addInitScript(INSTRUMENT);
    const seen = [];
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("response", async (r) => {
      try {
        const url = r.url();
        if (!url.startsWith(base())) return;
        const ct = r.headers()["content-type"] || "";
        const body = r.status() < 400 ? await r.body() : Buffer.alloc(0);
        seen.push({ url, path: pathOf(url), ct, size: body.length, side: RASTER.test(ct) ? pngSide(body) : null, text: TEXTY.test(ct) && body.length < 2_000_000 ? body.toString("utf8") : null });
      } catch { /* a response that vanished */ }
    });
    await page.goto(base() + "/", { waitUntil: "load" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);

    const dom = await page.evaluate(() => {
      const box = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); const ok = r.width >= 16 && r.height >= 16 && cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0.05; return { area: ok ? r.width * r.height : 0, x: Math.max(0, r.x), y: Math.max(0, r.y), w: Math.min(r.width, innerWidth - Math.max(0, r.x)), h: Math.min(r.height, innerHeight - Math.max(0, r.y)) }; };
      const pic = /^[\s\p{Extended_Pictographic}️‍]+$/u;
      const imgs = [...document.querySelectorAll("img")].filter((i) => i.complete && i.naturalWidth > 0).map((i) => ({ src: i.currentSrc || i.src, ...box(i) }));
      const svgImgs = [...document.querySelectorAll("svg image")].map((i) => ({ src: i.href?.baseVal || i.getAttribute("href") || i.getAttribute("xlink:href") || "", ...box(i) }));
      const bgs = [...document.querySelectorAll("*")].map((el) => { const m = /url\(["']?([^"')]+)["']?\)/.exec(getComputedStyle(el).backgroundImage); return m ? { src: m[1], ...box(el) } : null; }).filter(Boolean);
      const canvases = [...document.querySelectorAll("canvas")].map((c) => box(c));
      const emoji = [];
      for (const el of document.querySelectorAll("body *")) {
        if (el.children.length) continue;
        const t = (el.textContent || "").trim();
        if (!t || t.length > 12 || !pic.test(t)) continue;
        const cs = getComputedStyle(el);
        const inScene = !!el.closest("svg, .hot, [data-action]:not(button), canvas, [class*=scene], [class*=stage], [class*=sprite], [class*=character]");
        if (inScene || parseFloat(cs.fontSize) >= 32 || cs.position === "absolute" || cs.position === "fixed") emoji.push(t);
      }
      return { imgs, svgImgs, bgs, canvases, emoji, engine: ["Phaser", "THREE", "BABYLON", "PIXI", "kaboom"].filter((k) => window[k]), drawn: window.__drawn || [], bitmaps: window.__bitmaps || 0, webgl: !!window.__webgl };
    });

    // Qualifying art files the page really fetched.
    const assets = [];
    for (const r of seen) {
      if (RASTER.test(r.ct) && r.size >= MIN.raster && (r.side == null || r.side >= MIN.rasterSide)) assets.push({ ...r, kind: "raster" });
      else if (MODEL.test(r.path) && r.size >= MIN.model) assets.push({ ...r, kind: "model" });
      else if (/svg/i.test(r.ct) && r.text && svgInfo(r.text).illustration) assets.push({ ...r, kind: "svg" });
    }
    const unique = [...new Map(assets.map((a) => [a.path, a])).values()];
    const texts = seen.filter((r) => r.text && !/svg|json/i.test(r.ct));
    const source = texts.filter((r) => !ENGINE.test(r.path) && r.size < 400_000);

    const stats = async (clip) => {
      if (clip.w < 8 || clip.h < 8) return { bins: 0, entropy: 0 };
      const shot = await page.screenshot({ clip: { x: clip.x, y: clip.y, width: clip.w, height: clip.h } });
      const p = await context.newPage();
      try { return await p.evaluate(STATS, shot.toString("base64")); } finally { await p.close(); }
    };

    // DOM path: visible elements showing a qualifying asset, with real colour variety on screen.
    const shown = [...dom.imgs, ...dom.svgImgs, ...dom.bgs].map((x) => ({ ...x, path: pathOf(x.src) })).filter((x) => x.area >= MIN.rendered);
    const rendered = [];
    for (const a of unique) {
      const els = shown.filter((s) => s.path === a.path).sort((p, q) => q.area - p.area);
      if (!els.length) continue;
      const st = await stats(els[0]);
      if (st.bins >= MIN.regionBins) rendered.push({ ...a, how: "element", stats: st });
    }
    // Canvas / WebGL path: assets the page drew into a canvas that has art-like pixels.
    const bigCanvases = dom.canvases.filter((c) => c.area >= MIN.canvas);
    let canvasStats = null;
    for (const c of bigCanvases) { const st = await stats(c); if (!canvasStats || st.bins > canvasStats.bins) canvasStats = st; }
    const artLikeCanvas = !!canvasStats && canvasStats.bins >= MIN.canvasBins && canvasStats.entropy >= MIN.canvasEntropy;
    if (artLikeCanvas) {
      for (const a of unique) {
        if (rendered.some((x) => x.path === a.path)) continue;
        const drawn = dom.drawn.some((u) => pathOf(u) === a.path);
        const model = a.kind === "model" && dom.webgl;
        if (drawn || model) rendered.push({ ...a, how: drawn ? "drawn to canvas" : "webgl model", stats: canvasStats });
      }
    }
    const referenced = (a) => texts.some((t) => t.text.includes(a.path) || t.text.includes(a.path.split("/").pop()));
    // SVG files of characters that are only basic shapes.
    const primitiveSvgs = seen.filter((r) => /svg/i.test(r.ct) && r.text).map((r) => ({ ...r, info: svgInfo(r.text) })).filter((r) => !r.info.illustration);
    return { unique, rendered, referenced, source, dom, canvasStats, artLikeCanvas, primitiveSvgs, errors };
  } finally { await browser.close(); }
}
