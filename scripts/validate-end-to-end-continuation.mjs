#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error(
    "Usage: node scripts/validate-end-to-end-continuation.mjs --decisions <pipeline-decisions.jsonl> [--lane-tasks <lane-tasks.json>]"
  );
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonl(filePath) {
  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        return { index: index + 1, value: JSON.parse(line) };
      } catch (error) {
        throw new Error(`${filePath}:${index + 1}: invalid JSON: ${error.message}`);
      }
    });
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function continuationPayload(entry) {
  return asObject(entry.details)?.end_to_end_continuation ?? entry.end_to_end_continuation ?? null;
}

function validatePayload(payload, source) {
  const issues = [];
  const requiredStrings = [
    "original_commitment_phrase",
    "seam_crossed",
    "gap_classification",
    "next_action",
  ];
  for (const field of requiredStrings) {
    if (typeof payload[field] !== "string" || payload[field].trim().length === 0) {
      issues.push(`${source}: missing non-empty ${field}`);
    }
  }

  if (!Number.isInteger(payload.recursion_depth) || payload.recursion_depth < 0) {
    issues.push(`${source}: recursion_depth must be a non-negative integer`);
  }
  if (!Number.isInteger(payload.recursion_limit) || payload.recursion_limit < 1) {
    issues.push(`${source}: recursion_limit must be a positive integer`);
  }
  if (
    Number.isInteger(payload.recursion_depth) &&
    Number.isInteger(payload.recursion_limit) &&
    payload.recursion_depth > payload.recursion_limit
  ) {
    issues.push(`${source}: recursion_depth exceeds recursion_limit`);
  }

  const blast = asObject(payload.blast_radius);
  if (!blast) {
    issues.push(`${source}: blast_radius object is required`);
  } else {
    for (const field of [
      "destructive_git",
      "paid_spend",
      "schema_or_data_risk",
      "security_escalation",
      "pause_required",
    ]) {
      if (typeof blast[field] !== "boolean") {
        issues.push(`${source}: blast_radius.${field} must be boolean`);
      }
    }
    const risky =
      blast.destructive_git || blast.paid_spend || blast.schema_or_data_risk || blast.security_escalation;
    if (risky && blast.pause_required !== true) {
      issues.push(`${source}: risky blast radius requires pause_required=true`);
    }
  }

  return issues;
}

function requiredContinuationsFromGraph(graph) {
  const mutations = Array.isArray(graph.mutation_history) ? graph.mutation_history : [];
  return mutations.filter((mutation) => {
    if (!mutation || typeof mutation !== "object") return false;
    if (mutation.requires_continuation_decision === true) return true;
    const action = String(mutation.action ?? "");
    const seam = String(mutation.seam_crossed ?? mutation.source_seam ?? "");
    return /auto[-_]?continu|insert_task|return_to_prior_gate/.test(action) && /verif/i.test(seam);
  });
}

const args = parseArgs(process.argv.slice(2));
if (!args.decisions) usage();

const decisionRows = readJsonl(args.decisions);
const continuations = [];
const issues = [];

for (const row of decisionRows) {
  const payload = continuationPayload(row.value);
  if (!payload) continue;
  continuations.push({ row, payload });
  issues.push(...validatePayload(payload, `${args.decisions}:${row.index}`));
}

let required = [];
if (args["lane-tasks"]) {
  const graph = readJson(args["lane-tasks"]);
  required = requiredContinuationsFromGraph(graph);
  for (const mutation of required) {
    const seam = mutation.seam_crossed ?? mutation.source_seam;
    const matched = continuations.some(({ row, payload }) => {
      const wiMatches = !graph.wi || !row.value.wi || row.value.wi === graph.wi;
      const seamMatches = !seam || payload.seam_crossed === seam;
      return wiMatches && seamMatches;
    });
    if (!matched) {
      issues.push(
        `${args["lane-tasks"]}: mutation requires end_to_end_continuation decision` +
          (seam ? ` for seam ${seam}` : "")
      );
    }
  }
}

if (issues.length > 0) {
  for (const issue of issues) console.error(`FAIL: ${issue}`);
  process.exit(1);
}

console.log(
  `end-to-end continuation: ${continuations.length} decision(s), ${required.length} required seam(s) validated`
);
