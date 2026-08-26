// WI-FW-HOOKS-SAFETY-01 T02/AC-2 (FP-03/FP-04): one authoritative pre-tool
// decision engine. Policy modules return typed findings; ONLY this engine
// produces the typed decision envelope consumed by host adapters.
//
// Invariants implemented here:
//   - The ORIGINAL request is immutable evidence: hashed once, never mutated.
//     Normalization always yields a SEPARATE execution input.
//   - Observation is proof-based: every compound segment must decode to argv
//     through the hardened lexer and match a narrow side-effect model
//     (delegated to isReadOnlyTool so there is exactly ONE classifier).
//   - Safe Git normalization never introduces a shell-level construct: each
//     rewritten segment is re-emitted through the argv encoder and must
//     survive an encoder/lexer round trip byte-exactly (`--no-optional-locks`
//     is inserted as a Git top-level option, never as an `export VAR=...;`
//     prefix that sibling classifiers would re-read as a mutation).
import { createHash } from "node:crypto";
import fs from "node:fs";
import { lexSimpleCommand } from "../codex/lib/argv-lex.mjs";
import { encodeSimpleCommand, assertArgvRoundTrip } from "../codex/lib/argv-encode.mjs";
import {
  isReadOnlyTool, toolName, splitUnquoted, stripDevNullRedirections,
  hookContext, authorityPath,
} from "../codex/lib/codex-hook-context.mjs";

export const DECISION_ENGINE_SCHEMA_VERSION = 1;

// Git subcommands whose optional index refresh is a filesystem side effect the
// observation boundary suppresses (git-scm.com/docs/git: --no-optional-locks).
export const GIT_OPTIONAL_LOCK_SUBCOMMANDS = new Set(["status", "diff", "grep"]);

function digestPayload(payload) {
  const canonical = JSON.stringify({
    session_id: payload?.session_id ?? payload?.sessionId ?? null,
    tool_use_id: payload?.tool_use_id ?? payload?.toolUseId ?? null,
    tool_name: toolName(payload || {}),
    tool_input: payload?.tool_input ?? payload?.toolInput ?? payload?.arguments ?? payload?.args ?? {},
    cwd: payload?.cwd ?? null,
  });
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

function bashCommandOf(payload) {
  const input = payload?.tool_input ?? payload?.toolInput ?? payload?.arguments ?? payload?.args;
  if (!input || typeof input !== "object") return { input: null, key: null, command: "" };
  const key = payload.tool_input ? "tool_input" : payload.toolInput ? "toolInput" : payload.arguments ? "arguments" : "args";
  const command = String(input.command ?? input.cmd ?? "");
  return { input, key, command };
}

// Git global options that consume a following value token vs standalone flags.
// Anything unrecognized before the subcommand means we do NOT normalize —
// an unproven shape must never be rewritten.
const GIT_GLOBAL_OPTS_WITH_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--super-prefix"]);
const GIT_GLOBAL_OPTS_STANDALONE = new Set(["--bare", "--no-pager", "--paginate", "-p", "--no-replace-objects", "--literal-pathspecs"]);

function gitSubcommandIndex(rest) {
  let index = 1;
  while (index < rest.length && rest[index].startsWith("-")) {
    const token = rest[index];
    if (GIT_GLOBAL_OPTS_WITH_VALUE.has(token)) { index += 2; continue; }
    if (GIT_GLOBAL_OPTS_STANDALONE.has(token) || token.includes("=")) { index += 1; continue; }
    return -1;
  }
  return index < rest.length ? index : -1;
}

// Insert `--no-optional-locks` into one decoded git argv. Returns the new argv,
// or null when this segment does not need normalization.
function normalizeGitArgv(argv) {
  let rest = argv;
  let prefixLength = 0;
  if (rest.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(rest[0])) {
    // Delegated environment assignments are already accepted read prefixes;
    // keep them verbatim and normalize the git argv that follows.
    prefixLength = 1;
    rest = rest.slice(1);
  }
  if (!rest.length || rest[0] !== "git") return null;
  if (rest.includes("--no-optional-locks")) return null;
  // Walk recognized global options to find the subcommand position.
  const subcommandIndex = gitSubcommandIndex(rest);
  if (subcommandIndex < 0) return null;
  const subcommand = rest[subcommandIndex];
  if (!GIT_OPTIONAL_LOCK_SUBCOMMANDS.has(subcommand)) return null;
  // --no-optional-locks is itself a Git top-level option: inserting directly
  // after `git` keeps every existing global option well-formed.
  const next = [...argv];
  next.splice(prefixLength + 1, 0, "--no-optional-locks");
  return next;
}

// Build the normalized execution command for a PROVEN observation. Returns
// null when no segment requires normalization (the original bytes stay the
// execution input). Any structural doubt keeps the original command untouched
// and still allows the read — normalization must never be load-bearing for
// safety, only for avoiding Git's optional index refresh.
export function normalizeObservationCommand(command) {
  const source = String(command ?? "");
  const segments = splitUnquoted(source);
  if (!segments.length) return null;
  let normalized = source;
  let replacements = 0;
  for (const rawSegment of segments) {
    const classified = stripDevNullRedirections(rawSegment);
    if (!classified) continue;
    // EXTREV-EXEC-007: normalization must not change command semantics. The
    // stripped diagnostic-redirection suffix (2>/dev/null, 2>&1, …) is
    // re-appended byte-for-byte after the normalized argv.
    const rawTail = rawSegment.trimEnd().slice(classified.length).trim();
    const lexed = lexSimpleCommand(classified);
    if (!lexed.ok || !Array.isArray(lexed.argv) || !lexed.argv.length) continue;
    const nextArgv = normalizeGitArgv(lexed.argv);
    if (!nextArgv) continue;
    const roundTrip = assertArgvRoundTrip(nextArgv);
    if (!roundTrip.ok) return null; // fail closed to NO rewrite, never to a broken command
    const encoded = encodeSimpleCommand(nextArgv) + (rawTail ? ` ${rawTail}` : "");
    // Replace the EXACT segment text once, preserving every operator and any
    // byte outside the segment (semantics of ; | && || order are untouched).
    const index = normalized.indexOf(rawSegment);
    if (index < 0) return null;
    normalized = normalized.slice(0, index) + encoded + normalized.slice(index + rawSegment.length);
    replacements += 1;
  }
  if (!replacements) return null;
  return normalized;
}

// WI-FW-HOOKS-SAFETY-01 T03/AC-3: fresh positive prompt-authority gate for the
// ONE allowed self-heal attempt. Eligible only when the UserPromptSubmit
// authority record (a) exists, (b) belongs to THIS session and turn,
// (c) is fresh within the configured TTL window, (d) carries exactly one explicit WI,
// and (e) expresses POSITIVE work/resume/continue intent — a bare mention or a
// negated instruction is never sufficient.
// EXTREV-EXEC-003: the record must also bind the EXACT repository identity the
// mutation scope resolved to, and an unprovable turn is never eligible.
export function evaluateSelfHealAuthority(payload, env = process.env, expected = {}) {
  const ineligible = (reason_code) => ({ eligible: false, wi: null, reason_code });
  let ctx;
  try { ctx = hookContext(payload, env); } catch { return ineligible("PROMPT_AUTHORITY_UNREADABLE"); }
  if (!ctx.session_id || !ctx.session_dir) return ineligible("PROMPT_AUTHORITY_ABSENT");
  if (!String(ctx.turn_id || "")) return ineligible("TURN_UNPROVABLE");
  let document = null;
  try { document = JSON.parse(fs.readFileSync(authorityPath(ctx), "utf8")); }
  catch { return ineligible("PROMPT_AUTHORITY_ABSENT"); }
  if (!document || typeof document !== "object") return ineligible("PROMPT_AUTHORITY_MALFORMED");
  if (String(document.session_id || "") !== String(ctx.session_id)) return ineligible("PROMPT_AUTHORITY_FOREIGN_SESSION");
  if (String(document.turn_id || "") !== String(ctx.turn_id)) return ineligible("STALE_TURN");
  const ttlMinutes = Number(env.SVC_CODEX_AUTHORITY_TTL_MIN || 240);
  const recorded = Date.parse(document.recorded_at || "");
  if (!Number.isFinite(recorded) || Date.now() - recorded > Math.max(1, ttlMinutes) * 60_000) {
    return ineligible("PROMPT_AUTHORITY_EXPIRED");
  }
  const intent = String(document.continuation_intent || "none");
  if (!["resume", "continue", "finish", "complete", "end_to_end", "work_on"].includes(intent)) {
    return ineligible("INTENT_NOT_POSITIVE");
  }
  const wi = String(document.explicit_wi || "");
  if (!wi) return ineligible("NO_EXPLICIT_WI");
  const expectedRoot = String(expected.repo_root || "");
  if (!expectedRoot) return ineligible("AUTH_TUPLE_INCOMPLETE");
  try {
    if (fs.realpathSync(String(document.repo_root || "")) !== fs.realpathSync(expectedRoot)) {
      return ineligible("AUTH_TUPLE_REPO_MISMATCH");
    }
  } catch { return ineligible("AUTH_TUPLE_REPO_MISMATCH"); }
  return { eligible: true, wi, reason_code: "FRESH_POSITIVE_INTENT" };
}

// Typed decision envelope for the observation fast path. Returns null when the
// call is NOT a proven observation (the governed path owns those decisions).
// EXTREV-EXEC-008: the latency-critical quoted-`sed -n` fast path lives INSIDE
// the engine, so every call is classified by exactly ONE entry point and the
// dispatcher never re-classifies.
const ULTRA_HOT_READ = /^sed\s+-n\s+(['"])(?:\d+|\$)(?:,(?:\d+|\$))?p\1\s+[A-Za-z0-9_./~][^;&|`$<>\s]*(?:\s+(?:[012]?>\s*\/dev\/null|[012]?>&[012]))*$/;
export function evaluatePreToolObservation(payload, env = process.env) {
  void env;
  const started = Date.now();
  if (!isReadOnlyTool(payload)) return null;
  const name = toolName(payload);
  const originalDigest = digestPayload(payload);
  const base = {
    schema_version: DECISION_ENGINE_SCHEMA_VERSION,
    decision: "allow",
    classification: "observation",
    reason_code: "OBSERVATION_PROVEN",
    original_digest: originalDigest,
    authority: null,
    renewal: { status: "not_applicable" },
    policy_findings: [],
  };
  if (name !== "Bash") {
    return { ...base, execution_input: null, operation: { repo_id: null, worktree_root: null, targets: [] }, latency_ms: Date.now() - started };
  }
  const { input, key, command } = bashCommandOf(payload);
  if (!input || typeof input !== "object" || !key) {
    return { ...base, execution_input: null, operation: { repo_id: null, worktree_root: null, targets: [] }, latency_ms: Date.now() - started };
  }
  // Ultra-hot path first (identical semantics to the former dispatcher-local
  // lightRead): quoted sed line/range print with ordinary input path and
  // optional diagnostic redirection. Anything ambiguous falls through to the
  // complete argv-aware normalization below.
  if (!ULTRA_HOT_READ.test(command.trim())) {
    const normalized = normalizeObservationCommand(command);
    const nextInput = normalized && normalized !== command ? { ...input, command: normalized } : null;
    return {
      ...base,
      reason_code: nextInput ? "OBSERVATION_PROVEN_GIT_NORMALIZED" : "OBSERVATION_PROVEN",
      execution_input: nextInput,
      operation: { repo_id: null, worktree_root: null, targets: [] },
      latency_ms: Date.now() - started,
    };
  }
  return { ...base, execution_input: null, operation: { repo_id: null, worktree_root: null, targets: [] }, latency_ms: Date.now() - started };
}
