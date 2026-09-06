#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { RISK_FLAG_SET } from "./lib/risk-flags.mjs";

const RISKY_RESOURCES = new Set(["money", "ledger", "subscription", "entitlement", "quota", "counter", "inventory", "identity", "notification"]);
// WI-553 AC-553-4: an atomic-primitive allowlist. Freeform prose ("check if
// the file exists, then write it") is exactly the WI-542 defect — requiring a
// real primitive name is the mechanical rejection.
const CONCURRENCY_ATOMIC_PRIMITIVES = new Set(["flock", "o_excl", "atomic_rename", "compare_and_swap", "advisory_lock", "mkdir_exclusive"]);
// CGH-553-005 / FAB-548-009: normalize punctuation first so "Check if the
// file exists. Then write it." cannot hide behind a period-bounded gap.
const CHECK_THEN_WRITE_RE = /\b(?:check|exists?|stat)\b(?:.{0,80}?)\b(?:then|before)\b(?:.{0,80}?)\b(?:writ(?:e|ing)|creat(?:e|ing))\b/;
const hasText = (v) => typeof v === "string" && v.trim().length > 0;

function normalizeProse(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function concurrencyTestExists(name, root) {
  if (!hasText(name) || normalizeProse(name) === "none") return false;
  const candidates = [path.resolve(root, name), path.resolve(process.cwd(), name)];
  return candidates.some((candidate) => fs.existsSync(candidate));
}

function normalizedPrimitive(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/**
 * WI-553 AC-553-3/AC-553-4: plan-contract.json grows only the sections
 * matched by contract.risk_flags. Each matched section is required and
 * mechanically checked against the concrete WI-542 shapes named in AC-553-4:
 *   - check-then-write / exists-then-create under runtime_concurrency
 *   - one backup path serving as both immutable baseline and rolling
 *     rollback under idempotent_rewriter or external_state_writer
 *   - "preserve user/unknown entries" without a named fixture per documented
 *     entry type under lossless_rmw
 * An unmatched section present without its flag is also rejected — the
 * contract must grow ONLY the matched sections, never more.
 */
export function validateRiskSections(contract, root, errors, { futurePaths = new Set() } = {}) {
  const flags = Array.isArray(contract.risk_flags) ? contract.risk_flags : [];
  for (const flag of flags) if (!RISK_FLAG_SET.has(flag)) errors.push(`unknown risk flag: ${flag}`);
  const has = (flag) => flags.includes(flag);

  if (has("runtime_concurrency")) {
    const c = contract.concurrency;
    if (!c || typeof c !== "object" || Array.isArray(c)) errors.push("runtime_concurrency flag requires a concurrency section");
    else {
      if (!hasText(c.atomic_primitive)) errors.push("concurrency.atomic_primitive is required");
      else if (!CONCURRENCY_ATOMIC_PRIMITIVES.has(normalizedPrimitive(c.atomic_primitive))) errors.push(`concurrency.atomic_primitive must name a real atomic primitive (one of ${[...CONCURRENCY_ATOMIC_PRIMITIVES].join(", ")}), got: ${c.atomic_primitive}`);
      if (!hasText(c.owner_key)) errors.push("concurrency.owner_key is required");
      if (!hasText(c.concurrent_invoke_behavior)) errors.push("concurrency.concurrent_invoke_behavior is required");
      else if (CHECK_THEN_WRITE_RE.test(normalizeProse(c.concurrent_invoke_behavior))) errors.push("concurrency.concurrent_invoke_behavior describes a check-then-write / exists-then-create race under runtime_concurrency (WI-542 shape) — use an atomic primitive instead");
      if (!hasText(c.stale_lock_cleanup)) errors.push("concurrency.stale_lock_cleanup is required");
      if (!hasText(c.concurrency_test)) errors.push("concurrency.concurrency_test is required");
      else if (!futurePaths.has(c.concurrency_test) && !concurrencyTestExists(c.concurrency_test, root)) errors.push("concurrency.concurrency_test must name an existing test file, not a placeholder such as none");
    }
  } else if (contract.concurrency !== undefined) {
    errors.push("plan-contract.concurrency is present without the runtime_concurrency flag — plan-contract.json grows only matched sections");
  }

  if (has("external_state_writer") || has("idempotent_rewriter")) {
    const w = contract.external_writer;
    if (!w || typeof w !== "object" || Array.isArray(w)) errors.push("external_state_writer/idempotent_rewriter flags require an external_writer section");
    else {
      if (!hasText(w.immutable_baseline)) errors.push("external_writer.immutable_baseline is required");
      if (!hasText(w.rolling_rollback)) errors.push("external_writer.rolling_rollback is required");
      if (hasText(w.immutable_baseline) && hasText(w.rolling_rollback)) {
        const norm = (value) => path.posix.normalize(String(value).trim().replace(/^\.\//, "").replace(/\/+/g, "/"));
        if (norm(w.immutable_baseline) === norm(w.rolling_rollback)) {
          errors.push("external_writer.immutable_baseline and external_writer.rolling_rollback name the same path — one backup path cannot serve as both the immutable baseline and the rolling rollback (WI-542 shape)");
        }
      }
      if (!hasText(w.read_failure_policy)) errors.push("external_writer.read_failure_policy is required");
      if (!hasText(w.file_mode_preservation)) errors.push("external_writer.file_mode_preservation is required");
    }
  } else if (contract.external_writer !== undefined) {
    errors.push("plan-contract.external_writer is present without external_state_writer or idempotent_rewriter flags — plan-contract.json grows only matched sections");
  }

  if (has("lossless_rmw")) {
    const l = contract.lossless_rmw;
    const entries = l && Array.isArray(l.entry_types) ? l.entry_types : null;
    if (!entries || entries.length === 0) {
      errors.push("lossless_rmw flag requires lossless_rmw.entry_types with at least one documented entry type");
    } else {
      const seen = new Set();
      for (const entry of entries) {
        const type = entry?.type;
        if (!hasText(type)) { errors.push("lossless_rmw entry_types row is missing type"); continue; }
        if (seen.has(type)) errors.push(`lossless_rmw entry_types has a duplicate type: ${type}`);
        seen.add(type);
        if (!hasText(entry?.fixture)) { errors.push(`lossless_rmw entry type "${type}" has no fixture — "preserve user/unknown entries" requires a fixture per documented entry type (WI-542 shape)`); continue; }
        if (!futurePaths.has(entry.fixture) && !fs.existsSync(path.resolve(root, entry.fixture))) errors.push(`lossless_rmw fixture does not exist for entry type "${type}": ${entry.fixture}`);
      }
    }
  } else if (contract.lossless_rmw !== undefined) {
    errors.push("plan-contract.lossless_rmw is present without the lossless_rmw flag — plan-contract.json grows only matched sections");
  }

  if (has("idempotent_rewriter")) {
    if (!hasText(contract.idempotent_rewriter?.proof)) errors.push("idempotent_rewriter flag requires idempotent_rewriter.proof (that attempt N cannot overwrite the immutable baseline)");
  } else if (contract.idempotent_rewriter !== undefined) {
    errors.push("plan-contract.idempotent_rewriter is present without the idempotent_rewriter flag — plan-contract.json grows only matched sections");
  }
}
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

export function readPlannedFiles(manifest) {
  const rows = [];
  const section = manifest.match(/## Files Planned\r?\n([\s\S]*?)\r?\n## Task Graph/)?.[1] || "";
  for (const line of section.split("\n")) {
    if (!/^\| T\d+ \|/.test(line)) continue;
    const cells = line.split("|").map(cell => cell.trim().replaceAll("`", ""));
    for (const file of String(cells[3] || "").split(";").map(value => value.trim()).filter(Boolean)) {
      rows.push({ task: cells[1], operation: cells[2], path: file });
    }
  }
  return rows;
}

function safePlannedPath(root, relative) {
  const normalized = normalizedScope(relative);
  if (normalized.includes("*")) throw new Error(`planned file must be exact: ${relative}`);
  const canonicalRoot = fs.realpathSync(root);
  let cursor = path.resolve(root, normalized);
  while (!fs.existsSync(cursor)) {
    // A dangling symlink is not a future directory or file.
    try { if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error(`planned path has a dangling symlink: ${relative}`); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    cursor = path.dirname(cursor);
  }
  const actual = fs.realpathSync(cursor);
  if (actual !== canonicalRoot && !actual.startsWith(`${canonicalRoot}${path.sep}`)) throw new Error(`planned path escapes repository: ${relative}`);
  if (cursor !== path.resolve(root, normalized) && !fs.statSync(cursor).isDirectory()) throw new Error(`planned path parent is not a directory: ${relative}`);
  return normalized;
}

// Only explicit future files and the exact contract rollback output can be
// absent during C1. C10 separately validates the full contract and ownership.
export function planDeferredPaths(contract, { root = process.cwd() } = {}) {
  const manifest = fs.readFileSync(path.resolve(root, contract.manifest), "utf8");
  const paths = readPlannedFiles(manifest).filter(row => row.operation === "CREATE").map(row => safePlannedPath(root, row.path));
  const rolling = contract.external_writer?.rolling_rollback;
  if (hasText(rolling) && (contract.risk_flags || []).some(flag => ["external_state_writer", "idempotent_rewriter"].includes(flag))) paths.push(safePlannedPath(root, rolling));
  return new Set(paths);
}

export function validatePlanContract(contract, { root = process.cwd(), phase = "execution" } = {}) {
  const errors = [];
  if (!["plan", "execution"].includes(phase)) return ["phase must be plan or execution"];
  if (contract?.schema_version !== 1) errors.push("schema_version must be 1");
  if (!hasText(contract?.manifest)) errors.push("manifest is required");
  for (const key of ["ownership", "resource_writers", "claims", "executables"]) if (!Array.isArray(contract?.[key])) errors.push(`${key} must be an array`);
  if (!contract?.resource_review || typeof contract.resource_review !== "object" || Array.isArray(contract.resource_review)) errors.push("resource_review is required");
  if (errors.length) return errors;
  const diffBase = hasText(contract.base_sha) ? contract.base_sha : "HEAD";
  try { execFileSync("git", ["-C", root, "rev-parse", "--verify", "--end-of-options", `${diffBase}^{commit}`], { stdio: "ignore" }); }
  catch { errors.push(`base_sha is not a resolvable commit: ${diffBase}`); return errors; }

  let manifest = "";
  try { manifest = fs.readFileSync(path.resolve(root, contract.manifest), "utf8"); }
  catch { errors.push(`manifest does not exist: ${contract.manifest}`); }
  const rows = readPlannedFiles(manifest);
  const planned = new Map();
  const operations = new Map();
  const futurePaths = new Set();
  for (const row of rows) {
    if (planned.has(row.path) && planned.get(row.path) !== row.task) errors.push(`manifest path ${row.path} has multiple owners: ${planned.get(row.path)}, ${row.task}`);
    if (operations.has(row.path) && operations.get(row.path) !== row.operation) errors.push(`manifest path ${row.path} has conflicting operations`);
    planned.set(row.path, row.task); operations.set(row.path, row.operation);
    if (phase === "plan") {
      try {
        safePlannedPath(root, row.path);
        if (!["CREATE", "MODIFY", "DELETE"].includes(row.operation)) errors.push(`unknown planned operation: ${row.operation}`);
        if (row.operation === "CREATE") {
          try {
            execFileSync("git", ["-C", root, "cat-file", "-e", `${diffBase}:${row.path}`], { stdio: "ignore" });
            errors.push(`CREATE path already exists in base: ${row.path}`);
          } catch { futurePaths.add(row.path); }
        } else if (!fs.existsSync(path.resolve(root, row.path))) errors.push(`${row.operation} path does not exist: ${row.path}`);
      } catch (error) { errors.push(error.message); }
    }
  }
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
    if (hasText(executable.path) && !futurePaths.has(executable.path) && !fs.existsSync(path.resolve(root, executable.path))) errors.push(`executable does not exist: ${executable.path}`);
    let runtimeConsumer = false;
    const needles = executableNeedles(executable.path);
    for (const consumer of executable.consumers) {
      const consumerPath = typeof consumer === "string" ? consumer : consumer?.path;
      if (!hasText(consumerPath)) { errors.push(`executable ${executable.path} has malformed consumer evidence`); invalidExecutableConsumers += 1; continue; }
      const absolute = path.resolve(root, consumerPath);
      const query = typeof consumer === "object" && hasText(consumer.query) ? consumer.query : null;
      if (typeof consumer === "object" && consumer.query !== undefined && !query) {
        errors.push(`consumer ${consumerPath} has malformed query`); invalidExecutableConsumers += 1;
      }
      const futureConsumer = phase === "plan" && (futurePaths.has(consumerPath) || (operations.get(consumerPath) === "MODIFY" && query));
      let text = "";
      try { text = fs.readFileSync(absolute, "utf8"); }
      catch { if (!futurePaths.has(consumerPath)) { errors.push(`consumer does not exist: ${consumerPath}`); invalidExecutableConsumers += 1; continue; } }
      if (!futureConsumer && !(query ? text.includes(query) : needles.some((needle) => text.includes(needle)))) {
        errors.push(`consumer ${consumerPath} has no direct reference to ${executable.path}`); invalidExecutableConsumers += 1;
      }
      if (/\.(?:mjs|cjs|js|sh)$/.test(consumerPath)) runtimeConsumer = true;
    }
    if (!runtimeConsumer) { errors.push(`executable ${executable.path} has no executable consumer`); invalidExecutableConsumers += 1; }
  }
  let parityFailures = null; let changedForSafety = new Set();
  if (hasText(contract.manifest)) {
    for (const [plannedPath, task] of planned) {
      let normalized; try { normalized = normalizedScope(plannedPath); } catch (error) { errors.push(error.message); continue; }
      const matches = ownerScopes.filter((owner) => scopeMatches(owner.scope, normalized));
      if (matches.length !== 1) errors.push(`manifest path ${plannedPath} maps to ${matches.length} contract owners; expected exactly 1`);
      else if (matches[0].task !== task) errors.push(`manifest path ${plannedPath} owner mismatch: manifest=${task}, contract=${matches[0].task}`);
    }
    for (const owner of ownerScopes) if (![...planned.keys()].some((plannedPath) => { try { return scopeMatches(owner.scope, normalizedScope(plannedPath)); } catch { return false; } })) errors.push(`contract ownership scope has no manifest path: ${owner.task}:${owner.scope}`);
    try {
      const changed = phase === "execution" ? diffPaths(root, diffBase) : new Set();
      // Census/writer detection must see the FULL changeset even when parity
      // excludes volatile session state — filter a COPY for parity only.
      changedForSafety = new Set(changed);
      // WI-558: session-owned state (hooks append to .svc ledgers between and
      // during runs) is not plan-scoped. For fail-closedness the mechanism is
      // hard-restricted to the session state root: entries outside .svc/ are
      // rejected, so volatile_paths can never silence code parity, census, or
      // risky-writer detection.
      const volatilePrefixes = (Array.isArray(contract.volatile_paths) ? contract.volatile_paths.filter(hasText) : []);
      const badVolatile = volatilePrefixes.filter((prefix) => {
        const scope = normalizedScope(prefix);
        return scope !== ".svc" && !scope.startsWith(".svc/");
      });
      for (const prefix of badVolatile) errors.push(`volatile_paths entry outside the .svc/ session state root is not allowed: ${prefix}`);
      const allowedVolatile = volatilePrefixes.filter((prefix) => !badVolatile.includes(prefix));
      const isVolatile = (relativePath) => allowedVolatile.some((prefix) => {
        const scope = normalizedScope(prefix);
        return relativePath === scope || relativePath.startsWith(scope.endsWith("/") ? scope : `${scope}/`);
      });
      for (const changedPath of [...changed]) if (isVolatile(changedPath)) changed.delete(changedPath);
      for (const plannedPath of [...planned.keys()]) if (isVolatile(plannedPath)) planned.delete(plannedPath);
      const undeclared = [...changed].filter((changedPath) => !planned.has(changedPath)).sort();
      const unchanged = phase === "execution" ? [...planned.keys()].filter((plannedPath) => !changed.has(plannedPath)).sort() : [];
      parityFailures = undeclared.length + unchanged.length;
      for (const changedPath of undeclared) errors.push(`changed path is undeclared in manifest ownership table: ${changedPath}`);
      for (const plannedPath of unchanged) errors.push(`manifest path has no actual change: ${plannedPath}`);
    } catch (error) { errors.push(`cannot reconcile actual diff: ${error.message}`); }
  }

  const changedExecutables = [...changedForSafety].filter((relative) => /\.(?:[cm]?[jt]sx?|py|go|rs|sql|sh)$/.test(relative));
  const review = contract.resource_review;
  if (review.verification !== "changed-executable-census" || !Number.isInteger(review.denominator) || review.denominator < 0 || (phase === "execution" && review.denominator !== changedExecutables.length) || !hasText(review.evidence)) {
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
      if (phase === "execution" && claim.denominator !== parityFailures) errors.push(`absence claim denominator ${claim.denominator} does not match ${parityFailures ?? "unavailable"} manifest parity failures`);
    } else if (evidence.verification === "executable-consumers") {
      if (phase === "execution" && claim.denominator !== invalidExecutableConsumers) errors.push(`unused claim denominator ${claim.denominator} does not match ${invalidExecutableConsumers} invalid executable consumers`);
    } else if (hasText(evidence.verification)) {
      errors.push(`unknown claim verification: ${evidence.verification}`);
    }
  }
  validateRiskSections(contract, root, errors, { futurePaths });
  return errors;
}

export function run(argv = process.argv.slice(2)) {
  const file = argv[0];
  if (!file || file.startsWith("--")) { process.stderr.write("usage: validate-plan-contract.mjs <plan-contract.json> [root] [--phase plan|execution]\n"); return 2; }
  try {
    let rootArg; let phase = "execution"; let phaseSeen = false;
    for (let index = 1; index < argv.length; index++) {
      const arg = argv[index];
      if (arg === "--phase") {
        if (phaseSeen || !["plan", "execution"].includes(argv[index + 1])) throw new Error("--phase requires one plan|execution value and cannot be repeated");
        phaseSeen = true; phase = argv[++index];
      } else if (arg.startsWith("--") || rootArg !== undefined) throw new Error(`unexpected argument: ${arg}`);
      else rootArg = arg;
    }
    const root = path.resolve(rootArg || process.cwd());
    const contract = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
    const errors = validatePlanContract(contract, { root, phase });
    if (errors.length) { errors.forEach((e) => process.stderr.write(`[plan-contract] ${e}\n`)); return 1; }
    process.stdout.write(`PLAN CONTRACT PASS (${phase}): ${contract.ownership.length} owner streams, ${contract.claims.length} claims, ${contract.executables.length} executables\n`);
    return 0;
  } catch (error) { process.stderr.write(`[plan-contract] ${error.message}\n`); return 2; }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = run();
