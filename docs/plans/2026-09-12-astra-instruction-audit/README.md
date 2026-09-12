# Astra instruction-framework review

Start with [the current proposed plan](manifest.md) and [the review dispositions](review-disposition.md). Grok xhigh concluded at 8/10 with no Critical/High findings; all findings are dispositioned. The user additionally authorized committing and pushing a planning checkpoint, then parking it. Implementation remains unapproved.

Worktree: `/home/dianast/app-workspaces/seriousvibecoding/.worktrees/feature-astra-instruction-audit`
Branch: `feature-astra-instruction-audit`
WI: `WI-FW-ASTRA-INSTRUCTION-AUDIT-01`

| Artifact | Purpose |
|---|---|
| [Original audit](initial-audit.md) | Exact prior response, with quoted instructions, impacts and smallest-change recommendations |
| [Self-review](self-review.md) | Corrections and disposition of every original recommendation; later pilot-scope revisions are in review-disposition.md |
| [Current plan](manifest.md) | Proposed source scope, cheaper-executor requirements, acceptance criteria and twelve separate owner decisions |
| [Independent-review dispositions](review-disposition.md) | Accepted findings, source-based corrections/rejections, actual review status and limits |
| [Final Grok review](grok-round-3-findings.json) | Third-round report (8/10); all earlier rounds and invocation receipts are retained |
| [Exact model-prose patch](model-prose-proposed.patch) | Fourteen independently reviewed proposed hunks; the [one-hunk addendum](model-prose-addendum.patch) is self-reviewed only |
| [Source inventory](inventory.json) | Hash-bound census of all 105 first-party skills and 48 registered rules; static size does not measure runtime cost |
| [Frozen description baseline](description-baseline.json) | Twelve long descriptions, hashes and edit-eligibility observations |
| [Exact description proposal](ad-video-description.proposed.txt) | One description reordered without removing words; source file unchanged |
| [Continuation obligation map](continuation-obligation-map.md) | Unique obligations and unresolved conflicts in three read-only skills |
| [Bookkeeping security scope](bookkeeping-security-scope.md) | Actual concern-scanner result and assessment of the bounded session append |

`manifest.reviewed-v1.md`, `manifest.reviewed-v2.md` and `manifest.reviewed-v3.md` are immutable historical review inputs. `review-candidate*.json` binds the supplied documents by hash. The canonical raw launcher artifacts are retained under `.svc/astra-instruction-audit/` in this worktree.

The prompting reference is OpenAI's [Rethinking skills and prompts for GPT-6 Astra](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra). Local evidence determines which recommendations are applicable; the guide alone does not justify removing safeguards useful to other execution models.


## Parked checkpoint

Remote branch: `feature-astra-instruction-audit`
Audit tag: `audit/astra-instruction-2026-09-12`

This checkpoint contains audit and planning documents, frozen reviewer evidence and unapplied patch proposals. It is not an implementation/release approval and must not be merged as a framework implementation. The exact worktree remains available for later decisions. Task-local launcher prompts, controller/session state and temporary verification logs stay local under `.svc/astra-instruction-audit/`; durable reviewer findings and invocation receipts are copied into this document directory.
