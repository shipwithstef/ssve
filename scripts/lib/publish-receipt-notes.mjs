import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

// Each attempt starts from the entire remote notes history. A normal push is
// the concurrency check; a competing publisher causes a bounded fresh retry.
export function publishReceiptNotes(root, envelopes, { attempts = 5 } = {}) {
  const ref = `refs/notes/svc-publish-${randomUUID()}`;
  const remoteRef = 'refs/notes/svc-receipts';
  function git(args, optional = false) {
    const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    if (r.status !== 0 && !optional) throw new Error(`${args[0]}: ${r.stderr.trim()}`);
    return r;
  }
  try {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const remote = git(['ls-remote', 'origin', remoteRef]).stdout.trim().split(/\s/)[0];
      git(['update-ref', '-d', ref]);
      if (remote) {
        if (!/^[0-9a-f]{40}$/.test(remote)) throw new Error('Invalid remote notes identity');
        git(['fetch', '--no-tags', 'origin', remote]);
        git(['update-ref', ref, remote]);
      }
      for (const [sha, envelope] of Object.entries(envelopes)) {
        if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('Invalid receipt commit identity');
        const existing = git(['notes', `--ref=${ref}`, 'show', sha], true);
        const merged = existing.status === 0 ? JSON.parse(existing.stdout) : {};
        for (const [slot, body] of Object.entries(envelope)) {
          // Recomputed coverage has the same evidence but a new wall-clock
          // timestamp. Preserve the published receipt when that alone differs.
          if (body?.receipt_type === 'skill-coverage' && merged[slot]?.receipt_type === 'skill-coverage') {
            const { generated_at: oldTime, ...oldProof } = merged[slot];
            const { generated_at: newTime, ...newProof } = body;
            if (isDeepStrictEqual(oldProof, newProof)) continue;
          }
          if (Object.hasOwn(merged, slot) && !isDeepStrictEqual(merged[slot], body)) {
            throw new Error(`Conflicting receipt for ${sha}:${slot}`);
          }
          merged[slot] = body;
        }
        git(['notes', `--ref=${ref}`, 'add', '-f', '-m', JSON.stringify(merged), sha]);
      }
      const pushed = git(['push', 'origin', `${ref}:${remoteRef}`], true);
      if (pushed.status === 0) return;
      if (attempt === attempts - 1) throw new Error(`Receipt publish retries exhausted: ${pushed.stderr.trim()}`);
    }
  } finally {
    git(['update-ref', '-d', ref], true);
  }
}

// Fresh clones recover published proof without modifying their local notes ref.
export function readPublishedReceiptNote(root, sha) {
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('Invalid receipt commit identity');
  const ref = `refs/notes/svc-read-${randomUUID()}`;
  const git = args => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  try {
    const advertised = git(['ls-remote', 'origin', 'refs/notes/svc-receipts']);
    if (advertised.status !== 0) throw new Error(advertised.stderr.trim());
    const oid = advertised.stdout.trim().split(/\s/)[0];
    if (!oid) return {};
    if (!/^[0-9a-f]{40}$/.test(oid)) throw new Error('Invalid remote notes identity');
    for (const args of [['fetch', '--no-tags', 'origin', oid], ['update-ref', ref, oid]]) {
      const r = git(args); if (r.status !== 0) throw new Error(r.stderr.trim());
    }
    const note = git(['notes', `--ref=${ref}`, 'show', sha]);
    return note.status === 0 ? JSON.parse(note.stdout) : {};
  } finally { git(['update-ref', '-d', ref]); }
}
