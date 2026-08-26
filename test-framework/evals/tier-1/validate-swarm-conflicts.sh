#!/bin/bash
# validate-swarm-conflicts.sh — conflict ladder determinism: L0 reject, L1 integrate,
# L2/L3 resolvers, L4 conflicted, L5 protected-surface refusal. No last-writer-wins anywhere.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d /tmp/svc-swarm-conf-XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

fail() { echo "FAIL(validate-swarm-conflicts): $1" >&2; exit 1; }

node --check "$ROOT/scripts/lib/swarm-conflict-resolver.mjs" || fail "resolver syntax"

node --input-type=module - "$TMP" <<'JS' || fail "ladder behavior failure"
import fs from "node:fs";
const m = await import(new URL("file://" + process.cwd() + "/scripts/lib/swarm-conflict-resolver.mjs").href);

const ours = { principal_id: "sol", task_id: "t1", paths: ["src/a.mjs"], resources: [], authority_generation: 3, base_sha: "abc" };
const theirs = { principal_id: "grok", task_id: "t2", paths: ["src/b.mjs"], resources: [], authority_generation: 3, base_sha: "abc" };

// L1: disjoint -> INTEGRATE
let r = m.resolvePair(ours, theirs);
if (r.level !== 1 || r.outcome !== "INTEGRATE") process.exit(1);

// L0: stale generation and base mismatch -> REJECT (never merge)
r = m.resolvePair(ours, { ...theirs, authority_generation: 2 });
if (!(r.level === 0 && r.outcome === "REJECT")) process.exit(1);
r = m.resolvePair(ours, { ...theirs, base_sha: "different" });
if (!(r.level === 0 && r.outcome === "REJECT")) process.exit(1);

// L5: both claims touch the same protected surface pattern -> REFUSE even if files differ
const protOurs = { ...ours, paths: ["provision/policies/one.toml"] };
const protTheirs = { ...theirs, paths: ["provision/policies/two.toml"] };
r = m.resolvePair(protOurs, protTheirs);
if (!(r.level === 5 && r.outcome === "REFUSE")) process.exit(1);
// a single claim touching a protected surface with disjoint other paths still integrates
r = m.resolvePair({ ...ours, paths: ["provision/policies/one.toml"] }, theirs);
if (r.outcome !== "INTEGRATE") process.exit(1);

// overlapping claims on one file
const oFile = { ...ours, paths: ["data/x.state.json"] };
const tFile = { ...theirs, paths: ["data/x.state.json"] };

// L3 registered canonical-json-map resolver: non-divergent keys merge deterministically
const mapCtx = {
  resolverFor: () => "canonical-json-map-three-way",
  threeWay: { base: { k1: 1 }, ours: { k1: 1, ko: "o" }, theirs: { k1: 1, kt: "t" } },
};
r = m.resolvePair(oFile, tFile, mapCtx);
if (!(r.level === 3 && r.outcome === "RESOLVE" && JSON.stringify(r.merged) === '{"k1":1,"ko":"o","kt":"t"}')) process.exit(1);

// determinism: same inputs twice -> identical result objects
const again = m.resolvePair(oFile, tFile, mapCtx);
if (JSON.stringify(again) !== JSON.stringify(r)) process.exit(1);

// L4 divergent same-key writes -> CONFLICTED
r = m.resolvePair(oFile, tFile, {
  resolverFor: () => "canonical-json-map-three-way",
  threeWay: { base: { s: "b" }, ours: { s: "ours" }, theirs: { s: "theirs" } },
});
if (!(r.level === 4 && r.outcome === "CONFLICTED")) process.exit(1);

// L4 no registered resolver for overlap -> CONFLICTED
r = m.resolvePair(oFile, tFile, {});
if (!(r.level === 4 && r.outcome === "CONFLICTED")) process.exit(1);

// append-only union resolver: union by id; same id different content is fatal
const u1 = m.unionAppendOnly([{ id: "e1", v: 1 }], [{ id: "e2", v: 2 }]);
if (!u1.ok || u1.rows.length !== 2) process.exit(1);
const u2 = m.unionAppendOnly([{ id: "e1", v: 1 }], [{ id: "e1", v: 999 }]);
if (u2.ok) process.exit(1);

// claims compilation digest stability
const c1 = m.compileClaims([ours]);
const c2 = m.compileClaims([ours]);
if (c1.claims_digest !== c2.claims_digest) process.exit(1);

fs.writeFileSync(process.argv[2] + "/ladder-ok", "1");
process.exit(0);
JS
[[ -f "$TMP/ladder-ok" ]] || fail "ladder checks did not pass"

echo "PASS(validate-swarm-conflicts): ladder L0/L1/L3/L4/L5 deterministic; protected surfaces refuse; no last-writer-wins"
