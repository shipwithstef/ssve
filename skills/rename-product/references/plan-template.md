# Plan template

Copy this to `docs/plans/<date>-<newname>-migration/PLAN.md`. Replace the angle-bracket slots. Do not invent a product name in the template itself.

```markdown
# <newname> migration plan

Status: draft | accepted for execution
Evidence: `evidence/`
Lane: Lane 10 Infra Migration (`skills/route-workflow/references/lane-model.md`)
Cutover runbook: `skills/design-ui/templates/infra-cutover-runbook.md`

## Goal

<newname> runs end to end under its own name: repo, packages, copy, cloud resources, domain, docs, local folders, and agent memory. Deletion happens only in Lane 10 Phase 20+.

## Scope

- In scope: <product, accounts, repos, origins>
- Neighbours in the same account, not in scope: <names>
- Explicit non-goals: <holds that this programme must not release, such as turning on a new paid dependency>

## Chosen name

- Name: <newname>
- Domain check: evidence/R-receipt.md
- Trademark note: evidence/R-receipt.md (not a legal opinion)

## Lane 10 map

One row per receipt in `skills/rename-product/SKILL.md`. Name the Lane 10 phase, the evidence file, and the rename-specific gate. Do not restate the runbook.

## Identifier classes

Link Phase 5a `docs/specs/migrations/<slug>/source-state.md` and the `plan-changeset` Migration / sweep inventory. Do not paste a second source list. The P0 addition is the occurrence class of each linked hit.

## Approvals

Point at the approval blocks in `skills/rename-product/references/phase-gates.md`. One block per new resource, and separate blocks before stopping production, rotating credentials, switching traffic, and deploying.

## Founder actions

Actions only the owner can take: each approval block, domain registration, store-listing edits, OAuth console changes, and the local-move checklist after this session closes.
```

Create `evidence/` beside the plan before the first receipt. Receipts name setting names and actions, never values.
