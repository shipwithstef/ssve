// Characters and scenes are not drawn from primitives: at least 3 distinct art assets, no
// circle/rectangle/arc drawing call next to player or character code, and no character
// asset that is an SVG made of basic shapes.
import { fail, pass } from "../../../graders/sk-probe.mjs";
import { CHARACTER_WORDS, PRIMITIVES, scan } from "./_art.mjs";

const r = await scan();
if (r.unique.length < 3) fail(`only ${r.unique.length} distinct art assets are loaded (needs 3 or more)`);
const bad = [];
for (const f of r.source) {
  for (const m of f.text.matchAll(PRIMITIVES)) {
    const near = f.text.slice(Math.max(0, m.index - 300), m.index + 300);
    if (CHARACTER_WORDS.test(near)) bad.push(`${f.path}: ${m[0]} next to character code`);
  }
}
for (const s of r.primitiveSvgs) if (CHARACTER_WORDS.test(s.path.split("/").pop())) bad.push(`${s.path} is a character drawn from basic shapes (${s.info.shapes} shapes, ${s.info.paths} paths, ${s.info.segments} segments, ${s.info.curves} curves)`);
if (bad.length) fail(`characters are drawn from primitives: ${[...new Set(bad)].slice(0, 3).join("; ")}`);
pass(`${r.unique.length} distinct art assets; no primitive drawing next to character code; no character SVG made of basic shapes`);
