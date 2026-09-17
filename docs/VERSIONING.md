# SSVE Versioning & Release Policy

Canonical policy for Serious Serious Vibe Engineering (SSVE) public releases.
The git tag **is** the framework version. This repository has no root
`package.json` / `pyproject.toml` version field.

**Current public preview:** `v1.0.0-rc.1`

---

## Core Philosophy

SSVE follows **strict [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html)**
with **progressive release stabilization**.

- A version number is a compatibility contract, not a marketing label.
- Pre-release identifiers (`-rc.N`) sort **below** the matching GA version:
  `1.0.0-rc.1 < 1.0.0-rc.2 < 1.0.0`.
- The `v` prefix is a **git tag** convention. The SemVer string is `X.Y.Z` or
  `X.Y.Z-rc.N`.
- Per-skill `SKILL.md` frontmatter `version` (for example `"1.0"`) is a
  **skill-contract** field enforced by
  `test-framework/evals/tier-1/validate-skill-structure.sh`. It is not the
  framework release version. A breaking change to the shared `SKILL.md`
  schema still bumps **framework major**.

Consumers who want a stable preview pin the tag:

```bash
git clone --branch v1.0.0-rc.1 https://github.com/s7an-it/ssve.git
cd ssve && ./setup --all-hosts
```

`main` is the integration branch. It may move ahead of the latest tag.

---

## Release Candidate Progression

SSVE is entering public open source as a **release candidate**, not as GA.
The RC window exists so community installs, nine-host wiring, and public CI
can fail in the open before `v1.0.0` is declared.

| Tag | Status | Purpose |
|-----|--------|---------|
| `v1.0.0-rc.1` | **Public Early Preview & Architecture Baseline** | First public tag. Validates fresh installs, multi-host setup (`./setup --all-hosts`), zero-block worktree governance, and dormant GitHub Actions CI activation. |
| `v1.0.0-rc.N` (`N ≥ 2`) | Stabilization | Addresses edge cases, host/platform variances, and community feedback. Each `rc.N` is a new annotated tag — **never retag** `rc.1`. |
| `v1.0.0` | **General Availability (GA)** | Declared only after a stable verification period with **0 high-severity lockouts or regressions**. |

### `v1.0.0-rc.1` validation surface

All four must be exercised on the tagged commit (or a documented descendant
that does not change the contract):

1. **Fresh install** — clone into a clean POSIX environment (Linux, macOS, or
   Windows WSL2; Windows native is not supported), run `./setup` for at least
   one host, and start that host against a sample project.
2. **Multi-host setup** — `./setup --all-hosts` then
   `bash scripts/check-install-drift.sh --all-hosts` reports no drift for
   every provisioned host that is actually installed on the machine.
3. **Zero-block worktree governance** — safe reads work without a work item;
   the first authorized task binds atomically; same-owner recovery self-heals;
   foreign or ambiguous mutation stays fail-closed. See `WORKTREES.md` and
   AGENTS.md § Durable Mutation Authority.
4. **Dormant GitHub Actions CI activation** — this tree currently has no
   `.github/workflows/` directory. RC.1 is the window in which public CI is
   expected to be introduced and proven on the tagged ref. Until workflows
   exist, local proof is
   `bash test-framework/evals/run-all-evals.sh` (tier 1; `EVALS=1` for
   paid tiers).

### `v1.0.0-rc.N` rules

- Increment `N` for every public preview that is not GA.
- RC notes must list known host gaps honestly (for example Antigravity is
  skills-only until a verified hook wirer exists).
- An RC that introduces a breaking contract change **resets** the GA
  candidate (`v1.1.0-rc.1` or `v2.0.0-rc.1`), it does not hide under
  `v1.0.0-rc.N`.

### GA declaration (`v1.0.0`)

GA requires a **stable verification period** after the latest RC during which:

- No **high-severity lockout** is open: an install/setup failure that prevents
  using a listed supported host, worktree/authority behavior that blocks
  legitimate same-owner work, or default-checkout CI that fails on the tagged
  tree.
- No **high-severity regression** versus the previous RC on the four rc.1
  validation surfaces.
- Upgrade from the latest RC is `git fetch --tags && git checkout v1.0.0`
  followed by `./setup --all-hosts` — no manual symlink repair.

GA is an owner declaration recorded in this file and in the GitHub Release
body. Passing local tests alone is not GA.

---

## Semantic Versioning Guarantees (Post-v1.0)

After `v1.0.0`, version bumps follow this matrix. Pre-1.0 there is no
compatibility promise beyond “pin the tag.”

### Major — `X.0.0`

Incompatible changes. Downstream skills, hooks, or onboarded projects may
break without a coordinated upgrade.

Examples:

- Incompatible **doctrine** changes (phase order, gate meaning, receipt
  authority, Two-Box / transmutation contract).
- Breaking changes to the shared **`SKILL.md` schema** (required frontmatter
  fields, `inputs` / `outputs` / `chain` shape, skill-runtime contract).
- Changes to **worktree isolation invariants** (worktrees must live under
  `.worktrees/`, `.worktrees/` stays gitignored, one worktree per branch,
  mutation does not land on the default checkout except policy-approved
  merge/verify). See `WORKTREES.md`.
- Removal of a supported host, or a hook wire-protocol change that cannot
  be adapted inside `provision/hosts/<host>.json` without breaking existing
  installs.

### Minor — `1.X.0`

Backward-compatible additions.

Examples:

- New first-party skills (additions to `skills-manifest.json` `includedSkills`).
- New supported host platforms (`provision/hosts/<host>.json` + `./setup --host`).
- New pipeline lanes.
- Backward-compatible hook additions (new events on an existing host, new
  guards that fail closed only on newly prohibited actions).

### Patch — `1.0.X`

Fixes and non-behavioral documentation.

Examples:

- Bug fixes that preserve documented behavior.
- Hook performance optimizations that do not change deny/allow outcomes.
- Security advisories that do not require a contract change.
- Documentation updates (`README.md`, `docs/`, doctrine clarifications that
  do not change gate semantics).

If a “docs” change redefines a gate, a receipt schema, or an isolation rule,
it is **not** a patch.

---

## Git Tagging & Release Conventions

### Tag format

```
vX.Y.Z
vX.Y.Z-rc.N
```

Examples: `v1.0.0-rc.1`, `v1.0.0-rc.2`, `v1.0.0`, `v1.1.0`, `v2.0.0`.

### How to cut a tag

Tags are **annotated** and either **GPG-signed** or created from a
**commit-verified** commit (GitHub verified signature on the tagged SHA).

Prefer signing when a maintainer GPG key is available:

```bash
git checkout main
git pull --ff-only origin main
git status --short          # must be empty
git tag -s v1.0.0-rc.1 -m "SSVE v1.0.0-rc.1 — Public Early Preview & Architecture Baseline"
git push origin v1.0.0-rc.1
```

If GPG signing is not available on the cutting machine, use an annotated tag
on a verified commit:

```bash
git tag -a v1.0.0-rc.1 -m "SSVE v1.0.0-rc.1 — Public Early Preview & Architecture Baseline"
git push origin v1.0.0-rc.1
```

Rules:

- Tag a commit that is on `main` (or the named release branch), never a dirty
  worktree and never an unpublished feature SHA.
- Do not move, delete, or force-push a published tag. Cut `rc.N+1` instead.
- Lightweight tags (`git tag v1.0.0-rc.1` with no `-a`/`-s`) are not releases.
- Create a GitHub Release from the tag with notes that follow the template
  below.

### Release notes convention

Every GitHub Release body uses this shape:

```markdown
## vX.Y.Z[-rc.N] — <one-line title>

**Status:** Release Candidate | General Availability
**Tag:** vX.Y.Z[-rc.N]
**Policy:** docs/VERSIONING.md

### Highlights
- …

### Host impact
- all nine hosts | named hosts
- setup command: `./setup --all-hosts`

### Upgrade
git fetch --tags
git checkout vX.Y.Z[-rc.N]
./setup --all-hosts
bash scripts/check-install-drift.sh --all-hosts

### Breaking changes
- none | …

### Fixes
- …

### Known issues (RC only)
- …
```

RC releases stay marked **pre-release** on GitHub. GA unchecks pre-release.

---

## Compatibility Matrix & Host Support SLAs

SSVE is host-agnostic. The installer is the compatibility surface:
`./setup --host <name>` or `./setup --all-hosts`. Host CLIs themselves are
**not** vendored; vendors ship on their own cadence.

### Supported hosts (rc.1 baseline)

| Host | Manifest | Typical install path | Hook surface | RC.1 support |
|------|----------|----------------------|--------------|--------------|
| Claude Code | `provision/hosts/claude.json` | `~/.claude/skills` | 28 lifecycle events | Supported |
| OpenAI Codex CLI | `provision/hosts/codex.json` | `~/.codex/skills` | 6 events, consolidated PreToolUse dispatcher | Supported |
| Cursor Agent | `provision/hosts/cursor.json` | `~/.cursor/skills` | 6 events (`hooks.json`) | Supported |
| xAI Grok Build CLI | `provision/hosts/grok.json` | `~/.grok/skills` | 8 events (TOML) | Supported |
| Google Gemini CLI | `provision/hosts/gemini.json` | `~/.gemini/skills` | 11 events, strict JSON stdout | Supported |
| Google Antigravity (AGY) | `provision/hosts/antigravity.json` | `~/.gemini/antigravity/skills` | Skills target; hooks not enforced | Supported (skills-only) |
| OpenCode CLI | `provision/hosts/opencode.json` | `~/.config/opencode/skills` | 6 plugin events | Supported |
| Kimi Code CLI | `provision/hosts/kimi.json` | `~/.kimi/skills` | 13 events (TOML) | Supported |
| MiMo Code | `provision/hosts/mimo-code.json` | `~/.mimocode/skills` | 6 plugin events | Supported |

Platform: Linux and macOS are first-class. Windows is **WSL2 only**.
See README § Setup / Platform.

### How host version drift is managed

Host CLI vendors (Anthropic, OpenAI, Google, xAI, and others) release
independently of SSVE tags. Drift is handled as follows:

| Drift class | Detection | Response | Version bump |
|-------------|-----------|----------|--------------|
| **Install drift** — source skills/infra not symlinked into an installed host | `bash scripts/check-install-drift.sh --all-hosts`; pre-commit `hooks/svc-pre-commit-multi-host-check.sh` | Re-run `./setup --all-hosts`. Setup is content-addressed and transactional. | None (operator action) |
| **Host CLI protocol drift** — vendor changed hook events, payload shape, or decision format | Host-capability analysis against `provision/hosts/<host>.json` and current host docs (see `rules/host-capability-research.md`) | Adapt the host manifest and wirer. Preserve deny/allow semantics. | **Patch** if existing installs keep working; **minor** if a new host or new backward-compatible events; **major** if existing installs cannot be upgraded in place |
| **Partial host** — a host is skills-only or missing a wirer (Antigravity today) | Documented in the host manifest (`hooks: false` / skills-only) | Stay documented as a known gap on RC notes until a verified wirer lands | **Minor** when the wirer is added |
| **Dropped host** | Owner decision | Remove from the nine-host matrix and from `./setup --all-hosts` | **Major** |
| **New host** | New `provision/hosts/<host>.json` | Add to setup, drift check, and this matrix | **Minor** |

### Support SLA

| Phase | SLA |
|-------|-----|
| **`v1.0.0-rc.N`** | Best-effort. Community issues against the four rc.1 surfaces are the hardening loop. A broken host on a clean POSIX install is a candidate for `rc.N+1`, not silence. |
| **Post-`v1.0.0` (GA)** | A tagged GA release on which `./setup --host <supported>` fails on a listed POSIX platform is a **high-severity regression**. Fix with a patch (`1.0.X`) or, if the contract must change, a new major. Do not leave GA tagged while a listed host is silently uninstallable. |
| **Security** | Advisories that do not break contracts ship as patches. Contract-breaking security fixes ship as major with notes. |

SSVE does **not** pin or guarantee a specific vendor CLI version. The
supported surface is “the host still honors the declared events and decision
format in `provision/hosts/<host>.json`.” When a vendor ships a breaking CLI,
SSVE records the incompatibility in release notes and either adapts (patch)
or documents a temporary host gap on the next RC/patch.

---

## What a version does *not* cover

- Owner-local policy (`~/.svc/reviewer-policy-v2.json`, model profiles).
- Onboarded **product** repositories that consume SSVE — those keep their own
  tags.
- Optional external add-ons (`EXTERNAL_ADDONS.md`) pinned to *their* upstream
  tags.
- Per-skill `SKILL.md` `version` fields.

---

## Change log for this policy

| Date | Change |
|------|--------|
| 2026-09-17 | Initial policy. Public preview `v1.0.0-rc.1`. |
