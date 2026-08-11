#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "./lib/json-schema-validator.mjs";
import { sameGenerationBindings, validateGenerationBindings } from "./lib/generation-bindings-v2.mjs";

const SCHEMA_PATH = fileURLToPath(new URL("../schemas/execution-task-capsule-v2.schema.json", import.meta.url));
const CAPSULE_SCHEMA = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
const EVENT_SCHEMA_PATH = fileURLToPath(new URL("../schemas/execution-event-v2.schema.json", import.meta.url));
const EVENT_SCHEMA = JSON.parse(fs.readFileSync(EVENT_SCHEMA_PATH, "utf8"));
const EVIDENCE_SCHEMA_PATH = fileURLToPath(new URL("../schemas/evidence-object-v2.schema.json", import.meta.url));
const EVIDENCE_SCHEMA = JSON.parse(fs.readFileSync(EVIDENCE_SCHEMA_PATH, "utf8"));
const ACTIONS = new Set(["CREATE", "MODIFY", "DELETE"]);
const RESOLVED = new Set(["RESOLVED", "NOT_APPLICABLE"]);
const ENVIRONMENT_CLASSES = new Set(["hermetic", "repository", "host", "external"]);
const COST_CLASSES = new Set(["micro", "focused", "full", "external"]);
const FAILURE_CATEGORIES = new Set([
  "PRODUCT_CONTRACT",
  "SECURITY_AUTHORITY",
  "ASSERTION_SEMANTICS",
  "HARNESS_TRANSPORT",
  "FIXTURE",
  "ENVIRONMENT",
  "ORCHESTRATOR_INVOCATION"
]);
const PLAN_FREEZE_CATEGORIES = new Set(["PRODUCT_CONTRACT", "SECURITY_AUTHORITY"]);
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SHA256 = /^[a-f0-9]{64}$/;
const GIT_OBJECT_ID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const EFFECT_KINDS = new Set([
  "filesystem_read",
  "filesystem_write",
  "git_checkpoint",
  "network_read",
  "provider_write",
  "paid_write",
  "device",
  "deploy"
]);
const ROOT_ONLY_KINDS = new Set(["paid_write", "device", "deploy"]);
const EVENT_TYPES = new Set(EVENT_SCHEMA.properties.type.enum);
const TERMINAL_STATES = new Set(["ACCEPTED", "CANCELLED", "IMPLEMENTATION_TERMINAL"]);
const GLOB_CACHE = new Map();
const MAX_GLOB_CACHE_ENTRIES = 4096;
const TRUST_LEVELS = new Set(["static", "hermetic", "sandbox", "device", "staging", "production"]);
const RESOURCE_KEY = /^[A-Za-z0-9][A-Za-z0-9._:/*-]{0,255}$/;

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  const input = typeof value === "string" ? value : stable(value);
  return crypto.createHash("sha256").update(input).digest("hex");
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function canonicalIsoTimestamp(value) {
  if (!nonEmptyString(value) || !ISO_TIMESTAMP.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function safeRelativePath(value) {
  if (!nonEmptyString(value) || value.includes("\\") || path.posix.isAbsolute(value)) return false;
  const normalized = path.posix.normalize(value);
  return normalized !== "." && normalized !== ".." && !normalized.startsWith("../") && normalized === value;
}

function safeConcretePath(value) {
  return safeRelativePath(value) && !value.includes("*") && !value.includes("?") && !value.includes("[");
}

function safePattern(value) {
  return nonEmptyString(value) && value.length <= 2048 && !/[\0\r\n]/.test(value);
}

function globRegex(pattern) {
  const cached = GLOB_CACHE.get(pattern);
  if (cached) return cached;
  let source = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === "*" && pattern[index + 1] === "*") {
      source += ".*";
      index += 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else {
      source += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  const compiled = new RegExp(`^${source}$`);
  if (GLOB_CACHE.size >= MAX_GLOB_CACHE_ENTRIES) GLOB_CACHE.clear();
  GLOB_CACHE.set(pattern, compiled);
  return compiled;
}

function matches(pattern, candidate) {
  return globRegex(pattern).test(candidate);
}

function unique(values) {
  return [...new Set(values)];
}

function validateIdentityRows(rows, label, errors) {
  if (!Array.isArray(rows) || rows.length === 0) {
    errors.push(`${label} must contain at least one explicit row`);
    return;
  }
  const ids = new Set();
  for (const [index, row] of rows.entries()) {
    if (!row || typeof row !== "object") {
      errors.push(`${label}[${index}] must be an object`);
      continue;
    }
    if (!nonEmptyString(row.id)) errors.push(`${label}[${index}].id must be non-empty`);
    if (ids.has(row.id)) errors.push(`${label} contains duplicate id ${row.id}`);
    ids.add(row.id);
    if (!RESOLVED.has(row.status)) errors.push(`${label}[${index}] is unresolved: ${row.status ?? "missing"}`);
    if (!SHA256.test(row.source_digest ?? "")) errors.push(`${label}[${index}].source_digest must be lowercase sha256`);
  }
}

function validateCollectionContracts(capsule, errors) {
  const collections = capsule.collections ?? {};
  if (typeof collections !== "object" || Array.isArray(collections) || collections === null) {
    errors.push("collections must be an object");
    return;
  }

  for (const contract of capsule.collection_contracts ?? []) {
    const rows = collections[contract.collection];
    if (!Array.isArray(rows)) {
      errors.push(`collection contract references missing array ${contract.collection}`);
      continue;
    }
    if (rows.length !== contract.exact_count) {
      errors.push(`${contract.collection} count ${rows.length} != ${contract.exact_count}`);
    }
    const identities = new Set();
    for (const [index, row] of rows.entries()) {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        errors.push(`${contract.collection}[${index}] must be an object`);
        continue;
      }
      if (contract.exact_fields) {
        const actual = Object.keys(row);
        if (stable(actual) !== stable(contract.exact_fields)) {
          errors.push(`${contract.collection}[${index}] fields ${stable(actual)} != ${stable(contract.exact_fields)}`);
        }
      }
      if (contract.unique_by?.length) {
        const key = stable(contract.unique_by.map((field) => row[field]));
        if (identities.has(key)) errors.push(`${contract.collection}[${index}] duplicates unique key ${key}`);
        identities.add(key);
      }
      for (const [field, format] of Object.entries(contract.formats ?? {})) {
        const value = row[field];
        if (format === "iso_timestamp" && !canonicalIsoTimestamp(value)) {
          errors.push(`${contract.collection}[${index}].${field} is not canonical ISO timestamp`);
        } else if (format === "sha256" && (!nonEmptyString(value) || !SHA256.test(value))) {
          errors.push(`${contract.collection}[${index}].${field} is not lowercase sha256`);
        }
      }
    }
  }

  for (const relationship of capsule.relationships ?? []) {
    if (!Array.isArray(relationship.sum) || relationship.sum.length === 0) {
      errors.push(`relationship ${relationship.id ?? "missing"} must sum at least one collection`);
      continue;
    }
    let total = 0;
    let missing = false;
    for (const name of relationship.sum) {
      if (!Array.isArray(collections[name])) {
        errors.push(`relationship ${relationship.id} references missing array ${name}`);
        missing = true;
      } else {
        total += collections[name].length;
      }
    }
    if (!missing && total !== relationship.equals) {
      errors.push(`relationship ${relationship.id} sum ${total} != ${relationship.equals}`);
    }
  }
}

function validateValidations(validations, errors) {
  if (!Array.isArray(validations) || validations.length === 0) {
    errors.push("validations must contain at least one validator");
    return;
  }
  const ids = new Set();
  for (const [index, item] of validations.entries()) {
    if (!nonEmptyString(item?.id)) errors.push(`validations[${index}].id must be non-empty`);
    if (ids.has(item?.id)) errors.push(`validations contains duplicate id ${item.id}`);
    ids.add(item?.id);
    if (!Array.isArray(item?.argv) || item.argv.length === 0 || item.argv.some((part) => !nonEmptyString(part))) {
      errors.push(`validations[${index}].argv must be a non-empty string array`);
    }
    if (!Array.isArray(item?.inputs) || item.inputs.length === 0) {
      errors.push(`validations[${index}].inputs must be non-empty`);
    } else {
      for (const input of item.inputs) {
        const withoutGlob = input.replace(/\*+.*$/, "placeholder");
        if (!safeRelativePath(withoutGlob)) errors.push(`validations[${index}] unsafe input ${input}`);
      }
    }
    if (!SHA256.test(item?.validator_digest ?? "")) errors.push(`validations[${index}].validator_digest must be lowercase sha256`);
    if (!ENVIRONMENT_CLASSES.has(item?.environment_class)) errors.push(`validations[${index}] bad environment_class`);
    if (!COST_CLASSES.has(item?.cost_class)) errors.push(`validations[${index}] bad cost_class`);
    if (typeof item?.required_at_freeze !== "boolean") errors.push(`validations[${index}].required_at_freeze must be boolean`);
  }
}

function validateEffectCapabilities(capabilities, errors) {
  if (!Array.isArray(capabilities) || capabilities.length === 0) {
    errors.push("effect_capabilities must contain at least one capability");
    return;
  }
  const ids = new Set();
  for (const [index, capability] of capabilities.entries()) {
    const label = `effect_capabilities[${index}]`;
    if (!nonEmptyString(capability?.id)) errors.push(`${label}.id must be non-empty`);
    if (ids.has(capability?.id)) errors.push(`effect_capabilities contains duplicate id ${capability.id}`);
    ids.add(capability?.id);
    if (!new Set(["executor", "root"]).has(capability?.principal)) errors.push(`${label}.principal is invalid`);
    if (!EFFECT_KINDS.has(capability?.kind)) errors.push(`${label}.kind is invalid`);
    if (!Array.isArray(capability?.targets) || capability.targets.length === 0) {
      errors.push(`${label}.targets must be non-empty`);
    } else if (capability.targets.some((target) => !safePattern(target))) {
      errors.push(`${label}.targets contains an unsafe pattern`);
    }
    if (typeof capability?.max_cost_usd !== "number" || capability.max_cost_usd < 0 || !Number.isFinite(capability.max_cost_usd)) {
      errors.push(`${label}.max_cost_usd must be a non-negative finite number`);
    }
    for (const field of ["root_only", "requires_idempotency", "reversible"]) {
      if (typeof capability?.[field] !== "boolean") errors.push(`${label}.${field} must be boolean`);
    }
    if (ROOT_ONLY_KINDS.has(capability?.kind) && (capability?.root_only !== true || capability?.principal !== "root")) {
      errors.push(`${label} ${capability?.kind} must be root-only with root principal`);
    }
    if (new Set(["provider_write", "paid_write", "deploy"]).has(capability?.kind) && capability?.requires_idempotency !== true) {
      errors.push(`${label} ${capability?.kind} must require idempotency`);
    }
  }
}

function validateSchedulingContract(capsule, errors) {
  const claims = capsule?.resource_claims;
  if (!Array.isArray(claims) || claims.length === 0) {
    errors.push("resource_claims must contain at least one claim");
  } else {
    const keys = new Set();
    for (const [index, claim] of claims.entries()) {
      const label = `resource_claims[${index}]`;
      if (!RESOURCE_KEY.test(claim?.key ?? "")) errors.push(`${label}.key is invalid`);
      if (keys.has(claim?.key)) errors.push(`resource_claims contains duplicate key ${claim.key}`);
      keys.add(claim?.key);
      if (!new Set(["shared", "exclusive"]).has(claim?.mode)) errors.push(`${label}.mode is invalid`);
    }
  }

  const policy = capsule?.parallel_policy;
  if (!policy || typeof policy !== "object") {
    errors.push("parallel_policy must be an object");
  } else {
    if (typeof policy.eligible !== "boolean") errors.push("parallel_policy.eligible must be boolean");
    if (!nonEmptyString(policy.merge_order_key)) errors.push("parallel_policy.merge_order_key must be non-empty");
    if (policy.eligible === false && !nonEmptyString(policy.serialization_reason)) {
      errors.push("parallel_policy.serialization_reason is required when parallel execution is disabled");
    }
  }

  const claimKeys = new Set((claims ?? []).map((claim) => claim?.key));
  for (const capability of capsule?.effect_capabilities ?? []) {
    if (!new Set(["provider_write", "paid_write", "device", "deploy"]).has(capability?.kind)) continue;
    for (const target of capability.targets ?? []) {
      const key = `effect:${capability.kind}:${target}`;
      const claim = (claims ?? []).find((candidate) => candidate.key === key);
      if (!claimKeys.has(key) || claim?.mode !== "exclusive") {
        errors.push(`external effect ${capability.kind}:${target} requires exclusive resource claim ${key}`);
      }
    }
  }
}

function validateInterfaces(capsule, errors) {
  if (!Array.isArray(capsule?.merge_dependencies) || capsule.merge_dependencies.some((dependency) => !nonEmptyString(dependency))) {
    errors.push("merge_dependencies must be a string array");
  } else {
    if (unique(capsule.merge_dependencies).length !== capsule.merge_dependencies.length) errors.push("merge_dependencies contains duplicates");
    if (capsule.merge_dependencies.includes(capsule.task_id)) errors.push("task cannot merge-depend on itself");
    for (const dependency of capsule.dependencies ?? []) {
      if (!capsule.merge_dependencies.includes(dependency)) errors.push(`execution dependency ${dependency} must also be a merge dependency`);
    }
  }
  const interfaces = capsule?.interfaces;
  if (!interfaces || typeof interfaces !== "object" || !Array.isArray(interfaces.provides) || !Array.isArray(interfaces.consumes)) {
    errors.push("interfaces must contain provides and consumes arrays");
    return;
  }
  for (const kind of ["provides", "consumes"]) {
    const ids = new Set();
    for (const [index, contract] of interfaces[kind].entries()) {
      if (!nonEmptyString(contract?.id)) errors.push(`interfaces.${kind}[${index}].id must be non-empty`);
      if (ids.has(contract?.id)) errors.push(`interfaces.${kind} contains duplicate id ${contract.id}`);
      ids.add(contract?.id);
      if (!SHA256.test(contract?.digest ?? "")) errors.push(`interfaces.${kind}[${index}].digest must be lowercase sha256`);
      if (kind === "consumes" && contract?.producer_task_id === capsule.task_id) errors.push(`task cannot consume its own interface ${contract.id}`);
    }
  }
}

export function compileCapsule(capsule) {
  const errors = [];
  const structural = validate(CAPSULE_SCHEMA, capsule);
  errors.push(...structural.errors);

  if (capsule?.schema_version !== 2) errors.push("schema_version must equal 2");
  for (const field of ["wi", "task_id", "product_outcome", "plan_digest", "accepted_parent_sha"]) {
    if (!nonEmptyString(capsule?.[field])) errors.push(`${field} must be non-empty`);
  }
  if (!SHA256.test(capsule?.plan_digest ?? "")) errors.push("plan_digest must be lowercase sha256");
  if (!GIT_OBJECT_ID.test(capsule?.accepted_parent_sha ?? "")) errors.push("accepted_parent_sha must be a Git object id");
  if (!Number.isInteger(capsule?.revision) || capsule.revision < 1) errors.push("revision must be a positive integer");
  errors.push(...validateGenerationBindings(capsule?.generation_bindings));
  if (!Array.isArray(capsule?.dependencies) || capsule.dependencies.some((dependency) => !nonEmptyString(dependency))) {
    errors.push("dependencies must be a string array");
  } else {
    if (unique(capsule.dependencies).length !== capsule.dependencies.length) errors.push("dependencies contains duplicates");
    if (capsule.dependencies.includes(capsule.task_id)) errors.push("task cannot depend on itself");
  }

  const allowedPaths = [];
  if (!Array.isArray(capsule?.allowed_files) || capsule.allowed_files.length === 0) {
    errors.push("allowed_files must contain at least one file");
  } else {
    for (const [index, file] of capsule.allowed_files.entries()) {
      if (!safeConcretePath(file?.path)) errors.push(`allowed_files[${index}] has unsafe or non-concrete path ${file?.path}`);
      if (!ACTIONS.has(file?.action)) errors.push(`allowed_files[${index}] has invalid action ${file?.action}`);
      allowedPaths.push(file?.path);
    }
    if (unique(allowedPaths).length !== allowedPaths.length) errors.push("allowed_files contains duplicate paths");
  }

  if (!Array.isArray(capsule?.forbidden_writes)) {
    errors.push("forbidden_writes must be an array");
  } else {
    for (const [index, pattern] of capsule.forbidden_writes.entries()) {
      const withoutGlob = pattern.replace(/\*+.*$/, "placeholder");
      if (!safeRelativePath(withoutGlob)) errors.push(`forbidden_writes[${index}] has unsafe pattern ${pattern}`);
      for (const allowed of allowedPaths) {
        if (matches(pattern, allowed) || matches(allowed, pattern)) {
          errors.push(`allowed file ${allowed} overlaps forbidden write ${pattern}`);
        }
      }
    }
  }

  validateIdentityRows(capsule?.decisions, "decisions", errors);
  validateIdentityRows(capsule?.authorities, "authorities", errors);
  validateCollectionContracts(capsule ?? {}, errors);
  validateValidations(capsule?.validations, errors);
  validateEffectCapabilities(capsule?.effect_capabilities, errors);
  validateSchedulingContract(capsule, errors);
  validateInterfaces(capsule, errors);
  if (!Number.isInteger(capsule?.active_budget_seconds) || capsule.active_budget_seconds < 1) {
    errors.push("active_budget_seconds must be a positive integer");
  }

  const policy = capsule?.failure_policy;
  if (!policy || typeof policy !== "object") {
    errors.push("failure_policy must be an object");
  } else {
    if (policy.local_attempts !== 2) errors.push("failure_policy.local_attempts must equal 2");
    if (policy.assist_attempts !== 1) errors.push("failure_policy.assist_attempts must equal 1");
    const categories = policy.plan_freeze_categories ?? [];
    if (stable([...categories].sort()) !== stable([...PLAN_FREEZE_CATEGORIES].sort())) {
      errors.push("failure_policy.plan_freeze_categories must be PRODUCT_CONTRACT and SECURITY_AUTHORITY only");
    }
  }

  const normalizedErrors = unique(errors).sort();
  return {
    valid: normalizedErrors.length === 0,
    errors: normalizedErrors,
    capsule_digest: normalizedErrors.length === 0 ? digest(capsule) : null,
    task: normalizedErrors.length === 0 ? `${capsule.wi}/${capsule.task_id}.r${capsule.revision}` : null,
    allowed_path_count: allowedPaths.length,
    validation_count: Array.isArray(capsule?.validations) ? capsule.validations.length : 0
  };
}

export function compileExecutionGraph(capsules) {
  if (!Array.isArray(capsules) || capsules.length === 0) {
    return { valid: false, errors: ["capsules must contain at least one task"] };
  }
  const errors = [];
  const byId = new Map();
  for (const [index, capsule] of capsules.entries()) {
    const compiled = compileCapsule(capsule);
    errors.push(...compiled.errors.map((error) => `capsules[${index}] ${error}`));
    if (byId.has(capsule?.task_id)) errors.push(`duplicate task_id ${capsule?.task_id}`);
    else byId.set(capsule?.task_id, capsule);
  }
  const wis = unique(capsules.map((capsule) => capsule?.wi));
  const planDigests = unique(capsules.map((capsule) => capsule?.plan_digest));
  const generationDigests = unique(capsules.map((capsule) => digest(capsule?.generation_bindings)));
  const mergeOrderKeys = capsules.map((capsule) => capsule?.parallel_policy?.merge_order_key);
  if (wis.length !== 1) errors.push("all capsules must belong to one WI");
  if (planDigests.length !== 1) errors.push("all capsules must share one plan_digest");
  if (generationDigests.length !== 1) errors.push("all capsules must share one generation_bindings object");
  if (unique(mergeOrderKeys).length !== mergeOrderKeys.length) errors.push("parallel_policy.merge_order_key must be unique across the graph");
  for (const capsule of capsules) {
    for (const field of ["dependencies", "merge_dependencies"]) {
      for (const dependency of capsule?.[field] ?? []) {
        if (!byId.has(dependency)) errors.push(`task ${capsule.task_id} references missing ${field === "dependencies" ? "dependency" : "merge dependency"} ${dependency}`);
      }
    }
    for (const consumed of capsule?.interfaces?.consumes ?? []) {
      if (!consumed.producer_task_id) continue;
      const producer = byId.get(consumed.producer_task_id);
      if (!producer) {
        errors.push(`task ${capsule.task_id} consumes ${consumed.id} from missing producer ${consumed.producer_task_id}`);
        continue;
      }
      if (!(capsule.merge_dependencies ?? []).includes(consumed.producer_task_id)) {
        errors.push(`task ${capsule.task_id} interface producer ${consumed.producer_task_id} must be a merge dependency`);
      }
      const provided = (producer.interfaces?.provides ?? []).find((candidate) => candidate.id === consumed.id);
      if (!provided) errors.push(`producer ${producer.task_id} does not provide interface ${consumed.id}`);
      else if (provided.digest !== consumed.digest) errors.push(`interface ${consumed.id} digest mismatch between ${producer.task_id} and ${capsule.task_id}`);
    }
  }

  function topologicalOrder(field, label) {
    const visiting = new Set();
    const visited = new Set();
    const order = [];
    function visit(taskId, trail = []) {
      if (visiting.has(taskId)) {
        errors.push(`${label} cycle ${[...trail, taskId].join(" -> ")}`);
        return;
      }
      if (visited.has(taskId) || !byId.has(taskId)) return;
      visiting.add(taskId);
      for (const dependency of byId.get(taskId)[field] ?? []) visit(dependency, [...trail, taskId]);
      visiting.delete(taskId);
      visited.add(taskId);
      order.push(taskId);
    }
    for (const taskId of [...byId.keys()].sort()) visit(taskId);
    return order;
  }
  const order = topologicalOrder("dependencies", "dependency");
  const mergeOrder = topologicalOrder("merge_dependencies", "merge dependency");

  const normalizedErrors = unique(errors).sort();
  return {
    valid: normalizedErrors.length === 0,
    errors: normalizedErrors,
    wi: normalizedErrors.length === 0 ? wis[0] : null,
    plan_digest: normalizedErrors.length === 0 ? planDigests[0] : null,
    task_order: normalizedErrors.length === 0 ? order : [],
    merge_task_order: normalizedErrors.length === 0 ? mergeOrder : [],
    graph_digest: normalizedErrors.length === 0 ? digest(order.map((taskId) => ({
      task_id: taskId,
      capsule_digest: compileCapsule(byId.get(taskId)).capsule_digest,
      dependencies: byId.get(taskId).dependencies,
      merge_dependencies: byId.get(taskId).merge_dependencies,
      merge_order_index: mergeOrder.indexOf(taskId)
    }))) : null
  };
}

function schedulingConflict(left, right) {
  const leftFiles = new Set((left.allowed_files ?? []).map((file) => file.path));
  const sharedFiles = (right.allowed_files ?? []).map((file) => file.path).filter((file) => leftFiles.has(file));
  if (sharedFiles.length > 0) return `write:${sharedFiles.sort()[0]}`;

  const leftClaims = new Map((left.resource_claims ?? []).map((claim) => [claim.key, claim.mode]));
  for (const claim of right.resource_claims ?? []) {
    const leftMode = leftClaims.get(claim.key);
    if (leftMode && (leftMode === "exclusive" || claim.mode === "exclusive")) return `resource:${claim.key}`;
  }
  return null;
}

function criticalPathBudgets(capsules, completed = new Set()) {
  const byId = new Map(capsules.map((capsule) => [capsule.task_id, capsule]));
  const children = new Map(capsules.map((capsule) => [capsule.task_id, []]));
  for (const capsule of capsules) {
    for (const dependency of capsule.dependencies ?? []) children.get(dependency)?.push(capsule.task_id);
  }
  const memo = new Map();
  function visit(taskId) {
    if (memo.has(taskId)) return memo.get(taskId);
    if (completed.has(taskId)) {
      memo.set(taskId, 0);
      return 0;
    }
    const downstream = (children.get(taskId) ?? []).filter((child) => !completed.has(child)).map(visit);
    const value = byId.get(taskId).active_budget_seconds + (downstream.length > 0 ? Math.max(...downstream) : 0);
    memo.set(taskId, value);
    return value;
  }
  for (const capsule of capsules) visit(capsule.task_id);
  return memo;
}

function scheduleCandidates(candidates, occupied, critical, maxParallel) {
  const selected = [];
  const deferred = [];
  const ordered = [...candidates].sort((left, right) =>
    (critical.get(right.task_id) - critical.get(left.task_id)) ||
    left.parallel_policy.merge_order_key.localeCompare(right.parallel_policy.merge_order_key) ||
    left.task_id.localeCompare(right.task_id));

  for (const candidate of ordered) {
    if (occupied.length + selected.length >= maxParallel) {
      deferred.push({ task_id: candidate.task_id, reason: "parallel-capacity" });
      continue;
    }
    if (candidate.parallel_policy.eligible === false && occupied.length + selected.length > 0) {
      deferred.push({ task_id: candidate.task_id, reason: `serial:${candidate.parallel_policy.serialization_reason}` });
      continue;
    }
    const serialPeer = [...occupied, ...selected].find((task) => task.parallel_policy.eligible === false);
    if (serialPeer) {
      deferred.push({ task_id: candidate.task_id, reason: `serial-peer:${serialPeer.task_id}` });
      continue;
    }
    const conflict = [...occupied, ...selected]
      .map((task) => ({ task, reason: schedulingConflict(candidate, task) }))
      .find((entry) => entry.reason);
    if (conflict) {
      deferred.push({ task_id: candidate.task_id, reason: `${conflict.reason};with:${conflict.task.task_id}` });
      continue;
    }
    selected.push(candidate);
  }
  return { selected, deferred };
}

export function scheduleExecutionWave(capsules, eventsByTask = {}, options = {}) {
  const status = projectExecutionStatus(capsules, eventsByTask);
  if (!status.valid) return status;
  const graph = compileExecutionGraph(capsules);
  const maxParallel = options.max_parallel ?? 4;
  const globalBudget = options.global_active_budget_seconds ?? 3600;
  const errors = [];
  if (!Number.isInteger(maxParallel) || maxParallel < 1) errors.push("max_parallel must be a positive integer");
  if (!Number.isInteger(globalBudget) || globalBudget < 1) errors.push("global_active_budget_seconds must be a positive integer");
  if (errors.length > 0) return { valid: false, errors };

  const byId = new Map(capsules.map((capsule) => [capsule.task_id, capsule]));
  const completed = new Set(status.completed_task_ids);
  const critical = criticalPathBudgets(capsules, completed);
  const occupied = status.active_task_ids.map((taskId) => byId.get(taskId));
  const ready = status.ready_task_ids.map((taskId) => byId.get(taskId));
  const { selected, deferred } = scheduleCandidates(ready, occupied, critical, maxParallel);
  const remaining = status.remaining_task_ids.map((taskId) => byId.get(taskId));
  const criticalPathSeconds = remaining.length > 0 ? Math.max(...remaining.map((task) => critical.get(task.task_id))) : 0;
  const sequentialSeconds = remaining.reduce((total, task) => total + task.active_budget_seconds, 0);
  return {
    valid: true,
    errors: [],
    wi: status.wi,
    graph_digest: status.graph_digest,
    selected_task_ids: selected.map((task) => task.task_id),
    occupied_task_ids: occupied.map((task) => task.task_id),
    deferred,
    deterministic_merge_order: graph.merge_task_order.filter((taskId) => selected.some((task) => task.task_id === taskId)),
    critical_path_seconds: criticalPathSeconds,
    remaining_sequential_budget_seconds: sequentialSeconds,
    deadline_feasible: criticalPathSeconds <= globalBudget,
    budget_deficit_seconds: Math.max(0, criticalPathSeconds - globalBudget),
    theoretical_speedup_ceiling: criticalPathSeconds === 0 ? 1 : Number((sequentialSeconds / criticalPathSeconds).toFixed(3))
  };
}

export function planExecutionWaves(capsules, options = {}) {
  const graph = compileExecutionGraph(capsules);
  if (!graph.valid) return graph;
  const maxParallel = options.max_parallel ?? 4;
  const globalBudget = options.global_active_budget_seconds ?? 3600;
  if (!Number.isInteger(maxParallel) || maxParallel < 1) return { valid: false, errors: ["max_parallel must be a positive integer"] };
  if (!Number.isInteger(globalBudget) || globalBudget < 1) return { valid: false, errors: ["global_active_budget_seconds must be a positive integer"] };

  const byId = new Map(capsules.map((capsule) => [capsule.task_id, capsule]));
  const critical = criticalPathBudgets(capsules);
  const completed = new Set();
  const running = [];
  const started = new Set();
  const schedule = [];
  let now = 0;

  while (completed.size < capsules.length) {
    const ready = capsules.filter((capsule) => !started.has(capsule.task_id) &&
      capsule.dependencies.every((dependency) => completed.has(dependency)));
    const occupied = running.map((entry) => entry.capsule);
    const { selected, deferred } = scheduleCandidates(ready, occupied, critical, maxParallel);
    for (const capsule of selected) {
      started.add(capsule.task_id);
      const finish = now + capsule.active_budget_seconds;
      running.push({ capsule, finish });
      schedule.push({
        task_id: capsule.task_id,
        start_offset_seconds: now,
        finish_offset_seconds: finish,
        active_budget_seconds: capsule.active_budget_seconds,
        merge_order_key: capsule.parallel_policy.merge_order_key
      });
    }
    if (running.length === 0) {
      return { valid: false, errors: [`scheduler deadlock at ${now}s: ${deferred.map((item) => `${item.task_id}=${item.reason}`).join(", ") || "no ready tasks"}`] };
    }
    const nextFinish = Math.min(...running.map((entry) => entry.finish));
    now = nextFinish;
    for (let index = running.length - 1; index >= 0; index -= 1) {
      if (running[index].finish === now) {
        completed.add(running[index].capsule.task_id);
        running.splice(index, 1);
      }
    }
  }

  const sequentialSeconds = capsules.reduce((total, capsule) => total + capsule.active_budget_seconds, 0);
  return {
    valid: true,
    errors: [],
    wi: graph.wi,
    graph_digest: graph.graph_digest,
    max_parallel: maxParallel,
    schedule: schedule.sort((left, right) => left.start_offset_seconds - right.start_offset_seconds || left.merge_order_key.localeCompare(right.merge_order_key)),
    predicted_active_wall_seconds: now,
    sequential_active_seconds: sequentialSeconds,
    predicted_speedup: Number((sequentialSeconds / now).toFixed(3)),
    deterministic_merge_order: graph.merge_task_order,
    global_active_budget_seconds: globalBudget,
    deadline_feasible: now <= globalBudget,
    budget_deficit_seconds: Math.max(0, now - globalBudget)
  };
}

export function projectExecutionStatus(capsules, eventsByTask = {}) {
  const graph = compileExecutionGraph(capsules);
  if (!graph.valid) return graph;
  if (!eventsByTask || typeof eventsByTask !== "object" || Array.isArray(eventsByTask)) {
    return { valid: false, errors: ["events_by_task must be an object"] };
  }
  const errors = [];
  const rawStates = new Map();
  for (const capsule of capsules) {
    const events = eventsByTask[capsule.task_id] ?? [];
    if (!Array.isArray(events)) {
      errors.push(`events_by_task.${capsule.task_id} must be an array`);
      continue;
    }
    if (events.length === 0) {
      rawStates.set(capsule.task_id, { status: "PENDING", event_count: 0, last_event_digest: null });
      continue;
    }
    const replayed = replayExecutionEvents(events);
    if (!replayed.valid) {
      errors.push(...replayed.errors.map((error) => `${capsule.task_id}: ${error}`));
      continue;
    }
    const expectedEventTask = `${capsule.task_id}.r${capsule.revision}`;
    if (replayed.state.task_id !== expectedEventTask) {
      errors.push(`${capsule.task_id}: event task ${replayed.state.task_id} != ${expectedEventTask}`);
      continue;
    }
    if (!sameGenerationBindings(replayed.state.generation_bindings, capsule.generation_bindings)) {
      errors.push(`${capsule.task_id}: event generation bindings do not match capsule`);
      continue;
    }
    rawStates.set(capsule.task_id, replayed.state);
  }
  const unexpected = Object.keys(eventsByTask).filter((taskId) => !capsules.some((capsule) => capsule.task_id === taskId));
  if (unexpected.length > 0) errors.push(`events exist for unknown tasks: ${unexpected.sort().join(",")}`);
  if (errors.length > 0) return { valid: false, errors: unique(errors).sort() };

  const accepted = new Set([...rawStates.entries()].filter(([, state]) => state.status === "ACCEPTED").map(([taskId]) => taskId));
  const byId = new Map(capsules.map((capsule) => [capsule.task_id, capsule]));
  const tasks = graph.task_order.map((taskId) => {
    const capsule = byId.get(taskId);
    const raw = rawStates.get(taskId);
    const waitingOn = capsule.dependencies.filter((dependency) => !accepted.has(dependency));
    const status = raw.status === "PENDING" ? (waitingOn.length === 0 ? "READY" : "BLOCKED") : raw.status;
    return {
      task_id: taskId,
      product_outcome: capsule.product_outcome,
      status,
      waiting_on: waitingOn,
      active_budget_seconds: capsule.active_budget_seconds,
      event_count: raw.event_count,
      last_event_digest: raw.last_event_digest
    };
  });
  const blockers = tasks.filter((task) => new Set([
    "PLAN_FROZEN", "ASSIST_REQUESTED", "EXTERNAL_WAIT", "IMPLEMENTATION_TERMINAL"
  ]).has(task.status));
  const remaining = tasks.filter((task) => task.status !== "ACCEPTED");
  const ready = tasks.filter((task) => task.status === "READY");
  const active = tasks.filter((task) => !new Set(["ACCEPTED", "READY", "BLOCKED"]).has(task.status));
  return {
    valid: true,
    errors: [],
    wi: graph.wi,
    plan_digest: graph.plan_digest,
    graph_digest: graph.graph_digest,
    tasks,
    completed_task_ids: tasks.filter((task) => task.status === "ACCEPTED").map((task) => task.task_id),
    remaining_task_ids: remaining.map((task) => task.task_id),
    ready_task_ids: ready.map((task) => task.task_id),
    active_task_ids: active.map((task) => task.task_id),
    blockers,
    next_permitted_task_id: active[0]?.task_id ?? ready[0]?.task_id ?? null,
    summary: {
      total: tasks.length,
      completed: tasks.length - remaining.length,
      remaining: remaining.length,
      progress_percent: Number((((tasks.length - remaining.length) / tasks.length) * 100).toFixed(2)),
      remaining_active_budget_seconds: remaining.reduce((total, task) => total + task.active_budget_seconds, 0)
    }
  };
}

export function authorizeEffect(capsule, effect) {
  const compiled = compileCapsule(capsule);
  if (!compiled.valid) return { valid: false, authorized: false, errors: compiled.errors };
  const errors = [];
  for (const field of ["capability_id", "principal", "kind", "target"]) {
    if (!nonEmptyString(effect?.[field])) errors.push(`${field} must be non-empty`);
  }
  if (!EFFECT_KINDS.has(effect?.kind)) errors.push(`unknown effect kind ${effect?.kind}`);
  const cost = effect?.cost_usd ?? 0;
  if (typeof cost !== "number" || cost < 0 || !Number.isFinite(cost)) errors.push("cost_usd must be a non-negative finite number");
  const capability = capsule.effect_capabilities.find((candidate) => candidate.id === effect?.capability_id);
  if (!capability) errors.push(`unknown capability ${effect?.capability_id}`);
  if (errors.length > 0) return { valid: false, authorized: false, errors: unique(errors).sort() };

  if (effect.principal !== capability.principal) errors.push("principal does not own capability");
  if (effect.kind !== capability.kind) errors.push("effect kind does not match capability");
  if (capability.root_only && effect.principal !== "root") errors.push("root-only capability denied");
  if (!capability.targets.some((pattern) => matches(pattern, effect.target))) errors.push("target is outside capability patterns");
  if (cost > capability.max_cost_usd) errors.push(`cost ${cost} exceeds capability ceiling ${capability.max_cost_usd}`);
  if (capability.requires_idempotency && !nonEmptyString(effect.idempotency_key)) errors.push("idempotency_key is required");

  if (effect.kind === "filesystem_write") {
    if (!safeConcretePath(effect.target)) errors.push("filesystem write target must be a safe concrete relative path");
    if (!ACTIONS.has(effect.file_action)) errors.push("filesystem write requires file_action CREATE|MODIFY|DELETE");
    const allowed = capsule.allowed_files.find((file) => file.path === effect.target);
    if (!allowed) errors.push("filesystem write target is outside allowed_files");
    else if (allowed.action !== effect.file_action) errors.push(`file_action ${effect.file_action} does not match allowed action ${allowed.action}`);
    if (capsule.forbidden_writes.some((pattern) => matches(pattern, effect.target))) {
      errors.push("filesystem write target overlaps forbidden_writes");
    }
  }

  return {
    valid: errors.length === 0,
    authorized: errors.length === 0,
    errors: unique(errors).sort(),
    capability_id: capability.id,
    effect_digest: errors.length === 0 ? digest({
      capability_id: capability.id,
      principal: effect.principal,
      kind: effect.kind,
      target: effect.target,
      file_action: effect.file_action ?? null,
      cost_usd: cost,
      idempotency_key: effect.idempotency_key ?? null
    }) : null,
    reversible: capability.reversible
  };
}

export function classifyFailure(input) {
  const errors = [];
  if (!FAILURE_CATEGORIES.has(input?.category)) errors.push(`unknown failure category ${input?.category}`);
  for (const field of ["stage", "command_id", "causal_code", "relevant_digest"]) {
    if (!nonEmptyString(input?.[field])) errors.push(`${field} must be non-empty`);
  }
  if (!Number.isInteger(input?.exit_code)) errors.push("exit_code must be an integer");
  if (!Number.isInteger(input?.attempt) || input.attempt < 1) errors.push("attempt must be a positive integer");
  if (errors.length > 0) return { valid: false, errors: errors.sort() };

  const failureFingerprint = digest({
    category: input.category,
    stage: input.stage,
    command_id: input.command_id,
    exit_code: input.exit_code,
    causal_code: input.causal_code,
    relevant_digest: input.relevant_digest
  });
  const planImpact = PLAN_FREEZE_CATEGORIES.has(input.category) ||
    (input.category === "ASSERTION_SEMANTICS" && input.signed_contract_conflict === true);

  let route;
  if (planImpact) {
    route = "PLAN_FROZEN";
  } else if (input.attempt <= 2) {
    route = "EXECUTOR_RETRY";
  } else if (input.assist_authorized === true && input.assist_already_used !== true) {
    route = "EXECUTOR_ASSIST_RETRY";
  } else if (input.assist_already_used !== true) {
    route = "ASSIST_REQUIRED";
  } else {
    route = "IMPLEMENTATION_TERMINAL";
  }

  return {
    valid: true,
    category: input.category,
    failure_fingerprint: failureFingerprint,
    plan_impact: planImpact,
    route,
    mutation_allowed: route === "EXECUTOR_RETRY" || route === "EXECUTOR_ASSIST_RETRY",
    requires_product_authority: route === "PLAN_FROZEN",
    retry_budget: { local_attempts: 2, assist_attempts: 1 }
  };
}

function digestPath(repoRoot, candidate) {
  const absolute = path.resolve(repoRoot, candidate);
  const root = path.resolve(repoRoot);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) return "UNSAFE";
  try {
    const stat = fs.lstatSync(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) return `NON_FILE:${stat.mode}`;
    return digest(fs.readFileSync(absolute));
  } catch (error) {
    if (error.code === "ENOENT") return "MISSING";
    return `ERROR:${error.code ?? "UNKNOWN"}`;
  }
}

export function selectValidations(capsule, options = {}) {
  const compiled = compileCapsule(capsule);
  if (!compiled.valid) return { valid: false, errors: compiled.errors };
  const mode = options.mode ?? "focused";
  if (!new Set(["focused", "freeze"]).has(mode)) return { valid: false, errors: [`unknown mode ${mode}`] };
  const changedPaths = unique(options.changedPaths ?? []).sort();
  const unsafeChanged = changedPaths.filter((candidate) => !safeRelativePath(candidate));
  if (unsafeChanged.length > 0) return { valid: false, errors: unsafeChanged.map((item) => `unsafe changed path ${item}`) };
  const repoRoot = options.repoRoot ?? process.cwd();
  const cacheIndex = options.cacheIndex ?? {};
  const environmentIdentity = options.environmentIdentity ?? "local";
  const capsulePaths = capsule.allowed_files.map((item) => item.path);
  const selected = [];
  const skipped = [];

  for (const validator of capsule.validations) {
    const affected = changedPaths.some((candidate) => validator.inputs.some((pattern) => matches(pattern, candidate)));
    if (mode === "focused" && !affected) {
      skipped.push({ id: validator.id, reason: "unchanged-inputs" });
      continue;
    }
    const relevantPaths = unique([
      ...capsulePaths.filter((candidate) => validator.inputs.some((pattern) => matches(pattern, candidate))),
      ...changedPaths.filter((candidate) => validator.inputs.some((pattern) => matches(pattern, candidate))),
      ...validator.inputs.filter((pattern) => !pattern.includes("*"))
    ]).sort();
    const relevantDigests = Object.fromEntries(relevantPaths.map((candidate) => [candidate, digestPath(repoRoot, candidate)]));
    const cacheKey = digest({
      validator_id: validator.id,
      validator_digest: validator.validator_digest,
      environment_class: validator.environment_class,
      environment_identity: environmentIdentity,
      relevant_digests: relevantDigests
    });
    const cacheHit = cacheIndex[cacheKey]?.status === "PASS";
    const forceRun = mode === "freeze" && validator.required_at_freeze;
    selected.push({
      id: validator.id,
      action: cacheHit && !forceRun ? "reuse" : "run",
      cache_key: cacheKey,
      cache_hit: cacheHit,
      relevant_digests: relevantDigests,
      argv: validator.argv,
      environment_class: validator.environment_class,
      cost_class: validator.cost_class
    });
  }

  return {
    valid: true,
    mode,
    changed_paths: changedPaths,
    selected,
    skipped,
    summary: {
      run: selected.filter((item) => item.action === "run").length,
      reuse: selected.filter((item) => item.action === "reuse").length,
      skipped: skipped.length
    }
  };
}

function executionEventDigest(event) {
  const payload = { ...event };
  delete payload.event_digest;
  return digest(payload);
}

function transitionExecutionState(state, event, errors) {
  const from = state.status;
  const requireState = (...allowed) => {
    if (!allowed.includes(from)) {
      errors.push(`illegal transition ${event.type} from ${from}; expected ${allowed.join("|")}`);
      return false;
    }
    return true;
  };

  if (event.type === "RUN_CREATED") {
    if (requireState("NEW")) state.status = "READY";
  } else if (event.type === "TASK_STARTED") {
    if (requireState("READY")) state.status = "RUNNING";
  } else if (event.type === "STATIC_PASSED") {
    if (requireState("RUNNING")) state.status = "STATIC_GREEN";
  } else if (event.type === "RUNTIME_PASSED") {
    if (requireState("STATIC_GREEN")) state.status = "RUNTIME_GREEN";
  } else if (event.type === "CHECKPOINT_CREATED") {
    if (requireState("RUNTIME_GREEN")) state.status = "CHECKPOINTED_AWAITING_ORCHESTRATOR";
  } else if (event.type === "TASK_ACCEPTED") {
    if (requireState("CHECKPOINTED_AWAITING_ORCHESTRATOR")) state.status = "ACCEPTED";
  } else if (event.type === "FAILURE_RECORDED") {
    if (requireState("RUNNING", "STATIC_GREEN", "RUNTIME_GREEN")) {
      if (!nonEmptyString(event.payload?.failure_fingerprint)) errors.push("FAILURE_RECORDED requires failure_fingerprint");
      const route = event.payload?.route;
      if (new Set(["EXECUTOR_RETRY", "EXECUTOR_ASSIST_RETRY"]).has(route)) state.status = "READY";
      else if (route === "ASSIST_REQUIRED") state.status = "ASSIST_REQUESTED";
      else if (route === "PLAN_FROZEN") state.status = "PLAN_FROZEN";
      else if (route === "IMPLEMENTATION_TERMINAL") state.status = "IMPLEMENTATION_TERMINAL";
      else errors.push(`FAILURE_RECORDED has unknown route ${route}`);
    }
  } else if (event.type === "ASSIST_AUTHORIZED") {
    if (requireState("ASSIST_REQUESTED")) state.status = "READY";
  } else if (event.type === "PLAN_AMENDED") {
    if (requireState("PLAN_FROZEN")) state.status = "READY";
  } else if (event.type === "EXTERNAL_WAIT_STARTED") {
    if (requireState("RUNNING", "STATIC_GREEN", "RUNTIME_GREEN")) {
      state.resume_state = from;
      state.status = "EXTERNAL_WAIT";
    }
  } else if (event.type === "EXTERNAL_WAIT_ENDED") {
    if (requireState("EXTERNAL_WAIT")) {
      state.status = state.resume_state;
      state.resume_state = null;
    }
  } else if (event.type === "RUN_CANCELLED") {
    if (TERMINAL_STATES.has(from)) errors.push(`illegal transition RUN_CANCELLED from ${from}`);
    else state.status = "CANCELLED";
  }
}

function validateExecutionEventPayload(event, errors) {
  const payload = event?.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;
  if (event.type === "RUN_CREATED") {
    if (!SHA256.test(payload.capsule_digest ?? "")) errors.push("RUN_CREATED requires capsule_digest sha256");
    if (!SHA256.test(payload.plan_digest ?? "")) errors.push("RUN_CREATED requires plan_digest sha256");
  } else if (event.type === "TASK_STARTED") {
    if (!Number.isInteger(payload.attempt) || payload.attempt < 1) errors.push("TASK_STARTED requires positive attempt");
  } else if (new Set(["STATIC_PASSED", "RUNTIME_PASSED"]).has(event.type)) {
    if (!SHA256.test(payload.receipt_digest ?? "")) errors.push(`${event.type} requires receipt_digest sha256`);
  } else if (event.type === "CHECKPOINT_CREATED") {
    if (!GIT_OBJECT_ID.test(payload.commit_sha ?? "")) errors.push("CHECKPOINT_CREATED requires Git commit_sha");
  } else if (event.type === "TASK_ACCEPTED") {
    if (!SHA256.test(payload.acceptance_digest ?? "")) errors.push("TASK_ACCEPTED requires acceptance_digest sha256");
  } else if (event.type === "FAILURE_RECORDED") {
    if (!SHA256.test(payload.failure_fingerprint ?? "")) errors.push("FAILURE_RECORDED requires failure_fingerprint sha256");
  } else if (event.type === "ASSIST_AUTHORIZED") {
    if (!SHA256.test(payload.authorization_digest ?? "")) errors.push("ASSIST_AUTHORIZED requires authorization_digest sha256");
  } else if (event.type === "PLAN_AMENDED") {
    if (!SHA256.test(payload.plan_digest ?? "")) errors.push("PLAN_AMENDED requires plan_digest sha256");
  } else if (new Set(["EXTERNAL_WAIT_STARTED", "EXTERNAL_WAIT_ENDED"]).has(event.type)) {
    if (!nonEmptyString(payload.resource)) errors.push(`${event.type} requires resource`);
  } else if (event.type === "RUN_CANCELLED") {
    if (!nonEmptyString(payload.reason)) errors.push("RUN_CANCELLED requires reason");
  }
}

export function replayExecutionEvents(events) {
  const errors = [];
  if (!Array.isArray(events) || events.length === 0) {
    return { valid: false, errors: ["events must contain at least one event"] };
  }
  const state = {
    run_id: null,
    task_id: null,
    status: "NEW",
    resume_state: null,
    generation_bindings: null,
    event_count: 0,
    last_event_digest: null
  };

  for (const [index, event] of events.entries()) {
    const structural = validate(EVENT_SCHEMA, event);
    errors.push(...structural.errors.map((error) => `events[${index}] ${error}`));
    if (event?.schema_version !== 2) errors.push(`events[${index}] schema_version must equal 2`);
    if (!EVENT_TYPES.has(event?.type)) errors.push(`events[${index}] unknown event type ${event?.type}`);
    if (index === 0 && event?.type !== "RUN_CREATED") errors.push("first event must be RUN_CREATED");
    if (!nonEmptyString(event?.run_id)) errors.push(`events[${index}] run_id must be non-empty`);
    if (!nonEmptyString(event?.task_id)) errors.push(`events[${index}] task_id must be non-empty`);
    errors.push(...validateGenerationBindings(event?.generation_bindings, `events[${index}].generation_bindings`));
    if (!canonicalIsoTimestamp(event?.observed_at)) errors.push(`events[${index}] observed_at must be canonical ISO timestamp`);
    if (index > 0 && canonicalIsoTimestamp(event?.observed_at) && canonicalIsoTimestamp(events[index - 1]?.observed_at) &&
      Date.parse(event.observed_at) < Date.parse(events[index - 1].observed_at)) {
      errors.push(`events[${index}] observed_at moved backwards`);
    }
    if (event?.sequence !== index + 1) errors.push(`events[${index}] sequence ${event?.sequence} != ${index + 1}`);
    const expectedPrevious = index === 0 ? null : events[index - 1]?.event_digest;
    if (event?.previous_event_digest !== expectedPrevious) errors.push(`events[${index}] previous_event_digest mismatch`);
    if (!SHA256.test(event?.event_digest ?? "")) errors.push(`events[${index}] event_digest must be lowercase sha256`);
    else if (executionEventDigest(event) !== event.event_digest) errors.push(`events[${index}] event_digest mismatch`);

    if (index === 0) {
      state.run_id = event?.run_id;
      state.task_id = event?.task_id;
      state.generation_bindings = event?.generation_bindings;
    } else {
      if (event?.run_id !== state.run_id) errors.push(`events[${index}] run_id changed`);
      if (event?.task_id !== state.task_id) errors.push(`events[${index}] task_id changed`);
      if (!sameGenerationBindings(event?.generation_bindings, state.generation_bindings)) errors.push(`events[${index}] generation bindings changed`);
    }

    validateExecutionEventPayload(event, errors);
    if (errors.length === 0) transitionExecutionState(state, event, errors);
    state.event_count = index + 1;
    state.last_event_digest = event?.event_digest ?? null;
  }

  return {
    valid: errors.length === 0,
    errors: unique(errors).sort(),
    state: errors.length === 0 ? state : null,
    event_chain_digest: errors.length === 0 ? digest(events.map((event) => event.event_digest)) : null
  };
}

export function appendExecutionEvent(events, input) {
  if (!Array.isArray(events)) return { valid: false, errors: ["events must be an array"] };
  const prior = events.length === 0 ? null : replayExecutionEvents(events);
  if (prior && !prior.valid) return prior;
  const event = {
    schema_version: 2,
    run_id: input?.run_id,
    sequence: events.length + 1,
    type: input?.type,
    task_id: input?.task_id,
    generation_bindings: input?.generation_bindings,
    observed_at: input?.observed_at,
    previous_event_digest: events.length === 0 ? null : events.at(-1).event_digest,
    payload: input?.payload ?? {},
    event_digest: null
  };
  event.event_digest = executionEventDigest(event);
  const appended = [...events, event];
  const replayed = replayExecutionEvents(appended);
  return replayed.valid ? { ...replayed, event, events: appended } : replayed;
}

function evidencePayload(object) {
  const payload = { ...object };
  delete payload.object_digest;
  return payload;
}

export function buildEvidenceObject(input) {
  const errors = [];
  for (const field of ["kind", "subject", "environment_identity"]) {
    if (!nonEmptyString(input?.[field])) errors.push(`${field} must be non-empty`);
  }
  if (!nonEmptyString(input?.producer_id)) errors.push("producer_id must be non-empty");
  if (!Array.isArray(input?.consumer_ids) || input.consumer_ids.length === 0 || input.consumer_ids.some((id) => !nonEmptyString(id))) {
    errors.push("consumer_ids must contain at least one non-empty consumer");
  } else if (unique(input.consumer_ids).length !== input.consumer_ids.length) {
    errors.push("consumer_ids contains duplicates");
  }
  errors.push(...validateGenerationBindings(input?.generation_bindings));
  if (!TRUST_LEVELS.has(input?.trust_level)) errors.push(`unknown trust_level ${input?.trust_level}`);
  if (!canonicalIsoTimestamp(input?.created_at)) errors.push("created_at must be canonical ISO timestamp");
  if (input?.expires_at !== null && !canonicalIsoTimestamp(input?.expires_at)) {
    errors.push("expires_at must be null or canonical ISO timestamp");
  }
  if (canonicalIsoTimestamp(input?.created_at) && canonicalIsoTimestamp(input?.expires_at) &&
    Date.parse(input.expires_at) <= Date.parse(input.created_at)) {
    errors.push("expires_at must be later than created_at");
  }
  if (!input?.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) {
    errors.push("payload must be an object");
  }
  if (!input?.relevant_digests || typeof input.relevant_digests !== "object" || Array.isArray(input.relevant_digests)) {
    errors.push("relevant_digests must be an object");
  } else {
    for (const [key, value] of Object.entries(input.relevant_digests)) {
      if (!nonEmptyString(key) || !SHA256.test(value)) errors.push(`relevant_digests.${key} must be lowercase sha256`);
    }
  }
  if (errors.length > 0) return { valid: false, errors: unique(errors).sort() };

  const object = {
    schema_version: 2,
    kind: input.kind,
    trust_level: input.trust_level,
    subject: input.subject,
    producer_id: input.producer_id,
    consumer_ids: input.consumer_ids,
    generation_bindings: input.generation_bindings,
    relevant_digests: input.relevant_digests,
    environment_identity: input.environment_identity,
    created_at: input.created_at,
    expires_at: input.expires_at,
    payload: input.payload,
    object_digest: null
  };
  object.object_digest = digest(evidencePayload(object));
  return { valid: true, errors: [], object };
}

function evidenceObjectPath(storeRoot, objectDigest) {
  if (!SHA256.test(objectDigest ?? "")) throw new Error("object digest must be lowercase sha256");
  return path.join(path.resolve(storeRoot), "objects", "sha256", objectDigest.slice(0, 2), `${objectDigest}.json`);
}

export function verifyEvidenceObject(storeRoot, objectDigest, options = {}) {
  let objectPath;
  try {
    objectPath = evidenceObjectPath(storeRoot, objectDigest);
  } catch (error) {
    return { valid: false, reusable: false, errors: [error.message] };
  }
  let object;
  try {
    object = JSON.parse(fs.readFileSync(objectPath, "utf8"));
  } catch (error) {
    return { valid: false, reusable: false, errors: [`evidence object unavailable: ${error.code ?? error.message}`] };
  }
  const errors = validate(EVIDENCE_SCHEMA, object).errors;
  if (object?.object_digest !== objectDigest) errors.push("stored object digest does not match requested digest");
  if (object && digest(evidencePayload(object)) !== object?.object_digest) errors.push("stored object integrity mismatch");
  if (!canonicalIsoTimestamp(object?.created_at)) errors.push("stored created_at is invalid");
  if (object?.expires_at !== null && !canonicalIsoTimestamp(object?.expires_at)) errors.push("stored expires_at is invalid");
  const atTime = options.at_time ?? new Date().toISOString();
  if (!canonicalIsoTimestamp(atTime)) errors.push("at_time must be canonical ISO timestamp");
  const expired = errors.length === 0 && object.expires_at !== null && Date.parse(object.expires_at) <= Date.parse(atTime);
  return {
    valid: errors.length === 0,
    reusable: errors.length === 0 && !expired,
    expired,
    errors: unique(errors).sort(),
    object: errors.length === 0 ? object : null,
    object_path: objectPath
  };
}

export function putEvidenceObject(storeRoot, input) {
  if (!nonEmptyString(storeRoot)) return { valid: false, errors: ["store root must be non-empty"] };
  const built = buildEvidenceObject(input);
  if (!built.valid) return built;
  const object = built.object;
  const objectPath = evidenceObjectPath(storeRoot, object.object_digest);
  const directory = path.dirname(objectPath);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (fs.existsSync(objectPath)) {
    const verified = verifyEvidenceObject(storeRoot, object.object_digest, { at_time: object.created_at });
    return verified.valid ? { ...verified, stored: false } : verified;
  }

  const temporary = path.join(directory, `.${object.object_digest}.${process.pid}.${crypto.randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, `${stable(object)}\n`, { flag: "wx", mode: 0o600 });
    try {
      fs.linkSync(temporary, objectPath);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  } finally {
    try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const verified = verifyEvidenceObject(storeRoot, object.object_digest, { at_time: object.created_at });
  return verified.valid ? { ...verified, stored: true } : verified;
}

function parseArgs(argv) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      result._.push(token);
      continue;
    }
    const equals = token.indexOf("=");
    if (equals !== -1) {
      result[token.slice(2, equals)] = token.slice(equals + 1);
    } else if (argv[index + 1] && !argv[index + 1].startsWith("--")) {
      result[token.slice(2)] = argv[index + 1];
      index += 1;
    } else {
      result[token.slice(2)] = true;
    }
  }
  return result;
}

function readJson(file, label) {
  if (!file) throw new Error(`${label} path is required`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function usage() {
  return [
    "Usage:",
    "  node scripts/svc-execution-controller-v2.mjs compile --capsule <file>",
    "  node scripts/svc-execution-controller-v2.mjs classify-failure --input <file>",
    "  node scripts/svc-execution-controller-v2.mjs select-validations --capsule <file> --changed <json-array> [--cache <file>] [--mode focused|freeze] [--repo-root <path>]",
    "  node scripts/svc-execution-controller-v2.mjs authorize-effect --capsule <file> --input <file>",
    "  node scripts/svc-execution-controller-v2.mjs replay-events --input <file>",
    "  node scripts/svc-execution-controller-v2.mjs append-event --events <file> --input <file>",
    "  node scripts/svc-execution-controller-v2.mjs put-evidence --store <directory> --input <file>",
    "  node scripts/svc-execution-controller-v2.mjs verify-evidence --store <directory> --digest <sha256> [--at-time <ISO timestamp>]",
    "  node scripts/svc-execution-controller-v2.mjs status --capsules <file> --events <file>",
    "  node scripts/svc-execution-controller-v2.mjs schedule-wave --capsules <file> --events <file> [--max-parallel <n>] [--global-active-budget-seconds <n>]",
    "  node scripts/svc-execution-controller-v2.mjs plan-waves --capsules <file> [--max-parallel <n>] [--global-active-budget-seconds <n>]"
  ].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  if (args.help || !command) {
    console.log(usage());
    return args.help ? 0 : 2;
  }
  try {
    let result;
    if (command === "compile") {
      result = compileCapsule(readJson(args.capsule, "capsule"));
    } else if (command === "classify-failure") {
      result = classifyFailure(readJson(args.input, "input"));
    } else if (command === "select-validations") {
      const capsule = readJson(args.capsule, "capsule");
      result = selectValidations(capsule, {
        changedPaths: readJson(args.changed, "changed"),
        cacheIndex: args.cache ? readJson(args.cache, "cache") : {},
        mode: args.mode ?? "focused",
        repoRoot: args["repo-root"] ?? process.cwd(),
        environmentIdentity: args["environment-identity"] ?? "local"
      });
    } else if (command === "authorize-effect") {
      result = authorizeEffect(readJson(args.capsule, "capsule"), readJson(args.input, "input"));
      result.valid = result.valid && result.authorized;
    } else if (command === "replay-events") {
      result = replayExecutionEvents(readJson(args.input, "input"));
    } else if (command === "append-event") {
      result = appendExecutionEvent(readJson(args.events, "events"), readJson(args.input, "input"));
    } else if (command === "put-evidence") {
      result = putEvidenceObject(args.store, readJson(args.input, "input"));
    } else if (command === "verify-evidence") {
      result = verifyEvidenceObject(args.store, args.digest, { at_time: args["at-time"] });
    } else if (command === "status") {
      result = projectExecutionStatus(readJson(args.capsules, "capsules"), readJson(args.events, "events"));
    } else if (command === "schedule-wave") {
      result = scheduleExecutionWave(readJson(args.capsules, "capsules"), readJson(args.events, "events"), {
        max_parallel: args["max-parallel"] ? Number(args["max-parallel"]) : 4,
        global_active_budget_seconds: args["global-active-budget-seconds"] ? Number(args["global-active-budget-seconds"]) : 3600
      });
    } else if (command === "plan-waves") {
      result = planExecutionWaves(readJson(args.capsules, "capsules"), {
        max_parallel: args["max-parallel"] ? Number(args["max-parallel"]) : 4,
        global_active_budget_seconds: args["global-active-budget-seconds"] ? Number(args["global-active-budget-seconds"]) : 3600
      });
    } else {
      console.error(`unknown command ${command}\n${usage()}`);
      return 2;
    }
    const stream = result.valid ? process.stdout : process.stderr;
    stream.write(`${JSON.stringify(result)}\n`);
    return result.valid ? 0 : 1;
  } catch (error) {
    console.error(JSON.stringify({ valid: false, errors: [error.message] }));
    return 2;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await main();
}
