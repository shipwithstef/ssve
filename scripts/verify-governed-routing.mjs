#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { governedRoutingStatus } from "./lib/governed-routing.mjs";

const index = process.argv.indexOf("--manifest");
if (index < 0 || !process.argv[index + 1]) {
  process.stderr.write("usage: verify-governed-routing.mjs --manifest <host-manifest.json>\n");
  process.exit(2);
}
const manifest = JSON.parse(fs.readFileSync(process.argv[index + 1], "utf8"));
const wiring = manifest.wiring || {};
function expand(candidate) {
  if (!candidate) return "";
  if (candidate.startsWith("~")) return path.join(os.homedir(), candidate.slice(1));
  return path.isAbsolute(candidate) ? candidate : path.join(os.homedir(), candidate);
}
let configPath = wiring.config_file || manifest.hook_quirks?.config_file || "";
configPath = expand(configPath);
const stateConfigPath = expand(wiring.effective_state?.config_file || "");
const status = governedRoutingStatus(configPath, wiring, { stateConfigPath });
if (!status.ok) {
  process.stderr.write(`governed routing verification failed: ${status.reason}\n`);
  process.exit(1);
}
process.stdout.write(`${status.reason}\n`);
