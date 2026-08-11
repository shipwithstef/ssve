#!/usr/bin/env node
// WI-143: One-time migration advisory for projects with <30 competitor count.
// Run after WI-143 lands to identify gaps per tier.

import fs from "node:fs";
import path from "node:path";

const DATA_FILE = "references/knowledge/competitors/analyze-competitors.data.json";
const INDEX_FILE = "references/knowledge/competitors/index.md";

function main() {
  const root = process.env.SVC_REPO_ROOT || process.cwd();
  const dataPath = path.join(root, DATA_FILE);
  const indexPath = path.join(root, INDEX_FILE);

  if (!fs.existsSync(dataPath)) {
    console.log("[audit-competitors-floor] No analyze-competitors.data.json found. Run analyze-competitors first.");
    process.exit(0);
  }

  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const competitors = data.competitors || [];

  const tiers = { direct: 0, adjacent: 0, emerging: 0, macro: 0 };
  for (const c of competitors) {
    const t = c.tier || "unknown";
    if (tiers[t] !== undefined) tiers[t]++;
  }

  const targets = { direct: 10, adjacent: 10, emerging: 8, macro: 6 };
  const gaps = {};
  for (const [tier, count] of Object.entries(tiers)) {
    const gap = targets[tier] - count;
    if (gap > 0) gaps[tier] = gap;
  }

  const total = competitors.length;
  const totalGap = Math.max(0, 30 - total);

  console.log("# Competitor Floor Audit Advisory\n");
  console.log(`**Current count:** ${total} competitors`);
  console.log(`**Target floor:** 30 competitors`);
  console.log(`**Gap:** ${totalGap > 0 ? totalGap + " missing" : "meets floor ✅"}\n`);

  console.log("## By Tier\n");
  console.log("| Tier | Current | Target | Gap |");
  console.log("|------|---------|--------|-----|");
  for (const [tier, target] of Object.entries(targets)) {
    const count = tiers[tier];
    const gap = gaps[tier] || 0;
    console.log(`| ${tier} | ${count} | ${target} | ${gap > 0 ? gap + " missing" : "✅"} |`);
  }

  if (totalGap > 0 || Object.keys(gaps).length > 0) {
    console.log("\n## Recommended Actions\n");
    if (gaps.direct) console.log(`- **Direct:** Run \`analyze-competitors\` scoped to direct tier. Target ${gaps.direct} more.`);
    if (gaps.adjacent) console.log(`- **Adjacent:** Run \`analyze-competitors\` scoped to adjacent tier. Target ${gaps.adjacent} more.`);
    if (gaps.emerging) console.log(`- **Emerging:** Run \`analyze-competitors\` scoped to emerging tier. Target ${gaps.emerging} more.`);
    if (gaps.macro) console.log(`- **Macro:** Run \`analyze-competitors\` scoped to macro tier. Target ${gaps.macro} more.`);
    console.log("\nRun `node scripts/audit-competitors-floor.mjs` again after adding competitors.");
    process.exit(1);
  } else {
    console.log("\n✅ Floor met. No action required.");
    process.exit(0);
  }
}

main();
