# istioctl Operational Commands

**Last updated:** 2026-05-01
**Parent:** `../CAPABILITIES.md`

Reference for diagnosing Istio + Gateway API issues. Grouped by what you're trying to learn.

## Cluster + install state

```bash
# Istio version + control plane health
istioctl version                              # client + servers
istioctl version --short                       # just version numbers

# What components are deployed
istioctl operator dump                         # if Istio Operator is in use (deprecated)
kubectl -n istio-system get pods               # canonical
kubectl -n istio-ingress get pods              # ingress gateway
kubectl -n istio-ingress-external get pods     # external ingress
kubectl -n istio-system get cm istio-<rev> -o yaml   # mesh config

# Available revisions (canary upgrade pattern)
istioctl x revision list
```

## Configuration validation (run BEFORE apply)

```bash
# Lint a manifest for misconfigurations + deprecation warnings
istioctl analyze my-resource.yaml
istioctl analyze -n <ns>                       # namespace-wide
istioctl analyze --all-namespaces              # cluster-wide

# Common checks it catches:
# - Selector matches no pods
# - VirtualService routes to non-existent host
# - Gateway hostname not on any VS / HTTPRoute
# - Conflicting AuthorizationPolicy
# - Deprecated v1alpha3 fields
```

## Proxy configuration inspection

The single most-used command set. Lets you see what each proxy actually has loaded.

```bash
# Listeners (what ports + filters are configured)
istioctl proxy-config listeners <pod> -n <ns>
istioctl proxy-config listeners <pod> -n <ns> -o json   # full detail

# Routes (HTTP routing tables — virtual hosts, route rules)
istioctl proxy-config routes <pod> -n <ns>
istioctl proxy-config routes <pod> -n <ns> --name <route-name> -o json

# Clusters (upstream targets — what backend services this proxy can reach)
istioctl proxy-config clusters <pod> -n <ns>
istioctl proxy-config clusters <pod> -n <ns> --fqdn <svc>.<ns>.svc.cluster.local

# Endpoints (actual pod IPs behind each cluster)
istioctl proxy-config endpoints <pod> -n <ns>
istioctl proxy-config endpoints <pod> -n <ns> --cluster <cluster-name>

# Bootstrap (xDS connection config)
istioctl proxy-config bootstrap <pod> -n <ns>

# Secrets (mTLS certs the proxy has)
istioctl proxy-config secret <pod> -n <ns>

# RBAC (AuthorizationPolicy as Envoy sees it)
istioctl proxy-config rbac <pod> -n <ns>
```

For Waypoints in ambient mode: replace `<pod>` with the Waypoint deployment pod (`<ns>-waypoint-<hash>`).

For ztunnel: it's not Envoy, so `istioctl proxy-config` doesn't apply. Use `istioctl ztunnel-config`:

```bash
# ztunnel-specific config inspection (Ambient only)
istioctl ztunnel-config workloads
istioctl ztunnel-config workloads --node <node>
istioctl ztunnel-config services
istioctl ztunnel-config policies
istioctl ztunnel-config certificates
```

## Sync state (control plane → data plane)

```bash
# Are proxies in sync with istiod?
istioctl proxy-status                          # cluster-wide table
istioctl ps                                    # alias

# Output columns: NAME / CLUSTER / CDS / LDS / EDS / RDS / ECDS / ISTIOD
# All should be SYNCED. STALE = proxy hasn't picked up recent config change.
```

## Authorization policy debugging

```bash
# Enable RBAC debug logs on a specific Envoy
kubectl exec <pod> -n <ns> -- pilot-agent request POST '/logging?rbac=debug'
# Then tail logs
kubectl logs <pod> -n <ns> -f -c istio-proxy | grep rbac

# Reset to default level
kubectl exec <pod> -n <ns> -- pilot-agent request POST '/logging?rbac=info'
```

For Waypoint:
```bash
kubectl exec <waypoint-pod> -n <ns> -- pilot-agent request POST '/logging?rbac=debug'
```

## Wasm + plugin debugging

```bash
# See what Wasm plugins are programmed onto a proxy
istioctl proxy-config listeners <pod> -n <ns> -o json | \
  jq '.. | select(.name? | strings | contains("wasm"))'

# Enable Wasm debug logs
kubectl exec <pod> -n <ns> -- pilot-agent request POST '/logging?wasm=debug'
```

## TLS / mTLS debugging

```bash
# What identity does this pod present?
istioctl proxy-config secret <pod> -n <ns> -o json | \
  jq '.dynamicActiveSecrets[].secret.tlsCertificate'

# Test mTLS between two services
istioctl x authz check <pod> -n <ns>           # alpha — request-shape simulation

# Check what mTLS mode applies
istioctl x describe pod <pod> -n <ns>          # summary including mTLS state
```

## Authentication debug

```bash
# What auth policies apply to this pod
istioctl x describe pod <pod> -n <ns>

# Show effective auth (request + peer)
istioctl x authz check <pod> -n <ns>
```

## Gateway API specific

```bash
# Which Gateways exist
kubectl get gateway.networking.k8s.io -A

# HTTPRoutes and their parent attachments
kubectl get httproute -A
kubectl describe httproute <name> -n <ns>
# → "Parents:" section shows attachment status (Accepted: True/False)

# Verify CRD bundle version
kubectl get crd httproutes.gateway.networking.k8s.io \
  -o jsonpath='{.metadata.annotations.gateway\.networking\.k8s\.io/bundle-version}{"\n"}{.metadata.annotations.gateway\.networking\.k8s\.io/channel}{"\n"}'
```

## Common diagnosis flows

### "My request is getting 403"

1. `istioctl x describe pod <dest-pod> -n <ns>` — what policies apply?
2. `istioctl proxy-config rbac <dest-pod> -n <ns>` — show effective RBAC config
3. Enable `rbac=debug` on the proxy enforcing it (sidecar OR Waypoint)
4. Send a request, read the rbac log line — shows which rule denied

### "My request is getting 503 / no healthy upstream"

1. `istioctl proxy-config clusters <src-pod> -n <ns> --fqdn <dest-svc>` — does the cluster exist with healthy endpoints?
2. `istioctl proxy-config endpoints <src-pod> -n <ns> --cluster <cluster-name>` — endpoints status
3. `kubectl get pods -n <dest-ns> -l <selector>` — are dest pods actually running and ready?
4. If outlier detection: `kubectl exec <dest-pod> ... | grep -i outlier` for ejection events

### "HTTPRoute not routing"

1. `kubectl describe httproute <name> -n <ns>` — Parents section: is `Accepted: True`?
2. If Accepted: False: read the message — usually hostname mismatch or Gateway listener mismatch
3. `istioctl proxy-config routes <gateway-pod>` — does the route appear in the gateway?
4. If not, `istioctl proxy-status` to confirm the gateway is in sync

### "Waypoint not enforcing L7 policy"

1. Is policy using `targetRefs`, not `selector`? See `details/security-policies.md`
2. `kubectl get gateway.networking.k8s.io -n <ns>` — Waypoint exists?
3. Service routed through Waypoint? Check namespace label or Service annotation
4. `istioctl proxy-config rbac <waypoint-pod>` — policy loaded?
5. Enable `rbac=debug` on Waypoint, send request, read log

## Performance + tuning

```bash
# Memory / CPU on istiod
kubectl -n istio-system top pod -l app=istiod

# Pilot push counts
kubectl -n istio-system port-forward deploy/istiod 15014:15014
curl http://localhost:15014/debug/syncz | jq

# Envoy request stats on a proxy
kubectl exec <pod> -n <ns> -c istio-proxy -- pilot-agent request GET '/stats/prometheus' | grep upstream
```

## Cluster-wide health one-liner

```bash
istioctl analyze --all-namespaces && \
  istioctl proxy-status && \
  echo "OK"
```

If anything fails or shows STALE/error → drill into the offending resource.

## Sources

- [Istio CLI reference (`istioctl`)](https://istio.io/latest/docs/reference/commands/istioctl/)
- [Istio diagnostic tools](https://istio.io/latest/docs/ops/diagnostic-tools/)
- [Troubleshooting Istio Ambient (wiki)](https://github.com/istio/istio/wiki/Troubleshooting-Istio-Ambient)
