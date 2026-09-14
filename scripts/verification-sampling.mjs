#!/usr/bin/env node
import crypto from "node:crypto";

function usage() {
  console.error("Usage: node scripts/verification-sampling.mjs <pr-or-surface> [<pr-or-surface> ...]");
  console.error("Reads newline-separated identifiers from stdin when no args are provided.");
}

function normalize(items) {
  return [...new Set(items.map((item) => String(item).trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "en", { numeric: true })
  );
}

function hashText(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function sampleCampaign(items) {
  const sorted = normalize(items);
  const count = sorted.length;
  const sampleSize = count >= 3 ? Math.max(Math.ceil(count / 3), Math.min(3, count)) : count;
  const seed = hashText(sorted.join("\n"));
  const selected = new Map();

  if (count === 0) {
    return { campaign_size: 0, sample_size: 0, seed, sorted_prs: [], selected: [] };
  }

  if (count >= 1) selected.set(0, "first");
  if (count >= 3) selected.set(Math.floor((count - 1) / 2), "middle");
  if (count >= 2) selected.set(count - 1, "last");

  const candidates = sorted.map((id, index) => ({
    id,
    index,
    rank: hashText(`${seed}:${index}:${id}`),
  }));

  candidates.sort((a, b) => a.rank.localeCompare(b.rank) || a.index - b.index);

  for (const candidate of candidates) {
    if (selected.size >= sampleSize) break;
    if (!selected.has(candidate.index)) {
      selected.set(candidate.index, "hash-fill");
    }
  }

  const selectedRows = [...selected.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, reason]) => ({
      index,
      id: sorted[index],
      reason,
      required_minimum_tier: "V1",
    }));

  return {
    campaign_size: count,
    sample_size: selectedRows.length,
    seed,
    sorted_prs: sorted,
    selected: selectedRows,
    summary_requirements: {
      every_pr_lists_verification_tier: true,
      sampled_prs_require_v1_or_v2_evidence: true,
    },
  };
}

async function main() {
  let items = process.argv.slice(2);
  if (items.includes("--help") || items.includes("-h")) {
    usage();
    process.exit(0);
  }

  if (items.length === 0 && !process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    items = Buffer.concat(chunks).toString("utf8").split(/\r?\n/);
  }

  const result = sampleCampaign(items);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});

export { sampleCampaign };
