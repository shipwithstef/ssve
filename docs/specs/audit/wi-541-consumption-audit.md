# WI-541 consumption audit

**State:** focused verification and the complete Tier 1 corpus are green; final external review, local landing, and installed-host gates remain.
**Denominator:** 22 unique source families; 18 implemented, 3 rejected with evidence, 1 tracked because no reliable cross-host token source exists.

**Cumulative proof:** `bash test-framework/evals/run-all-evals.sh` completed with 321 scripts passed, 0 failed, and 0 timed out. The complete captured log at `/tmp/wi541-tier1-final.ITrRu2.log` had SHA-256 `e0eca176336686745226821cbea827d26864b2d6ed4b1b356bc816464bf804c0`.

## Source and consumer matrix

| Primitive | Production consumers | Behavioral proof | Disposition |
|---|---|---|---|
| Mandatory delivery chain | graph compiler, lane validator, lane doctrine | `validate-mandatory-delivery-chain.sh` | consumed |
| Bash mutation classifier | workflow, artifact-authenticity, and session-freshness guards | redirect/env/cp-target/Perl/Node/Ruby/nested-shell fixtures in `validate-concrete-path-bash-guards.sh` | consumed |
| Child transport resolver | execute-changeset, dispatch-waves, Codex capability manifest | `validate-child-transport-resolver.mjs` | consumed |
| Promotion capability | owner-recovery exact-argv execution boundary plus land/verify contracts | traversal, unminted, replay, widening, branch/generation/tree tests in `validate-promotion-authority.sh` | consumed |
| Generation-zero adoption | canonical worktree bootstrap | WI-538 residue case in `validate-existing-worktree-self-heal.sh` | consumed |
| Plan contract | mechanical plan gate, planning and review skills | `validate-plan-product-safety.sh` | consumed |
| Caller census | deletion-bearing review-exec | identifier-aware 3,929-file census plus focused fixture | consumed |
| Reviewer-run evidence | external launcher semantic verifier, hash-bound AGY transport, and schema-v3 chain validation | launcher suite and handcrafted/symlink/failing receipt negatives | consumed |
| Learning lifecycle | loader/injector, promoter, recall/manage/land skills | `validate-learning-lifecycle.sh` | consumed |
| Authorization wrapper | typed session contract and Codex explicit-action adapter | `validate-authorization-envelope.sh` | consumed |
| Atomic task graph | set-status, load-skill, record-process, and record-phase | ordered-transition, mandatory-skip, process-evidence, and concurrency fixtures | consumed |
| Stage registry | task generation, activation, story audit | `validate-stage-registry-single-source.sh` | consumed |
| Quick-fix retirement | routing manifest and curated host guidance | detector digest fixture | consumed compatibility surface only |

Exact caller census results found production consumers for every new executable or shared module. No new executable is test-only. The declared unused denominator is zero; the sole tracked source family is an explicit research limitation, not dead machinery.

## Removal and acceleration

- Removed quick-fix from router/core prominence while keeping the compatibility skill and all three risk detectors byte-identical.
- Removed the refuted active OPT-01 row.
- Replaced duplicate mandatory-chain and stage-registry declarations with imported shared contracts.
- Kept read-only Bash and native read-only children on fast paths; new enforcement runs only for concrete mutation targets or explicit outward-action metadata.
