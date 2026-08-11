#!/usr/bin/env node
// WI-501 EG-02 corpus — exercises the PURE classifier in-process.
// Kept as a real module (not an inline `node -e`) because the corpus contains single
// quotes, backticks and `$` by design: those ARE the dequoting bypass vectors, and
// embedding them in a shell string is how the first version silently broke.
//
// Prints one OK|/BAD| line per case and a final CORPUS-PASS / CORPUS-FAIL sentinel.
// Exits non-zero on any failure. An import/throw is a FAILURE, never an implicit pass.
import { isReadOnlyTool } from "../../../../hooks/codex/lib/codex-hook-context.mjs";

const mk = (command) => ({
  hook_event_name: "PreToolUse",
  tool_name: "Bash",
  tool_input: { command },
  cwd: process.cwd(),
});

// R1-F001: each of these dequotes/expands into a MUTATING invocation while the raw
// text matches no dangerous-flag pattern — the exact bypass raw-text matching missed.
const DENY = [
  ["dequote: quote-concat rg --pre",     "rg --pr''e=./x.sh foo f"],
  ["dequote: $IFS expansion",            "rg $IFS--pre=./x.sh foo f"],
  ["dequote: ANSI-C quoting",            "rg $'--pre=./x.sh' foo f"],
  ["dequote: quote-concat git --output", "git --out''put=/tmp/x status"],
  ["dequote: quote-concat find -exec",   "find . -ex''ec rm {} ;"],
  ["dequote: quote-concat find -fprint", "find . -fpr''int /tmp/x"],
  ["plain rg --pre",                     "rg --pre=./x.sh foo f"],
  ["glob expansion",                     "cat *.md"],
  ["tilde expansion",                    "cat ~/secret"],
  ["backtick substitution",              "cat a`id`"],
  ["command substitution",               "echo $(rm -rf /tmp/x)"],
  ["redirect",                           "cat README.md > /tmp/out"],
  ["plain rm",                           "rm -rf /tmp/x"],
  ["read chained into rm",               "pwd && rm -rf /tmp/x"],
  ["touch",                              "touch /tmp/newfile"],
  ["unterminated quote",                 "rg 'unterminated"],
  // R3-F001: -z makes ripgrep shell out to decompressors; exact-token matching missed
  // POSIX short-option CLUSTERS, which ripgrep accepts.
  ["rg clustered -iz (subprocess)",       "rg -iz needle archive.gz"],
  ["rg clustered -nz (subprocess)",       "rg -nz needle archive.gz"],
  ["rg clustered -zi (subprocess)",       "rg -zi needle archive.gz"],
  ["rg bare -z",                          "rg -z needle archive.gz"],
  ["rg --search-zip",                     "rg --search-zip needle f"],
];

// EG-02: ordinary agent reads that the pre-WI-501 classifier wrongly denied.
const ALLOW = [
  ["compound read (&&)", "pwd && rg -n foo README.md"],
  ["quoted alternation", 'rg -n "alpha|beta" README.md'],
  ["piped read",         "ls -la | head -20"],
  ["|| true tail",       "rg foo README.md || true"],
  ["compound git read",  "git status && git log --oneline -5"],
  ["two cats",           "cat README.md && cat AGENTS.md"],
];

let failures = 0;
for (const [label, cmd] of DENY) {
  if (isReadOnlyTool(mk(cmd)) === true) { console.log(`BAD|MUST-DENY allowed: ${label}`); failures++; }
  else console.log(`OK|DENY  ${label}`);
}
for (const [label, cmd] of ALLOW) {
  if (isReadOnlyTool(mk(cmd)) !== true) { console.log(`BAD|MUST-ALLOW denied: ${label}`); failures++; }
  else console.log(`OK|ALLOW ${label}`);
}
console.log(failures === 0 ? "CORPUS-PASS" : "CORPUS-FAIL");
process.exit(failures === 0 ? 0 : 1);
