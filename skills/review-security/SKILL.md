---
name: review-security
version: "1.0"
handles_concerns:
  - auth-surface
  - pii-handling
  - cryptography-touch
description: >
  OWASP Top 10 + STRIDE threat model + supply chain audit of the technical
  design before implementation. Use when "security review", "check for
  vulnerabilities", "threat model", "audit security", or when `design-tech`
  surfaces auth, payments, sensitive data, or external integrations that
  need a dedicated security pass.
phases:
  - id: P1-SecurityScopeModeGate
    trigger: always
    reads: ["docs/specs/features/<name>.md", "docs/specs/domain-profile.md", "task request"]
    writes: [".svc/review-security-scope.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-OWASPTop10Review
    trigger: always
    reads: ["feature spec", "technical design", "route/controller/auth design"]
    writes: ["docs/specs/security/<name>-review.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P3-STRIDEThreatModel
    trigger: always
    reads: ["technical design components", "data flow", "trust boundaries"]
    writes: ["docs/specs/security/<name>-review.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-SupplyChainAudit
    trigger: always
    reads: ["package manifests", "lockfiles", "dependency audit output"]
    writes: [".svc/review-security-supply-chain.log", "docs/specs/security/<name>-review.md"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P5-SecretsArchaeology
    trigger: always
    reads: ["source files", ".gitignore", ".env.example"]
    writes: [".svc/review-security-secrets.log", "docs/specs/security/<name>-review.md"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P6-FindingVerificationReport
    trigger: always
    reads: ["candidate findings", "cited code/spec references", "independent verifier output"]
    writes: ["docs/specs/security/<name>-review.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P7-SelfVerifyContinuation
    trigger: always
    reads: ["docs/specs/security/<name>-review.md", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "docs/specs/features/<name>.md", artifact: feature-spec }
  optional:
    - { path: "docs/specs/domain-profile.md", artifact: domain-profile }
outputs:
  produces:
    - { path: "docs/specs/security/<name>-review.md", artifact: review-security }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# Security Review

Security audit of the technical design before any code is written.
Catches vulnerabilities at the architecture level where they're cheapest to fix.

Blended from gstack /cso patterns. Adapted for svc's spec-first pipeline.

**Announce at start:** "I'm using review-security to audit the design for security risks."

## When To Run

**Always** for features that touch:
- Authentication or authorization
- Payment processing
- Personal data (PII, health, financial)
- External API integrations
- File uploads
- Admin/elevated privilege paths

**Skip** for:
- Pure UI cosmetic changes
- Documentation updates
- Internal tooling with no user-facing surface

## Confidence Gate

Every finding MUST include a confidence score from 1 to 10. The gate filters
noise before it reaches the report.

| Score | Meaning | Action |
|-------|---------|--------|
| 9-10 | Verified by reading specific code; concrete exploit demonstrated | Show normally |
| 7-8 | High-confidence pattern match against known vulnerability class | Show normally |
| 5-6 | Moderate; could be a false positive | Show with explicit caveat |
| 3-4 | Low confidence; pattern present but context unclear | Suppress from main report; appendix only |
| 1-2 | Speculation or theoretical-only | Only report if severity would be CRITICAL |

**Default mode:** 8/10 gate (zero noise). Only findings scored 8+ appear in the
main report. This is the right default for most reviews.

**Comprehensive mode:** 2/10 gate. Use when the feature handles payments,
medical data, or other high-consequence domains where a miss costs more than
noise. Invoke with `--comprehensive` or when the feature spec indicates P0
data sensitivity.

## Parallel Finding Verification

For each candidate finding above the confidence gate:

1. **Launch independent verification** with fresh context. The verifier reads
   only the code/spec references cited by the finding — not the finding itself.
2. The verifier produces its own confidence score and exploit path.
3. **Discard** any finding where the verifier scores it below the active
   confidence gate.
4. If the verifier confirms but at a lower score, use the lower score.

This eliminates findings that look plausible in context but don't survive
independent scrutiny.

## Key Rules

- **Think like an attacker, report like a defender** — show the exploit path,
  then the fix.
- **Zero noise > zero misses** — 3 real findings beats 3 real + 12 theoretical.
- **Every finding MUST include a concrete exploit scenario** — step-by-step
  attack path, not "an attacker could potentially..."
- **Read-only** — never modify code. Produce findings and recommendations only.
- **Credential storage** — the canonical svc pattern is per-project
  `<repo-root>/.env.local` (gitignored, perms 0600), never `~/.bashrc` or any
  shared home-dir file (cross-project leakage + rotation blast-radius). Flag
  violations and cite the pattern: `references/project-secrets-hygiene.md`.

## Process

### Step 0: Concern Scan (auto-load security checklists)

Before the manual OWASP/STRIDE passes, run the concern scanner against the diff
under review and auto-load the matching security-domain concern checklists from
`concerns/` (auth-surface, pii-handling, api-key-management, secrets, etc.). The
framework's 100+ concern checklists are the connective tissue between this skill
and the structured subject-matter requirements — don't re-derive them by hand.

```bash
node <SKILLS_PATH>/scripts/scan-concerns.mjs --staged --json
# or --diff for HEAD working tree, or --paths <files> for an explicit set
```

For each matched concern (especially `domain: security` and CRITICAL/HIGH
severity), open its `source_file` checklist and run its items in addition to the
OWASP/STRIDE steps below. A finding for any unmet checklist item carries the
concern name as evidence. This is the same helper `audit-implementation` (Phase
0.6) and `design-tech` (Step 2.5) consume, so design → review → audit share one
concern source of truth.

### Step 1: OWASP Top 10 Check

Walk through each OWASP category against the technical design:

| # | Category | Check against design |
|---|----------|---------------------|
| A01 | Broken Access Control | Are all endpoints auth-gated? Role checks on every mutation? |
| A02 | Cryptographic Failures | Passwords hashed? Tokens rotated? Secrets in env vars not code? |
| A03 | Injection | All user input parameterized? No string concatenation in queries? |
| A04 | Insecure Design | Threat model exists? Abuse cases considered? Rate limiting? |
| A05 | Security Misconfiguration | CORS locked down? Debug mode off? Default creds removed? |
| A06 | Vulnerable Components | Dependencies up to date? Known CVEs checked? |
| A07 | Auth Failures | Session management sound? MFA considered? Brute force protection? |
| A08 | Data Integrity Failures | Input validation on all boundaries? CSRF protection? |
| A09 | Logging & Monitoring | Security events logged? Alerting on suspicious patterns? |
| A10 | SSRF | External URL inputs validated? Internal network access blocked? |

For each category: PASS, FAIL (with specific finding), or N/A.

#### Specific Checks Per Category

**A01 — Broken Access Control:**
- Missing auth middleware on controllers/routes (grep for unprotected handlers)
- Direct object reference: can user A access user B's resource by changing an ID?
- Horizontal privilege escalation: same role, different tenant/org
- Vertical privilege escalation: regular user accessing admin endpoints
- Verify authorization checks happen server-side, not just UI hiding
- For Base44/Supabase/Firebase-style entity security, require concrete
  before/after probe evidence before accepting an RLS/security rule as useful.
  Scanner output or "missing rule" intent is not proof that the gap is exploitable
  or that the deployed rule closes it.

**Base44 entity/RLS review:**

When the target repo has `base44/entities/`, `entities/*.json`, Base44 SDK entity
calls, or an RLS/security-rule change:

```bash
node scripts/audit-base44-entity-rls.mjs --root .
node scripts/validate-security-rule-probe-evidence.mjs --evidence <probe.json>
```

Review findings must classify deployment order by caller surface:

1. lowest frontend caller count first
2. service-role-only backend entities before high-traffic UI entities
3. exploitable gaps before defense-in-depth-only changes

For derived ownership, do not invent impossible cross-entity RLS joins. Pick and
document one pattern per entity: denormalized owner field, defense-in-depth
`secureOperation`, or function gateway.

**A03 — Injection:**
- SQL injection: raw queries, string interpolation in SQL (`${var}`, `f"...{var}..."`, `+ var +`)
- Command injection: `system()`, `exec()`, `spawn()`, `child_process` with user input
- Template injection: user input rendered in server-side templates without escaping
- LLM prompt injection: user-controlled text concatenated into system prompts or tool calls
- NoSQL injection: `$where`, `$regex`, unvalidated query operators

**A05 — Security Misconfiguration:**
- CORS: wildcard `*` origins in production (check for `Access-Control-Allow-Origin: *`)
- CSP headers: missing or overly permissive `Content-Security-Policy`
- Debug mode enabled in production (`DEBUG=true`, `NODE_ENV=development`, verbose error pages)
- Default credentials or API keys shipped in config files
- Unnecessary ports/services exposed

**A07 — Authentication Failures:**
- JWT: missing or excessive expiration (`exp` claim), no refresh token rotation
- MFA: required for admin paths? Bypassable via API?
- Password reset: rate-limited? Token single-use? Expires?
- Session fixation: new session ID issued on login?

### Step 2: STRIDE Threat Model

For each component in the technical design:

| Threat | Question |
|--------|---------|
| **S**poofing | Can an attacker impersonate a user or service? |
| **T**ampering | Can data be modified in transit or at rest? |
| **R**epudiation | Can actions be performed without accountability? |
| **I**nformation Disclosure | Can sensitive data leak through logs, errors, or side channels? |
| **D**enial of Service | Can the service be overwhelmed? Rate limiting in place? |
| **E**levation of Privilege | Can a regular user gain admin access? |

### Step 3: Supply Chain Audit

Check dependencies:
```bash
# Node.js
npm audit
# Python
pip-audit or safety check
# Go
govulncheck
# Rust
cargo audit
```

Flag: outdated dependencies, known CVEs, packages with suspicious maintainer changes.

### Step 4: Secrets Archaeology

Scan for leaked credentials:
```bash
grep -rn "password\|secret\|api_key\|token\|credential" src/ --include="*.ts" --include="*.py" --include="*.go" | grep -v "test\|mock\|example"
```

Check `.env.example` exists (not `.env` committed). Check `.gitignore` has secrets patterns.

### False Positive Exclusions

Do NOT report findings in these categories — they generate noise without
actionable signal:

1. **DoS / resource exhaustion** — unless it's LLM cost amplification, which is
   a financial risk (not DoS). A single prompt that triggers $500 in API calls
   is a real finding.
2. **Secrets on disk** if the file is encrypted and has correct file permissions
   (0600 or stricter, owned by service user).
3. **Input validation on non-security-critical fields** without a proven impact
   chain. "Username allows unicode" is not a finding unless it enables injection.
4. **Race conditions** unless concretely exploitable with a step-by-step
   scenario. "Two requests could theoretically interleave" is not enough.
5. **Vulnerabilities in outdated dependencies** — handled by the supply chain
   phase (Step 3), not as individual findings. Don't double-count.
6. **Missing hardening** — flag actual vulnerabilities, not absent best
   practices. "No rate limiting on /health" is not a finding.
7. **Files that are only test fixtures** — `test/fixtures/`, mock data,
   `*.test.*` files. Unless the fixture is deployed to production.
8. **Regex complexity** in code that does not process untrusted input. Internal
   config parsing with complex regex is not ReDoS.
9. **Security concerns in documentation files** — EXCEPTION: `SKILL.md` files
   are executable prompt code and MUST be reviewed for prompt injection.
10. **Git history secrets** committed AND removed in the same PR. The secret
    never reached a long-lived branch.

### Output: `docs/specs/security/<feature-name>-review.md`

```markdown
# Security Review: <feature name>

**Date:** <timestamp>
**Reviewer:** P0 (automated) or human

## OWASP Top 10
| Category | Status | Finding |
|----------|--------|---------|
| A01 Broken Access Control | PASS/FAIL | <detail> |
| ... | ... | ... |

## STRIDE Threat Model
| Component | S | T | R | I | D | E |
|-----------|---|---|---|---|---|---|
| API layer | ✅ | ⚠️ | ✅ | ❌ | ✅ | ✅ |
| ... | ... | ... | ... | ... | ... | ... |

## Supply Chain
- Dependencies: <count>
- Known CVEs: <count>
- Outdated: <count>

## Secrets
- Leaked credentials found: yes/no
- .env in .gitignore: yes/no

## Verdict
- [ ] PASS — no Critical/High findings
- [ ] CONDITIONAL — High findings that need mitigation
- [ ] FAIL — Critical findings, do not proceed to implementation
```

## Phase Receipt Contract

When running in task-graph mode, record these phase receipts before marking the `review-security` task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-SecurityScopeModeGate --evidence command_output:.svc/review-security-scope.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-OWASPTop10Review --evidence file:docs/specs/security/<name>-review.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-STRIDEThreatModel --evidence file:docs/specs/security/<name>-review.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-SupplyChainAudit --evidence command_output:.svc/review-security-supply-chain.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-SecretsArchaeology --evidence command_output:.svc/review-security-secrets.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-FindingVerificationReport --evidence file:docs/specs/security/<name>-review.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-SelfVerifyContinuation --evidence command_output:.svc/review-security-self-verify.log
```

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first — this is the cross-host,
  cross-session, cross-subagent source of truth.
- Host UI mirroring (TaskList/TaskUpdate in Claude Code; `/task` + `TaskList`/`TaskOutput` observation in Kimi; `update_plan` in Codex)
  is ONLY performed when running in the parent/top-level session. Detect via:
  host exposes TaskList tool AND no `SVC_SUBAGENT=1` marker in env. If either
  check fails, skip host mirroring — file state is the durable record; the
  orchestrator parent will re-read and re-mirror after the subagent returns.
- Subagents MUST NOT attempt TaskUpdate calls. Trying and failing is not
  graceful; it's silent drift between the subagent's intent and the host UI.
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Review report exists | `test -f docs/specs/security/<name>-review.md` | |
| 2 | OWASP section complete | all 10 categories have a status | |
| 3 | No Critical unresolved | grep for Critical + FAIL | |
| 4 | Security-rule probes validated when relevant | For RLS/security-rule changes, `validate-security-rule-probe-evidence.mjs` passes and the report cites before/after probe output plus regression test | |

### Chaining

**Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`):**
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

Standalone skill — not in progressive chains by default. Invoke between
`design-tech` and `plan-changeset` for security-sensitive features.

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.

## Blocking Discovery Halt

When a security finding makes the parent WI unsafe to verify, emit
`BLOCKING_DISCOVERY` per `references/blocking-discovery-format.md`, validate the
artifact, emit `skill_outcome` with `block_on_discovery`, and do not clear the
parent as VERIFIED until the follow-up WI is resolved and verification reruns.


## Modes (added by WI-SPINE-003)

This skill supports two modes via a `--mode` flag. Default is `security` — unchanged behavior.
