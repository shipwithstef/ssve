---
description: Debugging correction — for "UI dead but app alive" bugs, capture the runtime discriminator BEFORE any speculative fix; static review must declare its scheduling blind spot
scope: global
stack: universal
type: correction
source: local
last_evaluated: "2026-07-13"
---

# Rule: Runtime Discriminator First — no speculative fixes for "UI dead but app alive" bugs

When a report says **some controls stopped responding while the app is
otherwise alive** (other buttons work, animations run, part of the screen
responds), you MUST capture a runtime discriminator from the failing
environment BEFORE building any fix. Theories from static code review do not
count as evidence for this bug class.

## The probe ladder (run it in order, stop at the first break)

For a dead control, instrument each stage and find WHERE the chain breaks:

| Stage | 1-line probe | Breaks here means |
|---|---|---|
| 1. Input delivery | capture-phase `touchstart`/`pointerdown` logger on `document` | OS / compositor / hit-test problem |
| 2. Click synthesis | capture-phase `click` logger (`target`, `defaultPrevented`) | gesture claimed / preventDefault upstream |
| 3. Handler execution | log inside the component handler (or listener on the control's element) | framework dispatch / listener wiring |
| 4. State/router change | `location.hash` (or store snapshot) after the tap | handler logic no-ops |
| 5. **COMMIT** | does the RENDERED UI match the new state? | **scheduling: the update never commits** |

Stage 5 is the one static review is structurally blind to. `location.hash`
changed while the screen didn't = a one-line observation that identifies
render-commit starvation. Ship instrumentation builds (loggers, forensics,
`webContentsDebuggingEnabled` for Android release WebViews) BEFORE fix
builds — an instrumented build that changes nothing beats a plausible fix
that changes the wrong layer.

## The scheduling blind spot (concurrent React and equivalents)

Static review verifies elements, listeners, and handler logic — it CANNOT see
priority inversion between updates. Any "no defect found" verdict on this bug
class MUST state: *"static review cannot exclude scheduling/priority
starvation — runtime probe required."*

Mandatory review-checklist item for React 18+ codebases using
react-router v7 (or v6 with the `v7_startTransition` future flag), `startTransition`, `useDeferredValue`, or Suspense:

> **Flag every unconditional state update wired to a high-frequency source**
> (map `idle`/`move` events, scroll, resize/ResizeObserver, rAF loops,
> `watchPosition`, realtime/WebSocket messages, intervals) that (a) creates a
> new object/array identity every call, and (b) has no change-guard and no
> `startTransition`. Router navigations are transitions — continuous urgent
> updates can postpone them **indefinitely**: the URL changes, the UI never
> switches, and every nav control "looks dead".

Typical fix shape: a change-guard (skip identical payloads) and/or
`startTransition` on the real updates — the guard kills the churn at the
source, the transition removes the priority inversion; apply per case.

## Reporter phenomenology outranks reviewer models

The user's raw observations ("this button works, that one doesn't", "toggling
X heals it") are the SPEC of the bug. Every hypothesis must fit EVERY
observation before it earns a build; re-interpreting an observation to fit a
theory is the failure mode. Track observations as a behavioral matrix
(control × state × works?) and kill hypotheses against it.

## Origin (2026-07-13, example-marketplace WI-RESUME-FREEZE-01)

Android "bottom nav dead in map view". THREE speculative device builds for
this symptom (vc74 renderer/GL hardening, vc75 insets re-dispatch, vc76
geometry clamp + compositor isolation) and three static reviews (two models +
orchestrator, with a PROVEN/REFUTED ledger) all targeted layers below or
above the real failure and changed nothing. The user had said "it's a state
issue" in the first report. A 30-second chrome://inspect probe then showed:
tap delivered ✓, click synthesized ✓, `location.hash → '#/favorites'` ✓,
screen frozen on the map ✗ — react-router v7 navigations (startTransition,
low priority) were starved forever by `refreshViewportList` calling
`setViewportLocations(newArray)` unconditionally from the map's
`idle`/`moveend` events. Implemented in one commit (dedupe + startTransition) once the probe ran, and
user-confirmed fixed on device (vc78; recorded in the product repo's
WI-RESUME-FREEZE-01 investigation log). The console probe itself takes ~30
seconds — plus, for release Android builds, one instrumented build to enable
WebView remote debugging first.

Pair with `post-fix-evidence-before-next-fix.md` (no next speculative fix
without evidence the previous one changed behavior) and
`mobile-ui-verification-gate.md`.
