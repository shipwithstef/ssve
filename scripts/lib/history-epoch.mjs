import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const HISTORY_EPOCH_PATH = "docs/specs/privacy/history-epoch.json";

function git(repoRoot, args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

export function readHistoryEpoch(repoRoot) {
  const markerPath = path.join(repoRoot, HISTORY_EPOCH_PATH);
  if (!existsSync(markerPath)) return null;
  try {
    const value = JSON.parse(readFileSync(markerPath, "utf8"));
    if (
      value?.schema_version !== 1
      || value?.history_epoch !== 2
      || value?.history_externalized !== true
      || !/^\d{4}-\d{2}-\d{2}$/.test(value?.reset_date || "")
      || !/^[0-9a-f]{40}$/.test(value?.predecessor_tip || "")
      || !/^s7an-it\/[A-Za-z0-9._-]+$/.test(value?.private_archive_repository || "")
      || !value?.path_pre_reset_commit_epoch
      || !value?.legacy_phase_graphs
    ) return null;
    return value;
  } catch {
    return null;
  }
}

export function historicalPathEpoch(repoRoot, relativePath) {
  const normalized = String(relativePath || "").replaceAll("\\", "/").replace(/^\.\//, "");
  let currentEpoch = 0;
  try {
    const latest = git(repoRoot, ["log", "-1", "--format=%H%x00%ct", "--", normalized]);
    const [latestCommit = "", epoch = "0"] = latest.split("\0");
    currentEpoch = Number(epoch) || 0;
    const rootCommit = git(repoRoot, ["rev-list", "--max-parents=0", "HEAD"]).split(/\r?\n/)[0] || "";
    const marker = readHistoryEpoch(repoRoot);
    const recorded = Number(marker?.path_pre_reset_commit_epoch?.[normalized]);
    if (latestCommit && latestCommit === rootCommit && Number.isSafeInteger(recorded) && recorded > 0) {
      return recorded;
    }
  } catch {}
  return currentEpoch;
}

export function externalizedLegacyGraphAuthority(repoRoot, relativePath, graphBytes) {
  const normalized = String(relativePath || "").replaceAll("\\", "/").replace(/^\.\//, "");
  const marker = readHistoryEpoch(repoRoot);
  const record = marker?.legacy_phase_graphs?.[normalized];
  if (!record || !/^[0-9a-f]{64}$/.test(record.sha256 || "")) return null;
  try {
    const latestCommit = git(repoRoot, ["log", "-1", "--format=%H", "--", normalized]);
    const rootCommit = git(repoRoot, ["rev-list", "--max-parents=0", "HEAD"]).split(/\r?\n/)[0] || "";
    if (!latestCommit || latestCommit !== rootCommit) return null;
    const digest = createHash("sha256").update(graphBytes).digest("hex");
    if (digest !== record.sha256) return null;
    const graph = JSON.parse(graphBytes);
    return {
      eligible: true,
      source: "externalized-history-epoch-snapshot",
      firstAddedAt: record.first_added_at,
      firstAddedCommit: record.pre_reset_snapshot_commit,
      enforcementAnchor: record.enforcement_anchor,
      snapshotCommit: record.pre_reset_snapshot_commit,
      snapshotTasks: Array.isArray(graph?.tasks) ? graph.tasks : [],
    };
  } catch {
    return null;
  }
}

export function isExternalizedHistoryRange(repoRoot, ancestor, descendant) {
  if (!/^[0-9a-f]{40}$/.test(ancestor || "") || !/^[0-9a-f]{40}$/.test(descendant || "")) return false;
  const marker = readHistoryEpoch(repoRoot);
  return Boolean(marker?.externalized_history_ranges?.some((entry) => (
    entry?.ancestor === ancestor && entry?.descendant === descendant
  )));
}
