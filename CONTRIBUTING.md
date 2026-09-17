# Contributing to Serious Serious Vibe Engineering (SSVE)

SSVE is an opinionated blend of the best patterns from the agent-coding
ecosystem. Contributions that make the pipeline faster, the specs tighter,
or the output more reliable are welcome.

Please read the [Code of Conduct](CODE_OF_CONDUCT.md) before participating.
Security issues belong in [SECURITY.md](SECURITY.md), not in a public issue
or pull request.

## How to contribute as an external contributor

### 1. Fork and clone

Fork the repository on GitHub, then clone **your fork**:

```bash
git clone https://github.com/<your-username>/ssve.git
cd ssve
git remote add upstream https://github.com/s7an-it/ssve.git
```

Work on a POSIX host (Linux, macOS, or Windows with WSL2). Native Windows
shells are not supported.

### 2. Install dependencies

You need these on `PATH` before running setup or tests:

| Dependency | Version | Why |
| ---------- | ------- | --- |
| `bash` | 4+ | Installer, evals, worktree helper |
| `git` | 2.25+ | Worktrees, hooks, receipts |
| `node` | **>= 22** | `.mjs` scripts, hooks, linters |
| `python3` | 3.x | `./setup` manifest parsing |

Optional: `jq`, `gh` (for opening PRs from the CLI), and one supported agent
host CLI if you are testing host wiring.

Confirm the toolchain:

```bash
bash --version
git --version
node --version    # must be v22 or newer
python3 --version
```

### 3. Run `./setup`

From the **clone root** (not from a later worktree):

```bash
./setup                  # default host (Claude Code)
./setup --host grok      # or any single supported host
./setup --all-hosts      # all nine provisioned hosts
```

`./setup` is content-addressed. It symlinks skills and infrastructure into
the host's skill directory and wires enforcement hooks. Re-run it after
`git pull` if install drift is reported.

Do **not** run a mutating `./setup` from inside `.worktrees/` as your
install source. Setup will try to re-point at the canonical checkout; if
that resolution fails, it refuses. Keep the clone you ran setup from.

### 4. Work in an isolated worktree

Do not commit feature work on `main`. Create an isolated worktree:

```bash
bash scripts/worktree.sh create feature-<name>
```

Examples:

```bash
bash scripts/worktree.sh create feature-security-policy
bash scripts/worktree.sh create bugfix-hook-argv
```

The worktree lives under `.worktrees/<branch>/`. `create` is idempotent —
safe to re-run after an interruption. See [`WORKTREES.md`](WORKTREES.md)
for `enter`, `status`, `promote`, and `remove`.

### 5. Test locally

From the worktree (or the clone root, for docs-only changes):

```bash
# Manifest, README, and routing stay in sync
node scripts/lint-skills-manifest.mjs

# Tier-1 evals (static, no paid LLM)
bash test-framework/evals/run-all-evals.sh
```

Tier 1 is the required local gate for contributions. `EVALS=1` enables
tiers 1.5–3 and needs a host CLI plus tokens — do not treat those as a
PR requirement unless the change specifically needs them.

If you touched skills, also run the relevant focused validators listed in
[`AGENTS.md`](AGENTS.md) (skill structure, contracts, chain references).

### 6. Submit a pull request

1. Commit on the worktree branch. Use the message format below.
2. Push the branch to **your fork**.
3. Open a PR against `s7an-it/ssve` `main`.
4. In the PR body, say what you changed, how you tested it, and which
   command output you relied on (`lint-skills-manifest`, tier-1 evals).
5. Do not squash-merge your own PR unless a maintainer asks you to.

Small, obvious fixes do not need a pre-existing issue. Larger changes
(new skills, blend sources, hook behavior) should start as a proposal
under `proposals/` or a discussion on the issue tracker.

## No bypasses

PRs that disable or mute enforcement will be rejected.

**Forbidden in contributions and in the commands you run to produce them:**

- `git commit --no-verify`, `git push --no-verify`, or any `--no-verify`
  git bypass
- `--no-gpg-sign` used to skip hook or trailer checks
- `SVC_DISABLED_HOOKS`, `SVC_HOOK_PROFILE=minimal`, or `SVC_BREAK_GLASS`
  to get a green eval or a clean commit
- Editing host `settings.json` / hook config / lockfiles / linter config
  to suppress `svc-workflow-guard`, `svc-bash-guard`, or install-drift
  checks
- `config_protection_override` entries whose only purpose is to silence
  a guard rather than to land a reviewed config change

If a hook blocks you, **fix the underlying issue**. The guards exist
because agents otherwise skip checks. Maintainers will not merge a
change that only works with enforcement turned off.

## What to contribute

### 1. Fix something broken

Found a skill that gives bad advice, a cross-reference that's wrong, or a
gate that doesn't catch what it should? Open a PR with the fix. No issue
required for obvious fixes.

### 2. Improve a skill

Read the skill, run it on a real project, and find where it falls short.
The best improvements come from real usage — not theoretical "what if"
scenarios. Include what you tested and what went wrong before the fix.

### 3. Blend from a new source

Found a skill pack, agent framework, or methodology with patterns SSVE
should take? Use `blend-external` (mode 1: new source) to produce a blend
plan, then implement it. The PR should include:

- The blend plan in `proposals/`
- The SKILL.md changes
- Updated `references/blend-registry.json` with the source SHA
- Updated [`NOTICES.md`](NOTICES.md) (and the plain-text [`NOTICES`](NOTICES) twin) with attribution

### 4. Propose an evolution

Use `evolve-framework` to audit the pipeline and find improvement
opportunities. The skill produces a prioritized proposal with evidence
citations. Submit the proposal as a PR — discussion happens in the review.

### 5. Add a companion integration

SSVE works best with companion skills (gstack browse, last30days, etc.).
If you know a tool that fills a gap, add it as an optional integration:

- Reference it in the relevant SKILL.md files (with fallback when not available)
- Add setup instructions to README.md
- Add attribution to [`NOTICES.md`](NOTICES.md)

### 6. Create a new skill

Copy an existing skill as a starting point — pick one closest to what you're
building. Follow the same structure (frontmatter, process, self-verify,
pipeline continuation). Run `node scripts/lint-skills-manifest.mjs` when done.

**Mandatory: Before Starting section.** Every new SKILL.md authored on or
after 2026-04-28 MUST include a `## Before Starting` section that builds a
bounded context plan from the session contract, `.svc/spec-index.json`,
work-item indexes, manifest metadata, and the relevant specs or validators.
The rule is **complete relevant context**: follow dependency and index links
until the affected surface is understood, without bulk-reading unrelated
artifacts. See `_shared/before-starting.md` for the canonical contract and
section template.

The tier-1 validator
`test-framework/evals/tier-1/validate-skill-before-starting.sh` is advisory
for legacy skills and blocking for skills authored on or after 2026-04-28.
Rationale: WI-135.

Optionally install Anthropic's [skill-creator](https://github.com/anthropics/skills)
for eval infrastructure and description optimization — see `EXTERNAL_ADDONS.md`.

## Skill conventions

All skills follow the `verb-noun` naming convention:

| Verb | Means | Example |
|------|-------|---------|
| `write` | Create a text artifact | `write-spec` |
| `design` | Create a design artifact | `design-ux` |
| `plan` | Create an execution plan | `plan-changeset` |
| `execute` | Carry out a plan | `execute-changeset` |
| `audit` | Check consistency/correctness | `audit-ac` |
| `review` | Evaluate quality at a gate | `review-gate` |
| `sync` | Push state externally | `sync-work-items` |
| `test` | Run tests/QA | `test-journeys` |
| `analyze` | Research/intelligence | `analyze-domain` |
| `blend` | Integrate from external | `blend-external` |
| `evolve` | Improve the framework | `evolve-framework` |

Every SKILL.md has YAML frontmatter with:

- `name` — matches the directory name
- `description` — when to trigger (be specific, include phrases users say)
- `inputs` — required and optional artifacts
- `outputs` — what the skill produces
- `chain` — lane positions, prev/next skills

## Feature toggle requirement

Every feature that touches an external service must ship with:

1. A mock implementation (ON by default)
2. A real implementation (behind a feature toggle, OFF by default)
3. An entry in `docs/specs/toggle-registry.md`

See [`references/feature-toggles.md`](references/feature-toggles.md).

## Pipeline integrity

After any change, verify:

```bash
# Skill count matches manifest
node scripts/lint-skills-manifest.mjs

# All skills have SKILL.md
find . -maxdepth 2 -name SKILL.md -not -path "./.git/*" | wc -l
```

The skill count in `skills-manifest.json`, README.md, and EXTERNAL_ADDONS.md
must all match. If you edit one of the five source-of-truth files
(`skills-manifest.json`, `README.md`, `EXTERNAL_ADDONS.md`, `REPO_MODES.md`,
`skills/route-workflow/SKILL.md`), update the others in the same change.

## Commit messages

Use this format:

```
<scope>: <what changed>

<why, in 1-3 lines>
```

Scope examples: `write-spec`, `doctrine`, `readme`, `blend-external`,
`security`.

Do not use speculative phrases such as "fix if needed". Describe the
verified change.

## Code of Conduct

All participation is governed by the
[Contributor Covenant Code of Conduct, version 2.1](CODE_OF_CONDUCT.md).
Enforcement contact: [angelovsan@gmail.com](mailto:angelovsan@gmail.com).

Review constructively. Assume good intent. If someone's approach is
different from yours, explain why you'd do it differently — don't dismiss
it.

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE). Third-party pattern attributions live in
[`NOTICES.md`](NOTICES.md).
