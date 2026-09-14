# Feature: `_shared/` directory symlinking across all 5 hosts

**Status:** VERIFIED
**Type:** Enabler
**Authoring mode:** `bugfix-behavior`
**Consumers:** `setup` script, every skill that references `_shared/<file>` (14 skills, 25 call sites), `lint-skills-manifest.mjs`
**WI:** WI-137
**Lane:** framework
**Priority:** high
**Created:** 2026-04-29

---

## Problem Statement

`./setup --host <h>` is supposed to make all framework content reachable from the active host's skills directory (e.g. `~/.claude/skills/`). It correctly symlinks every directory enumerated in `provision/hosts/<h>.json` under `infra_dirs`. But `_shared/` is absent from every host manifest, so it is never symlinked.

**Actual behavior:** After `./setup --host <h>`, `~/<host>/skills/_shared/` is either missing entirely, or — if a previous run created it — empty. Skills that reference `_shared/<file>` get "file not found" at runtime, but the failure is silent: the skill keeps running without the convention it was supposed to load.

**Expected behavior:** After `./setup --host <h>`, `~/<host>/skills/_shared/` resolves to the framework's `_shared/` directory (whole-dir symlink, the same shape used for `references/`, `proposals/`, `templates/`, etc.), so every `_shared/<file>` reference resolves correctly on every supported host.

**Why this matters now:** Audit on 2026-04-29 found `_shared/product-question-format.md` (the framework's most-cited convention, **17 call sites** across the product-question gates) was silently missing on 4 of 5 hosts. The 12-section product-question coverage floor has been advisory-only on codex/opencode/kimi/gemini for the entire lifetime of the convention. This is convention rot the framework cannot detect from inside.

---

## Behavior Contract — bugfix scope

### Invariant (must remain unchanged)

- `setup` script's `infra_dirs` symlink loop (lines ~165–180): same code path, same idempotent `[ -e "$dst" ] && rm -rf "$dst"` pre-clean.
- All other top-level dirs (`references/`, `proposals/`, `templates/`, `examples/`, `hooks/`, `provision/`, `scripts/`) keep symlinking exactly as today.
- `rules/` keeps its dedicated install path — out of scope.
- Skill auto-discovery rule (`for d in <repo>/*/; do [ -f "$d/SKILL.md" ]; done`) is unchanged. `_shared/` does not get a `SKILL.md`; it is infra, not a skill.

### Changes

1. Each of `provision/hosts/{claude,codex,opencode,kimi,gemini}.json` adds `"_shared"` to `infra_dirs`.
2. New tier-1 validator `test-framework/evals/tier-1/validate-shared-content-symlinks.sh` asserts every `_shared/<file>` is reachable from every detected host install on the machine.
3. `scripts/lint-skills-manifest.mjs` gains a meta-check: any top-level dir containing content referenced by `_shared/<file>` patterns from any SKILL.md must appear in `infra_dirs` of every host manifest, OR be in an explicit exception list (`rules/` is the only documented exception).

### Out of scope

- Refactoring `setup` to whole-dir vs per-file behavior — current dir-symlink path already works.
- Changing what's inside `_shared/` itself.
- Migrating any skill from referencing `_shared/<file>` to a different shared mechanism.
- Other framework dirs (`rules/` is excepted; nothing else is affected per audit).

---

## Acceptance Criteria

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| WI137-01 | `./setup --host claude` populates `~/.claude/skills/_shared/` with all files from the framework's `_shared/` (resolves via dir-symlink). | — | 🔲 | — |
| WI137-02 | Re-running `setup --host <h>` is idempotent: pre-existing manual `_shared/` directories with per-file symlinks (current state on all 5 hosts) are cleanly replaced by the new dir-symlink. No leftover broken symlinks. No errors. | — | 🔲 | — |
| WI137-03 | Tier-1 validator `validate-shared-content-symlinks.sh` exists, exits 0 when every `_shared/<file>` is reachable from every detected host install, exits non-zero otherwise. | — | 🔲 | — |
| WI137-04 | All 5 supported hosts (claude, codex, opencode, kimi, gemini) populate `_shared/` after `./setup --host <h>`. Verified by running setup against each host on a clean install path and asserting reachability. | — | 🔲 | — |
| WI137-05 | Brownfield clean-up: hosts that previously had partial manual symlinks (codex/opencode/kimi/gemini have only `before-starting.md`; claude has all 3 files) end up with a single dir-symlink → framework `_shared/`. No leftover broken links. | — | 🔲 | — |
| WI137-06 | Validator iterates **every** detected host install path on the machine — not just the active host. Multi-host setups can't silently drift. Detection: probe `~/.claude/skills/`, `~/.codex/skills/`, `~/.config/opencode/skills/`, `~/.kimi/skills/`, `~/.gemini/skills/`; check each that exists. | — | 🔲 | — |
| WI137-07 | Meta-check in `lint-skills-manifest.mjs`: linter exits non-zero if any top-level dir containing content referenced from a SKILL.md is missing from any host manifest's `infra_dirs` (excepting `rules/` which has its own install path). | — | 🔲 | — |
| WI137-08 | Negative test: synthetically remove `"_shared"` from `provision/hosts/claude.json`; `lint-skills-manifest.mjs` exits non-zero with a message naming the missing dir and host. | — | 🔲 | — |

---

## System Dependencies

### This feature depends on:

| Dependency | Type | Spec exists? | What it provides | Mock strategy |
|-----------|------|-------------|-----------------|---------------|
| `setup` script (`infra_dirs` loop, lines ~165–180) | Enabler | implicit | Existing dir-symlink mechanism; `[ -e "$dst" ] && rm -rf "$dst"` idempotency | N/A — local FS only |
| `provision/hosts/<host>.json` schema | Enabler | implicit | `infra_dirs` array slot; existing schema accepts `_shared` without modification | N/A — config-only |
| `scripts/lint-skills-manifest.mjs` | Enabler | implicit | Existing source-of-truth cross-validation; meta-rule slots into existing pass | N/A — local FS only |

### Other features depend on this:

| Consumer | Type | What it needs from us |
|----------|------|----------------------|
| Every skill referencing `_shared/product-question-format.md` (17 call sites: capture-idea, validate-feature, write-spec, design-ux, design-tech, plan-changeset, execute-changeset, review-gate, test-journeys, diagnose-bug, audit-ac, sync-spec-code, …) | Feature/Enabler | Reachable file at install path so the 12-section product-question convention loads |
| Every skill referencing `_shared/before-starting.md` (5 call sites) | Feature/Enabler | Reachable file for the context-loading chain convention (WI-135) |
| Every skill referencing `_shared/constraint-profiles.md` (3 call sites) | Feature/Enabler | Reachable file for constraint-profile schema |

---

## Pillars Coverage Matrix

| # | Pillar | State | Artifact / note |
|---|---|---|---|
| 1 | Product fit | `[UPDATED]` | Framework convention rot. WI-137 ticket + audit findings inline. |
| 2 | Journey | `[N/A — justified: framework bugfix has no user-facing or system-event journey beyond setup invocation, captured in the Behavior Contract]` | — |
| 3 | Acceptance criteria | `[NEW]` | This spec — 8 ACs |
| 4 | UX | `[N/A — justified: no user-facing surface]` | — |
| 5 | UI | `[N/A — justified: no user-facing surface]` | — |
| 6 | Tech architecture | `[UPDATED]` | Behavior Contract section above; design-tech step folded in (5 JSON edits + 1 validator + 1 meta-rule, small enough to need no separate tech doc) |
| 7 | Cost model | `[N/A — justified: zero runtime cost; one-time symlink creation during setup]` | — |
| 8 | Operations & ownership | `[UPDATED]` | Owner: framework maintainers. Validator runs in tier-1; failures block CI. No new monitoring needed — symlink reachability is binary and fully covered by the validator. |

---

## Implementation Notes

To be added by `plan-changeset` and `execute-changeset`. High-level plan:

1. **Edit 1–5:** Add `"_shared"` to `infra_dirs` in each of `provision/hosts/{claude,codex,opencode,kimi,gemini}.json`.
2. **New file:** `test-framework/evals/tier-1/validate-shared-content-symlinks.sh` — iterates the 5 host install paths, for each that exists asserts every framework `_shared/*.md` resolves through it.
3. **Edit 6:** `scripts/lint-skills-manifest.mjs` — add meta-check: scan all SKILL.md for `_shared/<file>` patterns (and any future top-level shared-content patterns), assert the parent dir is in every host manifest's `infra_dirs` or in an explicit exception allow-list.
4. **Wire validator** into `test-framework/evals/run-all-evals.sh --tier1` (or whichever discovery mechanism tier-1 uses).
5. **Test brownfield path** by running setup against a host install that has partial `_shared/` content, confirm `rm -rf` cleans + dir-symlink replaces.
6. **Cross-host smoke** — run setup for each of the 5 hosts in sequence on a fresh install dir, run the validator after each.

---

## Revision Log

_(empty — first draft)_

---

## Journey References

_None — framework bugfix; no user or system journey beyond `setup` invocation, which is captured in the Behavior Contract section._
