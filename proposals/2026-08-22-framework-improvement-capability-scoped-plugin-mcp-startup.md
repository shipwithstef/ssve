# Framework improvement: capability-scoped plugin MCP startup for external executors

backlog_wi: WI-FW-CAPABILITY-MCP-STARTUP-RESIDUALS-01
reason: Track startup capability scoping with the existing dispatch resolver backlog; this is not a completion claim.

**Status:** DRAFT — route with WI-551 or a focused follow-up
**Date:** 2026-08-22
**Category:** external-agent isolation / credential UX / resource efficiency
**Severity: high —** irrelevant authenticated provider surfaces and OAuth UI are exposed to tasks that never requested them.
**Plan-changeset class:** hot-path

## Gap

External executors currently inherit the host's full plugin/MCP surface even when their assigned task does not require those capabilities. During the HoursHub billing closeout, an unrelated Grok executor started the Dodo API MCP through the plugin's legacy `/sse` endpoint while the active Codex session used the current `/mcp` endpoint. The extra process repeatedly opened Dodo OAuth authorization tabs. Stopping only that Dodo child process stopped the browser spam while the Grok executor continued normally.

This is not a Dodo authentication failure and not a reason to remove the plugin. It is a dispatch-isolation gap: the launcher does not derive an explicit MCP allowlist/denylist from the task's required capabilities.

## Evidence

- The incident produced two simultaneous Dodo MCP clients for one workspace: the active Codex Dodo API connection and an unrelated Grok-launched `mcp-remote` client.
- The Grok client used `https://mcp.dodopayments.com/sse`; the current Codex plugin connection used `https://mcp.dodopayments.com/mcp`.
- Killing only the Grok-owned Dodo MCP process group stopped the repeated authorization tabs without terminating the executor.
- The official Dodo plugin `README.md` (installed version 0.5.0) states that both Dodo MCPs are enabled by default. OpenCode can suppress them with `DODO_DISABLE_API_MCP=1` and `DODO_DISABLE_KNOWLEDGE_MCP=1`; Claude Code, Codex, and Cursor require per-project MCP entries with `enabled: false`.
- `proposals/2026-08-17-framework-improvement-native-host-dispatch-policy.md` defines who/where/model routing but does not define the capability-scoped MCP surface given to the selected executor. This proposal is a focused companion, not a duplicate.
- Harness capability claims are anchored to `references/knowledge/domains/agent-harnesses/CAPABILITIES.md`; provider controls are anchored to the installed official Dodo plugin 0.5.0 README.

## Diagnosis

- **Root cause:** executor routing selects a model/host but does not compile the task's declared capabilities into host-specific MCP startup policy.
- **Failure mode:** irrelevant authenticated MCPs start eagerly, consume resources/context, trigger OAuth UI, and may expose a mutation-capable provider surface to work that never requested it.
- **Why a global Dodo disable is wrong:** billing tasks legitimately need Dodo knowledge or API access. The correct boundary is per invocation and per capability.
- **Why one universal environment variable is insufficient:** Dodo's OpenCode adapter honors disable variables, while Claude Code, Codex, and Cursor use static MCP configuration. The framework needs host-specific adapters behind one capability policy.

## Required contract

1. Every external task declares required capabilities, for example `repo.read`, `browser`, `dodo.knowledge`, or `dodo.api.test`.
2. Dispatch resolves the model/host and the least-privilege MCP surface together.
3. Unrequested MCPs are disabled before the executor process starts; disabling after OAuth begins is a failure.
4. Provider environments are explicit. `dodo.api.test` and `dodo.api.live` are distinct capabilities and may not silently substitute for each other.
5. Legacy and current endpoints may not start simultaneously for the same provider/session unless the task explicitly requires and receipts both.
6. The execution receipt records capability names and MCP identities/config digests, never API keys, OAuth tokens, callback URLs, or customer/payment data.
7. Child-process cleanup is ownership-scoped: the launcher may terminate only the MCP children it created, not unrelated sessions.

## Acceptance criteria

- **AC-01 — Zero irrelevant startup:** A repository-only Grok/Cursor/Codex/Claude task starts no Dodo API or knowledge MCP and opens no provider OAuth tab.
- **AC-02 — Knowledge-only:** A task declaring `dodo.knowledge` receives exactly the knowledge MCP and no mutation-capable Dodo API MCP.
- **AC-03 — Test/live separation:** `dodo.api.test` connects only to the test environment; `dodo.api.live` requires an explicit live capability and cannot be inferred from the account's dashboard mode.
- **AC-04 — Host adapters:** OpenCode/Grok uses the supported disable environment variables; Claude Code, Codex, and Cursor receive generated/overridden MCP config with irrelevant entries disabled.
- **AC-05 — No duplicate transport:** A fixture containing both legacy `/sse` and current `/mcp` Dodo definitions resolves to one authorized transport or fails closed with a named conflict.
- **AC-06 — No secret evidence:** Receipts and logs contain capability/config digests but no credential or OAuth material.
- **AC-07 — Scoped cleanup:** Cancelling or finishing an executor reaps only its own MCP children; an independently running authenticated session remains alive.
- **AC-08 — Original replay:** Re-run the unrelated Grok task that caused the incident and prove the task completes with zero Dodo child process and zero authorization-tab launch.

## Route

This changes external-launcher and host-adapter behavior, so it is a normal framework pipeline change: `write-spec` → `design-tech` → `plan-changeset` → `review-plan` → `execute-changeset` → `review-exec` → `audit-implementation` → `land-changeset` → `verify-promotion`.

Prefer implementing it as a capability-policy extension to WI-551's single dispatch resolver. If WI-551 lands without MCP scoping, promote this as a focused follow-up rather than widening an active execution late.

## Likely implementation surfaces

- `references/dispatch-policy-v3.md`: task capability requirements and provider-environment separation;
- `scripts/resolve-dispatch.mjs`: compile effective capability and MCP policy alongside model/host routing;
- `scripts/launch-external-agent.mjs`: host-specific MCP overrides plus child ownership/cleanup;
- `references/external-agent-capability-receipt.md`: capability/MCP identity digests without secrets;
- `test-framework/evals/tier-1/validate-external-agent-mcp-scope.sh`: disposable no-MCP, knowledge-only, test API, live refusal, duplicate transport, OAuth suppression, and child-cleanup fixtures. Proposed promotion metadata: `validator_path=test-framework/evals/tier-1/validate-external-agent-mcp-scope.sh`, `failure_class=credential-surface-leak`, `promotion_signal=original Grok replay opens zero Dodo OAuth tabs and starts zero unrequested Dodo children`.

## Rollback

Revert the capability-to-MCP adapter and return to the current host configuration. Do not remove Dodo or other provider plugins globally as rollback; that would break legitimate provider work and hide the isolation defect.

## Human checkpoint

The proposal records a proven framework gap only. It does not change active executor configuration or provider authentication while HoursHub closeout is being landed.
