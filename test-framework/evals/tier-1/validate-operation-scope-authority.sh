#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
MODULE="$ROOT/hooks/lib/operation-scope.mjs"
if [[ ! -f "$MODULE" ]]; then
  echo "WI502-RED operation-scope: canonical scope module missing"
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

node --input-type=module - "$ROOT" "$TMP" <<'NODE'
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const [root, tmp] = process.argv.slice(2);
const scope = await import(pathToFileURL(path.join(root, "hooks/lib/operation-scope.mjs")));
const codexContext = await import(pathToFileURL(path.join(root, "hooks/codex/lib/codex-hook-context.mjs")));
const isolation = await import(pathToFileURL(path.join(root, "hooks/svc-worktree-isolation-guard.mjs")));
const git = (cwd, args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
const repo = path.join(tmp, "repo");
fs.mkdirSync(repo, { recursive: true });
git(repo, ["init", "-q"]);
git(repo, ["config", "user.name", "fixture"]);
git(repo, ["config", "user.email", "fixture@example.test"]);
fs.writeFileSync(path.join(repo, "tracked.txt"), "base\n");
git(repo, ["add", "tracked.txt"]);
git(repo, ["commit", "-qm", "base"]);
const worktree = path.join(tmp, "worktree");
git(repo, ["worktree", "add", "-qb", "feature", worktree]);
fs.mkdirSync(path.join(worktree, "src"));
fs.writeFileSync(path.join(worktree, "src", "old.txt"), "old\n");
const nested = path.join(worktree, "nested");
fs.mkdirSync(nested);
git(nested, ["init", "-q"]);
const alias = path.join(tmp, "alias");
fs.symlinkSync(worktree, alias);
const outsideFile = path.join(tmp, "outside.txt");
fs.writeFileSync(outsideFile, "outside\n");
fs.symlinkSync(outsideFile, path.join(worktree, "src", "outside-link.txt"));
const outsideDir = path.join(tmp, "outside-dir");
fs.mkdirSync(outsideDir);
fs.symlinkSync(outsideDir, path.join(worktree, "src", "outside-dir-link"));

const patch = [
  "*** Begin Patch",
  "*** Update File: src/old.txt",
  "*** Move to: src/moved.txt",
  "*** Add File: src/new/deep.txt",
  "+new",
  "*** Delete File: tracked.txt",
  "*** End Patch",
].join("\n");
const resolved = scope.resolveOperationScope({
  host: "codex",
  tool_name: "apply_patch",
  cwd: repo,
  session_id: "session-a",
  tool_input: { workdir: alias, patch },
});
assert.equal(resolved.ok, true, JSON.stringify(resolved.contradictions));
assert.equal(resolved.session_repository.worktree_root, fs.realpathSync(repo));
assert.equal(resolved.operation_repository.worktree_root, fs.realpathSync(worktree));
assert.equal(resolved.explicit_workdir.source, "tool_input.workdir");
assert.deepEqual(new Set(resolved.targets.map((target) => target.role)), new Set([
  "update", "move_source", "move_destination", "add", "delete",
]));
assert.ok(resolved.targets.find((target) => target.role === "add").canonical.endsWith("src/new/deep.txt"));
assert.notEqual(resolved.session_repository.repo_id, "");
assert.equal(resolved.session_repository.repo_id, resolved.operation_repository.repo_id);

const relative = scope.resolveOperationScope({
  host: "codex", tool_name: "Write", cwd: tmp,
  tool_input: { workdir: "worktree", file_path: "src/relative.txt" },
});
assert.equal(relative.ok, true);
assert.equal(relative.operation_repository.worktree_root, fs.realpathSync(worktree));

for (const alias of ["cwd", "working_directory"]) {
  const aliased = scope.resolveOperationScope({
    host: "codex", tool_name: "Write", cwd: repo,
    tool_input: { [alias]: worktree, file_path: "src/alias.txt" },
  });
  assert.equal(aliased.ok, true, `${alias} alias rejected`);
  assert.equal(aliased.operation_cwd, fs.realpathSync(worktree));
}

const conflictingAliases = scope.resolveOperationScope({
  host: "codex", tool_name: "Write", cwd: repo,
  tool_input: { workdir: worktree, cwd: repo, file_path: "src/conflict.txt" },
});
assert.equal(conflictingAliases.ok, false);
assert.ok(conflictingAliases.contradictions.some((item) => item.code === "conflicting-operation-cwd"));

const conflictingTarget = scope.resolveOperationScope({
  host: "codex", tool_name: "Write", cwd: repo,
  tool_input: { workdir: worktree, file_path: path.join(repo, "tracked.txt") },
});
assert.equal(conflictingTarget.ok, false, "worktree workdir plus default-checkout target was accepted");
assert.ok(conflictingTarget.contradictions.some((item) => item.code === "workdir-target-mismatch"));

const leadingCd = scope.resolveOperationScope({
  host: "codex", tool_name: "Bash", cwd: repo,
  tool_input: { command: `cd ${worktree} && touch relative-probe.txt` },
});
assert.equal(leadingCd.ok, true, JSON.stringify(leadingCd.contradictions));
assert.equal(leadingCd.operation_cwd, fs.realpathSync(worktree));

const gitC = scope.resolveOperationScope({
  host: "codex", tool_name: "Bash", cwd: repo,
  tool_input: { command: `git -C ${worktree} status --short` },
});
assert.equal(gitC.ok, true, JSON.stringify(gitC.contradictions));
assert.equal(gitC.operation_repository.worktree_root, fs.realpathSync(worktree));

const absoluteTarget = scope.resolveOperationScope({
  host: "codex", tool_name: "Write", cwd: repo,
  tool_input: { file_path: path.join(worktree, "src", "absolute.txt") },
});
assert.equal(absoluteTarget.ok, true, JSON.stringify(absoluteTarget.contradictions));
assert.equal(absoluteTarget.operation_repository.worktree_root, fs.realpathSync(worktree));

const symlinkLeaf = scope.resolveOperationScope({
  host: "codex", tool_name: "Write", cwd: worktree,
  tool_input: { workdir: worktree, file_path: "src/outside-link.txt" },
});
assert.equal(symlinkLeaf.ok, false, "existing symlink leaf escaped operation worktree");
assert.equal(symlinkLeaf.targets[0].canonical, fs.realpathSync(outsideFile));
const danglingOutside = path.join(tmp, "dangling-outside", "created.txt");
fs.symlinkSync(danglingOutside, path.join(worktree, "src", "dangling-link.txt"));
const danglingLeaf = scope.resolveOperationScope({
  host: "codex", tool_name: "Write", cwd: worktree,
  tool_input: { workdir: worktree, file_path: "src/dangling-link.txt" },
});
assert.equal(danglingLeaf.ok, false, "dangling symlink leaf escaped operation worktree");
assert.equal(fs.existsSync(danglingOutside), false, "scope resolution created the outside target");
assert.throws(() => scope.canonicalTarget("src/outside-dir-link/../escape.txt", worktree), /parent traversal/i);

const relativeShell = scope.analyzeShellBoundary("cd src && touch file.txt", { authorityRoot: worktree });
assert.equal(relativeShell.ok, true, JSON.stringify(relativeShell));
assert.equal(scope.analyzeShellBoundary("cd src && touch ../inside.txt", { authorityRoot: worktree }).ok, true);
for (const command of ["touch ../../outside", "tee ../../outside", "dd if=/dev/null of=../../outside", "> ../../outside"]) {
  assert.equal(scope.analyzeShellBoundary(command, { authorityRoot: worktree }).ok, false, command);
}
for (const command of ["echo ok && touch /outside/x", "true; rm -rf /outside/dir"]) {
  assert.equal(scope.analyzeShellBoundary(command, { authorityRoot: worktree }).ok, false, command);
}
assert.equal(scope.analyzeShellBoundary(
  `node scripts/svc-authority.mjs resume --worktree ${path.join(tmp, "outside-repo")}`,
  { authorityRoot: worktree },
).ok, false, "structured authority worktree escape");

const missingWorkdir = scope.resolveOperationScope({
  host: "codex", tool_name: "Bash", cwd: repo,
  tool_input: { workdir: path.join(tmp, "missing"), command: "touch x" },
});
assert.equal(missingWorkdir.ok, false);
assert.ok(missingWorkdir.contradictions.some((item) => item.code === "invalid-explicit-workdir"));
const workdirFile = path.join(tmp, "not-a-directory"); fs.writeFileSync(workdirFile, "x");
for (const requested of [workdirFile, "", path.join(tmp, "dangling-workdir")]) {
  if (requested.includes("dangling")) fs.symlinkSync(path.join(tmp, "missing-target"), requested);
  const result = scope.resolveOperationScope({ host: "codex", tool_name: "Bash", cwd: repo, tool_input: { workdir: requested, command: "touch x" } });
  assert.equal(result.ok, false, `invalid workdir accepted: ${requested}`);
  assert.ok(result.contradictions.some((item) => item.code === "invalid-explicit-workdir"));
}

const nonGitWithGovernedTarget = scope.resolveOperationScope({
  host: "codex", tool_name: "Write", cwd: tmp,
  tool_input: { file_path: path.join(worktree, "src", "governed.txt") },
});
assert.equal(nonGitWithGovernedTarget.operation_repository.worktree_root, fs.realpathSync(worktree));

const mixed = scope.resolveOperationScope({
  host: "codex", tool_name: "Write", cwd: worktree,
  tool_input: { paths: [path.join(worktree, "a.txt"), path.join(nested, "b.txt")] },
});
assert.equal(mixed.ok, false);
assert.ok(mixed.contradictions.some((item) => item.code === "mixed-repositories"));

const badField = scope.resolveOperationScope({
  host: "codex", tool_name: "Bash", cwd: repo,
  tool_input: { working_directory: worktree, command: "touch x" },
});
assert.equal(badField.explicit_workdir.source, "tool_input.working_directory", "Codex working_directory alias was not recognized");
assert.equal(badField.operation_cwd, fs.realpathSync(worktree));

const frameworkMaintenance = scope.resolveOperationScope({
  host: "codex", tool_name: "Write", cwd: root,
  tool_input: { workdir: root, file_path: "hooks/lib/operation-scope.mjs" },
});
assert.equal(frameworkMaintenance.ok, true);
const rootIsCanonicalMain = fs.realpathSync(root) === fs.realpathSync(git(root, ["worktree", "list", "--porcelain"]).split(/\r?\n/).find((line) => line.startsWith("worktree ")).slice(9));
assert.equal(
  frameworkMaintenance.framework_maintenance,
  rootIsCanonicalMain,
  "framework maintenance authority must exist only on the canonical main checkout",
);

fs.mkdirSync(path.join(tmp, "codex-runtime"), { mode: 0o700 });
const codexOperation = codexContext.operationHookContext({
  host: "codex", tool_name: "Write", cwd: tmp, session_id: "session-a",
  tool_input: { workdir: worktree, file_path: "src/integration.txt" },
}, { ...process.env, SVC_CODEX_RUNTIME_DIR: path.join(tmp, "codex-runtime") });
assert.equal(codexOperation.repo_root, fs.realpathSync(worktree));
assert.equal(codexOperation.session_repo_root, null);

const universalDecision = isolation.classifyMutation({
  toolName: "Write", toolInput: { workdir: worktree, file_path: "src/integration.txt" },
  sessionId: "session-a", cwd: tmp,
  raw: { host: "codex", tool_name: "Write", cwd: tmp, session_id: "session-a", tool_input: { workdir: worktree, file_path: "src/integration.txt" } },
}, { ...process.env, SVC_HOST: "codex", PWD: tmp });
assert.equal(universalDecision.operation_scope.operation_repository.worktree_root, fs.realpathSync(worktree));
assert.equal(universalDecision.allow, false, "governed target from non-Git session was treated as ungoverned");

const externalTemp = isolation.classifyMutation({
  toolName: "Bash", toolInput: { workdir: tmp, command: "touch harmless" },
  sessionId: "session-a", cwd: repo,
  raw: { host: "codex", tool_name: "Bash", cwd: repo, session_id: "session-a", tool_input: { workdir: tmp, command: "touch harmless" } },
}, { ...process.env, SVC_HOST: "codex", PWD: repo });
assert.equal(externalTemp.allow, true, "explicit non-Git workdir inherited session repository authority");

console.log("TIER-1 PASS: operation scope canonicalizes complete mutation authority");
NODE
