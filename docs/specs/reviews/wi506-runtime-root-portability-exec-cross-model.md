# Cross-Model Execution Review: WI-506 Runtime-Root Portability

**Date:** 2026-07-22
**Models:** Codex GPT-5.6 (implementation/self-review) and Claude Opus 4.8 high (independent review)
**Rounds:** 3 of a hard maximum of 3
**Branch:** `framework-WI-506-runtime-root-portability`

## Review basis

After review-gate convergence, the correctness-lock design changed materially
from runtime files to repository-shared Git ref CAS. The final execution review
therefore restarted against the complete Git-CAS package rather than relying on
the earlier superseded certification.

- Round 1: `.svc/impact-triad/WI-506/review-git-cas-final/`
- Round 2: `.svc/impact-triad/WI-506/review-git-cas-round2/`
- Round 3: `.svc/impact-triad/WI-506/review-git-cas-round3/`
- Certified final content SHA:
  `1dd847dbdd4df0ca6d3d58899df668bcdda4170f1c1c417574df31f48806f81d`
- Final launcher package SHA:
  `43880b68fb0db4a9f6f2b11b5f0c6cc5253ff7651d52f80c5b9e637563d927fb`

Both calls used the required Codex-orchestrated Anthropic pairing:
`claude-opus-4-8`, high effort, with no fallback.

## Round 1

Round 1 returned three High, seven Medium, four Low and one informational
finding. Valid issues were remediated: malformed holder CAS recovery,
unambiguous lock results, lazy stable holder objects, local-Git diagnostics,
canonical decimal counter parsing, real RED coverage, split symlink/parent
coverage, and case-sensitive phase classification.

Two High findings were production-source misreads. The round-2 package included
the requested dependencies and new behavioral proof:

- `resolve-wi.mjs` supplies `graph_path` for both v1 binding and v2 controller
  tuples, and a non-test loader fixture activates a real v2 authority graph.
- `resolveCanonicalSkill` adds the canonical path to `allowedPaths`, and a
  repo-local-only regular-file fixture proves exact membership.

Time-based cross-host lock takeover was explicitly rejected. Local elapsed time
cannot prove a remote owner dead. Uncertain holders remain fail-closed and expose
the exact ref, OID, hostname, PID and conditional operator recovery command.

## Round 2 certification

Claude Opus certified `review-exec-independent-adversarial=true` and reported:

- unresolved Critical: 0
- unresolved High: 0
- Medium: 1, accepted as non-blocking performance backlog
- Low: 4, accepted as diagnostic/portability backlog
- Info: 2, dispositioned
- verdict: `pass-with-findings`

The remaining Medium is a lock hot-path subprocess budget: correctness is sound,
but Git repository/object-format discovery and holder reads can be memoized or
collapsed in a future bounded performance WI. This does not authorize replacing
CAS with unsafe filesystem locks or weakening fail-closed ownership.

## Round 3 final certification

The implementation audit found and execution fixed three gaps before the final
round: malformed holder bytes now deny without entering the critical section,
staged and committed implementation-to-exempt renames expose both paths, and a
failed exact-OID release no longer returns ordinary operation success. Claude
Opus certified the final content with zero Critical and zero High findings.

At the hard cap, two Medium findings are explicitly bounded: hard consumers can
mislabel a rare post-operation release failure as acquisition failure, and a
repository root presented through a symlinked ancestor can lose repo-local skill
precedence while falling back only to the separately trusted installed skill.
Neither grants authority or weakens fail-closed behavior. Six Low and one
informational finding are diagnostic, documentation, or maintainability backlog.
The exact dispositions are in the mechanical review log; no fourth round is
permitted.

After certification, aggregate Tier-1 exposed one stale fixture that passed a
nonexistent legacy Codex runtime override. The fixture now creates the reviewed
pre-existing private `0700` leaf before invocation. Five durable evidence records
and one canonical-loader telemetry append were also added to the landing set.
The final static result record is persisted in the skill-owned ignored results
directory. The seven landing paths change no production behavior and do not initiate a fourth
adversarial round beyond the enforced cap.

## Verdict

PASS for execution review. This is not a promotion claim. Dedicated security
review, implementation audit, full Tier-1, final-SHA receipts, landing,
installed-host refresh and the original Example Marketplace WI-496 replay remain mandatory.
