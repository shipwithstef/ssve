#!/usr/bin/env node
/** Report description-source occupancy; token figures are estimates, not tokenizer measurements.
 * Usage: node scripts/measure-skill-budget.mjs [--root DIR] [--fraction 0.01]
 *        [--context 1000000] [--top 20] [--json] */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/** Parse reporting options without silently accepting missing or invalid values. */
function options(argv) {
  const out = { root: join(homedir(), ".claude", "skills"), fraction: 0.01, context: 1000000, top: 20 };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--json") { out.json = true; continue; }
    if (flag === "--help" || flag === "-h") { out.help = true; continue; }
    if (!["--root", "--fraction", "--context", "--top"].includes(flag)) throw new Error(`unknown option: ${flag}`);
    const value = argv[++i];
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
    out[flag.slice(2)] = flag === "--root" ? value : Number(value);
  }
  if (!Number.isFinite(out.fraction) || out.fraction <= 0 || out.fraction > 1) throw new Error("--fraction must be in (0, 1]");
  if (!Number.isSafeInteger(out.context) || out.context < 1) throw new Error("--context must be a positive integer");
  if (!Number.isSafeInteger(out.top) || out.top < 0) throw new Error("--top must be a non-negative integer");
  if (Math.floor(out.context * out.fraction) < 1) throw new Error("context and fraction must provide at least one budget token");
  return out;
}

/** Count description source consistently across LF, CRLF and UTF-8 BOM files. */
function report(o) {
  const rows = []; const skipped = [];
  for (const name of readdirSync(o.root).sort()) {
    const file = join(o.root, name, "SKILL.md");
    if (!existsSync(file)) continue;
    let text;
    try { text = readFileSync(file, "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n"); }
    catch { skipped.push(name); continue; }
    const frontmatter = text.match(/^---\n([\s\S]*?)\n---(?:\n|$)/)?.[1];
    if (frontmatter === undefined) { skipped.push(name); continue; }
    const desc = frontmatter.match(/^description:\s*([\s\S]*?)(?=^\w[\w-]*:|(?![\s\S]))/m)?.[1].trim() || "";
    rows.push({ name, chars: desc.length, dmi: /^disable-model-invocation:\s*true\s*(?:#.*)?$/m.test(frontmatter) });
  }
  const active = rows.filter((r) => !r.dmi);
  const chars = active.reduce((sum, r) => sum + r.chars, 0);
  const tokens = Math.floor(o.context * o.fraction);
  return { skills: rows.length, disabled: rows.length - active.length, active: active.length,
    description_chars: chars, estimated_tokens: Math.round(chars / 4), budget_tokens: tokens,
    budget_chars: tokens * 4, occupancy_percent: chars / (tokens * 4) * 100,
    largest: active.sort((a, b) => b.chars - a.chars || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)).slice(0, o.top), skipped };
}

let o;
try { o = options(process.argv.slice(2)); }
catch (error) { console.error(`measure-skill-budget: ${error.message}`); process.exit(2); }
if (o.help) {
  console.log("Usage: measure-skill-budget.mjs [--root DIR] [--fraction 0.01] [--context 1000000] [--top 20] [--json]");
} else {
  try {
    const r = report(o);
    if (o.json) console.log(JSON.stringify(r, null, 2));
    else {
      console.log(`skills: ${r.skills} (${r.disabled} disable-model-invocation)`);
      console.log(`active desc chars: ${r.description_chars} ≈ ${r.estimated_tokens} tokens (estimate)`);
      console.log(`budget @${o.fraction} of ${o.context}: ${r.budget_tokens} tokens ≈ ${r.budget_chars} chars → occupancy ${r.occupancy_percent.toFixed(0)}%`);
      console.log(`\ntop ${o.top} largest active descriptions:`);
      for (const row of r.largest) console.log(`  ${String(row.chars).padStart(5)}  ${row.name}`);
      if (r.skipped.length) console.error(`Skipped unreadable or missing-frontmatter skills: ${r.skipped.join(", ")}`);
    }
  } catch (error) { console.error(`measure-skill-budget: ${error.message}`); process.exitCode = 1; }
}
