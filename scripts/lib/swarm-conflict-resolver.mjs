#!/usr/bin/env node
// swarm-conflict-resolver.mjs — deterministic conflict prevention and resolution.
//
// Ladder (per the approved architecture):
//   L0 stale generation/lease/base or unauthorized path  -> reject, no merge
//   L1 disjoint Git paths + logical claims               -> integrate in isolation
//   L2 overlapping but clean three-way merge             -> union validators must pass
//   L3 registered structured resolver                    -> deterministic merge + digests
//   L4 text conflict / no resolver / semantic failure    -> CONFLICTED (bounded adjudication)
//   L5 protected surfaces                                -> refuse; never auto-merge
//
// Determinism rule: identical inputs produce identical outcomes and digests.
// There is no last-writer-wins, no timestamp ordering, no model preference.

import fs from "node:fs";
import { canonicalDigest } from "./swarm-canonical-json.mjs";
import policy from "../../references/swarm-conflict-policy.json" with { type: "json" };

function globToRegExp(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, ".*");
  return new RegExp(`^${escaped}$`);
}

export function isProtectedPath(filePath, surfaces = policy.protected_surfaces) {
  return surfaces.some((surface) => globToRegExp(surface.pattern).test(filePath));
}

function protectedSurfacesFor(paths, surfaces = policy.protected_surfaces) {
  const hits = new Set();
  for (const surface of surfaces) {
    if (paths.some((p) => globToRegExp(surface.pattern).test(p))) hits.add(surface.pattern);
  }
  return hits;
}

export function compileClaims(claims = []) {
  // normalize claims -> sorted, digest-bound write-set descriptors
  const normalized = claims
    .map((claim) => ({
      principal_id: claim.principal_id,
      task_id: claim.task_id,
      paths: [...(claim.paths ?? [])].sort(),
      resources: [...(claim.resources ?? [])].sort(),
      base_sha: claim.base_sha ?? null,
      exclusive: claim.exclusive ?? true,
    }))
    .sort((a, b) => (a.principal_id < b.principal_id ? -1 : a.principal_id > b.principal_id ? 1 : 0) || (a.task_id < b.task_id ? -1 : a.task_id > b.task_id ? 1 : 0));
  return { claims: normalized, claims_digest: canonicalDigest(normalized) };
}

function pathOverlap(a, b) {
  return a.some((pa) => b.some((pb) => pa === pb || pa.startsWith(`${pb}/`) || pb.startsWith(`${pa}/`)));
}

function resourceOverlap(a, b) {
  return a.some((ra) => b.includes(ra));
}

// Three-way per-key merge for canonical JSON maps.
export function threeWayMapMerge(base, ours, theirs) {
  const keys = [...new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)])].sort();
  const merged = {};
  const conflicts = [];
  for (const key of keys) {
    const b = base[key];
    const o = ours[key];
    const t = theirs[key];
    if (JSON.stringify(o) === JSON.stringify(t)) merged[key] = o;
    else if (JSON.stringify(b) === JSON.stringify(o)) merged[key] = t;
    else if (JSON.stringify(b) === JSON.stringify(t)) merged[key] = o;
    else conflicts.push(key);
  }
  return { merged, conflicts };
}

// Union-by-immutable-id for append-only JSONL projections.
export function unionAppendOnly(aRows, bRows, idField = "id") {
  const byId = new Map();
  for (const row of aRows) {
    byId.set(row[idField], row);
  }
  for (const row of bRows) {
    const existing = byId.get(row[idField]);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(row)) {
        return { ok: false, fatal: `same id ${row[idField]} with different content` };
      }
    } else {
      byId.set(row[idField], row);
    }
  }
  const rows = [...byId.values()].sort((x, y) => { const a = String(x[idField]); const b = String(y[idField]); return a < b ? -1 : a > b ? 1 : 0; });
  return { ok: true, rows, result_digest: canonicalDigest(rows) };
}

/**
 * resolvePair — evaluate two claims against the ladder. Pure function.
 * @returns {{level:number, outcome:string, reason:string, merged?:object}}
 */
export function resolvePair(ours, theirs, context = {}) {
  const generationOk = ours.authority_generation === theirs.authority_generation;
  const baseAgrees = !ours.base_sha || !theirs.base_sha || ours.base_sha === theirs.base_sha;

  // L0 — staleness or protected-surface breach
  if (!generationOk) return { level: 0, outcome: "REJECT", reason: "stale_generation" };
  if (!baseAgrees) return { level: 0, outcome: "REJECT", reason: "base_mismatch" };
  // Protected surfaces: two claims touching the SAME protected surface serialize
  // through owner review — never auto-merge, even when their concrete files differ.
  const oursProtected = protectedSurfacesFor(ours.paths);
  const theirsProtected = protectedSurfacesFor(theirs.paths);
  for (const surface of oursProtected) {
    if (theirsProtected.has(surface)) {
      return { level: 5, outcome: "REFUSE", reason: `protected_surface:${surface}` };
    }
  }

  const pathsDisjoint = !pathOverlap(ours.paths, theirs.paths);
  const resourcesDisjoint = !resourceOverlap(ours.resources, theirs.resources);

  // L1 — fully disjoint
  if (pathsDisjoint && resourcesDisjoint) {
    return { level: 1, outcome: "INTEGRATE", reason: "disjoint_paths_and_resources" };
  }

  // L3 — registered structured resolver for every overlapping file class
  const overlappingPaths = ours.paths.filter((p) => theirs.paths.includes(p));
  if (overlappingPaths.length > 0 && context.resolverFor) {
    const resolverId = context.resolverFor(overlappingPaths);
    if (resolverId === "canonical-json-map-three-way" && context.threeWay) {
      const tw = context.threeWay;
      const { merged, conflicts } = threeWayMapMerge(tw.base ?? {}, tw.ours ?? {}, tw.theirs ?? {});
      if (conflicts.length === 0) {
        return { level: 3, outcome: "RESOLVE", reason: `resolver:canonical-json-map-three-way`, merged };
      }
      return { level: 4, outcome: "CONFLICTED", reason: `divergent_same_key_writes:${conflicts.join(",")}` };
    }
    if (resolverId === "append-only-jsonl-union" && context.appendOnly) {
      const u = unionAppendOnly(context.appendOnly.ours ?? [], context.appendOnly.theirs ?? []);
      if (u.ok) return { level: 3, outcome: "RESOLVE", reason: "resolver:append-only-jsonl-union", merged: u.rows, result_digest: u.result_digest };
      return { level: 4, outcome: "CONFLICTED", reason: u.fatal };
    }
    if (context.allowTextMerge) {
      // fall through to L2/L4 handling below
    } else {
      return { level: 4, outcome: "CONFLICTED", reason: "no_registered_resolver_for_overlap" };
    }
  }

  // L2 — overlapping but clean textual merge (context supplies the merged artifact)
  if (context.cleanMerge === true) {
    return { level: 2, outcome: "MERGE_WITH_VALIDATORS", reason: "clean_three_way_merge_pending_union_validators" };
  }

  return { level: 4, outcome: "CONFLICTED", reason: "textual_or_semantic_conflict" };
}

export function adjudicationExhausted(conflict) {
  const attempts = conflict?.attempts ?? 0;
  return attempts >= (policy.adjudication.max_attempts);
}
