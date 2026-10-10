### 2.4 Detect core-mechanic features (per WI-140 ONB-01..04)

Day-1 brownfield competitive sweep — closes the "we shipped receipt OCR for 60 days before discovering zero competitors do this" failure mode (Example Marketplace origin case).

**Detection (two-pass, per WI-142 GROUND-14):**

Pass 1 — Directory + entry-point analysis (universal, no keyword bias):
```bash
# Enumerate top-level source directories and entry points
find src/ app/ lib/ -maxdepth 2 -type d 2>/dev/null | sort
# Identify API surface, route definitions, or main entry points
grep -rlE "^(export |module\.exports|app\.|router\.|def |func )" \
  src/ app/ lib/ --include="*.ts" --include="*.js" --include="*.py" --include="*.go" 2>/dev/null | head -30
```

**Transform directory listing into feature-area groups:**
Group entry points by domain concept. Examples:
- `src/auth/`, `src/login/`, `src/session/` → **Authentication**
- `src/billing/`, `src/subscription/`, `src/invoices/` → **Billing & Payments**
- `src/onboarding/`, `src/welcome/`, `src/tutorial/` → **Onboarding**
- `src/rewards/`, `src/loyalty/`, `src/points/` → **Loyalty / Rewards**
- `src/admin/`, `src/dashboard/`, `src/reports/` → **Admin / Analytics**

For each group, check `references/knowledge/competitors/` (or run `analyze-competitors` scoped to that group) to determine if competitors implement the same concept.

Pass 2 — Core-mechanic regex (domain-specific supplement):
```bash
grep -rE "processReceipt|verifyVisit|earnPoints|redeem[A-Z]|grantPoints|secureCheckIn|loyalty[A-Z]|posIntegration|cardLink" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  --include="*.py" --include="*.rb" --include="*.go" \
  src/ app/ lib/ 2>/dev/null | head -30
```

Project-specific patterns: derive from domain profile. For loyalty/SMB-rewards domain, the patterns above. For other domains (e.g., e-commerce checkout, subscription billing), generate domain-appropriate keyword set.

**WI-142 requirement:** Pass 1 is mandatory — directory analysis ensures ALL major feature areas are enumerated, not just those matching core-mechanic regex. Pass 2 is supplementary.

**For each detected mechanic**, invoke `analyze-competitors` (Phase 2 deep-research path per WI-140 COMP-02) scoped to that mechanic. Don't run the full 4-tier 20-competitor analysis — scope: "which loyalty competitors use receipt-OCR vs POS-attestation". Time-box to 30 minutes per mechanic.

**Output:** `docs/specs/brownfield-competitive-flags.md` per `references/templates/brownfield-competitive-flags.md`. Lists each detected mechanic with: code evidence, competitor match (yes/no/partial), severity rating.

**Severity rules:**
- **HIGH:** the brownfield approach is unique across direct competitors (0 of N match) → auto-create backlog WI tagged `competitive-strategy-review`
- **MEDIUM:** the approach is rare (1-2 of N) → flag in onboard report, no auto-WI
- **LOW:** universal pattern (3+ of N) → no concern

**This is the change that would have caught Example Marketplace on day 1 instead of day 60.**

---

### 5. Wire steering rules into project context file

After triage, detect the project's tech stacks and inject per-project steering
rules so the right rules fire for this project and no others.

**Detect the active host and target context file:**

| Host | Context file | Skills path |
|---|---|---|
| Claude Code | `CLAUDE.md` | `~/.claude/skills/` |
| Kimi Code CLI | `KIMI.md` | `~/.kimi/skills/` |
| Codex | `AGENTS.md` | `~/.codex/skills/` |
| Antigravity | `ANTIGRAVITY.md` | `~/.gemini/antigravity/skills/` |
| OpenCode CLI | `AGENTS.md` | `~/.config/opencode/skills/` |

Detect active host: use `bash scripts/detect-host.sh` from the framework repo. Fallback:
if `~/.gemini/antigravity/skills/route-workflow/SKILL.md` exists and the session is
running inside Antigravity, target `ANTIGRAVITY.md`. Else if `~/.kimi/skills/route-workflow/SKILL.md`
exists, target `KIMI.md`. Otherwise target `CLAUDE.md` (default). Record the detected
host in `router-context.md`.

Before stack-specific steering rules, ensure the target context file contains
this baseline svc operating contract line:

```markdown
This repo is svc-onboarded: respect the local AGENTS.md/CLAUDE.md deployment, test, and route-workflow rules for this exact worktree; post-deploy/production validation requests require live post-deploy evidence, not local pre-deploy substitutes.
```

Append it once if missing. This line is intentionally host-agnostic so agents
still respect the onboarded project contract even when the user does not name a
skill explicitly.

**Stack detection signals (check in order, use all that match):**

| Signal | Stack |
|---|---|
| `react-native` in package.json dependencies | `react-native` |
| `react` in package.json dependencies (and not react-native) | `react` |
| `go.mod` present | `golang` |
| `Cargo.toml` present | `rust` |
| `requirements.txt` / `pyproject.toml` / `setup.py` present | `python` |
| `*.html` / `*.css` / web framework in package.json (next, vite, astro, etc.) | `web` |
| `*.ts` / `*.tsx` files present | `typescript` (if not already covered by react/react-native) |

**For each detected stack**, look up `rulesRegistry` in `skills-manifest.json`
for entries with `type: steering` and `stack: <detected>`. For each match:

1. Verify the rule file exists in the detected host's skills path
2. Skip if the rule file is empty/placeholder (no actual content below frontmatter)
3. If running on **Claude Code**: append an `@`-import to `CLAUDE.md`:
   ```markdown
   <!-- svc steering rules — auto-wired by onboard-repo -->
   @~/.claude/skills/rules/react/patterns.md
   ```
4. If running on **Antigravity**: append a reference block to `ANTIGRAVITY.md`
   under `## Steering Rules (Stack-Specific)`:
   ```markdown
   <!-- svc steering rules — auto-wired by onboard-repo -->
   <!-- Antigravity: read these files at session start for stack-specific rules -->
   - `~/.gemini/antigravity/skills/rules/react/patterns.md`
   ```
   Antigravity does not support `@`-imports. Rules are listed as explicit
   read-on-start references instead. Antigravity will read them when the
   session context file is loaded.
5. If running on **Antigravity**: run `node ~/.gemini/antigravity/skills/scripts/sync-antigravity-ki.mjs`
   to instantly mirror the project state into Antigravity's Knowledge Items system.
   This guarantees Antigravity auto-loads the context in future sessions.

**Do not inject:**
- Universal rules (`stack: universal`) — globally active on Claude Code via `~/.claude/rules/`;
  on Antigravity these are encoded in the behavioral enforcement block in `ANTIGRAVITY.md`
- Rules for stacks not detected in this project
- Placeholder rules with no content (would waste tokens for nothing)
- Rules already present in the project context file (idempotent)

**Record in `router-context.md`** which host was detected, which stacks were found,
and which steering rules were wired, for auditability.
