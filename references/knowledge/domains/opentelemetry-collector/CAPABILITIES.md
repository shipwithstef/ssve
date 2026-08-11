# OpenTelemetry Collector — CAPABILITIES

`.version` reference: 2026-05-08
Scope: deployment patterns for OTel Collector in Kubernetes, with focus on cross-cluster agent → gateway transport. Reusable across projects.

---

## 1. Space + major players

OpenTelemetry Collector is the CNCF-graduated telemetry pipeline that ingests, processes, and exports logs/metrics/traces. Two distributions matter in practice:
- **`otel/opentelemetry-collector`** — core distribution
- **`otel/opentelemetry-collector-contrib`** — core + community receivers/exporters/processors (use this in production; `loadbalancingexporter`, `filelog`, `kubeletstats` are all here)

Helm chart: `opentelemetry-collector` (Grafana-charts maintained); operator: `opentelemetry-operator` for CRD-driven deployments.

Major hosted backends consuming Collector output: Grafana Cloud (Loki/Tempo/Mimir), Datadog, New Relic, Honeycomb, Lightstep, AWS CloudWatch, Google Cloud Trace, Splunk, Dynatrace.

---

## 2. Version timeline

| Version | Released | Status (2026-05-08) |
|---|---|---|
| `0.150.x` | ~2026-04 | Current stable |
| `0.149.x` | ~2026-03 | Maintenance |
| `0.148.x` | ~2026-02 | Maintenance |
| `0.110.x` | ~2025-09 | EOL (≥ N-3) — chart `0.110.0` matches this |

`grpc-go ≥ 1.67` ALPN enforcement (see §6 pitfalls) was introduced in OTel Collector versions tracking that grpc-go release; affects 0.111+ in practice. Pre-0.111 Collectors don't enforce ALPN client-side.

---

## 3. Channel / variant matrix

| Variant | Chart | When to use |
|---|---|---|
| `otelcol` | core | OTLP/Jaeger/Zipkin in/out only — no third-party exporters |
| **`otelcol-contrib`** | contrib | **Default for production** — includes filelog, kubeletstats, prometheus, loadbalancingexporter, all major backend exporters |
| `otelcol-k8s` | k8s-flavored | Same components as contrib but trimmed for k8s-only deployments |
| `otelcol-otlp` | otlp-only | Minimal image, OTLP-in/OTLP-out only — useful for sidecar pattern |

**Mode** (per-deployment, not per-image):
- `daemonset` — agent on every node, ingests local pod logs/metrics
- `deployment` — gateway, scaled horizontally, central processing
- `statefulset` — gateway with stable identity (rare; tail_sampling stickiness)
- `sidecar` — per-pod collector (managed by operator; rare)

---

## 4. Capabilities today (current stable: 0.150.x)

### Receivers (input)
- `otlp` — gRPC (4317) + HTTP (4318) push from instrumented apps
- `filelog` — tails container stdout/stderr from `/var/log/pods/` with `container` operator (containerd CRI parser); standard pattern for k8s log shipping
- `kubeletstats` — pulls node/pod/container metrics from Kubelet `/stats/summary`
- `prometheus` — scrapes Prometheus exposition format endpoints
- `k8s_cluster` — cluster-level metrics + entity events from k8s API
- `k8sobjects` — k8s API objects (events, etc.)
- `hostmetrics` — node CPU/memory/disk/network (requires `hostNetwork: true` on agent)
- `jaeger`, `zipkin` — legacy push protocols

### Processors (in-flight transformation)
- `k8sattributes` — enriches every signal with pod/namespace/node metadata; **mandatory in agent tier**
- `batch` — batches signals before export (reduces network calls)
- `memory_limiter` — backpressure when collector RAM is near limit
- `resource` — adds/upserts resource attributes (e.g., `k8s.cluster.name`)
- `tail_sampling` — full-trace sampling decision (gateway-only; needs all spans)
- `routing` — multi-tenant fan-out to different exporters
- `filter` — drop signals matching predicates
- `transform` — OTTL-based attribute manipulation

### Exporters (output)
- `otlp` — single-target gRPC/HTTP push
- **`loadbalancing`** — distributes by `traceID` or `service` across N backends; consistent hashing keeps spans of one trace on the same gateway pod (mandatory for tail_sampling on multi-replica gateways)
- `prometheusremotewrite` — Prometheus/Mimir/Cortex remote_write
- `loki`, `loki/grafana` — direct Loki HTTP push (deprecated; use `otlp/loki` via gateway instead)
- Vendor exporters: `datadogexporter`, `awsxray`, `awscloudwatchlogs`, `splunkhec`, etc.

### Extensions (auxiliary)
- `health_check` — `/health` endpoint
- `pprof`, `zpages` — debug endpoints
- `basicauth` — HTTP basic auth on receivers
- `oauth2clientcredentials` — outbound OAuth2

---

## 5. Capabilities experimental / not yet stable

- `loadbalancingexporter` k8s resolver: stable since 0.95+, faster topology updates than DNS resolver
- AWS Cloud Map resolver: stable in 0.140+
- Profiles signal: alpha (separate from logs/metrics/traces)
- Connectors (signal-to-signal transformation): stable, but specific connectors like `spanmetricsconnector` are GA in 0.130+

---

## 6. What it CANNOT do (forces workarounds)

- **Cannot route gRPC traces by `traceID` through nginx-ingress without breakage.** nginx-ingress' `backend-protocol: GRPC` mode terminates and re-establishes HTTP/2 on each request and round-robins across upstream pods — this destroys `tail_sampling` correctness because spans of one trace land on different gateway pods. nginx ALSO has known ALPN-advertising quirks across nginx versions that break grpc-go ≥1.67 client connections (manifests as `missing selected ALPN property`). **Workaround: use `loadbalancingexporter` with k8s/DNS resolver pointing at a headless gateway Service, OR use NLB TCP passthrough — never nginx-ingress for the agent → gateway hop.**
- **`tail_sampling` cannot run across multiple gateway replicas reliably without `loadbalancingexporter` upstream.** A trace's spans MUST land on the same gateway pod for tail_sampling to see the full trace. Round-robin LBs (Service ClusterIP without sticky session, nginx, ALB without target stickiness) break this.
- **Cannot scale a metrics-emitting Collector horizontally without violating single-writer principle.** Multiple collectors writing the same time series concurrently produces duplicate-sample errors in Prometheus/Mimir. Workaround: deduplication via `prometheusremotewrite` config OR shard by service.
- **Cannot ship OTLP via TLS to a backend that doesn't advertise `h2` ALPN** (grpc-go ≥1.67 enforces this). Workaround: NLB passthrough, direct gRPC over plain HTTP/2, or upgrade peer to advertise `h2`.

---

## 7. Architecture / topology

### Two-tier (agent + gateway) — **canonical pattern**

```
┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│ Workload cluster                │  │ Obs hub cluster                  │
│                                 │  │                                  │
│ App pods                        │  │ Gateway (Deployment, scaled)     │
│   ↓ OTLP gRPC 4317              │  │   - Receives from agent           │
│ Agent (DaemonSet, per node)     │  │   - Tail sampling                 │
│   - filelog (logs)              │  │   - Final processing              │
│   - kubeletstats (metrics)      │  │   - Export to backends            │
│   - otlp receiver (push)        │  │                                  │
│   - k8sattributes              ─┼──┼→ otlp/loki, prom remote_write,   │
│   - resource (cluster name)     │  │   tempo, datadog, etc.            │
│   - loadbalancing exporter      │  │                                  │
│     keyed on traceID            │  │                                  │
└─────────────────────────────────┘  └─────────────────────────────────┘
```

### Cross-cluster transport — three viable options

| Option | Path | gRPC behavior | Tail-sampling stickiness | When to use |
|---|---|---|---|---|
| **A. NLB TCP passthrough** | agent → cross-cluster internal NLB (Layer 4) → gateway pod IPs | Native HTTP/2 end-to-end, no proxy mediation | ❌ NLB hashes by 5-tuple; spans of one trace land on different gateway pods unless `loadbalancingexporter` runs upstream | Default for cross-cluster gRPC. Pair with `loadbalancingexporter` + k8s resolver pointing at the gateway's headless Service for stickiness. |
| **B. `loadbalancingexporter` + DNS/k8s resolver** | agent's LB exporter resolves gateway pod IPs directly; per-trace pod selection done client-side; one OTLP exporter per resolved IP | Native HTTP/2 to each pod | ✅ Trace ID hashing in agent guarantees same gateway pod | **Best for tail_sampling at scale.** Requires VPC peering with DNS forwarding so agent can resolve gateway pod IPs across clusters. |
| **C. nginx-ingress with `backend-protocol: GRPC`** | agent → ingress-nginx → gateway pods | nginx terminates TLS, re-establishes HTTP/2 to upstream; round-robins | ❌ Round-robin breaks tail_sampling | **Avoid for agent → gateway.** Use only for ad-hoc human-driven testing or non-trace signals where stickiness doesn't matter. ALPN issues common with grpc-go ≥1.67. |

### Decision rule

- **Tail sampling required?** → Option B (`loadbalancingexporter` + headless Service + k8s resolver). Cross-cluster needs VPC peering + CoreDNS forwarding for the gateway namespace.
- **Tail sampling NOT required (logs only, metrics only, head sampling)?** → Option A (NLB passthrough) is simpler.
- **Default if unsure** → Option B. It's the canonical pattern from OpenTelemetry's own docs and works for both single- and multi-cluster topologies.

---

## 8. Integration points

| Domain | Integration |
|---|---|
| **Istio / Gateway API** | OTel agent receives OTLP from istiod's tracing config; `k8sattributes` enriches with pod metadata. Tail-sampling on gateway side is the standard pattern for high-volume mesh telemetry. |
| **Argo Rollouts** | Rollouts emit metrics/events; agents pick them up via `k8s_cluster` receiver. Use `service.name` resource attribute to track per-rollout signals. |
| **Vault / ESO** | Backend credentials (Datadog API key, Grafana Cloud token) loaded as ExternalSecret → mounted to gateway pod. `oauth2clientcredentials` extension if token rotation is involved. |
| **Loki/Tempo/Mimir (Grafana stack)** | Gateway exports via `otlp/loki`, `otlp/tempo`, `prometheusremotewrite` to Mimir. Multi-tenancy via `X-Scope-OrgID` header (one orgID per tenant; `headers_setter` extension or `auth/headers` config sets it from k8s namespace). |
| **Datadog** | `datadogexporter` on gateway. `containerExclude` policy on Datadog Agent prevents double-shipping when ephemeral envs use OTel→Loki path AND production uses Datadog. |
| **AWS / GCP / Azure** | Vendor-specific exporters; resource detection processors stamp cloud attributes (`cloud.provider`, `cloud.region`) automatically. |

---

## 9. Migration patterns

### Promtail / Fluent-Bit → OTel filelog
- Configure `filelog` receiver with `include: /var/log/pods/*/*/*.log`
- Add `container` operator for CRI parsing
- Mount `/var/log/pods` and `/var/log/containers` as read-only hostPath
- Pipeline: `filelog → k8sattributes → batch → otlp/gateway`

### Single-replica gateway → multi-replica with tail_sampling
1. Switch gateway Service from ClusterIP to **headless** (`clusterIP: None`)
2. On agents: replace direct OTLP exporter with `loadbalancing` exporter pointing at the headless Service
3. RBAC: agent's ServiceAccount needs `get/list/watch` on `endpointslices` in the gateway namespace
4. If cross-cluster: VPC peering + CoreDNS forwarding so agent resolves gateway pod IPs

### Centralized obs (single hub) → per-cluster obs
Each workload cluster runs its own gateway + Loki/Tempo/Mimir. Cross-cluster correlation requires Grafana with multiple datasources (one per cluster). Cost of this option: N× storage. Justification only if:
- Per-cluster data residency required (regulatory)
- Network egress between clusters is cost-prohibitive
- Tenants don't need cross-cluster trace correlation

---

## 10. Common pitfalls (verified)

### `nginx.ingress.kubernetes.io/backend-protocol: GRPC` is NOT enough for stable cross-cluster gRPC
nginx-ingress' GRPC mode requires:
1. Annotation set on the Ingress resource
2. nginx-ingress controller built with HTTP/2 support (default in 1.x but verify)
3. TLS termination at ingress (gRPC-over-plain-HTTP/2 has spotty support)
4. Backend Service exposing port `4317` (OTLP gRPC)
5. Backend pod's TLS cert must include the Service hostname in SAN

Even with all 5, nginx round-robins per request — incompatible with tail_sampling.

### `grpc-go ≥1.67` ALPN enforcement breaks against ALPN-quirky proxies
Symptom in Collector logs: `transport: authentication handshake failed: credentials: cannot check peer: missing selected ALPN property`. Affects: nginx-ingress versions that don't advertise `h2` correctly to grpc-go clients (varies by nginx build, ingress-nginx chart version, OpenSSL build flags). **Fix:** use NLB passthrough or `loadbalancingexporter` direct-pod path. Do NOT downgrade Collector.

### `loadbalancingexporter` blocks all requests when backend list changes
Known issue (open as of `0.150.x`): when k8s resolver detects topology change, the shutdown of stale exporters can block the consume path. Mitigation: enable `retry_on_failure` + `sending_queue` on the OUTER `loadbalancing` block (not just the inner `otlp` template).

### Single-writer principle violation when scaling gateway with `prometheusremotewrite`
If 3 gateway replicas all write the same time series, Prometheus/Mimir rejects duplicates. **Fix:** shard by `service.name` via `routing` processor before `prometheusremotewrite` exporter, OR use a single replica for metrics pipeline (keep multi-replica only for traces/logs).

### Memory exhaustion under traffic spike
Default Collector image has no `memory_limiter`. Under load, OOM kills the pod, drops in-flight signals. **Always include `memory_limiter` as the first processor in every pipeline.**

### filelog receiver missing → no logs ingested even though OTLP push receivers are wired
The `filelog` receiver is what tails container stdout. Without it, only apps that explicitly push OTLP logs reach Loki. Agents shipping with `receivers: [otlp]` only are log-blind to non-instrumented workloads. **Always include `filelog` in agent log pipeline for k8s deployments.**

### `hostNetwork` is NOT required for filelog
A common misconception. filelog only needs read-only hostPath mounts of `/var/log/pods` and `/var/log/containers`. `hostNetwork: true` is only needed for `hostmetrics` receiver collecting node-level network stats.

---

## 11. Re-research triggers

Refresh this doc when ANY of:
- New OTel Collector minor version released (~monthly cadence) — check exporter/receiver maturity changes
- nginx-ingress major version bump (annotation contract may change)
- `loadbalancingexporter` resolver type added (e.g., Consul, etcd) — update §7 transport options
- grpc-go behavior changes around ALPN/HTTP-2/TLS
- AWS Load Balancer Controller adds gRPC-specific NLB modes
- New CNCF projects in obs space (e.g., Vector, Greptime, Quickwit) — update §1 players
- Project's own usage adds tail_sampling, tenant routing, or cloud-vendor exporters — re-validate §10 pitfalls

Re-research due if `.version` > 30 days from current date when reading this doc.

---

## 12. Sources

- [Agent-to-gateway deployment pattern — OpenTelemetry](https://opentelemetry.io/docs/collector/deploy/other/agent-to-gateway/)
- [Gateway deployment pattern — OpenTelemetry](https://opentelemetry.io/docs/collector/deployment/gateway/)
- [Exposing a Collector for cross-cluster communication — OpenTelemetry blog (2022)](https://opentelemetry.io/blog/2022/k8s-otel-expose/)
- [`loadbalancingexporter` README — opentelemetry-collector-contrib](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/exporter/loadbalancingexporter/README.md)
- [`loadbalancingexporter` k8s-resolver example](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/exporter/loadbalancingexporter/example/k8s-resolver/README.md)
- [Important Kubernetes components for the Collector — OpenTelemetry](https://opentelemetry.io/docs/platforms/kubernetes/collector/components/)
- [OpenTelemetry Operator for Kubernetes](https://opentelemetry.io/docs/platforms/kubernetes/operator/)
- [AWS NLB with Amazon EKS — deployment patterns](https://aws.amazon.com/blogs/industries/deployment-patterns-aws-network-load-balancer-with-amazon-eks-for-telco-workloads/)
- [AWS Load Balancer Controller — NLB annotations reference](https://kubernetes-sigs.github.io/aws-load-balancer-controller/v2.4/guide/service/nlb/)
- [`loadbalancingexporter` blocking on backend change — issue #8843](https://github.com/open-telemetry/opentelemetry-collector-contrib/issues/8843)
- [OTel Collector + grpc periodic reader insecure ignored — issue #12701](https://github.com/open-telemetry/opentelemetry-collector/issues/12701)
- [OpenTelemetry Collector vs agent — CNCF blog 2026](https://www.cncf.io/blog/2026/02/02/opentelemetry-collector-vs-agent-how-to-choose-the-right-telemetry-approach/)
