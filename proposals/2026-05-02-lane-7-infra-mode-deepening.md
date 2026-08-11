# Proposal: Lane 7 (Infra Migration) Depth Gates

**Status:** PROPOSAL — awaiting user approval before implementation
**Date:** 2026-05-02
**Source:** EzBob session 2026-05-01 + 2026-05-02 user feedback after first Lane 7 application
**Affects:** `route-workflow/SKILL.md`, `plan-changeset/SKILL.md`, NEW skill `design-diagram`, NEW gate `production-use-verification`, NEW gate `port-equivalence-contract`, `research/SKILL.md` (knowledge-freshness gate enforcement)

## Context

Lane 7 was added 2026-05-01 with the four-step shape: extract legacy → build framework knowledge → make consuming skill → triangulate per-capability port matrix. First application (EzBob Istio + cmp-common 0.5.0) revealed the lane's shape is correct but **enforcement gates are missing**. User feedback after one full session of Lane 7 use:

> "Plan that is imported needs to start like that. Diagram. Create skills. Technical design — everything covered. Can't accept plan that is missing the layered and questioned and ground to reality, both legacy and new one needs to have high-level explanation, low-level ones, etc. Everything needs to be verified. Absolute knowledge ground check, date if missing, etc. Also check for skills that are external, compare them with knowledge for mismatch, figure who is wrong, eventually what works will become new skill."

The session shipped a working triangulation matrix (`docs/architecture/2026-05-01-routing-stack-design-authority.md`) and proper artifacts, but only because the user manually pushed for each gate. Without this proposal codified, the gates rely on user vigilance — exactly the failure mode the framework should eliminate.

## Gap analysis (what Lane 7 has vs needs)

| Need (user statement) | Lane 7 today | Gap |
|---|---|---|
| 1. Verify A actually works in production before porting | implicit ("extract legacy") | No gate confirms production use across all layers |
| 2. Port equivalence guarantee — better-or-same after port | implicit (BEST port verdict per row) | No explicit AC contract; equivalence is unstated |
| 3. Diagrams (high-level + per-layer + delta) | not mandated | No skill for diagrams; not in mandatory artifacts |
| 4. Layered explanation — high + low for BOTH legacy and new | partial (skill files have it, design authority doesn't) | Design authority allowed to be a table only — no narrative per layer |
| 5. Reality grounding — every claim cites a live source | partial (live cluster checklist exists) | No enforcement that EVERY plan claim cites a verified source |
| 6. Knowledge freshness gate — fail-closed if domain doc missing or stale | exists (AP-30) | Not enforced at plan-acceptance time; only at research-skill time |
| 7. External-skill audit + cross-check — find mismatches | not present | Framework doesn't compare installed skills against framework knowledge |
| 8. Resolve mismatch — pick the working one | not present | No protocol for "skill says X, knowledge says Y, who's right" |
| 9. Promote working pattern to new skill | not present | Lane 7 ends with close-out, not skill capture |

## Proposal — 9 gates added to Lane 7

### G0. Production-Use Verification Gate (NEW — first task in Lane 7)

**Premise:** if "A" doesn't actually work in production, the port assumption is wrong. Either there's no port to do, or the scope is different from what the user thinks.

**Mandatory questions before ANY extract:**

| Layer | Question | Acceptable evidence |
|---|---|---|
| Code | Does the code path exist and execute? | grep + read of the actual code |
| Build | Does it build successfully today? | CI green log OR local build |
| Deploy | Is it deployed to a production-class env? | `kubectl get` / cloud console / deployment record |
| Traffic | Is it serving real traffic / handling real load? | observability metric OR `kubectl logs` showing recent activity |
| Users | Does at least one real persona depend on it? | journey reference OR direct user statement |

**Output:** `docs/architecture/<date>-<topic>-production-baseline.md` — one row per layer with cite-able evidence. If any layer fails, agent MUST surface to user before proceeding. Three outcomes:
- **All 5 layers green** → proceed to extract
- **Some red** → port scope may be smaller (or different) than assumed; renegotiate scope with user
- **All red** → not a port. Ask user what we're actually doing.

**Why this matters:** in the EzBob session, the user pushed back when I assumed a Kubernetes resource existed (CORSPolicy CRD) without verifying live. G0 catches this class of failure for the legacy side.

### G1. Port Equivalence Contract (NEW — second task in Lane 7)

**Default:** "After port, behavior on every named layer is ≥ legacy."

For each of the 5 layers in G0, the design authority MUST state the post-port expectation:
- `=` (parity — same observable behavior)
- `>` (better — explicitly named improvement, e.g., "vendor-neutral routing layer")
- `<` (worse, with justification — explicit user accept required)

**Plan accepted only if:** every layer has an explicit verdict, no blanks. `<` rows must each have:
- Why we're accepting the regression
- What mitigation exists
- When/whether it gets resolved

**Output format (markdown table at top of design authority):**

```markdown
## Port Equivalence Contract

| Layer | Legacy state | Post-port state | Verdict | Justification |
|---|---|---|---|---|
| Code | ... | ... | = | exact functional parity |
| Build | ... | ... | > | adds CI gate not in legacy |
| Deploy | ... | ... | = | both ArgoCD-driven |
| Traffic | ... | ... | = | same hostnames, same TLS termination |
| Users | ... | ... | = | preview/feat envs unchanged |
```

### G2. Diagrams Mandatory (NEW skill `design-diagram` + Lane 7 task)

**New skill:** `design-diagram` — produces architecture diagrams as code (Mermaid by default; D2 fallback). Three diagram types required per Lane 7:

| Type | Purpose | Format |
|---|---|---|
| **Topology — legacy** | High-level: components, traffic flow, ownership | Mermaid `flowchart` or `graph` |
| **Topology — new** | Same shape; what changed visible at first glance | Mermaid + matching layout |
| **Per-layer detail** | One per layer that has non-trivial change | Mermaid `sequenceDiagram` for flows, `flowchart` for static |
| **Delta** (optional but recommended) | Side-by-side or overlay highlighting added/removed/changed | Mermaid with color hints |

Diagrams stored as code (not images) at `<project>/docs/diagrams/<topic>/<name>.mmd`. Rendered via VS Code preview / GitHub native or CI.

**Skill output protocol:** `design-diagram` produces .mmd files + a stub markdown that embeds them. plan-changeset's mandatory-step validation must check that all required diagrams exist before accepting the plan.

### G3. Layered Explanation (NEW plan-changeset section)

For each layer in G0/G1, the plan MUST contain:

| Sub-section | Audience | Length |
|---|---|---|
| **High-level (legacy)** | non-tech / stakeholders | 3-5 sentences |
| **Low-level (legacy)** | implementer | unbounded — code refs, manifests, command lines |
| **High-level (new)** | non-tech | 3-5 sentences mirroring high-level legacy |
| **Low-level (new)** | implementer | unbounded — same depth as legacy |

Plan-changeset rejects plans where any of these is empty or "TBD."

### G4. Reality-Grounding Citation Rule (extends AP-29)

Every claim in the plan / design authority / WI / triangulation matrix MUST cite one of:

- **File path + line range** — `docs/skills/legacy-istio-ezbob/SKILL.md §3 lines 45-52`
- **Live command + recent date** — `verified via 'kubectl get vs -A --context express-qa' 2026-05-01`
- **Framework knowledge cite** — `seriousvibecoding/.../CAPABILITIES.md §1 (verified 2026-05-01)`
- **Existing rule cite** — `rules/k8s/eso-vault.md`
- **Commit hash** — for legacy state captured before refactor

A claim with no citation is a CONTRACT VIOLATION at review-gate. Implements: AP-31.

### G5. Knowledge Freshness Gate (extends AP-30 — fail-closed)

Before plan-changeset accepts a Lane 7 plan, verify EACH framework knowledge file referenced:

```bash
# Pseudo-check at plan acceptance
for ref in $(plan_referenced_knowledge_files); do
  version_date=$(read .version of $ref)
  age_days=$(( (now - version_date) / 86400 ))
  if [ -z "$version_date" ]; then
    FAIL "Knowledge file $ref has no .version — refuse acceptance until research skill runs"
  elif [ "$age_days" -gt 30 ]; then
    WARN "Knowledge file $ref is $age_days days old — recommend re-research before commit"
  fi
done
```

Blocks plan acceptance if any referenced framework knowledge has no `.version`. Warns if >30 days. Auto-routes to `/research` to refresh.

### G6. External Skill ↔ Knowledge Cross-Check (NEW skill `audit-skills-vs-knowledge`)

**Premise:** installed skills (in `~/.claude/skills/`) carry operational knowledge that may contradict — or pre-date — framework knowledge files. The framework currently has no protocol for detecting and resolving this.

**New skill:** `audit-skills-vs-knowledge` runs:

1. List all installed skills
2. For each skill, extract claim-like statements (assertions about how things work, version numbers, API shapes)
3. Match each claim against framework `references/knowledge/domains/<domain>/CAPABILITIES.md` if a corresponding domain exists
4. Output a 4-column report:

| Skill | Claim | Framework knowledge says | Verdict |
|---|---|---|---|
| `argocd-gitops-ops` | "use sync wave -1 for setup hooks" | (no ArgoCD domain doc yet) | UNDETERMINED — extract domain doc first |
| `k8s-istio-gateway` | "VirtualService is the canonical CORS path" | "v1.3 native HTTPRoute CORS filter is canonical 2026-05-01" | SKILL OUTDATED — update or supersede |
| `eks-cluster-provision` | "deploy_addons=true for new clusters" | (no EKS domain doc yet) | KNOWLEDGE GAP — extract |

**Verdicts:**
- `MATCH` — both agree → no action
- `SKILL OUTDATED` — framework knowledge is fresher → update skill OR mark deprecated
- `KNOWLEDGE OUTDATED` — skill is newer (rare; flag for re-research)
- `UNDETERMINED` — no framework knowledge yet → extract via `/research`
- `CONTRADICTION` — both fresh, both confident, both disagree → user decision required

### G7. Skill Promotion Pipeline (NEW Lane 7 final task)

When a Lane 7 port pattern works (G2-G5 all green, end-to-end verified), the lane's last task is:

- **`should this become a skill?`** — if the same migration pattern will hit again (e.g., another team migrating VS → HTTPRoute), capture as a `migrate-<topic>` skill at `~/.claude/skills/migrate-<topic>/SKILL.md`.

Skill is generated from the working triangulation matrix + recipes. NOT auto-installed; user opts in. The skill becomes a fast path for the next instance.

If pattern is genuinely one-off → mark Lane 7 closed without skill creation; document the one-off reasoning in the design authority.

### G8. Plan-Changeset Acceptance Gate (Lane 7 specific addition)

`plan-changeset` cannot mark a Lane 7 plan accepted unless:

- [ ] G0 production-baseline.md exists with all 5 layers green or explicit downgrade rationale
- [ ] G1 port equivalence contract present, all layers verdicted, no blanks
- [ ] G2 diagrams exist (3 minimum: legacy topology, new topology, ≥1 per-layer detail)
- [ ] G3 layered explanation present for each layer (4 sub-sections per layer, no TBDs)
- [ ] G4 every plan claim has citation (file + line, command + date, knowledge cite, rule cite, or commit hash)
- [ ] G5 every framework knowledge reference has fresh `.version`
- [ ] G6 skill cross-check report attached, no unresolved CONTRADICTIONS
- [ ] WI created for any UNDETERMINED knowledge gaps
- [ ] Foundation gates (F1, F2, ...) listed at top, dependencies explicit

`review-gate` then checks the same list before approval.

## Proposed Lane 7 task graph (after upgrade)

```
0.  validate-feature                   — confirm migration is in scope
0.5 production-use-verification (G0)   — prove A works on all 5 layers
1.  /research                          — refresh / build framework domain knowledge (AP-30 coverage check)
2.  extract-legacy-skill               — write project-local legacy skill
3.  extract-new-side-skill             — write project-local new-side skill
4.  live-checklist                     — re-runnable script + generated table
5.  audit-skills-vs-knowledge (G6)     — cross-check installed skills vs framework knowledge
6.  design-diagram (G2)                — produce legacy + new + per-layer diagrams
7.  port-equivalence-contract (G1)     — write the contract table
8.  layered-explanation (G3)           — high+low for legacy AND new, per layer
9.  design-tech (matrix mode + G4)     — triangulation matrix with citations on every row
10. explore-solutions                  — for non-trivial alternatives in any "BEST port"
11. plan-changeset (G5 + G8)           — knowledge-freshness check + acceptance gate
12. review-gate                        — verifies G8 checklist
13. execute-changeset                  — actual port; commits cite matrix row ids
14. land-changeset
15. verify-promotion                   — runtime evidence per affected capability
16. skill-promotion (G7)               — capture pattern as skill if reusable
17. close WI + record learnings
```

This is 17 steps vs Lane 7's current 13. The four added (G0, G6, G2, G7) reflect the user's explicit demands. G1, G3, G4, G5, G8 are checks layered onto existing steps.

## What this proposal does NOT do

- Does not auto-implement (gates required user approval per route-workflow rules)
- Does not break existing Lanes 1-6 (Lane 7 specific)
- Does not require existing WIs (WI-006/008/009) to retroactively run all 17 steps; they run the upgraded lane only if user opts in
- Does not auto-generate diagrams from code (out of scope; `design-diagram` produces Mermaid templates the agent fills in)

## What this proposal asks the user to approve

1. **Add G0 Production-Use Verification Gate** to Lane 7 — yes/no
2. **Add G1 Port Equivalence Contract** to Lane 7 acceptance gate — yes/no
3. **Create new `design-diagram` skill** — yes/no
4. **Add G3 Layered Explanation** mandatory in Lane 7 plans — yes/no
5. **Add G4 Reality-Grounding Citation Rule** as AP-31 — yes/no
6. **Strengthen G5 Knowledge Freshness Gate** to fail-closed at plan acceptance — yes/no
7. **Create new `audit-skills-vs-knowledge` skill** (G6) — yes/no
8. **Add G7 Skill Promotion Pipeline** as Lane 7 final task — yes/no
9. **Add G8 Plan-Changeset Acceptance Gate** for Lane 7 — yes/no
10. **Apply upgraded Lane 7 to in-flight WI-006** (cmp-common 0.5.0) before execution? — yes/no/partial

## Implementation effort estimate (after approval)

| Item | Effort |
|---|---|
| Update `route-workflow/SKILL.md` Lane 7 section | 30 min |
| Update `research/SKILL.md` (AP-30 fail-closed) | 15 min |
| Update `plan-changeset/SKILL.md` (G8 acceptance gate) | 20 min |
| New skill `design-diagram/SKILL.md` | 60 min (defines Mermaid templates, doesn't auto-generate) |
| New skill `audit-skills-vs-knowledge/SKILL.md` | 90 min (most complex; produces 4-column report) |
| New AP-31 entry | 10 min |
| Apply to WI-006 retroactively (regenerate design authority with citations + diagrams + production baseline) | 2-3 hours |
| **Total framework changes** | **~3.5 hours** |
| **EzBob retrofit** | **2-3 hours** |

## Decision request

Approve all 10 items, approve a subset, or reject and discuss. If approved, implementation order is:

1. AP-31 + Lane 7 SKILL update (foundation)
2. `design-diagram` skill
3. `audit-skills-vs-knowledge` skill
4. plan-changeset G8 acceptance gate
5. research G5 fail-closed
6. apply to WI-006

If rejected for now: framework continues with current Lane 7 (loose enforcement). EzBob WI-006 proceeds with the design authority as-is plus the user manually requesting any of these gates as needed.
