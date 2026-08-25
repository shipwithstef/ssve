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
import { lexSimpleCommand } from "../codex/lib/argv-lex.mjs";
import { encodeSimpleCommand, assertArgvRoundTrip } from "../codex/lib/argv-encode.mjs";
import { isReadOnlyTool, toolName, splitUnquoted, stripDevNullRedirections } from "../codex/lib/codex-hook-context.mjs";

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
    const lexed = lexSimpleCommand(classified);
    if (!lexed.ok || !Array.isArray(lexed.argv) || !lexed.argv.length) continue;
    const nextArgv = normalizeGitArgv(lexed.argv);
    if (!nextArgv) continue;
    const roundTrip = assertArgvRoundTrip(nextArgv);
    if (!roundTrip.ok) return null; // fail closed to NO rewrite, never to a broken command
    const encoded = encodeSimpleCommand(nextArgv);
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

// Typed decision envelope for the observation fast path. Returns null when the
// call is NOT a proven observation (the governed path owns those decisions).
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
