// True when the importing module is the script node was started with. Compares real
// paths so it holds when svc is run through the symlinked install (~/.claude/skills/...).
import fs from "node:fs";
import { fileURLToPath } from "node:url";

export function isMain(moduleUrl) {
  try { return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(moduleUrl)); }
  catch { return false; }
}
