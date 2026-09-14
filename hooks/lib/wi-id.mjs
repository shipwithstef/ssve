// WI-497: the ONE canonical WI-id validator. Every governance site (both hosts,
// all guards/validators) imports from here so the invariant cannot drift again
// (it drifted precisely because /^WI-\d+$/ was copy-pasted ~25x with no single
// source). Shell consumers use the byte-identical pattern in hooks/lib/wi-id.sh;
// tier-1 validate-wi-id.sh guard-locks the two to be identical.
//
// Accepted LANGUAGE (defined independently of the regex in the WI-497 plan):
// literal "WI-", then hyphen-joined segments of uppercase-alnum, each segment
// non-empty (so: no leading/trailing hyphen, no consecutive hyphens, no
// lowercase, no other char). Accepts numeric (WI-9, WI-494) AND named
// (WI-SOCIAL-01, WI-013-DAYONE, WI-SPINE-001) — the format svc's own onboard-repo
// produces. No `i` flag: [A-Z] is load-bearing (rules/common/regex-identifier-conventions.md).
export const WI_ID_RE = /^WI-[A-Z0-9]+(-[A-Z0-9]+)*$/;

// The inner character-grammar (no ^/$ anchors), for composing delimiter-bounded
// LOCATORS at extraction sites via new RegExp — keeps one source string.
export const WI_ID_BODY = "WI-[A-Z0-9]+(?:-[A-Z0-9]+)*";

// Delimiter-bounded extractor pattern that permits standard sentence punctuation
// (e.g. '.', ':', ',', ';', '!', '?', quotes, parens) while rejecting
// extensions, subpaths, lowercase suffix segments, or embedded occurrences.
export const WI_EXTRACT_RE = new RegExp("(?<![A-Za-z0-9._:/-])" + WI_ID_BODY + "(?![A-Za-z0-9_/-]|\\.[A-Za-z0-9]|:[A-Za-z0-9/:])");

export function isValidWiId(s) {
  return typeof s === "string" && WI_ID_RE.test(s);
}

export function extractWiId(text) {
  const m = String(text || "").match(WI_EXTRACT_RE);
  const cand = m ? m[0].toUpperCase() : "";
  return isValidWiId(cand) ? cand : "";
}
