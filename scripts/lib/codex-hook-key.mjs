import { actualDelegatedCommand } from "./governed-routing.mjs";

// Identity follows the executable delegated by a hook boundary, not its
// visible marker. This keeps distinct compatibility guards from collapsing.
export function commandKey(command) {
  const cmd = actualDelegatedCommand(command);
  if (cmd.includes("svc-codex-pretool-dispatcher")) return "svc-codex-pretool-dispatcher";
  if (cmd.includes("svc-worktree-isolation-guard.mjs")) return "svc-worktree-isolation-guard";
  if (cmd.includes("svc-workflow-guard.mjs --bash-guard")) return "svc-bash-guard";
  if (cmd.includes("svc-workflow-guard.mjs")) return "svc-edit-write-guard";
  if (cmd.includes("svc-loop-guard.mjs")) return "svc-loop-guard";
  if (cmd.includes("svc-learning-preload.mjs")) return "svc-learning-preload";
  if (cmd.includes("svc-session-start-healthcheck.mjs")) return "svc-session-start-healthcheck";
  if (cmd.includes("svc-prompt-stale-state.mjs")) return "svc-prompt-stale-state";
  if (cmd.includes("svc-codex-skill-load-enforcer") || cmd.includes("svc-kimi-skill-load-enforcer.sh")) return "svc-skill-load-enforcer";
  if (cmd.includes("svc-codex-prompt-authority.mjs")) return "svc-codex-prompt-authority";
  if (cmd.includes("svc-codex-stop-firewall.mjs")) return "svc-task-completion-guard";
  if (cmd.includes("svc-skill-artifact-authenticity.mjs")) return "svc-skill-artifact-authenticity";
  if (cmd.includes("svc-session-contract-freshness.mjs")) return "svc-session-contract-freshness";
  if (cmd.includes("svc-inertia-check.mjs")) return "svc-inertia-check";
  if (cmd.includes("svc-impact-triad-guard.mjs")) return "svc-impact-triad-guard";
  if (cmd.includes("svc-task-completion-guard.sh")) return "svc-task-completion-guard";
  return null;
}
