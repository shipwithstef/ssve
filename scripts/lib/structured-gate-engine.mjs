#!/usr/bin/env node
/**
 * Structured Domain Knowledge Gate (SDKG) engine.
 *
 * Reads schema-conforming structured data + a current artifact (e.g., feature
 * spec markdown), branches on a configured field (e.g., `landscape_state`),
 * returns a verdict the calling skill can enforce.
 *
 * GENERIC: this engine is the SDKG primitive layer — same code serves
 * competitive cross-reference today, security-without-best-practice tomorrow,
 * accessibility-without-WCAG-check next week. Per-instance behavior is in
 * gateConfig (e.g., scripts/gates/competitive.mjs).
 *
 * Usage:
 *   import { evaluateGate } from "./structured-gate-engine.mjs";
 *   const result = evaluateGate({
 *     schemaPath: "references/schemas/competitor-analysis.schema.json",
 *     dataPath: "docs/specs/analyze-competitors.data.json",
 *     gateConfig: await import("./scripts/gates/competitive.mjs"),
 *     currentArtifact: fs.readFileSync("docs/specs/features/X.md", "utf8"),
 *   });
 *   // result: { verdict, branchTaken, missingFields, citations, reason }
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { appendJsonlLine } from "../state-io.mjs";
import { validate } from "./json-schema-validator.mjs";

const KB_FRAGMENT_CAP = 2000;

function resolveRepoRoot(provided) {
  if (provided) return provided;
  try {
    return execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
  } catch {
    return process.cwd();
  }
}

function isContained(child, parent) {
  const resolvedChild = path.resolve(child);
  const resolvedParent = path.resolve(parent);
  return resolvedChild === resolvedParent ||
    resolvedChild.startsWith(resolvedParent + path.sep);
}

export const VERDICTS = { PASS: "pass", WARN: "warn", BLOCK: "block", SKIP: "skip", HALT: "halt" };

export function evaluateGate({ schemaPath, dataPath, gateConfig, currentArtifact, env = process.env }) {
  // 1. Override escape hatch (per spec feature toggles)
  const overrideKey = gateConfig.overrideEnvKey || `SVC_GATE_OVERRIDE_${gateConfig.id?.toUpperCase()}`;
  if (env[overrideKey]) {
    return {
      verdict: VERDICTS.SKIP,
      branchTaken: "env-override",
      reason: `${overrideKey}=${env[overrideKey]} forced skip`,
      missingFields: [],
      citations: [],
    };
  }

  // 2. Data freshness/existence check (GATE-FAIL-01: HALT vs treat-as-empty)
  if (!fs.existsSync(dataPath)) {
    return {
      verdict: VERDICTS.HALT,
      branchTaken: "data-missing",
      reason: `Required structured data missing at ${dataPath}. Per BLOCKING-DISCOVERY-HALT protocol, gate refuses to silently pass. Run producer skill first.`,
      missingFields: [],
      citations: [],
    };
  }

  let data, schema;
  try {
    schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  } catch (e) {
    return { verdict: VERDICTS.HALT, branchTaken: "parse-error", reason: e.message, missingFields: [], citations: [] };
  }

  // 3. Schema conformance check
  const v = validate(schema, data);
  if (!v.valid) {
    return {
      verdict: VERDICTS.HALT,
      branchTaken: "schema-violation",
      reason: `Data does not conform to schema: ${v.errors.slice(0, 3).join("; ")}`,
      missingFields: v.errors,
      citations: [],
    };
  }

  // 4. Branch on configured field (e.g., landscape_state)
  const branchField = gateConfig.branchField;
  const branchValue = data[branchField];
  const branchHandler = gateConfig.branches?.[branchValue];
  if (!branchHandler) {
    return {
      verdict: VERDICTS.HALT,
      branchTaken: `unknown-branch:${branchValue}`,
      reason: `gateConfig has no handler for ${branchField}=${branchValue}`,
      missingFields: [],
      citations: [],
    };
  }

  // 5. Delegate to per-branch handler — handler returns {verdict, missingFields, citations, reason}
  const branchResult = branchHandler({ data, currentArtifact, gateConfig });
  return { ...branchResult, branchTaken: branchValue };
}

/**
 * Read per-competitor knowledge-base directories for structured grounding data.
 *
 * WI-142: knowledge-first gate architecture. This function NEVER makes network
 * calls. It reads only from `references/knowledge/competitors/<slug>/`.
 *
 * Scope: this function reads knowledge files. It does NOT report project-wide
 * landscape state — that field belongs to `docs/specs/analyze-competitors.data.json`
 * and is consumed directly by gates branching on it (per the WI-140
 * `branch-on-state-field` learning). WI-145 dropped a misleading caller-shaped
 * `landscape_state` return value to prevent gates from branching on the wrong
 * field. Read `analyze-competitors.data.json` separately when the canonical
 * state is needed.
 *
 * @param {string[]} slugs  Competitor directory names to read
 * @param {string} topic    Optional topic file name (e.g. "earn-mechanism")
 * @param {object} options  { repoRoot?: string }
 * @returns {{
 *   competitors: Array<{
 *     slug: string,
 *     capabilities: string,
 *     capabilities_truncated: boolean,
 *     topic?: string,
 *     topic_truncated?: boolean,
 *   }>,
 *   sources: string[],
 *   knowledge_gap: { detected: boolean, missing: string[] }
 * }}
 */
export function readKnowledgeBase(slugs, topic, options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const logGaps = options.logGaps !== false;
  const kbBase = path.join(repoRoot, "references", "knowledge", "competitors");
  const competitors = [];
  const sources = [];
  const missing = [];

  // Reject any topic that would escape the per-slug directory. The slug
  // containment check below catches per-slug escapes; this guards the
  // string concatenation `${topic}.md` separately.
  const topicSafe = topic && !topic.includes("/") && !topic.includes("\\") &&
    !topic.includes("..") && topic.trim() !== "";

  for (const slug of slugs) {
    const dir = path.join(kbBase, slug);
    if (!isContained(dir, kbBase)) {
      missing.push(`directory:${slug}`);
      continue;
    }
    if (!fs.existsSync(dir)) {
      missing.push(`directory:${slug}`);
      continue;
    }

    const capabilitiesPath = path.join(dir, "CAPABILITIES.md");
    const topicPath = topic && topicSafe ? path.join(dir, `${topic}.md`) : null;

    let capabilities = "";
    let capabilitiesTruncated = false;
    let topicContent = null;
    let topicTruncated = false;

    if (isContained(capabilitiesPath, dir) && fs.existsSync(capabilitiesPath)) {
      const raw = fs.readFileSync(capabilitiesPath, "utf8");
      capabilitiesTruncated = raw.length > KB_FRAGMENT_CAP;
      capabilities = raw.slice(0, KB_FRAGMENT_CAP);
      sources.push(capabilitiesPath);
    } else {
      missing.push(`CAPABILITIES.md:${slug}`);
    }

    if (topic && !topicSafe) {
      missing.push(`topic:${slug}:${topic}:invalid-name`);
    } else if (topicPath) {
      if (isContained(topicPath, dir) && fs.existsSync(topicPath)) {
        const raw = fs.readFileSync(topicPath, "utf8");
        topicTruncated = raw.length > KB_FRAGMENT_CAP;
        topicContent = raw.slice(0, KB_FRAGMENT_CAP);
        sources.push(topicPath);
      } else {
        missing.push(`topic:${slug}:${topic}`);
      }
    }

    competitors.push({
      slug,
      capabilities,
      capabilities_truncated: capabilitiesTruncated,
      topic: topicContent ?? undefined,
      topic_truncated: topicContent ? topicTruncated : undefined,
    });
  }

  const knowledge_gap = { detected: missing.length > 0, missing };

  if (knowledge_gap.detected && logGaps) {
    const gapEntry = {
      ts: new Date().toISOString(),
      type: "knowledge-gap",
      competitors: slugs,
      topic: topic || null,
      missing,
      queued_wi: null,
    };
    try {
      const gapsPath = path.join(repoRoot, ".svc", "framework-gaps.jsonl");
      appendJsonlLine(gapsPath, gapEntry);
    } catch {
      // fail-open: gap logging is best-effort
    }
  }

  return { competitors, sources, knowledge_gap };
}

// CLI entry: evaluate against a fixture pair, print result, exit on verdict
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }));
  if (!args.schema || !args.data || !args.config) {
    console.error("Usage: node structured-gate-engine.mjs --schema=X --data=Y --config=Z [--artifact=A]");
    process.exit(2);
  }
  const config = await import(new URL(args.config, `file://${process.cwd()}/`).href);
  const artifact = args.artifact ? fs.readFileSync(args.artifact, "utf8") : "";
  const result = evaluateGate({
    schemaPath: args.schema,
    dataPath: args.data,
    gateConfig: config.default ?? config,
    currentArtifact: artifact,
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.verdict === VERDICTS.BLOCK || result.verdict === VERDICTS.HALT ? 1 : 0);
}
