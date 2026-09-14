// WI-494 (CED-04/05): zero-dep POSIX-subset tokenizer. Replaces the lexical
// metacharacter bail in isReadOnlyTool, which classified EVERY quoted command as a
// governed mutation (WI-494 defect B, incl. `cat "my file.txt"`).
//
// Contract: this is NOT a shell. It accepts ONE simple command built from literals,
// single-quoted strings, and double-quoted strings free of expansion. It REJECTS --
// never "best-effort parses" -- every construct that could execute or redirect:
// substitution, expansion, pipes, lists, redirects, background, newlines.
// Rejection is the safe direction: a rejected read merely requires a receipt.
const REJECT = (reason) => ({ ok: false, reason });

export function lexSimpleCommand(input) {
  const src = String(input ?? "");
  if (!src.trim()) return REJECT("empty");
  if (src.length > 4096) return REJECT("oversized");
  // Control chars (incl. newline, CR, NUL) are never part of a simple command.
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(src)) return REJECT("control character");

  const argv = [];
  let cur = "";
  let has = false;          // current token exists (so `""` yields an empty arg)
  let i = 0;
  const push = () => { if (has) { argv.push(cur); cur = ""; has = false; } };

  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t") { push(); i += 1; continue; }
    // Unquoted shell-active characters: reject outright. `\` is rejected too --
    // escaping is legal shell but adds a second quoting grammar for no read-path
    // benefit, and rejecting keeps the accepted language small enough to audit.
    // WI-494 F-001 (critical): the reject set MUST cover EVERY unquoted construct a
    // real shell expands or strips before exec, or the returned argv differs from
    // what runs. Beyond control operators/redirects/substitution we therefore also
    // reject: glob (`* ? [ ]`), brace expansion (`{ }`), tilde (`~`), history (`!`),
    // and comment (`#`). Over-approximation is safe -- a rejected read costs a
    // receipt; an accepted glob/comment is a classification bypass (`cat *.md`,
    // `cat file # note`, `cat ~`). These chars are legal ONLY inside quotes, where
    // the quote branches below consume them literally.
    if (c === "|" || c === "&" || c === ";" || c === "<" || c === ">" ||
        c === "(" || c === ")" || c === "`" || c === "\\" ||
        c === "*" || c === "?" || c === "[" || c === "]" ||
        c === "{" || c === "}" || c === "~" || c === "!" || c === "#") {
      return REJECT(`unquoted shell-active character ${c}`);
    }
    if (c === "$") return REJECT("unquoted expansion");
    if (c === "'") {
      const end = src.indexOf("'", i + 1);
      if (end === -1) return REJECT("unterminated single quote");
      // Single quotes: everything literal, no expansion possible. `$` and backticks
      // inside are INERT -- this is precisely why `-o jsonpath='{.status}'` is a read.
      cur += src.slice(i + 1, end); has = true; i = end + 1; continue;
    }
    if (c === '"') {
      let j = i + 1; let body = "";
      for (;;) {
        if (j >= src.length) return REJECT("unterminated double quote");
        const d = src[j];
        if (d === '"') break;
        // Inside double quotes $ ` and \ REMAIN active in real shells -> reject.
        if (d === "$" || d === "`" || d === "\\") return REJECT("expansion inside double quotes");
        body += d; j += 1;
      }
      cur += body; has = true; i = j + 1; continue;
    }
    cur += c; has = true; i += 1;
  }
  push();
  if (!argv.length) return REJECT("no argv");
  return { ok: true, argv };
}
