# Istio EnvoyFilter — Ambient-mode reality

**Last researched:** 2026-05-01
**Parent:** `../CAPABILITIES.md`
**API:** `networking.istio.io/v1alpha3`

EnvoyFilter is Istio's "break-glass" API for arbitrary Envoy config patches. Critical question for ambient mode: where can you still use it, and where is it effectively dead?

## Where EnvoyFilter still works (Ambient mode)

### ✅ Cluster-edge Envoys (regular Envoy, full support)

`istio-ingress` and `istio-ingress-external` Gateway pods are **regular Envoy deployments** — not Waypoints, not ztunnel. EnvoyFilter with `workloadSelector` matching the gateway's labels works as it always has. Patch contexts: `GATEWAY`, `ANY`.

This is where header sanitisation, custom auth filters, custom rate limiting, and any other "Envoy needs a tweak that Istio APIs don't expose" lives.

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: EnvoyFilter
metadata:
  name: gateway-response-remove-add-headers
  namespace: istio-system
spec:
  workloadSelector:
    labels:
      istio: ingressgateway
  configPatches:
    - applyTo: HTTP_FILTER
      match:
        context: GATEWAY
        listener:
          filterChain:
            filter:
              name: envoy.filters.network.http_connection_manager
              subFilter:
                name: envoy.filters.http.router
      patch:
        operation: INSERT_BEFORE
        value: ...
```

**EzBob legacy uses this pattern**: 2 EnvoyFilters in `istio-system` strip server-fingerprint headers and add security headers on responses through ingress gateways.

### ⚠️ Waypoint Proxy (Envoy in Ambient, but unsupported)

Waypoints are Envoy. So *technically* EnvoyFilter could patch them. But:

- **Officially unsupported** by Istio maintainers
- **Actively discouraged** — likely to break across Istio version upgrades
- `workloadSelector` matching Waypoint labels does NOT work; only `targetRef` / `parentRef` binds resources to Waypoints
- Community workarounds exist but the maintainers' position is "use WasmPlugin instead"

If you need filter-chain manipulation on a Waypoint, the supported path is **WasmPlugin**, not EnvoyFilter.

### ❌ ztunnel (NOT applicable)

ztunnel is a Rust binary, not Envoy. EnvoyFilter does nothing — there is no Envoy filter chain to patch. The protocol that runs on ztunnel (HBONE) is implemented in Rust code, not via xDS.

## Patch contexts — which apply where

EnvoyFilter has these `match.context` values:

| Context | Sidecar mode | Ambient — istio-ingress | Ambient — Waypoint | Ambient — ztunnel |
|---|---|---|---|---|
| `SIDECAR_INBOUND` | ✅ | n/a | n/a | n/a |
| `SIDECAR_OUTBOUND` | ✅ | n/a | n/a | n/a |
| `GATEWAY` | n/a | ✅ | ⚠️ unsupported | ❌ |
| `ANY` | ✅ | ✅ | ⚠️ unsupported | ❌ |

In ambient, `SIDECAR_*` contexts are dead — no sidecars exist.

## Roadmap (per Istio maintainers)

> "Official support for EnvoyFilter with waypoints will be provided at a later date."
> — istio/istio Discussion #53014

No firm version commitment as of 1.29. WasmPlugin is the recommended replacement for Waypoint customization.

## Migration patterns (sidecar EnvoyFilter → ambient equivalent)

| Use case | Sidecar EnvoyFilter | Ambient replacement |
|---|---|---|
| Add response header | `HTTP_FILTER`, `INSERT_BEFORE` | RequestHeaderModifier filter on HTTPRoute (north-south) OR WasmPlugin on Waypoint (east-west) |
| Custom auth (OIDC, OAuth) | EnvoyFilter `oauth2` filter | RequestAuthentication + AuthorizationPolicy (OIDC) OR WasmPlugin on Waypoint |
| Local rate limiting | EnvoyFilter `local_ratelimit` filter | WasmPlugin on Waypoint OR Envoy Gateway (different mesh) |
| Global rate limiting | EnvoyFilter + external rate-limit service | WasmPlugin on Waypoint OR Envoy Gateway |
| Lua scripting | EnvoyFilter `lua` filter | WasmPlugin (rewrite logic in Rust/AssemblyScript/Go) |
| Header sanitization on edge | EnvoyFilter on `istio-ingress` | **STILL EnvoyFilter on `istio-ingress`** — works in ambient |
| Custom telemetry / access logs | EnvoyFilter `access_log` patch | Telemetry API (`telemetry.istio.io/v1`) — supported and stable |
| Circuit breaker config beyond DR | EnvoyFilter `circuit_breakers` patch | DestinationRule `connectionPool` (limited) OR WasmPlugin |

## When NOT to migrate (keep EnvoyFilter)

If the EnvoyFilter is on `istio-ingress` / `istio-ingress-external` / any regular Envoy gateway, **keep it as-is**. Ambient mode doesn't deprecate EnvoyFilter at the cluster edge — only at the per-workload layer (which is now Waypoint or ztunnel).

## EzBob-specific note (project context)

Legacy clusters: **2 EnvoyFilters in `istio-system`** for response header sanitization (internal + external gateways). These are on `istio-ingress` / `istio-ingress-external` — supported pattern. **PORT as-is to green** clusters' istio-system. This is gate **F3** in the routing-stack design authority.

Legacy workload namespaces: **0 EnvoyFilters** (verified via `kubectl get envoyfilter -A`). The 2025-01-27 ambient migration removed all per-namespace EnvoyFilters; their functionality moved to WasmPlugin on Waypoints. No EnvoyFilter porting needed for workload-level concerns.

Green clusters today: **0 EnvoyFilters in workload namespaces** (correct). Green istio-system: **TBD** (checklist §"Open data points" — verify with `kubectl --context express-devs-green -n istio-system get envoyfilters`).

## Operational verification

```bash
# Inventory across all namespaces
kubectl get envoyfilter -A

# What patches will apply to a specific proxy
istioctl proxy-config listeners <pod> -n <ns> -o json | \
  jq '.[] | select(.name | contains("envoy_filter"))'

# Validate EnvoyFilter syntax before apply
istioctl analyze envoyfilter.yaml

# Check what filter chain a Gateway pod is currently running
istioctl proxy-config listeners <istio-ingress-pod> -n istio-ingress -o json
```

## Sources

- [Istio Ambient L7 features](https://istio.io/latest/docs/ambient/usage/l7-features/)
- [GitHub Discussion #53014 — EnvoyFilter in Ambient Mesh](https://github.com/istio/istio/discussions/53014)
- [Tetrate — Use Envoy Gateway as Unified Ingress + Waypoint](https://tetrate.io/blog/envoy-gateway-ambient-mesh-integration)
- [Solo.io — Ambient Waypoint Proxy deployment model](https://www.solo.io/blog/istio-ambient-waypoint-proxy-deployment-model-explained)
- [Istio Ambient Troubleshooting wiki](https://github.com/istio/istio/wiki/Troubleshooting-Istio-Ambient)
