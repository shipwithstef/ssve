# Backstage — Capabilities

Analyzed: 2026-05-04
Source: WebFetch (github.com/backstage/charts/releases) + WebSearch (Backstage release notes 2026) + training data + cross-reference to live legacy deployment under `new-devops-platform` WI-014

## 1. Space + major players

Backstage is an **internal developer portal (IDP)** framework — open-source, originally built and open-sourced by Spotify (March 2020), now a CNCF Incubating project. It centralizes service catalogs, software templates, technical documentation (TechDocs), and plugin-based integrations into one developer-facing UI. It is the dominant OSS option in the IDP space.

**Major players in the IDP space:**
- **Backstage** (Spotify, OSS, CNCF Incubating) — the framework most large platform teams build on
- **Spotify Portal for Backstage** — Spotify's commercial managed/hosted Backstage with their proprietary plugins
- **Roadie** — managed Backstage (SaaS); active publisher of community guidance and weekly newsletter
- **Port** — proprietary IDP (no Backstage); strong in compliance/scorecards
- **Cortex** — proprietary IDP; service-catalog-first
- **OpsLevel** — proprietary IDP; reliability scorecards
- **Configure8 / Mia-Platform Console / Humanitec** — adjacent IDP-platform vendors

## 2. Version timeline

| Track | Latest as of 2026-05-04 | Status | Notes |
|---|---|---|---|
| **Backstage framework** (`@backstage/*` packages) | v1.50.0 (April 2026) | current | weekly cadence; New Frontend System is default since v1.49.0 (March 2026); New Backend System stable 1.0 since v1.31.0 |
| **Helm chart** `backstage/backstage` | **2.7.0** (4 May 2026) | current | Adds Deployment update strategy config |
| Helm chart prior | 2.6.3 (9 Nov 2025) | maintenance | Removed default `imagePullPolicy`; what most production deployments are running |
| Helm chart older | 2.6.0 (9 Jul 2025) | superseded | Added HPA autoscaling support |

**Notable framework pivots:**
- **v1.49.0 (March 2026)** — New Frontend System becomes default for `create-app`. `--next` flag → `--legacy`. Major BUI (Backstage UI) breaking changes; entity cards migrated from MUI to BUI.
- **v1.42.0** — New Frontend System APIs stabilized; legacy backend system removed; Rspack default bundler (WebPack via `LEGACY_WEBPACK_BUILD` flag).
- **v1.31.0** — New Backend System stable 1.0.

**Breaking changes to watch:**
- 2.6.3 chart removed default `imagePullPolicy` → can affect deployments relying on old chart-default pull behavior.
- Framework 1.42+ removed `@backstage/backend-common` and legacy backend exports.
- Framework 1.49+ removed CSS tokens and deprecated types from BUI.

## 3. Channel / variant matrix

| Variant | Source | License | When to use |
|---|---|---|---|
| **OSS Backstage** | github.com/backstage/backstage | Apache-2.0 | self-hosted, full control, no managed support |
| **OSS Helm chart** | github.com/backstage/charts | Apache-2.0 | k8s deployments — current option for most prod |
| **Spotify Portal for Backstage** | spotify.com (commercial) | proprietary tier on top of OSS | want managed + Spotify's premium plugins (Soundcheck, RBAC, Skill Exchange, Insights) |
| **Roadie** | roadie.io (commercial) | SaaS | want hosted Backstage without ops |
| **Backstage Demo** | demo.backstage.io | Apache-2.0 | reference UX |
| **Custom build** | derived from `@backstage/create-app` template | Apache-2.0 | most teams: fork + add custom plugins |
| **Demo image** | `ghcr.io/backstage/backstage:latest` | upstream demo | quick chart bring-up; **NOT for production** — uses ephemeral demo data, no custom plugins |

**Important:** the demo image (`ghcr.io/backstage/backstage:latest`) is what the Helm chart points at by default. It boots a demo instance with example data. Real deployments build their own image from a `backstage/backstage:create-app`-scaffolded repo and push to their own registry. Running the demo image in production produces a partly-broken portal (no real plugins wired, no custom auth, etc.).

## 4. Capabilities today (current stable version)

**Catalog (Software Catalog)**
- Entity kinds: `Component`, `API`, `System`, `Domain`, `Resource`, `Group`, `User`, `Location`, `Template`
- Discovery via:
  - **URL locations** — list specific `catalog-info.yaml` files in `app-config.yaml` `catalog.locations`
  - **GitHub Discovery / GithubEntityProvider** — auto-discover all `catalog-info.yaml` across an org
  - **GithubOrgEntityProvider / GithubMultiOrgEntityProvider** — sync GitHub orgs/teams into Group/User entities
  - **GitlabDiscovery** / **BitbucketDiscovery** / **AzureDevOpsDiscovery** — equivalents
  - **Scaffolder-driven registration** — templates auto-register newly created services
- Owner resolution via `Group` + `User` entities (or external IdP provider)

**Auth providers** (production-grade, in core)
- GitHub OAuth (most common)
- GitLab OAuth
- Google OAuth
- Microsoft / Azure AD / Entra ID OAuth
- OIDC (generic — Okta, Auth0, Keycloak, Cognito, etc.)
- SAML (community plugin)
- Atlassian (Bitbucket Cloud / Jira)
- AWS ALB / OAuth Proxy (header-based, for behind-proxy deployments)
- Guest (dev/demo only)

Sign-in resolvers map auth identity → catalog `User` entity (`emailMatchingUserEntityProfileEmail`, `usernameMatchingUserEntityName`, custom).

**TechDocs**
- MkDocs-based documentation-as-code per service (each repo has a `mkdocs.yml`)
- Build modes: `local` (built on the Backstage backend on demand), `external` (CI builds, publishes to S3/GCS/Azure Blob), `recommended:external + S3`
- Plugin renders docs from a publisher (S3 / GCS / Azure / OpenStack Swift / local filesystem)

**Software Templates (Scaffolder)**
- Template entities define skeleton parameters + steps (fetch + publish + register)
- Used to bootstrap new services with org-standard structure, CI, README, owner annotation, ArgoCD app, etc.

**Kubernetes plugin**
- Connects to one or more clusters via:
  - in-cluster ServiceAccount (when Backstage runs inside the cluster)
  - kubeconfig file
  - AWS EKS auth (IRSA + sigs.k8s.io/aws-iam-authenticator)
  - GKE auth
  - per-cluster bearer token
- Renders pods/services/deployments/ingresses/HPAs scoped by `backstage.io/kubernetes-id` label or selector annotation

**ArgoCD plugin** (Roadie community, `@roadiehq/backstage-plugin-argo-cd`)
- Per-instance config under `argocd.appLocatorMethods` in `app-config.yaml`
- Renders sync status, health, history per service via annotations `argocd/app-name` + `argocd/app-instance`
- Multi-cluster: list each ArgoCD instance with its API URL + token

**Search**
- Default backend: Lunr (in-memory, fine to ~10K entities)
- Production backends: Elasticsearch, PostgreSQL full-text, OpenSearch
- Indexes catalog + TechDocs + custom collators

**Other plugins worth knowing**
- GitHub Actions (`@backstage-community/plugin-github-actions`) — workflow status per service
- PagerDuty (`@pagerduty/backstage-plugin`) — on-call + incidents
- Grafana (`@k-phoen/backstage-plugin-grafana`) — dashboard links per service
- API Docs — render OpenAPI/AsyncAPI/GraphQL specs
- Tech Radar — adopt/trial/assess/hold technology radar
- Catalog Graph — dependency visualization
- Cost Insights — AWS/GCP/GitHub spend per team

## 5. Capabilities experimental / not yet stable

- **AI Context** for Backstage — surfaced in v1.49+; lets LLMs query catalog/TechDocs (Roadie tracking it as preview)
- **Frontend BUI** (Backstage UI) — replaces MUI v4/v5; some entity cards still being migrated as of 1.49
- **Rspack** as default bundler (1.42+) — stable; legacy WebPack still available via `LEGACY_WEBPACK_BUILD`
- **OpenAPI client generation** — community-driven; not in core
- **Deno runtime support** — not yet; Node 20 LTS is the supported runtime as of 2026

## 6. What it CANNOT do

- **No native multi-tenant isolation.** One Backstage instance = one logical org. Multiple distinct customers/tenants require separate deployments.
- **No native fine-grained RBAC in OSS core.** Permission framework exists but is opt-in and requires per-plugin policy code. Spotify's commercial RBAC plugin or community alternatives fill this. (Without RBAC, every signed-in user sees the entire catalog.)
- **TechDocs cannot render arbitrary Markdown without `mkdocs.yml`.** It is opinionated to MkDocs.
- **Catalog cannot ingest non-YAML formats natively** — `catalog-info.yaml` is the contract.
- **No native cross-region active-active.** Backstage is a single-region, stateful (Postgres-backed) app. HA is replica-pod-level, not multi-region.
- **No built-in approval workflows.** Scaffolder runs templates as the signed-in user; multi-step approval requires custom backend plugin or external workflow tool (e.g. Argo Workflows, Temporal).
- **No native cost-attribution beyond the Cost Insights plugin's pre-built integrations.** Custom cloud-cost data requires writing a Cost Insights backend.

## 7. Architecture / topology

```
┌────────────────────────────────────────────────────────────────────┐
│  Browser (signed-in dev)                                           │
│   └─ React frontend (BUI/MUI mix, plugin-based composition)        │
└─────────────────────────────┬──────────────────────────────────────┘
                              │ HTTPS
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│  Backstage Backend (Node.js 20 LTS, port 7007)                     │
│  ├─ /api/catalog       → Catalog plugin (entity CRUD + discovery)  │
│  ├─ /api/auth/*        → Auth plugin (OAuth callbacks, sessions)   │
│  ├─ /api/scaffolder    → Software Templates                        │
│  ├─ /api/techdocs      → MkDocs renderer + S3 publisher            │
│  ├─ /api/search        → Search collator (Lunr / ES / PG-FTS)      │
│  ├─ /api/proxy/*       → Generic proxy to external APIs            │
│  ├─ /api/permission    → Permission framework (opt-in)             │
│  └─ Plugin backends    → kubernetes / argocd / github-actions /…   │
└──┬────────────────────┬──────────────────────────────────┬─────────┘
   │                    │                                  │
   ▼                    ▼                                  ▼
┌──────────┐   ┌──────────────────────┐    ┌─────────────────────────┐
│ Postgres │   │ External Integrations │    │ Object Storage         │
│ catalog  │   │  GitHub / GitLab API  │    │ (S3 / GCS) for          │
│ scaffold │   │  ArgoCD / K8s APIs    │    │ TechDocs publisher     │
│ search   │   │  Grafana / PagerDuty  │    │                         │
└──────────┘   └──────────────────────┘    └─────────────────────────┘
```

Frontend + backend ship as one process by default in production builds (`backstage:dist` Docker image bundles the React build into the Express app), but separate dev servers during development.

## 8. Integration points

| Adjacent system | Interaction |
|---|---|
| **GitHub** | Auth (OAuth), catalog discovery, PR/issue/Actions plugins, scaffolder push targets, TechDocs source |
| **ArgoCD** | per-instance API token + URL, annotation-based linking, sync state rendering |
| **Kubernetes** | per-cluster auth (IRSA / SA token / kubeconfig), scoped resource queries via label selectors |
| **Vault / ESO / SOPS** | inject `app-config.yaml` secrets via env vars (`${VAR_NAME}` interpolation in app-config) — Backstage doesn't have a native secret store integration, it consumes env vars |
| **External Secrets Operator (ESO)** | most common production secret-injection: `ExternalSecret` → k8s `Secret` → mounted as env via Helm `extraEnvVarsSecrets` |
| **AVP (ArgoCD Vault Plugin)** | legacy pattern — AVP-templated `Secret` manifest with `<placeholder>` values pulled from Vault at sync time. Use `stringData:` not `data:` (AVP injects plain text). Superseded by ESO+JWT for new deployments. |
| **Postgres** | required (catalog/scaffolder/search state). In-cluster Bitnami subchart OR external (RDS, CloudSQL, Azure Database). Schema is auto-managed by Backstage. |
| **OpenTelemetry / Prometheus** | Backstage exports metrics via `/metrics` (when enabled). Logs are JSON to stdout. |
| **Ingress** | one HTTPS hostname; both `/` (frontend) and `/api/*` (backend) served by same process. Ingress class typically `nginx`. |

## 9. Migration patterns

| Migration | Recipe |
|---|---|
| Demo image → custom image | `npx @backstage/create-app` to scaffold; `yarn install && yarn tsc && yarn build:backend`; build Docker via `packages/backend/Dockerfile`; push to your registry; set `backstage.image` in Helm values |
| URL locations → GithubEntityProvider | Add `integrations.github` token + `catalog.providers.github.<id>` config block; remove URL `Location` entries; configure schedule (default 30 min poll) |
| Old backend → new backend system (`backendSystem`) | Replace `packages/backend/src/index.ts` with `createBackend()` + `backend.add(...)` calls; migrate plugins one at a time; works alongside legacy until v1.42, removed thereafter |
| Old frontend → New Frontend System | `--next` mode (1.42+) → `--legacy` flag (1.49+); declarative plugin integration replaces App.tsx route registration; entity content via `EntityContentBlueprint`; pages via `PageBlueprint` |
| In-cluster Postgres → external (RDS) | Set `postgresql.enabled: false` in Helm values; provide `appConfig.backend.database.connection.{host,port,user,password,database}` via env vars from a Secret; verify schema migration runs cleanly on startup |
| AVP → ESO | Replace AVP-templated Secret manifests with `ExternalSecret` resources targeting an `ExternalSecretStore`; values stored plain (not base64) in Vault |
| Lunr search → Elasticsearch | Add `search.elasticsearch.{node,auth}` to app-config; replace `search-backend-module-pg` or default Lunr collator with `@backstage/plugin-search-backend-module-elasticsearch` |

## 10. Common pitfalls (verified failure modes)

- **Demo image in production.** `ghcr.io/backstage/backstage:latest` ships Spotify's demo data and zero custom plugins. Mistake observed in EzBob legacy: demo image deployed with real catalog config, leading to half-broken state.
- **Catalog URL points to non-existent file.** Backstage logs `Unable to read url, no matching files found for <url>` as WARN (not ERROR) and continues with partial catalog. Easy to miss. **Always grep the app log for `Unable to read url` post-deploy.** (See `new-devops-platform` WI-014 G0 baseline.)
- **`gp2` StorageClass on EKS.** Default `gp2` uses deprecated in-tree provisioner; new EBS CSI nodes can fail to bind. Always use `gp3` (or whatever the cluster's default-marked CSI class is).
- **Postgres readiness race.** Backstage pod's readiness probe returns 503 if Postgres isn't ready yet. Resolved by pod-restart after PG becomes ready, or by adding `wait-for-postgres` init container.
- **`data:` vs `stringData:` in AVP-templated Secrets.** AVP injects plain text, so using `data:` produces base64-decode errors. Always `stringData:`.
- **Ingress host mismatch with `app.baseUrl` / `backend.baseUrl`.** OAuth callbacks sent to wrong origin → login loops. `app.baseUrl` and `backend.baseUrl` MUST match the public ingress host exactly (scheme + host).
- **GitHub OAuth callback URL.** Must be `https://<host>/api/auth/github/handler/frame`. The OAuth App in GitHub must be registered with that exact URL.
- **GitHub PAT scope for org catalog discovery.** Needs `repo` (private repos) + `read:org` (Group/User entity discovery). `read:user` is insufficient.
- **Helm chart container override loses default command.** When overriding any field in `template.spec.containers[0]`, the chart's default `command` is replaced. Add explicit `command:` if you override anything in the container spec.
- **TechDocs `local` builder requires MkDocs + plugins on the Backstage container.** If using `local` mode, build a custom image with `mkdocs-techdocs-core`. Otherwise use `external` mode (CI builds + S3 publish).
- **Permission framework is opt-in.** OSS Backstage without permission policies = every signed-in user sees everything. For multi-team deployments, either install Spotify RBAC plugin (commercial) or write permission policies (Node code, not config).
- **AppProject destination filter.** ArgoCD AppProject must include `backstage` namespace in `destinations`. `kubectl patch` survives only until next ArgoCD sync — fix in gitops.

## 11. Re-research triggers

Refresh this domain knowledge when ANY of:

- New Helm chart minor version released (`backstage/backstage` 2.x → 2.y) — check release notes for breaking changes
- Backstage framework crosses a major (1.x → 2.x) — full review of new vs old systems
- New auth provider becomes commonly required (e.g. GitHub Enterprise, new IdP)
- AVP or ESO patterns change at the org level
- Major plugin API breaking change announced by a plugin we use (especially Roadie ArgoCD, GitHub Actions community plugin)
- 30+ days elapsed (G5 freshness gate)
- Spotify announces a major Portal feature that diverges from OSS Backstage substantially

## 12. Sources

- [Backstage Helm chart releases](https://github.com/backstage/charts/releases) — fetched 2026-05-04 for version timeline
- [Backstage v1.49.0 release notes](https://backstage.io/docs/releases/v1.49.0/) — New Frontend System default
- [Backstage v1.42.0 release notes](https://backstage.io/docs/releases/v1.42.0/) — New Frontend System APIs stable, legacy backend removed
- [Backstage GitHub releases](https://github.com/backstage/backstage/releases) — framework version timeline
- [Roadie Backstage Weekly #126](https://roadie.io/backstage-weekly/126-new-frontend-system-default-ai-context-idp-architecture/) — current ecosystem state
- [Backstage docs root](https://backstage.io/docs) — capability + architecture overview
- [Backstage Helm chart on Artifact Hub](https://artifacthub.io/packages/helm/backstage/backstage) — chart metadata
- Cross-reference: live legacy Backstage deployment under `new-devops-platform` WI-014 G0 baseline (`docs/architecture/2026-05-04-wi-014-backstage-production-baseline.md`) — confirms chart 2.6.3 + AVP secret pattern + `ezbob-platform` catalog source
