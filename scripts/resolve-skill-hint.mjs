#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error("Usage: node scripts/resolve-skill-hint.mjs --text <hint> [--manifest skills-manifest.json]");
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

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const args = parseArgs(process.argv.slice(2));
if (!args.text) usage();

const manifestPath = path.resolve(args.manifest ?? "skills-manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const included = new Set(manifest.includedSkills ?? []);

const aliases = [
  {
    skill: "test-journeys",
    terms: ["test journey", "test journeys", "journey test", "journey testing"],
    reason: "journey-level runtime verification hint",
  },
  {
    skill: "write-e2e",
    terms: ["e2e", "end to end test", "playwright test", "browser test"],
    reason: "end-to-end test authoring hint",
  },
  {
    skill: "track-visuals",
    terms: ["visual tracking", "track visuals", "screenshot", "screenshots", "visual evidence"],
    reason: "visual evidence capture hint",
  },
  {
    skill: "review-gate",
    terms: ["qa skill", "qa skills", "quality gate", "review gate"],
    reason: "quality review hint",
  },
  {
    skill: "audit-implementation",
    terms: ["qa skill", "qa skills", "implementation audit", "audit implementation"],
    reason: "implementation audit hint",
  },
];

const normalized = normalize(args.text);
const matches = [];
/** Match complete normalized phrases, never a fragment of a larger word. */
const includesPhrase = (candidate) => ` ${normalized} `.includes(` ${normalize(candidate)} `);

for (const alias of aliases) {
  if (!included.has(alias.skill)) continue;
  const term = [...alias.terms].sort((a, b) => b.length - a.length).find(includesPhrase);
  if (!term) continue;
  matches.push({
    skill: alias.skill,
    matched: term,
    reason: alias.reason,
    confidence: "high",
  });
}

// Explicit catalog names remain discoverable even without a curated synonym.
for (const skill of [...included].filter((name) => typeof name === "string").sort()) {
  if (matches.some((match) => match.skill === skill) || !includesPhrase(skill)) continue;
  matches.push({ skill, matched: skill, reason: "explicit catalog skill name", confidence: "high" });
}

console.log(JSON.stringify({ input: args.text, normalized, matches }, null, 2));
