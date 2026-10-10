---
name: design-sync
version: "1.0"
description: >
  Import a product's existing design from code into Claude Design (design system + canvas),
  record why it looks the way it does, propose improvements as side-by-side artboards, and
  sync the chosen ones back to code. Also storyboards ad-video motion before rendering.
  Use for "import our design", "put this in Claude Design", "improve our UI", "storyboard this ad".
argument-hint: "[import|improve|sync-back|storyboard] [path or URL]"
inputs:
  required:
    - { artifact: user-request, note: "Which mode, and the repo path, live URL or ad beat sheet to work from." }
  optional:
    - { path: "docs/design/design-rationale.md", artifact: design-rationale, note: "Why the current design is the way it is; created on first import." }
    - { path: "docs/specs/", artifact: feature-specs-and-journeys, note: "Journeys and personas that improvements must serve." }
    - { artifact: ad-beat-sheet, note: "From ad-video-script, for storyboard mode." }
outputs:
  produces:
    - { artifact: claude-design-system, note: "Claude Design 'Design System' artifact built from the code's real tokens, fonts and assets." }
    - { artifact: claude-design-canvas, note: "Claude Design canvas: current screens as the baseline, proposals beside them, or ad storyboard frames." }
    - { path: "docs/design/design-rationale.md", artifact: design-rationale, note: "Evidence for each design choice; improvements are judged against it." }
    - { path: "docs/design/tokens.json", artifact: design-tokens, note: "Repo copy of the system's tokens; source for sync-back." }
chain:
  lanes: {}
  terminal: true
  progressive: false
  self_verify: true
  human_checkpoint: true
---

# Design Sync

**Announce at start:** "I'm using design-sync to bring the design into Claude Design, defend what works and propose what to change."

Claude Design has two artifact types: a **Design System** (tokens, brand-book README, component previews, assets) and a **Design** canvas (artboards). This skill connects them to the repo in both directions. It never invents a brand: every value comes from the code, files or assets the product already uses.

## Preflight

1. Pick the mode from the request: `import`, `improve`, `sync-back` or `storyboard`. "Make our UI better" with no system yet means `import` first, then `improve`.
2. Publishing to Claude Design needs the Artifact tool. Without it, produce the same files locally (`docs/design/`) and say the publish step is pending.
3. Find the sources: CSS files with custom properties (`:root`, dark theme blocks, Tailwind v4 `@theme`), font files, logo and icon assets, and a live URL if one exists. List them before reading further.

## Before Starting

Read, in this order and only what the mode needs: the repo's token sources (CSS custom properties, theme files), `docs/design/design-rationale.md` and `docs/design/tokens.json` if they exist, the journeys and personas the screens serve (`docs/specs/`), and for `storyboard` the beat sheet. For an existing Claude Design system or canvas, `read` its `project/README.md`, `project/tokens.json` or `project/canvas.json` first, never its page. Skip product specs unrelated to the screens in scope.

## import

1. **Extract tokens from code, exactly:**
   `node <SKILLS_PATH>/scripts/design-tokens.mjs extract <css files> --name "<Product>" --out docs/design/tokens.json`
   Read the "not converted" list it prints and fix each one at the source or record it in the rationale. Never approximate a value. Copy logos, icons and fonts as files.
2. **Defend the current design** in `docs/design/design-rationale.md`, with one entry per foundation (colour, type, spacing, radius, key components). Each entry gives:
   - what it is,
   - the evidence for why: a spec, a journey, the brand assets, a commit message or a user decision, with `file:line` or commit,
   - who it serves (a persona or journey from `docs/specs/`),
   - its known costs.

   "Unknown" is allowed when there is no evidence; never write a reason that isn't sourced. This file is what stops later improvements from undoing choices that were made on purpose.
3. **Check it:** add `usage` notes in the form "Body text on surface", then run `node <SKILLS_PATH>/scripts/design-tokens.mjs contrast docs/design/tokens.json`. Keep failing pairs as they are, flag them in the rationale, and carry them into `improve`.
4. **Publish:**
   - Create a Claude Design **Design System** from these files, following that type's instructions (it reads `project/tokens.json` and `project/README.md`). The README is the brand book, written from the rationale.
   - Create a **Design** canvas with the current key screens as the baseline artboards. Recreate them from the real code, or place screenshots of the live URL as images. Install the new design system on the canvas.

## improve

1. Read the rationale, the contrast report and the journeys first. Every proposal must name the problem it fixes, with evidence:
   - a contrast failure,
   - a journey step that is slow or confusing,
   - an inconsistency between components,
   - a stated goal.

   Taste alone is not evidence.
2. Put each proposal on the canvas **beside** its baseline artboard (same size, title `Proposal: <problem>`), never over it. Two or three strong options beat ten.
3. In your reply, score each proposal **keep / change / try**, with the trade-off against the rationale entry it touches. A proposal that undoes a sourced choice must say so and why the evidence changed.
4. Stop for the person to choose (human checkpoint). Their choice and its reason go into the rationale.

## sync-back

1. Update `docs/design/tokens.json` from the chosen design (read the Design System's `project/tokens.json`), then generate CSS: `node <SKILLS_PATH>/scripts/design-tokens.mjs export docs/design/tokens.json --out <the repo's token css>`.
2. Code changes beyond tokens (components, layout) go through the normal svc chain: `route-workflow` → write-spec / plan-changeset with the chosen artboards as the design reference. Re-run `contrast` and the repo's visual checks before landing.

## storyboard (ad video motion)

1. Take the beat sheet from `ad-video-script`. Create a Design canvas with one artboard per beat, in order, at the placement's aspect ratio (9:16 = 1080×1920 shown at 405×720; 1:1; 16:9).
2. Each frame shows the first-frame composition (product as it really looks, the on-screen text, the brand tokens from the design system), with the beat's motion note as a canvas note: camera move, subject action, duration and the last-frame hand-off to the next beat.
3. Motion values the Design System has no family for (durations, easings, transition styles) go in `docs/design/motion.json` as `{"tokens":[{"name","value","usage"}]}`, so ads and UI share one motion language.
4. Stop for approval, then hand the approved storyboard to `produce-ad-video`. Rendering is where the money goes, so a wrong frame should be caught here.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Values are exact | Every token traces to a source file; `design-tokens extract` "not converted" items are fixed or recorded. | |
| 2 | Rationale is sourced | Each rationale entry cites a file, commit, journey or user decision, or says unknown. | |
| 3 | Contrast checked | `design-tokens contrast` ran; failures are flagged, not hidden. | |
| 4 | Proposals beside baselines | Each proposal artboard sits next to its baseline and names the evidenced problem it fixes. | |
| 5 | Human chose | Nothing synced back or rendered before the person picked. | |
| 6 | Sync-back through the chain | Token CSS came from `design-tokens export`; other code changes went through route-workflow. | |

## Pipeline Continuation

This is a terminal skill with no automatic downstream lane. When invoked inside a WI, source of truth: `.svc/lane-tasks-<WI>.json`. Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. In Codex, mirror only the active step in `update_plan`; other host task UI is also a mirror. Update only this skill's task with the artifact links, the rationale path and the self-verification result, then stop. `sync-back` code work continues through `route-workflow`; `storyboard` continues to `produce-ad-video` after approval.

Live evidence: required for `improve` and `sync-back` on a deployed product: a screenshot or rendered artboard of the current screen next to the proposal. `import` and `storyboard` cite their source files instead.
