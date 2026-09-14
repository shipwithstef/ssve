# WI-502 Cross-Model Execution Review

Reviewer: Fable high through the canonical external-review launcher (Anthropic family; server-observed Opus safeguard route).

Frozen package: reviewed manifest, authoritative WI-502 feature spec, and the complete staged diff.

## Round 1

Verdict: pass-with-findings. No Critical findings. Fable reported one High, seven Medium, and four Low findings.

| Finding | Disposition | Verification |
|---|---|---|
| F-001 production migration calls test-only writer | Fixed | Migration now supplies the initial generation in the production bootstrap write; production-mode generation-9 fixture passes. |
| F-002 newer-Git-only identity flag | Fixed | Common-dir resolution no longer requires `--path-format=absolute`; relative Git output is canonicalized explicitly. |
| F-003 handover generation coupled to v1 binding | Fixed | v2 lease generation is authoritative; a new controller is discovered by exact principal/repo/worktree and the old principal denies. |
| F-004 relative shell paths use process cwd | Fixed | Relative operands resolve against the operation authority root; inside and cross-root fixtures pass. |
| F-005 test-mode authority bypass | Fixed | Test authority requires `NODE_ENV=test`, a hermetic test repo, and an explicit `test-fixture` receipt; production-mode negative passes. |
| F-006 fabricated recovery evidence | Fixed | Recovery independently checks the lease's recorded owner process identity; caller assertions cannot displace a live owner. |
| F-007 crash-stale locks wedge authority | Fixed | Controller and delegation locks record PID/start token and reclaim only a provably dead holder; dead-lock fixtures pass. |
| F-008 incomplete shell syntax inspection | Partially fixed and bounded | Added obvious relative escapes plus tee/dd/ln/chmod/chown forms. Arbitrary subprocess parsing remains explicitly outside the hook guarantee; host sandbox/wrapper is the containment boundary. |
| F-009 missing Git identity cache | Fixed | One per-operation identity cache now reuses worktree/common-dir results. |
| F-010 existing symlink leaf not dereferenced | Fixed | Existing leaves are realpathed before comparison; an outside symlink-leaf fixture denies. |
| F-011 possible undefined `canonicalToolName` | Rejected after inspection | The guard defines the helper locally at `hooks/svc-worktree-isolation-guard.mjs`. |
| F-012 duplicated read adapter | Accepted with justification | Minimal host/eval packages intentionally install the synchronous resolver without the mutation store. Tests enforce matching derivation; the store remains the only writer/CAS API. |

Canonical artifacts remain in `.svc/external-review-artifacts/WI-502-exec-round1/` with request ID `6387d5c5-293e-478d-969b-302d64e1e5fe` and reported cost `$2.35406475`.

## Round 2

Verdict: pass-with-findings. No Critical findings. Fable reported one High, three Medium, four Low, and one informational finding.

| Finding | Disposition | Verification |
|---|---|---|
| R2-F-001 symlink plus parent traversal false permit | Fixed | Raw mutation paths containing a `..` segment now deny before lexical normalization; the symlink-directory escape fixture passes. |
| R2-F-002 inconsistent host-derived principal | Fixed | One `resolveAuthorityHost` helper now drives the CLI, bootstrap migration, resolver, and isolation guard; host-family fixture passes. |
| R2-F-003 test repo was truthy rather than exact | Fixed | Loader and enforcer require realpath equality with the operation worktree; foreign-test-repo negative passes. |
| R2-F-004 test writer enabled by default | Fixed | `writeControllerForTest` now requires positive `NODE_ENV=test`; production migration uses no test writer. |
| R2-F-005 post-`cd` relative false denial | Fixed | Shell segments track an in-root effective directory; `cd src && touch ../inside.txt` passes. |
| R2-F-006 divergent delegation glob semantics | Fixed | Hook authorization and merge-back import one matcher, including `?`. |
| R2-F-007 delegation lock indeterminate reclaim | Fixed | Hostname is lock-bound and unreadable live start tokens never reclaim. |
| R2-F-008 product-repo framework root | Fixed | Worker resolves the installed script's real location and emits an explicit missing-bundle denial. |
| R2-F-009 environment-sensitive Landlock Tier 1 | Fixed | Structural assertions always run; behavioral proof explicitly skips when the capability probe is unavailable while delegated mutation remains fail-closed. |

Canonical round-2 request ID: `2541e791-94f3-4436-95e4-438ad4eaea3b`; server-observed Fable high; reported cost `$5.998388`.

## Round 3

Verdict: pass-with-findings. No Critical findings. Fable reported one High, three Medium, and three Low findings in the final hard-cap round.

| Finding | Disposition | Verification |
|---|---|---|
| R3-F-001 undefined bootstrap `env` | Fixed | The public `--authority-v2` path uses `process.env`; a behavioral bootstrap fixture now proves the v2 lease, backup, and rollback receipt are created. |
| R3-F-002 compound-command shell bypass | Fixed | Each shell segment is trimmed before anchored mutation analysis; compound `touch` and `rm` cross-root fixtures deny. |
| R3-F-003 merge-back not idempotent | Fixed | Successful merge records terminal `merged` state plus source-to-integration mapping; repeat merge reports the existing integration commit, and merge requires an expected integration head. |
| R3-F-004 inconsistent handover freeze | Fixed | Lease handover and recovery use the shared delegation freezer; `completed` unmerged results freeze while terminal `merged` results remain terminal. |
| R3-F-005 unknown blockers silently ignored | Fixed | Execution planning rejects missing blockers and out-of-order dependencies before wave assignment. |
| R3-F-006 old-Bash empty arrays and unsupported harness | Partially fixed and bounded | Unsupported harnesses now fail with an exact diagnostic. Provisioned mutation hosts use modern Bash; broader Bash 4.3 portability is deferred as transport compatibility work. |
| R3-F-007 arbitrary subprocess reach-back | Accepted documented residual | Hook syntax analysis is not claimed as complete containment. Mutation-capable hosts must supply the declared Landlock sandbox or equivalent wrapper; unsupported containment fails closed. |

Canonical round-3 request ID: `bb81c7f1-1e59-4e62-9be8-c68e8b02c098`; server-observed Fable high; reported cost `$6.131569`.

The hard cap is exhausted at three rounds. All Critical and High findings are resolved, all Medium findings are resolved, and the two remaining Low concerns have explicit bounded dispositions. No fourth adversarial round was run.
