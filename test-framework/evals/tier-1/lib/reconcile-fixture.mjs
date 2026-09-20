import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/** Create private Git history so watcher tests never depend on the source checkout's remote HEAD.
 * @param {string} directory Existing fixture-owned temporary directory.
 * @returns {{repo: string, sha: string}} Private repository and initial commit.
 */
export function reconcileFixture(directory) {
  const repo = path.join(directory, 'repo'); fs.mkdirSync(repo);
  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q', '-b', 'main');
  git('-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-qm', 'watcher fixture');
  const sha = git('rev-parse', 'HEAD');
  git('remote', 'add', 'origin', 'https://github.com/shipwithstef/ssve');  // Identity only; the GH executable is a test double.
  git('update-ref', 'refs/remotes/origin/main', sha);
  git('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main');
  return { repo, sha };
}
