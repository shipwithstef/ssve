#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
cd "$ROOT"

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

test -f references/solution-confidence-protocol.md || fail "missing solution confidence protocol"

grep -Eq "solution_confidence_required" references/solution-confidence-protocol.md \
  || fail "protocol does not define solution_confidence_required"
grep -Eq "design_auto" references/solution-confidence-protocol.md \
  || fail "protocol does not define default design-auto mode"
grep -Eq "post_design_human_gate" references/solution-confidence-protocol.md \
  || fail "protocol does not define post-design gate mode"
grep -Eq "Human gates happen after design only when the user requests one" references/solution-confidence-protocol.md \
  || fail "protocol does not make gates request-only after design"
grep -Eq "SOLUTION-CONFIDENCE.md" references/solution-confidence-protocol.md \
  || fail "protocol does not define required artifact"
grep -Eq "at least five" references/solution-confidence-protocol.md \
  || fail "protocol does not require five real-world examples"
grep -Eq "Cost And Cache Rules" references/solution-confidence-protocol.md \
  || fail "protocol does not define cost/cache rules"
grep -Eq "Suggestion Triage Rules" references/solution-confidence-protocol.md \
  || fail "protocol does not define suggestion triage"
grep -Eq "adopt.*modify.*defer.*reject.*unrelated" references/solution-confidence-protocol.md \
  || fail "protocol does not define full suggestion triage vocabulary"
grep -Eq "Action-by-Action Approval Packet" references/solution-confidence-protocol.md \
  || fail "protocol does not require an action-by-action approval packet"
perl -0ne 'exit(/what changes.*why.*how.*positive.*negative.*impact if skipped.*proof/s ? 0 : 1)' references/solution-confidence-protocol.md \
  || fail "protocol approval packet lacks what/why/how/outcome/impact/proof coverage"
grep -Eq "Outcome Coverage" references/solution-confidence-protocol.md \
  || fail "protocol does not require material outcome coverage"
grep -Eq "A missing approval packet blocks approval requests" references/solution-confidence-protocol.md \
  || fail "protocol does not block approval/planning when packet is missing"

grep -Eq "references/solution-confidence-protocol.md" skills/route-workflow/SKILL.md \
  || fail "route-workflow does not load protocol"
grep -Eq "solution_confidence_required" skills/route-workflow/SKILL.md \
  || fail "route-workflow does not set confidence flag"
grep -Eq "design_auto" skills/route-workflow/SKILL.md \
  || fail "route-workflow does not route design auto mode"
grep -Eq "post_design_human_gate" skills/route-workflow/SKILL.md \
  || fail "route-workflow does not route post-design gate mode"
grep -Eq "action-by-action approval packet" skills/route-workflow/SKILL.md \
  || fail "route-workflow does not require approval packet before plan/approval"
grep -Eq "best solution.*right design.*all cards" skills/route-workflow/references/intent-routing.md \
  || fail "intent routing lacks confidence trigger row"
grep -Eq "by design auto" skills/route-workflow/references/intent-routing.md \
  || fail "intent routing lacks by-design-auto trigger"
grep -Eq "solution-confidence-protocol" skills/route-workflow/references/lane-model.md \
  || fail "lane model lacks confidence protocol"
grep -Eq "design_auto" skills/route-workflow/references/lane-model.md \
  || fail "lane model lacks design auto mode"
grep -Eq "post_design_human_gate.*only when the user explicitly asks" skills/route-workflow/references/lane-model.md \
  || fail "lane model does not make human gate explicit-only"

grep -Eq "Solution Confidence Mode" skills/design-tech/SKILL.md \
  || fail "design-tech lacks solution confidence mode"
grep -Eq "references/solution-confidence-protocol.md" skills/design-tech/SKILL.md \
  || fail "design-tech does not load protocol"
grep -Eq "Human gates are not default" skills/design-tech/SKILL.md \
  || fail "design-tech still implies default human gate"
perl -0ne 'exit(/approval packet.*what changes.*why.*how.*positive.*negative.*impact if skipped/s ? 0 : 1)' skills/design-tech/SKILL.md \
  || fail "design-tech does not require approval packet coverage"
grep -Eq "Do not skip.*solution_confidence_required" skills/explore-solutions/SKILL.md \
  || fail "explore-solutions can still skip confidence mode"
grep -Eq "five sourced" skills/explore-solutions/SKILL.md \
  || fail "explore-solutions lacks five-example grounding"
grep -Eq "adopt.*modify.*defer.*reject.*unrelated" skills/explore-solutions/SKILL.md \
  || fail "explore-solutions lacks suggestion triage vocabulary"
grep -Eq "action-by-action approval packet" skills/explore-solutions/SKILL.md \
  || fail "explore-solutions does not feed approval packet"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

node scripts/compile-delivery-graph.mjs \
  --wi WI-000 \
  --intent "Find the best solution for mobile/web discovery performance; show design before plan." \
  --change-type feature \
  --lane brownfield-feature \
  --risk-flags user-facing,browser-visible,cache,cost,solution-confidence \
  --solution-confidence-required true \
  --solution-confidence-mode post_design_human_gate \
  --solution-confidence-artifact docs/specs/decisions/2026-05-30-test/SOLUTION-CONFIDENCE.md \
  > "$tmpdir/post-design-gate.json"

node scripts/validate-delivery-graph.mjs "$tmpdir/post-design-gate.json" >/dev/null \
  || fail "compiled post-design solution-confidence graph is invalid"

node - "$tmpdir/post-design-gate.json" <<'NODE' \
  || fail "compiled graph does not mechanically block plan behind post-design approval"
const fs = require("node:fs");
const graph = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const dg = graph.delivery_graph;
const task = (skill) => graph.tasks.find((item) => item.metadata?.skill === skill);
if (dg.solution_confidence?.required !== true) throw new Error("solution confidence not required");
if (dg.solution_confidence?.mode !== "post_design_human_gate") throw new Error("wrong mode");
for (const skill of ["research", "design-tech", "explore-solutions", "plan-changeset"]) {
  if (!task(skill)) throw new Error(`missing task ${skill}`);
}
const plan = task("plan-changeset");
if (plan.status !== "blocked") throw new Error("plan is not blocked");
if (plan.metadata?.solution_confidence_waits_for_approval !== true) throw new Error("missing approval wait marker");
NODE

node - "$tmpdir/post-design-gate.json" "$tmpdir/bad-post-design-gate.json" <<'NODE'
const fs = require("node:fs");
const graph = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const plan = graph.tasks.find((item) => item.metadata?.skill === "plan-changeset");
plan.status = "pending";
delete plan.metadata.solution_confidence_waits_for_approval;
fs.writeFileSync(process.argv[3], JSON.stringify(graph, null, 2));
NODE

if node scripts/validate-delivery-graph.mjs "$tmpdir/bad-post-design-gate.json" >/dev/null 2>&1; then
  fail "validator allowed post-design gate without blocked plan"
fi

node scripts/compile-delivery-graph.mjs \
  --wi WI-002 \
  --intent "Park this solution-confidence work item with no design yet." \
  --change-type feature \
  --lane brownfield-feature \
  --risk-flags user-facing,solution-confidence \
  --solution-confidence-required true \
  --solution-confidence-mode intake_only \
  > "$tmpdir/intake-only.json"

node scripts/validate-delivery-graph.mjs "$tmpdir/intake-only.json" >/dev/null \
  || fail "compiled intake-only solution-confidence graph is invalid"

node - "$tmpdir/intake-only.json" <<'NODE' \
  || fail "intake-only graph does not keep downstream confidence work inactive"
const fs = require("node:fs");
const graph = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const task = (skill) => graph.tasks.find((item) => item.metadata?.skill === skill);
for (const skill of ["research", "design-tech", "explore-solutions", "execute-changeset"]) {
  const item = task(skill);
  if (!item) throw new Error(`missing ${skill}`);
  if (item.status !== "blocked") throw new Error(`${skill} is not blocked`);
  if (item.metadata?.solution_confidence_intake_stop !== true) throw new Error(`${skill} lacks intake stop marker`);
}
NODE

echo "solution confidence protocol validation: PASS"
