### Step 2: Send to the Canonical Launcher

```bash
mkdir -p .svc/external-review-artifacts/cross-model
SUMMARY=.svc/external-review-artifacts/cross-model/summary.json
node scripts/run-external-review.mjs \
  --orchestrator "${SVC_HOST:-claude}" \
  --review-kind exec \
  --input-file .svc/review-cross-model-package.md \
  --artifacts-dir .svc/external-review-artifacts/cross-model > "$SUMMARY"
node - "$SUMMARY" <<'NODE'
const fs = require('fs');
const summary = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!summary.ok || !summary.findings || !summary.receipt) process.exit(1);
fs.copyFileSync(summary.findings, '.svc/review-cross-model-findings.json');
fs.copyFileSync(summary.receipt, '.svc/review-cross-model-receipt.json');
NODE
```

The launcher is the sole paid invocation path. It pins the requested model and
effort, takes the exact package from `--input-file` or stdin, constrains findings to the shared
schema, writes an invocation receipt, and hard-fails on unavailable capability.
Do not construct provider commands in this skill.

The prompt to the second model:

```
You are reviewing a code change. Here is the context:

<review package>

This packet is an ENTRY POINT, not the complete evidence. Open whole touched
files, callers/callees (including unchanged callers outside the diff), config/routes,
related tests and the actual cost path, including unchanged defaults, fan-out,
retries and token caps. Record inspected paths and unread required dependencies.
Use read-only shell reads; no edits, installs, Git mutations or artifact-producing
tests in the source tree. Missing access or required exploration is INCOMPLETE.

Return ALL findings in one pass. Trace the connected feature for:
1. Bugs — logic errors, off-by-one, null handling, race conditions
2. AC violations — does the code actually satisfy each acceptance criterion?
3. Security — injection, auth bypass, data leaks, insecure defaults
4. Design — does the implementation match the stated decisions?
5. Missing — what should be here but isn't?

For each finding, provide:
- Severity: Critical / High / Medium / Low
- Confidence: high / medium / low
- Location: file:line
- Finding: what's wrong
- Proof for blockers: failing test command/result, concrete input → actual wrong
  output plus expected output, or reachable call path demonstrating the violation.
  Without proof, downgrade to advisory; retain the raw finding and downgrade reason.
- Proposal: how to fix it

Be specific. "Error handling could be better" is not a finding.
"api/users.ts:42 — no try/catch around the database call, a connection
timeout will crash the process" is a finding.
```

The resolved primary invocation is also the availability probe. There is no
paid smoke call and no generic tri-model fallback. For the Fable profile only,
a classified model-unavailable, entitlement, or provider-overload failure may
start a separate Opus xhigh invocation. A provider-managed same-process
Fable-to-Opus safeguard route is not that fallback and never starts another
Opus process. Authentication, shared quota, network, timeout, capability,
schema, turn-budget, profile-state, provider-safety, and unknown failures halt
the gate. Scheduled Opus/high is itself the primary and has no fallback.

### HARD 2-round cap per feature and bounded exit (RV1)

Persist one stable feature ID (default: WI); pass `--feature-id` unchanged across
related WI aliases/cards, sessions, candidate digests, review kinds and reviewers.
The launcher atomically reserves each round before dispatch; incomplete attempts
count, zero-call cache replays do not. Returning the spec never resets the ledger.
Round 2 supplies original finding IDs, dispositions, patch delta and focused
acceptance results; verify fixes and adjacent breakage only. No new discovery.
After round 2 return unresolved proof to the orchestrator or record each residual
and rationale. An unresolved proven blocker never becomes PASS.

**Never run more than 2 adversarial rounds.** An adversarial reviewer prompted to
find flaws does not run dry on a genuinely complex change — it keeps producing
new High-severity concerns every round. "Loop until zero High" is therefore an
**unreachable** stopping condition and MUST NOT be used. Convergence is defined by
**disposition**, not by the reviewer running out of findings:

The loop is CONVERGED (terminates, change proceeds) as soon as **both** hold:
- **No unresolved Critical** findings, AND
- **Every** remaining High/Medium/Low finding carries a documented disposition —
  `accept-with-justification` (recorded as an execution-time risk to verify) or
  `reject-with-justification`.

Hard cap by round:
- **Round 1:** one full discovery batch. **Round 2 only if needed:** fix verification tied to original findings, never another full discovery pass.
- **After round 2** (do NOT start a round 3):
  - **Unresolved Critical remain →** ESCALATE to the user/owner. Criticals always block; never auto-accept a Critical.
  - **Only High/Medium/Low remain →** the loop TERMINATES. Each remaining High MUST be dispositioned NOW (accept-with-justification as a logged execution-time risk, or reject-with-justification) and the change PROCEEDS. Do not run another round.

A rubric_score that does not improve across rounds is a signal the reviewer has
reached diminishing returns, not a signal to keep looping — apply the cap.

**Mechanical enforcement (wire it into the loop).** Record `rounds_run` and, when
you terminate, a `bounded_exit` (or escalation) block in the review-log. BEFORE
starting any new round, if you have already completed round 2, STOP — do not
dispatch a 3rd round; disposition instead. The loop is guarded by
`node scripts/check-review-round-cap.mjs --branch-once --log <review-log>`, which rejects `rounds_run > 2`, an unresolved Critical without escalation, or any remaining
High lacking a documented disposition. A convergence/exec review is not complete
until this check passes.

> Anti-pattern (WI-491 origin): running 9 review rounds because 6 High findings
> persisted with 0 Critical. That is the exact unbounded-loop bug this cap fixes.
> High-only persistence AT round 2 is a DISPOSITION event, not a re-review event —
> you never reach round 3.

**Schema-current receipt handoff (WI-566).** When the final immutable reviewer
object remains raw `fail` after a compliant bounded exit, return every ordered
launcher receipt/findings digest and the complete finding census to the calling
review skill. The caller emits `pass-with-acks` with
`reviewer_evidence.bounded_exit` per
`schemas/receipts/bounded-exit.schema.json`. Never normalize the raw verdict or
discard earlier round identities. This path is admissible only for zero
Critical, at most two rounds, an unchanged candidate, and evidence-bound High
dispositions. Terminal rubric failures additionally require an exact census
mapped to dispositioned terminal finding IDs with hash-verified repository
evidence; unread dependencies and failed certifications remain blocking.
Otherwise the chain remains blocked.
