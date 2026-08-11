# Security Review: WI-510 phase-receipt skip integrity

**Date:** 2026-07-23  
**Mode:** implementation-aware local validator review, default 8/10 confidence gate  
**Evidence:** base-to-HEAD diff, canonical resolver source, focused mutation-red suite, WI-498/WI-509 replays, final G5 review, and cross-family Claude Opus review

## Scope and concern disposition

WI-510 changes a local Tier-1 validator that decides whether completed task records represent executed work, explicitly authorized skipped work, supported legacy evidence, or invalid evidence. The security boundary is therefore integrity and authorization: attacker-controlled or malformed graph JSON must not manufacture a successful skip or expand legacy compatibility.

`scan-concerns.mjs --diff --json` returned keyword/path matches that were
individually dispositioned. The applicable concerns are synchronous local I/O
(bounded and made lazy for legacy-only candidates), feature-validation closeout
(this mandatory chain), hermetic test-data seeding, and supply-chain review (no
dependency changes). The remaining matches are lexical false positives:
“canary” names a historical WI-181 fixture; “rollback” appears in design prose;
`state` is task state rather than OAuth state; `email` is local Git fixture
configuration; `address` is ordinary prose; `_total`, `test(`, `t("`, dynamic
`import(`, and `console.log(` occur in validator/test mechanics rather than a
data model, UI localization surface, browser flow, or production logging path;
the feature-spec path matches do not introduce an external provider; and no
social-media environment variable is read. Manual review covers authorization
confusion, receipt/evidence tampering, path traversal, command injection, legacy
replay, fail-open parsing, and bounded-resource risk. No network endpoint,
Supabase/customer database, credential flow, payment path, browser UI, or
production service is in scope.

## OWASP Top 10

| Category | Status | Evidence |
|---|---|---|
| A01 Broken Access Control | PASS | A skip succeeds only when the task and delivery graph agree, the condition belongs to the same skill and is registered/applicable, and a valid non-empty phase receipt exists. Missing or duplicate authorization denies. |
| A02 Cryptographic Failures | N/A | No credentials, encryption, signatures, hashes used as authentication, or secret material are introduced. Git history is provenance input, not a cryptographic identity boundary. |
| A03 Injection | PASS | Git is invoked through `execFileSync` argument arrays. Graph, registry, task IDs, and paths are never interpolated into a shell. JSON is parsed as data and no dynamic evaluation is used. |
| A04 Insecure Design | PASS | The resolver has explicit mutually exclusive outcomes: executed, authorized skip, legacy compatible, or invalid. Modern success requires structured evidence; legacy success is tied to the exact tracked graph, fixed pre-enforcement commit anchor, anchor snapshot, exact typed task ID, skill, completed state, and unchanged receipt. |
| A05 Security Misconfiguration | PASS | Invalid scope options, missing CLI values, filtered task IDs, unknown task IDs, malformed receipt fields, unsupported evidence types, absolute non-temporary paths, and repository traversal all fail closed. |
| A06 Vulnerable Components | N/A | No package manifest or lockfile changes. New runtime imports are Node.js built-ins and repository-local modules. |
| A07 Authentication Failures | N/A | This validator does not authenticate users or services. Its authorization input is the delivery graph's registered skip declaration, which is independently cross-checked against the task and receipt. |
| A08 Data Integrity Failures | PASS | Prose-only claims do not pass. An injected, backdated, or altered historical-looking graph cannot receive legacy status because its introducing commit must be an ancestor of the fixed anchor, the in-memory graph must equal the exact graph file, and the task must match the anchor snapshot. |
| A09 Logging and Monitoring | PASS | Machine-readable reason codes identify missing authorization, malformed receipts, unsafe evidence references, registration errors, and unsupported legacy records. Consumer validators retain non-zero exits and contextual diagnostics. |
| A10 SSRF | N/A | The implementation performs no URL fetch, socket operation, DNS lookup, or external request. |

## STRIDE threat model

| Component | Spoofing | Tampering | Repudiation | Disclosure | Denial | Elevation |
|---|---|---|---|---|---|---|
| Current receipt classifier | Skill identity must agree across task metadata and receipt | Invalid/missing phases, timestamps, types, and evidence references deny | Stable reason codes explain each rejection | Only local graph metadata appears in output | Linear scan over local task/phase arrays | Mere presence of `phases_executed` never grants skip status |
| Skip authorization resolver | Condition must resolve for the exact task skill | Task and delivery reasons must match; duplicate declarations deny | Delivery entry and reason remain explicit graph evidence | No secrets are read | Registry lookup is bounded by local JSON size | Unregistered, wrong-skill, or inapplicable conditions deny |
| Evidence-reference validator | Evidence type and path shape are explicit | Traversal, empty paths, URI/drive prefixes, control characters, unsupported types, and non-temp absolute paths deny | Diagnostic points to the exact phase/artifact index | Validator does not open or emit artifact contents | String normalization only; no recursive filesystem walk | A path string cannot itself create authorization |
| Legacy Git authority | Exact repository-tracked graph, fixed anchor reachability, and snapshot task identity are required | Caller-supplied, backdated, or modified graph content loses compatibility | Introduction commit, anchor, and snapshot commit are derived from Git | Only commit IDs/dates and graph data are read | Git history lookup is local and lazy, only for selected phase-free candidates | Post-anchor insertion and unsupported legacy shapes deny |
| CLI and Tier-1 consumers | Explicit task selectors are validated | Missing values and filtered IDs return usage failure | JSON output preserves checked count and reasons | No environment secrets are printed | Local repository input can be large, consistent with existing Tier-1 trust boundary | Scope flags select candidates but do not relax classification |

## Finding verification and residual risk

The corrected independent Opus review reports 0 Critical, 0 High, and 0 Medium
findings. Its three Low observations were dispositioned: inherited Git
configuration was fixed; leading-colon evidence is intentionally rejected to
preserve cross-platform unambiguous path semantics; and the WI-181 real-graph
canary dependency is documented and remains a deliberate compatibility alarm.
No candidate Critical, High, Medium, or Low security finding remains above the
8/10 confidence gate.

The first audit pass confirmed two defects and blocked the gate:

- **Closed High — forgeable Git-date legacy authority (confidence 10/10).** The earlier resolver used commit timestamps and `git log --before`, so a newly created descendant commit with a forged pre-cutoff committer date could qualify. The corrected resolver fixes the repository anchor at `060e3278afb26117034c4ed529a0e03da3869c32`, requires the graph-introduction commit to be its ancestor, reads the snapshot at that anchor, and fails closed when the anchor is unavailable. Anchored-clone fixtures now prove a backdated descendant and an exact-cutoff descendant both fail.
- **Closed Medium — ambiguous evidence references (confidence 10/10).** URI-like paths and Windows drive-relative paths were previously treated as repository-relative. The containment predicate now rejects URI/drive prefixes and control characters in addition to absolute/traversal/empty paths; mutation-red fixtures cover all three new boundaries.
- **Closed High — Git replacement-object anchor redefinition (confidence 10/10).** A second audit reproduced a local `refs/replace` construction that made ordinary Git history commands reinterpret the fixed anchor and a descendant head. All authority commands now use `--no-replace-objects`, set `GIT_NO_REPLACE_OBJECTS=1`, and strip repository/object/index/namespace override variables. The exact replacement-ref construction is retained as a mutation-red fixture.
- **Closed Medium — absolute-temporary control character (confidence 10/10).** The first control-character correction applied only to the relative-path branch. The shared temporary-path branch now rejects the same C0/DEL set, with an absolute temporary newline mutation proving the correction.
- **Closed Low — inherited Git configuration override (confidence 10/10).** The
  final independent Opus review identified that inherited `GIT_CONFIG_*`
  variables could still alter historical authority commands. The Git helper now
  removes inherited configuration-count/key/value variables, disables system
  configuration, and points global configuration at the platform null device,
  while retaining `--no-replace-objects` and the repository/object/index/
  namespace environment scrub.

The mutation-red suite directly falsifies the likely bypasses: receipt without delivery authorization, delivery authorization without receipt, empty/dangling evidence, malformed phases, prose-only claims, unregistered and wrong-skill conditions, malformed skip reasons, backdated/exact-cutoff descendants, altered legacy task IDs/skills/receipts, post-anchor insertion, filtered task selection, and missing CLI values. The focused replays also prove that WI-498 tasks 5 and 6 classify specifically as current `executed` work while WI-509 exercises the current structured path.

**Accepted informational resource risk (confidence 9/10).** Legacy classification invokes bounded Git commands for each graph-level run and parses the selected historical snapshot. An extremely large, locally supplied graph or repository history can make a developer-run validator slower. It cannot grant authorization, cross the repository boundary, or reach a network service. Adding arbitrary input size limits would create a new compatibility contract and is not justified for this trusted local Tier-1 surface.

**Accepted local trust boundary (confidence 9/10).** A same-user process can modify repository files or Git metadata before validation, as it can for every repository-local gate. WI-510 does not claim protection from a compromised OS principal. Within the framework boundary, the resolver compares the parsed graph with the exact on-disk graph and derives historical authority from Git instead of accepting caller assertions.

## Supply chain and secrets

- Dependency changes: 0.
- New third-party dependencies: 0.
- Package/CVE audit: N/A; no package or lockfile changed.
- Secret-bearing paths changed: 0.
- Credential or provider-key literals added: 0.
- Customer database access added: 0.

## Self-verify

| # | Check | Result |
|---|---|---|
| 1 | Review report exists | PASS |
| 2 | All OWASP Top 10 categories have a disposition | PASS |
| 3 | STRIDE covers each changed trust component | PASS |
| 4 | Supply-chain and secrets evidence recorded | PASS |
| 5 | No unresolved Critical or High finding | PASS — 0 Critical, 0 High |
| 6 | Security-rule probes run when relevant | N/A — no entity, RLS, or security-rule change |

## Verdict

- [x] PASS — no unresolved Critical or High security finding.
- [ ] CONDITIONAL
- [ ] FAIL

Mandatory continuation remains `audit-implementation`, focused and full Tier-1 validation, final-SHA chain receipts, sanctioned landing, and promoted-main replay. This review does not itself authorize promotion.
