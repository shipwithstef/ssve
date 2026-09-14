#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(md|mdx|jsx|tsx|js|ts|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const root = process.argv[2] || ".";
const files = walk(root);
const motionRe = /\b(framer-motion|motion\.|animate\(|transition|@keyframes|animation:|whileHover|whileInView|stagger|spring)\b/i;
const citationRe = /references\/motion-patterns\.md|motion\.duration\.|motion\.easing\.|motion budget|canonical motion/i;
const reducedRe = /prefers-reduced-motion|reduced motion|motion-reduce|useReducedMotion/i;
const failures = [];

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  if (!motionRe.test(text)) continue;
  if (!citationRe.test(text)) failures.push(`${file}: motion present without canonical motion-pattern citation or token`);
  if (!reducedRe.test(text)) failures.push(`${file}: motion present without reduced-motion handling`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`${root}: PASS - motion usage is tied to canonical patterns and reduced-motion handling`);
