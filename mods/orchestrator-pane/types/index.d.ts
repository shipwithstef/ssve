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
  tasks: OrchTask[]; warnings: { code: string; description: string }[];
  goals: { id: string; title: string; lanes: { id: string; title: string; tasks: OrchTask[] }[] }[];
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
