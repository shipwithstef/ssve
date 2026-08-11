#!/usr/bin/env node
/**
 * discovery-wave-fence — the HARD pre-dispatch safety check for the discovery
 * triple fan-out (WI-387). Greenfield discovery runs analyze-domain →
 * analyze-competitors → build-personas strictly serially, though the first three
 * need ONLY vision.md and write DISJOINT paths. This runs them as ONE concurrent
 * mutating wave (catalog-domain-capabilities as wave 2) on isolated/worktree
 * transport — now permitted per the S5 policy (references/workflow-fanout-protocol.md,
 * recorded 2026-06-09).
 *
 * The disjoint-write guarantee is the ONLY thing keeping concurrent mutation
 * safe. This fence FAILS CLOSED on ANY pairwise write-scope intersection — no
 * two wave-1 skills may share a path. Run it BEFORE dispatching the wave.
 *
 * Usage:
 *   node scripts/discovery-wave-fence.mjs            # check the built-in wave-1 scopes, exit 1 on overlap
 *   node scripts/discovery-wave-fence.mjs --json     # print the wave plan + disjoint verdict
 */

// Wave-1 write-scopes per skill (each needs only vision.md; outputs are disjoint).
// Wave 2 (catalog-domain-capabilities) reads domain + competitors and runs AFTER
// the wave-1 merge — it is NOT in this concurrent set.
export const WAVE1_SCOPES = {
  "analyze-domain": ["docs/specs/domain-profile.md"],
  "analyze-competitors": ["docs/specs/analyze-competitors.md", "docs/specs/analyze-competitors.data.json"],
  "build-personas": ["docs/specs/personas/"],
};

// The disjoint-scope primitive is shared with WI-388's task-node partition
// (scripts/lib/disjoint-scopes.mjs) — one hardened, closed-loop fail-safe place
// to audit. Re-exported here for back-compat (`disjointWaveScopes` alias).
import { scopesIntersect, disjointScopes } from "./lib/disjoint-scopes.mjs";
export { scopesIntersect };
export const disjointWaveScopes = (scopesBySkill) => disjointScopes(scopesBySkill);

function has(n) { return process.argv.includes(n); }

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = disjointWaveScopes(WAVE1_SCOPES);
  if (has("--json")) {
    process.stdout.write(JSON.stringify({
      wave1: { skills: Object.keys(WAVE1_SCOPES), scopes: WAVE1_SCOPES, transport: "dispatch-waves (worktree, host-neutral)" },
      wave2: { skills: ["catalog-domain-capabilities"], runs_after: "wave-1 merge + validate-feature checkpoint" },
      disjoint: r.disjoint,
      overlaps: r.overlaps,
    }, null, 2) + "\n");
  }
  if (!r.disjoint) {
    console.error("discovery-wave-fence: REFUSE — wave-1 write-scopes intersect (concurrent mutation unsafe):");
    for (const o of r.overlaps) console.error(`  ${o.a}:${o.scopeA}  ∩  ${o.b}:${o.scopeB}`);
    process.exit(1);
  }
  console.log("discovery-wave-fence: OK — wave-1 write-scopes are pairwise disjoint; the concurrent wave is safe.");
}
