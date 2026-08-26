// WI-562 IP-W2: ONE shared svc-ownership predicate for every host wirer.
//
// Replaces the per-host substring/regex heuristics (wire-hooks kimi-strip
// heuristics, wire-cursor-hooks `cmd.includes("svc-")`, wire-grok-hooks
// isSvcOwnedText) so identical command fixtures always yield identical
// verdicts across hosts. Pure module — no fs, no process.

// Governed svc hook script names: svc-<thing>.<mjs|js|sh> as a distinct token.
const SVC_SCRIPT_RE = /(?:^|[^\w.-])svc-[A-Za-z0-9._-]+\.(?:mjs|js|sh)\b/;
// The svc-enforce launcher. Suffix lookahead accepts a shell-quote because
// governed commands embed the launcher path QUOTED ('…/bin/svc-enforce' …);
// requiring \s|$ there misclassified installed governed entries as user-owned
// and made wirer rebuilds append duplicates (post-land OTA finding, 2026-08-26).
const SVC_ENFORCE_RE = /(?:^|[^\w.-])svc-enforce(?=['"]|\s|$)/;
// Skills hooks directory containment.
const SKILLS_HOOKS_RE = /\/skills\/hooks\//;
// Documented grok carve-out: user hooks under skills/hooks/user-keep.* are
// explicitly PRESERVED by the grok wirer — they are user property even though
// they live inside the hooks dir.
const USER_KEEP_RE = /\/hooks\/user-keep\./;

/**
 * Decide whether a host-config hook command is owned/managed by svc.
 * Owned commands are rebuilt (subtractive) by wirers; non-owned commands are
 * preserved byte-verbatim.
 *
 * @param {string} command - raw command text from a host config entry
 * @returns {boolean}
 */
export function isSvcOwnedCommand(command) {
  const cmd = String(command || "");
  if (!cmd.trim()) return false;
  if (USER_KEEP_RE.test(cmd)) return false;
  return SVC_SCRIPT_RE.test(cmd)
    || SVC_ENFORCE_RE.test(cmd)
    || SKILLS_HOOKS_RE.test(cmd);
}

/**
 * Inverse convenience matching the wirers' "keep non-svc" filters.
 */
export function isUserOwnedCommand(command) {
  return !isSvcOwnedCommand(command);
}
