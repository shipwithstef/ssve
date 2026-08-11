#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { WI_ID_BODY } from "../hooks/lib/wi-id.mjs";

const root = process.cwd();
const mapPath = path.join(root, "docs/specs/work-items/WI-312-residual-map.json");
const errors = [];

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), "utf8"));
}

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function collectWis() {
  const dir = path.join(root, "docs/specs/work-items");
  return new Set(
    fs.readdirSync(dir)
      .map((file) => file.match(new RegExp("^(" + WI_ID_BODY + ")\\.md$"))?.[1])
      .filter(Boolean),
  );
}

if (!exists("docs/specs/work-items/WI-312-residual-map.json")) {
  errors.push("missing WI-312 residual map");
}

const map = errors.length ? null : JSON.parse(fs.readFileSync(mapPath, "utf8"));
const wis = collectWis();
const classifications = new Set(["covered", "invalid", "child-wi"]);
const requiredSources = new Set([
  "proposals/done/2026-04-25-deterministic-quality-hooks.md",
  "proposals/done/2026-04-25-dynamic-deterministic-reliability-review.md",
  "proposals/done/2026-04-29-completion-guard-historical-skip.md",
]);
const requiredChildWis = new Set(["WI-324"]);
const seenSources = new Set();
const seenFindings = new Set();
const childWis = new Set();

if (map) {
  if (map.schema !== 1) errors.push("map.schema must be 1");
  if (map.wi !== "WI-312") errors.push("map.wi must be WI-312");
  if (!Array.isArray(map.sources) || map.sources.length === 0) errors.push("map.sources must be non-empty");

  for (const source of map.sources ?? []) {
    if (!nonEmpty(source.proposal)) {
      errors.push("source missing proposal");
      continue;
    }
    seenSources.add(source.proposal);
    if (!requiredSources.has(source.proposal)) errors.push(`${source.proposal}: unexpected source`);
    if (!exists(source.proposal)) errors.push(`${source.proposal}: file missing`);
    if (!Array.isArray(source.findings) || source.findings.length === 0) {
      errors.push(`${source.proposal}: findings must be non-empty`);
      continue;
    }
    for (const finding of source.findings) {
      const key = `${source.proposal}#${finding.id ?? ""}`;
      if (!nonEmpty(finding.id)) errors.push(`${source.proposal}: finding missing id`);
      if (seenFindings.has(key)) errors.push(`${key}: duplicate finding id`);
      seenFindings.add(key);
      if (!classifications.has(finding.classification)) errors.push(`${key}: invalid classification`);
      if (!nonEmpty(finding.evidence)) errors.push(`${key}: missing evidence`);
      if ((finding.classification === "covered" || finding.classification === "child-wi") && !nonEmpty(finding.owner_wi)) {
        errors.push(`${key}: owner_wi required for ${finding.classification}`);
      }
      if (nonEmpty(finding.owner_wi) && !wis.has(finding.owner_wi)) {
        errors.push(`${key}: owner_wi ${finding.owner_wi} does not exist`);
      }
      if (finding.classification === "child-wi") childWis.add(finding.owner_wi);
      if (finding.classification === "invalid" && !nonEmpty(finding.reason)) {
        errors.push(`${key}: invalid classification requires reason`);
      }
    }
  }
}

for (const source of requiredSources) {
  if (!seenSources.has(source)) errors.push(`${source}: missing from residual map`);
}
for (const wi of requiredChildWis) {
  if (!childWis.has(wi)) errors.push(`${wi}: child WI not referenced by residual map`);
}
for (const key of [
  "proposals/done/2026-04-25-deterministic-quality-hooks.md#G-3",
  "proposals/done/2026-04-25-deterministic-quality-hooks.md#G-5",
  "proposals/done/2026-04-29-completion-guard-historical-skip.md#H-1",
]) {
  if (!seenFindings.has(key)) errors.push(`${key}: required residual fixture missing`);
}

const triage = readJson("proposals/triage.json");
for (const name of [
  "2026-04-25-deterministic-quality-hooks.md",
  "2026-04-25-dynamic-deterministic-reliability-review.md",
  "2026-04-29-completion-guard-historical-skip.md",
]) {
  const entry = triage.entries?.[name];
  if (!entry || entry.accepted_wi !== "WI-312") errors.push(`${name}: triage accepted_wi must be WI-312`);
  if (entry?.residual_map !== "docs/specs/work-items/WI-312-residual-map.json") {
    errors.push(`${name}: triage residual_map must point to WI-312-residual-map.json`);
  }
}

const guard = fs.readFileSync(path.join(root, "hooks/svc-task-completion-guard.sh"), "utf8");
if (!guard.includes("historicalSkipWIs")) errors.push("completion guard missing historicalSkipWIs logic");
if (!guard.includes("historical_skip")) errors.push("completion guard missing historical_skip parse");

const decisionLogDoc = fs.readFileSync(path.join(root, "skills/route-workflow/references/decision-log.md"), "utf8");
if (!decisionLogDoc.includes("historical_skip: true")) errors.push("decision-log docs missing historical_skip contract");

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

console.log(`hook/host residual map: ${seenSources.size} source(s), ${seenFindings.size} finding(s), ${childWis.size} child WI(s)`);
