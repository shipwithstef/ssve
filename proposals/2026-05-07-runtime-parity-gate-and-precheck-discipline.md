# Proposal: Runtime-Parity Gate + Pre-Execute Variable Check (Lane 7 hardening)

**Filed:** 2026-05-07
**Author:** Claude Opus 4.7 (1M ctx) via WI-043 / WI-047 session
**Severity:** HIGH — silent verification failure mode demonstrated end-to-end
**Targets:** `seriousvibecoding/` framework (Lane 7 G1 + verify-promotion); `vibomatic-tests/` harness (new scenario)
**Status:** identified — awaiting framework-improvement implementation

---

## TL;DR

Lane 7's G1 contract says "after port, behavior on every layer is ≥ legacy"
but doesn't enforce that **Users layer = legacy** is proven by a real end-to-end
behavioral test that mirrors what a real consumer does. In WI-043 (mock-data
BB→GH port), I marked VERIFIED-CHAIN-INFRA after confirming the **on-disk
shape** of fixtures via `ls`, `readlink`, `find`, and `head` from the shell.
The Java service that **consumes** those fixtures returns 404 — chain not
actually equivalent to legacy. The framework gates didn't catch this.

Two concrete failures, both fixable:

1. **G1 verdict for "Users" layer is too weak.** Marking `=` requires only
   "users can still do what they did before." Without an actual end-to-end
   test invoking the same code path real users invoke, the verdict is
   speculation. Need a hard requirement: at least one HTTP/behavioral test
   from a real consumer against the new env, with output diff'd against
   legacy or against a known-good fixture.

2. **No pre-execute variable check.** Before I started building chart hot
   fixes, I never verified that the consumer Java code's assumptions matched
   what my chart would deliver. I assumed "Spring static-resource handler" —
   wrong. The actual consumer is custom JGit-based code (per `git-relative-path`
   property). Reading the consumer's source code is a precondition, not a
   "nice to have."

---

## What happened in WI-043 (the failure trace)

**The contract I claimed:** "Java code is untouched. Sidecar makes the on-disk
path real at the same relative location." (G1 verdict: Users = `=` legacy.)

**What I actually verified:**
- Files reachable on disk via shell ✓
- Symlinks resolve correctly via shell ✓
- 41 fixture dirs visible at `/home/ezbob/mock-data/mock-data.git/` ✓

**What I never verified:**
- ❌ Did Java actually read those files at runtime?
- ❌ Did service-mocks return real fixture content over HTTP to a caller?
- ❌ Does the new on-disk shape match legacy's on-disk shape exactly
  (real dirs vs symlinks; `.git/` placement)?

**What surfaced when the user pushed back:**
- service-mocks throws `NoResourceFoundException` for every fixture path.
- `git-relative-path` property name implies JGit operations on a path
  expected to be a real cloned repo with `.git/` metadata inside.
- I built a symlink chain (mock-data.git → .worktrees/<sha>; au10tix →
  config/mock-data/au10tix) where legacy has zero symlinks.
- I never read the consumer Java source. Five hours of work on a chain that
  may not match the consumer's expectations.

**Root cause of the failure:** I confused **producer-side correctness**
(chart delivers files at the right path) with **end-to-end parity** (consumer
reads files exactly the way legacy did). The framework's G1 verdict template
let me sign off on the second by checking the first.

---

## Proposal A — Lane 7 G1 / verify-promotion: runtime-parity gate

Add to `seriousvibecoding/route-workflow/SKILL.md` Lane 7 §G1:

> **Users-layer verdict requires runtime evidence.**
>
> Marking the Users layer `=` (parity) or `>` (better) requires at least one
> end-to-end test against the new env that:
>
> 1. Invokes the same consumer code path real users invoke (not a shell-level
>    file check; not a curl against the producer service alone).
> 2. Returns output that can be byte-compared OR semantic-compared against
>    legacy output OR a known-good fixture.
> 3. Logs the test command, the response status, the response body diff,
>    and timestamps in `<project>/docs/architecture/<date>-<wi>-runtime-parity.md`.
>
> If no end-to-end test is yet feasible (e.g., consumer code doesn't exist on
> the new env yet), the G1 verdict for Users MUST be `<` (worse — explicit
> regression) with a remediation timeline. Marking `=` without runtime evidence
> is a CONTRACT VIOLATION at G8 acceptance.

Add to `verify-promotion/SKILL.md`:

> For brownfield migration ports (Lane 7), `verify-promotion` MUST execute the
> runtime parity test described in G1. The output file
> `<date>-<wi>-runtime-parity.md` is the only acceptable evidence. Disk-state
> evidence (file presence, symlink targets, fixture counts) is insufficient
> — disk state and runtime behaviour are different layers.

---

## Proposal B — Pre-Execute Variable Check (universal pre-flight extension)

Add to `seriousvibecoding/route-workflow/SKILL.md` Pre-Flight Protocol §2.5:

> **Before any execute-changeset that bridges a producer to a consumer
> (charts, sidecars, adaptors, infrastructure layers between two services),
> the agent MUST read and cite the consumer's source code for the contract
> being bridged.**
>
> Specifically:
>
> 1. Identify the consumer's contract surface — config property, env var,
>    file path, API endpoint that the bridge will satisfy.
> 2. Open the consumer's source code (Java, Go, Python, whatever) and read
>    HOW it consumes that contract. Read the actual implementation, not the
>    documentation, not the property name, not the assumed pattern.
> 3. Cite the consumer file + line range in the design authority / plan-changeset
>    output. If the cite is missing, plan-changeset MUST refuse acceptance.
> 4. List every assumption the bridge makes about the consumer (e.g., "Java
>    follows symlinks", "Spring serves from filesystem", "JGit accepts a
>    worktree-only path"). Mark each as VERIFIED (cite to consumer source) or
>    UNVERIFIED (block plan acceptance until verified or explicitly accepted).
>
> WI-043 example failure: I assumed service-mocks was a Spring static-resource
> server. It's actually JGit-based per `git-relative-path: mock-data/mock-data.git`.
> Reading the consumer Java code (10 minutes) would have revealed the chart's
> symlink-based flatten doesn't satisfy JGit's expectation of a real `.git/`
> dir inside the path. That precheck never happened, and 5 hours of chart
> hotfixes followed.

---

## Proposal C — vibomatic-tests scenario for this failure pattern

Add `vibomatic-tests/scenarios/08-runtime-parity-gate.json`:

> **Tests:** Lane 7 G1 + verify-promotion enforces runtime parity, not just
> disk-state parity.
>
> **Setup:** synthetic legacy service that reads files via JGit;
> synthetic new chart that delivers the same files via symlinks (passes
> `ls`/`readlink`/`find` checks but breaks JGit because no `.git/` inside).
>
> **Expected behaviour:** vibomatic-driven Lane 7 run REJECTS the G1 Users
> verdict when only disk-state evidence is supplied, demands runtime evidence,
> and surfaces the JGit failure before VERIFIED status. Baseline (no methodology)
> approach passes prematurely.
>
> **Pass criteria:**
> - Vibomatic catches the disk-vs-runtime gap before close
> - Baseline does not (demonstrates the framework's value-add)
> - The framework's runtime-parity output file exists and is byte-compared
>   against expected fixture content

---

## Proposal D — Pre-Close Behavioural Smoke (verify-promotion)

Strengthen `verify-promotion/SKILL.md` close-out check:

> Before closing any work item in any lane that touches a behavioural surface,
> `verify-promotion` MUST capture:
>
> - Test command (verbatim, paste-ready)
> - Response status code (or equivalent for non-HTTP)
> - Response body diff vs expected (legacy output or fixture)
> - Timestamp + commit SHA being verified
>
> Stored in `docs/architecture/<date>-<wi>-runtime-smoke.md` (or appended to
> the WI file). A WI cannot be marked VERIFIED without this artifact when
> the change touches a behavioural surface. Disk/file/lint/typecheck checks
> are NOT behavioural surfaces.

---

## Why these proposals matter beyond WI-043

This failure mode is general:

- Helm chart claims to satisfy a contract → Java/Python service consumes it →
  disk-shape passes inspection → runtime behaviour breaks → user thinks
  "shipped" when really shipped-broken.
- IaC module provisions a resource → consumer service expects specific
  attributes → terraform plan looks fine → consumer 500s in prod.
- Migration tool produces output → downstream pipeline reads it → file format
  parses cleanly → semantic content is wrong.

Pattern: "producer side proven; consumer side unverified." The framework's
job is to make this pattern impossible to ship by accident. Today, Lane 7 v2
makes most of it impossible — but it leaves a hole where "Users layer = legacy"
can be claimed without runtime evidence.

---

## Acceptance criteria

- [ ] Proposal A landed in `route-workflow/SKILL.md` Lane 7 §G1 and
      `verify-promotion/SKILL.md`
- [ ] Proposal B landed in `route-workflow/SKILL.md` Pre-Flight Protocol §2.5
- [ ] Proposal C scenario added to `vibomatic-tests/scenarios/`, runs green
      (catches the synthetic disk-vs-runtime gap)
- [ ] Proposal D landed in `verify-promotion/SKILL.md` close-out check
- [ ] WI-043 + WI-047 retroactively re-verified against the new gate (likely
      finding: G1 Users verdict was wrong; should have been `<` until the
      JGit-compatible chart hotfix landed and an HTTP smoke against an adaptor
      passed)

---

## What I'll do next on WI-047 once this proposal is filed

Apply proposal B to myself: precheck all variables before the next attempt.

1. Read `ezbob-services/services/mock/service-mocks/src/main/java/...` to find
   how `git-relative-path` is consumed. Specifically:
   - Is it a Spring static-resource location?
   - Is it a JGit `Repository.open()` argument?
   - Is it a raw `Files.readString(Path.of(prop, ...))` filesystem read?
2. Identify which legacy on-disk shape the consumer requires:
   - A real cloned repo (with `.git/` metadata inside)?
   - A bare directory tree (just files; no git)?
   - A working-tree path with sibling `.git/` next to it?
3. Cross-reference what legacy git-sync v3 produces vs what new git-sync v4
   produces. Document the delta line by line.
4. Choose the chart fix that produces a byte-equivalent on-disk shape:
   either materialise via `cp -al` hardlink-tree (no symlinks; real dirs;
   real `.git/` placement if needed) OR restructure the GH source so sparse
   checkout produces a flat-rooted tree with no second symlink layer.
5. Run an HTTP test from a real adaptor pod that triggers the consumer
   code path. Diff response against expected fixture content.
6. ONLY THEN mark the WI VERIFIED. Update the framework proposal with the
   real consumer-code citation as evidence the precheck happened.

The fix won't ship until each variable in steps 1-5 is checked. No more "looks
right at the shell" → "marked VERIFIED" → "user finds it broken in prod."

---

## Cross-references

- WI-043 closure docs: `new-devops-platform/docs/specs/work-items/WI-043.md`,
  `WI-047.md`
- WI-043 reasoning postmortem: `feedback_lazy_vs_right_architecture.md`,
  `feedback_chart_absorbs_layout.md`,
  `feedback_subpath_doesnt_traverse_symlinks.md` (all in
  `~/.claude/projects/.../memory/`)
- The session that demanded this proposal: 2026-05-07 user pushback after I
  marked WI-043 VERIFIED-CHAIN-INFRA without runtime HTTP evidence
- Adjacent past proposals: `2026-05-02-lane-7-infra-mode-deepening.md`
  (G0–G8 introduction); this proposal extends G1 specifically
