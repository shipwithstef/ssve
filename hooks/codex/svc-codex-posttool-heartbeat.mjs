#!/usr/bin/env node
// WI-FW-HOOKS-SAFETY-01 T04/AC-5/AC-6: PostToolUse correlation adapter.
//
// A successful tool call may heartbeat ONLY through consuming the one-time
// pre-tool receipt for the same session + tool-use id + original digest.
// The heartbeat threshold-renews the EXACT authorized controller tuple and
// mirrors the v1 claim only after a successful v2 renewal of the same
// generation. Missing/replayed/expired/mismatched receipts are silent no-ops;
// failed or denied calls extend nothing. This hook can never authorize — it
// only continues authority PreToolUse already established.
import fs from "node:fs";
import path from "node:path";
import {
  consumeToolCallReceipt,
  dropConsumedReceipt,
  sweepExpiredReceipts,
  canonicalOriginalDigest,
} from "../lib/tool-call-receipt.mjs";
import {
  renewControllerIfCurrent,
  renewalDue,
  readController,
  authorityStateRoot,
} from "../lib/authority-store.mjs";
import { mutationPayload } from "./lib/codex-hook-context.mjs";

function parsePayload(raw) {
  try {
    const value = JSON.parse(String(raw || "{}"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

function field(payload, ...names) {
  for (const name of names) {
    const value = payload?.[name];
    if (value !== undefined && value !== null && String(value) !== "") return String(value);
  }
  const input = payload?.tool_input ?? payload?.toolInput ?? {};
  for (const name of names) {
    const value = input?.[name];
    if (value !== undefined && value !== null && String(value) !== "") return String(value);
  }
  return "";
}

function callSucceeded(payload) {
  const response = payload?.tool_response ?? payload?.toolResponse ?? payload?.response;
  if (payload?.success === false || payload?.error || payload?.is_error === true) return false;
  if (response && typeof response === "object") {
    if (response.success === false || response.error || response.is_error === true) return false;
    if (response.status && /^(error|failed|failure|denied|timeout|aborted|cancelled|canceled)$/i.test(String(response.status))) return false;
    if (Number.isFinite(response.exit_code) && response.exit_code !== 0) return false;
    if (Array.isArray(response.stderr_lines) && response.stderr_lines.length > 0) return false;
  }
  if (typeof response === "string" && /^\s*(error|denied|failed|failure|fatal|exception|timeout)\b/i.test(response)) return false;
  return true;
}

function emit(value) {
  process.stdout.write(`${JSON.stringify(value ?? {})}\n`);
}

async function main() {
  const payload = parsePayload(fs.readFileSync(0, "utf8"));
  // Bounded housekeeping first: stale receipts are swept safely by owner+age.
  try { sweepExpiredReceipts({ env: process.env }); } catch {}

  const sessionId = field(payload, "session_id", "sessionId");
  const toolUseId = field(payload, "tool_use_id", "toolUseId", "tool_call_id");
  const host = field(payload, "host") || process.env.SVC_HOST || "";
  if (!sessionId || !toolUseId) { emit({}); return; }

  if (!callSucceeded(payload)) {
    // EXTREV-EXEC-002: a failed call is a terminal outcome — the receipt is
    // invalidated so a later duplicated or forged success cannot correlate it.
    dropConsumedReceipt({ session_id: sessionId, tool_use_id: toolUseId, env: process.env });
    emit({ systemMessage: "svc post-tool: failure outcome recorded; no authority extension" });
    return;
  }

  // EXTREV-EXEC-001: the correlation digest is RECOMPUTED from the original
  // tool input the host echoes back — never read from an attacker-controllable
  // payload field.
  const originalDigest = canonicalOriginalDigest(mutationPayload(payload));
  const consumed = consumeToolCallReceipt({
    session_id: sessionId, tool_use_id: toolUseId, host, original_digest: originalDigest,
    env: process.env,
  });
  // Typed no-ops stay observable but can never block an already-completed
  // result nor grant anything.
  if (!consumed.ok) { emit({ systemMessage: `svc post-tool: heartbeat no-op (${consumed.reason})` }); return; }

  const leaseInfo = consumed.receipt?.lease;
  try {
    if (leaseInfo?.repo_id && leaseInfo?.wi && leaseInfo?.worktree_root && leaseInfo?.lease_id && leaseInfo?.principal) {
      const stateRoot = authorityStateRoot(leaseInfo.worktree_root, process.env);
      const current = readController({ stateRoot, repoId: leaseInfo.repo_id, wi: leaseInfo.wi });
      // EXTREV-EXEC-009: the threshold policy governs post-tool renewal too —
      // a correlated success renews ONLY when the lease is actually due.
      if (current && current.state === "active" &&
          String(current.lease_id) === String(leaseInfo.lease_id) &&
          Number(current.generation) === Number(leaseInfo.generation || 0)) {
        if (!renewalDue(current)) {
          emit({ systemMessage: "svc post-tool: heartbeat no-op (not due or not current)" });
          dropConsumedReceipt({ session_id: sessionId, tool_use_id: toolUseId, env: process.env });
          return;
        }
        // The exact authorized tuple from the receipt — never a re-derived or
        // widened identity — is what may be renewed.
        const renewed = renewControllerIfCurrent({
          stateRoot, repoId: leaseInfo.repo_id, wi: leaseInfo.wi,
          worktreeRoot: leaseInfo.worktree_root,
          principal: String(leaseInfo.principal),
          leaseId: String(leaseInfo.lease_id),
          generation: Number(leaseInfo.generation),
        });
        if (renewed.status === "renewed") {
          // v1 compatibility mirror: only after v2 success, same generation.
          try {
            const { renewClaim } = await import("../lib/wi-claim.mjs");
            await renewClaim(leaseInfo.wi, { svcDir: path.join(leaseInfo.worktree_root, ".svc") });
          } catch {}
          emit({ systemMessage: `svc post-tool: lease ${String(leaseInfo.lease_id).slice(0, 8)} renewed (generation ${leaseInfo.generation})` });
          return;
        }
        emit({ systemMessage: `svc post-tool: heartbeat no-op (${renewed.status})` });
        dropConsumedReceipt({ session_id: sessionId, tool_use_id: toolUseId, env: process.env });
        return;
      }
      emit({ systemMessage: "svc post-tool: heartbeat no-op (not due or not current)" });
      dropConsumedReceipt({ session_id: sessionId, tool_use_id: toolUseId, env: process.env });
      return;
    }
    emit({});
  } catch {
    emit({ systemMessage: "svc post-tool: heartbeat skipped" });
  }
}

main().catch(() => emit({}));
