// disjoint-scopes — the generic, closed-loop fail-safe disjoint-file primitive
// (extracted from WI-387's discovery-wave-fence so WI-388's task-node partition
// reuses the SAME hardened logic — DRY, one place to audit). Two write-scopes
// "intersect" if they resolve to the same filesystem tree or one contains the
// other; the check is FAIL-SAFE — any scope that is not a clean relative subpath
// (empty, root ".", or an escaping "..") intersects EVERYTHING, and equivalent
// spellings (//, ./, .., absolute, case) are canonicalized first.

import path from "node:path";

export const norm = (p) => {
  if (!p) return "";
  const s = path.posix.normalize(String(p).replace(/\\/g, "/"));
  return s.replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase();
};

// "" or "." (whole repo) or "../…" (a parent that aliases back into the repo)
// is not a clean relative subpath → intersects everything (fail-safe).
export const unsafeScope = (s) => !s || s === "." || s.startsWith("..");

export function scopesIntersect(a, b) {
  const na = norm(a), nb = norm(b);
  if (unsafeScope(na) || unsafeScope(nb)) return true;
  if (na === nb) return true;
  if (nb.startsWith(na + "/")) return true;
  if (na.startsWith(nb + "/")) return true;
  return false;
}

// Pure: is every pair of scope-arrays across distinct keys disjoint?
// scopesByKey: { key: [scope, ...] }. Returns { disjoint, overlaps:[{a,b,scopeA,scopeB}] }.
// An empty set is a config error → NOT disjoint (fail-closed).
export function disjointScopes(scopesByKey) {
  const keys = Object.keys(scopesByKey || {});
  if (keys.length === 0) return { disjoint: false, overlaps: [{ a: "(none)", b: "(none)", scopeA: "", scopeB: "empty set" }] };
  const overlaps = [];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      for (const sa of scopesByKey[keys[i]] || []) {
        for (const sb of scopesByKey[keys[j]] || []) {
          if (scopesIntersect(sa, sb)) overlaps.push({ a: keys[i], b: keys[j], scopeA: sa, scopeB: sb });
        }
      }
    }
  }
  return { disjoint: overlaps.length === 0, overlaps };
}
