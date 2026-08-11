#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import * as sqlite from "node:sqlite";
import { isDeepStrictEqual } from "node:util";
import { withStateLock, writeJsonAtomic } from "./state-io.mjs";

const SCHEMA_VERSION = 1;
const USAGE = "usage: --file <path> (--rank | --top <N>) | --promote <CAND_ID> --wi <WI_ID> | --reject <CAND_ID> --reason <reason>";
const SCORE_KEYS = ["product_impact", "growth_flywheel", "db_overhead", "security_risk"];
const TERMINAL_STATUSES = new Set(["promoted", "rejected"]);
const WI_PATTERN = /^WI-[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

function fail(message, code = 1) {
  const error = new Error(message);
  error.exitCode = code;
  throw error;
}

function parseArgs(argv) {
  if (argv.length === 1 && argv[0] === "--help") return { command: "help" };
  const values = new Map();
  const booleans = new Set();
  const valueFlags = new Set(["--file", "--top", "--promote", "--wi", "--reject", "--reason"]);
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--rank") {
      if (booleans.has(flag)) fail(`duplicate flag: ${flag}`, 2);
      booleans.add(flag);
      continue;
    }
    if (!valueFlags.has(flag)) fail(`unknown argument: ${flag}`, 2);
    if (values.has(flag)) fail(`duplicate flag: ${flag}`, 2);
    if (i + 1 >= argv.length) fail(`missing value for ${flag}`, 2);
    values.set(flag, argv[++i]);
  }

  const has = flag => values.has(flag) || booleans.has(flag);
  if (has("--file")) {
    const rank = has("--rank");
    const top = has("--top");
    if (rank === top || ["--promote", "--wi", "--reject", "--reason"].some(has)) {
      fail("--file requires exactly one of --rank or --top <N>", 2);
    }
    if (top && !/^[1-9]\d*$/.test(values.get("--top"))) fail("--top must be a positive integer", 2);
    return { command: "rank", file: values.get("--file"), limit: top ? Number(values.get("--top")) : null };
  }
  if (has("--promote")) {
    if (!has("--wi") || ["--rank", "--top", "--reject", "--reason", "--file"].some(has)) {
      fail("--promote <CAND_ID> requires --wi <WI_ID>", 2);
    }
    const wi = values.get("--wi");
    if (!WI_PATTERN.test(wi)) fail(`invalid WI ID: ${wi}`, 2);
    return { command: "promote", candidateId: values.get("--promote"), wi };
  }
  if (has("--reject")) {
    if (!has("--reason") || ["--rank", "--top", "--promote", "--wi", "--file"].some(has)) {
      fail("--reject <CAND_ID> requires --reason <reason>", 2);
    }
    const reason = values.get("--reason").trim();
    if (!reason) fail("--reason must not be blank", 2);
    return { command: "reject", candidateId: values.get("--reject"), reason };
  }
  fail(USAGE, 2);
}

function git(args, cwd, optional = false) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", optional ? "ignore" : "pipe"] }).trim();
  } catch (error) {
    if (optional) return "";
    fail(`git ${args.join(" ")} failed: ${String(error.stderr || error.message).trim()}`);
  }
}

function resolveRepositoryRoot() {
  const root = git(["rev-parse", "--show-toplevel"], process.cwd(), true) || process.cwd();
  return realpathSync(root);
}

function isContained(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

function normalizeOrigin(raw) {
  const value = raw.trim();
  if (!value) return "";
  if (path.isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value)) return "";
  if (/^[^/@\s]+@[^:\s]+:.+$/.test(value)) {
    const match = value.match(/^[^@]+@([^:]+):(.+)$/);
    const remotePath = match[2].split(/[?#]/, 1)[0].replace(/\.git$/i, "").replace(/^\/+|\/+$/g, "");
    return remotePath ? `${match[1].toLowerCase()}/${remotePath}` : "";
  }
  try {
    const url = new URL(value);
    const pathname = decodeURIComponent(url.pathname).replace(/\.git$/i, "").replace(/^\/+|\/+$/g, "");
    if (url.hostname && pathname) {
      const authority = `${url.hostname.toLowerCase()}${url.port ? `:${url.port}` : ""}`;
      return `${authority}/${pathname}`;
    }
  } catch {}
  const cleaned = value.replace(/\.git$/i, "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  return /^[A-Za-z0-9.-]+\.[A-Za-z]{2,}\/[^.][A-Za-z0-9._/-]*$/.test(cleaned) && !cleaned.split("/").includes("..") ? cleaned : "";
}

function validateProjectId(value, source) {
  if (typeof value !== "string" || !value.trim() || /[\u0000-\u001f\u007f]/.test(value)) {
    fail(`${source} must provide a non-blank control-character-free project ID`);
  }
  return value.trim();
}

function resolveProjectId(root) {
  const configPath = path.join(root, ".svc", "company-link.json");
  if (existsSync(configPath)) {
    const configReal = realpathSync(configPath);
    if (!isContained(root, configReal)) fail(".svc/company-link.json resolves outside the repository");
    const configStat = lstatSync(configReal);
    if (!configStat.isFile() || configStat.isSymbolicLink()) fail(".svc/company-link.json must be a regular non-symlink file");
    let config;
    try { config = JSON.parse(readFileSync(configReal, "utf8")); }
    catch (error) { fail(`${path.relative(root, configPath)} is invalid JSON: ${error.message}`); }
    if (!config || typeof config !== "object" || Array.isArray(config)) fail(".svc/company-link.json must contain a JSON object");
    if (Object.hasOwn(config, "app_id")) return validateProjectId(config.app_id, ".svc/company-link.json app_id");
  }
  const origin = normalizeOrigin(git(["remote", "get-url", "origin"], root, true));
  if (origin) return validateProjectId(origin, "git origin");
  return validateProjectId(path.basename(root), "repository basename");
}

function resolveContainedFile(root, input) {
  if (typeof input !== "string" || !input.trim()) fail("--file must name a repository-contained JSON file", 2);
  if (path.isAbsolute(input)) fail("--file must be repository-relative", 2);
  const lexical = path.resolve(root, input);
  if (!isContained(root, lexical)) fail(`mirror path escapes repository: ${input}`, 2);
  let real;
  try { real = realpathSync(lexical); }
  catch { fail(`mirror file does not exist: ${input}`, 2); }
  if (!isContained(root, real)) fail(`mirror path resolves outside repository: ${input}`, 2);
  if (!statSync(real).isFile()) fail(`mirror path is not a regular file: ${input}`, 2);
  return { absolute: real, relative: path.relative(root, real).split(path.sep).join("/") };
}

function validateString(value, label) {
  if (typeof value !== "string" || !value.trim()) fail(`${label} must be a non-blank string`);
  if (/[\u0000-\u001f\u007f]/.test(value)) fail(`${label} must not contain control characters`);
  return value.trim();
}

function validatePathString(value, label) {
  const normalized = validateString(value, label);
  if (value !== normalized) fail(`${label} must not have leading or trailing whitespace`);
  return value;
}

function validateMirror(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("mirror root must be an object");
  if (raw.schema_version !== "1.0.0") fail("schema_version must equal 1.0.0");
  const topic = validateString(raw.topic, "topic");
  const itemScope = validateString(raw.item_scope, "item_scope");
  if (raw.project_id !== null && raw.project_id !== undefined && typeof raw.project_id !== "string") fail("project_id must be a string or null");
  if (!Array.isArray(raw.candidates)) fail("candidates must be an array");
  const seen = new Set();
  const candidates = raw.candidates.map((candidate, index) => {
    const prefix = `candidates[${index}]`;
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) fail(`${prefix} must be an object`);
    const id = validateString(candidate.id, `${prefix}.id`);
    if (!/^CAND-[A-Z0-9_-]+$/i.test(id)) fail(`${prefix}.id has invalid format: ${id}`);
    if (seen.has(id)) fail(`duplicate candidate ID: ${id}`);
    seen.add(id);
    if (validateString(candidate.item_scope, `${id}.item_scope`) !== itemScope) fail(`${id}.item_scope must equal mirror item_scope`);
    if (!Array.isArray(candidate.target_files)) fail(`${id}.target_files must be an array`);
    const targetFiles = candidate.target_files.map((target, targetIndex) => validatePathString(target, `${id}.target_files[${targetIndex}]`));
    if (new Set(targetFiles).size !== targetFiles.length) fail(`${id}.target_files contains duplicates`);
    if (!candidate.code_grounding || typeof candidate.code_grounding !== "object" || Array.isArray(candidate.code_grounding)) fail(`${id}.code_grounding must be an object`);
    if (!Array.isArray(candidate.cos_roles) || candidate.cos_roles.length === 0) fail(`${id}.cos_roles must be a non-empty array`);
    const roles = candidate.cos_roles.map((role, roleIndex) => validateString(role, `${id}.cos_roles[${roleIndex}]`));
    if (new Set(roles).size !== roles.length) fail(`${id}.cos_roles contains duplicates`);
    if (!candidate.scores || typeof candidate.scores !== "object" || Array.isArray(candidate.scores)) fail(`${id}.scores must be an object`);
    const scoreKeys = Object.keys(candidate.scores).sort();
    if (JSON.stringify(scoreKeys) !== JSON.stringify([...SCORE_KEYS].sort())) fail(`${id}.scores must contain only ${SCORE_KEYS.join(", ")}`);
    const scores = {};
    for (const key of SCORE_KEYS) {
      const score = candidate.scores[key];
      if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 100) fail(`${id}.scores.${key} must be a finite number from 0 through 100`);
      scores[key] = score;
    }
    const status = candidate.status ?? "candidate";
    if (!["candidate", "promoted", "rejected"].includes(status)) fail(`${id}.status is invalid`);
    if (status === "promoted" && !WI_PATTERN.test(candidate.promoted_wi || "")) fail(`${id}.promoted_wi is required for promoted status`);
    if (status === "rejected" && (typeof candidate.rejection_reason !== "string" || !candidate.rejection_reason.trim())) fail(`${id}.rejection_reason is required for rejected status`);
    if (status === "candidate" && (candidate.promoted_wi != null || candidate.rejection_reason != null)) fail(`${id}.candidate status cannot carry terminal decision fields`);
    if (status === "promoted" && candidate.rejection_reason != null) fail(`${id}.promoted status cannot carry rejection_reason`);
    if (status === "rejected" && candidate.promoted_wi != null) fail(`${id}.rejected status cannot carry promoted_wi`);
    return {
      id,
      title: validateString(candidate.title, `${id}.title`),
      summary: validateString(candidate.summary, `${id}.summary`),
      workType: validateString(candidate.work_type, `${id}.work_type`),
      itemScope,
      targetFiles,
      codeGrounding: candidate.code_grounding,
      roles,
      scores,
      status,
      promotedWi: status === "promoted" ? candidate.promoted_wi : null,
      rejectionReason: status === "rejected" ? candidate.rejection_reason.trim() : null,
    };
  });
  return {
    schemaVersion: raw.schema_version,
    topic,
    sourceProjectId: typeof raw.project_id === "string" && raw.project_id.trim() ? raw.project_id.trim() : null,
    itemScope,
    candidates,
  };
}

function readAndValidateMirror(file) {
  let parsed;
  try { parsed = JSON.parse(readFileSync(file, "utf8")); }
  catch (error) { fail(`invalid mirror JSON: ${error.message}`); }
  return validateMirror(parsed);
}

function statePaths(root) {
  const stateDir = process.env.SVC_STATE_DIR ? path.resolve(process.env.SVC_STATE_DIR) : path.join(homedir(), ".svc");
  const decisionsOverride = process.env.SVC_CANDIDATE_DECISIONS;
  return {
    database: path.resolve(process.env.SVC_CANDIDATE_DB || path.join(stateDir, "store.db")),
    decisions: path.resolve(decisionsOverride || path.join(root, ".svc", "pipeline-decisions.jsonl")),
    decisionsContainmentRoot: decisionsOverride ? null : root,
  };
}

function prepareStateFile(filePath, label, containmentRoot = null) {
  const parent = path.dirname(filePath);
  mkdirSync(parent, { recursive: true, mode: 0o700 });
  const parentReal = realpathSync(parent);
  if (containmentRoot && !isContained(containmentRoot, parentReal)) {
    fail(`${label} parent resolves outside the repository`);
  }
  const existed = existsSync(filePath);
  if (existed) {
    const fileStat = lstatSync(filePath);
    if (!fileStat.isFile() || fileStat.isSymbolicLink()) fail(`${label} must be a regular non-symlink file`);
    const fileReal = realpathSync(filePath);
    if (containmentRoot && !isContained(containmentRoot, fileReal)) {
      fail(`${label} resolves outside the repository`);
    }
  }
  return existed;
}

function openDatabase(databasePath) {
  const { DatabaseSync } = sqlite;
  if (typeof DatabaseSync !== "function") fail("Candidate Harness requires Node.js 22+ with native node:sqlite DatabaseSync support");
  const databaseDir = path.dirname(databasePath);
  mkdirSync(databaseDir, { recursive: true, mode: 0o700 });
  chmodSync(realpathSync(databaseDir), 0o700);
  if (existsSync(databasePath)) {
    const databaseStat = lstatSync(databasePath);
    if (!databaseStat.isFile() || databaseStat.isSymbolicLink()) fail("candidate database path must be a regular non-symlink file");
  }
  const db = new DatabaseSync(databasePath);
  chmodSync(databasePath, 0o600);
  db.exec("PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
  db.exec("BEGIN IMMEDIATE");
  try {
    const managedTables = new Set(db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name IN ('candidate_schema','candidates','candidate_decision_outbox')
    `).all().map(row => row.name));
    if (managedTables.size !== 0 && managedTables.size !== 3) {
      fail(`candidate database schema is partial: found ${[...managedTables].sort().join(", ")}`);
    }
    db.exec(`
      CREATE TABLE IF NOT EXISTS candidate_schema (
        component TEXT PRIMARY KEY,
        version INTEGER NOT NULL,
        migrated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS candidates (
        project_id TEXT NOT NULL,
        item_scope TEXT NOT NULL,
        candidate_id TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        work_type TEXT NOT NULL,
        target_files_json TEXT NOT NULL,
        code_grounding_json TEXT NOT NULL,
        cos_roles_json TEXT NOT NULL,
        product_impact REAL NOT NULL CHECK(product_impact BETWEEN 0 AND 100),
        growth_flywheel REAL NOT NULL CHECK(growth_flywheel BETWEEN 0 AND 100),
        db_overhead REAL NOT NULL CHECK(db_overhead BETWEEN 0 AND 100),
        security_risk REAL NOT NULL CHECK(security_risk BETWEEN 0 AND 100),
        status TEXT NOT NULL CHECK(status IN ('candidate','promoted','rejected')),
        promoted_wi TEXT,
        rejection_reason TEXT,
        source_mirror TEXT NOT NULL,
        imported_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(project_id, item_scope, candidate_id),
        CHECK((status='candidate' AND promoted_wi IS NULL AND rejection_reason IS NULL)
           OR (status='promoted' AND promoted_wi IS NOT NULL AND rejection_reason IS NULL)
           OR (status='rejected' AND promoted_wi IS NULL AND rejection_reason IS NOT NULL))
      );
      CREATE INDEX IF NOT EXISTS candidates_lookup
        ON candidates(project_id, candidate_id, item_scope);
      CREATE TABLE IF NOT EXISTS candidate_decision_outbox (
        event_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        item_scope TEXT NOT NULL,
        candidate_id TEXT NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('promote','reject')),
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        logged_at TEXT,
        FOREIGN KEY(project_id, item_scope, candidate_id)
          REFERENCES candidates(project_id, item_scope, candidate_id)
      );
    `);
    const schema = db.prepare("SELECT version FROM candidate_schema WHERE component = ?").get("candidate-reservoir");
    if (schema && schema.version > SCHEMA_VERSION) fail(`candidate database schema ${schema.version} is newer than supported ${SCHEMA_VERSION}`);
    if (schema && schema.version < SCHEMA_VERSION) fail(`candidate database schema ${schema.version} has no defined migration to ${SCHEMA_VERSION}`);
    if (!schema && managedTables.size !== 0) fail("pre-existing candidate tables have no supported schema registration");
    const migratedAt = new Date().toISOString();
    if (!schema) {
      db.prepare("INSERT INTO candidate_schema(component,version,migrated_at) VALUES(?,?,?)").run("candidate-reservoir", SCHEMA_VERSION, migratedAt);
    }
    const requiredColumns = {
      candidate_schema: {
        component: ["TEXT", 0, 1], version: ["INTEGER", 1, 0], migrated_at: ["TEXT", 1, 0],
      },
      candidates: {
        project_id: ["TEXT", 1, 1], item_scope: ["TEXT", 1, 2], candidate_id: ["TEXT", 1, 3],
        title: ["TEXT", 1, 0], summary: ["TEXT", 1, 0], work_type: ["TEXT", 1, 0],
        target_files_json: ["TEXT", 1, 0], code_grounding_json: ["TEXT", 1, 0], cos_roles_json: ["TEXT", 1, 0],
        product_impact: ["REAL", 1, 0], growth_flywheel: ["REAL", 1, 0], db_overhead: ["REAL", 1, 0],
        security_risk: ["REAL", 1, 0], status: ["TEXT", 1, 0], promoted_wi: ["TEXT", 0, 0],
        rejection_reason: ["TEXT", 0, 0], source_mirror: ["TEXT", 1, 0], imported_at: ["TEXT", 1, 0],
        updated_at: ["TEXT", 1, 0],
      },
      candidate_decision_outbox: {
        event_id: ["TEXT", 0, 1], project_id: ["TEXT", 1, 0], item_scope: ["TEXT", 1, 0],
        candidate_id: ["TEXT", 1, 0], action: ["TEXT", 1, 0], payload_json: ["TEXT", 1, 0],
        created_at: ["TEXT", 1, 0], logged_at: ["TEXT", 0, 0],
      },
    };
    for (const [table, columns] of Object.entries(requiredColumns)) {
      const present = new Map(db.prepare(`PRAGMA table_info(${table})`).all().map(column => [column.name, column]));
      const missing = Object.keys(columns).filter(column => !present.has(column));
      if (missing.length) fail(`candidate database schema ${SCHEMA_VERSION} is incompatible: ${table} missing ${missing.join(", ")}`);
      const wrongShape = Object.entries(columns)
        .filter(([column, [type, notnull, pk]]) => {
          const actual = present.get(column);
          return String(actual.type).toUpperCase() !== type || actual.notnull !== notnull || actual.pk !== pk;
        })
        .map(([column, [type, notnull, pk]]) => {
          const actual = present.get(column);
          return `${column}:${actual.type || "<none>"}/${actual.notnull}/${actual.pk}!=${type}/${notnull}/${pk}`;
        });
      if (wrongShape.length) fail(`candidate database schema ${SCHEMA_VERSION} is incompatible: ${table} shape ${wrongShape.join(", ")}`);
    }
    // CREATE TABLE formatting and these fragments are one v1 compatibility contract.
    const normalizeDdl = sql => sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\s+/g, " ").toLowerCase();
    const candidatesSql = normalizeDdl(db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='candidates'").get().sql);
    for (const fragment of [
      "primary key(project_id, item_scope, candidate_id)",
      "product_impact between 0 and 100",
      "growth_flywheel between 0 and 100",
      "db_overhead between 0 and 100",
      "security_risk between 0 and 100",
      "status in ('candidate','promoted','rejected')",
      "status='candidate' and promoted_wi is null and rejection_reason is null",
    ]) if (!candidatesSql.includes(fragment)) fail(`candidate database schema ${SCHEMA_VERSION} is incompatible: candidates missing constraint ${fragment}`);
    const outboxSql = normalizeDdl(db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='candidate_decision_outbox'").get().sql);
    if (!outboxSql.includes("action in ('promote','reject')") || !outboxSql.includes("foreign key(project_id, item_scope, candidate_id)")) {
      fail(`candidate database schema ${SCHEMA_VERSION} is incompatible: outbox constraints missing`);
    }
    if (db.prepare("PRAGMA foreign_key_list(candidate_decision_outbox)").all().length !== 3) fail("candidate database schema 1 is incompatible: outbox foreign key missing");
    if (!db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='candidates_lookup'").get()) fail("candidate database schema 1 is incompatible: lookup index missing");
    db.exec("COMMIT");
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch {}
    db.close();
    throw error;
  }
  return db;
}

// OPT-05: concurrent subagents opening the same SQLite file can collide on
// BEGIN IMMEDIATE (SQLITE_BUSY). Retry a bounded number of times with a short
// fixed backoff before giving up — immutable local state, no correctness cost.
const SQLITE_BUSY_RETRIES = 5;
const SQLITE_BUSY_BACKOFF_MS = 50;

function isSqliteBusy(error) {
  return /SQLITE_BUSY/i.test(String(error?.message || error));
}

function transaction(db, work) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      db.exec("BEGIN IMMEDIATE");
    } catch (error) {
      if (isSqliteBusy(error) && attempt < SQLITE_BUSY_RETRIES) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, SQLITE_BUSY_BACKOFF_MS);
        continue;
      }
      throw error;
    }
    try {
      const result = work();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch {}
      throw error;
    }
  }
}

function importCandidates(db, projectId, mirror, sourceMirror) {
  const now = new Date().toISOString();
  const statement = db.prepare(`
    INSERT INTO candidates (
      project_id,item_scope,candidate_id,title,summary,work_type,target_files_json,
      code_grounding_json,cos_roles_json,product_impact,growth_flywheel,db_overhead,
      security_risk,status,promoted_wi,rejection_reason,source_mirror,imported_at,updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(project_id,item_scope,candidate_id) DO UPDATE SET
      title=excluded.title,
      summary=excluded.summary,
      work_type=excluded.work_type,
      target_files_json=excluded.target_files_json,
      code_grounding_json=excluded.code_grounding_json,
      cos_roles_json=excluded.cos_roles_json,
      product_impact=excluded.product_impact,
      growth_flywheel=excluded.growth_flywheel,
      db_overhead=excluded.db_overhead,
      security_risk=excluded.security_risk,
      status=candidates.status,
      promoted_wi=candidates.promoted_wi,
      rejection_reason=candidates.rejection_reason,
      source_mirror=excluded.source_mirror,
      imported_at=excluded.imported_at,
      updated_at=excluded.updated_at
  `);
  const existingSource = db.prepare(`
    SELECT source_mirror FROM candidates
    WHERE project_id = ? AND item_scope = ? AND candidate_id = ?
  `);
  const existingScopes = db.prepare(`
    SELECT DISTINCT item_scope FROM candidates
    WHERE project_id = ? AND source_mirror = ?
    ORDER BY item_scope
  `);
  transaction(db, () => {
    const boundScopes = existingScopes.all(projectId, sourceMirror).map(row => row.item_scope);
    if (boundScopes.some(scope => scope !== mirror.itemScope)) {
      fail(`mirror ${sourceMirror} is already bound to item_scope ${boundScopes.join(", ")}; re-scoping to ${mirror.itemScope} is refused`);
    }
    for (const candidate of mirror.candidates) {
      const existing = existingSource.get(projectId, mirror.itemScope, candidate.id);
      if (existing && existing.source_mirror !== sourceMirror) {
        fail(`${candidate.id} already belongs to mirror ${existing.source_mirror}; cross-mirror reassignment refused`);
      }
      statement.run(
        projectId,
        mirror.itemScope,
        candidate.id,
        candidate.title,
        candidate.summary,
        candidate.workType,
        JSON.stringify(candidate.targetFiles),
        JSON.stringify(candidate.codeGrounding),
        JSON.stringify(candidate.roles),
        candidate.scores.product_impact,
        candidate.scores.growth_flywheel,
        candidate.scores.db_overhead,
        candidate.scores.security_risk,
        candidate.status,
        candidate.promotedWi,
        candidate.rejectionReason,
        sourceMirror,
        now,
        now,
      );
    }
  });
}

// OPT-04: target-path validity is invariant per script run (same root, same
// filesystem snapshot) — cache it across candidates so repeated target_files
// across rows in one --rank invocation skip redundant lstatSync/realpathSync.
const groundingValidityCache = new Map();

function grounding(root, targetFiles) {
  const invalidTargets = [];
  let validCount = 0;
  for (const target of targetFiles) {
    let valid;
    if (groundingValidityCache.has(target)) {
      valid = groundingValidityCache.get(target);
    } else {
      valid = false;
      if (!path.isAbsolute(target)) {
        const lexical = path.resolve(root, target);
        if (isContained(root, lexical)) {
          try {
            lstatSync(lexical);
            const real = realpathSync(lexical);
            const stat = statSync(real);
            valid = isContained(root, real) && (stat.isFile() || stat.isDirectory());
          } catch {}
        }
      }
      groundingValidityCache.set(target, valid);
    }
    if (valid) validCount += 1;
    else invalidTargets.push(target);
  }
  const totalCount = targetFiles.length;
  const codeGrounding = totalCount === 0 ? 0 : (validCount / totalCount) * 100;
  return { validCount, totalCount, codeGrounding, invalidTargets };
}

function composite(scores, codeGrounding) {
  return (0.35 * scores.product_impact)
    + (0.25 * codeGrounding)
    + (0.20 * scores.growth_flywheel)
    - (0.10 * scores.db_overhead)
    - (0.10 * scores.security_risk);
}

function decodeRow(root, row) {
  const targetFiles = JSON.parse(row.target_files_json);
  const codeGroundingMetadata = JSON.parse(row.code_grounding_json);
  const roles = JSON.parse(row.cos_roles_json);
  const scores = {
    product_impact: row.product_impact,
    growth_flywheel: row.growth_flywheel,
    db_overhead: row.db_overhead,
    security_risk: row.security_risk,
  };
  const ground = grounding(root, targetFiles);
  return {
    id: row.candidate_id,
    title: row.title,
    summary: row.summary,
    workType: row.work_type,
    itemScope: row.item_scope,
    targetFiles,
    codeGroundingMetadata,
    roles,
    scores,
    status: row.status,
    promotedWi: row.promoted_wi,
    rejectionReason: row.rejection_reason,
    sourceMirror: row.source_mirror,
    ...ground,
    composite: composite(scores, ground.codeGrounding),
  };
}

function rankedRows(db, root, projectId, itemScope, sourceMirror) {
  const rows = db.prepare(`
    SELECT * FROM candidates
    WHERE project_id = ? AND item_scope = ? AND source_mirror = ?
  `).all(projectId, itemScope, sourceMirror).map(row => decodeRow(root, row));
  rows.sort((a, b) => (b.composite - a.composite) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return rows;
}

function mirrorCandidate(candidate) {
  const output = {
    id: candidate.id,
    title: candidate.title,
    summary: candidate.summary,
    work_type: candidate.workType,
    item_scope: candidate.itemScope,
    target_files: candidate.targetFiles,
    code_grounding: {
      ...candidate.codeGroundingMetadata,
      valid_count: candidate.validCount,
      total_count: candidate.totalCount,
      ratio: `${candidate.validCount}/${candidate.totalCount}`,
      invalid_targets: candidate.invalidTargets,
    },
    cos_roles: candidate.roles,
    scores: candidate.scores,
    composite_score: Number(candidate.composite.toFixed(2)),
    status: candidate.status,
  };
  if (candidate.status === "promoted") output.promoted_wi = candidate.promotedWi;
  if (candidate.status === "rejected") output.rejection_reason = candidate.rejectionReason;
  return output;
}

function exportMirror(db, root, projectId, itemScope, sourceMirror) {
  const destination = resolveContainedFile(root, sourceMirror);
  let existing;
  try { existing = JSON.parse(readFileSync(destination.absolute, "utf8")); }
  catch (error) { fail(`cannot export mirror ${sourceMirror}: ${error.message}`); }
  const rows = rankedRows(db, root, projectId, itemScope, sourceMirror).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  writeJsonAtomic(destination.absolute, {
    schema_version: "1.0.0",
    topic: typeof existing.topic === "string" && existing.topic.trim() ? existing.topic : path.basename(sourceMirror, ".json"),
    project_id: existing.project_id == null || (typeof existing.project_id === "string" && !existing.project_id.trim()) ? null : projectId,
    item_scope: itemScope,
    candidates: rows.map(mirrorCandidate),
  });
}

function printRows(rows, limit) {
  const shown = limit === null ? rows : rows.slice(0, limit);
  for (const [index, row] of shown.entries()) {
    process.stdout.write([
      index + 1,
      row.id,
      `composite=${row.composite.toFixed(2)}`,
      `grounding=${row.validCount}/${row.totalCount}`,
      `product_impact=${row.scores.product_impact.toFixed(2)}`,
      `code_grounding=${row.codeGrounding.toFixed(2)}`,
      `growth_flywheel=${row.scores.growth_flywheel.toFixed(2)}`,
      `db_overhead=${row.scores.db_overhead.toFixed(2)}`,
      `security_risk=${row.scores.security_risk.toFixed(2)}`,
      `work_type=${row.workType}`,
      `cos_roles=${row.roles.join(",")}`,
      `status=${row.status}`,
      `invalid_targets=${row.invalidTargets.length ? row.invalidTargets.join(",") : "-"}`,
    ].join("\t") + "\n");
  }
}

function stableEventId(fields) {
  return createHash("sha256").update(JSON.stringify(fields), "utf8").digest("hex");
}

function appendEventOnce(decisionsPath, payload, containmentRoot) {
  const ledgerExisted = prepareStateFile(decisionsPath, "candidate decision ledger", containmentRoot);
  withStateLock(decisionsPath, () => {
    const known = new Map();
    if (existsSync(decisionsPath)) {
      const decisionStat = lstatSync(decisionsPath);
      if (!decisionStat.isFile() || decisionStat.isSymbolicLink()) fail("candidate decision ledger must be a regular non-symlink file");
      const lines = readFileSync(decisionsPath, "utf8").split(/\r?\n/).filter(Boolean);
      for (const [index, line] of lines.entries()) {
        let event;
        try { event = JSON.parse(line); }
        catch (error) { fail(`${decisionsPath}:${index + 1} is invalid JSONL: ${error.message}`); }
        if (event.event_id) {
          if (known.has(event.event_id) && !isDeepStrictEqual(known.get(event.event_id), event)) {
            fail(`${decisionsPath}:${index + 1} conflicts with an earlier ${event.event_id} event`);
          }
          known.set(event.event_id, event);
        }
      }
    }
    if (!known.has(payload.event_id)) {
      mkdirSync(path.dirname(decisionsPath), { recursive: true, mode: 0o700 });
      appendFileSync(decisionsPath, `${JSON.stringify(payload)}\n`, "utf8");
      if (!ledgerExisted) chmodSync(decisionsPath, 0o600);
    } else if (!isDeepStrictEqual(known.get(payload.event_id), payload)) {
      fail(`${decisionsPath} contains conflicting payload for event ${payload.event_id}`);
    }
  });
}

function flushOutbox(db, decisionsPath, decisionsContainmentRoot, projectId) {
  const pending = db.prepare(`
    SELECT event_id,payload_json FROM candidate_decision_outbox
    WHERE project_id = ? AND logged_at IS NULL
    ORDER BY created_at,event_id
  `).all(projectId);
  const mark = db.prepare("UPDATE candidate_decision_outbox SET logged_at = ? WHERE event_id = ? AND logged_at IS NULL");
  for (const row of pending) {
    const payload = JSON.parse(row.payload_json);
    appendEventOnce(decisionsPath, payload, decisionsContainmentRoot);
    transaction(db, () => mark.run(new Date().toISOString(), row.event_id));
  }
}

function terminalTransition(db, root, projectId, decisionsPath, decisionsContainmentRoot, command) {
  const nextStatus = command.command === "promote" ? "promoted" : "rejected";
  const update = db.prepare(`
    UPDATE candidates
    SET status = ?, promoted_wi = ?, rejection_reason = ?, updated_at = ?
    WHERE project_id = ? AND item_scope = ? AND candidate_id = ? AND status = 'candidate'
  `);
  const outbox = db.prepare(`
    INSERT INTO candidate_decision_outbox(event_id,project_id,item_scope,candidate_id,action,payload_json,created_at,logged_at)
    VALUES(?,?,?,?,?,?,?,NULL) ON CONFLICT(event_id) DO NOTHING
  `);
  const current = transaction(db, () => {
    const matches = db.prepare("SELECT * FROM candidates WHERE project_id = ? AND candidate_id = ? ORDER BY item_scope").all(projectId, command.candidateId);
    if (matches.length === 0) fail(`candidate not found for project ${projectId}: ${command.candidateId}`);
    if (matches.length > 1) fail(`candidate is ambiguous across item scopes: ${command.candidateId}`);
    const selected = matches[0];
    const sameDecision = selected.status === nextStatus
      && (nextStatus === "promoted" ? selected.promoted_wi === command.wi : selected.rejection_reason === command.reason);
    if (TERMINAL_STATUSES.has(selected.status)) {
      if (!sameDecision) fail(`candidate already ${selected.status}; conflicting transition refused`);
      return selected;
    }

    const identity = {
      schema_version: SCHEMA_VERSION,
      project_id: projectId,
      item_scope: selected.item_scope,
      candidate_id: selected.candidate_id,
      action: command.command,
      status: nextStatus,
      promoted_wi: command.command === "promote" ? command.wi : null,
      reason: command.command === "reject" ? command.reason : null,
    };
    const eventId = stableEventId(identity);
    const timestamp = new Date().toISOString();
    const payload = {
      timestamp,
      event_id: eventId,
      run_id: `candidate:${projectId}:${selected.item_scope}`,
      skill: "candidate-harness",
      phase: 1,
      type: "mechanical",
      decision: `${command.command} ${selected.candidate_id}`,
      reasoning: command.command === "promote" ? `Promoted to ${command.wi}` : command.reason,
      decided_by: "P0",
      overrideable: false,
      ...identity,
    };
    const result = update.run(
      nextStatus,
      command.command === "promote" ? command.wi : null,
      command.command === "reject" ? command.reason : null,
      timestamp,
      projectId,
      selected.item_scope,
      selected.candidate_id,
    );
    if (result.changes !== 1) fail("candidate transition failed inside the write transaction");
    outbox.run(eventId, projectId, selected.item_scope, selected.candidate_id, command.command, JSON.stringify(payload), timestamp);
    return selected;
  });
  flushOutbox(db, decisionsPath, decisionsContainmentRoot, projectId);
  exportMirror(db, root, projectId, current.item_scope, current.source_mirror);
}

function main() {
  const command = parseArgs(process.argv.slice(2));
  if (command.command === "help") {
    process.stdout.write(`${USAGE}\n`);
    return;
  }
  const root = resolveRepositoryRoot();
  const projectId = resolveProjectId(root);
  const paths = statePaths(root);
  let db;
  try {
    if (command.command === "rank") {
      const file = resolveContainedFile(root, command.file);
      const mirror = readAndValidateMirror(file.absolute);
      if (mirror.sourceProjectId && mirror.sourceProjectId !== projectId) {
        fail(`mirror project_id ${mirror.sourceProjectId} does not match resolved project ${projectId}`);
      }
      db = openDatabase(paths.database);
      flushOutbox(db, paths.decisions, paths.decisionsContainmentRoot, projectId);
      importCandidates(db, projectId, mirror, file.relative);
      const rows = rankedRows(db, root, projectId, mirror.itemScope, file.relative);
      exportMirror(db, root, projectId, mirror.itemScope, file.relative);
      printRows(rows, command.limit);
      return;
    }
    db = openDatabase(paths.database);
    terminalTransition(db, root, projectId, paths.decisions, paths.decisionsContainmentRoot, command);
  } finally {
    try { db?.close(); } catch {}
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`candidate-harness: ${error.message}\n`);
  process.exitCode = Number.isInteger(error.exitCode) ? error.exitCode : 1;
}
