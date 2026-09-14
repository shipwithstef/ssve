# WI-FW-CAPABILITY-MCP-STARTUP-RESIDUALS-01: Scope MCP startup to actual task capabilities

**Type:** framework
**Status:** backlog
**Filed:** 2026-09-06
**Lane:** framework
**Source:** proposals/2026-08-22-framework-improvement-capability-scoped-plugin-mcp-startup.md
**Related:** WI-551 (dispatch resolver; does not own this capability work)

## Problem

The proposal is a companion to the host/model dispatch resolver. WI-551 does
not own its eight MCP startup requirements. Explicit ownership prevents the
resolver's completion from hiding irrelevant MCP processes and OAuth startup.

## Acceptance criteria

1. Repository-only tasks start no unrelated Dodo knowledge/API MCP process and
   open no provider OAuth tab (source AC-01).
2. Knowledge-only tasks receive only the declared knowledge capability, not
   mutation-capable API access (AC-02).
3. Test/live API selection is explicit and cannot follow an unrelated dashboard
   mode; fixtures prove separation (AC-03).
4. Extend existing provisioned host/runtime configuration contracts to disable
   irrelevant MCP entries using each host's actually supported mechanism.
   Validate Claude/Codex/Cursor/OpenCode/Grok adapter behavior without invoking
   unavailable providers or logging in (AC-04).
5. Resolve duplicate legacy SSE/current MCP definitions to one authorized route
   or report a named conflict (AC-05).
6. Record capability/config digests through existing receipt contracts without
   credentials or OAuth material (AC-06).
7. Cleanup reaps only task-owned MCP children, preserving unrelated active
   authenticated sessions (AC-07).
8. Replay the original irrelevant-startup failure with isolated fixtures first;
   real task verification requires an available authorized route. Do not call
   a fixture proof a live zero-process/browser-launch result (AC-08).

## Boundaries

Use existing resolver/host contracts; no new orchestration layer, mandatory
ledger or global MCP shutdown. Historical availability is not current quota.
This backlog remains unfinished and does not certify scoped startup today.
It does not defer the current recovery, skill UX, or clean-main obligations.
