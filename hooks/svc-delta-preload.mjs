#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { WI_ID_RE } from "./lib/wi-id.mjs";

const MAX_LINES = 3;
const MAX_LINE_BYTES = 1_024;
const outputFormat = process.argv.includes("--format") ? process.argv[process.argv.indexOf("--format") + 1] : "text";

function emit(text) {
  if (outputFormat === "gemini") process.stdout.write(`${JSON.stringify(text ? { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text } } : {})}\n`);
  else if (text) process.stdout.write(`${text}\n`);
}

function oneLine(value) {
  return String(value ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
}

try {
  const rawPayload = fs.readFileSync(0, "utf8").trim();
  const payload = rawPayload ? JSON.parse(rawPayload) : {};
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("invalid payload");
  const cwd = path.resolve(payload.cwd || payload.working_directory || payload.workspace?.current_dir || process.cwd());
  const rootResult = spawnSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5_000 });
  if (rootResult.status !== 0 || rootResult.error) throw new Error("not a repository");
  const repo = fs.realpathSync(rootResult.stdout.trim());
  const hookDir = path.dirname(fileURLToPath(import.meta.url));
  const indexer = path.resolve(hookDir, "../scripts/svc-wi-promotion-indexer.mjs");
  const result = spawnSync(process.execPath, [indexer, "query", "--repo", repo, "--limit", "100"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 5_000,
  });
  if (result.status !== 0 || result.error) throw new Error("promotion query failed");
  const entries = JSON.parse(result.stdout).entries;
  if (!Array.isArray(entries)) throw new Error("invalid promotion query");
  const output = entries.filter((entry) => WI_ID_RE.test(entry?.wi || "") && /^[0-9a-f]{40}$/.test(entry?.promoted_sha || "") && oneLine(entry?.summary)).slice(0, MAX_LINES).map((entry) => {
    const summary = oneLine(entry.summary);
    if (!summary) throw new Error("missing promotion summary");
    const line = `[svc delta] ${entry.wi} ${entry.promoted_sha.slice(0, 12)} — ${summary}`;
    const bytes = Buffer.from(line, "utf8");
    return bytes.length <= MAX_LINE_BYTES ? line : `${bytes.subarray(0, MAX_LINE_BYTES - 3).toString("utf8")}...`;
  });
  emit(output.join("\n"));
} catch {
  emit("");
  process.exit(0);
}
