#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "./lib/json-schema-validator.mjs";
import { validateGenerationBindings } from "./lib/generation-bindings-v2.mjs";

const SCHEMA_PATH = fileURLToPath(new URL("../schemas/product-proof-graph-v2.schema.json", import.meta.url));
const SCHEMA = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
const SHA256 = /^[a-f0-9]{64}$/;

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return crypto.createHash("sha256").update(typeof value === "string" ? value : stable(value)).digest("hex");
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function safeRelativePath(value) {
  if (!nonEmpty(value) || value.includes("\\") || path.posix.isAbsolute(value)) return false;
  const normalized = path.posix.normalize(value);
  return normalized !== "." && normalized !== ".." && !normalized.startsWith("../") && normalized === value;
}

function unique(values) {
  return [...new Set(values)];
}

function indexGraph(graph) {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const outgoing = new Map(graph.nodes.map((node) => [node.id, []]));
  const incoming = new Map(graph.nodes.map((node) => [node.id, []]));
  for (const edge of graph.edges) {
    outgoing.get(edge.from)?.push(edge);
    incoming.get(edge.to)?.push(edge);
  }
  return { byId, outgoing, incoming };
}

function direct(index, fromId, edgeType, nodeType) {
  return (index.outgoing.get(fromId) ?? [])
    .filter((edge) => edge.type === edgeType)
    .map((edge) => index.byId.get(edge.to))
    .filter((node) => node?.type === nodeType);
}

function resolveSource(node, repoRoot) {
  if (Object.prototype.hasOwnProperty.call(node?.source ?? {}, "value")) return digest(node.source.value);
  if (!repoRoot) return null;
  const absolute = path.resolve(repoRoot, node.source.path);
  const root = path.resolve(repoRoot);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) return null;
  try {
    const stat = fs.lstatSync(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) return null;
    return digest(fs.readFileSync(absolute));
  } catch {
    return null;
  }
}

function directAny(index, fromId, edgeType) {
  return (index.outgoing.get(fromId) ?? []).filter((edge) => edge.type === edgeType).map((edge) => index.byId.get(edge.to)).filter(Boolean);
}

function hasPath(index, fromId, toId) {
  const seen = new Set();
  const queue = [fromId];
  while (queue.length) {
    const current = queue.shift();
    if (current === toId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const edge of index.outgoing.get(current) ?? []) queue.push(edge.to);
  }
  return false;
}

export function compileProductProofGraph(graph, options = {}) {
  const errors = [...validate(SCHEMA, graph).errors];
  if (!graph || typeof graph !== "object" || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    return { valid: false, errors: unique(errors.length > 0 ? errors : ["graph must contain nodes and edges arrays"]) };
  }
  const ids = new Set();
  errors.push(...validateGenerationBindings(graph?.generation_bindings));
  if (graph?.layer_inventory_digest !== graph?.generation_bindings?.layer_inventory_digest) errors.push("layer_inventory_digest must match generation bindings");
  for (const [index, node] of graph.nodes.entries()) {
    if (!nonEmpty(node?.id)) errors.push(`nodes[${index}].id must be non-empty`);
    if (ids.has(node?.id)) errors.push(`duplicate node ${node.id}`);
    ids.add(node?.id);
    if (!safeRelativePath(node?.source?.path)) errors.push(`node ${node?.id ?? index} has unsafe source path`);
    if (!SHA256.test(node?.source?.digest ?? "")) errors.push(`node ${node?.id ?? index} source digest must be lowercase sha256`);
    const resolvedDigest = resolveSource(node, options.repoRoot);
    if (resolvedDigest === null) errors.push(`node ${node?.id ?? index} source cannot be resolved`);
    else if (resolvedDigest !== node?.source?.digest) errors.push(`node ${node?.id ?? index} source digest does not match resolved source`);
    if (node?.status === "OPEN") errors.push(`node ${node.id} is unresolved`);
  }

  const edgeIds = new Set();
  for (const [index, edge] of graph.edges.entries()) {
    if (!ids.has(edge?.from)) errors.push(`edges[${index}] missing from node ${edge?.from}`);
    if (!ids.has(edge?.to)) errors.push(`edges[${index}] missing to node ${edge?.to}`);
    if (edge?.from === edge?.to) errors.push(`edges[${index}] cannot self-reference ${edge?.from}`);
    const key = `${edge?.from}|${edge?.type}|${edge?.to}`;
    if (edgeIds.has(key)) errors.push(`duplicate edge ${key}`);
    edgeIds.add(key);
  }

  if (errors.length > 0) return { valid: false, errors: unique(errors).sort() };
  const index = indexGraph(graph);
  const directions = graph.nodes.filter((node) => node.type === "DIRECTION");
  const decisions = graph.nodes.filter((node) => node.type === "DECISION");
  const optionsNodes = graph.nodes.filter((node) => node.type === "OPTION");
  if (directions.length !== 1) errors.push(`graph must contain exactly one DIRECTION, found ${directions.length}`);
  if (decisions.length !== 1) errors.push(`graph must contain exactly one DECISION, found ${decisions.length}`);
  if (optionsNodes.length === 0) errors.push("graph must contain at least one OPTION");
  if (directions[0] && directAny(index, directions[0].id, "DIRECTS").length === 0) errors.push("direction has no directed product route");
  for (const claim of graph.nodes.filter((node) => node.type === "EVIDENCE_CLAIM")) {
    if ((index.outgoing.get(claim.id) ?? []).every((edge) => !new Set(["INFORMS", "SUPPORTED_BY", "CONSUMED_BY"]).has(edge.type))) errors.push(`evidence claim ${claim.id} has no named decision consumer`);
  }
  for (const uncertainty of graph.nodes.filter((node) => node.type === "UNCERTAINTY")) {
    if ((index.outgoing.get(uncertainty.id) ?? []).every((edge) => !new Set(["INFORMS", "RAISES", "CONSUMED_BY"]).has(edge.type))) errors.push(`uncertainty ${uncertainty.id} has no decision route`);
  }
  if (decisions[0]) {
    const selected = direct(index, decisions[0].id, "SELECTS", "OPTION");
    if (selected.length !== 1) errors.push(`decision ${decisions[0].id} must select exactly one option`);
    const rejectedIds = new Set(directAny(index, decisions[0].id, "REJECTS").map((node) => node.attributes?.option_id ?? node.id));
    for (const option of optionsNodes) if (selected[0]?.id !== option.id && !rejectedIds.has(option.id)) errors.push(`option ${option.id} is neither selected nor rejected`);
  }

  const layerNodes = graph.nodes.filter((node) => node.type === "LAYER_OBLIGATION");
  if (layerNodes.length === 0) errors.push("graph must contain canonical layer obligations");
  const layerIds = layerNodes.map((node) => node.attributes?.layer_id);
  if (layerIds.some((id) => !nonEmpty(id))) errors.push("every layer obligation requires attributes.layer_id");
  if (unique(layerIds).length !== layerIds.length) errors.push("layer obligations contain duplicate layer ids");
  for (const node of layerNodes) {
    if (node.attributes?.inventory_digest !== graph.layer_inventory_digest) errors.push(`layer obligation ${node.id} has stale inventory digest`);
    if (typeof node.attributes?.applicable !== "boolean" || !nonEmpty(node.attributes?.unique_benefit)) errors.push(`layer obligation ${node.id} lacks applicability or unique benefit`);
    if (node.attributes?.applicable === true && direct(index, node.id, "SATISFIED_BY", "TASK").length === 0) errors.push(`applicable layer obligation ${node.id} has no implementation task`);
  }
  if (options.layerInventory) {
    if (options.layerInventory.inventory_digest !== graph.layer_inventory_digest) errors.push("graph layer inventory digest does not match resolved inventory");
    const canonical = new Set((options.layerInventory.layers ?? []).map((row) => row.id));
    for (const id of canonical) if (!layerIds.includes(id)) errors.push(`graph omitted canonical layer ${id}`);
    for (const id of layerIds) if (!canonical.has(id)) errors.push(`graph declared non-canonical layer ${id}`);
  }

  const features = graph.nodes.filter((node) => node.type === "FEATURE");
  if (features.length === 0) errors.push("graph must contain at least one FEATURE");

  for (const feature of features) {
    const governors = (index.incoming.get(feature.id) ?? []).filter((edge) => new Set(["GOVERNS", "AUTHORIZES"]).has(edge.type) && new Set(["FOUNDER_DECISION", "DECISION"]).has(index.byId.get(edge.from)?.type));
    if (governors.length === 0) errors.push(`feature ${feature.id} has no authorized decision`);
    const outcomes = direct(index, feature.id, "DELIVERS", "OUTCOME");
    if (outcomes.length === 0) errors.push(`feature ${feature.id} has no product outcome`);
    if (direct(index, feature.id, "OPERATED_BY", "OPERATIONS").length === 0) errors.push(`feature ${feature.id} has no operations owner`);
    if (direct(index, feature.id, "OBLIGATES", "LAYER_OBLIGATION").length === 0) errors.push(`feature ${feature.id} has no canonical layer obligation`);
    for (const outcome of outcomes) {
      const journeys = direct(index, outcome.id, "EXPERIENCED_IN", "JOURNEY");
      if (journeys.length === 0) errors.push(`outcome ${outcome.id} has no user journey`);
      for (const journey of journeys) {
        const acceptance = direct(index, journey.id, "ACCEPTED_BY", "AC");
        if (acceptance.length === 0) errors.push(`journey ${journey.id} has no acceptance criterion`);
        if (direct(index, journey.id, "VERIFIED_BY", "RELEASE_PROBE").length === 0) errors.push(`journey ${journey.id} has no live release probe`);
        for (const criterion of acceptance) {
          const tasks = direct(index, criterion.id, "IMPLEMENTED_BY", "TASK");
          if (tasks.length === 0) errors.push(`acceptance criterion ${criterion.id} has no implementation task`);
          for (const task of tasks) {
            if (direct(index, task.id, "CHANGES", "CODE").length === 0) errors.push(`task ${task.id} has no code edge`);
            const validators = direct(index, task.id, "PROVED_BY", "VALIDATOR");
            if (validators.length === 0) errors.push(`task ${task.id} has no validator`);
            if (direct(index, task.id, "CONSTRAINED_BY", "AUTHORITY").length === 0) errors.push(`task ${task.id} has no authority constraint`);
            if (direct(index, task.id, "FAILS_AS", "FAILURE_BEHAVIOR").length === 0) errors.push(`task ${task.id} has no failure behavior`);
            if (direct(index, task.id, "REVIEWED_BY", "FINAL_REVIEW").length === 0) errors.push(`task ${task.id} has no final review consumer`);
            for (const validator of validators) {
              if (direct(index, validator.id, "EMITS", "EVIDENCE").length === 0) errors.push(`validator ${validator.id} has no evidence output`);
            }
          }
        }
      }
    }
  }

  const finalReviews = graph.nodes.filter((node) => node.type === "FINAL_REVIEW");
  const finalShas = graph.nodes.filter((node) => node.type === "FINAL_SHA");
  const releases = graph.nodes.filter((node) => node.type === "RELEASE");
  const rollbacks = graph.nodes.filter((node) => node.type === "ROLLBACK_PROOF");
  const probes = graph.nodes.filter((node) => node.type === "RELEASE_PROBE");
  const observations = graph.nodes.filter((node) => node.type === "OBSERVATION");
  const deltas = graph.nodes.filter((node) => node.type === "OBSERVED_DELTA");
  const nextDecisions = graph.nodes.filter((node) => node.type === "NEXT_DECISION");
  for (const [label, rows] of [["FINAL_REVIEW", finalReviews], ["FINAL_SHA", finalShas], ["RELEASE", releases], ["ROLLBACK_PROOF", rollbacks], ["RELEASE_PROBE", probes], ["OBSERVATION", observations], ["OBSERVED_DELTA", deltas], ["NEXT_DECISION", nextDecisions]]) {
    if (rows.length === 0) errors.push(`graph must contain ${label}`);
  }
  if (finalReviews[0] && finalShas[0] && !hasPath(index, finalReviews[0].id, finalShas[0].id)) errors.push("final review does not bind final SHA");
  if (finalShas[0] && releases[0] && !hasPath(index, finalShas[0].id, releases[0].id)) errors.push("final SHA does not reach release");
  if (releases[0]) {
    if (!rollbacks.some((node) => hasPath(index, releases[0].id, node.id))) errors.push("release has no rollback-readiness proof");
    if (!probes.some((node) => hasPath(index, releases[0].id, node.id))) errors.push("release has no live verification probe");
    if (!observations.some((node) => hasPath(index, releases[0].id, node.id))) errors.push("release has no observation schedule");
  }
  if (observations[0] && deltas[0] && !hasPath(index, observations[0].id, deltas[0].id)) errors.push("observation does not reach observed delta");
  if (deltas[0] && nextDecisions[0] && !hasPath(index, deltas[0].id, nextDecisions[0].id)) errors.push("observed delta does not reach next decision");
  for (const node of graph.nodes.filter((item) => new Set(["EVIDENCE", "FINAL_REVIEW", "FINAL_SHA", "RELEASE", "OBSERVATION", "OBSERVED_DELTA", "LEARNING"]).has(item.type))) {
    if ((index.incoming.get(node.id) ?? []).length === 0) errors.push(`produced object ${node.id} has no producer`);
    if ((index.outgoing.get(node.id) ?? []).length === 0) errors.push(`produced object ${node.id} has no consumer`);
  }

  const featureReachable = new Set();
  const queue = features.map((feature) => feature.id);
  while (queue.length > 0) {
    const current = queue.shift();
    if (featureReachable.has(current)) continue;
    featureReachable.add(current);
    for (const edge of [...(index.outgoing.get(current) ?? []), ...(index.incoming.get(current) ?? [])]) {
      const next = edge.from === current ? edge.to : edge.from;
      if (!featureReachable.has(next)) queue.push(next);
    }
  }
  for (const node of graph.nodes) {
    if (!featureReachable.has(node.id)) errors.push(`orphan product-proof node ${node.id}`);
  }

  const normalizedErrors = unique(errors).sort();
  const normalized = {
    schema_version: graph.schema_version,
    product: graph.product,
    generation_bindings: graph.generation_bindings,
    layer_inventory_digest: graph.layer_inventory_digest,
    nodes: [...graph.nodes].sort((left, right) => left.id.localeCompare(right.id)),
    edges: [...graph.edges].sort((left, right) => `${left.from}|${left.type}|${left.to}`.localeCompare(`${right.from}|${right.type}|${right.to}`))
  };
  return {
    valid: normalizedErrors.length === 0,
    errors: normalizedErrors,
    graph_digest: normalizedErrors.length === 0 ? digest(normalized) : null,
    summary: {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      features: features.length,
      journeys: graph.nodes.filter((node) => node.type === "JOURNEY").length,
      acceptance_criteria: graph.nodes.filter((node) => node.type === "AC").length,
      tasks: graph.nodes.filter((node) => node.type === "TASK").length,
      layers: layerNodes.length,
      unresolved: graph.nodes.filter((node) => node.status === "OPEN").length
    }
  };
}

export function compileTaskContext(graph, taskId, options = {}) {
  const compiled = compileProductProofGraph(graph, options);
  if (!compiled.valid) return compiled;
  const maxBytes = options.max_bytes ?? 65536;
  if (!Number.isInteger(maxBytes) || maxBytes < 1024) return { valid: false, errors: ["max_bytes must be an integer >= 1024"] };
  const index = indexGraph(graph);
  const task = index.byId.get(taskId);
  if (!task || task.type !== "TASK") return { valid: false, errors: [`unknown task ${taskId}`] };

  const ancestors = new Set([taskId]);
  const reverseQueue = [taskId];
  while (reverseQueue.length > 0) {
    const current = reverseQueue.shift();
    for (const edge of index.incoming.get(current) ?? []) {
      if (!ancestors.has(edge.from)) {
        ancestors.add(edge.from);
        reverseQueue.push(edge.from);
      }
    }
  }
  const relevantFeatures = new Set([...ancestors].filter((id) => index.byId.get(id)?.type === "FEATURE"));
  const selected = new Set(graph.nodes.filter((node) => node.context_scope === "global").map((node) => node.id));
  for (const id of ancestors) selected.add(id);
  const forwardQueue = [...relevantFeatures];
  const forwardVisited = new Set();
  while (forwardQueue.length > 0) {
    const current = forwardQueue.shift();
    if (forwardVisited.has(current)) continue;
    forwardVisited.add(current);
    selected.add(current);
    for (const edge of index.outgoing.get(current) ?? []) {
      selected.add(edge.to);
      if (!forwardVisited.has(edge.to)) forwardQueue.push(edge.to);
    }
  }

  const nodes = graph.nodes.filter((node) => selected.has(node.id)).sort((left, right) => left.id.localeCompare(right.id)).map((node) => ({
    id: node.id,
    type: node.type,
    title: node.title,
    context_scope: node.context_scope,
    source: node.source
  }));
  const edges = graph.edges.filter((edge) => selected.has(edge.from) && selected.has(edge.to))
    .sort((left, right) => `${left.from}|${left.type}|${left.to}`.localeCompare(`${right.from}|${right.type}|${right.to}`));
  const productIndex = graph.nodes.filter((node) => new Set(["FEATURE", "OUTCOME", "JOURNEY"]).has(node.type))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((node) => ({ id: node.id, type: node.type, title: node.title, source_digest: node.source.digest }));
  const context = {
    schema_version: 2,
    product: graph.product,
    graph_digest: compiled.graph_digest,
    generation_bindings: graph.generation_bindings,
    task_id: taskId,
    product_index: productIndex,
    relevant_nodes: nodes,
    relevant_edges: edges,
    source_references: unique(nodes.map((node) => `${node.source.path}:${node.source.span}@${node.source.digest}`)).sort()
  };
  const bytes = Buffer.byteLength(stable(context));
  if (bytes > maxBytes) return { valid: false, errors: [`compiled task context ${bytes} bytes exceeds ${maxBytes}`], required_bytes: bytes };
  return {
    valid: true,
    errors: [],
    context,
    context_digest: digest(context),
    bytes,
    summary: {
      total_product_index_nodes: productIndex.length,
      relevant_nodes: nodes.length,
      relevant_edges: edges.length,
      excluded_nodes: graph.nodes.length - nodes.length
    }
  };
}

function parseArgs(argv) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) result._.push(token);
    else if (argv[index + 1] && !argv[index + 1].startsWith("--")) result[token.slice(2)] = argv[++index];
    else result[token.slice(2)] = true;
  }
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const command = args._[0];
    if (!args.graph || !new Set(["compile", "context"]).has(command)) throw new Error("usage: svc-product-proof-compiler-v2.mjs compile|context --graph <json> [--task <id>] [--max-bytes <n>]");
    const graph = JSON.parse(fs.readFileSync(args.graph, "utf8"));
    const layerInventory = args["layer-inventory"] ? JSON.parse(fs.readFileSync(args["layer-inventory"], "utf8")) : undefined;
    const options = { max_bytes: args["max-bytes"] ? Number(args["max-bytes"]) : 65536, repoRoot: args["repo-root"] ?? process.cwd(), layerInventory };
    const result = command === "compile" ? compileProductProofGraph(graph, options) : compileTaskContext(graph, args.task, options);
    (result.valid ? process.stdout : process.stderr).write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.valid ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ valid: false, errors: [error.message] })}\n`);
    process.exitCode = 2;
  }
}
