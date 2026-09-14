# Istio WasmPlugin — Layer 3 Detail

**Last researched:** 2026-05-01
**Parent:** `../CAPABILITIES.md`
**API:** `extensions.istio.io/v1alpha1`

## Mechanism

WasmPlugin extends Envoy with custom WebAssembly logic without writing native C++ filters. The Istio agent on each proxy interprets the WasmPlugin spec, downloads the Wasm binary (file path / HTTPS URL / OCI image) to a local file, and injects it into the filter chain at the specified phase.

In **sidecar mode**: the per-pod sidecar runs the Wasm filter.
In **ambient mode (1.27+)**: only **Waypoint Proxy** runs Wasm filters. ztunnel does NOT — it's L4-only Rust binary, no filter chain. Plugin must target the Waypoint via `targetRefs`, NOT via `workloadSelector`.

## Manifest shape

```yaml
apiVersion: extensions.istio.io/v1alpha1
kind: WasmPlugin
metadata:
  name: my-plugin
  namespace: my-app
spec:
  # Targeting (one of):
  selector:                          # sidecar mode — workload labels
    matchLabels: { app: foo }
  targetRefs:                        # ambient mode — Service or Waypoint Gateway
    - kind: Service
      group: ""
      name: foo
    # OR:
    - group: gateway.networking.k8s.io
      kind: Gateway
      name: <ns>-waypoint

  # Wasm binary source:
  url: oci://registry.example.com/my-plugin:v1.2.3
  sha256: <hex>                      # integrity pin (recommended)
  imagePullPolicy: IfNotPresent
  imagePullSecret: registry-pull     # standard k8s docker-registry Secret

  # Filter chain placement:
  phase: AUTHN | AUTHZ | STATS | UNSPECIFIED_PHASE
  priority: 0                        # higher = earlier within same phase

  # Plugin runtime config (arbitrary):
  pluginConfig:
    rules:
      - operation: { request_headers: [...] }

  # VM environment:
  vmConfig:
    env:
      - name: API_KEY
        valueFrom: HOST              # or INLINE

  # Failure handling:
  failStrategy: FAIL_OPEN | FAIL_CLOSE
```

## Phase ordering

Phases run in this order on every request (within a phase, `priority` orders multiple plugins; higher priority = earlier):

| Phase | When it runs | Typical use |
|---|---|---|
| `AUTHN` | Earliest — before authentication | Validate JWTs, check API keys, decode tokens |
| `AUTHZ` | After `AUTHN` | Access control checks, RBAC, fine-grained authz |
| `STATS` | After request processed | Custom metrics, telemetry, latency tracking |
| `UNSPECIFIED_PHASE` | Default — before the router | General-purpose request/response transformation |

Composition example: `openid-connect` plugin (AUTHN) writes a signed JWT to `Authorization` header → Istio's built-in authn validates it → `acl-check` plugin (AUTHZ) calls a policy server with the JWT → request proceeds or 403.

## OCI image distribution

Recommended distribution path. Push the Wasm binary as an OCI artifact:

```bash
# Build (e.g. Rust)
cargo build --target wasm32-wasi --release
# Push to OCI registry using ORAS
oras push registry.example.com/my-plugin:v1.2.3 \
  --artifact-type application/vnd.module.wasm.content.layer.v1+wasm \
  target/wasm32-wasi/release/my_plugin.wasm
```

In WasmPlugin: `url: oci://registry.example.com/my-plugin:v1.2.3` plus `imagePullSecret` for private registries.

**Pin to SHA256** for production:
```yaml
url: oci://registry.example.com/my-plugin@sha256:abc123...
sha256: abc123...
```

Tag-based references (`:v1.2.3`, `:latest`) are vulnerable to tag mutation; SHA256 pinning is the highest-confidence form.

## Ambient mode specifics (1.27+)

### Targeting rules in ambient

- Use `targetRefs`, NOT `selector` or `workloadSelector`. `workloadSelector` does not work for Waypoints.
- Target a **Service** for service-scoped enforcement
- Target a **Waypoint Gateway** (`group: gateway.networking.k8s.io, kind: Gateway`) for namespace-scoped enforcement

```yaml
# Namespace-wide via Waypoint:
spec:
  targetRefs:
    - group: gateway.networking.k8s.io
      kind: Gateway
      name: <ns>-waypoint
```

### Known issue (verify on bump)

Service-specific `targetRefs` (`kind: Service`) on a WasmPlugin in ambient may not apply. Workaround: target the Waypoint Gateway instead of the individual Service. Tracked at https://github.com/istio/istio/issues/51014.

### What WasmPlugin can NOT do in ambient

- Cannot run on ztunnel (Rust, no filter chain)
- Cannot enforce L7 logic without a Waypoint deployed (the policy is configured but never executed because traffic doesn't traverse a Waypoint)

If a namespace has no Waypoint: WasmPlugin manifests with `targetRefs` to that namespace's Waypoint will be present but inert.

## Lifecycle management

```
Build & Package → Deploy → Update → Rollback → Cleanup
```

**Best practices:**
- Pin to SHA256 digests, not tags
- Canary new plugin versions via `selector`/`targetRefs` scoped to a subset of workloads first
- Set `failStrategy: FAIL_OPEN` for non-critical plugins (avoid total outage on plugin bug); `FAIL_CLOSE` for security-critical (deny if plugin can't decide)
- Build + push + deploy via CI/CD: WasmPlugin manifests in gitops, OCI image push from CI, ArgoCD applies the manifest update

## Operational commands

```bash
# List WasmPlugins across cluster
kubectl get wasmplugin -A

# Verify a WasmPlugin has been programmed onto a proxy:
istioctl proxy-config listeners <pod> -n <ns> -o json | jq '.. | .name? | strings | select(contains("wasm"))'

# Debug logging in the proxy for Wasm execution:
kubectl exec <waypoint-pod> -n <ns> -- pilot-agent request POST '/logging?wasm=debug'
```

## EzBob-specific note (project context)

Legacy clusters render 3 WasmPlugins per workload namespace:
- `add-release-version-header-request-stable`
- `add-release-version-header-response-preview`
- `add-release-version-header-response-stable`

These run on the namespace's Waypoint and inject/inspect `x-release-version` for canary detection across services. UAT/Prod green port (cmp-common 0.5.0 deferred work) needs `_wasmplugin.tpl` to render the same 3 plugins, with `targetRefs` to the namespace's Waypoint Gateway.

## Sources

- [Istio Wasm Plugin reference](https://istio.io/latest/docs/reference/config/proxy_extensions/wasm-plugin/)
- [Extend waypoints with WebAssembly plugins](https://istio.io/latest/docs/ambient/usage/extend-waypoint-wasm/)
- [Istio Wasm Plugin guide](https://oneuptime.com/blog/post/2026-01-30-istio-wasmplugin/view)
- [GitHub issue #51014 — service-specific WasmPlugin in ambient](https://github.com/istio/istio/issues/51014)
- [Wasm Plugin Lifecycle Management](https://oneuptime.com/blog/post/2026-02-24-how-to-configure-wasm-plugin-lifecycle-management-in-istio/view)
