# Istio Security Policies — RequestAuthentication + AuthorizationPolicy

**Last researched:** 2026-05-01
**Parent:** `../CAPABILITIES.md`
**APIs:** `security.istio.io/v1`

Covers JWT validation, authz rule shape, ambient-mode targeting differences from sidecar, and debugging.

## Mechanism

Two separate resources that compose:

1. **RequestAuthentication** — decodes + validates incoming JWTs against a JWKS endpoint. Populates `request.auth.principal` and `request.auth.claims[*]` for downstream authz. **Does not by itself reject anything** — invalid tokens are stripped, requests without tokens pass through.

2. **AuthorizationPolicy** — enforces `ALLOW`/`DENY`/`AUDIT`/`CUSTOM` rules. Combined with RequestAuthentication, makes JWTs effectively required (deny rule on `notRequestPrincipals: ["*"]`).

Both are enforced by:
- **Sidecar mode**: per-pod sidecar Envoy
- **Ambient mode L4**: ztunnel (only L4 attributes — source identity, destination port; cannot enforce L7 rules)
- **Ambient mode L7**: Waypoint Proxy (paths, methods, headers, request principals — only when traffic actually traverses the Waypoint)

## Targeting — sidecar vs ambient (CRITICAL distinction)

| Mode | Field | Effect |
|---|---|---|
| Sidecar | `selector.matchLabels: {app: foo}` | Sidecar of pods matching label enforces |
| Ambient — service-scoped | `targetRefs: [{kind: Service, name: foo, group: ""}]` | Waypoint enforces for traffic to that Service |
| Ambient — namespace-scoped | `targetRefs: [{group: gateway.networking.k8s.io, kind: Gateway, name: <ns>-waypoint}]` | Waypoint enforces for all traffic into the namespace |
| Ambient — L4-only attributes | `selector.matchLabels` (still works) | ztunnel enforces — but only L4 rules; L7 rules in the same policy fail safe to **DENY** |

**The footgun:** binding a policy with L7 attributes (paths, methods, JWT claims) via `selector` in ambient → Istio routes the policy to ztunnel → ztunnel can't enforce L7 → policy silently fails-safe to **DENY**. Result: every request 403s. Fix: use `targetRefs` to Service or Waypoint Gateway.

## RequestAuthentication shape

```yaml
apiVersion: security.istio.io/v1
kind: RequestAuthentication
metadata:
  name: jwt-auth
  namespace: my-app
spec:
  # Ambient — target Service or Waypoint Gateway:
  targetRefs:
    - kind: Service
      group: ""
      name: backend
    # OR namespace-wide via Waypoint:
    # - group: gateway.networking.k8s.io
    #   kind: Gateway
    #   name: <ns>-waypoint

  jwtRules:
    - issuer: "https://auth.example.com"
      jwksUri: "https://auth.example.com/.well-known/jwks.json"
      audiences: ["api.example.com"]      # optional — checks aud claim
      forwardOriginalToken: true          # forward to upstream
      fromHeaders:                         # where to extract token (default: Authorization)
        - name: X-JWT
          prefix: "Bearer "
      fromParams: ["token"]                # query param fallback
      outputClaimToHeaders:                # promote claim to header for upstream
        - header: X-User-Email
          claim: email
```

**Multiple issuers**: list multiple `jwtRules` entries. First match wins. If a token is missing or invalid, `request.auth.principal` is unset for that issuer.

## AuthorizationPolicy shape

```yaml
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata:
  name: require-jwt
  namespace: my-app
spec:
  targetRefs:
    - kind: Service
      group: ""
      name: backend

  action: ALLOW                           # ALLOW (default) | DENY | AUDIT | CUSTOM

  rules:
    - from:
        - source:
            requestPrincipals: ["https://auth.example.com/*"]
            # OR principals: ["cluster.local/ns/foo/sa/bar"]   # SPIFFE peer identity
            # OR namespaces: ["frontend"]
            # OR ipBlocks: ["10.0.0.0/8"]
      to:
        - operation:
            methods: ["GET", "POST"]
            paths: ["/api/*"]
            # OR hosts, ports, notMethods, notPaths
      when:
        - key: request.auth.claims[role]
          values: ["admin", "editor"]
        - key: request.auth.claims[groups]
          notValues: ["banned"]
```

**Common patterns:**

```yaml
# Require valid JWT (any issuer): deny if no request principal
spec:
  action: DENY
  rules:
    - from:
        - source:
            notRequestPrincipals: ["*"]

# Require specific role claim
spec:
  action: ALLOW
  rules:
    - from:
        - source:
            requestPrincipals: ["*"]
      when:
        - key: request.auth.claims[role]
          values: ["admin"]

# Mesh-only (deny external): require any peer principal
spec:
  action: ALLOW
  rules:
    - from:
        - source:
            principals: ["*"]
```

## Action precedence

When multiple AuthorizationPolicies match a request:

1. `CUSTOM` first (delegates to external authz like OPA, OAuth proxy)
2. `DENY` rules — if any match, deny
3. `ALLOW` rules — if at least one match, allow; otherwise deny (fail-safe)
4. `AUDIT` runs alongside (logs only, no enforcement)

If NO policy is bound to the workload at all → traffic is allowed (default-allow). To get default-deny, write an explicit `action: DENY` policy at namespace level with no `rules`.

## Known ambient-mode issues

### JWT not validated despite RequestAuthentication present

Common cause: traffic isn't actually traversing the Waypoint. Verify:

```bash
# Is there a Waypoint in the namespace?
kubectl get gateway.networking.k8s.io -n <ns>

# Is the Service routed through the Waypoint?
kubectl get service <svc> -n <ns> -o yaml | grep -A2 labels
# look for: istio.io/use-waypoint: <waypoint-name>
# or namespace-level: istio.io/dataplane-mode=ambient AND default Waypoint exists

# Is the policy using targetRefs (not selector)?
kubectl get requestauthentication -n <ns> -o yaml
```

If any of these fail, the policy is configured but inert. The same RequestAuthentication that works in sidecar mode often silently no-ops in ambient because of these targeting rules.

### Policy not loaded in Waypoint at all

```bash
# Get config dump of the Waypoint Envoy
istioctl proxy-config rbac <waypoint-pod> -n <ns>

# Enable RBAC debug logs
kubectl exec -n <ns> deploy/<waypoint> -- \
  pilot-agent request POST '/logging?rbac=debug'
kubectl logs -n <ns> deploy/<waypoint> -f | grep rbac
```

If you see no RBAC log entries for the request → policy isn't loaded. Check `istioctl analyze` for misconfiguration.

## Debugging checklist

1. **Waypoint deployed?** `kubectl get gateway.networking.k8s.io -n <ns>` — must show Waypoint
2. **Targeting correct?** Policy uses `targetRefs`, not `selector`
3. **Service uses Waypoint?** Either namespace label `istio.io/dataplane-mode=ambient` with a default Waypoint, OR Service has `istio.io/use-waypoint: <waypoint-name>` annotation
4. **Policy loaded in proxy?** `istioctl proxy-config rbac <waypoint-pod>`
5. **Traffic reaches Waypoint?** Enable Envoy access logs on the Waypoint, send a test request, confirm it appears
6. **JWT validated?** Inject a deliberately invalid token and verify the request is rejected
7. **Claim path correct?** `request.auth.claims[role]` matches actual JWT structure (top-level claim, not nested)

## Mesh-wide / namespace-wide patterns

```yaml
# Strict mesh authn (require mTLS for all east-west)
apiVersion: security.istio.io/v1
kind: PeerAuthentication
metadata:
  name: default
  namespace: istio-system     # mesh-wide
spec:
  mtls:
    mode: STRICT

# In ambient: STRICT is the default for east-west; PeerAuthentication is rarely needed
# unless you want to PERMIT plaintext for some workloads (downgrade)
```

## EzBob-specific note (project context)

Legacy + green clusters today: **0 AuthorizationPolicies, 0 RequestAuthentications, 0 PeerAuthentications**. Strict mTLS is automatic via Ambient default; no explicit policy resources exist. All east-west traffic is mTLS-authenticated but not authorisation-restricted — every namespace-mate can call every other.

This is a security gap — a separate workstream, not in cmp-common 0.5.0 scope. When opened: must use `targetRefs` (ambient pattern), not `selector`. CVE-2026-31837 (CVSS 8.7 JWKS bypass) directly affects RequestAuthentication's JWT validation path; gates Istio bump WI-009 before any new RequestAuthentication ships.

## Sources

- [Istio RequestAuthentication reference](https://istio.io/latest/docs/reference/config/security/request_authentication/)
- [Istio AuthorizationPolicy reference](https://istio.io/latest/docs/reference/config/security/authorization-policy/)
- [JWT Token authorization task](https://istio.io/latest/docs/tasks/security/authorization/authz-jwt/)
- [Ambient enforce auth policies](https://istio.io/latest/docs/ambient/getting-started/enforce-auth-policies/)
- [Debugging L7 policy enforcement in ambient](https://oneuptime.com/blog/post/2026-02-24-how-to-debug-l7-policy-enforcement-issues-in-ambient/view)
- [GitHub #53723 — Waypoint not applying AuthorizationPolicy with JWT rule](https://github.com/istio/istio/issues/53723)
- [GitHub #57620 — Ambient mode JWT auth with Auth0](https://github.com/istio/istio/issues/57620)
