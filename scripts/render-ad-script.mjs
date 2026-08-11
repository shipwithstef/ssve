#!/usr/bin/env node
// render-ad-script.mjs — render an ad-video beat sheet (.beatsheet.json) as a clean,
// self-contained HTML: header (product / vertical / angle / placement), the beats as a
// vertical timeline (timecode + voiceover + first-frame/motion prompt, expandable), the
// hook + CTA highlighted, proof. The human opens this to read the script outcome.
// Usage: node scripts/render-ad-script.mjs --in <beatsheet.json> --out <html> [--title "..."]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const arg = (f) => { const i = process.argv.indexOf(f); return i !== -1 ? process.argv[i + 1] : null; };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const inPath = arg("--in"); if (!inPath) { console.error("need --in <beatsheet.json>"); process.exit(2); }
const b = JSON.parse(readFileSync(path.resolve(ROOT, inPath), "utf8"));
const OUT = arg("--out") || inPath.replace(/\.beatsheet\.json$/, ".html").replace("docs/specs/ad-scripts/", "docs/status/ad-");
const title = arg("--title") || `${b.product || "Ad"} — ${b.scenario || ""} ${b.placement || ""}`.trim();

const beats = Array.isArray(b.beats) ? b.beats : [];
const bvo = (x) => x.vo || x.voiceover || x.vo_line || x.line || "";
const bt = (x) => x.t || x.time || x.timecode || "";
const bimg = (x) => x.image_prompt || x.image || x.first_frame_image || x.first_frame || "";
const bmot = (x) => x.motion_prompt || x.motion || "";
const cta = b.cta; const ctaLine = typeof cta === "string" ? cta : (cta?.line || cta?.vo || "");
const proof = Array.isArray(b.proof) ? b.proof : (b.proof ? [b.proof] : []);

const beatsHtml = beats.map((x, i) => {
  const isHook = i === 0; const isCta = i === beats.length - 1;
  const tag = isHook ? '<span class="tag hook">HOOK</span>' : isCta ? '<span class="tag cta">CTA</span>' : "";
  return `<div class="card${isHook ? " hook" : isCta ? " cta" : ""}"><details${isHook || isCta ? " open" : ""}><summary><span class="t">${esc(bt(x) || `beat ${i + 1}`)}</span> ${tag}<span class="vo">${esc(bvo(x))}</span></summary><div class="body"><div><b>Frame:</b> ${esc(bimg(x))}</div><div><b>Motion:</b> ${esc(bmot(x))}</div>${x.seed_from_prev ? '<div class="seed">seeds from previous beat’s last frame (continuity)</div>' : ""}</div></details></div>`;
}).join("");

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>
:root{--bg:#0f1115;--card:#171a21;--line:#252a34;--fg:#e6e9ef;--mut:#9aa4b2;--hook:#58a6ff;--cta:#3fb950;--acc:#e78a3b}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.wrap{max-width:880px;margin:0 auto;padding:30px 22px 70px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:12px;margin:26px 0 10px;color:var(--mut);text-transform:uppercase;letter-spacing:.07em}
.meta{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 4px}.chip{padding:2px 10px;border-radius:999px;font-size:12px;background:var(--card);border:1px solid var(--line);color:var(--mut)}
.angle{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--acc);border-radius:10px;padding:14px 16px;margin:12px 0;font-size:16px}
.sub{color:var(--mut);font-size:12.5px;margin:6px 0}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;margin:7px 0;overflow:hidden}.card.hook{border-left:3px solid var(--hook)}.card.cta{border-left:3px solid var(--cta)}
details>summary{cursor:pointer;padding:12px 15px;list-style:none;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}details>summary::-webkit-details-marker{display:none}details>summary:hover{background:#1b1f28}
.t{color:var(--mut);font-variant-numeric:tabular-nums;font-size:12px;min-width:52px}
.tag{font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px}.tag.hook{color:var(--hook);background:#0c1a2e}.tag.cta{color:var(--cta);background:#0e1f14}
.vo{flex:1;min-width:200px}.body{padding:2px 16px 14px;color:var(--mut)}.body>div{padding:5px 0;border-top:1px solid var(--line)}.seed{color:#6e7681;font-style:italic}
b{color:var(--fg)}code{background:#10131a;padding:1px 5px;border-radius:5px}
</style></head><body><div class="wrap">
<h1>${esc(title)}</h1>
<div class="meta"><span class="chip">${esc(b.scenario || "")}</span><span class="chip">${esc(b.placement || "")}</span><span class="chip">${esc(b.awareness_stage || "")}</span><span class="chip">${esc((b.duration_s || 60) + "s")}</span></div>
<div class="angle"><b>Angle:</b> ${esc(b.angle || "")}</div>
<div class="sub"><b>Character:</b> ${esc(b.character_lock || "")}</div>
<div class="sub"><b>Style:</b> ${esc(b.style_lock || "")}</div>
<h2>The 60-second script — ${beats.length} beats (open + expand each)</h2>
${beatsHtml || "<div class='sub'>No beats.</div>"}
${ctaLine ? `<h2>Call to action</h2><div class="angle" style="border-left-color:var(--cta)">${esc(ctaLine)}</div>` : ""}
<h2>Grounding</h2>
<div class="sub"><b>Proof (only real):</b> ${esc(proof.join(" | ")) || "&lt;none claimed&gt;"}</div>
<div class="sub"><b>Grounded from:</b> ${esc(b.grounded_from || "")}</div>
<div class="sub" style="margin-top:22px">Beat sheet: <code>${esc(inPath)}</code> - render via the ad-video-producer or paste each frame+motion prompt into Veo/Flow, last-frame seed each next beat.</div>
</div></body></html>`;

mkdirSync(path.join(ROOT, path.dirname(OUT)), { recursive: true });
writeFileSync(path.join(ROOT, OUT), html);
console.log(`rendered ${OUT} - ${beats.length} beats`);
