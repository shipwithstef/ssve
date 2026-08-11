#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { WI_ID_RE, WI_ID_BODY } from "../hooks/lib/wi-id.mjs";

const ALLOWED_SOURCE_SKILLS = new Set([
  "write-e2e",
  "test-journeys",
  "verify-promotion",
  "audit-implementation",
  "review-security",
]);

function usage() {
  console.error("Usage: node scripts/validate-blocking-discovery.mjs --artifact <path>");
  process.exit(2);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) usage();
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) usage();
    args[key] = value;
    i += 1;
  }
  if (!args.artifact) usage();
  return args;
}

function fail(errors) {
  for (const error of errors) console.error(`validate-blocking-discovery: ${error}`);
  process.exit(1);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateEvidence(evidence, errors) {
  if (!Array.isArray(evidence) || evidence.length === 0) {
    errors.push("evidence_artifacts must be a non-empty array");
    return;
  }
  for (const [index, item] of evidence.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(`evidence_artifacts[${index}] must be an object`);
      continue;
    }
    for (const field of ["type", "path", "summary"]) {
      if (!nonEmptyString(item[field])) {
        errors.push(`evidence_artifacts[${index}].${field} must be a non-empty string`);
      }
    }
  }
}

function validateArtifact(artifact) {
  const errors = [];

  if (artifact.schema !== 1) errors.push("schema must be 1");
  if (artifact.signal !== "BLOCKING_DISCOVERY") errors.push("signal must be BLOCKING_DISCOVERY");
  if (!WI_ID_RE.test(artifact.parent_wi || "")) {
    errors.push("parent_wi must match WI-<number>");
  }
  if (!ALLOWED_SOURCE_SKILLS.has(artifact.source_skill)) {
    errors.push(`source_skill must be one of ${Array.from(ALLOWED_SOURCE_SKILLS).join(", ")}`);
  }
  if (!nonEmptyString(artifact.discovered_during)) {
    errors.push("discovered_during must be a non-empty string");
  }
  if (!nonEmptyString(artifact.blocker_summary)) {
    errors.push("blocker_summary must be a non-empty string");
  }
  validateEvidence(artifact.evidence_artifacts, errors);

  if (!artifact.routing || typeof artifact.routing !== "object" || Array.isArray(artifact.routing)) {
    errors.push("routing must be an object");
  } else {
    if (!nonEmptyString(artifact.routing.recommended_skill)) {
      errors.push("routing.recommended_skill must be a non-empty string");
    }
    if (!nonEmptyString(artifact.routing.reason)) {
      errors.push("routing.reason must be a non-empty string");
    }
    if (artifact.routing.recommended_skill === "diagnose-bug" && artifact.routing.no_prelocked_fix !== true) {
      errors.push("diagnose-bug routing requires routing.no_prelocked_fix=true");
    }
  }

  if (
    artifact.parent_state !== "BLOCKED_ON_DISCOVERY" &&
    !new RegExp("^BLOCKED_ON_DISCOVERY: " + WI_ID_BODY + "$").test(artifact.parent_state || "")
  ) {
    errors.push("parent_state must be BLOCKED_ON_DISCOVERY or BLOCKED_ON_DISCOVERY: WI-<number>");
  }

  const hasFollowUpWi = WI_ID_RE.test(artifact.follow_up_wi || "");
  const needsWi = artifact.follow_up_status === "needs-wi";
  if (!hasFollowUpWi && !needsWi) {
    errors.push("follow_up_wi must match WI-<number> or follow_up_status must be needs-wi");
  }

  return errors;
}

const args = parseArgs(process.argv.slice(2));
const artifactPath = resolve(args.artifact);
let artifact;

try {
  artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
} catch (error) {
  fail([`cannot read JSON artifact ${artifactPath}: ${error.message}`]);
}

const errors = validateArtifact(artifact);
if (errors.length > 0) fail(errors);

console.log(JSON.stringify({
  artifact: artifactPath,
  signal: artifact.signal,
  parent_wi: artifact.parent_wi,
  source_skill: artifact.source_skill,
  status: "valid",
}, null, 2));
