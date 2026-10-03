export type OrchTask = {
  id: string; title: string; goal_id: string; lane: string; description: string;
  state: string; attempt_id: string; adopted: boolean; session_id: string | null;
  executor: { cli: string; model: string | null; effort: string | null };
  elapsed_ms: number; estimate_ms: { low: number | null; high: number | null };
  events_last_3: string[]; blockers: { code: string; description: string }[];
  depends_on: string[]; acceptance: string[]; log_path: string;
  completion_report_ref: string | null; verification_state: string;
};
export type OrchStatus = {
  schema_version: 1; revision: number; generated_at: string; collector_heartbeat_at: string;
  updates?: string[];
  update_channels?: { web: boolean; pane: boolean };
  tasks: OrchTask[]; warnings: { code: string; description: string }[];
  registry_revision?: number | null;
  orchestrators?: OrchRecoverySession[];
  recovery?: { boot_id: string; parent?: { resume_command?: string | null; reason?: string }; tasks: { id: string; action: string; reason?: string }[] } | null;
  goals: OrchGoal[];
};
export type OrchRecoverySession = {
  role: string; goal_id: string; session_id: string; generation: number; registry_revision: number;
  state: string; auto_start: false; cwd: string | null; effort: string;
  attach_command: string | null; resume_command: string | null; reason?: string;
};
export type OrchGoal = {
  id: string; title: string; priority?: number | null; desired_state?: string | null; observed_state?: string;
  child?: { session_id: string | null; state: string; health?: string; effort: string; generation: number; attention_pending?: boolean } | null;
  budget?: { mode: string; claude_turn_cap: number | null; worker_caps: Record<string, { runs: number | null }> } | null;
  usage?: { claude: { turns: number | null }; workers: Record<string, { attempts: number }> };
  reserved?: { claude_turns: number | null; worker_runs: Record<string, number> };
  remaining?: { claude_turns: number | null; worker_runs: Record<string, number | null> };
  info?: { code: string; description: string }[];
  blockers?: { code: string; description: string }[];
  lanes: { id: string; title: string; tasks: OrchTask[] }[];
};
export type OrchView = { snapshot: OrchStatus | null; error: string | null; readAt: number };
export type OrchExpansion = Record<string, boolean>;
export type OrchDetail = { taskId: string; attemptId: string; path: string; text: string; at: string; truncated: boolean } | null;
export type OrchDraft = { taskId: string; attemptId: string; text: string } | null;

declare module 'claude-code' {
  interface PluginState {
    'orchestrator-pane': {
      view: OrchView;
      expanded: OrchExpansion;
      detail: OrchDetail;
      draft: OrchDraft;
      page: number;
    };
  }
}
