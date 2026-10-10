---
name: addon-gateway
version: "1.0"
description: >
  Run one playbook from an installed add-on pack (coreyhaines marketing: CRO, copy, SEO, ads,
  email, launch, pricing, prospecting, churn…) without listing every add-on skill. Use for a
  named add-on skill or marketing execution work. Not svc's own marketing context (analyze-marketing).
argument-hint: "[add-on skill name] [task]"
inputs:
  required:
    - { artifact: user-request, note: "The marketing or add-on task, optionally naming the add-on skill." }
  optional:
    - { path: "docs/specs/marketing-context.md", artifact: marketing-context, note: "svc canonical marketing context from analyze-marketing; read first when present." }
    - { path: ".agents/product-marketing-context.md", artifact: product-marketing-context, note: "Legacy filename the add-on skills fall back to." }
outputs:
  produces:
    - { artifact: addon-playbook-output, note: "Whatever the chosen add-on playbook produces, in chat or the paths it names." }
chain:
  lanes: {}
  terminal: true
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# Add-on Gateway

**Announce at start:** "I'm using addon-gateway to load the one add-on playbook this task needs."

Add-on packs (for example the 46 coreyhaines marketing skills) would add about 31K characters to the skill listing in every session if installed as global skills. This gateway keeps them on disk and loads only the playbook a task needs.

## Installed add-on index

!`node "${CLAUDE_SKILL_DIR}/scripts/addon-index.mjs"`

If no index appears above (a host without inline command expansion), run `node <this skill's directory>/scripts/addon-index.mjs` yourself.

## Preflight

1. If the user named a skill that is already in your skill listing (installed as a plugin or global skill), invoke it directly instead and stop here.
2. Pick exactly one add-on skill from the index whose description fits the task. If two fit, pick the narrower one and say which you skipped. If none fits, say so and do the task without an add-on.
3. Get its file: `node "${CLAUDE_SKILL_DIR}/scripts/addon-index.mjs" --path <name>`.

## Before Starting

Read `docs/specs/marketing-context.md` if it exists; it is svc's canonical product and audience context and outranks the add-on's own context questions. Then read the chosen add-on `SKILL.md` in full and follow it as if it had been invoked. Load a file it references only when the step you are on needs it.

## Run the playbook

- Follow the add-on's steps and output format. Where it asks the user for context that `docs/specs/marketing-context.md` already answers, use the file and say so.
- Keep svc's evidence rules: no invented metrics, customers, quotes or results; label assumptions.
- Anything outward-facing (sending email, posting, buying ads, contacting people) stays a draft unless the user explicitly approves the exact content, account and time.
- To chain a second add-on skill, repeat Preflight for it; never load the whole pack.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | One playbook loaded | Only the chosen add-on `SKILL.md` (and files its current step needed) was read. | |
| 2 | svc context used | `docs/specs/marketing-context.md` was read when present and preferred over re-asking. | |
| 3 | Claims grounded | Every figure, customer or result traces to user input or a cited source, or is labelled an assumption. | |
| 4 | Outward actions gated | Nothing was sent, posted or bought without explicit approval of the exact content. | |

## Pipeline Continuation

This is a terminal skill with no automatic downstream lane. When invoked inside a WI, source of truth: `.svc/lane-tasks-<WI>.json`. Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. In Codex, mirror only the active step in `update_plan`; other host task UI is also a mirror. Update only this skill's task with the output path and the self-verification result, then stop. Standalone use needs no WI or repository artifact.

Live evidence: not-applicable (no deployed product visual artifact).
