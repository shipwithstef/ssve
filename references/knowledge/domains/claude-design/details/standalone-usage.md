# Claude Design: Standalone vs. Containerized (Layer 3)

Absolute domain expertise on running the April 2026 Claude Design stack in both isolated Docker environments and native "standalone" macOS/Linux setups.

## 1. Native Installation (Standalone)
For users bypassing Docker, Claude Design & Code are deployed as native binaries with automatic background updates.
- **Install Command**: `curl -fsSL https://claude.ai/install.sh | bash`
- **Supported OS**: macOS 13.0+ (Seatbelt native), Ubuntu 20.04+ (Bubblewrap/Seccomp), WSL2.
- **Verification**: `claude doctor` ensures all native dependencies (ripgrep, git, OS-level sandbox helpers) are present.

## 2. Design-to-Code Handoff Protocol
The "Standalone" path uses the **Handoff Bundle Protocol** to bridge the web interface (`claude.ai/design`) and the local dev environment.
- **Live Canvas Sync**: Finalizing a design generates a unique **Handoff ID** or a local `.claude/handoff/` package.
- **Local Implementation**: The native agent (CLI or Desktop App) reads this bundle (Tokens, Component Specs, Interactive States) and modifies local files directly.
- **Integrated Preview**: The Claude Desktop App includes a built-in browser pane locked to `localhost`. It provides real-time feedback as the agent applies design changes to the local dev server.

## 3. Native Security & Isolation
Standalone isolation leverages kernel-level primitives instead of VM boundaries.
- **macOS (Seatbelt)**: Uses `sandbox-exec` profiles to restrict write access to the CWD and block access to sensitive paths (`~/.ssh`, `~/.env` outside the project).
- **Linux (Seccomp/Bubblewrap)**: Uses `bwrap` namespaces to isolate the filesystem and Seccomp to filter dangerous system calls.
- **Network Proxy**: All egress from the native sandbox is proxied. Attempts to reach non-localhost domains trigger a user permission prompt.

## 4. Operational Comparison

| Feature | Standalone (Native) | Containerized (Docker) |
| :--- | :--- | :--- |
| **Performance** | High (Direct I/O) | Medium (Volume Overhead) |
| **Isolation** | OS Sandbox (Seatbelt/Seccomp) | Namespace/VM Boundary |
| **Network** | Proxied + User Prompt | Virtual Network Interface |
| **UX** | Instant launch, native PATH | Context setup required |
| **Verification** | Verification Ladder (V1-V2) | Same |

## 5. Integration Notes for SVC
- **Standalone Verification**: Use `claude --dangerously-skip-permissions` only within the **Native Sandbox** for trusted internal repo tasks to maximize speed.
- **Handoff Automation**: Map the "Handoff Bundle" contents directly into the SVC `design-ui` lane to skip manual spec authoring.
- **Preview Audits**: Utilize the integrated `localhost` preview in `track-visuals` to capture regression baselines without external browser dependencies.
