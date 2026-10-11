// No emoji stands in for a character or a scene object: not as scene markup, not as drawn text.
import { fail, pass } from "../../../graders/sk-probe.mjs";
import { scan } from "./_art.mjs";

const r = await scan();
const bad = [];
if (r.dom.emoji.length) bad.push(`emoji drawn as scene objects: ${[...new Set(r.dom.emoji)].slice(0, 4).join(" ")}`);
const DRAWN = /fillText\(\s*["'`][^"'`]{0,6}\p{Extended_Pictographic}|add\.text\([^,]+,[^,]+,\s*["'`][^"'`]{0,6}\p{Extended_Pictographic}|<text[^>]*>\s*\p{Extended_Pictographic}/u;
for (const f of r.source) if (DRAWN.test(f.text)) bad.push(`${f.path} draws an emoji as text art`);
if (bad.length) fail(bad.join("; "));
pass("no emoji is used as character or scene art");
