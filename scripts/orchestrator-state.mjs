#!/usr/bin/env node
/**
 * Orchestrator State Machine
 *
 * Maintains `.svc/orchestrator-state.json` per project.
 * Tracks cross-session state: active WI, human checkpoint, last action,
 * lane-executor position, and session history.
 *
 * The SessionStart hook reads this to auto-resume.
 * The Stop hook writes a checkpoint to this.
 *
 * Usage:
 *   node orchestrator-state.mjs init <project-root>
 *   node orchestrator-state.mjs get <project-root> [key]
 *   node orchestrator-state.mjs set <project-root> <key> <value>
 *   node orchestrator-state.mjs checkpoint <project-root> --wi <wi> --task <taskId>
 *   node orchestrator-state.mjs resume <project-root>
 *   node orchestrator-state.mjs clear-hp <project-root>
 */

import { join, resolve } from "path";
import { renameSync } from "fs";
import { readJsonAtomic, writeJsonAtomic } from "./state-io.mjs";

const STATE_FILE = ".svc/orchestrator-state.json";

function loadState(projectRoot) {
  const path = join(resolve(projectRoot), STATE_FILE);
  try {
    return readJsonAtomic(path);
  } catch (error) {
    // WI-562 IP-H7: a corrupt state file used to be silently swallowed and a
    // fresh default written over it — destroying active-WI resume state. Now
    // the corrupt bytes are QUARANTINED next to the original and the caller
    // gets null (clean start) with a loud warning; prior state is preserved.
    try {
      const quarantine = `${path}.corrupt-${new Date().toISOString().replace(/[:.]/g, "-")}`;
      renameSync(path, quarantine);
      process.stderr.write(`[orchestrator-state] corrupt state quarantined: ${quarantine} (${error.message})\n`);
    } catch {
      process.stderr.write(`[orchestrator-state] corrupt state could not be quarantined: ${error.message}\n`);
    }
    return null;
  }
}

function saveState(projectRoot, state) {
  const path = join(resolve(projectRoot), STATE_FILE);
  writeJsonAtomic(path, state);
}

function defaultState() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    activeWi: null,
    activeLane: null,
    humanCheckpoint: false,
    lastSessionEnd: null,
    lastAction: null,
    nextTask: null,
    sessionHistory: [],
    checkpoints: [],
  };
}

const [,, cmd, ...args] = process.argv;

if (cmd === "init") {
  const root = args[0] || ".";
  const state = defaultState();
  saveState(root, state);
  console.log(JSON.stringify({ status: "initialized", path: join(resolve(root), STATE_FILE) }));
  process.exit(0);
}

if (cmd === "get") {
  const [root, key] = args;
  if (!root) {
    console.error("Usage: get <project-root> [key]");
    process.exit(1);
  }
  const state = loadState(root);
  if (!state) {
    console.log(JSON.stringify({ error: "state_not_initialized" }));
    process.exit(0);
  }
  if (key) {
    console.log(JSON.stringify({ [key]: state[key] ?? null }));
  } else {
    console.log(JSON.stringify(state, null, 2));
  }
  process.exit(0);
}

if (cmd === "set") {
  const [root, key, ...valueParts] = args;
  if (!root || !key) {
    console.error("Usage: set <project-root> <key> <value>");
    process.exit(1);
  }
  let state = loadState(root) || defaultState();
  const value = valueParts.join(" ");
  let parsed;
  try { parsed = JSON.parse(value); } catch { parsed = value; }
  state[key] = parsed;
  state.updatedAt = new Date().toISOString();
  saveState(root, state);
  console.log(JSON.stringify({ status: "set", key, value: parsed }));
  process.exit(0);
}

if (cmd === "checkpoint") {
  const root = args[0];
  if (!root) {
    console.error("Usage: checkpoint <project-root> --wi <wi> --task <taskId>");
    process.exit(1);
  }
  const flags = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      flags[args[i].slice(2)] = args[i + 1] ?? true;
      i++;
    }
  }
  let state = loadState(root) || defaultState();
  if (flags.wi) state.activeWi = flags.wi;
  if (flags.task) state.nextTask = flags.task;
  if (flags.lane) state.activeLane = flags.lane;
  if (flags.hp !== undefined) state.humanCheckpoint = flags.hp === "true" || flags.hp === true;
  state.checkpoints.unshift({
    at: new Date().toISOString(),
    wi: state.activeWi,
    task: state.nextTask,
    lane: state.activeLane,
  });
  state.checkpoints = state.checkpoints.slice(0, 20); // keep last 20
  state.updatedAt = new Date().toISOString();
  saveState(root, state);
  console.log(JSON.stringify({ status: "checkpointed", activeWi: state.activeWi, nextTask: state.nextTask }));
  process.exit(0);
}

if (cmd === "resume") {
  const root = args[0] || ".";
  const state = loadState(root);
  if (!state) {
    console.log(JSON.stringify({ canResume: false, reason: "state_not_initialized" }));
    process.exit(0);
  }
  if (state.humanCheckpoint) {
    console.log(JSON.stringify({ canResume: false, reason: "human_checkpoint_active", checkpoint: state.checkpoints[0] ?? null }));
    process.exit(0);
  }
  if (!state.activeWi) {
    console.log(JSON.stringify({ canResume: false, reason: "no_active_wi" }));
    process.exit(0);
  }
  console.log(JSON.stringify({
    canResume: true,
    activeWi: state.activeWi,
    activeLane: state.activeLane,
    nextTask: state.nextTask,
    lastAction: state.lastAction,
    checkpoint: state.checkpoints[0] ?? null,
  }));
  process.exit(0);
}

if (cmd === "clear-hp") {
  const root = args[0] || ".";
  let state = loadState(root);
  if (!state) {
    console.log(JSON.stringify({ error: "state_not_initialized" }));
    process.exit(0);
  }
  state.humanCheckpoint = false;
  state.updatedAt = new Date().toISOString();
  saveState(root, state);
  console.log(JSON.stringify({ status: "human_checkpoint_cleared" }));
  process.exit(0);
}

if (cmd === "session-end") {
  const root = args[0] || ".";
  let state = loadState(root);
  if (!state) {
    console.log(JSON.stringify({ error: "state_not_initialized" }));
    process.exit(0);
  }
  state.lastSessionEnd = new Date().toISOString();
  state.sessionHistory.unshift({
    endedAt: state.lastSessionEnd,
    activeWi: state.activeWi,
    nextTask: state.nextTask,
  });
  state.sessionHistory = state.sessionHistory.slice(0, 50);
  state.updatedAt = new Date().toISOString();
  saveState(root, state);
  console.log(JSON.stringify({ status: "session_ended", lastSessionEnd: state.lastSessionEnd }));
  process.exit(0);
}

console.error("Unknown command:", cmd);
console.error("Usage: init | get | set | checkpoint | resume | clear-hp | session-end");
process.exit(1);
