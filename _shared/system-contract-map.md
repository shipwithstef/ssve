# System Contract Map

Use this artifact before changing cross-system flows: OAuth, SSO, hosted login,
payments, webhooks, push notifications, mobile/web handoffs, sync, streaming
tool calls, provider callbacks, or any flow that crosses runtimes, origins,
protocols, SDKs, or storage layers.

Canonical path:

```text
docs/specs/contract-maps/<flow-name>.md
```

Validate it before using it as closeout evidence:

```bash
node scripts/validate-system-contract-map.mjs --map docs/specs/contract-maps/<flow-name>.md
```

## Required Sections

### Flow Diagram

Show every runtime context as a node and every handoff as an edge. A runtime
context can be a browser page, hosted login UI, provider page, native app,
WebView, API endpoint, webhook handler, queue worker, database, or SDK callback.

### Handoff Table

| From | To | Transport | Data Shape | Sender Storage | Receiver Storage | Next Reader | Failure Mode |
|---|---|---|---|---|---|---|---|
| Browser login page | OAuth provider | HTTP redirect | `from_url`, state | URL query | provider session | callback validator | callback rejected or token delivered somewhere else |

### Origin / Storage Matrix

| Storage Layer | Origin / Owner | Written By | Readable By | Lifetime | Failure Mode |
|---|---|---|---|---|---|
| localStorage | hosted app origin | provider SDK | app callback bridge | browser profile | token invisible to native deep-link reader |

### External Platform Invariants

Every invariant must be falsifiable and cite where the claim came from.

| Claim | Verification Source | Probe | Status |
|---|---|---|---|
| Provider preserves `from_url` through Google auth | runtime probe output | `node probes/login-roundtrip.mjs` | verified |

### Falsification Probes

Every load-bearing probe must give the hypothesis a chance to fail.

| Hypothesis | Confirmation Check | Falsification Check | Result | Evidence |
|---|---|---|---|---|
| Token is delivered in callback URL | URL contains `access_token` after auth | URL lacks token and storage contains token | rejected | `docs/specs/features/test-evidence/auth/probe.json` |

### Old Path / New Path Proof

Required when a fix migrates, swaps, bypasses, or reroutes a path because of an
observed symptom.

| Same Input | Old Path Result | New Path Result | Conclusion | Evidence |
|---|---|---|---|---|
| login with test account | fails with auth loop | succeeds and lands on dashboard | migration changes behavior | `docs/specs/features/test-evidence/auth/old-new-path.json` |

### Iteration Escalation

If the same WI reaches a third `diagnose-bug` invocation within 14 days, halt
before another fix attempt. Mark the WI `cross-system-suspected`, require this
contract map, and run `review-cross-model` against both the diagnosis and the
map before `execute-changeset`.
