// cognitive-family — pattern-based host-to-family mapping (WI-385, repaired WI-557-v2).
//
// Any host string is schema-valid; the family used by the independence fence is
// derived MECHANICALLY from the host string via ordered patterns. Adding a new
// provider = adding one line to FAMILY_PATTERNS.
//
// Gemini G6 #4 (fail-closed fence): an unrecognized host resolves to "unknown",
// which can NEVER satisfy crossFamily — a reviewer whose family cannot be
// derived is not provably independent. The earlier raw-string fallback let an
// unknown pairing read as cross-family and slipped the fence.
const FAMILY_PATTERNS = [
  [/claude|anthropic/, "anthropic"],
  [/codex|openai/, "openai"],
  [/gemini|google|antigravity|agy/, "google"],
  [/grok|xai/, "xai"],
];
export function familyOf(host) {
  const h = String(host || "").trim().toLowerCase();
  if (!h) return "unknown";
  for (const [pattern, family] of FAMILY_PATTERNS) {
    if (pattern.test(h)) return family;
  }
  return "unknown";
}
export function crossFamily(authorHost, reviewerHost) {
  const a = familyOf(authorHost);
  const r = familyOf(reviewerHost);
  return { crossFamily: a !== r && a !== "unknown" && r !== "unknown", author_family: a, reviewer_family: r };
}

// The author (orchestrator) family must come from the host's own identity. It is never
// defaulted: a default would let a same-family review be certified as independent.
export function requireOrchestratorFamily(value) {
  if (typeof value !== "string" || !value.trim() || value.startsWith("--")) {
    throw new Error("--orchestrator-family is required: pass the family of the host that authored the work (claude/anthropic, codex/openai, google, xai)");
  }
  const family = familyOf(value);
  if (family === "unknown") throw new Error(`--orchestrator-family value "${value}" is unrecognised (expected claude/anthropic, codex/openai, gemini/google, grok/xai)`);
  return family;
}
