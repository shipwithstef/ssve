# Framework Improvement: Cross-System Flow Paradigm — System Contract Maps + Falsification Probes + Iteration Cap

**Status:** OPEN — proposed 2026-04-29
**Severity:** HIGH — applies to any project with auth, payments, sync, or third-party-platform integration
**Source:** Example Marketplace WI-164 (Capacitor native login). Five AAB iterations (v7, v10, v12, v13, v14) shipped before landing on the actual root cause. Each iteration's `diagnose-bug → plan → execute → review-gate → ship` cycle individually passed structural verification while the user-experienced flow remained broken.

---

## 1. The pattern

A "cross-system flow" is any user-visible behavior that traverses ≥2 of: a foreign platform/SDK, multiple origins (web vs native vs API), multiple protocols (HTTP vs deep-link vs intent), multiple storage layers (cookie vs localStorage vs URL fragment vs API response body). Examples: OAuth round-trips, payment webhooks, push-notification token registration, mobile↔web data sync, SSO, device pairing, file upload pipelines.

**The class of bug specific to cross-system flows:** the bug does not live in any one component. It lives in the contract between components — a shape mismatch (token in localStorage vs URL), a layering surprise (App Links intercepts before bridge JS runs), a hidden invariant (`/login` UI uses programmatic auth + localStorage; `/api/apps/auth/login` uses redirect + URL token; both are "Base44 login" but route through totally different mechanisms).

Each individual component "works." The component-level tests pass. The structural verification passes. The user-experienced flow is broken anyway because nobody mapped the inter-component handoffs explicitly.

## 2. Evidence — the WI-164 odyssey

Five iterations on the same work item. Each diagnosis was correct in isolation; each fix was real. None converged because the diagnostic frame was always single-component.

| AAB | Diagnose-bug round | Fix shipped | Why it failed (only knowable in retrospect) |
|---|---|---|---|
| v7 | Race + missing intent filter + HashRouter anchors + token-not-rechecked | Module-level patch, custom-scheme intent filter, reload after token, scroll helper | All real fixes. Did not address that v7 itself depended on Base44 redirecting to `com.example-marketplace.app://`, which Base44 didn't allow. Never tested end-to-end with credentials. |
| v10 | dev/prod app_id mismatch | New `base44RuntimeConfig.js`, native runtime detector, cold-start `getLaunchUrl()` | Real fix. Did not change the redirect-domain problem. Same end-to-end failure. |
| v12 | `/login` UI drops `from_url` when Google clicked (custom scheme) | Bypass `/login` UI entirely, call `/api/apps/auth/login` directly with custom scheme `from_url` | Real observation; the bypass worked outbound to Google. The return-leg validator rejected the custom scheme (Slack error). Discovered post-ship. |
| v13 | Base44 server-side validator rejects custom scheme as `from_url` | Switch to `/login` UI + HTTPS callback `from_url` | Validator now passes. Login chooser now appears (tested with runtime probe). After auth, the bridge `AppCallback.jsx` only reads URL for the token. SDK puts the token in localStorage. Auth loop. Discovered when user actually authenticated for the first time in the lane. |
| v14 | `AppCallback.jsx` never reads localStorage | Add localStorage fallback | Fixed (pending Play Store install confirmation). |

**What every iteration had in common:**
1. `diagnose-bug` produced a plausible single-component root cause.
2. `plan-changeset` and `execute-changeset` shipped a clean diff.
3. `review-gate` PASSED — bundle-grep confirmed the new constant; manifest grep confirmed intent filters; `versionCode` bumped correctly; AAB built and signed.
4. The user installed and the flow still failed.
5. Restart.

**What every iteration was missing:**
- An explicit map of the FULL token-flow contract: who writes the token, in what shape, where it's stored, who reads it, in what shape, on what origin.
- A probe that would have FALSIFIED the proposed fix before AAB rebuild.
- A halt-and-escalate trigger when the same WI took >2 attempts.

## 3. Why the current paradigm fails this class

Current pipeline: `validate-feature → write-spec → design-ux → design-tech → plan-changeset → execute-changeset → review-gate → write-e2e → land-changeset → verify-promotion`.

For single-component bugs (off-by-one, null guard, stale cache in one query), this pipeline works — `diagnose-bug` localizes the fault, `execute-changeset` patches one place, `review-gate`'s structural checks plus E2E validate behavior.

For cross-system flows it has three blind spots:

**Blind spot 1 — `design-tech` produces a per-feature diagram, not a per-flow contract.** The technical design covers the new feature's components and dependencies. It does not require an explicit handoff table for every inter-component data exchange. So when a bug surfaces, `diagnose-bug` re-discovers the architecture from code, sees the immediate code path, and pattern-matches a fix without examining adjacent handoffs.

**Blind spot 2 — `review-gate`'s structural checks are component-local.** Bundle-grep proves a constant is in the bundle. Manifest grep proves an intent filter exists. AAB build proves the binary signs. None of these prove the cross-system contract holds. A probe that demonstrates the constant is correctly *consumed* by every downstream reader is a different kind of check that the gate doesn't currently demand.

**Blind spot 3 — there is no hard cap on diagnose→fix→fail iterations.** Each round resets to "diagnose-bug starts fresh." Sunk cost on the WI is invisible to the next round's framing. After 2 fails, the right move is "stop iterating and map the entire flow"; the framework doesn't force that.

## 4. Proposal

Three additions, layered. Each is generic and applies to any project with cross-system flows.

### 4.1. New artifact: System Contract Map (SCM)

**What:** A single Markdown file produced before any cross-system code change. Lives at `docs/specs/contract-maps/<flow-name>.md`. Contains:

1. **Flow diagram** (Mermaid or ASCII). Every node = one runtime context (a browser window, a native WebView, a server endpoint, a native intent dispatcher). Every edge = one data handoff.
2. **Handoff table.** One row per edge. Columns: `from`, `to`, `transport` (HTTP redirect / intent filter / postMessage / SDK call / etc.), `data shape`, `where stored at sender`, `where stored at receiver`, `who reads it next`, `failure mode if shape wrong`.
3. **Origin/storage matrix.** Table mapping every storage layer (cookie, localStorage, URL query, URL fragment, native intent extras, native filesystem) to which origin owns it and which contexts can read it.
4. **External-platform invariants.** Bullet list of every assumption about a foreign system's behavior, with the verification source (vendor doc URL, SDK source line, runtime probe result). Each item is a falsifiable claim, not a guess.

**When required:** any WI tagged `auth`, `payments`, `sync`, `oauth`, `webhook`, `deep-link`, `sso`, OR any WI where `diagnose-bug` reaches Step 0.3 and classifies the bug as `Platform`, OR any WI on its second `diagnose-bug` invocation (see iteration cap, §4.3).

**When skipped:** the WI affects a single component within a single origin/protocol/SDK and `diagnose-bug` Step 0.3 classifies as `Code` or `Test-logic`. Document the skip explicitly in the WI.

**Skill that produces it:** new sub-skill `map-system-contract` (one-shot, no chaining). Inputs: WI + relevant feature spec + observed code paths. Output: the file above. Triggered by `route-workflow` pre-lane on the conditions above; also runnable standalone.

**Why it works:** every cross-system bug WI-164 saw was a contract violation that would have been visible the moment someone wrote the handoff table. v7's "the bridge will run in browser" was an unstated invariant. v12's "the `/login` UI preserves `from_url`" was an unstated invariant. v14's "the SDK puts the token in localStorage" was an unstated invariant. Each becomes a row in the table; the row's existence forces verification before code touches anything.

### 4.2. Falsification-mode probes

**What:** every runtime probe authored under `diagnose-bug`, `design-tech`, or `review-gate` must declare BOTH a confirmation step AND a falsification step before running.

```
Hypothesis: <claim>
Confirmation: if <observation X>, hypothesis holds.
Falsification: if <observation Y>, hypothesis is wrong.
Cheapest experiment that produces either X or Y, not just X.
```

If the probe can only produce confirming evidence (e.g., "navigate to `/login`, screenshot the chooser") it is rejected. The probe author rewrites it to include a step that, if the hypothesis were wrong, would visibly fail.

**Concrete WI-164 case where this would have helped:** the v13 P3 probe confirmed `/login` UI rendered the chooser and `from_url` survived to Google. It did not authenticate. A falsification step would have read: "after auth completes (use a test credential), inspect the URL the browser lands on; if it has `?access_token=...`, hypothesis (URL-delivery) holds; if it does not, hypothesis is wrong and the SDK uses an alternative delivery mechanism." Running this probe before AAB v13 would have surfaced the localStorage delivery before the user installed and looped.

**Hook:** the existing `eval-gate-pre` hook already runs on `TaskUpdate(completed)`. Extend it: if a probe artifact is named `*-probe.json` or `*-probe-results.*` and was the load-bearing evidence for the closed task, parse it for both `confirmed` and `falsified_check` fields. If `falsified_check` is missing or null, block the close-out.

**Author obligation:** when an author writes a probe, the probe script must end with a structured emission:

```json
{
  "hypothesis": "...",
  "confirmation_check": { "predicate": "...", "result": "PASS|FAIL" },
  "falsification_check": { "predicate": "...", "result": "PASS|FAIL" },
  "verdict": "hypothesis-holds | hypothesis-rejected | inconclusive — needs <X>"
}
```

`inconclusive` is a legitimate outcome; `hypothesis-holds` requires both `confirmation_check.PASS` AND `falsification_check.PASS` (the falsification check passed = the hypothesis was given the chance to fail and didn't).

### 4.3. Iteration cap on a single WI with mandatory escalation

**What:** `route-workflow` and `diagnose-bug` together track per-WI invocation count via `.svc/lane-tasks-<WI>.json` (already exists; new field `diagnose_bug_invocations`). On the THIRD `diagnose-bug` invocation for the same WI within 14 days:

1. The pipeline halts.
2. The WI is auto-flagged with a `cross-system-suspected` label.
3. `map-system-contract` is force-required (§4.1).
4. `review-cross-model` (existing skill) is force-required before the next `execute-changeset` runs — adversarial review by a second model on BOTH the diagnosis and the system contract map.
5. The user is notified: "WI-X has had 3 diagnose-bug rounds. Pipeline halted. Run `map-system-contract` and `review-cross-model` before resuming."

**Why it works:** the WI-164 odyssey would have halted at v12 (third round). At that point the right move was already "stop guessing single causes; map the whole flow." The framework now enforces that pivot mechanically instead of relying on the agent or user to notice the pattern.

**Why three, not two:** two rounds is normal — first diagnosis often surfaces a partial cause that, when fixed, exposes a deeper one. Three is the smoke signal that single-component framing isn't working.

**Bypass:** user can pass `--no-cap` to `route-workflow` to opt out for one invocation. Logged as a `taste` decision in `pipeline-decisions.jsonl` so the bypass is auditable.

## 5. How these compose

The three additions reinforce each other:

- The **System Contract Map** makes invariants explicit so the **falsification probe** has something specific to falsify.
- The **falsification probe** generates evidence that updates the **System Contract Map**.
- The **iteration cap** triggers both when single-component diagnosis fails twice.

Without (1) and (2), (3)'s halt is just a delay. Without (3), (1) and (2) only help authors who already know to use them.

## 6. Generalization across project types

The WI-164 case was OAuth + Capacitor + Base44 + Android App Links. The same paradigm applies generically. Mapping:

| Project type | "Cross-system flow" example | What the SCM forces visible |
|---|---|---|
| SaaS with payments | Stripe checkout → webhook → DB update → email | Webhook payload shape, retry semantics, idempotency key, race between webhook and redirect-back |
| Mobile app with sync | Local SQLite ↔ remote API ↔ realtime channel | Conflict resolution layer, ordering of write/notify, offline queue contract |
| AI app with streaming | User input → LLM → tool call → tool result → UI | Token boundary across SSE, partial-response state machine, tool-result schema |
| OAuth integration | Provider login → callback → token exchange → API call | Where the token is stored at each hop, what the destination expects to find and where |
| Push notifications | App registers → server stores token → push sent → device receives → user taps → app opens | Token-rotation semantics, payload size limits, deep-link delivery on cold-start vs warm-start |

In every row, the bug class "I shipped X, each component works, the flow is broken" appears. In every row, the SCM's handoff table would have made the broken assumption visible before code was written.

## 7. Implementation phases

**Phase 1 (lowest cost, highest value):**
- Author `map-system-contract/SKILL.md` with the artifact format above.
- Add `cross-system-suspected` to `route-workflow` intent table.
- Add the iteration-cap field and force-require logic to `route-workflow` and `diagnose-bug`.

**Phase 2:**
- Extend `eval-gate-pre` hook with the falsification-check parser.
- Update `diagnose-bug`, `design-tech`, and `review-gate` SKILL.md to require the JSON probe-emission format.
- Author one reference probe in `references/probe-template.md` showing both checks.

**Phase 3 (validation):**
- Replay WI-164 retroactively: fork to a worktree, simulate at v7 with the new paradigm, measure how many AAB iterations the framework would have shipped. Target: 1 (or at most 2).
- Pick 3 closed cross-system WIs from the past 90 days across different project types; replay the same way.

## 8. Risks and counter-arguments

- **Risk: ceremony tax on simple flows.** Mitigation: SCM is conditional (§4.1's "when required"). Single-origin bugs skip it.
- **Risk: SCM becomes stale.** Mitigation: every `diagnose-bug` re-entry on the same flow opens the SCM as input and updates it. The artifact lives next to the spec, not separate.
- **Risk: falsification probes are harder to author.** True. The cost is paid once per probe and saves N AAB rebuild cycles. The reference probe template lowers the bar.
- **Counter-argument: "this is just diagnose-bug being more thorough."** No — `diagnose-bug` runs after a bug is observed. The SCM runs BEFORE code is written for any cross-system flow, so the bug class never appears. The two are complementary, not duplicate.
- **Counter-argument: "users will hit the iteration cap on legit hard bugs and get blocked."** The cap is a halt, not a refusal. It forces SCM + cross-model review and then resumes. The block is "stop guessing" not "stop fixing."

## 9. Acceptance criteria for this proposal

This proposal is implemented when:

1. `map-system-contract` skill exists, is callable, and is auto-required by `route-workflow` for the listed WI tags and conditions.
2. `diagnose-bug`'s third invocation on the same WI mechanically halts and force-requires SCM + `review-cross-model`.
3. `eval-gate-pre` hook blocks task close-out on probes lacking a falsification check.
4. WI-164 retroactive replay terminates in ≤2 AAB iterations under the new paradigm.
5. Three additional cross-system WIs from history replay-terminate in fewer iterations than they originally took.

## 10. Decision log

- **Authored:** 2026-04-29 from Example Marketplace WI-164 v7→v14 odyssey
- **Why now:** the same shape of failure has appeared on previous WIs (WI-066/WI-081 base44-builder revert archetype, WI-072 ghost-deploy, WI-093 role-gate bug, WI-097 Base44 `$gte` returning empty) — each one a contract violation between systems that the single-component framing of `diagnose-bug` could not surface in one round. WI-164 is the most expensive instance and the clearest archetype.
- **Status:** OPEN. Awaiting `improve-framework` triage and Phase 1 implementation decision.
