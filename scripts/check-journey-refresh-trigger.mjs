#!/usr/bin/env node

import fs from "node:fs";

function usage() {
  console.error("Usage: node scripts/check-journey-refresh-trigger.mjs --state <state.json>");
  process.exit(2);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--state") args.state = argv[++i];
    else usage();
  }
  if (!args.state) usage();
  return args;
}

const args = parseArgs(process.argv.slice(2));
const state = JSON.parse(fs.readFileSync(args.state, "utf8"));
const shouldRefresh =
  state.milestone_complete === true &&
  state.active_wi_count === 0 &&
  state.journeys_exist === true &&
  state.shipped_behavior_changed === true &&
  ["roadmap-evaluation", "assess-market-readiness"].includes(state.next_skill);

console.log(
  JSON.stringify(
    {
      refresh_required: shouldRefresh,
      command: shouldRefresh ? "write-journeys --refresh --all" : null,
      reason: shouldRefresh
        ? "milestone complete with changed shipped behavior before roadmap/readiness handoff"
        : "refresh trigger conditions not all present",
    },
    null,
    2
  )
);

process.exit(0);
