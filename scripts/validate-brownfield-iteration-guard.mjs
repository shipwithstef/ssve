#!/usr/bin/env node

import fs from "node:fs";

const [templatePath = "references/templates/brownfield-iter-visual.json"] = process.argv.slice(2);
const graph = JSON.parse(fs.readFileSync(templatePath, "utf8"));
const failures = [];

if (graph.lane !== "brownfield-iter-visual") {
  failures.push("template must declare lane brownfield-iter-visual");
}

for (const task of graph.tasks || []) {
  const text = `${task.description || ""} ${task.subject || ""}`.toLowerCase();
  if (text.includes("review") && task.metadata?.skill !== "review-gate") {
    failures.push(`review task ${task.id || "<unknown>"} must bind metadata.skill=review-gate`);
  }
}

if (!(graph.tasks || []).some((task) => task.metadata?.skill === "land-changeset")) {
  failures.push("template must include land-changeset");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`${templatePath}: PASS - brownfield iteration review tasks are skill-bound`);
