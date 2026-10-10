#!/usr/bin/env node
/**
 * design-tokens.mjs — move design tokens between a codebase and a Claude Design
 * "Design System" artifact (project/tokens.json), and check contrast.
 *
 *   node scripts/design-tokens.mjs extract <css-file>... [--name <system>] [--out tokens.json]
 *   node scripts/design-tokens.mjs export  <tokens.json> [--out tokens.css]
 *   node scripts/design-tokens.mjs contrast <tokens.json> [--min 4.5]
 *
 * extract reads CSS custom properties from :root / html / [data-theme] / .dark /
 * @media (prefers-color-scheme: dark) blocks and Tailwind v4 @theme blocks, and writes
 * the list-shaped tokens.json the Design System page reads: color (with light/dark
 * themes), spacing, radius, shadow, plus type families. var(--x) becomes an alias
 * "{x}" when x is a color token; values the page would drop (named colours, var() to
 * a non-color, color-mix()) are reported, never guessed.
 * export writes them back as CSS variables (:root + [data-theme="dark"]).
 * contrast checks every color token whose usage note says "on <token>" (WCAG 2 ratio).
 */

import fs from "node:fs";

const DARK_SEL = /(\[data-theme=["']?dark["']?\]|\.dark\b|\.theme-dark\b)/;
const ROOT_SEL = /(^|,)\s*(:root|html|\[data-theme=["']?light["']?\]|\.light\b|@theme)\s*(,|$)/;
const NAME_OK = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const COLOR_FN = /^(rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(\s*[^()]*\)$/i;
const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const LENGTH = /^-?\d*\.?\d+(px|rem|em|%)?$/;

function stripComments(css) { return css.replace(/\/\*[\s\S]*?\*\//g, ""); }

// Walk the CSS keeping a selector stack, yielding {selector, darkMedia, decls}.
export function parseBlocks(css) {
  const src = stripComments(css);
  const out = [];
  const stack = [];
  let buf = "";
  for (const ch of src) {
    if (ch === "{") { stack.push(buf.trim()); buf = ""; }
    else if (ch === "}") {
      const decls = {};
      for (const part of buf.split(";")) {
        const m = part.match(/^\s*(--[A-Za-z0-9_-]+)\s*:\s*([\s\S]+?)\s*$/);
        if (m) decls[m[1].slice(2)] = m[2].replace(/\s*!important$/, "");
      }
      const selector = stack.pop() || "";
      if (Object.keys(decls).length) {
        out.push({ selector, darkMedia: stack.some((s) => /prefers-color-scheme:\s*dark/.test(s)), decls });
      }
      buf = "";
    } else buf += ch;
  }
  return out;
}

export function classify(name, value) {
  const v = value.trim();
  if (HEX.test(v) || COLOR_FN.test(v)) return "color";
  if (/^var\(--[A-Za-z0-9_-]+\)$/.test(v)) return "alias";
  if (/(radius|rounded)/i.test(name) && LENGTH.test(v)) return "radius";
  if (/(space|spacing|gap|gutter|pad|margin|size-\d)/i.test(name) && LENGTH.test(v)) return "spacing";
  if (/shadow/i.test(name)) return "shadow";
  if (/^(font|family)/i.test(name) && /[a-z]/i.test(v) && !LENGTH.test(v)) return "family";
  return "other";
}

export function extract(cssTexts, name = "System") {
  const light = new Map();
  const dark = new Map();
  for (const css of cssTexts) {
    for (const b of parseBlocks(css)) {
      const isDark = b.darkMedia || DARK_SEL.test(b.selector);
      const isRoot = ROOT_SEL.test(b.selector) || (b.darkMedia && /:root|html/.test(b.selector));
      if (!isDark && !isRoot) continue;
      const target = isDark ? dark : light;
      for (const [k, v] of Object.entries(b.decls)) target.set(k, v);
    }
  }
  const report = { dropped: [], renamed: [] };
  const kinds = new Map();
  for (const [k, v] of light) kinds.set(k, classify(k, v));
  for (const [k, v] of dark) if (!kinds.has(k)) kinds.set(k, classify(k, v));
  const resolveKind = (k, seen = new Set()) => {
    const kind = kinds.get(k);
    if (kind !== "alias") return kind;
    if (seen.has(k)) return "other";
    seen.add(k);
    const target = (light.get(k) || dark.get(k)).match(/^var\(--([A-Za-z0-9_-]+)\)$/)[1];
    return kinds.has(target) ? resolveKind(target, seen) : "other";
  };
  const colorValue = (v) => {
    const t = v.trim();
    const alias = t.match(/^var\(--([A-Za-z0-9_-]+)\)$/);
    if (alias) return resolveKind(alias[1]) === "color" ? `{${alias[1]}}` : null;
    return HEX.test(t) || COLOR_FN.test(t) ? t : null;
  };
  const tokens = { name, version: 1, meta: { source: "code" },
    color: { themes: [{ id: "light", name: "Light" }], tokens: [] },
    spacing: { tokens: [] }, radius: { tokens: [] }, shadow: { tokens: [] },
    type: { families: {}, groups: [] } };
  if (dark.size) tokens.color.themes.push({ id: "dark", name: "Dark" });
  for (const [k] of kinds) {
    if (!NAME_OK.test(k)) { report.dropped.push({ name: k, why: "name not allowed by the Design System page" }); continue; }
    const kind = resolveKind(k);
    const lv = light.get(k);
    const dv = dark.get(k);
    if (kind === "color") {
      const value = {};
      if (lv !== undefined) { const c = colorValue(lv); if (c) value.light = c; else report.dropped.push({ name: k, why: `light value "${lv}" is not a color the page reads` }); }
      if (dv !== undefined) { const c = colorValue(dv); if (c) value.dark = c; else report.dropped.push({ name: k, why: `dark value "${dv}" is not a color the page reads` }); }
      if (Object.keys(value).length) tokens.color.tokens.push({ name: k, value, usage: "" });
    } else if (kinds.get(k) === "alias") {
      report.dropped.push({ name: k, why: `alias "${(lv ?? dv).trim()}" points at a ${kind || "missing"} token; the Design System page reads aliases for colours only, so give it its own value` });
    } else if (["spacing", "radius", "shadow"].includes(kind)) {
      tokens[kind].tokens.push({ name: k, value: (lv ?? dv).trim(), usage: "" });
    } else if (kind === "family") {
      tokens.type.families[k.replace(/^font-?(family-?)?/i, "") || k] = (lv ?? dv).trim();
    } else {
      const raw = (lv ?? dv).trim();
      const why = /color-mix\(|^(transparent|currentcolor|[a-z]+)$/i.test(raw) && !LENGTH.test(raw)
        ? `"${raw.slice(0, 40)}" is a colour the Design System page cannot read (named colour, transparent or color-mix); give it a hex or rgb() value`
        : `not a color, spacing, radius, shadow or font family (${raw.slice(0, 40)})`;
      report.dropped.push({ name: k, why });
    }
  }
  for (const fam of ["spacing", "radius", "shadow"]) if (!tokens[fam].tokens.length) delete tokens[fam];
  return { tokens, report };
}

export function toCss(tokens) {
  const ref = (v) => (typeof v === "string" ? v.replace(/^\{([^}]+)\}$/, "var(--$1)") : v);
  const lines = [`/* ${tokens.name || "Design system"} — generated from tokens.json by scripts/design-tokens.mjs */`, ":root {"];
  const themes = (tokens.color?.themes || [{ id: "light" }]).map((t) => t.id);
  const first = themes[0];
  for (const t of tokens.color?.tokens || []) {
    const v = typeof t.value === "string" ? t.value : t.value[first];
    if (v !== undefined) lines.push(`  --${t.name}: ${ref(v)};`);
  }
  for (const fam of ["spacing", "radius", "shadow"]) for (const t of tokens[fam]?.tokens || []) lines.push(`  --${t.name}: ${t.value};`);
  for (const [k, v] of Object.entries(tokens.type?.families || {})) lines.push(`  --font-${k}: ${v};`);
  lines.push("}");
  for (const theme of themes.slice(1)) {
    const own = (tokens.color?.tokens || []).filter((t) => typeof t.value === "object" && t.value[theme] !== undefined);
    if (!own.length) continue;
    lines.push(`[data-theme="${theme}"] {`);
    for (const t of own) lines.push(`  --${t.name}: ${ref(t.value[theme])};`);
    lines.push("}");
  }
  return lines.join("\n") + "\n";
}

function hexToRgb(hex) {
  let h = hex.slice(1);
  if (h.length <= 4) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

function parseRgb(v) {
  const m = v.match(/^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i);
  return m ? [m[1], m[2], m[3]].map((x) => Number(x) / 255) : null;
}

export function luminance(color) {
  const rgb = HEX.test(color) ? hexToRgb(color) : parseRgb(color);
  if (!rgb) return null;
  const lin = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

export function ratio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  return +((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)).toFixed(2);
}

export function contrastReport(tokens, min = 4.5) {
  const colors = new Map((tokens.color?.tokens || []).map((t) => [t.name, t]));
  const themes = (tokens.color?.themes || [{ id: "light" }]).map((t) => t.id);
  const resolve = (name, theme, seen = new Set()) => {
    const t = colors.get(name);
    if (!t || seen.has(name)) return null;
    seen.add(name);
    const v = typeof t.value === "string" ? t.value : t.value[theme] ?? t.value[themes[0]];
    const alias = typeof v === "string" && v.match(/^\{([^}]+)\}$/);
    return alias ? resolve(alias[1], theme, seen) : v;
  };
  const rows = [];
  for (const t of colors.values()) {
    const m = (t.usage || "").match(/\bon ([A-Za-z0-9][A-Za-z0-9_.-]*)/);
    const bgName = m && m[1].replace(/[.]+$/, "");
    if (!bgName || !colors.has(bgName)) continue;
    const on = [null, bgName];
    for (const theme of themes) {
      const fg = resolve(t.name, theme);
      const bg = resolve(on[1], theme);
      const r = fg && bg ? ratio(fg, bg) : null;
      rows.push({ fg: t.name, bg: on[1], theme, ratio: r, pass: r === null ? null : r >= min });
    }
  }
  return rows;
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const opt = (n) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : undefined; };
  const positional = rest.filter((a, i) => !a.startsWith("--") && !(i > 0 && rest[i - 1].startsWith("--")));
  const write = (text) => { const out = opt("--out"); if (out) fs.writeFileSync(out, text); else process.stdout.write(text); };
  if (cmd === "extract" && positional.length) {
    const { tokens, report } = extract(positional.map((f) => fs.readFileSync(f, "utf8")), opt("--name") || "System");
    write(JSON.stringify(tokens, null, 2) + "\n");
    const counts = `${tokens.color.tokens.length} colors, ${tokens.spacing?.tokens.length || 0} spacing, ${tokens.radius?.tokens.length || 0} radius, ${tokens.shadow?.tokens.length || 0} shadow, ${Object.keys(tokens.type.families).length} families`;
    process.stderr.write(`design-tokens: ${counts}; ${report.dropped.length} not converted\n`);
    for (const d of report.dropped) process.stderr.write(`  - ${d.name}: ${d.why}\n`);
    return 0;
  }
  if (cmd === "export" && positional.length) { write(toCss(JSON.parse(fs.readFileSync(positional[0], "utf8")))); return 0; }
  if (cmd === "contrast" && positional.length) {
    const min = Number(opt("--min") || 4.5);
    const rows = contrastReport(JSON.parse(fs.readFileSync(positional[0], "utf8")), min);
    for (const r of rows) process.stdout.write(`${r.pass === false ? "FAIL" : r.pass ? "ok  " : "??  "} ${r.fg} on ${r.bg} [${r.theme}] ${r.ratio ?? "n/a"}\n`);
    if (!rows.length) process.stdout.write("no token has a usage note naming its background (\"... on <token>\")\n");
    return rows.some((r) => r.pass === false) ? 1 : 0;
  }
  process.stderr.write("usage: design-tokens.mjs extract <css>... [--name N] [--out F] | export <tokens.json> [--out F] | contrast <tokens.json> [--min 4.5]\n");
  return 2;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)));
