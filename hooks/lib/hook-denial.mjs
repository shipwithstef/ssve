// hook-denial.mjs — WI-487 actionable-denial emitter.
//
// Every blocking hook routes its denial through emitDenial so no blocking
// surface emits an anonymous `code 1` (AC-487-7). It:
//   - renders {hook_id, reason_code, cause, operation, recovery} as machine +
//     human output,
//   - writes a durable per-session receipt for stderr-swallowing hosts
//     (AC-487-7A) via the canonical enforcement-core,
//   - deduplicates by {session, hook, reason, denialStateDigest}: an identical
//     repeat SUPPRESSES OUTPUT ONLY and STILL returns the deny (AC-487-8).
//
// Re-exports denialStateDigest + the atomic-write primitive from enforcement-core
// (no own copy — F-016).

import {
  denialStateDigest,
  writeDenialReceipt,
  atomicWriteFileExclusive,
  resolveStateRoot,
} from "./enforcement-core.mjs";

export { denialStateDigest, atomicWriteFileExclusive, resolveStateRoot };

// The required diagnostic fields — an empty one is a contract violation
// (AC-487-7: an anonymous nonzero exit is a test failure).
const REQUIRED = ["hook_id", "reason_code", "cause", "operation", "recovery"];

// ---------------------------------------------------------------------------
// emitDenial(denial, opts) — the single actionable-denial surface.
//
// denial: { hook_id, reason_code, cause, operation, recovery, session_id, state? }
//   `state` (optional) supplies the enforcement-relevant fields for the digest;
//   when omitted a digest is computed from the denial identity itself.
// opts: { stream (default process.stderr), env, emit (default true) }
//
// Returns { decision:"deny", message, receipt_path, digest, deduped }.
// NEVER converts the deny into an allow; a receipt-write failure still denies.
// ---------------------------------------------------------------------------
export function emitDenial(denial = {}, opts = {}) {
  const stream = opts.stream || process.stderr;
  const missing = REQUIRED.filter((f) => !denial[f] || String(denial[f]).trim() === "");
  // A malformed denial is itself a failure — surface it loudly, still deny.
  const hook_id = denial.hook_id || "svc-unknown-hook";
  const reason_code = denial.reason_code || "SVC-DENIAL-INCOMPLETE";
  const cause = denial.cause || "denial diagnostic was incomplete";
  const operation = denial.operation || "governed operation";
  const recovery = denial.recovery || "inspect the emitting hook; a complete {hook_id,reason_code,cause,operation,recovery} diagnostic is required";
  const session_id = denial.session_id || opts.sessionId || "";

  const digestState = denial.state || {
    hook_id,
    reason_code,
    resolved_command_path: denial.resolved_command_path || "",
    effective_source: denial.effective_source || "",
    source_or_receipt_class: denial.source_or_receipt_class || "",
    target_exists: denial.target_exists === true,
    target_executable: denial.target_executable === true,
  };
  const digest = denialStateDigest(digestState);

  let receipt = { receipt_path: null, digest, deduped: false };
  try {
    receipt = writeDenialReceipt(
      { ...digestState, hook_id, reason_code, cause, operation, recovery, session_id },
      { env: opts.env }
    );
  } catch {
    receipt = { receipt_path: null, digest, deduped: false };
  }

  const lookup = receipt.receipt_path ? ` [receipt: ${receipt.receipt_path}]` : "";
  const shortMessage = `SVC DENIAL ${hook_id} ${reason_code}: ${cause} Recovery: ${recovery}${lookup}`;
  // F-009: a deduped repeat keeps the DENY but collapses the host-visible payload
  // to a stable reason code + receipt lookup path. `host_message` is what a host
  // should surface; `message` remains the full diagnostic (first occurrence).
  const hostMessage = receipt.deduped
    ? `SVC DENIAL ${hook_id} ${reason_code} (repeat; see receipt)${lookup}`
    : shortMessage;
  const machine = JSON.stringify({
    svc_denial: true,
    hook_id,
    reason_code,
    cause,
    operation,
    recovery,
    session_id,
    denial_state_digest: digest,
    receipt_path: receipt.receipt_path,
    deduped: receipt.deduped,
    incomplete_fields: missing.length ? missing : undefined,
  });

  // Dedup suppresses OUTPUT only. The deny is always returned.
  const shouldEmit = opts.emit !== false && !receipt.deduped;
  if (shouldEmit) {
    try {
      stream.write(machine + "\n");
      stream.write(shortMessage + "\n");
    } catch { /* never let output failure convert deny -> allow */ }
  }

  return {
    decision: "deny",
    hook_id,
    reason_code,
    cause,
    operation,
    recovery,
    message: shortMessage,
    host_message: hostMessage,
    machine,
    receipt_path: receipt.receipt_path,
    digest,
    deduped: receipt.deduped,
    incomplete: missing.length > 0,
  };
}

export default { emitDenial, denialStateDigest, resolveStateRoot, atomicWriteFileExclusive };
