// The served game DRAWS real art (raster or illustrated SVG sprites, tilesets, backgrounds,
// 3D models) that is referenced by the page: shown at a real size with real colour variety,
// or drawn into a canvas whose pixels are art-like. Downloads and engine globals earn nothing.
import { fail, pass } from "../../../graders/sk-probe.mjs";
import { scan } from "./_art.mjs";

const r = await scan();
const shown = r.rendered.filter(r.referenced);
if (shown.length) pass(`${shown.length} art files are referenced and drawn in the main scene (${shown.slice(0, 3).map((a) => `${a.kind} ${a.path} ${a.how}`).join(", ")})`);
fail(`no qualifying art is drawn in the visible scene: ${r.unique.length} art files fetched, ${r.rendered.length} actually shown (raster 256+ bytes and 16+ px, an SVG illustration with many curved paths, or a 3D model; shown at 8000+ px with colour variety, or drawn into a canvas with art-like pixels${r.canvasStats ? `; canvas has ${r.canvasStats.bins} colours, entropy ${r.canvasStats.entropy.toFixed(2)}` : ""})`);
