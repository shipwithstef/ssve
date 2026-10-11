// Hook-side wrapper for the fail-open counter (scripts/lib/fail-open-counter.mjs).
//
// A hook calls failOpen(<hook name>, <error>) on every path where it swallows an error
// and lets the action continue. It is synchronous (callers exit right after), prints
// nothing, never throws and never changes the caller's exit code. An install without
// scripts/ (or a Node without require(esm)) simply does not count.
//
// The counter belongs to the project the hook acts on, which is the payload's project and
// not necessarily process.cwd(). Once a hook knows it, it calls failOpenAt({ cwd } or
// { root }); every later failOpen() then counts against that project.
import { createRequire } from "node:module";

const load = createRequire(import.meta.url);
let counter;
let target;

export function failOpenAt(options) {
  target = options && (options.root || options.cwd) ? { ...options } : target;
}

export function failOpen(hookName, error, options) {
  try {
    counter ??= load("../../scripts/lib/fail-open-counter.mjs");
    counter.recordFailOpen(hookName, error, options || target);
  } catch { /* the failure path must not fail again */ }
}
