# Framework Improvement: codify "Option C — existing-NLB sibling listener" as `opentelemetry-collector` CAPABILITIES.md §7.4

**Status:** DRAFT
**Filed:** 2026-05-10 by route-workflow on behalf of WI-082 close-out
**Source repo (where the gap lives):** `seriousvibecoding/references/knowledge/domains/opentelemetry-collector/CAPABILITIES.md`
**Source incident (where the gap was felt):** EzBob `new-devops-platform` WI-082 (2026-05-08 → 2026-05-10), full transcript in `new-devops-platform/docs/specs/work-items/WI-082.md` §"Live verification 2026-05-10"

---

## Evidence

WI-082 root cause: OTel agent on `express-devs-green` was exporting via `otel-gateway.tools.ezbob.com:443` (nginx-ingress front), and `grpc-go ≥1.67` ALPN enforcement (issue 434) rejected every TLS handshake because nginx-ingress doesn't advertise `h2`. 12-day production outage (2026-04-26 → 2026-05-08) of all `feat-*` inner-loop telemetry.

CAPABILITIES.md §7 (cross-cluster transport) currently lists:

| Option | Pattern | When to use |
|---|---|---|
| §7.1 Option A | `loadbalancingexporter` + headless gateway Service + DNS resolver | Full canonical; needs cross-cluster CoreDNS forwarding |
| §7.2 Option B | Provision a new AWS NLB with TCP-passthrough listener | When CoreDNS work is unattractive; adds ~$20/mo per NLB |
| §7.3 anti-pattern | nginx-ingress for cross-cluster gRPC | Don't |

WI-082's first plan-changeset (2026-05-08) anchored on Option A and surfaced foundation gate F1 (cross-cluster CoreDNS forwarding from express-devs-green → global-tools-green for `*.obs.svc.cluster.local`). Filed as WI-083, blocked WI-082 execute-changeset.

WI-082's redirected plan (2026-05-10) discovered a **strictly-better variant** that the framework knowledge doesn't yet name: extend the **existing internal NLB** with a **sibling listener** on a different port (`:4317`) with `alpn_policy=HTTP2Only`. Reuses the production-proven VPC-peered data path (the same NLB that already serves `*.tools.ezbob.com` ingress traffic), zero new DNS plumbing, no per-service NLB cost.

**Verified live 2026-05-10**: 0 ALPN errors, 3 healthy targets registered via TGB, gateway receiving 74 metrics / 93 data points every 10s end-to-end. WI-083 dissolved (superseded), F1 prerequisite gone.

The gap: AP-32 lane-entry domain coverage gate currently surfaces Option A as canonical and would re-pattern future similar work toward the CoreDNS-forwarding path even when an existing internal NLB makes Option C viable.

## Diagnosis

- **Root cause:** §7 enumerates Option A (full-canonical) and Option B (new-NLB), but does not name the additive variant of Option B where the cluster-tier NLB already exists and only a sibling listener is needed. Without that name, the gate's auto-routing biases toward Option A even when Option C would be strictly better.
- **Category:** missing capability (knowledge gap that pushes lanes toward higher-effort canonical paths)
- **Severity:** medium — Option A still works; Option C just lands faster, cheaper, and without an infra prerequisite
- **Already in FRAMEWORK-STATE.md known gaps?** No — new finding from WI-082 close-out

## Implementation

- **Route:** direct knowledge-file edit (extend `CAPABILITIES.md` §7), no skill change required
- **Files to change:**
  - `seriousvibecoding/references/knowledge/domains/opentelemetry-collector/CAPABILITIES.md` — add §7.4 "Option C: existing-NLB sibling listener (additive variant of Option B)" with the criteria, recipe, and AWS knobs
  - `seriousvibecoding/references/knowledge/domains/opentelemetry-collector/.version` — bump to 2026-05-10
  - Optionally `references/knowledge/domain-aliases.json` — add a path-pattern signal for `aws_lb_listener` to widen AP-32 detection on TF-side gRPC listener WIs (low priority, listener config already triggers AP-32 via the otel-collector domain name)

### §7.4 outline (for the edit)

```
## §7.4 Option C — existing-NLB sibling listener (recommended when an
internal NLB already exists in the destination topology)

When to choose this over §7.1 Option A or §7.2 Option B:
- The destination cluster ALREADY has a Terraform-managed internal NLB
  serving other tooling traffic (ingress-nginx, vault, grafana, etc.)
- The existing NLB has unused listener ports
- The wildcard ACM cert covers the new hostname
- VPC peering between agent and gateway clusters is already in production

Recipe:
1. Terraform: add aws_lb_target_group (port 4317 TCP, target_type=ip,
   healthcheck on OTel collector health_check extension port — typically
   13133/HTTP). Critical: alpn_policy = "HTTP2Only" on the new listener
   (HTTP2Preferred is also acceptable if the listener will also serve
   HTTP/1.1 traffic on the same port). Without alpn_policy, the AWS NLB
   defaults to None → grpc-go ≥1.67 rejects.
2. Output the new TG ARN.
3. gitops: add a TargetGroupBinding CRD pointing the OTel gateway
   Service:port at the new TG ARN. AWS LBC reconciles pod-IP membership.
4. DNS: add a new A/CNAME record at <name>.<existing-zone> pointing at
   the same NLB DNS (the existing wildcard ACM cert covers it).
5. OTel agent: flip endpoint to the new <name>.<zone>:<port>.

Apply order matters: TF (creates listener+TG) → DNS (resolves new name) →
gitops TGB (registers pods, healthchecks pass) → agent endpoint flip.
Each step is independently rollback-able.

Cost impact: zero. AWS does not separately bill for additional listeners or
target groups on an existing NLB.

Why this beats Option A in this scenario: no cross-cluster CoreDNS
forwarding prerequisite, no headless Service flip, no in-cluster FQDN
resolution from another cluster. Routing key for tail-sampling is hashed
by NLB 5-tuple instead of trace-ID — equivalent to Option A's behavior
when loadbalancingexporter's routing_key is left at default.

Why this beats Option B: no new NLB resource, no per-service NLB cost
line, reuses the same SG and ACM cert that production tooling already
trusts.

When NOT to use Option C:
- Destination cluster has no existing internal NLB (use Option B — new NLB)
- Trace-ID-keyed gateway pinning is required (e.g., for very tight
  tail-sampling correctness) — use Option A's loadbalancingexporter with
  routing_key=traceID
- Cross-cluster Service mesh is on the roadmap (Istio multi-cluster) —
  defer transport choices until mesh decision
```

## Replay verification

The "replay" target for this proposal is conceptual rather than mechanical:

- Verify that an agent encountering a similar WI in the future (e.g., another workload cluster wiring to global-tools-green's OTel gateway) routes through Option C when an existing internal NLB is available, without the CoreDNS-forwarding detour.
- Mechanically: a test-framework run that injects "agent on cluster X needs cross-cluster gRPC to gateway on cluster Y; cluster Y already has an internal NLB with free listener ports" should now produce a plan citing §7.4 instead of §7.1 + a CoreDNS-forwarding F1 prerequisite.

If `test-framework` doesn't have a scenario that exercises this, the proposal additionally suggests adding one — the AP-32 lane-entry gate's canonical-pattern selection is testable via plan-changeset's output diff against a fixture WI.

## FRAMEWORK-STATE.md mutations (after implementation)

- **Analysis History:** add 2026-05-10 entry — "OTel cross-cluster transport: codified Option C (existing-NLB sibling listener) as §7.4 in opentelemetry-collector CAPABILITIES.md after WI-082 case study; AP-32 now surfaces both Option A (CoreDNS-forwarding canonical) and Option C (NLB-extension when applicable)."
- **Known Gaps:** N/A (no prior gap entry; this is a positive addition).
- **Decisions:** add — "When destination cluster already has an internal NLB with free listener ports, Option C is the default canonical for cross-cluster gRPC OTel transport. Option A canonical only when destination NLB doesn't exist or trace-ID pinning is required."
- **Capabilities (CAPABILITIES.md):** §7.4 added per recipe above.

## Why not implement immediately

This proposal stays DRAFT in `seriousvibecoding/proposals/` because:

1. WI-082 close-out is on `new-devops-platform/main` and ready to push; landing this framework change in the same session would mix two different repos' work.
2. A second pair of eyes on the §7.4 recipe (specifically the "when NOT to use Option C" criteria) would benefit from a separate review pass.
3. `improve-framework` is the right host skill for the actual implementation; this proposal is the work-item it consumes.

When ready: run `improve-framework` against this proposal. Replay verification described above.
