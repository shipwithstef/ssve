// cognitive-family — map a reviewer/orchestrator HOST to its cognitive family
// (WI-385). The "never self-review" fence on the low-tier consolidated review is
// only real if author_family and reviewer_family are MECHANICALLY resolved from
// the actual hosts and compared — not a forgeable boolean. A model cannot
// adversarially review its own output, so the families must DIFFER.
//
// Families: the three allowlisted reviewer hosts are each their own family
// (claude=Anthropic, codex=OpenAI, gemini=Google). Kept deliberately simple and
// explicit; unknown hosts fall back to the raw host string so an unrecognized
// pairing can never accidentally read as "same family" with a known one unless
// it literally is the same token.

// Gemini G6 #4: substring match + STRICT "unknown" fallback. Returning the raw
// host string for an unrecognized name (e.g. "claude-3", "fake-host") would let
// it slip the fence (anthropic !== claude-3 reads as cross-family). An unknown
// host must resolve to "unknown" so the crossFamily check rejects it. Substring
// match also catches legit variants (gemini-cli → google, claude-opus → anthropic).
export function familyOf(host) {
  const h = String(host || "").trim().toLowerCase();
  if (!h) return "unknown";
  if (h.includes("claude") || h.includes("anthropic")) return "anthropic";
  if (h.includes("codex") || h.includes("openai")) return "openai";
  if (h.includes("gemini") || h.includes("google") || h.includes("antigravity") || h.includes("agy")) return "google";
  return "unknown";   // fail-closed: an unrecognized host is never a valid reviewer family
}

// The mechanical cross-family check: the author (orchestrator that produced the
// diff) and the adversarial reviewer must be DIFFERENT families. Returns
// { crossFamily, author_family, reviewer_family }.
export function crossFamily(authorHost, reviewerHost) {
  const a = familyOf(authorHost);
  const r = familyOf(reviewerHost);
  return { crossFamily: a !== r && a !== "unknown" && r !== "unknown", author_family: a, reviewer_family: r };
}
