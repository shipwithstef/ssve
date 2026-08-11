# gstack — Capabilities

Source: https://github.com/garrytan/gstack
SHA: 4f4e24021511674062088f1234567890abcdef12 (HEAD as of 2026-05-11)
Version: v1.32.0.0
Analyzed: 2026-05-11

## What It Is

Founder-mode development framework for AI coding agents by Garry Tan (YC CEO).
Turns Claude Code into a virtual engineering team: CEO, eng manager, designer,
reviewer, QA lead, security officer, release engineer. 36 skills + root skill,
8-host support, browse daemon (persistent Chromium), design tool (GPT Image API),
Chrome extension with sidebar chat, team mode auto-updates, plugin marketplace.

Install: `git clone + ./setup` (30 seconds). MIT license.

## New Features (since April 2026)

- **Sidebar Tab Awareness (#1257)**: Extension manifest now includes `tabs` permission, enabling the sidebar agent to see URL and title for non-localhost sites.
- **Root Token Hardening (#1416)**: Constant-time comparison using `Buffer.byteLength` and `crypto.timingSafeEqual` with a length-pre-check to prevent multibyte-mismatch crashes.
- **IPv6 Security Guard (#1249)**: Blocks direct IPv6 link-local navigation (`fe80::/10`) and ULA addresses (`fc00::/7`) in the browser daemon to prevent SSRF and metadata theft.
- **NUL-Byte Transcript Cleaning (#1411)**: `gstack-memory-ingest` now strips `0x00` bytes from transcripts before Postgres write to prevent `invalid byte sequence` errors.
- **Build Resilience (#1207)**: `bun run build` is now resilient to "missing git HEAD" states (common in fresh worktrees).
- **Rule 12 (CJK Preamble)**: Preamble strictly forbids `\uXXXX` escaping of non-ASCII characters; requires literal UTF-8 strings for Asian languages to prevent miscoding.
- **Harness LLM Judge**: New E2E test helper using `claude-haiku-4-5` to classify PTY snapshots as `waiting` (for input), `working` (active), or `hung` (crashed).

## Skills (36 + root)

### Think & Plan (6)
| Skill | What it does |
|---|---|
| `office-hours` | YC forcing questions — 6 questions that reframe the product before code |
| `plan-ceo-review` | CEO/founder review — find 10-star product, 4 modes (expand/selective/hold/reduce) |
| `plan-eng-review` | Eng manager review — architecture, data flow, ASCII diagrams, edge cases, tests |
| `plan-design-review` | Designer review — rates 0-10 per dimension, fixes plan to get to 10, AI slop detection |
| `plan-devex-review` | DX lead review — personas, TTHW benchmarks, 20-45 forcing questions, 3 modes |
| `autoplan` | Auto-review pipeline — CEO+design+eng+DX sequentially with auto-decisions |

... [30+ other skills mapped in details/skills-catalog.md] ...

## Browse Daemon

Persistent Chromium controlled via localhost HTTP. Bun-compiled binary (~58MB).

| Aspect | Detail |
|---|---|
| Security | 4 layers: datamarking, hidden element stripping, content filters, instruction hardening. Now includes IPv6 link-local blocking. |
| Auth | Constant-time token comparison with UTF-8 byte-length hardening. |
| Sidebar chat | JSONL queue → claude subprocess per tab, now with full tab awareness off-localhost. |

## Infrastructure

### Multi-Host Support (8 hosts)
Host config: typed TS objects in `hosts/`. Declarative frontmatter transforms,
path/tool rewrites, adapter pattern for complex hosts (OpenClaw).

### Template System
SKILL.md.tmpl → gen-skill-docs.ts (resolvers) → committed SKILL.md.
Ratcheted preamble byte budget (39,000) for rule 12 (CJK).

## Testing

| Tier | What | Detail |
|---|---|---|
| Tier 2 — E2E | Spawn real `claude -p` | Now includes TTY snapshot classification judge. |
| Tier 3 — LLM judge | Sonnet/Haiku scoring | Added Haiku 4.5 judge for TTY state and AUQ substance. |
