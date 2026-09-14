#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

// WI-498: the task-graph.mjs EXECUTABLE resolves from THIS script's own install
// dir (self-located), never from the validated repo's `root` (which may be a
// consumer repo whose planted scripts/task-graph.mjs would be executed = ACE).
const SELF_TASK_GRAPH = path.join(path.dirname(fileURLToPath(import.meta.url)), "task-graph.mjs");

const TERMINAL_STATUSES = new Set([
  "verified",
  "done",
  "closed",
  "completed",
  "implemented",
  "resolved",
  "merged",
  "released",
]);

function usage() {
  console.error(
    [
      "Usage:",
      "  node scripts/validate-wave-closeout.mjs --from WI-284 --to WI-303 --expect-count 20",
      "  node scripts/validate-wave-closeout.mjs --ids WI-284,WI-285 --root /path/to/repo",
      "",
      "Options:",
      "  --root <path>              Repo root to validate. Defaults to cwd.",
      "  --from <WI-NNN> --to <WI-NNN>  Inclusive WI range.",
      "  --ids <WI-NNN,...>         Explicit WI list.",
      "  --expect-count <n>         Expected number of resolved WIs.",
      "  --evidence-root <path>     Evidence root. Defaults to docs/specs/features/test-evidence.",
      "  --lane-graph-dir <path>    Lane graph directory. Defaults to .svc.",
      "  --worktree-scope <tokens>  Extra comma-separated tokens for scoped worktree checks.",
      "  --json                     Emit machine-readable output.",
    ].join("\n")
  );
}

function failUsage(message) {
  console.error(`validate-wave-closeout: ${message}`);
  usage();
  process.exit(2);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) failUsage(`unexpected argument ${token}`);
    const key = token.slice(2);
    if (key === "json") {
      args.json = true;
      continue;
    }
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) failUsage(`missing value for --${key}`);
    args[key] = value;
    i += 1;
  }
  return args;
}

function normalizeWi(raw) {
  const match = String(raw || "").trim().match(/^(?:WI-)?(\d+)$/i);
  if (!match) failUsage(`invalid WI id: ${raw}`);
  return `WI-${match[1].padStart(3, "0")}`;
}

function wiNumber(wi) {
  return Number(wi.match(/^WI-(\d+)$/)[1]);
}

function resolveIds(args) {
  if (args.ids) {
    const ids = args.ids.split(/[,\s]+/).filter(Boolean).map(normalizeWi);
    return [...new Set(ids)];
  }
  if (!args.from || !args.to) {
    failUsage("provide either --ids or both --from and --to");
  }
  const from = normalizeWi(args.from);
  const to = normalizeWi(args.to);
  const start = wiNumber(from);
  const end = wiNumber(to);
  if (end < start) failUsage("--to must be greater than or equal to --from");
  const width = from.match(/^WI-(\d+)$/)[1].length;
  const ids = [];
  for (let n = start; n <= end; n += 1) {
    ids.push(`WI-${String(n).padStart(width, "0")}`);
  }
  return ids;
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function parseStatus(raw) {
  return String(raw || "")
    .trim()
    .split(/[\s,;()[\]—–-]/)[0]
    .toLowerCase();
}

function statusFromWiDoc(text) {
  const frontmatter = text.match(/^status:\s*(.+?)\s*$/im)?.[1];
  const markdown = text.match(/^\*\*Status:\*\*\s*(.+?)\s*$/im)?.[1];
  return parseStatus(frontmatter || markdown || "");
}

function indexRowFor(indexText, wi) {
  return indexText.match(new RegExp(`^-\\s*\\[${wi}\\].*$`, "m"))?.[0] || null;
}

function statusFromIndexRow(row) {
  const match = row.match(/status:\s*([^),\]\s]+)/i);
  return parseStatus(match?.[1] || "");
}

function walkFiles(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, predicate, out);
    } else if (entry.isFile() && predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

function normalizedKey(key) {
  return String(key || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function collectResultSignals(value, key, signals) {
  const k = normalizedKey(key);
  const failureKeys = new Set([
    "failed",
    "failures",
    "failure",
    "failedcount",
    "failurecount",
    "unexpected",
    "errors",
    "errorcount",
    "timedout",
    "timeout",
  ]);
  const passKeys = new Set([
    "passed",
    "passes",
    "passedcount",
    "passcount",
    "expected",
    "success",
    "successes",
    "total",
    "tests",
    "executed",
  ]);

  if (Array.isArray(value)) {
    if (failureKeys.has(k)) signals.failures.push(value.length);
    if (passKeys.has(k)) signals.passes.push(value.length);
    value.forEach((item) => collectResultSignals(item, "", signals));
    return;
  }

  if (value && typeof value === "object") {
    for (const [childKey, childValue] of Object.entries(value)) {
      collectResultSignals(childValue, childKey, signals);
    }
    return;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (failureKeys.has(k)) signals.failures.push(value);
    if (passKeys.has(k)) signals.passes.push(value);
    return;
  }

  if (typeof value === "boolean") {
    if (k === "ok" || k === "success" || k === "passed") {
      signals.statuses.push(value ? "passed" : "failed");
    }
    return;
  }

  if (typeof value === "string" && (k === "status" || k === "outcome" || k === "result")) {
    const status = value.trim().toLowerCase();
    if (["passed", "pass", "success", "ok", "green"].includes(status)) {
      signals.statuses.push("passed");
    }
    if (["failed", "fail", "failure", "red", "error"].includes(status)) {
      signals.statuses.push("failed");
    }
  }
}

function summarizeResultJson(filePath) {
  let parsed;
  try {
    parsed = JSON.parse(readText(filePath));
  } catch {
    return { recognized: false, zeroFail: false, reason: "not valid JSON" };
  }
  const signals = { failures: [], passes: [], statuses: [] };
  collectResultSignals(parsed, "", signals);
  const recognized =
    signals.failures.length > 0 || signals.passes.length > 0 || signals.statuses.length > 0;
  const hasFailure =
    signals.failures.some((count) => count > 0) || signals.statuses.includes("failed");
  const hasPass =
    signals.passes.some((count) => count > 0) || signals.statuses.includes("passed");
  return {
    recognized,
    zeroFail: recognized && !hasFailure && (hasPass || signals.failures.length > 0),
    failures: signals.failures,
    passes: signals.passes,
    statuses: signals.statuses,
  };
}

function newestRecognizedEvidence(dir) {
  const files = walkFiles(dir, (file) => file.endsWith(".json"));
  const candidates = files
    .map((file) => ({
      file,
      mtimeMs: fs.statSync(file).mtimeMs,
      summary: summarizeResultJson(file),
    }))
    .filter((candidate) => candidate.summary.recognized)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0] || null;
}

function validateLaneGraph(root, laneGraphDir, wi, issues) {
  const graphPath = path.join(root, laneGraphDir, `lane-tasks-${wi}.json`);
  if (!fs.existsSync(graphPath)) {
    issues.push(`${wi}: missing lane graph ${path.relative(root, graphPath)}`);
    return;
  }

  let graph;
  try {
    graph = JSON.parse(readText(graphPath));
  } catch (error) {
    issues.push(`${wi}: lane graph is invalid JSON: ${error.message}`);
    return;
  }

  if (graph.wi && graph.wi !== wi) {
    issues.push(`${wi}: lane graph wi field is ${graph.wi}`);
  }
  if (graph.status !== "completed") {
    issues.push(`${wi}: lane graph status is ${graph.status || "missing"}, expected completed`);
  }
  const tasks = Array.isArray(graph.tasks) ? graph.tasks : [];
  if (tasks.length === 0) {
    issues.push(`${wi}: lane graph has no tasks`);
  }
  for (const task of tasks) {
    if (task.status !== "completed") {
      issues.push(`${wi}: task ${task.id || "unknown"} is ${task.status || "missing"}`);
    }
  }

  const taskGraphScript = SELF_TASK_GRAPH;
  if (fs.existsSync(taskGraphScript)) {
    try {
      execFileSync(process.execPath, [taskGraphScript, "validate", graphPath], {
        cwd: root,
        stdio: "pipe",
      });
    } catch (error) {
      issues.push(`${wi}: task-graph validator failed: ${String(error.stderr || error.message).trim()}`);
    }
  }
}

function scopedWorktreeTokens(ids, extraScope) {
  const tokens = new Set();
  for (const id of ids) {
    tokens.add(id.toLowerCase());
    tokens.add(id.toLowerCase().replace("-", ""));
  }
  if (ids.length > 1) {
    tokens.add(`${ids[0].toLowerCase()}-${wiNumber(ids[ids.length - 1])}`);
  }
  if (extraScope) {
    for (const token of extraScope.split(/[,\s]+/).filter(Boolean)) {
      tokens.add(token.toLowerCase());
    }
  }
  return [...tokens].filter((token) => token.length >= 5);
}

function validateScopedWorktrees(root, ids, extraScope, issues) {
  let output = "";
  try {
    output = execFileSync("git", ["-C", root, "worktree", "list", "--porcelain"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    issues.push(`git worktree list failed: ${String(error.stderr || error.message).trim()}`);
    return;
  }

  const tokens = scopedWorktreeTokens(ids, extraScope);
  const blocks = output.split(/\n(?=worktree )/).filter(Boolean);
  const rootPath = fs.realpathSync(root);
  for (const block of blocks) {
    const worktreePath = block.match(/^worktree (.+)$/m)?.[1];
    if (!worktreePath) continue;
    let realWorktree = worktreePath;
    try {
      realWorktree = fs.realpathSync(worktreePath);
    } catch {
      // Keep the raw path; a stale worktree path is still useful evidence.
    }
    if (realWorktree === rootPath) continue;

    const haystack = block.toLowerCase();
    const matchingToken = tokens.find((token) => haystack.includes(token));
    if (matchingToken) {
      issues.push(`scoped worktree remains for token ${matchingToken}: ${block.replace(/\n/g, " | ")}`);
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(args.root || process.cwd());
  const ids = resolveIds(args);
  const expectedCount = args["expect-count"] == null ? null : Number(args["expect-count"]);
  if (expectedCount != null && (!Number.isInteger(expectedCount) || expectedCount < 0)) {
    failUsage("--expect-count must be a non-negative integer");
  }
  const evidenceRoot = args["evidence-root"] || "docs/specs/features/test-evidence";
  const laneGraphDir = args["lane-graph-dir"] || ".svc";
  const issues = [];
  const checked = {
    root,
    ids,
    evidence_root: evidenceRoot,
    lane_graph_dir: laneGraphDir,
  };

  if (expectedCount != null && ids.length !== expectedCount) {
    issues.push(`resolved ${ids.length} WIs, expected ${expectedCount}`);
  }

  const indexPath = path.join(root, "docs/specs/work-items/INDEX.md");
  if (!fs.existsSync(indexPath)) {
    issues.push("missing docs/specs/work-items/INDEX.md");
  }
  const indexText = fs.existsSync(indexPath) ? readText(indexPath) : "";

  for (const wi of ids) {
    const wiPath = path.join(root, "docs/specs/work-items", `${wi}.md`);
    if (!fs.existsSync(wiPath)) {
      issues.push(`${wi}: missing docs/specs/work-items/${wi}.md`);
    } else {
      const status = statusFromWiDoc(readText(wiPath));
      if (!TERMINAL_STATUSES.has(status)) {
        issues.push(`${wi}: WI doc status is ${status || "missing"}, expected terminal`);
      }
    }

    const row = indexRowFor(indexText, wi);
    if (!row) {
      issues.push(`${wi}: missing INDEX.md row`);
    } else {
      const indexStatus = statusFromIndexRow(row);
      if (!TERMINAL_STATUSES.has(indexStatus)) {
        issues.push(`${wi}: INDEX.md status is ${indexStatus || "missing"}, expected terminal`);
      }
    }

    validateLaneGraph(root, laneGraphDir, wi, issues);

    const evidenceDir = path.join(root, evidenceRoot, wi);
    if (!fs.existsSync(evidenceDir)) {
      issues.push(`${wi}: missing evidence directory ${path.relative(root, evidenceDir)}`);
    } else {
      const evidence = newestRecognizedEvidence(evidenceDir);
      if (!evidence) {
        issues.push(`${wi}: no recognized JSON result artifact in ${path.relative(root, evidenceDir)}`);
      } else if (!evidence.summary.zeroFail) {
        issues.push(`${wi}: latest recognized evidence is not zero-fail: ${path.relative(root, evidence.file)}`);
      }
    }
  }

  validateScopedWorktrees(root, ids, args["worktree-scope"], issues);

  const result = {
    ok: issues.length === 0,
    checked,
    issues,
  };

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.ok) {
    console.log(`wave closeout validation: PASS (${ids.length} WIs)`);
  } else {
    console.error(`wave closeout validation: FAIL (${issues.length} issue(s))`);
    for (const issue of issues) {
      console.error(`  - ${issue}`);
    }
  }

  process.exit(result.ok ? 0 : 1);
}

main();
