# SSVE delivery speed: arguments and counterarguments

Date: 2026-09-07  
Status: analysis for decision; no framework policy change authorized by this document  
Scope: indexing and review recommendations from the preceding conversation, assessed against Multicontext, iOS, and SSVE session evidence.

## Purpose and comparison limits

Preserve each earlier argument, then test whether it is universal, overlooks a benefit, or needs a conditional replacement. The founder wants faster feature delivery with product quality, UX, performance, and innovation preserved. Neither keeping every gate nor deleting every gate is the starting assumption.

Default means the same model and code with ordinary project instructions, without SSVE's mandatory stages. It still inspects dependencies, tests relevant behavior, investigates failures, and reviews its work. That is a stated operating baseline, not an observed control run. These sessions do not demonstrate a causal speed multiplier or zero quality loss from removing a mechanism.

The seven “Earlier argument” blocks below are copied verbatim from the previous assistant answer. They preserve the position being challenged, including claims revised by the analysis below; they are not all endorsed conclusions.

Source of preserved wording: `/home/user/.codex/sessions/2026/09/07/rollout-2026-09-07T13-16-56-01a07c03-c230-7820-9e3b-7f846d4fbbe8.jsonl`, line 276. Session evidence is machine-local; framework references are inspectable in this repository.

## Point 1: Behavior indexing: SSVE adds something useful beyond default behavior. Keep it.

### Earlier argument (verbatim)

**1. Behavior indexing: SSVE adds something useful beyond default behavior. Keep it.**

**Default:** I search the relevant code, follow callers, inspect tests, and maintain the working model in context. That model can lose details across compactions, and searches can miss an unchanged entry point.

**SSVE:** The Multicontext index preserves the connections between switching, subscription guards, usage accounting, owner fees, webhooks, caches, and Admin behavior.

**Why keeping it is justified:** These are exactly the boundaries where the billing reviews found defects. A persistent map makes those boundaries visible to subsequent agents. However, the transcripts do not prove that indexing itself caused those discoveries.

**Change:** Keep one concise map of behavior, dependencies, important invariants, and unresolved questions. My earlier suggestion to weaken indexing broadly was unjustified. The problem is its maintenance and certification requirements.

### Critical reassessment

**Universality verdict: useful capability, conditional value; not proof that SSVE beats default.**

The earlier argument understates the index's potential value as durable domain memory: it can preserve *why* a boundary exists, expose a missing branch outside the diff, orient a new reviewer, and reduce repeated searches after compaction. A source search gives references; it does not automatically reconstruct “Employee never has billing authority” or “switching must also invalidate the other rail's cache.” Conversely, the index can become an inaccurate second specification that costs more to maintain than it saves.

**Counterexample to always keeping a formal index:** a self-contained label correction in an already-understood component. **Counterexample to removing it:** Multicontext's many billing entry points and context-dependent exceptions, especially across resumed sessions. The default model's ability to infer these is not a guarantee that it remembers or enumerates all of them.

**Middle position:** retain the existing feature map for cross-cutting behavior and resumable work. For a bounded local change, use the relevant existing map or a short affected-path note, without manufacturing another index. Preserve invariants, missing branches, and uncertainty; generate path/import facts only where existing tools can do it cheaply. Do not create a new semantic-indexing platform for this optimization.

**What would change this judgment:** compare missed entry points, repeated discovery work, and maintenance effort on the same source using no map versus the existing map. An index whose facts are never consumed or whose maintenance exceeds rediscovery should be reduced. No such matched measurement has been performed here.

**Evidence:** E1, E3, E7. The billing review demonstrates that the mapped boundaries matter; it does not establish that reviewers found the defects *because of* the index.

## Point 2: Repository-wide index freshness: worse than default for a bounded change. Remove the global blocker.

### Earlier argument (verbatim)

**2. Repository-wide index freshness: worse than default for a bounded change. Remove the global blocker.**

**Default:** If documentation is stale, I verify the relevant claim against current code. I do not repair every stale document before shipping an unrelated correction.

**SSVE observed:** The iOS session passed implementation reviews but could not land because **17 indexes were stale**, including three affected by this change.

**Why worse:** Unrelated index repairs cannot establish whether the changed map controls or filters work. They enlarge the candidate, consume review time, and introduce more opportunities for mistakes. That is a causal dependency added by the framework.

**What removal could lose:** An affected stale index could conceal a missed dependency.

**Replacement:** Recheck the affected claims and dependencies. Block only when an unresolved claim matters to the change’s correctness. Do not block on the other indexes.

### Critical reassessment

**Universality verdict: conditional; “unrelated” must be established, not assumed from the WI label.**

Global checks can expose coupling the author failed to include: shared authentication, routing, a schema, or an SDK can invalidate claims in several otherwise separate features. They can also keep future agents from treating old documentation as current authority. A pre-existing failure is not automatically harmless. In SSVE itself, installation/provenance indexes can govern actual tool execution, making some “documentation” operationally significant.

The iOS transcript establishes that 17 stale indexes blocked landing and that three were affected by this change. It does not independently prove that the other 14 could never affect the release. The earlier wording was stronger than that evidence.

**Middle position:** use the existing index/source relations to identify affected or consumed claims. Revalidate those claims and their dependencies. If an index is stale and not needed for the release, explicitly stop treating it as current evidence and keep its repair outside the feature's critical path. If dependency impact is unknown on a shared boundary, widen inspection; if it remains release-critical and unresolved, block. Keep a cheap repository inventory for visibility without requiring all historical debt to be repaired at every release.

**What would change this judgment:** a replay in which a supposedly unrelated stale index reveals an auth, compatibility, deployment, or data-loss issue would falsify an overly narrow selection rule. A docs-only stale stamp on an unused feature should not block that replay. Both cases must be checked before altering the existing gate.

**Evidence:** E2, E4, E7. The current freshness helper already distinguishes changed cited paths from uncited in-scope paths; the proposed change must build on that distinction, not rediscover it.

## Point 3: Re-review after an index stamp changes: sometimes worse; substantive index review remains valuable.

### Earlier argument (verbatim)

**3. Re-review after an index stamp changes: sometimes worse; substantive index review remains valuable.**

**Default:** If I update a documentation timestamp without changing the behavior described, I do not restart code review. If I discover another billing entry point, I inspect and test it.

**SSVE:** Its [checker](/home/user/app-workspaces/seriousvibecoding/scripts/branch-index-freshness.mjs:191) requires corresponding index/review stamps and prescribed review wording. Rewalking the index reopens the review obligation.

**Why worse:** A stamp change is an unreliable proxy for changed risk. It can demand paid review despite no new behavioral claim. Conversely, matching stamps do not prove completeness.

**Replacement:** Re-review added or changed behavioral claims and their affected code. Preserve previous review coverage for unchanged claims. Keep the reviewer’s “what did this map miss?” examination inside the feature review.

### Critical reassessment

**Universality verdict: matching evidence to the candidate is necessary; a new model review for every stamp change is not shown necessary.**

A review stamp is not merely decoration. It can prevent a pass over yesterday's enumeration being presented as a review of today's scope. Import changes can add an unseen caller; an index update can add an acceptance obligation. Stable prose is not sufficient either: the code supporting an unchanged claim may have changed. This is the benefit the earlier argument gave too little weight.

**Middle position:** retain candidate/source identity and the obligation to examine missing branches. Distinguish (a) formatting or metadata-only changes with unchanged supporting inputs, (b) altered dependencies or behavioral claims, and (c) changes whose impact cannot be established. In (a), validate the existing evidence binding mechanically and retain the review; in (b), review the new claim plus affected dependencies; in (c), inspect more broadly. Do not rely on a model simply asserting “semantic no-op.” Do not introduce a costly universal semantic-equivalence engine either: use exact input equality for the cheap case and ordinary review for the rest.

**What would change this judgment:** evidence that a retained review accepts changed supporting code would disqualify the reuse rule. A pure stamp update with identical relevant inputs should avoid a paid reviewer while preserving provenance. The distinction must be tested at the actual consumers, not just the index generator.

**Evidence:** E4, E7. The stamp/heading checker demonstrates a correspondence check, not a complete semantic proof. Other validators may add protection; this report does not claim the whole framework relies only on wording.

## Point 4: Formal plan review: useful for consequential decisions; excessive for every detail of inline execution.

### Earlier argument (verbatim)

**4. Formal plan review: useful for consequential decisions; excessive for every detail of inline execution.**

**Default:** I decide the approach and important constraints, then adapt implementation details as I inspect the code. One executor can update translations, create a test helper, and run tests in the necessary order.

**SSVE observed:** The iOS plan assigned translations exclusively to one task while another needed to write them. It also required a task to pass tests that a later task would create. Review correctly caught both.

**Why SSVE was worse in this case:** The exclusive ownership and completion dependencies created failure modes that a straightforward sequential implementation did not need. The reviewer was fixing the execution machinery, not discovering a flaw in the proposed user experience.

But the missing GET-route registration finding **was useful**: it could produce a broken endpoint regardless of workflow.

**Replacement:** Review architecture, behavior, risky interfaces, migrations, and release assumptions. Require detailed ownership graphs when actually coordinating concurrent writers. Do not demand that a single inline executor predeclare every helper and command.

### Critical reassessment

**Universality verdict: depends on execution mode, risk, and handoff burden; inline does not mean simple or uninterrupted.**

Formal planning can uncover impossible prerequisites before code exists, retain owner decisions through restarts, establish migration/deployment order, and separate real-device evidence from mocks. These runs had many compactions and interruptions, so durable execution instructions have real value even with a nominally single executor. Identifying a GET route registration gap before writing code is also cheaper than discovering it after a build or deployment.

However, the iOS findings show circular proof dependencies and exclusive ownership conflicts in the plan itself. Those are genuine bugs in that orchestration design. They do not prove that every equivalent implementation needs the orchestration design. The 04:39-to-07:59 interval shows delayed implementation; it is not a measured attribution of every minute to useless review.

**Middle position:** an accepted product plan should carry forward without being rewritten merely to change its format. Review material architecture, interfaces, acceptance, and risky external effects once. For inline work, retain an ordered checklist and exact commands where mistakes are costly (migration, publication, destructive recovery); allow ordinary local helper/test edits without a formal ownership amendment. For concurrent writers, unfamiliar handoffs, or long multi-environment changes, keep explicit ownership and dependencies. If implementation changes a material decision, amend and review that decision.

**What would change this judgment:** a lighter plan that loses the iOS translation requirement, mis-registers the route, or mistakes a mock for device proof has reduced quality. A plan review that only repairs distinctions introduced by unnecessary parallelization should prompt simplification first. Compare these outcomes on the original pre-fix candidate.

**Evidence:** E2, E6, E8. Neither the initial reviewed roadmap nor the formal plan should be treated as permanently valid after material scope changes.

## Point 5: Multiple code reviews: the evidence does not justify removing them indiscriminately.

### Earlier argument (verbatim)

**5. Multiple code reviews: the evidence does not justify removing them indiscriminately.**

**Default:** I self-review; independent review depends on the task and available workflow. That can leave correlated blind spots.

**SSVE observed:** Later billing reviews caught authorization/mutation races and the Admin regression after an earlier candidate had passed. Another reviewer found the Customer usage race. [Review history](/home/user/app-workspaces/example-marketplace-worktrees/wt-lane-account-customer-billing-live/docs/specs/reviews/account-multicontext-layer3-astra-review.md)

**Judgment:** Here, SSVE produced additional quality. I withdraw any implication that one review would necessarily have been equally good.

**What should change:** Stop requiring separate named stages to repeat substantially overlapping inspection. Preserve distinct examinations where they add coverage—for example, transaction correctness versus the complete Customer/Owner/Employee experience. After fixes, check the corrections and affected dependencies; reopen broadly when the candidate materially expands.

The justification is **distinct coverage**, not an arbitrary one-review limit.

### Critical reassessment

**Universality verdict: additional defect detection is observed; the optimal number and arrangement of reviews are unknown.**

Two reviews with overlapping scope can still be valuable: different reviewers may independently notice different defects, and agreement can help distinguish a real bug from a false positive. Independence, unfamiliarity with the author's explanation, and a fresh inspection of the whole feature can matter even without named specialist roles. A correction can also introduce a new defect outside the originally failing line. Therefore “only the originating lens ever reruns” is too rigid.

The billing history contains real entitlement, compatibility, transaction-race, and Admin findings. Later rounds also saw a changed candidate. This supports review of material changes; it does not establish that four reviews of an unchanged candidate are necessary, or that one default review would have missed those defects. The earlier sentence “SSVE produced additional quality” should be read as improvement over the earlier candidate, not a controlled comparison with default behavior.

**Middle position:** preserve a whole-feature review that looks for omissions and an independent challenge proportionate to consequential risks. Combine review stages whose distinct work cannot be identified, while retaining separate examinations that add useful scrutiny. After fixes, inspect both the finding and collateral effects; broaden again for shared-state, interface, authorization, or major-scope changes. Do not impose either “one review is enough” or “every named stage must always run.” Make reviewers justify findings by reachable behavior, not by an imperative to find more issues.

**What would change this judgment:** blind comparison on frozen pre-fix candidates must measure unique confirmed defects, false positives, correction time, and missed product requirements. Count repeated discoveries of the same defect once. An expensive second pass catching a payment race may be worth it; a cheaper pass that misses it is not a quality-preserving win.

**Evidence:** E3, E6, E8. Product UX, performance, accessibility, and omitted journeys belong in the coverage, not only security and diff correctness.

## Point 6: Mandatory different-provider review: benefit unproven, removal also unproven.

### Earlier argument (verbatim)

**6. Mandatory different-provider review: benefit unproven, removal also unproven.**

**Default:** A separate capable reviewer can challenge my assumptions without belonging to another provider.

**SSVE observed:** Both Sol/Astra and Grok produced useful findings. The logs also show provider-authority requirements creating extra receipt and availability dependencies.

**What I can conclude:** Different-provider *certification* creates demonstrated overhead. These transcripts do not isolate whether provider diversity catches more defects than two comparably capable independent reviewers.

**Revised recommendation:** Do not claim this requirement is useless or that removing it preserves identical quality. Make its value testable using the known defects from these runs. Until then, removing it is a speed/assurance tradeoff—not a proven free improvement.

### Critical reassessment

**Universality verdict: open empirical question; no default/provider policy change follows from these logs alone.**

Provider diversity may reduce correlated blind spots arising from related models, shared tooling, or similar reasoning patterns. An independent release authority also creates a separation of responsibility: the author should not silently supply its own required approval. These are plausible benefits, not proven effects of the provider label. Two vendors can repeat the same mistaken assumption when given the same incomplete context; two models from one vendor can find different defects.

**Middle position:** separate the requirement for independent scrutiny from the hypothesis that a particular provider combination supplies it best. Preserve current explicit owner policy while evaluating alternatives on the same candidate and evidence. Availability, startup latency, context quality, unique defect detection, and the ability to complete the job all count. A permitted fallback should be defined beforehand and disclosed, never invented as equivalent certification during a blocked release. For consequential changes, changing reviewer topology needs evidence that the desired scrutiny remains.

**What would change this judgment:** compare same-provider independent reviewers, different-provider reviewers, and a single reviewer on identical pre-fix snapshots without prior findings. Normalize task, access, and approximate review budget; report residual differences rather than attributing all effects to provider family. The historical Sol/Grok findings are not such an experiment. A known-defect replay is only an initial check; prospective escaped defects still matter.

**Evidence:** E3, E5, E6. Existing owner configuration is a real constraint, not automatically a framework bug. This document does not alter it.

## Point 7: Counting paperwork defects as product defects: change the reporting and blocking policy.

### Earlier argument (verbatim)

**7. Counting paperwork defects as product defects: change the reporting and blocking policy.**

**Default:** I distinguish “the endpoint is broken” from “the checklist is incomplete.”

**SSVE observed:** A final Multicontext plan review’s only remaining High finding was the missing producer for its reviewer-receipt aggregate.

**Why worse:** The severity label made a defect in SSVE’s own approval mechanism look equivalent to a product failure. That distorts priorities and makes review activity appear more valuable than its effect on users.

**Replacement:** Separate product defects, missing necessary proof, and workflow-record defects. Missing billing-isolation proof can block release. Missing evidence-aggregation paperwork should not independently block a release whose actual required evidence is available and verified.

### Critical reassessment

**Universality verdict: separating defect types is useful; treating all missing paperwork as non-blocking would be wrong.**

A review receipt can be the only durable evidence that approval belongs to the exact deployed source. A migration checksum, signed artifact identity, or required authorization can prevent a real harmful action even though it is represented as metadata. The missing Multicontext aggregator was a genuine missing input to the chosen approval mechanism. Its proposed replacement must preserve the relevant verification, not simply stop looking for the file.

**Middle position:** distinguish direct product defects, missing or invalid essential proof/authority, and representation/format defects. Keep blocking when the release lacks essential evidence, the evidence belongs to a different candidate, required authority is missing, or the binding cannot be verified. If authentic required evidence exists and can be verified using a simpler supported path, a missing redundant aggregate should be repaired mechanically without another substantive review. Optional duplicate indexes and formatting should not inherit the severity of a billing or authorization failure.

Count prevented unsafe releases separately from defects fixed in product code. Neither metric should be inflated by counting every generated receipt-format repair as another product-quality improvement. Assess control cost and necessity before adding another artifact.

**What would change this judgment:** the simpler path must reject a wrong SHA, stale/missing reviewer approval, changed artifact, or absent owner authority. It should accept complete authentic evidence whose optional presentation differs. If it cannot distinguish those cases, removing the gate would lose a real protection.

**Evidence:** E5, E7, E8. Code that verifies the aggregate may be valuable; the standalone aggregate file and extra review ceremony are separable design choices.

## Revised positions after challenging the arguments

None of the seven points establishes that SSVE as a whole is worse than default behavior. Each concerns a mechanism with a different benefit, cost, and applicability. The supported direction is selective retention and simpler execution, not automatic compromise or universal deletion.

| Point | Earlier direction | Position after challenge | Evidence strength |
|---|---|---|---|
| 1. Behavior map | Keep | Keep for cross-cutting/resumed work; reuse existing maps for local changes | Mechanism plausible; mapped risk is concrete; comparative benefit unmeasured |
| 2. Global freshness | Remove universal release blocker | Keep visibility; block on affected/consumed or unresolved critical claims, not unrelated debt | Blocking observed; scope-selection safety needs validation |
| 3. Stamp-driven review | Remove needless paid re-review | Keep provenance; reuse only with verified supporting-input equality; otherwise review affected claims | Concrete re-review mechanism; safe reuse not yet implemented/proven |
| 4. Formal inline planning | Reduce | Match plan detail to concurrency, risk, and resume needs; carry accepted decisions forward | Both useful and orchestration-created findings observed |
| 5. Multiple reviews | Combine overlap | Preserve demonstrated useful scrutiny; no universal reviewer/round count | Real defects found; controlled topology comparison absent |
| 6. Provider diversity | Evaluate, do not declare useless | Preserve explicit policy; test independence and marginal yield before replacement | Benefits and superiority remain unisolated |
| 7. Paperwork severity | Separate and narrow blockers | Preserve essential authority/provenance checks; simplify redundant representation | Missing aggregator observed; consequences depend on what it verifies |

### Benefits the earlier criticism understated

- Repeated sessions and multiple agents need durable decisions and trustworthy handoffs; a competent single-turn model is an optimistic baseline for these runs.
- Indexes can expose omissions outside the diff, while ordinary search and diff review may never enumerate the missing path.
- Overlapping independent reviews can be useful, and a later review of changed code is not automatically repetition.
- Evidence identity can protect real money, production data, or the correct release; “metadata” is not a synonym for “worthless.”
- Some overhead in the SSVE run protects a multi-host framework installer. It cannot automatically be classified as unnecessary overhead for framework work merely because the same depth would be excessive for a product UI fix.
- “Tiny feature” is not an established description of the entire Multicontext release: the remaining program included 42 ACs, billing boundaries, migrations, multiple platforms, translations, and observation. This does not justify 20–30-hour execution; it limits comparisons to an unspecified tiny default task.

### Boundaries that should survive any simplification

Use the actual user experience and consequential invariants as the floor: usable controls, preserved navigation/filter state, successful capture/submission, appropriate empty/error/loading behavior, accessibility, responsive rendering, measured relevant latency, billing isolation, data integrity, and honest deployed/device proof. An unchanged test count or a green workflow is not itself that floor.

Innovation also needs protected attention: evaluate whether the proposed interaction solves the problem more simply, whether existing UI patterns should be reused, and whether a meaningful alternative improves the experience. The transcripts do not measure innovation quality, so this report cannot claim that adding or removing a review improves it.

A 24-hour observation requirement cannot complete within two hours. If its necessity is questioned, change that product/release requirement explicitly; do not hide the delay in a different success metric. No multiplier or universal two-hour promise is established by this document.

### How to resolve uncertainty without starting another large framework project

Use existing pre-fix snapshots and review artifacts for a bounded comparison before changing the defaults. Compare the current mechanism with the narrow alternative, not with an intentionally careless baseline. For each point, the counterexample and falsification check above specify the minimum challenge. Reviewers in any future comparison must not see the historical findings first. Do not run paid review experiments implicitly as part of creating this document.

Record results in this document: confirmed unique defects/omissions, false positives, product/UX/performance coverage, rework, and total elapsed delivery time. Include setup and failed attempts. Do not add parallel durations together or infer active time from overnight transcript spans. Historical replay can disprove an unsafe shortcut but cannot establish future zero-defect delivery; validate promising changes on representative prospective work before claiming a 5× result.

The strongest immediate conclusion is to inspect an obligation's *reason* before changing it: retain the useful check, simplify its representation or invocation where possible, and remove it only when its unique benefit is absent for the task. This is a decision criterion, not a request for another mandatory ledger or approval gate on every feature.

## Evidence inventory and limitations

Evidence was auto-discovered from local Codex transcripts and repository artifacts during this conversation. Times below are UTC. Reports can contain corrected or superseded statements; paired findings and code are stronger than an agent's unverified status claim.

| ID | Evidence | What it establishes / limitation |
|---|---|---|
| E1 | Multicontext transcript `01a07605-754d-7a83-bfbe-70efdb565f93`, starting 2026-09-06; messages at 09:27, 11:42, 11:48, and later controller work | Reconciliation status, missing aggregate, blocked certification, and substantial release-controller implementation. Not a causal allocation of every elapsed hour. |
| E2 | iOS transcript `01a076e9-8bfc-72d2-b0d7-9fe8e34c2123`; 2026-09-07 04:39, 07:59, 08:06, 09:07, 09:29, 09:33 | Reviewed remediation before formal execution; implementation starts after exception; 17 stale indexes reported, three affected. Unrelatedness is not independently proven for every remaining index. |
| E3 | `example-marketplace-worktrees/wt-lane-account-customer-billing-live/docs/specs/reviews/account-multicontext-layer3-astra-review.md` | Four rounds across changing candidates; entitlement, fallback, financial race, and Admin findings. No unchanged-candidate control group. |
| E4 | SSVE transcript `01a075d1-d054-76e1-ac57-279b0f3e5c0d`; 2026-09-06 10:01–10:29 | Stale Markdown/index sidecars, correction of a premature passing claim, and review of documentation while runtime code was reported unchanged. Interval includes other work; not all minutes attributed to indexing. |
| E5 | Multicontext `.svc/evidence/account-completion-plan/launcher{,-round2,-round3}/findings.json` | Plan findings mix missing real proof/rollback with lane/authority/aggregation requirements. Round 3's remaining finding concerns the absent aggregate producer. |
| E6 | iOS `.svc/external-review-artifacts/native-discovery-plan/{round1-run,round2-corrected-run,round3-run}/findings.json` and `docs/plans/2026-09-07-native-discovery-parity/review-log.yaml` | Exact translation ownership, circular test dependencies, route registration, and owner-exception evidence. |
| E7 | This repository: `scripts/branch-index-freshness.mjs`, `skills/route-workflow/references/lane-model.md`, `skills/audit-implementation/SKILL.md` | Current mechanics for freshness, review stamping, mandatory stages, and specialist selection. Historical sessions may use older installed revisions. |
| E8 | Multicontext `docs/plans/2026-09-06-account-multicontext-completion/manifest.md` and `release-lifecycle.md` | Scope, 42 ACs, native/live/release obligations, 24-hour observation, and controller design. This is more than a local UI edit. |

Full local source paths:

- E1: `/home/user/.codex/sessions/2026/09/06/rollout-2026-09-06T09-21-04-01a07605-754d-7a83-bfbe-70efdb565f93.jsonl`
- E2: `/home/user/.codex/sessions/2026/09/06/rollout-2026-09-06T13-30-12-01a076e9-8bfc-72d2-b0d7-9fe8e34c2123.jsonl`
- E4: `/home/user/.codex/sessions/2026/09/06/rollout-2026-09-06T08-24-39-01a075d1-d054-76e1-ac57-279b0f3e5c0d.jsonl`
- Multicontext artifact root: `/home/user/app-workspaces/example-marketplace-worktrees/wt-lane-account-customer-billing-live/`
- iOS artifact root: `/home/user/app-workspaces/example-marketplace-worktrees/wt-lane-ios-testflight/`
- Framework snapshot for this document: `93812914c33451cff84019176120e1cbe6bcaf3e`.

The absolute session/product paths are machine-local and may disappear after cleanup. The earlier arguments and substantive findings are retained in the text; this file is not a portable archive of every raw reviewer artifact. No token or runtime savings are claimed. No framework code, installed policy, or product deployment has been changed by this document.

## Допълнение: откъде идват ограниченията и как запазваме ползата с по-малко работа

Това е преработено предложение, не реализирано ускорение. Целта е работещ, приятен и бърз продукт, който решава правилния проблем. Броят документи, агенти и проверки не измерва това. Но и проверка, която не е намерила дефект днес, не е автоматично безполезна: тя може да пази рядка, скъпа за потребителя граница.

**По-силната посока: правим важните свойства по-лесни за гарантиране и използваме вече валидните доказателства.** Така отпада работа, без да премахваме свойството, заради което тя е добавена. Компромисът „половината проверки“ сам по себе си няма техническа обосновка.

Историята преди първоначалния Git snapshot от 11 август е проследена през запазените WI документи и learnings. Това са проектни записи за произхода, не независимо проверени исторически commit diff-ове. Където оригиналният мотив не е установен, той е означен като такъв.

### 1. Индексът: запазваме знанията, намаляваме повторното им създаване

**Защо е добавен:** [WI-521](../specs/work-items/WI-521.md) описва изгубен контекст, празен индекс, който остава зелен, и проверки без реални извиквания. Изричната цел на собственика е агентът да знае какво се е променило, без да губи три часа. Това е защита срещу реална слабост на обикновената ми работа: мога повторно да открия файловете, но да изпусна бизнес изключение или връзка извън diff-а.

**Полезен случай:** при Multicontext трябва да се помни защо смяната на контекст влияе върху права, таксуване, кешове и Admin. Списък с imports не обяснява тези зависимости.

**Проблемът:** смесваме трудно придобитото знание с лесно възстановими факти като файлови пътища. После поддържаме всичко като ръчно написана документация.

**Техническа промяна:** в съществуващия индекс пазим кратко причините, бизнес ограниченията, важните връзки и нерешените въпроси. Използваме наличните скриптове за извеждане на файловите факти. При продължаване на сесията четем тази част и променените източници; не изследваме целия домейн отначало. За локална поправка използваме съществуващата карта.

**Какво отпада / остава:** отпада повторното описване на факти, които инструментът вече знае; остава паметта, която обикновеното търсене не възстановява надеждно. Не предлагам нова платформа за семантичен граф: [WI-512](../specs/work-items/WI-512.md) вече записва отхвърляне на AST tooling поради недостатъчна обосновка. Нужно е ново измерване, за да се отвори отново този избор.

### 2. Остарелите индекси: проверяваме знанията там, където ги използваме

**Защо е добавено:** WI-521 свързва проверката с реалното приключване на работата, защото предишната защита е съществувала само на хартия. AC-15 добавя и `check-branch-index --all` при land. Оправдан е страхът от тихо използване на остарели знания; от него не следва, че всяка поправка трябва да обнови всички знания в хранилището.

**Полезен случай:** променен общ механизъм за права трябва да обезсили картите на зависещите от него функции, дори те да не са редактирани.

**Проблемът:** iOS стига до пречка от 17 стари индекса, при три отчетени като засегнати. Нямаме доказателство, че останалите 14 са напълно независими; затова автоматичното им игнориране също би било необосновано.

**Техническа промяна:** използваме съществуващите citations и картата на промяната, за да определим кои твърдения са засегнати или използвани за решението. Проверяваме тях и зависимостите им. Останалите остават видимо остарели и не могат по-късно да бъдат използвани като проверено знание. При неизвестна зависимост или промяна в общ договор разширяваме проверката. Това е предложение за обхвата на блокиране, не разрешение да маркираме непроверен индекс като актуален.

**Предимство спрямо default:** обикновено аз решавам този обхват в контекста си; тук запазваме основанието и за следващата сесия. Допълнителният разход трябва да е малка машинна проверка. Механизмът за разграничаване на hard/soft stale вече частично съществува в [branch-index-freshness.mjs](../../scripts/branch-index-freshness.mjs); задачата е да коригираме потребителите и обхвата му, а не да обещаем същата оптимизация повторно.

### 3. Нов печат, същото доказателство: отделяме резултата от опаковката

**Защо съществува:** печатът и hash-ът свързват проверката с конкретните входове. Иначе старо одобрение може да изглежда валидно за различен код. Точният първоначален инцидент за всяка stamp-проверка не е установен.

**Полезен случай:** променена миграция или политика за права не може да наследи старо одобрение само защото името на функцията е същото.

**Проблемът:** дата, местоположение на отчет или нов обобщаващ файл могат да предизвикат работа като при промяна на реалния предмет на проверката.

**Техническа промяна:** определяме за всяка проверка действителните входове: код, договори, зависими файлове, конфигурация, тестове, команда и среда; за AI ревю — и предоставения контекст, инструкцията и политиката на проверяващия. Преизползваме резултат само при проверено съвпадение и валиден произход. Генерираме обобщенията от него. При различни входове правим съответната проверка. Връзката към крайния commit остава отделна задължителна проверка.

Този принцип е използван в [Bazel action caching](https://bazel.build/remote/caching): кешът се основава на входовете и изпълнението. Пренасянето му към SSVE е инженерно предложение; документацията на Bazel не доказва безопасност на AI ревю кеш. AI ревюто е недетерминистично: преизползването запазва едно валидно старо наблюдение, но не го превръща в ново независимо мнение. Скритите зависимости обезсилват предпоставката.

**Какво вече има:** [run-external-review.mjs](../../scripts/run-external-review.mjs) вече има cache key, package hash, candidate digest и проверки на receipts. Преди нов код трябва да установим кои действителни промени в пакета причиняват пропуските в кеша. Не се премахва hash от ключа само за по-висок hit rate.

### 4. Планът: решаваме неизвестните, генерираме административните подробности

**Защо съществува:** планът пази последователност, обхват и възстановяване след прекъсване. Точното историческо основание за всяко изискване към inline план не е установено. iOS ревютата обаче показват реална полза: кръгови зависимости, липсваща регистрация на route, конфликтно притежание на преводи и offline тест с live зависимост.

**Проблемът:** вече прието продуктово решение се преписва в множество форми, после се поправят несъответствия между тях. Собственост по редове се уточнява дори когато един изпълнител работи последователно.

**Техническа промяна:** съществуващият план съдържа поведението, съществените решения, реда на опасните операции и начините за проверка. Команди и пътища, които могат да се прочетат от проекта, се валидират механично. Подробното разделяне на собственост се активира при реално паралелно редактиране. Преди дълъг план правим кратка проверка на най-несигурната техническа предпоставка — например работи ли Mapbox с действителната iOS конфигурация.

**Предимство спрямо default:** запазваме решенията за handoff и resume. Отпада ръчното синхронизиране на производни описания. Inline режимът вече съществува; трябва да поправим изискванията около него, които възстановяват цената на големия план.

### 5. Многото ревюта: пазим различните начини за откриване на проблем

**Защо съществуват:** прегледът на diff-а и проследяването на поведение през няколко компонента могат да намерят различни дефекти. Multicontext има конкретни примери: пропуск в entitlement, fallback поведение, финансово състезание и Admin регресия. Част от по-късните находки са върху променен код — не са доказателство, че първият преглед е бил безполезен.

**Проблемът:** етапите могат да повтарят общо четене и форматиране, вместо да изследват различни рискове. [WI-491](../specs/work-items/WI-491.md) документира девет кръга без сходимост поради противоречиви правила за приключване. Три кръга вече са въведени; ново обещание „ще ограничим до три“ не решава остатъчните рестартирания.

**Техническа промяна:** независимите проверяващи получават една замразена версия и ясни въпроси: потребителски сценарий, бизнес ограничения, конкурентен достъп, релевантна производителност. Първоначалните им мнения остават независими. След това обединяваме еднаквите находки по причина, запазваме идентичността им през поправките и връщаме засегнатите въпроси плюс възможните странични ефекти за проверка. Преименуван отчет не започва нов цикъл. Нова съществена находка се разглежда; лимитът не означава да премълчим проблем.

**Какво вече има:** [parallel-review-station.md](../../references/parallel-review-station.md) описва общ пакет, обединяване и повторение по засегнато направление, но посочва ограничение на паралелното изпълнение извън Claude. Нужно е да проверим реалното свързване в използвания host. Източникът му твърди полза от audit чрез WI-376, но [самият WI-376](../specs/work-items/WI-376.md) описва друго — изключения за closeout файлове. Тази конкретна историческа обосновка остава непотвърдена.

**Качество отвъд броя бъгове:** ревю може да донесе по-просто решение и разбиране, което помага на бъдещата работа. Това е наблюдавано в изследване на човешки екипи в Microsoft; то не доказва еднакъв ефект при AI агенти. При оценка на нашите ревюта трябва да запазим и тези резултати, а не само броя Critical/High. [Bacchelli и Bird, 2013](https://www.microsoft.com/en-us/research/publication/expectations-outcomes-and-challenges-of-modern-code-review/).

### 6. Различните модели: търсим допълващо се мислене

**Защо съществуват:** действащата политика изисква различно моделно семейство за независим преглед. Вероятната полза е по-малко общи слепи петна; разговорите не изолират причинния ефект на марката на модела.

**Проблемът:** различен доставчик може да повтори същата инструкция върху същия недостатъчен контекст. Същевременно чакането за него блокира целия поток.

**Техническа промяна:** първо подобряваме задачата и доказателствата на ревюиращия — например реално възпроизвеждане на смяна на контекст по време на финансова операция, вместо още едно общо „намери проблеми“. Сравняваме допълнителни потвърдени находки, полезни алтернативи и време върху еднакви кандидати. Запазваме изискваната независимост, докато нямаме основание за конкретна промяна на политиката.

**Какво отпада / остава:** кандидат за премахване е дублиращото възлагане без различен въпрос или наблюдение. Броят доставчици не се намалява на доверие. Това е предимство пред моето самостоятелно default саморевю само ако реално получаваме допълваща проверка.

### 7. Документите и защитите: преместваме гаранцията при самото действие

**Проследен произход:** [WI-112](../specs/work-items/WI-112.md) е добавен след като installer, пуснат от временен worktree, насочва 79 host symlink-а към него; изтриването на worktree чупи hooks. Отговорът е задължителна lifecycle таблица с 15 вида среди. [WI-121](../specs/work-items/WI-121.md) разширява въпросите и към изпълнение и одит. Първоначалното обобщаване е поискано от собственика след реален дефект.

**Полезен случай:** публикуване, миграция и изтриване на временна среда не бива да оставят зависещите от нея системи повредени.

**Проблемът:** въпросът се превръща в многократно доказване чрез текст, включително при промени, които не създават такова състояние. Самият WI-112 нарича промяната нискорискова, защото е документационна, без измерване на натрупаното време за изпълнение на инструкциите.

**По-силно техническо решение:** [setup](../../setup) вече разрешава durable canonical source и при разрешено стартиране от worktree пренасочва източника към него. Това премахва конкретния опасен избор от нормалното изпълнение. [Записът за повторението на инцидента](../../references/framework-learnings.jsonl) е `override-must-not-reopen-the-hazard-it-bypasses`: override трябва да разрешава безопасен път, а не да връща първоначалния дефект.

При подобни случаи ползваме готовата защитена операция и проверяваме договора ѝ при промяна. Продуктовата задача описва само новия външен ефект или отклонението. При липса на такава операция остава реалното инженерно изследване; таблицата не се премахва с надеждата, че всичко ще е наред.

За повторени release операции конкретен инструмент е стабилна идентичност на операцията и idempotency, когато външният API го поддържа. Това намалява клиентската сложност, но прехвърля част от нея в изпълняващата услуга; при неизвестен резултат и API без такава гаранция трябва reconciliation преди повторение. Не обещаваме exactly-once с локален JSON файл. [AWS Builders’ Library](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/).

Същият принцип важи за receipts: изпълняващият инструмент произвежда доказателството, проверката го валидира, обобщението се генерира. Не изискваме агентът ръчно да пресъздава вече известната истина в още един файл. Запазваме истинността, правилния кандидат и необходимата authority.

### Две промени, които могат да дадат по-голям ефект от съкращаване на отделна проверка

**А. Първо затваряме най-важната продуктова неизвестност.** При iOS реалното устройство е показало липсващи контроли, загубено състояние и неработещо изпращане. Ранна вертикална проба на съществуващия екран — от действие до резултат — може да промени решението преди финалните преводи, детайлния план и целия release пакет. Въпросът за иновация е конкретен: нужен ли е отделен grid/map контрол, или запазването на едно ясно състояние решава задачата по-добре? Сравняваме резултата в работещия екран. Това не отменя финалната проверка след последващи промени.

Тук default има предимство в краткия цикъл „погледни → промени → използвай“. SSVE може да добави устойчиво знание за поведението, без да отлага първия използваем резултат до края на документационната верига. Трябва съзнателно да отделим време за този цикъл; само премахването на тестове не създава иновация.

**Б. Отделяме еднократната инфраструктурна липса от всяка следваща функция.** Multicontext включва съществено изграждане на release controller, което поражда свои сценарии за прекъсване, заключване и възстановяване. Те имат стойност при няколко сесии и реални външни ефекти, но цената им трябва да се обосновава като споделена инфраструктурна инвестиция. Първо проверяваме дали наличният release път вече гарантира нужното; допълваме конкретната липса. Повторно използваем controller има смисъл само ако следващите функции действително минават през него без ново изграждане и пълно преквалифициране.

Не заменяме това с нов универсален workflow engine. Необходимостта от много нови декларации, ръчни зависимости и допълнителни ревюта би била основание да отхвърлим самото предложение за ускорение.

### Конкретно приложение към iOS случая

| Действие | Каква полза пази | Какъв разход премахва |
|---|---|---|
| Възпроизвеждане на устройството и ранна проверка на действителния Mapbox достъп | Работещ екран и вярна диагноза | Дълго планиране върху невярна техническа предпоставка |
| Една работеща поправка на контроли, filter state и submit, проверена през потребителския поток | UX, непрекъснатост на задачата, правилен резултат | Късно откриване на грешна интеракция след документационната работа |
| Преизползване на приетите решения; проверка на route, fixtures и реалните зависимости | Полезните находки от историческите план ревюта | Повторно авторство на същия план и изкуствени конфликти за последователен изпълнител |
| Проверка на засегнатите/използвани индекси и общите им зависимости | Актуално знание за конкретната промяна | Автоматично включване на целия стар документален дълг |
| Независим преглед на финалния кандидат; повторение при промяна на съответните входове | Второ мнение и проверка на поправките | Рестартиране заради нова опаковка на същите доказателства |
| Native проверка на доставения build | Истина за това, което потребителят ще получи | Няма основание да премахнем тази проверка само защото локалните тестове са зелени |

Таблицата описва проект за бъдещо изпълнение. Не е доказателство, че историческата iOS задача е можела да приключи за точно два часа.

### Как разграничаваме 5× подобрение от поредното обещание

**Първо се проверява използваната версия.** В наблюдавания Multicontext run има pinned framework source от по-стара ревизия. Поправка в текущия main не ускорява автоматично такава сесия. Проверяваме ефективния launcher, policy и source при началото/възобновяването; миграцията на активна работа трябва да запази валидната ѝ state/authority. Не сменяме източника сляпо по средата на release.

**След това измерваме критичния път.** Разделяме активно продуктово изпълнение, framework поддръжка, полезни проверки, повторения при същите входове, поправки и външно чакане. Сумирането на паралелни tool durations надценява elapsed time; целият overnight span също не е активно инженерно време. Използваме наличните timestamps и outputs, без да започваме нова observability платформа.

5× означава 80% по-малко време за същия резултат. От 30 часа до 2 часа е 15×. Ако повторенията не заемат достатъчно от критичния път, кеширане и по-бързи hooks няма да постигнат целта; трябва да променим границите на повторната работа и начина, по който се доставя функцията. Задължително 24-часово наблюдение остава 24 часа, докато самото изискване не бъде променено. Отчитаме отделно момента на доставка и завършеното наблюдение, без да наричаме второто приключило преждевременно.

Първите кандидати за реализация са: **премахване на повторното създаване на доказателства; ограничаване на stale блокирането до доказано релевантния обхват; запазване на идентичността на review находките през циклите; ранна проверка на устройството.** Това са кандидати по механизъм и наблюдавани пречки, не измерена класация по спестени часове. Кеш, inline план, bounded review и селективни тестове вече присъстват частично — трябва да докажем, че работят в реалния run.

При еднакъв обхват сравняваме default и променения SSVE по използваемост, покрити бизнес ограничения, реална производителност, полезни алтернативи, пропуснати дефекти и общо време до доставка, включително последващи поправки. Историческите намерени дефекти могат да служат за скрит контролен набор, но не се дават предварително на проверяващия. Те са минимален праг, не пълно доказателство за качество. Не добавяме нов голям тестов проект към всяка функция.

**Условие за премахване:** отпада конкретна стъпка, когато тя дублира валидно доказателство, обслужва неприложим риск или гаранцията ѝ вече е осигурена по-надеждно от изпълняващия механизъм. Ако ползата ѝ е неизвестна, това е въпрос за проверка — не автоматично „нула стойност“. Ако новата оптимизация изисква повече поддръжка, отколкото спестява, премахваме нея.

## Проверка срещу историческите receipts, commit diff-ове и audits

Допълнено след изричното искане да използвам натрупаните доказателства. Обхватът е конкретните Multicontext и native-discovery review вериги, плюс SSVE поправките за bounded review, session recovery, receipt cleanup и plan certification. Това не е преброяване на всички ревюта във всички проекти. Моделите и host-овете са взети от receipts: Codex/Sol и Grok за избраните продуктови планове, Cursor/Grok за избраните SSVE проверки. Не правя извод за сравнителна способност на моделите от марката им.

Запазен е [машинен извлек с пътища, времеви интервали и hash-ове](2026-09-07-delivery-historical-evidence.json). Той позволява проверка на изчисленията без ново широко търсене. Hash-ът в този извлек удостоверява прочетените байтове, не заменя собствената проверка на автентичността на оригиналния receipt.

### H1. Има измерима цена на ревютата, но тя не обяснява сама целия престой

| Извадка | Какво действително е прочетено | Измерен резултат | Ограничение |
|---|---|---|---|
| Multicontext completion plan и amendments | 28 файла `receipt.json`: 26 parseable launcher receipts, един друг вид receipt, един непарсируем файл | 23 process invocations; 20 transport/schema successes; 3 schema failures; 3 отказа преди invocation. Сума на launcher интервалите: **90.94 минути** | Success означава успешно получен резултат, не положителна присъда. Един непарсируем файл е изключен. Няма твърдение за общото време на всички ревюта |
| iOS native-discovery plan | 5 launcher receipts, от които 3 с реално ревю | **21.15 минути** общо; останалите два са config/input откази преди invocation | Трите ревюта са върху различни candidate/package digests |

Multicontext извадката има **20 candidate digests и 23 package hashes**, без отчетен `cache_hit`. Това не доказва, че кешът е счупен: голяма част от входовете наистина се променят. Следователно „добавяме кеш и получаваме 5×“ е недостатъчно предложение. Трябва да намалим и причините да създаваме нов кандидат, нов amendment и нова инфраструктурна задача.

Трите schema-failed Multicontext извиквания заемат общо **6.16 минути**. При `main1080-plan-amendment/independent-round2` и `independent-round2-retry1` candidate и package са еднакви: първият опит приключва `schema_invalid`, вторият прави ново ревю. Това е конкретен кандидат за по-надежден structured output или възстановяване на транспорта. Не е разрешение да се измисля липсваща присъда или да се преправя reviewer output без проверимо основание. Дори идеалното премахване на тези шест минути не дава 5× на целия run.

### H2. Част от „бавното ревю“ всъщност е прекъсната основна сесия

| Сесия | Явно записана причина | От грешката до следващия `task_started` |
|---|---|---:|
| iOS, 7 септември | `usage_limit_exceeded`, 06:43:51 → 07:47:08 UTC | **63.28 минути** |
| Multicontext, 7 септември | `usage_limit_exceeded`, 06:47:19 → 07:00:37 UTC | **13.30 минути** |
| SSVE, 6 септември | `server_overloaded`, 12:03:54 → 12:55:25 UTC | **51.52 минути** |
| SSVE, 7 септември | `usage_limit_exceeded`, 06:43:52 → 07:00:48 UTC | **16.93 минути** |

Това са интервали след грешка до възобновяване, не измерена продължителност на недостъпност на доставчика. Не знаем кога той отново е станал достъпен. Интервалите между различни сесии се припокриват и не се събират като общо време на разработчика.

За iOS transcript ред 2680 записва quota грешката; ред 2682 записва новото начало. Round 2 receipt приключва в 06:43:30, преди прекъсването. Затова голяма част от паузата преди round 3 не е нито мислене на Grok, нито работа по плана. Предишното обобщение „планът е чакал ревю“ е непълно.

**Промяна:** възобновяването първо консумира вече завършената работа и възстановява конкретната незавършена задача. За реално автоматично продължаване след quota е необходим разрешен наличен ресурс и host механизъм за handover; един агент не може да обещае да работи, докато собствената му сесия е спряна. Не заобикаляме лимитите и не сменяме изисквания reviewer скрито.

### H3. Commit diff-овете отделят поправката на продукта от поддръжката на печатите

В Multicontext историята се виждат следните конкретни двойки:

| Продуктова поправка | Следваща поддръжка | Какво показва diff-ът |
|---|---|---|
| `79e7ef01` — declaration за SQL email guard | `98585d69` — restamp | Следващият commit сменя само `Derived-at` и `stamped_at`; няма нова карта на поведение или тест |
| `e8a852c7` — финални billing поправки | `d8f77c0a` — restamp | Два файла, две замени на редове |
| `b32bb5d3` — възстановяване на Admin analytics | `1cc8d2f2` — restamp | Два файла, две замени на редове |
| `9401a9fd` — сериализация на Customer usage | `78258fe4` и `d206f7a1` — review/landing evidence | Последният commit пренасочва review evidence от ignored alias към tracked review history и сменя двата печата |

Не всички index commit-и са празна работа: `7b768451` например променя повече от печатите след нова concurrency поправка. И само от броя commit-и не може да се изчислят загубени часове или броят последвали ревюта.

**Изводът е по-тесен и сигурен:** поддържането на връзката с правилния код е нужно, но ръчното създаване на отделна промяна само за тази връзка е кандидат за автоматизиране. То не добавя самостоятелно доказателство, че поведението работи. Новата карта или поправеното бизнес ограничение остават съществена промяна.

Важно за времевата реконструкция: тези commit-и пазят author dates от 5 септември, но имат еднакъв committer timestamp на 7 септември след пренасяне на историята. Не използвам разликите между тези committer времена като продължителност на работа. Част от receipts сочат оригинални SHA; липсваща note на новия SHA сама по себе си не означава липсвало ревю.

### H4. Одитите доказват полезност на проверки отвъд първото ревю

`account-multicontext-layer3-astra-review.md` пази различни diff digests за round 1 и 2 и отделни commit/tree bindings за последващите кандидати. Находките за unresolved-context entitlement, липсващ RPC, финансово състезание и Admin са конкретни; commit-ите по-горе съдържат съответни поправки. Одитът допълва проверки с две PostgreSQL сесии, защото последователен тест не доказва конкурентно изпълнение.

Историческият [WI-521 global review](../specs/reviews/wi-521-global-review.md) дава друг пример: след отделните batches проверяващият открива останала препратка към несъществуващ validator и поправя реален недостижим контрол. Вторият pass на същото ревю не променя нищо. Това подкрепя полза от интеграционен поглед; не доказва нужда от универсален втори pass за всяка промяна.

**Промяна:** пазим проверки, които наблюдават различно поведение — реално конкурентно изпълнение, целия свързан път, потребителския резултат. Намаляваме еднаквото общо четене. Премахването на тези полезни проверки би направило резултата по-слаб от компетентна default работа, която също трябва да изследва установеното състезание.

### H5. Част от ревютата поправят дефекти, които новата release архитектура сама въвежда

Play amendment round 2 съдържа конкретни находки:

- `AMC-AMEND-F-001`: графът включва production флага, но няма разрешен изпълним път за обещаното аварийно изключване.
- `AMC-AMEND-F-002`: загубен отговор от Play create/upload или изтекъл edit могат да оставят release identity в безкрайно изчакване.
- `AMC-AMEND-F-003`: директният запис на immutable final receipt може да остави частичен JSON след crash, който после не може да се поправи.
- `AMC-AMEND-F-004`: началният immutable manifest трябва да съдържа provider идентичности, които ще възникнат едва по-късно.
- `AMC-AMEND-F-005`: отделно притежаваните host controller и Play adapter нямат достатъчно определен интеграционен договор.

По-късно `dependency-resume-amendment-20260907/independent-round1-retry1`, `F-001`, намира, че разрешаването на API resume в descriptors не работи през adapter, който още допуска само Play. Това е истински дефект, не формална забележка.

**Новият извод:** да отчетем всички тези поправки като оправдание за сегашната архитектура би било кръгов аргумент. Архитектурата създава част от сложността, ревютата я поправят, а после броят поправки се използва като доказателство да запазим целия процес. Правилният въпрос е дали същите външни ефекти могат да минат през по-малък, вече проверен release път. Ползата от правилен rollback остава; повторното изграждане на общ release orchestrator във feature задачата подлежи на оспорване.

Това не доказва, че всички controller тестове са излишни. Те са необходими за архитектурата, която реално ще се използва. Най-големият потенциал е да намалим повърхността, която трябва да създаваме и доказваме отново при следваща функция.

### H6. SSVE commit-ите показват последователни поправки на самата система за доказателства

| Commit | Установена поправка | Практически извод |
|---|---|---|
| `bead68b` / PR #35, 2 септември | Bounded review може да приключи според WI-491, но receipt схемата не може да представи допустимия резултат; добавена е проверима adjudication връзка | Лимит на review кръговете в инструкцията не ускорява, ако downstream gate не признава резултата |
| `6809a07` / PR #40, 7 септември | Приемане на съвместими producer receipts и използване на immutable archive след worktree cleanup | Валидността на историческото доказателство не трябва да зависи от живота на временния му път |
| `811d56d` / PR #41, 7 септември | Fixed-only plan certification census при round 3, запазващ суровите verdict-и и execution veto | „Находката е поправена“ трябва да може да се представи без подмяна на старото ревю и без безкраен нов кръг |

За PR #40 и #41 са прочетени и `refs/notes/svc-receipts`, включително plan, review, audit и verify-promotion слотовете. Те записват проверки след cleanup, source/squash tree equality и all-host install verification. Следователно тези две подобрения са **реализирани и имат записани доказателства за доставка**, а не бъдещи мои идеи. Това не доказва, че всяка активна продуктова сесия вече ги използва, нито че е измерено ускорение.

PR #40 plan review съдържа и Medium находка, че планът не изписва всички promotion flags, макар да сочи изпълняващия skill. Това показва конкретна възможност: готовият land инструмент трябва да разрешава проверимите repo/branch/PR входове и да изпълнява договора. Не е необходимо всяка feature задача да авторства второ подробно копие на същия протокол. Остават действителната authority и проверката на правилния кандидат.

### H7. Някои зелени receipt стадии доказват по-малко от това, което потребителят очаква

В прочетения `WI-ACCOUNT-MULTICONTEXT-01.receipts.json`:

- `device: done` сочи browser E2E файл и viewport **360×844**. Това е доказателство за mobile browser обхват; само по себе си не е доказателство за физически iPhone или доставен native build.
- `perf: done` сочи unit test и описва local state/static copy/bounded refresh. Това не е измерване на реална latency или плавност.

Възможно е по-силни доказателства да съществуват другаде; тези два stage записа сами не ги установяват. Изводът не е „цялата проверка е фалшива“, а че общото `done` крие различни нива на доказване.

**Техническа промяна с пряка продуктова стойност:** в съществуващото доказателство пазим реалния вид наблюдение — source inspection, unit, browser, physical device, hosted runtime — и какъв резултат е измерен. Producer-ът го попълва от действителния run. Потребителското изискване избира достатъчния вид доказателство. Така няма да харчим много за документационна пълнота, докато действителният UX или performance остава непроверен. Не добавяме нова паралелна система от receipts.

### Как историческите доказателства променят приоритета

1. **Намаляване на повторното изграждане на release инфраструктура и повторните интеграционни amendments.** Това е по-силен кандидат за голяма икономия от премахването на няколко reviewer минути. Точният потенциал още изисква разпределяне на останалия критичен път.
2. **Реално довеждане на вече поправените receipt/recovery механизми до използваната сесия.** Историята доказва landed поправки, а product receipts доказват използване на pinned стар източник.
3. **Автоматично извеждане и устойчиво пренасяне на същото валидно доказателство.** Конкретните stamp-only commit-и и alias repair показват каква човешка/агентска работа може да отпадне.
4. **По-ранни и по-точно назовани продуктови наблюдения.** Native UX, реално конкурентно изпълнение и релевантна измерена производителност носят повече яснота от още един общ зелен stage.
5. **Оптимизация на самите ревюта след това.** Structured-output failures и дублиращи задачи са конкретни цели; различните полезни проверки остават.

Тази подредба е обоснована инженерна преценка върху извадката, не измерен принос на всяка точка към 5×. Данните вече отхвърлят две прекалено прости обяснения: „всичко е от бавния модел“ и „всички ревюта са излишни“.

Последващият [анализ на предназначението на плана](2026-09-07-planning-purpose-redesign.md) проследява Superpowers → WI-347 Absolute Plan → WI-386 inline correction и предлага промяна на самия подход. Включва обработка на всичките 14 исторически iOS plan findings, правила за допустимо уточняване и запазените продуктови ограничения.
