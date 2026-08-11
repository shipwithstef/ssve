# Runners

> GitHub-hosted and self-hosted runner specifications, labels, and pricing.

## Mechanism

A **runner** is a server that executes workflow jobs. GitHub Actions supports two runner types:

1. **GitHub-hosted runners** — VMs provisioned and maintained by GitHub.
2. **Self-hosted runners** — Servers you provision, register, and maintain.

## GitHub-Hosted Runners

### Standard Runner Labels

| Label | OS | Architecture | vCPUs | Memory | Disk | Price Multiplier |
|-------|-----|-------------|-------|--------|------|-----------------|
| `ubuntu-latest` | Ubuntu Linux | x64 | 4 | 16 GB | 14 GB SSD | 1x |
| `ubuntu-24.04` | Ubuntu 24.04 | x64 | 4 | 16 GB | 14 GB SSD | 1x |
| `ubuntu-22.04` | Ubuntu 22.04 | x64 | 4 | 16 GB | 14 GB SSD | 1x |
| `ubuntu-20.04` | Ubuntu 20.04 | x64 | 2 | 7 GB | 14 GB SSD | 1x |
| `windows-latest` | Windows Server | x64 | 4 | 16 GB | 14 GB SSD | 2x |
| `windows-2025` | Windows Server 2025 | x64 | 4 | 16 GB | 14 GB SSD | 2x |
| `windows-2022` | Windows Server 2022 | x64 | 4 | 16 GB | 14 GB SSD | 2x |
| `windows-2019` | Windows Server 2019 | x64 | 2 | 7 GB | 14 GB SSD | 2x |
| `macos-latest` | macOS | arm64 (Apple Silicon) | 3 | 7 GB | 14 GB SSD | 10x |
| `macos-15` | macOS 15 | arm64 | 3 | 7 GB | 14 GB SSD | 10x |
| `macos-14` | macOS 14 | arm64 | 3 | 7 GB | 14 GB SSD | 10x |
| `macos-13` | macOS 13 | x64 (Intel) | 4 | 14 GB | 14 GB SSD | 10x |
| `macos-12` [DEPRECATED] | macOS 12 | x64 | 3 | 14 GB | 14 GB SSD | 10x |

**Note:** `ubuntu-latest` currently resolves to `ubuntu-24.04` [VERIFY: check current mapping].

### Single-CPU Runners

Single-CPU runners (1 vCPU, 2 GB RAM) run in containers on shared VMs. Available for Linux only. These are lower-cost options for lightweight tasks.

### Larger Runners

Available on GitHub Team and GitHub Enterprise Cloud plans:

| Size | vCPUs | Memory | Storage |
|------|-------|--------|---------|
| 2-core | 2 | 8 GB | 75 GB SSD |
| 4-core | 4 | 16 GB | 150 GB SSD |
| 8-core | 8 | 32 GB | 300 GB SSD |
| 16-core | 16 | 64 GB | 600 GB SSD |
| 32-core | 32 | 128 GB | 1200 GB SSD |
| 64-core | 64 | 256 GB | 2040 GB SSD |

Larger runners also support:
- **GPU runners** — For ML/AI workloads [VERIFY: availability]
- **Custom images** — Build your own VM images from GitHub-provided base images
- **Static IP addresses** — Predictable egress IP ranges
- **Autoscaling** — Dynamic provisioning based on queue depth

### Runner Images

GitHub maintains runner images in the `actions/runner-images` repository. Images are updated weekly. Each workflow run log includes a link to the exact software installed on that runner.

### Cloud Hosts

- **Linux and Windows runners** — Hosted on Microsoft Azure VMs.
- **macOS runners** — Hosted in Azure data centers on Apple hardware.
- Inbound ICMP is blocked on Azure VMs (ping/traceroute may not work).

## Self-Hosted Runners

### Setup

1. Install the runner application on your server (Linux, Windows, macOS).
2. Generate a registration token from repository/organization/enterprise settings.
3. Run `./config.sh --url <repo-url> --token <token>`.
4. Start the runner service: `./run.sh` (interactive) or `./svc.sh install` (service).

### Labels

Assign custom labels to self-hosted runners for targeting:

```yaml
runs-on: [self-hosted, linux, x64, gpu]
```

Jobs will be assigned to runners that match ALL specified labels.

### Runner Groups

Organize runners into groups with access policies:
- Repository-level runners
- Organization-level runners
- Enterprise-level runners (Enterprise Cloud)

Groups can restrict which repositories can use specific runners, improving security.

### Autoscaling

Use ephemeral runners (auto-remove after single job) with orchestration tools:
- **Kubernetes** — Actions Runner Controller (ARC)
- **AWS/Azure/GCP** — Auto-scaling VM scale sets
- **Docker** — Container-based ephemeral runners

### Self-Hosted Runner Limits

| Limit | Value |
|-------|-------|
| Max runners per repo | N/A (unlimited) |
| Max runners per org | N/A (unlimited) |
| Max workflow run time | 35 days |
| Max job queue time | 24 hours |

## Runner Context

```yaml
runner.name      # Runner name
runner.os        # Linux, Windows, or macOS
runner.arch      # X86, X64, ARM, ARM64
runner.temp      # Temp directory
runner.tool_cache # Preinstalled tools directory
runner.debug     # 1 if debug logging enabled
runner.environment # github-hosted or self-hosted
```

## Pricing by OS (2025)

| Plan | Linux | Windows | macOS |
|------|-------|---------|-------|
| Free | 2,000 min/month | 2,000 min/month (2x rate) | 2,000 min/month (10x rate) |
| Pro/Team | 3,000 min/month | 3,000 min/month (2x rate) | 3,000 min/month (10x rate) |
| Enterprise | 50,000 min/month | 50,000 min/month (2x rate) | 50,000 min/month (10x rate) |

**Multipliers:** Windows minutes count as 2x, macOS as 10x against your quota.

**Overage:** Approximately $0.008/minute for Linux, $0.016/minute for Windows, $0.08/minute for macOS on Free/Pro plans. [VERIFY: exact 2025 rates]

## Analysis

### `runs-on` Targeting Strategies

```yaml
# Single label
runs-on: ubuntu-latest

# Multiple labels (AND match for self-hosted)
runs-on: [self-hosted, linux, x64]

# Matrix runner selection
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
runs-on: ${{ matrix.os }}
```

### macOS Pricing Gotcha

macOS runners cost **10x** the minute rate. A 10-minute macOS job consumes 100 minutes from your quota. For cross-platform builds, consider:
- Running Linux tests first (cheap)
- Only running macOS for platform-specific validation
- Using self-hosted macOS runners for high-volume mac builds

### `ubuntu-latest` Drift

The `ubuntu-latest` label migrates to newer Ubuntu versions over time. When GitHub updates the label:
- Existing workflows may break if they depend on specific Ubuntu versions
- Best practice: Pin to a specific version (`ubuntu-22.04`) for reproducibility
- Use `ubuntu-latest` only if you actively maintain compatibility

### Self-Hosted Security Considerations

- Self-hosted runners should be treated as **semi-trusted** — they persist state between jobs.
- Use **ephemeral runners** (one job per runner instance) for untrusted code.
- Never use self-hosted runners for public repositories without strict isolation.
- Runner registration tokens expire after 1 hour.

### Workflow Continuity

- If GitHub Actions is unavailable, workflow runs are discarded if not queued within **30 minutes**.
- Once queued, if not picked up by a runner within **45 minutes**, the run is discarded.

## Layer 4 Pointers

- [Workflow Syntax](syntax.md) — `runs-on` configuration, container syntax.
- [Security & Authentication](security-auth.md) — Runner group access policies, ephemeral runner patterns.
- [Advanced Features](advanced-features.md) — Matrix strategies with runner selection.
