#!/usr/bin/env node
/** Tier 1: design-tokens.mjs converts code CSS variables to the Design System tokens.json shape and back, never guesses unreadable values, and checks contrast. Hermetic. */
import test from "node:test";
import assert from "node:assert/strict";
import { extract, toCss, ratio, contrastReport, parseBlocks } from "../../../scripts/design-tokens.mjs";

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
  assert.ok(parseBlocks(CSS).some((b) => b.darkMedia));
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

test("export writes CSS variables back, aliases as var(), dark theme under [data-theme]", () => {
  const css = toCss(extract([CSS], "Acme").tokens);
  assert.match(css, /--text: var\(--ink\);/);
  assert.match(css, /\[data-theme="dark"\] \{\n {2}--surface: #1d1a17;/);
  assert.match(css, /--font-sans: "Acme Sans", system-ui;/);
});

test("contrast follows 'on <token>' usage notes in every theme", () => {
  assert.equal(ratio("#000000", "#ffffff"), 21);
  const tokens = { color: { themes: [{ id: "light" }, { id: "dark" }], tokens: [
    { name: "bg", value: { light: "#ffffff", dark: "#111111" }, usage: "Page." },
    { name: "fg", value: { light: "#777777", dark: "#eeeeee" }, usage: "Body text on bg." },
  ] } };
  const rows = contrastReport(tokens, 4.5);
  assert.deepEqual(rows.map((r) => [r.theme, r.pass]), [["light", false], ["dark", true]]);
});
