const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROVIDER_SESSION_RE = /^(?:thread|session|sess|codex|claude|kimi|gemini|agy|svc)[-_][A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

export function sessionShaped(value) {
  const text = String(value || "");
  return UUID_RE.test(text) || PROVIDER_SESSION_RE.test(text);
}

// Legacy claims may carry non-identity labels such as claimed_by:"claude".
// Ignore those, but fail closed when two distinct session-shaped identities are
// present. Repeated aliases for the same session remain compatible.
export function normalizeClaimOwner(claim = {}) {
  const candidates = [
    ["session_token", claim.session_token],
    ["session", claim.session],
    ["session_id", claim.session_id],
    ["claimed_by", claim.claimed_by],
  ];
  const attributable = candidates
    .map(([source, value]) => ({ source, session_id: String(value || "").trim() }))
    .filter((item) => sessionShaped(item.session_id));
  const identities = new Set(attributable.map((item) => item.session_id));
  if (identities.size > 1) return { session_id: "", attributable: false, source: "", ambiguous: true };
  if (attributable.length) return { ...attributable[0], attributable: true, ambiguous: false };
  return { session_id: "", attributable: false, source: "", ambiguous: false };
}
