# Orchestrator OS — Azure Spot VM runbook

Use one Linux VM and one Unix account for persistent goals, linked worktrees,
worker transcripts and owner sessions. Commands below are templates to run on
your own infrastructure. Replace every placeholder; no particular subscription,
VM name, account, checkout, session ID or tailnet address is required.

## 1. Provision persistent infrastructure

Create an Azure Linux Spot VM with a **persistent managed OS disk** and eviction
policy **Deallocate**. Keep the checkout, home directory, state, worktrees and CLI
transcripts there, never on the temporary/resource disk. Choose region, size and
maximum price for your workload. Azure may evict the guest for capacity or price;
Deallocate preserves disk state but does not guarantee capacity for restart.
[Azure Spot policy](https://learn.microsoft.com/en-us/azure/virtual-machines/spot-vms)
and [CLI deployment](https://learn.microsoft.com/en-us/azure/virtual-machines/linux/spot-cli).

Example from a workstation with Azure CLI installed and signed in:

```bash
# Set these explicitly before running; image/size availability varies by region.
ORCH_RG='<resource-group>'
ORCH_REGION='<region>'
ORCH_VM='<vm-name>'
ORCH_SIZE='<vm-size>'
ORCH_IMAGE='<Linux-image-URN-or-alias>'
ORCH_LOGIN='<Unix-login>'
ORCH_MAX_PRICE='<approved-maximum-price-per-hour>'
az group create --name "$ORCH_RG" --location "$ORCH_REGION"
az vm create --resource-group "$ORCH_RG" --name "$ORCH_VM" \
  --image "$ORCH_IMAGE" --size "$ORCH_SIZE" --admin-username "$ORCH_LOGIN" \
  --generate-ssh-keys --priority Spot --eviction-policy Deallocate \
  --max-price "$ORCH_MAX_PRICE" --os-disk-delete-option Detach
```

Restrict SSH ingress to your administration source. The dashboard needs no public
inbound port. Keep an off-VM backup of durable state and transcripts with your own
retention policy. This release does not provision backup, capacity restart or
cross-VM fencing. Never boot two copies of the same active state disk.

On the guest, install Git, Bash, Python 3, Node.js 22+, util-linux (`flock`),
systemd user services, and the worker CLIs you intend to use. Install/authenticate
Claude Code under the same Unix account; verify local `claude --help` supports
`--bg`, `--session-id`, `--resume`, `--effort` and `--plugin-dir`. Authenticate
worker CLIs interactively; do not put credentials in registry files or reports.
Clone this repository to a permanent path and choose the reviewed revision:

```bash
ORCH_CHECKOUT="$HOME/src/ssve"
# Clone your chosen source into this path, then:
cd "$ORCH_CHECKOUT"
node --test scripts/orch/*.test.mjs
claude plugin validate mods/orchestrator-pane
claude plugin test mods/orchestrator-pane
```

CLI/schema/mock checks do not verify live subscription, trust, LOW retention or
native background restart ownership. Before enabling live sessions, use
`sessions.mjs verify-live <exact-binding-options> --dry-run` and perform one bounded
owner smoke. Record the actual ID/cwd/LOW, live attach/detach and native supervisor
restart exclusion. Without that evidence, preserve `needs_owner` and do not run
commands containing `--live-verified true`. Filesystem containment for bypass-mode
workers is also a separate release gate. See [runtime contracts](README.md).

## 2. Enable user startup and the private view

Install Tailscale on the guest and owner device using the official
[quickstart](https://tailscale.com/docs/how-to/quickstart); enroll both into your
tailnet. Configure [tailnet access policy](https://tailscale.com/docs/features/access-control)
to permit only intended owner devices/accounts to this VM's dashboard port.
The application provides a read-only view, without its own authentication layer.

Run as the guest account that owns the CLIs and persistent state:

```bash
sudo tailscale up
sudo loginctl enable-linger "$USER"
loginctl show-user "$USER" -p Linger --value   # expect yes
umask 077
mkdir -p "$HOME/.config/orch"
ORCH_TAILNET_IP=$(tailscale ip -4)
printf 'ORCH_SERVE_BIND=%s\nORCH_SERVE_PORT=8787\n' "$ORCH_TAILNET_IP" \
  > "$HOME/.config/orch/serve.env"
cd "$ORCH_CHECKOUT"
bash scripts/orch/install-units.sh
systemctl --user status orch-{recover,collect,serve,preempt}.service
curl --fail "http://$ORCH_TAILNET_IP:8787/status.json"
```

Linger starts the user's systemd manager at boot and retains it after logout.
[systemd loginctl](https://www.freedesktop.org/software/systemd/man/252/loginctl.html).
The installer prints the linger command and refuses when disabled; it never runs
sudo. It renders units with this checkout, Node binary and current CLI PATH.
Reinstall after moving the checkout or changing the installed CLI paths. Stop
previous manually launched collector/server processes before enabling the units.
Serve retries while its configured tailnet address is unavailable. If the address
changes, update `serve.env`, then restart `orch-serve.service`.

| User unit | Role |
|---|---|
| `orch-recover.service` | One boot reconciliation before collector/server; no Claude launch. |
| `orch-collect.service` | Sole atomic status writer, passive 60-second snapshots. |
| `orch-serve.service` | GET/HEAD only; static web + status on the chosen private address. |
| `orch-preempt.service` | Five-second IMDS checkpoint watcher; no model calls. |

The default state root is `$HOME/.local/state/orch`, config is `$HOME/.config/orch`.
For a custom `ORCH_STATE_DIR`, put the **same absolute path** in all four service
Environment drop-ins and in owner sessions; for custom `ORCH_CONFIG_DIR`, set it
on recovery and preempt too. `serve.env` remains the unit's explicitly configured
EnvironmentFile. Reload/restart the units after any environment change; never
split collector and dispatcher state roots.

## 3. Register goals and bind sessions

Prepare separate canonical Git planning worktrees with existing PLAN.md/BOARD.md
and disjoint worker worktrees. Use `goals.mjs`, the sole registry writer, with
`--expected-revision`; do not edit `goals.json` or unlink occupied locks. Register
goals, allocate explicit count caps and grant exact worker worktree/lane/path slots.
Null caps mean unknown and block admission. Bind parent first, then children, with
immutable contracts and exact full IDs/principals/generations. Follow the commands
in [README](README.md); registration alone neither starts sessions nor grants work.

If maintaining the legacy parent file, write only the registry's exact parent ID:

```bash
node scripts/orch/goals.mjs list
printf '%s\n' '<exact-bound-parent-id>' > "$HOME/.config/orch/parent-session"
```

A differing legacy ID holds parent commands; it never changes the registry.
Initial supervised launch is owner authorized through `sessions.mjs launch` only
after live transport evidence. Live launch remains disabled without explicit
`--live-verified true`. The owner can load the local pane with
`claude --plugin-dir "$ORCH_CHECKOUT/mods/orchestrator-pane"`, then `/orch`.

## 4. Recovery after eviction or reboot

Azure must start a deallocated VM before guest recovery can run. From your
workstation, when capacity is available:

```bash
az vm start --resource-group "$ORCH_RG" --name "$ORCH_VM"
```

Recovery takes a singleton lock; reconciles task/worktree/session ownership; then
reserves each eligible interrupted attempt durably before calling dispatch. It
requires changed boot identity, exact worker session and continuation, active
goal, matching generation/child contract, current worktree/lane grant and remaining
known count allowances. Dispatcher rechecks all grants under the registry lock.
The persisted parent grant permits bounded worker recovery while Claude is down;
ordinary new child dispatch still requires its acknowledged live Claude session.

Two invocations in one boot produce one worker resume. A task permits at most two
automatic resumes over its lifetime, even across boots; ambiguous launch consumes
its reservation and holds owner reconciliation. Paid/live, adopted/read-only,
unknown/stale/missing authority, unrecognized state, exhausted budget and busy
writer locks are held. Malformed task accounting holds admission rather than
assuming unused budget. No paid step or Claude session is automatically replayed.

```bash
systemctl --user status orch-{recover,collect,serve,preempt}.service
journalctl --user -u orch-recover.service -b --no-pager
# Safe to repeat deterministic recovery once after inspecting errors:
cd "$ORCH_CHECKOUT"
node scripts/orch/recover.mjs
node scripts/orch/collect.mjs
```

Inspect `recovery-<boot-id>.json` and `status.json`, or open
`http://<guest-tailnet-ip>:8787/` on the owner device. The preemption watcher fsyncs
local Preempt/Terminate markers and signals an immediate collector flush. Notice
is best effort; it does not approve events or guarantee completion before eviction.
[Azure Scheduled Events](https://learn.microsoft.com/en-us/azure/virtual-machines/linux/scheduled-events).

## 5. Owner attach / resume, parent first

Both surfaces show priority-ordered goals, including empty/paused/closed goals;
child state/health/LOW, needs_owner/event blockers, and count usage. Active worker
reservations are a subset of attempts used, not an additional charge. Claude
turn reservations and missing observations remain unknown. No subscription quota
or dollar conversion is claimed. A stale/error banner retains the last snapshot;
refresh before using a copied command.

Read `status.orchestrators[]` (and the SR1 receipt's `orchestrators[]`). Each entry
has the exact role/goal/full session ID/generation, cwd, immutable contract reference,
required local pane plugin path, attach and resume commands, `state: needs_owner`
and `auto_start: false`. Missing/mismatched bindings or nonce produce a reason and
no executable command. Recovery writes receipts only, never session/goal bindings.

1. Reconcile the native Claude background supervisor on this VM. A stale heartbeat
   does not prove a transcript stopped; do not start a second writer or copy an ID.
2. **Live transcript:** run the displayed `attach_command`. The helper checks exact
   current bindings and live identity, then runs bare `claude --resume <id>` with
   inherited terminal I/O in the recorded cwd. It passes no live configuration flags.
3. **Stopped transcript:** only after verifying native supervisor/transcript stopped
   and live transport gates, run the displayed `resume_command`. Its explicit
   `--native-stopped true --live-verified true` flags are owner assertions. It fences
   the held nonce/generation/session, persists a new nonce before invoking the same
   exact transcript, restores LOW, background mode and the local pane plugin, passes binding environment
   and contract brief, and requires a fresh native LOW/cwd/ID acknowledgement before
   admission. Missing acknowledgement is held, never blindly relaunched.
4. Resume **parent first**, read the SR1 receipt and registry without rebinding;
   reconcile decisions. Then attach/resume children in priority order. Children read
   existing attempts before dispatch; never duplicate a recovered worker.
5. Restore the bounded `events.mjs watch <exact-binding-options>` Monitor only for
   pending/actionable work, with the new recorded nonce after stopped resume. It
   expires after 5 minutes by default (maximum 30); no idle renewal or unattended
   plugin delivery is claimed. Reconcile/ack any unhandled event idempotently.

The stopped-session helper runs as the owner terminal's foreground supervisor;
keep that terminal alive (or use a persistent terminal). `/orch` previews/copies
commands only; it does not launch sessions, write state or submit prompts.
Remote Control is a separate owner chat surface on a live session: enable it only
after the native live gate; it neither renders `/orch` nor restores a dead VM.

## 6. Diagnose holds and maintain the installation

| Finding | Action |
|---|---|
| `needs_owner`, unknown native writer | Inspect native session, recorded nonce and process identities; no timeout-based replacement. |
| Parent-file mismatch | Verify registry binding; correct the compatibility file, then rerun recovery. No rebind from a legacy file. |
| Stale generation / overlapping grant | Parent drains old writers and uses explicit release/handoff before regrant. |
| Unknown/exhausted count budget | Parent reconciles counts and explicitly reallocates through `goals.mjs`; no retry loop or paid fallback. |
| Paid/live or ambiguous external outcome | Owner inspects existing result before any manual continuation; never auto-replay. |
| Stale view / corrupt status / disk full | Inspect collector journal, free space and readable state; preserve last valid snapshot, repair, rescan once. |
| Tailnet view unavailable | Check Tailscale identity/policy/address, `serve.env`, and serve journal; no public port workaround. |

Useful checks: `journalctl --user -u orch-collect.service -u orch-serve.service -b`,
`tailscale status`, `df -h`, `node scripts/orch/goals.mjs list`. Stop workers through
`dispatch.mjs stop <id>` only; it verifies ownership and teardown. Preserve attempt
history/transcripts. After updates, rerun Node/plugin checks and reinstall units
from the permanent checkout. Mock checks prove contracts; real eviction, terminal
paint, Remote Control and native restart behavior require separate live evidence.
