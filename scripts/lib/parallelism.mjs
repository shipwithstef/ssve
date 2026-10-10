// How many lanes may run at once, from the subscription plan and current usage.
// Data lives in references/plan-limits.json; references/cockpit-protocol.md says the
// orchestrator never fans out past this number.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LIMITS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "references", "plan-limits.json");

export function loadPlanLimits(file = LIMITS) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// plan: a key of plans; used/limit: current usage in any unit (both or neither);
// override: an explicit positive integer cap (SVC_MAX_PARALLEL), which can only lower.
export function maxParallel({ plan, used, limit, override } = {}, limits = loadPlanLimits()) {
  const name = Object.hasOwn(limits.plans, plan ?? "") ? plan : limits.default_plan;
  let n = limits.plans[name].max_parallel;
  let why = limits.plans[name].why;
  if (Number.isFinite(used) && Number.isFinite(limit) && limit > 0 && used / limit >= limits.throttle_at) {
    n = 1;
    why = `usage at ${Math.round((used / limit) * 100)}% of the plan limit: one lane until it resets`;
  }
  const cap = Number(override);
  if (Number.isInteger(cap) && cap > 0 && cap < n) { n = cap; why = `capped at ${cap} by SVC_MAX_PARALLEL`; }
  return { plan: name, max_parallel: n, why };
}
