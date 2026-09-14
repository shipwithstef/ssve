#!/usr/bin/env node
/** check-chain-independence (WI-365 L1): which includedSkills are mechanically
 * safe for `disable-model-invocation: true`? Eligible = appears in NO
 * laneDefinitions.*.skills / corePackForRouting / bootstrapStartSequence /
 * mandatoryChainOutOfLane AND has zero references from any other skill,
 * reference doc, script, or hook (conservative: any mention excludes). */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const m = JSON.parse(readFileSync("skills-manifest.json", "utf8"));
const inc = m.includedSkills;
const member = new Set([
  ...Object.values(m.laneDefinitions ?? {}).flatMap((l) => l.skills ?? []),
  ...(m.corePackForRouting ?? []),
  ...(m.bootstrapStartSequence ?? []),
  ...Object.keys(m.mandatoryChainOutOfLane ?? {}),
]);
let files;
try {
  files = execSync(
    "git ls-files '*/SKILL.md' '*/references/*.md' 'scripts/*.mjs' 'scripts/*.sh' 'hooks/*.mjs' 'hooks/*.sh' '_shared/*.md'",
    { encoding: "utf8" }
  ).split("\n").filter(Boolean);
} catch (e) {
  // WI365-G6-003: restricted sandboxes (EPERM on /bin/sh) — fail closed with an
  // actionable message instead of a spawn stack; eligibility must not be guessed.
  console.error(`check-chain-independence: cannot enumerate repo files (${e.code || e.message}) — run from a git checkout with shell access`);
  process.exit(1);
}
const hay = files.map((p) => ({ p, t: readFileSync(p, "utf8") }));
// WI365-G6-003: chain frontmatter is an explicit membership surface — parse every
// skill's `chain:` block and exclude any skill named there (beyond substring refs).
const chainNamed = new Set();
for (const { p, t } of hay) {
  if (!p.endsWith("/SKILL.md")) continue;
  const fm = t.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) continue;
  const cm = fm[1].match(/^chain:\s*([\s\S]*?)(?=^\w[\w-]*:|(?![\s\S]))/m);
  if (!cm) continue;
  for (const name of inc) if (cm[1].includes(name)) chainNamed.add(name);
}
const eligible = [], near = [];
for (const s of inc) {
  if (chainNamed.has(s)) continue;
  if (member.has(s)) continue;
  const pats = [`/${s}`, `\`${s}\``, `skill: ${s}`, `"${s}"`];
  const refs = hay.filter(({ p, t }) => !p.startsWith(`skills/${s}/`) && pats.some((x) => t.includes(x)));
  (refs.length ? near : eligible).push(refs.length ? `${s} (${refs.length} refs)` : s);
}
console.log(`eligible for disable-model-invocation (${eligible.length}):`);
for (const s of eligible) console.log("  -", s);
console.log(`\nnear-miss — no membership but referenced (${near.length}), NOT eligible:`);
for (const s of near) console.log("  -", s);
