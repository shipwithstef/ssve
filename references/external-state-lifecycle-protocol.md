# External State Lifecycle Protocol

## Why this exists

Every framework artifact has a lifecycle (created → modified → deployed → reverted → removed). Many changes write to **environments outside the artifact under review**. Today's review skills inspect only the artifact, not the cross-environment lifecycle coupling. Result: silent breakage when the artifact's lifecycle event (e.g. worktree removal, branch deletion, package downgrade) leaves the external state stranded or invalid.

This protocol installs a single load-bearing question and a mechanical check that, together, generalize across every variant of the failure class.

## The wrapper question

Asked at every plan-changeset and surfaced as a gate by review-plan, review-gate, and audit-implementation:

> **What state outside this artifact does this change create, mutate, or rely on — and is the lifecycle of that external state explicitly coupled to the lifecycle of this artifact (create together, change together, revert together, remove together)?**

If the answer is "external state exists but its lifecycle is NOT explicitly coupled," that is a HIGH-severity finding by default, regardless of the change's apparent size. Either couple the lifecycles (add a setup step, a rollback hook, a cleanup script, a guard) or document why decoupling is intentional and safe.

## The taxonomy of external environments

When a planner answers the wrapper question they MUST walk this list rather than relying on memory. An "untouched" entry is acceptable; a "skipped" entry is not.

| # | Environment | Examples | Typical artifact-lifecycle leak |
|---|-------------|----------|----------------------------------|
| 1 | Host filesystem outside repo | `~/.claude/skills/`, `~/.config/`, `~/.cache/`, OS install dirs | dangling symlinks after worktree removal |
| 2 | Host config files | `~/.claude/settings.json`, `~/.kimi/settings.json`, `~/.codex/config.toml`, `~/.gemini/config.toml`, OS-level `.bashrc`/`.zshrc` | stale hook paths, broken env vars |
| 3 | Out-of-tree but version-controlled | other branches, sibling worktrees, submodules, sister repos | divergent state across branches |
| 4 | Package registries | `npm`, `pypi`, `cargo`, `crates.io`, GitHub Packages | stranded versions, downgrade gaps |
| 5 | Schedulers / persistent jobs | `cron`, `launchd`, `systemd`, GitHub Actions cron, GH Scheduled remote agents | orphan jobs firing against deleted code |
| 6 | Running services | MCP servers, ACP servers, sidecars, dev-server processes | live processes pointing at moved files |
| 7 | External SaaS | LaunchDarkly, Vercel, Netlify, Stripe, GitHub branch protection, Slack webhooks, Linear, Notion | orphan flags, dangling hooks, broken protection rules |
| 8 | Database / migrations | Postgres, Supabase, SQLite migration files | applied-but-unrolledback migrations on test/staging |
| 9 | Caches | Redis, CDN edges, browser IndexedDB, build caches | stale keys after schema change |
| 10 | DNS / SSL / domains | DNS records, SSL certificates, domain registrar settings | unreachable endpoints after deploy |
| 11 | Search / index services | Algolia, Elastic, OpenSearch, Pinecone, embeddings stores | stale documents, version skew |
| 12 | Downstream framework artifacts | other skills' frontmatter `inputs`/`outputs`/`chain`, `skills-manifest.json`, lane definitions, manifest hashes | contract drift across skills |
| 13 | CI/CD wires | GitHub Actions workflows, branch protection required-checks list, release tags | renamed checks blocking merges |
| 14 | Authentication / secrets | tokens in `~/.netrc`, `~/.aws/credentials`, env files, vault entries | abandoned tokens with live access |
| 15 | Filesystem state created at runtime | log dirs, sock files, lock files, tmp scratch, downloaded artifacts | leftover artifacts contaminate next run |

This list is **incomplete by design** — it grows with every framework lesson. New entries go to the bottom with the date and the lesson that surfaced them. Always treat the list as "minimum coverage" rather than "exhaustive coverage" — the wrapper question still applies even for environments not on the list.

## The 4-stage gate (WI-121)

The wrapper question is enforced at every stage where artifact lifecycle changes:

| Stage | Skill | What the gate checks |
|---|---|---|
| Plan | `plan-changeset` | The plan's `## External State Lifecycle` section is non-empty and walks the taxonomy |
| Exec | `execute-changeset` | Implementation writes match the declared external-state set; surfaces undeclared writes as HIGH severity before the final commit |
| Review | `review-gate` (G6/G7) | Cross-checks final diff against plan's external-state set; flags omissions before merge |
| Audit | `audit-implementation` | Post-merge external-state diff scan; catches drift introduced by emergency fixes or partial reverts |

Each stage emits findings of type `external-state-uncoupled` (or the more specific `external-state-undeclared` at exec/review/audit when writes don't match the plan's declared set). HIGH severity by default.

## The finding-type

Reviewers (review-plan, review-gate, audit-implementation) emit findings of type `external-state-uncoupled` when:

- The plan's `## External State` section is missing, or
- The plan's `## External State` section claims "no external state" but the diff writes to something outside `{repo-root, worktree-root, .svc/}`, or
- A coupled lifecycle is declared but the corresponding setup/rollback/cleanup wiring is absent in the manifest.

**Severity:** HIGH (default). Always blocks `approve` unless the planner provides explicit justification AND a coupled mitigation (e.g. "post-merge symlink restore is wired in `setup`'s exit-from-worktree path").

The check is mechanical-first: scan the diff for paths outside the change-set boundary, cross-reference with the External State section's environment table, fail-closed on any mismatch. Only after the mechanical pass does the human/agent reviewer add taste-level commentary.

## How a planner answers the wrapper question

In `plan-changeset` output, fill an `## External State` section with this shape:

```markdown
## External State

| Environment | What state | Coupling | Lifecycle wiring |
|-------------|------------|----------|------------------|
| (taxonomy entry # or "ad-hoc + brief description") | what is created/mutated/relied on | coupled \| decoupled-justified | path/script/check that enforces the coupling |
| ... | ... | ... | ... |

Untouched environments (walked the taxonomy, found nothing): <list of taxonomy entry numbers>
Decoupled-justified entries require a paragraph explaining why decoupling is safe and which monitoring/recovery path catches drift.
```

Empty section is invalid. The taxonomy walk must be visible — at minimum, list which entries were checked.

## Lessons that grew this taxonomy

| Date | Entry # added | Surfaced by |
|------|---------------|-------------|
| 2026-04-25 | 1, 2 | WI-111 → WI-112: ./setup run from worktree repointed 79 host symlinks; cleanup left them dangling |
| 2026-04-25 | (4-stage gate) | WI-121: extended the gate from plan-time only to plan/exec/review/audit so undeclared writes can't sneak through later stages |

When a future failure surfaces a new environment class, append a row here AND extend the table above.
