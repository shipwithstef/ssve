# Removals and rejections

Every part of the framework that is removed, or a proposal that is rejected, is recorded here, so nothing disappears without its reason. Each entry says what the thing existed for, the evidence that it added no value or made results worse, and what now delivers its intent, if anything. The test for keeping anything is the end result: it must make what the user gets measurably better than a bare model, or guarantee that a technique which does so actually ran.

Entry format (checked by `test-framework/evals/tier-1/validate-removals-ledger.mjs`):
`## <name>` then the lines `- **Kind:**`, `- **Existed for:**`, `- **Evidence:**`, `- **Why removed:**`, `- **Intent now delivered by:**`, `- **Date / record:**`, and `- **Reintroduction check:**`.

The reintroduction check is either `pattern: /regex/ in <path prefix>[, <path prefix>]` (one or more, separated by ` ; `), which the validator runs over tracked files and fails on any match, or `review: <what a reviewer should look for>` when no pattern can catch it. review-plan and review-exec read this file and refuse a change that brings back a recorded failure without new evidence.

## Five-layer agent-slot configuration (proposal)
- **Kind:** rejected design
- **Existed for:** letting every agent slot (model, effort, host, tools) be configured without code changes and adjusted per planner or orchestrator decision.
- **Evidence:** adversarial review of `docs/decisions/2026-10-11-reviewer-ladder.md` (finding 9): `resolve-dispatch.mjs` already has an owner-protected policy, a per-WI work overlay (`parseOverlay`) and a receipt-gated session override; the proposed `.svc/slots*.json` and `SVC_SLOT_*` layers sat above the owner layer and were agent-writable, so they could override owner `deny` rules; "skip a malformed layer" would have silently dropped a malformed owner policy's deny rules.
- **Why removed:** it duplicated existing machinery and weakened owner authority.
- **Intent now delivered by:** the existing layers, plus one fix: a missing owner file falls back to registry defaults instead of failing.
- **Date / record:** 2026-10-11, reviewer-ladder decision, "Adversarial review".
- **Reintroduction check:** pattern: /\.svc\/slots(-[^"'`\s]*)?\.json|SVC_SLOT_[A-Z]/ in scripts/, hooks/, bin/

## Reviewer rungs 2 and 3 with a model-strength order (proposal)
- **Kind:** rejected design
- **Existed for:** choosing a same-family reviewer stronger than the model that did the work.
- **Evidence:** review finding 4: registry ids do not order cleanly across generations (Opus 4.8 vs Sonnet 5.5), Fable was missing, alias tuples fail the launcher's exact-model check (`model_mismatch`), and the executor's model is declared, not observed.
- **Why removed:** the guarantee it promised could not be verified.
- **Intent now delivered by:** one rung: the family's pinned top model at effort ≥ high with server-observed model attestation.
- **Date / record:** 2026-10-11, reviewer-ladder decision.
- **Reintroduction check:** pattern: /strength_order/ in scripts/, references/model-registry.json

## Reviewer-availability probe file as gate evidence (proposal)
- **Kind:** rejected design
- **Existed for:** proving that no different-family reviewer was available before falling back.
- **Evidence:** review finding 3: an agent can hand-write the file or run the probe with a stripped PATH; a 24-hour cache is stale; "auth unproven" was undefined; Cursor is family `multi` and cannot be independent.
- **Why removed:** forgeable evidence is no evidence.
- **Intent now delivered by:** the launcher attempts the different-family reviewer itself; its signed, classified failure receipt is the proof.
- **Date / record:** 2026-10-11, reviewer-ladder decision.
- **Reintroduction check:** pattern: /reviewer-availability\.json/ in scripts/, hooks/

## Profile- and zone-based acceptance of same-family review (proposal)
- **Kind:** rejected design
- **Existed for:** letting prototype and MVP work pass the chain with a same-family review while production kept cross-family review.
- **Evidence:** review findings 1 and 2: `delivery_profile` is the planner's own argument and the graph file is agent-writable; zones come from planner-declared files and the path pattern misses oauth, jwt, rbac, Prisma schemas and release workflows.
- **Why removed:** a gate that trusts the author's own declaration can be bypassed by declaring `mvp`.
- **Intent now delivered by:** same-family review lets work proceed but never authorises promotion; promotion needs cross-family review or the owner's explicit, owner-protected acceptance.
- **Date / record:** 2026-10-11, reviewer-ladder decision.
- **Reintroduction check:** review: a gate that accepts same-family review based on delivery_profile, irreversible_zones or any other value the planner writes

## Read-only (no Bash) same-family reviewer (proposal)
- **Kind:** rejected design
- **Existed for:** making sure a reviewer cannot change the code it reviews.
- **Evidence:** review finding 5: the reviewer prompt requires shell reads and failing-test proofs for blocking findings (`run-external-review.mjs:462-463`); without Bash every blocking finding drops to advisory and the review is marked incomplete. `--allowedTools` only pre-approves tools and restricts nothing.
- **Why removed:** it would have weakened every review it was meant to protect.
- **Intent now delivered by:** `--tools Read,Grep,Glob,Bash --permission-mode plan` plus the tree-unchanged check the codex host already runs.
- **Date / record:** 2026-10-11, reviewer-ladder decision.
- **Reintroduction check:** review: a claude review transport launched without Bash or without --permission-mode plan and the tree-unchanged check

## Main-module checks that compared unresolved paths (64 files)
- **Kind:** removed code
- **Existed for:** running a script's command-line entry only when the file is executed directly, not when it is imported.
- **Evidence:** run through the install symlinks, as every user project does, `compile-delivery-graph.mjs` printed nothing and exited 0 (2026-10-11 simulated fresh-project path); 64 files used `import.meta.url === file://${process.argv[1]}` or an unresolved `path.resolve` variant.
- **Why removed:** in user projects these scripts silently did nothing while reporting success.
- **Intent now delivered by:** `scripts/lib/is-main.mjs` (compares real paths), guarded by `validate-install-symlink-entry.mjs`.
- **Date / record:** 2026-10-11, commit fcf04a9.
- **Reintroduction check:** pattern: /import\.meta\.url === `file:\/\/\$\{process\.argv\[1\]\}`|process\.argv\[1\] === fileURLToPath\(import\.meta\.url\)/ in scripts/, hooks/, bin/

## Failing when the owner dispatch policy file is missing
- **Kind:** removed behaviour
- **Existed for:** making sure model routing and reviewers come only from a policy the owner wrote, never from a silent default (WI-552 "fail closed, never silently remapped").
- **Evidence:** a fresh install has no `~/.svc/dispatch-policy.json`, so `resolve-model.sh` (execute-changeset's step 0 and route-workflow's session setup) and every review launch failed with `dispatch_missing_global_file` / `config_invalid` and zero provider calls (2026-10-11 fresh-project simulation and framework-arm eval run). No user without an owner file could run the chain or get any review.
- **Why removed:** it blocked every new user without protecting anything an owner had chosen.
- **Intent now delivered by:** `references/default-dispatch-policy.json`, used only when the default owner path is absent and labelled `framework-default-policy` in every answer; it carries no release authority. An owner file that is present but invalid, or a policy path that is named and missing, still fails closed (`validate-fresh-project-path.mjs`, `validate-kimi-host.sh`).
- **Date / record:** 2026-10-11, reviewer-ladder decision step 1.
- **Reintroduction check:** review: a change that makes resolve-dispatch or review-topology-v2 fail again when the default owner path is simply absent
