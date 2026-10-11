/**
 * framework-root.mjs — where the framework's own files are, from any project.
 *
 * Skills name framework files by short paths (scripts/, references/, schemas/, ...). Inside
 * the framework repository those resolve from the working directory; in a user's project
 * they do not, and a model that looks for them there concludes the framework is missing and
 * skips its graph, receipts and reviews. The root is derived from this file's real location
 * (through the install symlinks), so it holds on every host and install.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function frameworkRoot() {
  return path.resolve(path.dirname(fs.realpathSync(fileURLToPath(import.meta.url))), "..", "..");
}

// One short paragraph for the model's context at session start.
export function frameworkRootContext(root = frameworkRoot(), cwd = process.cwd()) {
  const inside = path.resolve(cwd) === root || path.resolve(cwd).startsWith(root + path.sep);
  if (inside) return null; // working on the framework itself: short paths already resolve
  const state = fs.existsSync(path.join(cwd, ".svc")) ? "" : ` This project has no .svc/ yet: create it first with \`node ${root}/scripts/init-project-state.mjs\`.`;
  return `SSVE framework root: ${root} (also $SVC_ROOT in Bash). In skill text, scripts/, schemas/, templates/, hooks/, agents/, _shared/, REPO_MODES.md, skills-manifest.json, and any references/ path not inside the loaded skill's own folder, are framework files under this root, never project files: run them as \`node ${root}/scripts/<name>.mjs\` from the project directory. Project state lives in the project's .svc/.${state}`;
}
