# Artifact Sets — Phase and Type (§5)

Quote-derived verbatim from `proposals/2026-08-02-one-lane-framework.md` (the
tables sit within §4f, ahead of "What this proposal does NOT claim"; the
"Order of implementation" table labels them "§5 phase/type artifact sets" —
there is no separate `## 5` header in the source, so this is the exact text
that reference resolves to).

Declared once in the project's own state file (`Product phase:` / `Product
type:` under `## Position` in `docs/specs/project-state.md` — see
`route-workflow/references/project-state.md`); the chain derives the
required artifact set from them. A **phase transition** (first live user,
first payment) **re-opens** the stages the new phase adds.

## Phase

| Phase | Adds |
|---|---|
| `pre-revenue` (pre-revenue, no live users) | QA companion · index · receipts |
| `live-users-no-money` (live users, no money) | + marketing context · analytics · privacy/compliance |
| `taking-money` (taking money) | + pricing model · monetisation · fee/billing docs · finops |
| `scaling` (scaling) | + perf budgets · capacity · incident runbook |

## Type

| Type | Adds |
|---|---|
| consumer mobile | device-proof · store metadata · push & permissions |
| marketplace | trust & safety · dispute path · payout compliance |
| B2B SaaS | tenancy isolation · data export · SLA |
