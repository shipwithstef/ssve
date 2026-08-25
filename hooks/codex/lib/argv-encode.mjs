// WI-FW-HOOKS-SAFETY-01 T02/T01: one shell-argument encoder for decoded argv.
//
// The observation fast path classifies DECODED argv, then may re-encode a
// normalized Git argv for execution. The encoder and the lexer
// (`argv-lex.mjs`) form a closed pair with one invariant, proven by
// `assertArgvRoundTrip` and enforced in tier-1:
//
//     lexSimpleCommand(encodeSimpleCommand(argv)).argv deep-equals argv
//
// The encoder emits ONE simple command: every argument is single-quoted unless
// it is already provably inert, so no metacharacter is ever left unquoted.
// It never emits redirects, pipes, substitutions, or expansions -- the lexer
// would reject those, which fails the round trip instead of executing them.
import { lexSimpleCommand } from "./argv-lex.mjs";

const REJECT = (reason) => ({ ok: false, reason });

// A bare token is safe unquoted only when the lexer consumes it as exactly the
// same literal: no shell-active characters, no leading dash confusion beyond
// what argv position already disambiguates, and no control characters.
function isInertBare(token) {
  return typeof token === "string" && token.length > 0 && !/[\x00-\x1f\x7f]/.test(token) &&
    !/[|&;<>()`\\*?[\]{}~!#"'$ \t]/.test(token);
}

export function encodeShellArg(value) {
  const token = String(value ?? "");
  if (isInertBare(token)) return token;
  // Single-quote everything; embed each literal single quote via the POSIX
  // '"'"' splice. No character inside single quotes is ever active.
  return `'${token.replaceAll("'", `'\"'\"'`)}'`;
}

export function encodeSimpleCommand(argv) {
  if (!Array.isArray(argv) || argv.length === 0) throw new Error("encodeSimpleCommand requires a non-empty argv array");
  return argv.map((token) => encodeShellArg(typeof token === "string" ? token : String(token))).join(" ");
}

// Round-trip proof used before any normalized command is executed or accepted:
// the encoded text must lex back to EXACTLY the original argv (same count,
// same bytes, same order). Any drift is a hard failure, never best-effort.
export function assertArgvRoundTrip(argv) {
  let lexed;
  try {
    lexed = lexSimpleCommand(encodeSimpleCommand(argv));
  } catch (error) {
    return { ok: false, reason: `encoder threw: ${error.message}` };
  }
  if (!lexed.ok) return REJECT(`round-trip lex failed: ${lexed.reason}`);
  const expected = argv.map((token) => String(token));
  if (lexed.argv.length !== expected.length ||
      lexed.argv.some((token, index) => token !== expected[index])) {
    return REJECT("round-trip mismatch: redecoded argv differs from source argv");
  }
  return { ok: true, argv: expected };
}
