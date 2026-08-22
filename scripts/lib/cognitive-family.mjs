// cognitive-family — dynamic host-to-family mapping (WI-385).
//
// Multi-model harnesses (cursor, opencode, kimi) intentionally resolve to
// their RAW host string, NOT to a model family. Their effective family comes
// from the dispatch policy tuple, trusted because operator-configured.
// This prevents independence laundering where a harness running the same
// provider as the orchestrator counts as "different-family".
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
    if (h.includes(pattern.source)) return family;
  }
  return h; // unknown hosts resolve to own name — always cross-family vs known families
}
export function crossFamily(authorHost, reviewerHost) {
  const a = familyOf(authorHost);
  const r = familyOf(reviewerHost);
  return { crossFamily: a !== r && a !== "unknown" && r !== "unknown", author_family: a, reviewer_family: r };
}
