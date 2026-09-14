#!/usr/bin/env node
/** measure-skill-budget (WI-365 L0): skill-description budget occupancy report.
 * Default root: ~/.claude/skills (the live installed catalog). --root <dir> to override.
 * --fraction 0.01 --context 1000000 to model the native budget (chars ≈ tokens*4). */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const root = arg("--root", join(homedir(), ".claude", "skills"));
const fraction = Number(arg("--fraction", "0.01"));
const context = Number(arg("--context", "1000000"));
const top = Number(arg("--top", "20"));
const budgetTokens = Math.floor(context * fraction);
const budgetChars = budgetTokens * 4;
const rows = [];
for (const name of readdirSync(root)) {
  const p = join(root, name, "SKILL.md");
  if (!existsSync(p)) continue;
  let s; try { s = readFileSync(p, "utf8"); } catch { continue; }
  const m = s.match(/^---\n([\s\S]*?)\n---/);
  if (!m) continue;
  const fm = m[1];
  const dm = fm.match(/^description:\s*([\s\S]*?)(?=^\w[\w-]*:|(?![\s\S]))/m);
  const desc = dm ? dm[1].trim() : "";
  rows.push({ name, chars: desc.length, dmi: /disable-model-invocation:\s*true/.test(fm) });
}
const active = rows.filter((r) => !r.dmi);
const chars = active.reduce((a, r) => a + r.chars, 0);
console.log(`skills: ${rows.length} (${rows.length - active.length} disable-model-invocation)`);
console.log(`active desc chars: ${chars} ≈ ${Math.round(chars / 4)} tokens`);
console.log(`budget @${fraction} of ${context}: ${budgetTokens} tokens ≈ ${budgetChars} chars → occupancy ${(chars / budgetChars * 100).toFixed(0)}%`);
console.log(`\ntop ${top} fattest active descriptions:`);
for (const r of active.sort((a, b) => b.chars - a.chars).slice(0, top)) console.log(`  ${String(r.chars).padStart(5)}  ${r.name}`);
