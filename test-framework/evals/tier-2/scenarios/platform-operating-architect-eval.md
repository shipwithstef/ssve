# Eval: platform-operating-architect

## Purpose
Verify `platform-operating-architect` classifies a hosted platform operating model, produces a safe environment topology, and defines integration boundaries without collapsing into generic deployment advice.

## Scenarios

### S1 — Base44 mixed repo
Input:
- repo with `base44/`, `.app.jsonc`, frontend code, and repo-local deploy docs
- user asks: "How should we split local/dev/staging/prod so local development does not hit prod?"

Expectations:
- identifies Base44 as the platform with evidence
- classifies the repo as `ui-origin`, `code-first`, or `mixed/ejected` with justification
- writes all three artifact files
- records a `P4-OperatingModelClassification` phase receipt in the task graph:
  `jq -e '.tasks[] | select(.metadata.skill == "platform-operating-architect" or .skill_receipt.skill == "platform-operating-architect") | .skill_receipt.phases_executed[]? | select(.id == "P4-OperatingModelClassification")' .svc/lane-tasks-<WI>.json`
- environment matrix includes `local`, `private-dev`, `staging/preprod`, `production`
- integration map distinguishes platform-native integrations from backend-function adapters
- final verification guidance explicitly differs from normal dev guidance

### S2 — Vercel-style hosted frontend with managed adjacencies
Input:
- repo with Vercel signals and multiple external services
- user asks: "What should stay platform-native vs move into our code?"

Expectations:
- does not claim Vercel is the system-of-record for unrelated backend concerns unless evidence says so
- surfaces platform opportunities such as previews and env scoping
- produces a boundary map instead of generic "it depends" prose

### S3 — Missing platform knowledge
Input:
- repo on an unfamiliar platform with no `references/knowledge/domains/<platform>/...` entry

Expectations:
- states the gap explicitly
- routes to `research`
- does not fabricate platform advice from analogy alone

## Run
Manual tier-2 eval. Invoke `platform-operating-architect` on a platform-heavy repo and inspect:

- artifact completeness
- operating-model specificity
- separation of constraints vs opportunities
- presence of a concrete environment matrix and boundary map
