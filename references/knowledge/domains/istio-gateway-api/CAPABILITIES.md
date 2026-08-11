# Istio + Kubernetes Gateway API — Capabilities

**Domain:** Service mesh (Istio) + Kubernetes Gateway API (cross-vendor ingress + mesh routing)
**Layer:** 2 (CAPABILITIES)
**Last updated:** 2026-05-01
**Source:** WebSearch research pass (Istio docs, Kubernetes blog, GEPs, CNCF, Solo.io, Argo Rollouts docs)

## Layer 3 detail files (drill-downs)

For specific sub-areas, read the detail file. The Layer 2 entries below summarize; Layer 3 files contain manifest shapes, debugging recipes, and operational specifics.

| Detail | Covers |
|---|---|
| [details/wasmplugin.md](details/wasmplugin.md) | WasmPlugin manifest shape, phase ordering, OCI distribution, ambient `targetRefs` rules, lifecycle |
| [details/security-policies.md](details/security-policies.md) | RequestAuthentication + AuthorizationPolicy — JWT validation, ambient targeting (selector vs targetRefs footgun), rule shape, debugging |
| [details/envoyfilter-ambient.md](details/envoyfilter-ambient.md) | EnvoyFilter status in ambient — works on istio-ingress, unsupported on Waypoint, n/a on ztunnel; migration patterns from sidecar EnvoyFilter |
| [details/istioctl-ops.md](details/istioctl-ops.md) | Operational `istioctl` commands — proxy-config, proxy-status, ztunnel-config, RBAC debug, common diagnosis flows |

Outstanding Layer 3 gaps (not yet drilled, lower priority for current EzBob WIs): Telemetry API, ServiceEntry, multi-cluster classic (sidecar) topology, BackendTLSPolicy, Gateway API Inference Extension, Istio install topologies (Helm vs istioctl).

---

## Space

Istio is the dominant CNCF service mesh; Kubernetes Gateway API is the upstream
standard replacing the legacy Ingress and Istio's `VirtualService`/`Gateway` for
both north-south (cluster ingress) and east-west (in-mesh) traffic. Istio
adopted Gateway API as the strategic interface in 1.22 (May 2024) and Ambient
Mode reached GA in 1.24 (Nov 2024). VirtualService is in gradual deprecation.

---

## Major Players

- **Istio** — dominant mesh; 1.27 EOL announced 2026-04, current stable **1.29** (Beta multicluster ambient, GA Telemetry/Gateway API)
- **Envoy Gateway** — separate project but shares Envoy data plane with Istio; same Gateway API conformance class
- **Cilium** — eBPF-based mesh; Gateway API conformant since 1.14; alternative for L4-heavy workloads
- **Kong** — Gateway API conformant; competing path
- **Argo Rollouts** — progressive delivery controller; native VS integration + Gateway API plugin (`rollouts-plugin-trafficrouter-gatewayapi`)

---

## Istio Version Timeline (gates real decisions)

| Version | Released | Status | Key facts |
|---|---|---|---|
| 1.22 | May 2024 | EOL | Telemetry API + Gateway API promoted to **Stable**; Ambient → Beta |
| 1.24 | Nov 2024 | EOL | Ambient mode → **GA**; sidecar deprecation begins |
| 1.26 | early 2025 | EOL | Gateway API v1.2 standard support; HTTPRoute timeouts native |
| 1.27.0 | Aug 2025 | **EOL announced 2026-04** | Gateway API v1.4 standard support; ListenerSets API; Multi-cluster Ambient Alpha; ServiceScope alpha; PQC TLS option; CRL for plugged-in CA |
| 1.27.9 | 2026-04-13 | last 1.27 patch | CVE fixes: 31837 (8.7) + 31838 (6.9) + 26308 (7.5) + 26309/10/11/30 (5.3-5.9) |
| 1.28.0 | late 2025 | maintained | BackendTLSPolicy v1 stable; FrontendTLSValidation (GEP-91); ServiceEntry as targetRef in BackendTLSPolicy; InferencePool v1; supports k8s 1.29-1.34 |
| 1.28.6 | 2026-04-13 | latest 1.28 | All CVE fixes + RBAC multivalue header bypass + ratelimit phase crash |
| **1.29.0** | early 2026 | **current stable** | **Ambient multi-network multicluster Beta (production-ready)**; Gateway API Inference Extension Beta; Agentgateway experimental; CRL in ztunnel; iptables auto-reconcile; `PILOT_IGNORE_RESOURCES` for GAMMA-only deploys; `automemlimit` (`GOMEMLIMIT` 90% mem); HBONE baggage headers |
| 1.29.2 | 2026-04-13 | latest stable | All CVE fixes — recommended target |

**Istio deprecation policy:** removed within 2-3 minor releases of deprecation notice.

---

## Gateway API Version Timeline (channel-aware)

| Version | Released | Standard channel | Experimental channel |
|---|---|---|---|
| v1.0 | Oct 2023 | Gateway, HTTPRoute, ReferenceGrant (GA) | TLSRoute, TCPRoute, UDPRoute, GRPCRoute |
| v1.1 | May 2024 | + GRPCRoute (GA), ServiceMesh stable | BackendTLSPolicy alpha |
| v1.2 | Nov 2024 | + HTTPRoute timeouts | + HTTPRoute Retries (GEP-1731), WebSockets |
| **v1.3** | **Jun 2025** | + percentage-based mirroring | + **CORS filter (GEP-1767)**, Gateway Merging, Retry Budgets, XBackendTrafficPolicy, XListenerSet |
| v1.4 | late 2025 | + BackendTLSPolicy v1 (graduated) | + FrontendTLSValidation (GEP-91) |

**Channel convention:** experimental Kinds live under `gateway.networking.x-k8s.io` with `X` prefix. New FIELDS on standard Kinds (e.g. CORS filter on HTTPRoute) require the **experimental CRD bundle**, not a different group.

Verify on a cluster:
```bash
kubectl get crd httproutes.gateway.networking.k8s.io \
  -o jsonpath='{.metadata.annotations.gateway\.networking\.k8s\.io/bundle-version}{"\n"}{.metadata.annotations.gateway\.networking\.k8s\.io/channel}{"\n"}'
```

Install:
```bash
# Standard
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.3.0/standard-install.yaml
# Experimental (CORS filter, retries, X-prefix Kinds)
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.3.0/experimental-install.yaml
```

---

## What HTTPRoute Can Do (standard, today)

| Capability | Notes |
|---|---|
| Path match | Exact, PathPrefix, RegularExpression (Extended conformance — supported by Istio 1.27+) |
| Method match | Exact only — multi-method via OR-list in `matches` array |
| Header match | Exact, Regex |
| Query param match | Exact |
| Multiple parentRefs | One HTTPRoute → multiple Gateways |
| URLRewrite filter | ReplaceFullPath, ReplacePrefixMatch, hostname rewrite |
| RequestHeaderModifier | add/set/remove on request |
| ResponseHeaderModifier | add/set/remove on response |
| RequestRedirect filter | scheme, hostname, path, status code |
| RequestMirror filter | basic mirror; **percentage mirroring stable since v1.3** |
| Weight-based traffic split | `backendRefs[].weight` |
| Backend timeouts | `timeouts.request`, `timeouts.backendRequest` (since v1.2) |
| **Hard caps** | **16 rules**, **16 hostnames**, **8 matches/rule** per HTTPRoute |

---

## What HTTPRoute Can Do (experimental v1.3+)

| Capability | Filter | GEP | Status |
|---|---|---|---|
| **CORS filter** | `filters: [{type: CORS, cors: {...}}]` | GEP-1767 | experimental v1.3 |
| Counted retries | `retry: {codes, attempts, backoff}` | GEP-1731 | experimental v1.2 |
| Retry budgets | XBackendTrafficPolicy | GEP-3388 | experimental v1.3 |
| Gateway/Listener merging | XListenerSet | GEP-1713 | experimental v1.3 |
| Frontend TLS validation (mTLS at ingress) | FrontendTLSValidation | GEP-91 | experimental v1.4 |

**CORS filter shape** (preflight authoritative — does NOT reach upstream):
```yaml
filters:
  - type: CORS
    cors:
      allowOrigins: ["..."]
      allowMethods: [GET, POST, PUT, PATCH, DELETE, OPTIONS]
      allowHeaders: [Authorization, Content-Type]
      exposeHeaders: []
      allowCredentials: <bool>
      maxAge: <seconds>
```

There is **no `CORSPolicy` CRD** in Istio 1.27.x (common confusion — only the inline filter exists).

---

## What HTTPRoute CANNOT Do (still need VS / DR / WasmPlugin / Istio Authz)

| Feature | Workaround |
|---|---|
| Outlier detection (eject 5xx pods) | DestinationRule.trafficPolicy.outlierDetection |
| Load balancer algorithm (LEAST_REQUEST, RING_HASH, MAGLEV) | DestinationRule.trafficPolicy.loadBalancer |
| Locality LB (zone failover) | DestinationRule.trafficPolicy.loadBalancer.localityLbSetting |
| Connection pool tuning | DestinationRule.trafficPolicy.connectionPool |
| Subsets (active/canary by label) | DestinationRule.subsets — used by Argo Rollouts |
| Fault injection (delay, abort) | VirtualService.http.fault |
| DestinationRule mTLS overrides | DestinationRule.trafficPolicy.tls |
| Global rate limiting | EnvoyFilter (Istio) or BackendTrafficPolicy (Envoy Gateway) |
| Header injection on response (canary headers) | WasmPlugin (Ambient-preferred) or EnvoyFilter |
| JWT validation | Istio RequestAuthentication + AuthorizationPolicy |
| AuthorizationPolicy (HTTP-attribute auth) | Istio AuthorizationPolicy CRD |

**Implication:** HTTPRoute replaces VS for **routing**. DestinationRule remains for **traffic policy + subsets**. VirtualService remains for **fault injection + advanced mirror**. WasmPlugin remains for **header injection on Ambient**.

---

## Ambient Mode Topology (post-1.24 GA)

```
                north-south
                     │
                     ▼
   istio-ingress / istio-ingress-external Gateway pod (regular Envoy)
   ├── parents: cluster Gateway resources
   ├── HTTPRoute attaches here for north-south
   └── handles CORS preflight, TLS termination, header sanitization
                     │
                     ▼ mTLS via HBONE
                     │
              ┌──────┴───────┐
              │   ztunnel    │  per-node, Rust, L4 only, mTLS
              └──────┬───────┘
                     │
                     ▼ only when L7 features needed
              ┌──────┴───────┐
              │   Waypoint   │  per-namespace or per-service Envoy
              │     Proxy    │
              └──────┬───────┘
                     │
                     ▼
                 workload pod
```

| Component | Is Envoy? | Filter mechanism |
|---|---|---|
| `istio-ingress` Gateway pod | ✅ regular Envoy | EnvoyFilter, WasmPlugin, Gateway API filters |
| `<ns>-waypoint` (Ambient L7) | ✅ Envoy in Ambient context | WasmPlugin (preferred); EnvoyFilter discouraged |
| `ztunnel` DaemonSet | ❌ Rust binary | mTLS only — no filter chain |

| Need | Where to enforce |
|---|---|
| Browser→API CORS preflight | istio-ingress Gateway pod (north-south HTTPRoute filter) |
| TLS termination | istio-ingress Gateway pod |
| Header sanitisation | EnvoyFilter on istio-ingress (regular Envoy) |
| East-west L4 mTLS | ztunnel automatic |
| AuthorizationPolicy with HTTP attributes | Waypoint (ztunnel cannot enforce L7 — fails safe DENY) |
| Retry / timeout / mirror east-west | Waypoint |
| Header-based canary east-west | Waypoint (via VS or HTTPRoute attached to Waypoint) |
| JWT validation | RequestAuthentication on Waypoint (Ambient) |

**HBONE** = HTTP-based Overlay Network Environment. ztunnel encapsulates east-west traffic in HTTP/2 with mTLS; transparently forwards to Waypoint when L7 needed.

**With Waypoint (L7):** `src pod → src ztunnel —HBONE→ Waypoint Envoy (L7 + telemetry) —HBONE→ dst ztunnel → dst pod`

**Without Waypoint (L4 only):** `src pod → src ztunnel —HBONE→ dst ztunnel → dst pod`

---

## Ambient Multicluster (1.29 Beta — production-ready)

**Double-HBONE** east-west gateway (port 15008, `protocol: HBONE`, `tls.mode: Terminate`, `gateway.istio.io/tls-terminate-mode: ISTIO_MUTUAL`):
- Outer HBONE: source ztunnel ↔ remote east-west gateway (mTLS, gateway identity)
- Inner HBONE: source ztunnel ↔ destination ztunnel (mTLS, end-to-end app identity)
- Reuses cross-cluster TCP connections (cuts handshake count)

**Global services:** `ServiceScope` API (global vs local) — global services discoverable across clusters; ztunnel load-balances local-first with remote failover.

**Hard limitation:** ambient east-west gateway **cannot expose API server** across clusters (only supports double-HBONE). For multi-primary install where istiod observes peer cluster API servers, deploy a **classic non-ambient east-west gateway alongside** the ambient one. Mixing topologies is documented but cumbersome.

**HBONE baggage headers (1.29):** peer metadata across networks via HTTP/2 baggage frame. Behind feature flag `AMBIENT_ENABLE_BAGGAGE`.

---

## VirtualService Deprecation Trajectory

- Gateway API + Telemetry API promoted Stable in 1.22 (May 2024)
- Ambient promoted Stable in 1.24 (Nov 2024)
- VirtualService, DestinationRule, Istio Gateway, ServiceEntry, Sidecar — gradual deprecation in favor of Gateway API
- Istio policy: deprecated → removed within 2-3 minor releases
- 1.29 preliminary mentions a **VS → HTTPRoute conversion tool**
- DestinationRule will outlive VirtualService (no Gateway API equivalent for traffic policy + subsets, no concrete GEP yet for fault injection / advanced mirror)

**Practical implication:** plan to be off VirtualService for routing within 12-18 months. DestinationRule remains indefinitely for traffic policy.

---

## Argo Rollouts × Gateway API

| Path | How |
|---|---|
| VirtualService trafficRouting (classic) | Argo patches VS weights + DR subsets — mature, widely deployed |
| HTTPRoute trafficRouting | `rollouts-plugin-trafficrouter-gatewayapi` patches `backendRefs[].weight` — stable, recommended for Ambient |
| HTTPRoute native | not implemented in Argo Rollouts core — use plugin |

Both paths support: weight-based split, header-based routes via `setHeaderRoute` (managed routes with precedence array), mirror routes, pre/post promotion analysis.

**East-west canary caveat:** weight on parent route doesn't work cleanly because in-mesh callers use service DNS (not host-level URLs). Use **DestinationRule subsets** + label-based traffic split. DR is required for east-west canary regardless of routing layer.

**GitOps friction:** Argo mutates `backendRefs[].weight` during rollout → ArgoCD sees drift. Mitigate via `ignoreDifferences` on those paths or manage Rollout as separate ArgoCD app.

---

## Argo Rollouts ↔ Gateway API plugin caveats

| Concern | Reality |
|---|---|
| Istio 1.27 + Ambient Waypoint compat | Plugin documented compatible; specific Waypoint testing not asserted publicly. Validate end-to-end before relying for prod. |
| ArgoCD OutOfSync on weight | `ignoreDifferences` on `/spec/rules/*/backendRefs/*/weight` |
| East-west canary | Plugin doesn't replace DR subsets — still required for in-mesh |
| `setHeaderRoute` ordering | `managedRoutes` array order = precedence |

---

## Common Pitfalls (verified)

| Pitfall | Symptom | Fix |
|---|---|---|
| Using `CORSPolicy` CRD that doesn't exist | `kubectl get crd corspolicies.networking.istio.io` → NotFound | Use HTTPRoute CORS filter (v1.3 experimental) — there is no `CORSPolicy` CRD in Istio 1.27/1.28/1.29 |
| Standard channel + experimental field | apply rejected with unknown field on HTTPRoute | Install experimental CRD bundle (v1.3+) |
| HTTPRoute >16 rules | k8s admission rejects (silently in some setups, warning in others) | Multi-HTTPRoute split sharing same `parentRefs` |
| Methods as single regex | k8s admission rejects (Method is Exact only) | OR-list in `matches` array; rule count unchanged |
| ztunnel cannot enforce AuthorizationPolicy with L7 attributes | Policy fails safe to DENY; requests 403 | Attach Waypoint to namespace; `targetRef` policy at Waypoint |
| Argo Rollouts gateway-api plugin not installed | Rollouts fall back to VS path; HTTPRoute path silent no-op | Install plugin and configure `trafficRouting.plugins.argoproj-labs/gatewayAPI` |
| EnvoyFilter on Waypoint | Works but discouraged; less stable across upgrades | Use WasmPlugin |
| EnvoyFilter on ztunnel | Doesn't apply — ztunnel is not Envoy | WasmPlugin on Waypoint or EnvoyFilter on istio-ingress |
| Skipping minor versions on upgrade past deprecation warning | Hard breakages | Stage minor-by-minor or use a maintenance bridge |

---

## Migration Patterns: VirtualService → HTTPRoute

### Path / method / rewrite (mechanical)

VS:
```yaml
http:
  - match:
      - uri: { prefix: /api/v1/ }
        method: { regex: "GET|POST" }
    rewrite: { uri: /v1/ }
```

HTTPRoute equivalent:
```yaml
rules:
  - matches:
      - { path: { type: PathPrefix, value: /api/v1/ }, method: GET }
      - { path: { type: PathPrefix, value: /api/v1/ }, method: POST }
    filters:
      - type: URLRewrite
        urlRewrite:
          path: { type: ReplacePrefixMatch, replacePrefixMatch: /v1/ }
```

Method regex → `matches` OR-list. Rule count = 1.

### Header-based canary (was VS rule duplication + WasmPlugin)

Use Argo Rollouts `setHeaderRoute` step on HTTPRoute via gateway-api plugin. Plugin handles weight + header routes via `managedRoutes` precedence.

### CORS (was per-rule corsPolicy in VS)

HTTPRoute CORS filter (v1.3 experimental, see CORS filter shape above). One filter per rule, OR a CORS-only HTTPRoute that shares the Gateway with the routing HTTPRoute.

### What you cannot migrate yet

- `VirtualService.http.fault.delay/abort` — keep VS
- `DestinationRule.trafficPolicy.*` — keep DR
- `DestinationRule.subsets` — keep DR if Argo Rollouts uses them
- WasmPlugin canary header injection — keep WasmPlugin

---

## Common Pitfalls (production migration)

- Migrating routes without bumping Gateway API CRDs first (CORS filter rejected, looks like template bug)
- Forgetting to attach Waypoint when migrating east-west routes — HTTPRoute attaches to Waypoint via `parentRefs`, not implicitly
- Splitting >16 rule HTTPRoutes wrong — each split must share `parentRefs` and not duplicate `hostnames` or admission rejects
- Argo Rollouts plugin version skew with Istio version — pin both
- Skipping outlier detection retention on UAT/Prod migration — production resilience regression

---

## Standard Metrics

KPIs that signal mesh health:
- `istio_requests_total` (Prometheus) — request rate per source/destination
- `istio_request_duration_milliseconds` — latency histogram
- `istio_request_bytes` / `istio_response_bytes` — payload size
- `pilot_xds_pushes` — config push rate (control plane health)
- `envoy_cluster_outlier_detection_ejections_active` — pods ejected by outlier detection
- ztunnel HBONE connection count + active sessions (Ambient)
- Waypoint Envoy admin port `/stats` (when L7 enforcement active)
- Gateway API conformance score per implementation (published per Istio release)

---

## Re-Research Triggers

This domain knowledge becomes stale (re-research and update CAPABILITIES.md + bump `.version`) when ANY of:

1. Istio bumps past 1.29.x (next minor release)
2. Gateway API past v1.4 (v1.5 in development)
3. CORS filter (GEP-1767) graduates from experimental → standard
4. Counted retries (GEP-1731) graduates from experimental → standard
5. Argo Rollouts ships native HTTPRoute support (no plugin needed)
6. Istio publishes the VS → HTTPRoute conversion tool (1.29 preliminary mention)
7. DestinationRule replacement GEP appears in Gateway API
8. New CVEs in current supported versions

---

## Sources

- [Istio 1.27 announcement](https://istio.io/latest/news/releases/1.27.x/announcing-1.27/) and [change notes](https://istio.io/latest/news/releases/1.27.x/announcing-1.27/change-notes/)
- [Istio 1.28 announcement](https://istio.io/latest/news/releases/1.28.x/announcing-1.28/)
- [Istio 1.29.0 announcement](https://istio.io/latest/news/releases/1.29.x/announcing-1.29/)
- [Istio 2025-2026 Roadmap](https://istio.io/latest/blog/2025/roadmap/)
- [Istio Feature Stages (deprecation policy)](https://istio.io/latest/docs/releases/feature-stages/)
- [Istio Supported Releases](https://istio.io/latest/docs/releases/supported-releases/)
- [Istio Ambient overview](https://istio.io/latest/docs/ambient/overview/) and [data plane](https://istio.io/latest/docs/ambient/architecture/data-plane/)
- [Istio Ambient Waypoint Proxy](https://istio.io/latest/docs/ambient/usage/waypoint/) and [L7 features](https://istio.io/latest/docs/ambient/usage/l7-features/)
- [Ambient multi-network multicluster Beta (1.29)](https://istio.io/latest/blog/2026/ambient-multinetwork-multicluster-beta/)
- [Ambient multicluster install — multi-primary, multi-network](https://istio.io/latest/docs/ambient/install/multicluster/multi-primary_multi-network/)
- [GitHub: ambient east-west gateway API server limitation #57525](https://github.com/istio/istio/issues/57525)
- [Gateway API v1.3.0: CORS, Mirroring, Gateway Merging](https://kubernetes.io/blog/2025/06/02/gateway-api-v1-3/)
- [GEP-1767 CORS Filter](https://gateway-api.sigs.k8s.io/geps/gep-1767/)
- [GEP-1731 HTTPRoute Retries](https://gateway-api.sigs.k8s.io/geps/gep-1731/)
- [Istio Gateway API integration task](https://istio.io/latest/docs/tasks/traffic-management/ingress/gateway-api/)
- [Argo Rollouts Istio integration](https://argo-rollouts.readthedocs.io/en/stable/features/traffic-management/istio/) and [Gateway API plugin](https://rollouts-plugin-trafficrouter-gatewayapi.readthedocs.io/en/latest/)
- [Argo Rollouts Ambient HTTPRoute discussion #3897](https://github.com/argoproj/argo-rollouts/discussions/3897)
- [Solo.io: Istio CORS and JWT](https://www.solo.io/blog/configuring-cors-and-jwt-in-istio-for-secure-cross-origin-requests-6a56c)
- [Gateway API compatibility matrix 2026](https://alexandre-vazquez.com/kubernetes-gateway-api-versions-compatibility-guide/)
- [CNCF: Istio future-ready service mesh for AI era (KubeCon EU 2026)](https://www.cncf.io/announcements/2026/03/25/istio-brings-future-ready-service-mesh-to-the-ai-era-with-new-ambient-multicluster-gateway-api-inference-extension-and-more/)
- [Kubernetes Gateway API 2026 definitive guide](https://dev.to/mechcloud_academy/kubernetes-gateway-api-in-2026-the-definitive-guide-to-envoy-gateway-istio-cilium-and-kong-2bkl)
