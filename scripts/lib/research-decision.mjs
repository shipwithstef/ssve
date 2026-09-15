/**
 * Shared researchDecision predicate (WI-FW-TWO-BOX-01 AC11/AC12).
 *
 * Sufficient current cited evidence is at least one evidence[] object with:
 *   source: non-empty string
 *   basis: non-empty string
 *   verified: true
 *   freshness: "current" or { status: "current" }
 * A number is not evidence. source+basis without verified/current do not
 * verify the claim. A stale freshness value or a timestamp field is not
 * current and is not a freshness requirement.
 */

export const ANALYSIS_REQUIRED = "analysis_required";
export const EXTERNAL_RESEARCH_REQUIRED = "external_research_required";
export const RESOLVED = "resolved";
export const SUFFICIENT_CONFIDENCE = 7;

export function isIntegerConfidence(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10;
}

export function isValidQuestionRecord(question) {
  if (question == null || typeof question !== "object" || Array.isArray(question)) return false;
  if (typeof question.id !== "string" || question.id.trim() === "") return false;
  if (typeof question.claim !== "string" || question.claim.trim() === "") return false;
  if (!Array.isArray(question.evidence) || question.evidence.some(item =>
    !item || typeof item !== "object" || Array.isArray(item) ||
    typeof item.source !== "string" || !item.source.trim() ||
    typeof item.basis !== "string" || !item.basis.trim() ||
    !(typeof item.freshness === "string" || (item.freshness && typeof item.freshness === "object" && !Array.isArray(item.freshness))) ||
    (item.verified !== undefined && typeof item.verified !== "boolean")
  )) return false;
  if (typeof question.consequential !== "boolean") return false;
  if (typeof question.external_resolvable !== "boolean") return false;
  if (question.confidence != null && !isIntegerConfidence(question.confidence)) return false;
  if (typeof question.explicit_request !== "boolean") return false;
  const freshness = question.freshness_required;
  if (typeof freshness === "boolean") return true;
  if (freshness && typeof freshness === "object" && !Array.isArray(freshness)) {
    return typeof freshness.necessary === "boolean" && typeof freshness.reason === "string";
  }
  return false;
}

function hasNecessaryFreshness(question) {
  const freshness = question.freshness_required;
  if (freshness === true) {
    return typeof question.freshness_reason === "string" && question.freshness_reason.trim() !== "";
  }
  if (freshness && typeof freshness === "object" && !Array.isArray(freshness)) {
    const reason = typeof freshness.reason === "string" ? freshness.reason.trim() : "";
    return freshness.necessary === true && reason !== "";
  }
  return false;
}

function evidenceIsCurrent(item) {
  if (item.freshness === "current") return true;
  return Boolean(item.freshness && typeof item.freshness === "object" && !Array.isArray(item.freshness) && item.freshness.status === "current");
}

export function hasSufficientCurrentCitedEvidence(question) {
  if (!isValidQuestionRecord(question)) return false;
  return question.evidence.some((item) => {
    if (item == null || typeof item !== "object" || Array.isArray(item)) return false;
    if (typeof item.source !== "string" || item.source.trim() === "") return false;
    if (typeof item.basis !== "string" || item.basis.trim() === "") return false;
    if (item.verified !== true) return false;
    return evidenceIsCurrent(item);
  });
}

export function researchDecisionTrace(question) {
  if (!isValidQuestionRecord(question)) {
    return { decision: ANALYSIS_REQUIRED, step: 1, reason: "missing_or_invalid_question_record" };
  }
  if (question.explicit_request === true) {
    return { decision: EXTERNAL_RESEARCH_REQUIRED, step: 2, reason: "explicit_user_research_request" };
  }
  const sufficient = hasSufficientCurrentCitedEvidence(question);
  if (hasNecessaryFreshness(question) && question.external_resolvable === true && !sufficient) {
    return { decision: EXTERNAL_RESEARCH_REQUIRED, step: 3, reason: "necessary_freshness" };
  }
  if (!isIntegerConfidence(question.confidence)) {
    return { decision: ANALYSIS_REQUIRED, step: 4, reason: "missing_ordinary_confidence" };
  }
  if (sufficient && question.confidence >= SUFFICIENT_CONFIDENCE) {
    return { decision: RESOLVED, step: 5, reason: "sufficient_current_and_score_gte_7" };
  }
  if (question.consequential === true && question.external_resolvable === true && question.confidence < SUFFICIENT_CONFIDENCE) {
    return { decision: EXTERNAL_RESEARCH_REQUIRED, step: 6, reason: "consequential_unresolved_external" };
  }
  return { decision: ANALYSIS_REQUIRED, step: 7, reason: "otherwise_analysis_required" };
}

export function researchDecision(question) {
  return researchDecisionTrace(question).decision;
}

export function collectResearchQuestions(input) {
  const buckets = [
    input?.questions,
    input?.research_questions,
    input?.solution_confidence?.questions,
    input?.delivery_graph?.research?.questions,
    input?.existing_graph?.delivery_graph?.research?.questions,
  ];
  for (const bucket of buckets) {
    if (Array.isArray(bucket)) {
      return bucket.filter((item) => item != null && typeof item === "object" && !Array.isArray(item));
    }
  }
  return [];
}

export function matchingResearchTask(tasks, questionId) {
  if (questionId == null || questionId === "") return null;
  return (Array.isArray(tasks) ? tasks : []).find((task) => {
    return (task?.metadata?.skill || task?.skill) === "research"
      && task?.metadata?.requesting_decision_id === questionId;
  }) || null;
}

function canonicalQuestion(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalQuestion).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalQuestion(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

export function researchInputMatches(question, task) {
  return Boolean(task?.metadata?.research_trigger_question) && canonicalQuestion(question) === canonicalQuestion(task.metadata.research_trigger_question);
}

export function reevaluateQuestion(question, researchTask) {
  if (!isValidQuestionRecord(question)) return question;
  if (!researchTask || researchTask.status !== "completed") return question;
  if (!researchInputMatches(question, researchTask)) return question;
  const next = {
    ...question,
    evidence: Array.isArray(question.evidence) ? question.evidence.slice() : [],
  };
  const meta = researchTask.metadata || {};
  if (Array.isArray(meta.observed_evidence)) next.evidence = meta.observed_evidence;
  if (Object.prototype.hasOwnProperty.call(meta, "observed_confidence")) {
    const score = meta.observed_confidence;
    if (score === null || isIntegerConfidence(score)) next.confidence = score;
  }
  if (question.explicit_request === true) {
    const requested = question.requested_scope || question.claim;
    if (meta.fulfilled_scope != null && String(meta.fulfilled_scope) === String(requested)) {
      next.explicit_request = false;
      next.explicit_request_provenance = true;
    }
  }
  return next;
}

function isFabricatedResearchReceipt(task, question) {
  const receipt = task?.skill_receipt || task?.metadata?.skill_receipt;
  if (!receipt || task?.status !== "completed") return false;
  const origin = task.metadata?.research_trigger_question;
  return !question || researchDecision(origin) !== EXTERNAL_RESEARCH_REQUIRED;
}

function referenceIssues(tasks) {
  const issues = [];
  const byId = new Map();
  for (const task of tasks) {
    if (byId.has(task.id)) issues.push("duplicate task id " + String(task.id));
    byId.set(task.id, task);
  }
  for (const task of tasks) {
    for (const dep of Array.isArray(task.blocked_by) ? task.blocked_by : []) {
      if (!byId.has(dep)) issues.push("dangling blocked_by " + String(dep) + " on task " + String(task.id));
    }
  }
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  function dfs(id) {
    if (visiting.has(id)) {
      issues.push("blocked_by cycle involving task " + String(id));
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    stack.push(id);
    for (const dep of Array.isArray(byId.get(id)?.blocked_by) ? byId.get(id).blocked_by : []) {
      if (byId.has(dep)) dfs(dep);
    }
    visiting.delete(id);
    visited.add(id);
    stack.pop();
  }
  for (const task of tasks) dfs(task.id);
  return issues;
}

export function validateResearchGraph(graph) {
  const issues = [];
  const dg = graph?.delivery_graph || {};
  const tasks = Array.isArray(graph?.tasks) ? graph.tasks : [];
  issues.push(...referenceIssues(tasks));
  const questions = Array.isArray(dg.research?.questions) ? dg.research.questions : [];
  const questionIds = new Set();
  for (const question of questions) {
    if (!isValidQuestionRecord(question)) issues.push("invalid research question record: " + String(question?.id || "missing id"));
    if (questionIds.has(question?.id)) issues.push("duplicate research question id: " + String(question?.id));
    questionIds.add(question?.id);
  }
  const intakeOnly = dg.solution_confidence?.mode === "intake_only";
  const researchTasks = tasks.filter((task) => (task?.metadata?.skill || task?.skill) === "research");
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const byDecision = new Map();
  for (const task of researchTasks) {
    const decisionId = task.metadata?.requesting_decision_id;
    if (!decisionId) {
      if (task.status === "pending" || task.status === "in_progress") {
        issues.push("research task missing requesting_decision_id");
      }
      continue;
    }
    if (!byDecision.has(decisionId)) byDecision.set(decisionId, []);
    byDecision.get(decisionId).push(task);
  }
  for (const [decisionId, group] of byDecision) {
    if (group.length > 1) issues.push("duplicate research tasks for requesting_decision_id '" + decisionId + "'");
  }
  if (!intakeOnly) {
    for (const question of questions) {
      const match = matchingResearchTask(researchTasks, question.id);
      const working = reevaluateQuestion(question, match);
      const decision = researchDecision(working);
      if (decision === EXTERNAL_RESEARCH_REQUIRED && !match) {
        issues.push("external_research_required question '" + String(question.id) + "' lacks research task");
      }
      if (match) {
        const requesterId = match.metadata?.requesting_task_id;
        if (requesterId == null || !byId.has(requesterId)) {
          issues.push("research task for '" + String(question.id) + "' has missing requesting_task_id");
        } else if (requesterId === match.id) {
          issues.push("research task cannot request itself");
        } else if (decision === EXTERNAL_RESEARCH_REQUIRED && !byId.get(requesterId).blocked_by?.includes(match.id)) {
          issues.push("research task for '" + String(question.id) + "' is not a blocker of requesting_task_id");
        } else if (decision !== RESOLVED && match.status === "completed" &&
          (byId.get(requesterId).status !== "blocked" || !byId.get(requesterId).metadata?.research_waits_for_decisions?.includes(question.id))) {
          issues.push("completed research has an unresolved requesting decision");
        }
      }
      if (match && (match.status === "pending" || match.status === "in_progress") && decision !== EXTERNAL_RESEARCH_REQUIRED) {
        issues.push("research task for '" + String(question.id) + "' inserted without external_research_required");
      }
    }
    for (const task of researchTasks) {
      if (task.status !== "pending" && task.status !== "in_progress") continue;
      const decisionId = task.metadata?.requesting_decision_id;
      if (!questions.some((question) => question.id === decisionId)) {
        issues.push("research task inserted without a matching question record");
      }
    }
  }
  for (const task of researchTasks) {
    const question = questions.find((item) => item.id === task.metadata?.requesting_decision_id) || null;
    if (isFabricatedResearchReceipt(task, question)) {
      issues.push("fabricated completed research receipt for purely local analysis");
    }
  }
  return issues;
}
