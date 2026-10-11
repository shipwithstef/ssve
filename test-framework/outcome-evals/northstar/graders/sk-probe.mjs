// Imported by probe scripts (never by the grader). A probe passes only by calling pass().
// The run's nonce arrives on stdin and is read here, synchronously, before any build code is
// imported; the verdict goes to fd 3, which only the grader's runner reads (see
// runScript in sk-shared.mjs). A build that calls process.exit(0) while it loads, or at any
// point before the probe's last assertion, exits 0 with nothing on fd 3: that is a failure.
// Probes must finish by calling pass(...); a probe script that just ends does not pass.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const NONCE = fs.readFileSync(0, "utf8").split("\n")[0].trim();

export const dir = process.env.GRADE_BUILD_DIR;
export const load = (rel) => import(pathToFileURL(path.join(dir, rel)).href);
const say = (msg) => String(msg).replace(/\s+/g, " ");
export const pass = (msg) => { fs.writeSync(3, `${NONCE}\t${say(msg)}\n`); process.exit(); };
// Written straight to fd 1: a probe may replace console.log and process.stdout.write.
export const fail = (msg) => { fs.writeSync(1, `${say(msg)}\n`); process.exit(1); };

