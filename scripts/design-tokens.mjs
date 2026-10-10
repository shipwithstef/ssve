#!/usr/bin/env node
/**
 * design-tokens.mjs — move design tokens between a codebase and a Claude Design
 * "Design System" artifact (project/tokens.json), and check contrast.
 *
 *   node scripts/design-tokens.mjs extract <css-file>... [--name <system>] [--out tokens.json]
 *   node scripts/design-tokens.mjs export  <tokens.json> [--out <new or generated css file>]
 *   node scripts/design-tokens.mjs contrast <tokens.json> [--min 4.5]
 *
 * extract reads custom properties from theme-level blocks only: :root / html / :host,
 * Tailwind v4 @theme, light variants ([data-theme="light"], .light, :root:not(.dark)) and
 * dark variants (.dark, [data-theme="dark"], :root.dark, or :root inside
 * @media (prefers-color-scheme: dark)). Component blocks are ignored; values set only
 * under other at-rules (responsive @media, @supports, @container) are reported, never
 * applied. Strings, url() and nested blocks are tokenized properly. Output is the
 * list-shaped tokens.json the Design System page reads; meta records how the source
 * selects dark mode so export can write it back the same way. Values the page would
 * drop are reported, never guessed.
 * export writes CSS variables with the source's root and dark mechanism. It refuses to
 * overwrite a file it did not generate: write a new file and import it.
 * contrast checks each colour whose usage note says "on <token>" in every theme
 * (WCAG 2), for hex, rgb() (incl. %), hsl() and oklch(); exit 1 on a failure, 2 when
 * nothing could be measured.
 */

import fs from "node:fs";
import { fileURLToPath } from "node:url";

const NAME_OK = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const COLOR_FN = /^(rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(\s*[^()]*\)$/i;
const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const LENGTH = /^-?\d*\.?\d+(px|rem|em|%)?$/;
const GENERATED = "generated from tokens.json by scripts/design-tokens.mjs";

// Tokenize CSS into blocks with their full prelude chain and own declarations.
export function parseBlocks(css) {
  const blocks = [];
  const stack = [];
  let buf = "";
  let quote = null;
  let parens = 0;
  const flushDecl = () => {
    const m = buf.match(/^\s*(--[A-Za-z0-9_-]+)\s*:\s*([\s\S]+?)\s*$/);
    if (m && stack.length) stack[stack.length - 1].decls[m[1].slice(2)] = m[2].replace(/\s*!important$/, "");
    buf = "";
  };
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (quote) { buf += ch; if (ch === "\\") { buf += css[++i] ?? ""; } else if (ch === quote) quote = null; continue; }
    if (ch === "/" && css[i + 1] === "*") { const end = css.indexOf("*/", i + 2); i = end < 0 ? css.length : end + 1; continue; }
    if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
    if (ch === "(") parens++;
    if (ch === ")") parens = Math.max(0, parens - 1);
    if (parens) { buf += ch; continue; }
    if (ch === ";") { flushDecl(); continue; }
    if (ch === "{") { stack.push({ prelude: buf.trim(), decls: {} }); buf = ""; continue; }
    if (ch === "}") {
      flushDecl();
      const frame = stack.pop();
      if (frame && Object.keys(frame.decls).length) blocks.push({ chain: [...stack.map((f) => f.prelude), frame.prelude], decls: frame.decls });
      continue;
    }
    buf += ch;
  }
  return blocks;
}

const DARK_PART = /^(?::root|html|:host)?(?:\.dark|\.theme-dark|\[data-theme=["']?dark["']?\])$/;
const LIGHT_PART = /^(?:(?::root|html|:host)(?::not\(\.dark\))?(?:\.light|\[data-theme=["']?light["']?\])?|\.light|\[data-theme=["']?light["']?\])$/;

// -> { theme: "light" | "dark" | null, conditional: "<at-rule>" | null, darkMechanism }
export function classifyBlock(chain) {
  const ats = chain.filter((p) => p.startsWith("@"));
  const selector = [...chain].reverse().find((p) => !p.startsWith("@"));
  const darkMedia = ats.some((a) => /prefers-color-scheme\s*:\s*dark/i.test(a));
  const lightMedia = ats.some((a) => /prefers-color-scheme\s*:\s*light/i.test(a));
  const theme = ats.some((a) => /^@theme\b/.test(a));
  const other = ats.find((a) => !/^@(theme|layer)\b/.test(a) && !/prefers-color-scheme/i.test(a));
  if (selector === undefined) return theme ? { theme: "light", conditional: other || null, root: "@theme" } : { theme: null };
  const parts = selector.split(",").map((p) => p.trim().replace(/\s+/g, ""));
  const dark = parts.find((p) => DARK_PART.test(p));
  const light = parts.some((p) => LIGHT_PART.test(p));
  if (dark) return { theme: "dark", conditional: other || null, darkMechanism: dark };
  if (light && darkMedia) return { theme: "dark", conditional: other || null, darkMechanism: "media" };
  if (light && !lightMedia) return { theme: "light", conditional: other || null, root: theme ? "@theme" : ":root" };
  if (light) return { theme: "light", conditional: other || null, root: ":root" };
  return { theme: null };
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
  const report = { dropped: [], conditional: [] };
  const meta = { source: "code", root: ":root", dark_mechanism: null };
  for (const css of cssTexts) {
    for (const b of parseBlocks(css)) {
      const c = classifyBlock(b.chain);
      if (!c.theme) continue;
      if (c.conditional) {
        for (const k of Object.keys(b.decls)) report.conditional.push({ name: k, why: `set only inside ${c.conditional}; base value kept` });
        continue;
      }
      if (c.root === "@theme") meta.root = "@theme";
      if (c.darkMechanism) meta.dark_mechanism ??= c.darkMechanism;
      const target = c.theme === "dark" ? dark : light;
      for (const [k, v] of Object.entries(b.decls)) target.set(k, v);
    }
  }
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
  const tokens = { name, version: 1, meta,
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
        : `not a color, spacing, radius, shadow or font family (${raw.slice(0, 40)}); keep it in your own CSS`;
      report.dropped.push({ name: k, why });
    }
  }
  for (const fam of ["spacing", "radius", "shadow"]) if (!tokens[fam].tokens.length) delete tokens[fam];
  return { tokens, report };
}

function safe(name, value) {
  if (!NAME_OK.test(name)) throw new Error(`token name "${name}" is not allowed`);
  if (/[;{}]/.test(String(value))) throw new Error(`token "${name}" has a value with ; { or }`);
  return value;
}

export function toCss(tokens) {
  const ref = (v) => (typeof v === "string" ? v.replace(/^\{([^}]+)\}$/, "var(--$1)") : v);
  const rootSel = tokens.meta?.root === "@theme" ? "@theme" : ":root";
  const darkMech = tokens.meta?.dark_mechanism || '[data-theme="dark"]';
  const lines = [`/* ${tokens.name || "Design system"} — ${GENERATED}. Do not edit by hand. */`, `${rootSel} {`];
  const themes = (tokens.color?.themes || [{ id: "light" }]).map((t) => t.id);
  const first = themes[0];
  for (const t of tokens.color?.tokens || []) {
    const v = typeof t.value === "string" ? t.value : t.value[first];
    if (v !== undefined) lines.push(`  --${t.name}: ${safe(t.name, ref(v))};`);
  }
  for (const fam of ["spacing", "radius", "shadow"]) for (const t of tokens[fam]?.tokens || []) lines.push(`  --${t.name}: ${safe(t.name, t.value)};`);
  for (const [k, v] of Object.entries(tokens.type?.families || {})) lines.push(`  --font-${k}: ${safe(`font-${k}`, v)};`);
  lines.push("}");
  const darkTokens = (tokens.color?.tokens || []).filter((t) => typeof t.value === "object" && t.value.dark !== undefined);
  if (themes.includes("dark") && darkTokens.length) {
    const body = darkTokens.map((t) => `--${t.name}: ${safe(t.name, ref(t.value.dark))};`);
    if (darkMech === "media") lines.push("@media (prefers-color-scheme: dark) {", "  :root {", ...body.map((l) => `    ${l}`), "  }", "}");
    else lines.push(`${darkMech} {`, ...body.map((l) => `  ${l}`), "}");
  }
  return lines.join("\n") + "\n";
}

// --- colour math for contrast ---------------------------------------------
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const num = (s, scale = 1) => (String(s).endsWith("%") ? parseFloat(s) / 100 * scale : parseFloat(s));
function hexToRgb(hex) {
  let h = hex.slice(1);
  if (h.length <= 4) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}
function args(v) { return v.slice(v.indexOf("(") + 1, v.lastIndexOf(")")).split("/")[0].trim().split(/[\s,]+/).filter(Boolean); }
function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map((n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)));
}
function oklchToRgb(L, C, H) {
  const hr = (H * Math.PI) / 180;
  const a = C * Math.cos(hr); const b = C * Math.sin(hr);
  const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const lin = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_,
  ];
  return lin.map((c) => clamp01(c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
}
export function toRgb(color) {
  const v = String(color).trim();
  if (HEX.test(v)) return hexToRgb(v);
  const fn = v.match(/^([a-z]+)\(/i)?.[1]?.toLowerCase();
  const a = fn ? args(v) : [];
  if ((fn === "rgb" || fn === "rgba") && a.length >= 3) return a.slice(0, 3).map((x) => clamp01(num(x, 255) / 255));
  if ((fn === "hsl" || fn === "hsla") && a.length >= 3) return hslToRgb(parseFloat(a[0]), clamp01(num(a[1], 1)), clamp01(num(a[2], 1)));
  if (fn === "oklch" && a.length >= 3) return oklchToRgb(num(a[0], 1), num(a[1], 0.4), parseFloat(a[2]) || 0);
  return null;
}
export function luminance(color) {
  const rgb = toRgb(color);
  if (!rgb) return null;
  const lin = rgb.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
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
    const bg = (t.usage || "").match(/\bon ([A-Za-z0-9][A-Za-z0-9_.-]*)/)?.[1]?.replace(/[.]+$/, "");
    if (!bg || !colors.has(bg)) continue;
    for (const theme of themes) {
      const fg = resolve(t.name, theme);
      const back = resolve(bg, theme);
      const r = fg && back ? ratio(fg, back) : null;
      rows.push({ fg: t.name, bg, theme, ratio: r, pass: r === null ? null : r >= min });
    }
  }
  return rows;
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const opt = (n) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : undefined; };
  const positional = rest.filter((a, i) => !a.startsWith("--") && !(i > 0 && rest[i - 1].startsWith("--")));
  const write = (text, guard = false) => {
    const out = opt("--out");
    if (!out) { process.stdout.write(text); return; }
    if (guard && fs.existsSync(out) && !fs.readFileSync(out, "utf8").split("\n")[0].includes(GENERATED)) {
      throw new Error(`${out} was not generated by design-tokens; write to a new file (for example docs/design/tokens.generated.css) and import it`);
    }
    fs.writeFileSync(out, text);
  };
  try {
    if (cmd === "extract" && positional.length) {
      const { tokens, report } = extract(positional.map((f) => fs.readFileSync(f, "utf8")), opt("--name") || "System");
      write(JSON.stringify(tokens, null, 2) + "\n");
      const counts = `${tokens.color.tokens.length} colors, ${tokens.spacing?.tokens.length || 0} spacing, ${tokens.radius?.tokens.length || 0} radius, ${tokens.shadow?.tokens.length || 0} shadow, ${Object.keys(tokens.type.families).length} families`;
      process.stderr.write(`design-tokens: ${counts}; ${report.dropped.length} not converted, ${report.conditional.length} conditional overrides ignored\n`);
      for (const d of [...report.dropped, ...report.conditional]) process.stderr.write(`  - ${d.name}: ${d.why}\n`);
      return 0;
    }
    if (cmd === "export" && positional.length) { write(toCss(JSON.parse(fs.readFileSync(positional[0], "utf8"))), true); return 0; }
    if (cmd === "contrast" && positional.length) {
      const min = Number(opt("--min") || 4.5);
      const rows = contrastReport(JSON.parse(fs.readFileSync(positional[0], "utf8")), min);
      for (const r of rows) process.stdout.write(`${r.pass === false ? "FAIL" : r.pass ? "ok  " : "??  "} ${r.fg} on ${r.bg} [${r.theme}] ${r.ratio ?? "unmeasurable colour"}\n`);
      if (!rows.length) { process.stdout.write("no token has a usage note naming its background (\"... on <token>\")\n"); return 2; }
      if (rows.every((r) => r.pass === null)) return 2;
      return rows.some((r) => r.pass === false) ? 1 : 0;
    }
  } catch (e) { process.stderr.write(`design-tokens: ${e.message}\n`); return 2; }
  process.stderr.write("usage: design-tokens.mjs extract <css>... [--name N] [--out F] | export <tokens.json> [--out F] | contrast <tokens.json> [--min 4.5]\n");
  return 2;
}

// Main-module check that survives the symlinked install path (~/.claude/skills/...).
const isMain = (() => { try { return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) process.exit(main(process.argv.slice(2)));
