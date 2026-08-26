# Framework improvement: owner override lease — 24h default + slide-on-activity renew

**Status:** DRAFT
**Date:** 2026-08-26
**Source:** Azure VM fleet incident 2026-08-25/26 — eight Codex SSVE lanes died mid-finish when `SVC OWNER OVERRIDE` mutation lease expired after 15 minutes (hard cap 30 minutes) while BREAK-GLASS and WI claims remained valid for 24h.
**Severity:** high
**Category:** incorrect default / missing capability
**Plan-changeset class:** hot-path (framework hooks, no consumer schema)

<!--
accepted_wi: WI-FW-OWNER-LEASE-01
-->

## Method

Read live VM logs (`codex_WI-ANDROID-BETA-GROUPS-SYNC-01_finish.log`), `hooks/codex/lib/owner-lease.mjs`, `bin/svc-enforce.mjs`, `hooks/svc-worktree-isolation-guard.mjs`, and `docs/specs/sessions/active-remote-sessions.md` death-reason table. Compared against WI claim TTL (24h) and BREAK-GLASS default TTL (was 4h).

## Findings (by priority)

### P0 — Fix now (blocks quality)

#### F-001: Owner override lease TTL is 15 min — SSVE lanes cannot finish [incorrect default]

**Evidence:** `hooks/codex/lib/owner-lease.mjs:6-11` — `MAX_MS = 30 * 60_000`, default `ttl_min = 15`; `svc-codex-owner-recovery.mjs:9` message says "15 minutes". Live: `WI-ANDROID-BETA-GROUPS-SYNC-01` passed 12/12 unit + 14/14 Playwright then blocked on land/deploy.

**Impact:** Every `SVC OWNER OVERRIDE:` dispatch on Azure VM dies mid-SSVE unless Stefan manually re-arms. Eight lanes on 2026-08-25.

**Proposed fix:** Raise default + cap to 24h across `owner-lease.mjs`, `svc-codex-owner-recovery.mjs`, `svc-worktree-isolation-guard.mjs`, `bin/svc-enforce.mjs` (BREAK-GLASS default 24h), `scripts/svc-owner-recovery.mjs`.

**Confidence:** HIGH — measured on VM.

#### F-002: BREAK-GLASS default TTL 4h disagrees with WI claim window [incorrect default]

**Evidence:** `bin/svc-enforce.mjs:92` — default 4h when `SVC_BREAK_GLASS_TTL_HOURS` unset.

**Impact:** Operator touches BREAK-GLASS once; enforcement bypass expires before long SSVE finishes.

**Proposed fix:** Default 24h (max unchanged).

**Confidence:** HIGH

### P1 — Fix soon (degrades quality)

#### F-003: Owner lease is write-once — no slide-on-activity renew [missing capability]

**Evidence:** `hooks/codex/lib/owner-lease.mjs` — `armOwnerLease` sets `expires_at` once; `readOwnerLease` only reads/deletes. Contrast `hooks/lib/authority-store.mjs:240` controller lease `resumeController` renews on activity. WI-562 IP-H5 adds `claim renew` heartbeat for pid-less WI claims — separate mechanism.

**Impact:** A lane running >24h wall clock (large test corpus, deploy waits) still dies even after P0 fix.

**Proposed fix:** Add `renewOwnerLease()` sliding `expires_at` to `now + MAX_MS` on each governed mutation allowed via pretool dispatcher while lease is live. Distinct from WI claim heartbeat.

**Confidence:** HIGH

### P2 — Track

#### F-004: Uncommitted hotfix on VM main checkout drifts from origin/main

**Evidence:** VM `git status` 2026-08-26 — lease files modified but not on a landed branch.

**Proposed fix:** Land this proposal's P0+P1 via framework PR + host OTA.

**Confidence:** HIGH

## Comparison delta

Kubernetes leases renew on holder activity; SVC controller leases (WI-502) renew on resume. Codex owner override was the only mutation bypass without renew — inconsistent.

## Self-Verify

| # | Check | Result |
|---|---|---|
| 1 | Proposal file exists | PASS |
| 2 | Every finding cites file:line or measurement | PASS |
| 3 | Findings ranked by impact + confidence | PASS |
| 4 | P0 fix is implemented in working tree (pending land) | PASS |
