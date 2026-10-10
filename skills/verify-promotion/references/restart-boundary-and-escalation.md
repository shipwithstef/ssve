## Restart-Boundary Continuation (WI-552)

Check for a continuation baton before starting ordinary verification:

```bash
node scripts/resolve-continuation.mjs status --wi "$WI"
```

**No baton, or no WI declared `requires_fresh_session`:** proceed with
ordinary verification below. Zero new sessions are launched (AC-552-8).

**Baton exists and is `deploy_stamped` or `blocked` (retryable):** this run
IS the lifecycle controller. Ask the WI-551 resolver for role
`verify.restart` and launch EXACTLY ONCE — never twice, never a silent
Claude/Codex remap of a host the owner policy did not select:

```bash
node scripts/resolve-continuation.mjs reconcile --wi "$WI"
```

- If the result is `blocked` with `code: capability_limited`, the target
  host has no `fresh_session_launch` capability declared in
  `provision/hosts/<host>.json`. Report the single explicit blocker per the
  Boundaries in `docs/specs/work-items/WI-552.md` — do not treat owner
  copy/paste as success and do not substitute a different host.
- If `launched`, STOP here in this session. The launched child session is
  the one that continues G7 for this baton; report the launch receipt and
  exit. Read-only proof needs no mutating lease (AC-552-5).

**This session IS the freshly launched continuation child** (detect via
`SVC_SESSION_ID` matching the baton's latest `launches[].session_id` from
`status`): run ONLY the declared verification/closeout tasks. The
`svc-continuation-phase-guard` PreToolUse hook mechanically denies
`diagnose-bug`, `plan-changeset`, and `execute-changeset` for this session
(AC-552-4) — do not attempt to route around it. Produce a structured result
(never free-text "looks good" or "prompt to send" — AC-552-7) and consume it
to close the baton:

```bash
node scripts/resolve-continuation.mjs consume --wi "$WI" --result '{
  "schema_version": 1, "wi": "<WI>", "session_id": "<this session id>",
  "started_at": "<ISO timestamp>", "event_status": "success",
  "proof_query": "<must equal the baton boundary.proof_query>",
  "ac_mapping": [{"ac": "AC-552-1", "status": "pass"}],
  "artifacts": ["<evidence path>"], "verdict": "pass"
}'
```

`consume` rejects a result whose `session_id` equals the implementation
session, does not match the exact launched session, or whose `started_at`
is not strictly after the deploy receipt — these are freshness violations,
not warnings (AC-552-2). If the parent process died after launch, a fresh
`reconcile` call resumes from the ledger without spawning again (AC-552-9).

## Verification Escalation Ladder

**Verification is AI-first. User handoff is the LAST option, not a shortcut.**

When a verification claim needs proof, attempt tiers in order. Do not skip to a higher tier without exhausting the lower one. Every skip to a higher tier requires a documented reason in the verification report.

**HARD-GATE — AP-31: behavioral runtime verification is the agent's job, not the user's.** Punting to V3 ("open the app on your phone, tap X, confirm Y") without an explicit V2 exhaustion log citing every V2 mechanism attempted and the specific technical reason each failed is `runtime-verification-user-delegation` HIGH severity per `references/anti-patterns.md` AP-31. Visual aesthetic review IS legitimate V3 scope. Behavioral verification (button registers click, body interactivity restored, navigation flips correctly, deploy markers present) is NEVER the legitimate V3 scope. If you find yourself writing "the final eyeball is yours" or "open the app on your phone" for a behavioral AC, STOP — return to V0/V1/V2 and exhaust them first. The cost asymmetry favors the agent: ~$0.05 to run a Playwright probe vs. erodes-user-trust to punt.

| Tier | What | When | Cost |
|---|---|---|---|
| **V0 — Static/structural** | Grep committed diff, confirm deploy state `ready`, check router-context deploy matrix satisfied | Always first. Confirms shipped code matches intent. | ~10s |
| **V1 — Live DOM** | Navigate to affected URL via `browse` daemon or Playwright MCP. Assert DOM elements exist with correct attributes, CSS classes applied, aria-labels, data-testids, role-account visibility | After V0. Confirms production render. | ~30s |
| **V2 — Live interaction** | Login via E2E account pool; trigger interaction; observe handler fires via network request or console. For gesture/touch: try (a) Playwright device descriptor with `hasTouch:true`, (b) CDP `Input.dispatchTouchEvent` (trusted events), (c) React fiber direct invocation of the handler prop, (d) existing E2E suite replay, (e) add a testability seam (data-testid + imperative API) and retry | After V1 when behavior is interaction-gated. | ~2min |
| **V3 — User delegation** | Ask user to verify on real device / paste screenshot / confirm aesthetic quality | LAST RESORT. Only after V2 exhaustion log documents every V2 mechanism attempted and the specific technical reason each failed. | minutes–hours |

### V2 Exhaustion Log (mandatory before V3)

When V2 cannot complete, the verification report MUST include:

```markdown
## V2 Exhaustion Log

Attempted V2 mechanisms (in order):

1. <mechanism name> — <failure signature> — <technical reason it couldn't complete>
2. <mechanism name> — <failure signature> — <technical reason>
3. ...

**V3 handoff justification:** <structural platform constraint OR aesthetic/subjective claim OR named technical limitation>
```

**"I didn't think to try X" is not a valid V2 exhaustion.** Reference `references/verification-patterns.md` for the catalog of V2 techniques.

### Classification rules

- **Functional claim** (element present, handler fires, class applied, network request made, aria-label exists) → V1 or V2. NEVER V3 by default.
- **Aesthetic claim** (looks polished, feels native, color is right, spacing feels off) → V3 is valid after V1 confirms the structural primitives are in place.
- **Structural platform constraint** (Base44 auth domain-scoped pre-deploy; OS-level Chrome overscroll not JS-driven) → V3 is valid; cite the constraint in the exhaustion log.

### AI-first enforcement

`review-gate` G7 FAILs any verification report whose evidence trail ends at "user confirmed" for a functional claim without a V2 exhaustion log. See `references/anti-patterns.md` AP-28 (Premature User Handoff).

**Confidence tiers in the report:**

- `VERIFIED` — V0+V1+V2 all PASS (full AI verification)
- `VERIFIED-L2` — V0+V1+partial V2 PASS; one V2 mechanism hit a documented technical limit; exhaustion log present
- `VERIFIED-USER` — V3 handoff with justification (structural constraint or aesthetic claim); V2 exhaustion log present
- `UNVERIFIED` — no tier passed; cannot declare VERIFIED
