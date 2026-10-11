// Tool lists per arm, shared by outcome-eval (what a run is given) and northstar (what the
// manifest says each arm is given), so the two cannot drift apart.
//
// solo and framework get the task's own tool list plus unrestricted Bash, Agent, Task and the
// web tools a real Claude Code user has by default (WebSearch, WebFetch), so "solo is the bare
// model" holds: the arms differ only by what the framework installs.
// framework additionally gets Skill, which does nothing without installed skills.
const FULL = ["Bash", "Agent", "Task", "WebSearch", "WebFetch"];
export const ARM_TOOLS = Object.freeze({
  swarm: ["Agent", "Task"],
  bounded: ["Bash(git:*)"],
  solo: FULL,
  framework: [...FULL, "Skill"],
});
export const DEFAULT_TASK_TOOLS = "Read,Write,Edit,Glob,Grep,Bash(node:*),Bash(ls:*),Bash(cat:*),Bash(curl:*),Bash(mkdir:*)";

export function armTools(taskTools, arm) {
  const base = taskTools || DEFAULT_TASK_TOOLS;
  const extra = (ARM_TOOLS[arm] || []).filter((t) => !base.split(",").includes(t));
  return [base, ...extra, ...(arm === "swarm" && !base.includes("Bash(git:*)") ? ["Bash(git:*)"] : [])].join(",");
}

// Tools in `a` that `b` lacks, and the reverse, as sorted lists (the order of a list is not a difference).
export function toolDiff(a, b) {
  const sa = new Set(a.split(",")), sb = new Set(b.split(","));
  return { only_a: [...sa].filter((t) => !sb.has(t)).sort(), only_b: [...sb].filter((t) => !sa.has(t)).sort() };
}
