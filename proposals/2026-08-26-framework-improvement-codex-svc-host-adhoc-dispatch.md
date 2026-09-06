# Framework improvement: Codex ad-hoc dispatch must not lose SVC_HOST (WI-IOS pipeline kill)

backlog_wi: WI-FW-CLEAN-MAIN-FOLLOWUP-01
reason: Current follow-up owns evidence and metadata reconciliation. Historical claims below are retained, not recertified; no missing historical WI or execution evidence is fabricated.

**Status:** DRAFT → DISPATCH ox
**Date:** 2026-08-26
**Source:** codex_WI-IOS-AZURE-PIPELINE-SETUP-01_finish_20260826.log
**Severity:** P0
**WI for fix:** WI-FW-CODEX-SVC-HOST-DISPATCH-01

## Incident

After Azure build #11 failed, every Bash call denied by PreToolUse:
`host identity missing: wiring must set SVC_HOST for this host`

BREAK-GLASS was present — did NOT bypass. iOS pipeline agent exited; WI still open.

Hook: hooks/codex/svc-codex-pretool-dispatcher.mjs hostIdentity() requires process.env.SVC_HOST.
Ad-hoc `nohup codex exec` dispatches do not export SVC_HOST into the session.
WI-FW-HOOKS-SAFETY-01 stricter gate + host OTA surfaced mid-session.

## P0 fixes (ox implement)

1. hostIdentity() fallback: CODEX_THREAD_ID | CODEX_SESSION_ID | CODEX_HOME | hook path → codex
2. scripts/lib/dispatch-codex-lane.sh — export SVC_HOST=codex on all nohup codex exec
3. tier-1 test validate-codex-adhoc-dispatch-host-identity.sh

## P1 fixes

- Provider observation for read-only `az pipelines runs show|list`
- Document: BREAK-GLASS ≠ SVC_HOST bypass

## Acceptance

Relaunch iOS pipeline lane can poll Azure after failed build without host-identity deny.
