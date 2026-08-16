#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const RISKY_RESOURCES = new Set(["money", "ledger", "subscription", "entitlement", "quota", "counter", "inventory", "identity", "notification"]);
const hasText = (v) => typeof v === "string" && v.trim().length > 0;
function normalizedScope(value) {
  const scope = String(value || "").replaceAll("\\", "/").replace(/^\.\//, "");
  if (!scope || scope.startsWith("/") || scope.split("/").includes("..") || /[?[{]/.test(scope) || (scope.includes("*") && !scope.endsWith("/**"))) throw new Error(`unsafe ownership scope: ${value}`);
  return path.posix.normalize(scope);
}
function scopePrefix(scope) { return scope.endsWith("/**") ? scope.slice(0, -3).replace(/\/$/, "") : scope; }
function scopesOverlap(left, right) {
  const a = scopePrefix(left); const b = scopePrefix(right);
  if (a === b) return true;
  return a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}
function scopeMatches(scope, file) {
  const prefix = scopePrefix(scope);
  return file === prefix || (scope.endsWith("/**") && file.startsWith(`${prefix}/`));
}

function diffPaths(root, baseRef = "HEAD") {
  const changed = new Set();
  const raw = execFileSync("git", ["-C", root, "diff", "--name-status", "-z", baseRef], { encoding: "utf8" }).split("\0");
  for (let index = 0; index < raw.length && raw[index];) {
    const status = raw[index++];
    if (/^[RC]/.test(status)) { changed.add(raw[index++]); changed.add(raw[index++]); }
    else changed.add(raw[index++]);
  }
  for (const file of execFileSync("git", ["-C", root, "ls-files", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean)) changed.add(file);
  return changed;
}

function executableNeedles(executable) {
  const base = path.basename(executable);
  const stem = base.replace(/\.[^.]+$/, "");
  const camel = stem.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  return [...new Set([base, stem, camel])];
}

function directProposalCount(root) {
  return fs.readdirSync(path.join(root, "proposals"))
    .filter((name) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(name)).length;
}

function detectedResourceWriters(root, changedPaths, baseRef) {
  const detected = new Set();
  const executable = /\.(?:[cm]?[jt]sx?|py|go|rs|sql)$/;
  for (const relative of changedPaths) {
    if (!executable.test(relative) || /(?:^|\/)(?:test|tests|__tests__|fixtures|test-framework)(?:\/|$)/.test(relative) || relative === "scripts/validate-plan-contract.mjs") continue;
    let added = "";
    try { added = execFileSync("git", ["-C", root, "diff", "--unified=0", baseRef, "--", relative], { encoding: "utf8" }).split(/\r?\n/).filter((line) => /^\+(?!\+\+)/.test(line)).join("\n"); }
    catch {}
    if (!added && fs.existsSync(path.join(root, relative))) try { added = fs.readFileSync(path.join(root, relative), "utf8"); } catch {}
    const patterns = [
      ["money", /(?:balance\s*(?:[+\-*/]?=|\+\+|--)|\b(?:debit|credit|charge|refund|capture|payout)\s*\(|\bbalance\s*:\s*(?:\{[^}\n]*\b(?:decrement|increment|set)\b|[A-Za-z_$][\w$]*)|\b(?:decrement|increment)\s*:\s*(?:amount|value|[A-Za-z_$][\w$]*))/i],
      ["ledger", /(?:append|insert|update|delete|write|post)[A-Za-z0-9_]*(?:ledger|journal)|(?:ledger|journal)[A-Za-z0-9_]*\s*\.(?:push|set|update|delete|insert)/i],
      ["subscription", /(?:create|cancel|pause|resume|renew|update)[A-Za-z0-9_]*subscription/i],
      ["entitlement", /(?:grant|revoke|consume|update|set)[A-Za-z0-9_]*entitlement/i],
      ["quota", /(?:increment|decrement|consume|reserve|release|update|set)[A-Za-z0-9_]*quota|quota\s*(?:[+\-]?=|\+\+|--)/i],
      ["counter", /(?:increment|decrement|update|set)[A-Za-z0-9_]*counter|counter\s*(?:[+\-]?=|\+\+|--)/i],
      ["inventory", /(?:reserve|release|decrement|increment|update|set)[A-Za-z0-9_]*inventory|inventory\s*(?:[+\-]?=|\+\+|--)/i],
      ["identity", /(?:create|delete|merge|link|unlink|update)[A-Za-z0-9_]*(?:identity|account|user)/i],
      ["notification", /(?:send|schedule|cancel|enqueue|dispatch)[A-Za-z0-9_]*notification/i],
    ];
    for (const [resource, pattern] of patterns) if (pattern.test(added)) detected.add(resource);
  }
  return detected;
}

export function validatePlanContract(contract, { root = process.cwd() } = {}) {
  const errors = [];
  if (contract?.schema_version !== 1) errors.push("schema_version must be 1");
  if (!hasText(contract?.manifest)) errors.push("manifest is required");
  for (const key of ["ownership", "resource_writers", "claims", "executables"]) if (!Array.isArray(contract?.[key])) errors.push(`${key} must be an array`);
  if (!contract?.resource_review || typeof contract.resource_review !== "object" || Array.isArray(contract.resource_review)) errors.push("resource_review is required");
  if (errors.length) return errors;
  const diffBase = hasText(contract.base_sha) ? contract.base_sha : "HEAD";
  try { execFileSync("git", ["-C", root, "rev-parse", "--verify", "--end-of-options", `${diffBase}^{commit}`], { stdio: "ignore" }); }
  catch { errors.push(`base_sha is not a resolvable commit: ${diffBase}`); return errors; }

  const ownerScopes = [];
  for (const row of contract.ownership) {
    if (!hasText(row.task) || !Array.isArray(row.paths) || row.paths.length === 0) { errors.push("every ownership row requires task and paths"); continue; }
    for (const p of row.paths) {
      if (!hasText(p)) { errors.push(`empty owned path in ${row.task}`); continue; }
      let scope; try { scope = normalizedScope(p); } catch (error) { errors.push(error.message); continue; }
      for (const prior of ownerScopes) if (prior.task !== row.task && scopesOverlap(scope, prior.scope)) errors.push(`ownership scopes overlap across tasks: ${prior.task}:${prior.scope}, ${row.task}:${scope}`);
      ownerScopes.push({ task: row.task, scope });
    }
  }
  for (const row of contract.resource_writers) {
    if (!RISKY_RESOURCES.has(row.resource)) errors.push(`unknown resource class ${row.resource}`);
    if (!hasText(row.ordering) || !/order|before|after|sequence|idempot/i.test(row.ordering)) errors.push(`${row.resource} writer lacks explicit ordering`);
    if (!hasText(row.compensation)) errors.push(`${row.resource} writer lacks compensation`);
    if (!hasText(row.property_sweep)) errors.push(`${row.resource} writer lacks property sweep`);
  }
  let invalidExecutableConsumers = 0;
  for (const claim of contract.claims) {
    if (!hasText(claim.kind) || !claim.evidence || typeof claim.evidence !== "object" || !hasText(claim.evidence.verification)) errors.push("every claim requires kind and machine-verifiable direct evidence");
    if (["absence", "complete", "all", "unused"].includes(claim.kind) && !(Number.isInteger(claim.denominator) && claim.denominator >= 0)) errors.push(`${claim.kind} claim requires an integer denominator`);
  }
  for (const executable of contract.executables) {
    if (!hasText(executable.path) || !Array.isArray(executable.consumers) || executable.consumers.length === 0) { errors.push("every executable requires a path and named consumers"); invalidExecutableConsumers += 1; continue; }
    if (hasText(executable.path) && !fs.existsSync(path.resolve(root, executable.path))) errors.push(`executable does not exist: ${executable.path}`);
    let runtimeConsumer = false;
    const needles = executableNeedles(executable.path);
    for (const consumer of executable.consumers) {
      const consumerPath = typeof consumer === "string" ? consumer : consumer?.path;
      if (!hasText(consumerPath)) { errors.push(`executable ${executable.path} has malformed consumer evidence`); invalidExecutableConsumers += 1; continue; }
      const absolute = path.resolve(root, consumerPath);
      let text = "";
      try { text = fs.readFileSync(absolute, "utf8"); } catch { errors.push(`consumer does not exist: ${consumerPath}`); invalidExecutableConsumers += 1; continue; }
      const query = typeof consumer === "object" && hasText(consumer.query) ? consumer.query : null;
      if (!(query ? text.includes(query) : needles.some((needle) => text.includes(needle)))) {
        errors.push(`consumer ${consumerPath} has no direct reference to ${executable.path}`); invalidExecutableConsumers += 1;
      }
      if (/\.(?:mjs|cjs|js|sh)$/.test(consumerPath)) runtimeConsumer = true;
    }
    if (!runtimeConsumer) { errors.push(`executable ${executable.path} has no executable consumer`); invalidExecutableConsumers += 1; }
  }
  let parityFailures = null; let changedForSafety = new Set();
  if (hasText(contract.manifest)) {
    const manifestPath = path.resolve(root, contract.manifest);
    let manifest = "";
    try { manifest = fs.readFileSync(manifestPath, "utf8"); } catch { errors.push(`manifest does not exist: ${contract.manifest}`); }
    const planned = new Map();
    const section = manifest.match(/## Files Planned\n([\s\S]*?)\n## Task Graph/)?.[1] || "";
    for (const line of section.split("\n")) {
      if (!/^\| T\d+ \|/.test(line)) continue;
      const cells = line.split("|").map((cell) => cell.trim());
      const task = cells[1]; const fileCell = String(cells[3] || "").replaceAll("`", "");
      for (const raw of fileCell.split(";")) {
        const p = raw.trim(); if (!p || /\s/.test(p)) continue;
        if (planned.has(p) && planned.get(p) !== task) errors.push(`manifest path ${p} has multiple owners: ${planned.get(p)}, ${task}`);
        planned.set(p, task);
      }
    }
    for (const [plannedPath, task] of planned) {
      let normalized; try { normalized = normalizedScope(plannedPath); } catch (error) { errors.push(error.message); continue; }
      const matches = ownerScopes.filter((owner) => scopeMatches(owner.scope, normalized));
      if (matches.length !== 1) errors.push(`manifest path ${plannedPath} maps to ${matches.length} contract owners; expected exactly 1`);
      else if (matches[0].task !== task) errors.push(`manifest path ${plannedPath} owner mismatch: manifest=${task}, contract=${matches[0].task}`);
    }
    for (const owner of ownerScopes) if (![...planned.keys()].some((plannedPath) => { try { return scopeMatches(owner.scope, normalizedScope(plannedPath)); } catch { return false; } })) errors.push(`contract ownership scope has no manifest path: ${owner.task}:${owner.scope}`);
    try {
      const changed = diffPaths(root, diffBase); changedForSafety = changed;
      const undeclared = [...changed].filter((changedPath) => !planned.has(changedPath)).sort();
      const unchanged = [...planned.keys()].filter((plannedPath) => !changed.has(plannedPath)).sort();
      parityFailures = undeclared.length + unchanged.length;
      for (const changedPath of undeclared) errors.push(`changed path is undeclared in manifest ownership table: ${changedPath}`);
      for (const plannedPath of unchanged) errors.push(`manifest path has no actual change: ${plannedPath}`);
    } catch (error) { errors.push(`cannot reconcile actual diff: ${error.message}`); }
  }

  const changedExecutables = [...changedForSafety].filter((relative) => /\.(?:[cm]?[jt]sx?|py|go|rs|sql|sh)$/.test(relative));
  const review = contract.resource_review;
  if (review.verification !== "changed-executable-census" || !Number.isInteger(review.denominator) || review.denominator !== changedExecutables.length || !hasText(review.evidence)) {
    errors.push(`resource_review must cite changed-executable-census with denominator ${changedExecutables.length} and direct evidence`);
  }
  if (!["no-risky-resource-writers", "declared-risky-resource-writers"].includes(review.disposition)) errors.push("resource_review has an invalid disposition");
  if (review.disposition === "no-risky-resource-writers" && contract.resource_writers.length !== 0) errors.push("no-risky-resource-writers disposition conflicts with declared writers");
  if (review.disposition === "declared-risky-resource-writers" && contract.resource_writers.length === 0) errors.push("declared-risky-resource-writers disposition requires writer rows");
  for (const resource of detectedResourceWriters(root, changedForSafety, diffBase)) {
    if (!contract.resource_writers.some((row) => row.resource === resource)) errors.push(`detected ${resource} writer has no resource_writers contract row`);
  }

  for (const claim of contract.claims) {
    const evidence = claim.evidence || {};
    if (evidence.artifact && !fs.existsSync(path.resolve(root, evidence.artifact))) errors.push(`claim evidence artifact does not exist: ${evidence.artifact}`);
    if (evidence.verification === "source-ledger-count") {
      try { const ledger = JSON.parse(fs.readFileSync(path.resolve(root, evidence.artifact), "utf8")); if (!Array.isArray(ledger.entries) || ledger.entries.length !== claim.denominator) errors.push(`complete claim denominator ${claim.denominator} does not match source ledger`); }
      catch (error) { errors.push(`cannot verify source ledger claim: ${error.message}`); }
    } else if (evidence.verification === "triage-direct-proposals") {
      try { const count = directProposalCount(root); if (count !== claim.denominator) errors.push(`all claim denominator ${claim.denominator} does not match ${count} direct proposals`); }
      catch (error) { errors.push(`cannot verify proposal claim: ${error.message}`); }
    } else if (evidence.verification === "diff-manifest-parity") {
      if (claim.denominator !== parityFailures) errors.push(`absence claim denominator ${claim.denominator} does not match ${parityFailures ?? "unavailable"} manifest parity failures`);
    } else if (evidence.verification === "executable-consumers") {
      if (claim.denominator !== invalidExecutableConsumers) errors.push(`unused claim denominator ${claim.denominator} does not match ${invalidExecutableConsumers} invalid executable consumers`);
    } else if (hasText(evidence.verification)) {
      errors.push(`unknown claim verification: ${evidence.verification}`);
    }
  }
  return errors;
}

export function run(argv = process.argv.slice(2)) {
  const file = argv[0];
  if (!file) { process.stderr.write("usage: validate-plan-contract.mjs <plan-contract.json> [root]\n"); return 2; }
  try {
    const root = path.resolve(argv[1] || process.cwd());
    const contract = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
    const errors = validatePlanContract(contract, { root });
    if (errors.length) { errors.forEach((e) => process.stderr.write(`[plan-contract] ${e}\n`)); return 1; }
    process.stdout.write(`PLAN CONTRACT PASS: ${contract.ownership.length} owner streams, ${contract.claims.length} claims, ${contract.executables.length} executables\n`);
    return 0;
  } catch (error) { process.stderr.write(`[plan-contract] ${error.message}\n`); return 2; }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = run();
