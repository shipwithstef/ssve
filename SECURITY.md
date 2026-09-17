# SSVE Security Policy

Serious Serious Vibe Engineering (SSVE) is a governed skill and runtime
framework that installs skills, hooks, and tool-policy enforcement across
supported AI agent hosts. This policy covers the SSVE repository itself —
skills, hooks, installers, validators, and runtime policy — not every
downstream product built with it.

## Supported Versions

| Version | Supported |
| ------- | --------- |
| v1.0.x  | Yes       |
| pre-v1.0 | No       |

Only the current v1.0.x line receives security fixes. Pre-v1.0 tags, forks,
and unpublished local checkouts are unsupported. If you are running an
unsupported revision, upgrade to the latest v1.0.x release before reporting
unless the issue is still present on that line.

## Reporting a Vulnerability

**Do not open a public GitHub issue, pull request, or discussion for a
security vulnerability.** Public disclosure before a fix is available can
put operators and downstream projects at risk.

Report privately through either of these channels:

1. **Email:** [angelovsan@gmail.com](mailto:angelovsan@gmail.com)
2. **GitHub Private Vulnerability Reporting:** use the repository
   **Security** tab → **Report a vulnerability** (when the feature is
   enabled on the public repository). GitHub documents the flow at
   [Privately reporting a security vulnerability](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability).
   If that button is not available, use email.

Include as much of the following as you can:

- Affected version, commit SHA, or install path
- Host(s) involved (Claude, Codex, Gemini, Grok, Cursor, and so on)
- A clear description of the issue and its impact
- Step-by-step reproduction, or a minimal proof of concept
- Whether the issue is already being exploited, as far as you know
- For agent-safety issues, the exact skill, hook, tool, or policy path
  that was bypassed

Encrypting email is optional. If you need a public key, ask in the initial
report and wait for a reply before sending exploit details.

## Response Timeline

| Stage | Target |
| ----- | ------ |
| Acknowledgment | Within **48 hours** of a complete private report |
| Triage assessment | Within **7 days** of acknowledgment (severity, affected surface, and whether a fix is required) |
| Coordinated disclosure | Fix, advisory, and public disclosure are coordinated with the reporter. We will not publish details until a fix is available, or until we have agreed a disclosure date with the reporter. |

We may ask for clarification during triage. If the report is not a
security issue (for example a documentation error or a non-security
policy gap), we will say so and point you at the ordinary contribution
path in [`CONTRIBUTING.md`](CONTRIBUTING.md).

## AI Agent Safety

SSVE is an agent runtime. The following classes are in scope for this
policy even when they do not look like a classic memory-corruption bug.
Please report them privately using the channels above.

| Class | What to report |
| ----- | -------------- |
| **Prompt injection** | Untrusted content (web pages, files, MCP tool output, issue text, skill markdown, or user-controlled artifacts) that causes an agent to ignore SSVE policy, leak secrets, or take unauthorized tool actions. |
| **Sandbox escape** | A path that leaves the intended worktree, host sandbox, or `scripts/svc-contained-exec.mjs` containment and reads or writes files, env, or credentials outside the allowed scope. |
| **Tool-policy bypass** | Any way to skip or mute enforcement: `git commit --no-verify` / `git push --no-verify`, `SVC_DISABLED_HOOKS`, `SVC_BREAK_GLASS`, `SVC_HOOK_PROFILE=minimal` used to disable guards, editing host `settings.json` / hook config to unwire checks, or `config_protection_override` / lockfile edits that silence the workflow guard. |

A useful agent-safety report names:

1. The **trust boundary** that failed (skill prompt, hook, installer, tool argv, worktree isolation).
2. The **unauthorized action** that became possible (secret read, policy skip, write outside the worktree, host-config mutation).
3. Whether a **default install** is affected, or only a non-default override.

Do not run destructive proofs against systems you do not own. A local
reproduction against a clone of this repository is enough.

## Scope

**In scope**

- Skills under `skills/` and their referenced scripts
- Hooks under `hooks/` and host wiring produced by `./setup`
- Installer and drift checks (`setup`, `scripts/check-install-drift.sh`, `scripts/wire-*.mjs`)
- Tool-policy, worktree isolation, and contained execution
- Secrets handling in framework scripts and evals
- Supply-chain issues in this repository's tracked files

**Out of scope** (unless they are caused by an SSVE default)

- Vulnerabilities only in a downstream product that happens to use SSVE
- Issues that require the operator to disable hooks or set break-glass
- Findings that depend on a compromised host CLI, operator workstation,
  or stolen credentials
- Social-engineering of individual operators with no SSVE policy failure

## Safe Harbor

We will not pursue legal action against researchers who:

- Report in good faith through the private channels above
- Avoid privacy violations, service disruption, and data destruction
- Do not access data that is not theirs beyond what is needed to
  demonstrate the issue
- Give us a reasonable window to fix the issue before public disclosure

This is not a paid bug-bounty program. Credit in the advisory is offered
when the reporter wants it.

Thank you for helping keep SSVE and the projects that run it safe.
