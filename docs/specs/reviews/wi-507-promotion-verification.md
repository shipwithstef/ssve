# WI-507 Promotion Verification

**Verdict:** PASS — VERIFIED-L3 (headless installed runtime; no visual surface)

## Promotion evidence

- PR: `#169`, merged by the sanctioned review-receipt wrapper at `2026-07-23T00:10:01Z`.
- Promoted SHA: `ca985fc96c91c46f539f784a5573fd5a112ee0dd`.
- Promoted tree: `d017ca7cdae76f28861225d5d8cf374f8a9d90cf`, exactly equal to the reviewed implementation tree.
- The promoted SHA has fresh `plan-manifest`, `review-plan`, `exec-record`, `review-exec`, and `audit-implementation` receipts; `check-chain-receipts` passes.

## Acceptance criteria

| AC | Promoted evidence | Result |
|---|---|---|
| AC-1 | Promoted focused integration suite exercises parent resolution, SLA events, app registry, legacy compatibility, and explicit Immune Mesh. | PASS |
| AC-2 | All eight provisioned hosts install 100 skills without drift; fleet contract suite passes 65/65. | PASS |
| AC-3 | Promotion indexer gating/idempotence and non-mutating topology, contract, and healer behavior pass in the 61/61 focused suite. | PASS |
| AC-4 | Live Claude and Gemini settings each contain one briefing and one delta hook; installed scripts resolve to canonical primary main; cache hit and Gemini JSON envelope both execute successfully. | PASS |
| AC-5 | Installed Claude and Gemini `/cos` hook entrypoints invoked from `example-marketplace` resolve `/home/svc-user/app-workspaces/example-company/company-state`; registry and mesh report healthy; protected external hashes are unchanged. | PASS |
| AC-6 | G2, execution, three-round G6, audit, sanctioned squash merge, final-SHA envelope, G7, and post-receipt index/query are complete. | PASS |

## Runtime and regression proof

- Focused company fleet integration: 61 passed, 0 failed.
- Fleet skills: 65 passed, 0 failed.
- Shared contract validator: 647 passed, 0 failed.
- Exact pre-merge fleet Tier-2 batch: 15 passed, 0 failed, 0 skipped; promoted and implementation trees are identical.
- Manifest lint: 100 included skills, 59 routing skills.
- All eight host drift checks pass after installation from promoted primary main.
- Claude CLI `2.1.218` and Gemini CLI `0.45.0` are present; both settings files parse after wiring.

The promoted aggregate Tier-1 run reported 265 scripts passed and four failures, one a timeout. Classification and independent reruns:

1. Proposal triage SLA: pre-existing WI-472 proposal metadata debt.
2. Skip registry: WI-498 remains pre-existing; WI-507's missing audit receipt evidence was corrected during state closeout and no longer appears on direct rerun.
3. Receipt schema: parallel 180-second timeout; direct rerun passes.
4. Reconcile watcher: primary clone-local `mode=refuse` policy exposes its pre-existing historical receipt backlog; the exact validator passes with an isolated default policy, matching the clean-worktree result.

No failure is attributable to the promoted WI-507 runtime tree.

## External-state integrity

| Path | SHA-256 after G7 |
|---|---|
| `example-company/.svc/company-link.json` | `144fb41a3ffa749c7f0546735d892c15273c44ed15126d92ed497cc0abf701ea` |
| `example-company/company-state/apps.json` | `948ec3fe910951dddb1b33c827419716d5c89e43614c69442ff51c7fe3d283cf` |
| `example-marketplace/.svc/company-link.json` | `0bd8b6f1044c5ea895751b4648eca7b03501d98613e90dd88f9d27cc338b13ef` |
| `example-company/company-state/open-items.jsonl` | `188adba3a0b6cb883afa7d3f7474b93a0620232d190bd16c96e1e9f0baaf3592` |
| `example-company/docs/checklists/apple-developer-organization.md` | `dd4a4a76cd3e20670e8ab0a3b951cbad2ff3dd9d4c9c8f4f8d3a1ab55d45a1d6` |
| `example-company/docs/checklists/domain-email-identity.md` | `4839bfd1a6c8999766f5d127806835d665eb69deb9ca94bcf612927959173284` |

## Verification classification

```yaml
single_lane_summary:
  item: WI-507
  target_class: headless-framework
  verification_tier: V2
  sampled: true
  evidence:
    - live installed Claude SessionStart hook output
    - live installed Gemini SessionStart hook JSON output
    - all-host drift checks
    - promoted focused regression suites
```

Browser journeys, screenshots, canary URL monitoring, mobile release identity, landing-page evidence, and provider-fidelity evidence are N/A because WI-507 has no browser, mobile, deployment, or generated-provider surface.

The delivery-graph evidence preview classifies WI-507 as `framework-complete`. The binding closeout records `runtime-accepted` because the global WI-395 main-green gate has no clean current verdict while known repository-wide Tier-1 debt remains. This does not downgrade the passing SHA-bound G7 receipt; it prevents an inaccurate all-framework-green claim.
