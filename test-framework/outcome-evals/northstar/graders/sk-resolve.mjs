// Loaded with `node --import` into probe scripts (runScript in sk-shared.mjs). It teaches the
// probe's module resolution one specifier family, so a probe can find the grader helpers
// wherever the probe itself lives (in-repo, or in a task kept outside the repo):
//
//   import { dir, load, pass, fail } from "@graders/sk-probe.mjs";
//   import { launchBrowser } from "@graders/sk-browser.mjs";
//
// "@graders/<file>" resolves to <this directory>/<file>. Anything else, and any path that
// leaves this directory, resolves as before. Relative imports keep working.
import { register } from "node:module";
register("./sk-resolve-hooks.mjs", import.meta.url);
