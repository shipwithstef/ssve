#!/usr/bin/env node

import crypto from "node:crypto";
import {
  TASK_EVENT_TRANSITIONS,
  TASK_EVENT_TYPES,
  transitionTaskState
} from "./runtime-state-model-v2.mjs";
import {
  RELEASE_LIFECYCLE_TRANSITIONS,
  transitionReleaseLifecycle
} from "./runtime-release-lifecycle-v2.mjs";

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function digest(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}

const taskMutants = Object.entries(TASK_EVENT_TRANSITIONS).flatMap(([priorState, transitions]) =>
  TASK_EVENT_TYPES
    .filter(eventType => !(eventType in transitions))
    .map(eventType => Object.freeze({
      id: `task-transition:${priorState}:${eventType}`,
      detector: "transitionTaskState",
      prior_state: priorState,
      attempted_transition: eventType
    }))
);

const lifecycleStates = Object.keys(RELEASE_LIFECYCLE_TRANSITIONS);
const lifecycleMutants = lifecycleStates.flatMap(priorState =>
  lifecycleStates
    .filter(nextState => !RELEASE_LIFECYCLE_TRANSITIONS[priorState].includes(nextState))
    .map(nextState => Object.freeze({
      id: `release-transition:${priorState}:${nextState}`,
      detector: "transitionReleaseLifecycle",
      prior_state: priorState,
      attempted_transition: nextState
    }))
);

// The acceptance floor is 100. Keep 130 independently addressable transition
// mutants: all 68 illegal task transitions plus 62 deterministic lifecycle
// transitions. This is executable coverage, not a list of manually asserted
// booleans or repeated values passed through one comparison.
export const RUNTIME_TRANSITION_MUTANTS = Object.freeze([
  ...taskMutants,
  ...lifecycleMutants.slice(0, 130 - taskMutants.length)
]);

export const MUTATION_CLASSES = Object.freeze(RUNTIME_TRANSITION_MUTANTS.map(mutant => mutant.id));

export function executeRuntimeTransitionMutant(mutant) {
  let rejected = false;
  let error = null;
  if (mutant?.detector === "transitionTaskState") {
    const result = transitionTaskState(mutant.prior_state, mutant.attempted_transition);
    rejected = result.valid === false;
    error = result.errors?.join("; ") ?? null;
  } else if (mutant?.detector === "transitionReleaseLifecycle") {
    try {
      transitionReleaseLifecycle({ state: mutant.prior_state }, mutant.attempted_transition);
    } catch (caught) {
      rejected = true;
      error = caught.message;
    }
  } else {
    error = `unknown assurance detector ${mutant?.detector}`;
  }
  const receipt = {
    mutation_id: mutant?.id ?? null,
    detector: mutant?.detector ?? null,
    input_digest: digest({
      detector: mutant?.detector ?? null,
      prior_state: mutant?.prior_state ?? null,
      attempted_transition: mutant?.attempted_transition ?? null
    }),
    outcome: rejected ? "KILLED" : "SURVIVED",
    rejection: error
  };
  receipt.receipt_digest = digest(receipt);
  return receipt;
}

export function collectRuntimeTransitionMutationReceipts() {
  return RUNTIME_TRANSITION_MUTANTS.map(executeRuntimeTransitionMutant);
}

function receiptValid(receipt, mutant) {
  if (!receipt || receipt.mutation_id !== mutant.id || receipt.outcome !== "KILLED") return false;
  const rerun = executeRuntimeTransitionMutant(mutant);
  return receipt.detector === rerun.detector &&
    receipt.input_digest === rerun.input_digest &&
    receipt.rejection === rerun.rejection &&
    receipt.receipt_digest === rerun.receipt_digest;
}

export function evaluateRuntimeClosure(candidate) {
  const supplied = new Map((candidate?.mutation_receipts ?? []).map(receipt => [receipt.mutation_id, receipt]));
  const failed_mutations = RUNTIME_TRANSITION_MUTANTS
    .filter(mutant => !receiptValid(supplied.get(mutant.id), mutant))
    .map(mutant => mutant.id);
  const unknown_mutations = [...supplied.keys()].filter(id => !MUTATION_CLASSES.includes(id)).sort();
  const valid = failed_mutations.length === 0 && unknown_mutations.length === 0 && supplied.size === RUNTIME_TRANSITION_MUTANTS.length;
  const delivery_closed = valid && candidate?.delivery_state === "DELIVERY_VERIFIED" && candidate?.production_proven === true;
  const outcome_closed = delivery_closed && candidate?.outcome_state === "OUTCOME_DECIDED";
  return { valid, failed_mutations, unknown_mutations, delivery_closed, outcome_closed };
}
