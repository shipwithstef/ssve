#!/usr/bin/env node
// Explicit, local-first work item and GitHub Issue tracking.
import {
  resolveRoot, loadConfig, configure, pull, publish, closeIssue, adoptIssue,
  explicitRecoverLock, listItems, acceptRemote, abandonPending
} from "./lib/issue-tracker.mjs";

function parse(argv) {
  const flags = {};
  const values = new Set(["--root", "--configure", "--repo", "--pull", "--wi",
    "--public-title", "--public-body", "--close-wi", "--commit", "--adopt-issue", "--close-trigger",
    "--accept-remote", "--source-sha256"]);
  const booleans = new Set(["--publish", "--list", "--dry-run", "--recover-lock",
    "--abandon-pending-publish", "--abandon-pending-close"]);
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--active" || flag === "--all") throw new Error("legacy implicit sync is retired; use --publish --wi WI-ID with curated title/body");
    if (!values.has(flag) && !booleans.has(flag)) throw new Error("unknown option: " + flag);
    if (Object.hasOwn(flags, flag)) throw new Error("duplicate option: " + flag);
    if (values.has(flag)) {
      if (i + 1 >= argv.length || argv[i + 1].startsWith("--")) throw new Error("missing value for " + flag);
      flags[flag] = argv[++i];
    } else flags[flag] = true;
  }
  const actions = ["--configure", "--pull", "--publish", "--close-wi", "--adopt-issue",
    "--accept-remote", "--abandon-pending-publish", "--abandon-pending-close",
    "--list", "--recover-lock"].filter(flag => flags[flag]);
  if (actions.length > 1) throw new Error("choose one tracker action");
  if (!actions.length) {
    if (flags["--wi"]) throw new Error("legacy --wi sync is retired; use --publish --wi WI-ID with curated title/body");
    return {...flags, action: "--list"};
  }
  const action = actions[0];
  if (action === "--publish" && (!flags["--wi"] || !flags["--public-title"] || !flags["--public-body"])) throw new Error("publish requires --wi, --public-title and --public-body");
  if (action === "--close-wi" && !flags["--commit"]) throw new Error("close requires --commit SHA");
  if (action === "--adopt-issue" && !flags["--wi"]) throw new Error("adopt requires --wi WI-ID");
  const decisions = new Set(["--accept-remote", "--abandon-pending-publish", "--abandon-pending-close"]);
  if (decisions.has(action) && (!flags["--wi"] || (!flags["--dry-run"] && !flags["--source-sha256"])))
    throw new Error(action + " requires --wi WI-ID and --source-sha256 with the current full issue digest");
  if (flags["--source-sha256"] && !/^[0-9a-f]{64}$/.test(flags["--source-sha256"]))
    throw new Error("--source-sha256 must be 64 lowercase hex characters");
  if (action !== "--publish" && action !== "--adopt-issue" && !decisions.has(action) && flags["--wi"]) throw new Error("legacy --wi sync is retired; use --publish or --adopt-issue");
  if (!decisions.has(action) && flags["--source-sha256"]) throw new Error("--source-sha256 requires an explicit remote decision");
  if (action !== "--configure" && (flags["--repo"] || flags["--close-trigger"])) throw new Error("--repo and --close-trigger require --configure");
  if (action !== "--close-wi" && flags["--commit"]) throw new Error("--commit requires --close-wi");
  if (action !== "--publish" && (flags["--public-title"] || flags["--public-body"])) throw new Error("public title/body require --publish");
  return {...flags, action};
}
function main() {
  const args = parse(process.argv.slice(2));
  const ctx = resolveRoot(args["--root"]);
  if (args.action === "--configure") {
    const settings = configure(ctx, args["--configure"], args["--repo"], args["--close-trigger"], !!args["--dry-run"]);
    process.stdout.write(JSON.stringify(settings, null, 2) + "\n");
    return;
  }
  if (args.action === "--recover-lock") {
    process.stdout.write(explicitRecoverLock(ctx) ? "Recovered dead tracker lock\n" : "No tracker lock\n");
    return;
  }
  const config = loadConfig(ctx);
  let result;
  switch (args.action) {
    case "--pull":
      result = pull(ctx, config, args["--pull"], !!args["--dry-run"]); break;
    case "--publish":
      result = publish(ctx, config, args["--wi"], args["--public-title"], args["--public-body"], !!args["--dry-run"]); break;
    case "--close-wi":
      result = closeIssue(ctx, config, args["--close-wi"], args["--commit"], !!args["--dry-run"]); break;
    case "--adopt-issue":
      result = adoptIssue(ctx, config, args["--adopt-issue"], args["--wi"], !!args["--dry-run"]); break;
    case "--accept-remote":
      result = acceptRemote(ctx, config, args["--accept-remote"], args["--wi"], args["--source-sha256"], !!args["--dry-run"]); break;
    case "--abandon-pending-publish":
    case "--abandon-pending-close":
      result = abandonPending(ctx, config, args["--wi"], args.action === "--abandon-pending-publish" ? "publish" : "close", args["--source-sha256"], !!args["--dry-run"]); break;
    default:
      result = listItems(ctx, config); break;
  }
  process.stdout.write(result.message + "\n");
}
try { main(); }
catch (error) { process.stderr.write("issue-tracker: " + error.message + "\n"); process.exitCode = 1; }
