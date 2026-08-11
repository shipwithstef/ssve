# gstack Parity Scorecard

**Source:** `references/knowledge/gstack/CAPABILITIES.md` (gstack v1.32.0.0 by Garry Tan / YC).
**Companion to:** `gsd-scorecard.md` (GSD coverage) and `superpowers-scorecard.md` (superpowers coverage).

**Process per row:** identical to gsd-scorecard.md. Adopt only when ≥10 improvement scenarios are positive AND blast radius = zero-regression.

**Prior blends:**
- `proposals/done/2026-04-04-gstack-blend-plan.md` (initial)
- `proposals/done/2026-04-08-blend-gstack-reblend.md` (re-blend, 2026-04-08)

## Master feature table

### Big-rocks (Architecture + New features)

| # | Feature | Source | svc current state | Adjacent svc artifact | Prior blend | Verdict | Next |
|---|---------|--------|-------------------|----------------------|-------------|---------|------|
| g1 | "Virtual engineering team" personas (CEO / eng manager / designer / reviewer / QA / security / release) | gstack/CAPABILITIES.md § What It Is | 🟡 partial | svc has ~80 skills with role-coverage; doesn't pose them as personas at orchestrator level | 🟢 (partial — taken in 2026-04-08 reblend) | ✅ already-have-different-shape | none |
| g2 | Sidebar Tab Awareness (Chrome extension) | gstack § New Features | ❌ | svc has no Chrome extension | 🆕 | ✋ SKIP — out of scope (svc is CLI-only, no browser UI) | none |
| g3 | Root Token Hardening (constant-time + UTF-8 byte-length) | gstack § New Features | 🟡 | svc has no root-token concept currently | 🆕 | 🟡 | defer (no svc surface needs this today) |
| g4 | IPv6 Security Guard (browse daemon) | gstack § New Features | ❌ | svc has no browse daemon | 🆕 | ✋ SKIP — out of scope (no daemon to protect) | none |
| g5 | NUL-Byte Transcript Cleaning | gstack § New Features | ❌ | svc has no Postgres / transcript ingest | 🆕 | ✋ SKIP — out of scope | none |
| g6 | Build Resilience (missing-git-HEAD handling) | gstack § New Features | 🟡 partial | scripts/setup + scripts/worktree.sh handle missing-HEAD cases | 🆕 | 🟡 | deep-dive |
| g7 | Rule 12 — CJK preamble (no `\uXXXX` escaping for non-ASCII) | gstack § New Features | 🆕 | rules/ doesn't address CJK escaping | 🆕 | 🟡 | deep-dive |
| g8 | Harness LLM Judge (claude-haiku-4-5 classifies PTY snapshots: waiting/working/hung) | gstack § New Features | ❌ | svc has no PTY test infrastructure | 🆕 | 🟡 (interesting pattern; deferred) | defer |

### Skills (36 + root)

Most overlap with svc's skill catalog. Listed below per the catalog's Think & Plan grouping.

| # | Feature | Source | svc current state | Adjacent svc artifact | Prior blend | Verdict | Next |
|---|---------|--------|-------------------|----------------------|-------------|---------|------|
| g9 | `office-hours` — 6 YC forcing questions before code | gstack Think & Plan | 🟡 partial | svc's discuss-phase + validate-feature ask 8 questions; not YC-shape | 🟢 (partial; reblend took the 6-question shape) | ✅ already-have-different-shape | none |
| g10 | `plan-ceo-review` — 10-star product framing, 4 modes | gstack Think & Plan | ❌ | svc has plan-changeset + review-plan; no "CEO-mode" framing | 🆕 | 🟡 | deep-dive |
| g11 | `plan-eng-review` — architecture, data flow, ASCII diagrams | gstack Think & Plan | ✅ | review-plan + design-tech cover this | 🟢 | ✅ | none |
| g12 | `plan-design-review` — designer, 0-10 per dimension, AI-slop detection | gstack Think & Plan | 🟡 | benchmark-landing skill is adjacent (0-10 dimensional scoring) | 🟢 (partial) | 🟡 | deep-dive |
| g13 | `plan-devex-review` — DX lead, personas, TTHW benchmarks, 20-45 questions | gstack Think & Plan | 🟡 partial | build-personas + product-marketing-context adjacent | 🆕 | 🟡 | deep-dive |
| g14 | `autoplan` — auto-review pipeline (CEO+design+eng+DX sequentially) | gstack Think & Plan | 🟡 partial | route-workflow chains skills; not as a single autoplan command | 🆕 | 🟡 | deep-dive |
| g15-g44 | Remaining ~30 skills (build/QA/security/release/comms) | gstack details/skills-catalog.md | (see details/) | various | 🟢 (partial — many taken in prior blends) | (per-skill assessment in `gstack-details-scorecard.md` if needed) | deferred until Phase 3 |

### Browse Daemon (Chromium controlled via localhost HTTP)

| # | Feature | Source | svc current state | Verdict | Reason |
|---|---------|--------|-------------------|---------|--------|
| g45 | Persistent Chromium binary (~58MB Bun-compiled) | gstack § Browse Daemon | ❌ | ✋ SKIP — out of scope | svc has no browser UI; users invoke browsers via host's MCP / native tools |
| g46 | 4-layer security (datamarking / hidden-element stripping / content filters / instruction hardening) | gstack § Browse Daemon | ❌ | ✋ SKIP — out of scope (companion to g45) | same |
| g47 | Sidebar chat (JSONL queue → claude subprocess per tab) | gstack § Browse Daemon | ❌ | ✋ SKIP — out of scope | same |

### Infrastructure

| # | Feature | Source | svc current state | Verdict | Next |
|---|---------|--------|-------------------|---------|------|
| g48 | Multi-host support (8 hosts) — typed TS objects, declarative frontmatter transforms, path/tool rewrites, adapter pattern | gstack § Multi-Host Support | ✅ | svc supports 5 hosts (Claude, Codex, Gemini, Kimi, OpenCode) via `provision/hosts/<host>.json`. Same shape, different transport. | 🟢 | ✅ | none |
| g49 | Template system (`SKILL.md.tmpl` → `gen-skill-docs.ts` → committed SKILL.md) | gstack § Template System | ❌ | svc skill files are direct markdown, no template-then-generate step. | 🆕 | 🟡 (interesting; defer) | defer |
| g50 | Ratcheted preamble byte budget (39,000) for rule 12 (CJK) | gstack § Template System | ❌ | svc has byte budgets in rules but no preamble-budget-ratchet | 🆕 | 🟡 | deep-dive (overlaps with svc's context-budget.md) |

### Testing

| # | Feature | Source | svc current state | Verdict | Next |
|---|---------|--------|-------------------|---------|------|
| g51 | Tier-2 E2E spawn real `claude -p` with TTY snapshot judge | gstack § Testing | 🟡 partial | svc has test-framework/evals/ tier-1/1.5/2/3 but no PTY snapshot LLM judge | 🆕 | 🟡 | deep-dive |
| g52 | Tier-3 LLM judge (Sonnet/Haiku scoring) | gstack § Testing | ✅ | svc has tier-3 LLM-judge infrastructure | 🟢 | ✅ | none |

### Codex round-1 review record

| Round | Submit SHA | Findings | Resolution |
|---|---|---|---|
| 1 | (pending) | (pending) | (pending) |

---

## Verdicts summary

- ✅ already-have: g1 (personas), g9 (office-hours-shape), g11 (eng-review), g48 (multi-host), g52 (tier-3 judge)
- ✋ SKIP — out of scope: g2 (Chrome extension), g4 (IPv6 daemon guard), g5 (Postgres NUL cleaning), g45-g47 (browse daemon)
- 🟡 deep-dive candidates: g3 (root token), g6 (missing-HEAD), g7 (CJK rule), g8 (PTY judge), g10 (CEO-review), g12 (design-review 0-10), g13 (DX-review TTHW), g14 (autoplan), g50 (preamble byte budget), g51 (TTY snapshot judge)
- 🟡 deferred: g8 (PTY infra), g49 (template generator)

**Most svc-distinctive losses if blending these without care:**
- svc's host-agnostic skill loading is FLATTER than gstack's typed TS objects + adapters — adopting gstack's adapter pattern would add complexity for the marginal extra host (Antigravity, Cursor) we already support without it.
- svc's progressive disclosure (SKILL.md + references/ + on-demand details/) is closer to superpowers' model than gstack's template-then-generate.

## Open question for codex review

Are there gstack features not in the source CAPABILITIES.md but visible in the live repo at https://github.com/garrytan/gstack ? Quick check against the latest gstack release notes / CHANGELOG would catch anything our 2026-05-11 analysis missed.
