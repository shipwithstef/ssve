// cognitive-family — dynamic host-to-family mapping. Any host string is valid;
// family is derived by substring match against KNOWN_FAMILIES patterns.
// Adding a new tool = adding one line here OR just letting it fall through to
// the raw host string (which still passes cross-family checks if different).
const FAMILY_PATTERNS = [
  [/claude|anthropic/, "anthropic"],
  [/codex|openai/, "openai"],
  [/gemini|google|antigravity|agy/, "google"],
  [/grok|xai/, "xai"],
  [/cursor/, "cursor-anthropic"],
  [/opencode|openrouter/, "opencode"],
  [/kimi/, "kimi"],
  [/mistral/, "mistral"],
];
export function familyOf(host) {
  const h = String(host || "").trim().toLowerCase();
  if (!h) return "unknown";
  for (const [pattern, family] of FAMILY_PATTERNS) {
    if (h.includes(pattern.source.replace(/\\/g,""))) return family;
  }
  return h; // unknown hosts resolve to their own name — never same-family unless identical
}
export function crossFamily(authorHost, reviewerHost) {
  const a = familyOf(authorHost);
  const r = familyOf(reviewerHost);
  return { crossFamily: a !== r && a !== "unknown" && r !== "unknown", author_family: a, reviewer_family: r };
}
