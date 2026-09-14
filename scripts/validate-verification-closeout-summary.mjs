#!/usr/bin/env node

import fs from "node:fs";

function usage() {
  console.error("Usage: node scripts/validate-verification-closeout-summary.mjs --summary <SUMMARY.md>");
  process.exit(1);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) usage();
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) usage();
    out[key] = value;
    i += 1;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.summary) usage();

const text = fs.readFileSync(args.summary, "utf8");
const lines = text.split("\n");
const issues = [];

const mentionsStaticProof = /\b(bundle[- ]?grep|grep (dist|bundle|build)|static proof|structural proof)\b/i.test(text);
if (mentionsStaticProof && !/^Verification tier:\s*V0\b/im.test(text)) {
  issues.push("static or bundle-grep proof must self-label with 'Verification tier: V0'");
}

const hasBrowserVisibleV0 = lines.some((line) => {
  return (
    /browser-visible/i.test(line) &&
    (/\bverification[_ -]?tier\b\s*[:|]\s*"?V0"?/i.test(line) ||
      /\bevidence[_ -]?level\b\s*[:|]\s*"?V0"?/i.test(line) ||
      /\|\s*V0\s*\|/.test(line))
  );
});

const unqualifiedCloseoutLine = lines.find((line) => {
  if (!/^\s*(overall|cumulative|final|status|result)\b/i.test(line)) return false;
  if (/\b(VERIFIED-L2|VERIFIED-USER|UNVERIFIED|PARTIAL|BLOCKED|V0-only|unsampled)\b/i.test(line)) {
    return false;
  }
  return /\b(VERIFIED|complete|completed)\b/i.test(line);
});

if (hasBrowserVisibleV0 && unqualifiedCloseoutLine) {
  issues.push(
    "cumulative closeout cannot use unqualified VERIFIED/complete wording while a browser-visible item remains V0-only"
  );
}

const singleLane = /single_lane_summary\s*:/i.test(text);
if (singleLane) {
  for (const field of ["verification_tier", "sampled", "evidence"]) {
    if (!new RegExp(`\\b${field}\\b`, "i").test(text)) {
      issues.push(`single_lane_summary must include ${field}`);
    }
  }
}

if (issues.length > 0) {
  for (const issue of issues) console.error(`FAIL: ${issue}`);
  process.exit(1);
}

console.log(`verification closeout summary valid: ${args.summary}`);
