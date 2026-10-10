#!/usr/bin/env node
/** Tier 1: design-tokens.mjs converts code CSS variables to the Design System tokens.json shape and back, never guesses unreadable values, and checks contrast. Hermetic. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { extract, toCss, ratio, contrastReport, parseBlocks } from "../../../scripts/design-tokens.mjs";

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../scripts/design-tokens.mjs");
const colors = (css) => Object.fromEntries(extract([css]).tokens.color.tokens.map((t) => [t.name, t.value]));

const CSS = `
/* tokens */
:root { --surface: #fbf7f1; --ink: #2b2118; --text: var(--ink); --gap: var(--space-4); --space-4: 16px;
  --radius-md: 8px; --shadow-card: 0 1px 2px rgba(0,0,0,.1); --font-sans: "Acme Sans", system-ui; --overlay: color-mix(in srgb, black 40%, transparent); --accent: red; }
@media (prefers-color-scheme: dark) { :root { --surface: #1d1a17; --ink: #f3ece3; } }
.button { --local: 3px; }
@theme { --color-success: #1a7f37; }
`;

test("only root, theme and @theme blocks count; component-scoped variables stay out", () => {
  const { tokens } = extract([CSS], "Acme");
  const names = tokens.color.tokens.map((t) => t.name);
  assert.deepEqual(names.sort(), ["color-success", "ink", "surface", "text"]);
  assert.ok(!JSON.stringify(tokens).includes("local"));
  assert.ok(parseBlocks(CSS).some((b) => b.chain.some((p) => /prefers-color-scheme/.test(p))));
});

test("output is the list shape the Design System page reads, with light first and dark values", () => {
  const { tokens } = extract([CSS], "Acme");
  assert.deepEqual(tokens.color.themes.map((t) => t.id), ["light", "dark"]);
  const surface = tokens.color.tokens.find((t) => t.name === "surface");
  assert.deepEqual(surface.value, { light: "#fbf7f1", dark: "#1d1a17" });
  assert.equal(tokens.color.tokens.find((t) => t.name === "text").value.light, "{ink}");
  assert.equal(tokens.spacing.tokens[0].value, "16px");
  assert.equal(tokens.radius.tokens[0].name, "radius-md");
  assert.equal(tokens.type.families.sans, '"Acme Sans", system-ui');
  for (const fam of ["color", "spacing", "radius", "shadow"]) assert.ok(Array.isArray(tokens[fam].tokens), fam);
});

test("values the page would drop are reported, not guessed", () => {
  const { report } = extract([CSS], "Acme");
  const dropped = Object.fromEntries(report.dropped.map((d) => [d.name, d.why]));
  assert.match(dropped.overlay, /cannot read/);
  assert.match(dropped.accent, /cannot read/);
  assert.match(dropped.gap, /aliases for colours only/, "an alias to spacing is reported, not exported as var()");
});

test("export writes CSS back with the source's dark mechanism and root, aliases as var()", () => {
  const css = toCss(extract([CSS], "Acme").tokens);
  assert.match(css, /--text: var\(--ink\);/);
  assert.match(css, /@media \(prefers-color-scheme: dark\) \{\n {2}:root \{\n {4}--surface: #1d1a17;/);
  assert.match(css, /--font-sans: "Acme Sans", system-ui;/);
  const cls = toCss(extract([":root{--bg:#fff} .dark{--bg:#000}"]).tokens);
  assert.match(cls, /^\.dark \{\n {2}--bg: #000;/m);
  assert.match(toCss(extract(["@theme{--color-brand:#123456}"]).tokens), /^@theme \{/m);
});

test("parser handles strings, nesting, url() and only theme-level blocks", () => {
  assert.deepEqual(colors(":root{--bg:#fff; @media (prefers-color-scheme:dark){--bg:#000} --fg:#111}"), { bg: { light: "#fff", dark: "#000" }, fg: { light: "#111" } });
  assert.deepEqual(Object.keys(colors(':root{--quote:"}"; --bg:#fff; --fg:#000}')).sort(), ["bg", "fg"]);
  assert.deepEqual(Object.keys(colors("@media (prefers-color-scheme: dark){ .button{--btn:#222} } .dark-mode-toggle{--t:#111} .dark .card{--c:#333} :root{--ok:#fff}")), ["ok"]);
  assert.deepEqual(colors(":root:not(.dark){--bg:#fff} .dark{--bg:#000}"), { bg: { light: "#fff", dark: "#000" } });
  assert.deepEqual(Object.keys(colors(":root{--img:url(data:image/png;base64,AA==); --bg:#fff}")), ["bg"]);
  const responsive = extract([":root{--space-4:16px} @media (min-width:768px){:root{--space-4:24px}}"]);
  assert.equal(responsive.tokens.spacing.tokens[0].value, "16px");
  assert.equal(responsive.report.conditional[0].name, "space-4");
});

test("export refuses hand-written files and unsafe names; writes generated ones", () => {
  assert.throws(() => toCss({ name: "x", color: { tokens: [{ name: "a: red; } body{display:none} :root{--b", value: "#fff" }] } }), /not allowed/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tokens-"));
  const tokensFile = path.join(dir, "t.json");
  fs.writeFileSync(tokensFile, JSON.stringify(extract([CSS], "Acme").tokens));
  const hand = path.join(dir, "app.css");
  fs.writeFileSync(hand, ":root{--z-modal:50}\n.btn{color:red}\n");
  const r = spawnSync(process.execPath, [script, "export", tokensFile, "--out", hand], { encoding: "utf8" });
  assert.equal(r.status, 2);
  assert.equal(fs.readFileSync(hand, "utf8"), ":root{--z-modal:50}\n.btn{color:red}\n");
  const gen = path.join(dir, "tokens.generated.css");
  assert.equal(spawnSync(process.execPath, [script, "export", tokensFile, "--out", gen]).status, 0);
  assert.equal(spawnSync(process.execPath, [script, "export", tokensFile, "--out", gen]).status, 0, "regenerating its own file is allowed");
});

test("contrast follows 'on <token>' usage notes in every theme", () => {
  assert.equal(ratio("#000000", "#ffffff"), 21);
  assert.equal(ratio("hsl(0 0% 0%)", "rgb(100% 100% 100%)"), 21);
  assert.ok(ratio("oklch(0.6 0.15 40)", "#ffffff") > 3 && ratio("oklch(0.6 0.15 40)", "#ffffff") < 5);
  const tokens = { color: { themes: [{ id: "light" }, { id: "dark" }], tokens: [
    { name: "bg", value: { light: "#ffffff", dark: "#111111" }, usage: "Page." },
    { name: "fg", value: { light: "#777777", dark: "#eeeeee" }, usage: "Body text on bg." },
  ] } };
  const rows = contrastReport(tokens, 4.5);
  assert.deepEqual(rows.map((r) => [r.theme, r.pass]), [["light", false], ["dark", true]]);
});
