/**
 * Shared freshness check for `docs/specs/relations/<scope>.branches.md`.
 *
 * The contract (`.claude/skills/audit-feature/SKILL.md` §2g): a branch index is
 * only evidence about the commit it was derived at. Any change under its own
 * declared scope-paths invalidates it, and a stale index must FAIL the scope's
 * contract script — because an audit standing on a stale enumeration is exactly
 * the failure this rule exists to prevent.
 *
 * The index declares its own scope, so this helper needs no per-scope config:
 *
 *   Derived-at: <full sha>
 *   Scope-paths:
 *     - supabase/functions/<glob>
 *     - src/components/sample/<glob>
 *
 * (Real globs use asterisks; they are written as <glob> here because a literal
 *  star-slash-star-star inside a block comment closes the comment.)
 */
import { readFileSync, existsSync, writeFileSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const git = (args) => {
  try { return execFileSync('git', args, { encoding: 'utf8', stdio: 'pipe' }); }
  catch (e) { return e.stdout ?? ''; }
};

/** Parse the header of a branch index. Returns null if the file or header is absent. */
export function parseBranchIndex(path) {
  if (!existsSync(path)) return null;
  const s = readFileSync(path, 'utf8');
  const sha = /^Derived-at:\s*([0-9a-f]{7,40})\s*$/m.exec(s)?.[1];
  // Take every `  - <glob>` line after `Scope-paths:` until the first line that
  // is neither blank nor a bullet. (`\Z` is Python/Ruby, not JS — an earlier
  // version used it and silently matched nothing, which made a FRESH index look
  // malformed. SKILL §2e: read the source before believing the check.)
  const lines = s.split('\n');
  const start = lines.findIndex((l) => /^Scope-paths:\s*$/.test(l));
  const globs = [];
  if (start >= 0) {
    for (const line of lines.slice(start + 1)) {
      const m = /^\s*-\s+(\S.*?)\s*$/.exec(line);
      if (m) { globs.push(m[1]); continue; }
      if (/^\s*$/.test(line)) continue;
      break;
    }
  }
  return sha && globs.length ? { sha, globs, text: s } : null;
}

/**
 * Build a `claim()` body asserting the index is fresh for HEAD.
 * Usage inside a contract script:
 *
 *   claim('X-00', 'The branch index is fresh for HEAD',
 *         () => branchIndexFresh('docs/specs/relations/sample-economy.branches.md'));
 */
export function branchIndexFresh(path) {
  const idx = parseBranchIndex(path);
  if (!idx) {
    return { ok: false, evidence: `${path}: missing, or its Derived-at / Scope-paths header is malformed — §2g requires both` };
  }
  // Does the recorded SHA exist in this repo at all?
  if (!git(['cat-file', '-t', idx.sha]).trim()) {
    return { ok: false, evidence: `Derived-at ${idx.sha} is not a commit in this repo — the index cannot be checked, so it cannot be trusted` };
  }
  // G3 — an index that cites nothing asserts nothing. Under the old logic
  // zero citations meant `hard=[]` unconditionally, so an empty genesis index
  // was permanently GREEN no matter how stale the scope became — the exact
  // opposite of evidence. Genesis indexes are expected to be filled by the
  // same session that creates them (write-spec's branch-index step); this is
  // the fact that the window must close before the index can be trusted, not
  // a trap sprung on that window.
  const diag = citationDiagnostics(idx.text);
  if (diag.resolved.length === 0) {
    // FIX 7 (reviewer HIGH): "cites nothing" and "cites nothing RESOLVABLE"
    // are different claims — a genuinely blank index vs. one whose citations
    // moved/deleted/are-ambiguous. Conflating them was itself a silence.
    if (diag.tokenCount === 0) {
      return { ok: false, status: 'EMPTY', evidence: 'index cites nothing; an index that asserts nothing is not evidence' };
    }
    // FIX 2 (reviewer HIGH): the EMPTY/UNRESOLVED early-return used to fire
    // before the unresolvable list was ever built into evidence — an index
    // whose only citations are ambiguous was told "cites nothing" with the
    // candidate list swallowed, the exact silence B4/WI-520 exists to end.
    const note = diag.unresolvable.length
      ? formatUnresolvable(diag.unresolvable)
      : 'no matches at any tier — paths may have moved or been deleted';
    return { ok: false, status: 'UNRESOLVED', evidence: `index cites ${diag.tokenCount} token(s) but none resolved to a tracked file: ${note}` };
  }
  // FIX A (reviewer CRITICAL): the shared `git()` helper swallows every
  // failure into `''` — fine for `cat-file`/`ls-files`, where an empty
  // result already fails closed. This call is different: an empty result
  // here is a legitimate "nothing changed", so a swallowed ERROR is
  // indistinguishable from a real empty diff and falls through to
  // `hard=[]`/`soft=[]` → `ok:true` → `[FRESH]` — a land gate (B1 made this
  // a real exit code) green-lighting exactly when it could not do its job.
  // Bypass the shared helper here and fail closed on any git error.
  let changed;
  try {
    changed = execFileSync('git', ['diff', '--name-only', `${idx.sha}..HEAD`, '--', ...idx.globs], { encoding: 'utf8', stdio: 'pipe' })
      .split('\n').map((l) => l.trim()).filter(Boolean);
  } catch (e) {
    return { ok: false, evidence: `git diff failed while checking staleness against ${idx.sha.slice(0, 8)} (${(e.message || 'unknown error').split('\n')[0]}) — cannot verify freshness, failing closed rather than reporting FRESH` };
  }

  // ── Two tiers, because "in my scope-paths" and "a fact I assert" are not the
  // same question, and conflating them makes PARALLEL work impossible.
  //
  // Both this repo's scopes declare `supabase/migrations` and `supabase/functions`
  // as whole directories. Under the old single-tier check, the moment one stream
  // landed ANY migration, every other scope's index went STALE and its contract
  // failed — so two streams mutually invalidated each other on every commit, and
  // neither could ever print STORY ALIGNED. The mechanism blocked exactly the
  // parallelism it was supposed to survive.
  //
  //   HARD FAIL  — a file the index CITES changed. A stated fact may have moved;
  //                the enumeration is not evidence any more.
  //   SOFT WARN  — an in-scope file the index never cites changed. Nothing it
  //                asserts is threatened, but something NEW may exist that the
  //                entry-point axis has not seen. Surfaced, never blocking.
  // A file counts as CITED if the index mentions its full path OR a distinctive
  // tail of it. Indexes cite short-form — `process-sample-activation/index.ts:10`,
  // not the full `supabase/functions/...` path — so matching full paths alone
  // found 17 of them and would have called a genuinely stale index fresh.
  const isCited = (f) => {
    if (idx.text.includes(f)) return true;
    const parts = f.split('/');
    // last two segments, e.g. "process-sample-activation/index.ts"; for a
    // top-level file the basename is already distinctive enough.
    const tail = parts.length >= 2 ? parts.slice(-2).join('/') : parts[0];
    if (idx.text.includes(tail)) return true;
    // migrations and other flat dirs are cited by bare filename, often with a
    // line suffix — `20260726000000:80`. Match the stem before the extension.
    const base = parts[parts.length - 1];
    const stem = base.replace(/\.[A-Za-z0-9]+$/, '');
    return stem.length >= 8 && idx.text.includes(stem);
  };
  const hard = changed.filter(isCited);
  const soft = changed.filter((f) => !isCited(f));
  const cited = { size: hard.length + soft.length };

  // §3f#3 — import-shape check runs against the FULL cited set
  // (`diag.resolved`, the same `citationDiagnostics` pass already run above
  // for the G3 EMPTY check — not a second one), independent of `hard`/`soft`.
  // This is the fix for the reviewer-proven gap: a cited file can lie outside
  // Scope-paths (so `changed` above never sees it even though it's cited), or
  // its content can be byte-identical to what git tracked yet still diverge
  // from what was recorded at the last `--stamp-imports` run. Either way,
  // this check must be able to turn an otherwise-green result red — not
  // merely decorate a STALE result that was already going to fire. A missing
  // sidecar is now a SOFT note (G5), not a silent skip — see
  // `importShapeNote` below.
  const citedFiles = diag.resolved;
  const shapeNote = importShapeNote(path, citedFiles);
  const hardShape = shapeNote?.severity === 'hard' ? shapeNote.note : null;
  const softShape = shapeNote?.severity === 'soft' ? shapeNote.note : null;
  // G9/WI-520 — bare-basename (and now two-segment, FIX 3) tokens that
  // matched ≥2 tracked files were excluded from `diag.resolved` rather than
  // bound to an arbitrary one; this is reported as its own SOFT finding so
  // the ambiguity is never silent. FIX 4: capped via `formatUnresolvable` —
  // an uncapped ambiguous `SKILL.md` alone produced a 103-path single-line
  // evidence string, straight against this batch's own size-bounded bar.
  const unresolvableNote = diag.unresolvable.length ? formatUnresolvable(diag.unresolvable) : '';

  if (hard.length || hardShape) {
    let evidence;
    if (hard.length) {
      const shown = hard.slice(0, 6).join(', ');
      evidence = `STALE — ${hard.length} file(s) THIS INDEX CITES changed since ${idx.sha.slice(0, 8)}: ${shown}${hard.length > 6 ? ', …' : ''}. A stated fact may have moved; re-walk (§2g) and re-stamp Derived-at.`;
    } else {
      evidence = `STALE — import-shape drift on cited file(s) with no Scope-paths diff detected (§3f#3): re-walk (§2g), re-stamp Derived-at, and re-run --stamp-imports.`;
    }
    if (hardShape) evidence += ` · ⚠️ import-shape: ${hardShape}`;
    if (unresolvableNote) evidence += ` · ⚠️ ${unresolvableNote}`;
    return { ok: false, evidence };
  }
  const warnParts = [];
  if (soft.length) warnParts.push(`⚠️ ${soft.length} in-scope file(s) changed that this index does not cite (${soft.slice(0, 3).join(', ')}${soft.length > 3 ? ', …' : ''}) — nothing asserted is threatened, but re-walk the entry-point axis before claiming completeness`);
  if (softShape) warnParts.push(`⚠️ import-shape: ${softShape}`);
  if (unresolvableNote) warnParts.push(`⚠️ ${unresolvableNote}`);
  const warn = warnParts.length ? ` · ${warnParts.join(' · ')}` : '';
  return {
    ok: true,
    evidence: `fresh at ${idx.sha.slice(0, 8)} · ${idx.globs.length} scope-path glob(s) · ${cited.size} cited file(s) unchanged${warn}`,
  };
}

/**
 * §2h — the reviewer must be handed the index and asked what it MISSES.
 *
 * §2g is mechanically enforced (a stale index fails the contract). §2h was prose
 * only, and was therefore skipped on its first outing — the exact failure class
 * the skill exists to prevent. This makes it a claim.
 *
 * The review receipt must exist AND be stamped with the same Derived-at SHA as
 * the index, so re-walking the index re-opens the review obligation.
 */
export function branchIndexReviewed(indexPath, reviewPath) {
  const idx = parseBranchIndex(indexPath);
  if (!idx) return { ok: false, evidence: `${indexPath}: no index to review` };
  if (!existsSync(reviewPath)) {
    return { ok: false, evidence: `${reviewPath} missing — §2h requires the index to be handed to an external reviewer and asked "which branches does this index MISS?"` };
  }
  const r = readFileSync(reviewPath, 'utf8');
  const stamped = /Reviewed-index-at:\s*([0-9a-f]{7,40})/.exec(r)?.[1];
  if (!stamped) return { ok: false, evidence: `${reviewPath}: no "Reviewed-index-at: <sha>" header — cannot tell which index version was reviewed` };
  if (!idx.sha.startsWith(stamped) && !stamped.startsWith(idx.sha)) {
    return { ok: false, evidence: `STALE REVIEW — the index is at ${idx.sha.slice(0, 8)} but the review covers ${stamped.slice(0, 8)}. Re-walking the index re-opens the review obligation.` };
  }
  const asked = /which branches does this index MISS|branches.{0,30}MISS/i.test(r);
  return {
    ok: asked,
    evidence: asked
      ? `reviewed at ${stamped.slice(0, 8)}, and the miss-question was put to the reviewer`
      : `${reviewPath} does not record the §2h question ("which branches does this index MISS?") — a reviewer handed only findings can only check the findings`,
  };
}

/**
 * align-feature §8 — an adversarial review is TWO passes, paired.
 *
 * `review-exec` / `review-cross-model` scope to `git diff main..HEAD`. That finds
 * defects in changed lines and structurally cannot find ABSENCE — what should
 * have changed and did not, an unchanged caller the change broke, or how the
 * feature now reads as a whole. So diff-only rounds move a window across the
 * defect set instead of shrinking it, and the round count climbs without the
 * feature getting safer.
 *
 * Pass 2 is handed the branch INDEX, not a bigger diff, and its stamp must match
 * the index's Derived-at — so re-walking the index re-opens the obligation, the
 * same way §2h works.
 *
 * `reviewGlobs` are paths (already resolved) of align-time review artifacts for
 * this scope. An empty list is reported honestly as "not yet binding" rather
 * than passed off as compliance.
 */
export function reviewsAreTwoPass(indexPath, reviewPaths) {
  const idx = parseBranchIndex(indexPath);
  if (!idx) return { ok: false, evidence: `${indexPath}: no index, so pass 2 has nothing to review against` };
  const present = reviewPaths.filter((p) => existsSync(p));
  if (!present.length) {
    return { ok: true, evidence: `0 align-time review artifacts exist yet — this claim is NOT yet binding, and fires the moment the first one lands` };
  }
  const bad = [];
  for (const p of present) {
    const s = readFileSync(p, 'utf8');
    const hasP1 = /##\s*Pass 1\s*—\s*exact/i.test(s);
    const hasP2 = /##\s*Pass 2\s*—\s*full/i.test(s);
    const stamp = /Reviewed-index-at:\s*([0-9a-f]{7,40})/.exec(s)?.[1];
    const fresh = stamp && (idx.sha.startsWith(stamp) || stamp.startsWith(idx.sha));
    if (!hasP2) { bad.push(`${p}: no "## Pass 2 — full (scope)" — this reviewed an EDIT, not the feature`); continue; }
    if (!hasP1) { bad.push(`${p}: no "## Pass 1 — exact (diff)"`); continue; }
    if (!stamp) { bad.push(`${p}: no Reviewed-index-at — cannot tell which enumeration pass 2 walked`); continue; }
    if (!fresh) bad.push(`${p}: pass 2 walked index ${stamp.slice(0, 8)}, index is now ${idx.sha.slice(0, 8)}`);
  }
  return {
    ok: bad.length === 0,
    evidence: bad.length ? bad.join(' · ') : `${present.length} review artifact(s), each carrying both passes and stamped at ${idx.sha.slice(0, 8)}`,
  };
}

/**
 * §2i — one place per scope. Every OTHER document in the scope must yield to the
 * index by carrying one of three headers, so nothing can quietly claim authority
 * over a scope while going stale.
 *
 *   Derived-at:    <sha>   — it is itself freshness-guarded
 *   Superseded-by: <path>  — historical; the index owns this knowledge now
 *   Scope-note:    <text>  — a narrow artifact that never claimed scope authority
 */
export function scopeDocsYield(indexPath, docPaths) {
  const missing = [];
  for (const p of docPaths) {
    if (!existsSync(p)) continue;
    const s = readFileSync(p, 'utf8').slice(0, 4000);
    const yields = /^(Derived-at|Superseded-by|Scope-note|Reviewed-index-at):/m.test(s);
    if (!yields) missing.push(p);
  }
  return {
    ok: missing.length === 0,
    evidence: missing.length
      ? `${missing.length} scope doc(s) claim authority with no yield header (§2i): ${missing.join(', ')} — add Derived-at, Superseded-by or Scope-note`
      : `${docPaths.length} scope doc(s) checked, all yield to ${indexPath.split('/').pop()}`,
  };
}

/**
 * §3f#3 — direct-import shape comparison (WI-512 Batch 4).
 *
 * Hand-rolled, no `dependency-cruiser` runtime dep — matches `import ... from
 * '...'` and `require('...')` on a single logical line. Good enough for a
 * direct-import set; it does not resolve re-exports or dynamic `import()`.
 *
 * Fix round (review findings, HIGH/MEDIUM): the previous version scraped its
 * own doc comment (this one) for a phantom `"..."` specifier, because
 * `import ... from '...'` written in prose reads exactly like real code to a
 * regex with no comment awareness. Comments are stripped first — best-effort,
 * not a parser: a `//` or `/* *\/` marker inside a STRING literal will still
 * truncate real code on that line, an accepted limitation of a hand-rolled
 * scanner. `require(` is additionally anchored so it must sit at line-start
 * or right after one of `=([,;{}` / whitespace — a `require(` immediately
 * preceded by a quote character (i.e. embedded in a string literal, the
 * `"require('FAKE-STRING-DEP')"` case) no longer matches.
 */
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

const IMPORT_FROM_RE = /(?:^|\n)\s*import\s.*?from\s+['"](.+?)['"]/g;
const REQUIRE_RE = /(?:^|[=(,;{}\s])require\(\s*['"](.+?)['"]\s*\)/g;

export function directImports(content) {
  const stripped = stripComments(content);
  const specs = new Set();
  let m;
  IMPORT_FROM_RE.lastIndex = 0;
  while ((m = IMPORT_FROM_RE.exec(stripped))) { if (m[1]) specs.add(m[1]); }
  REQUIRE_RE.lastIndex = 0;
  while ((m = REQUIRE_RE.exec(stripped))) { if (m[1]) specs.add(m[1]); }
  return [...specs].sort();
}

/**
 * Every `<path>:<line>`-shaped citation in the index text, resolved to a real
 * tracked file, tier by tier: full path, two-segment suffix, bare basename.
 *
 * Fix round: the previous version required `existsSync(rawToken)` — a direct
 * path match only. Real indexes cite SHORT-FORM (per the `isCited` comment
 * above: `process-sample-activation/index.ts:10`, not the full
 * `supabase/functions/...` path), so that direct check silently dropped
 * almost every citation. This resolves short-form tokens against
 * `git ls-files` the same way `isCited` already does.
 *
 * G9/WI-520 fix round: the previous version ran all three tiers as one flat
 * OR test and took `Array.find`'s first hit — for a bare basename like
 * `index.ts` that "first hit" was whichever tracked file `git ls-files`
 * happened to list first, silently binding the citation to an arbitrary
 * same-named file.
 *
 * FIX 3 (reviewer HIGH, sibling of the above): the two-segment tier is NOT
 * disambiguating by construction — `details/about.md` matches 2+ tracked
 * files just as easily as a bare basename can (e.g. two features both
 * carrying a `details/about.md`). It gets the same ≥2-matches →
 * `unresolvable` treatment as the bare-basename tier, not a free pass.
 * `tokenCount` is the raw distinct-token count before any resolution
 * attempt, so a caller can tell "cites nothing" apart from "cites tokens,
 * none resolved" (FIX 7).
 */
export function citationDiagnostics(text) {
  const re = /([\w./-]+\.\w+):(\d+)/g;
  const tokens = new Set();
  let m;
  while ((m = re.exec(text))) tokens.add(m[1]);
  const resolved = new Set();
  const unresolvable = [];
  if (!tokens.size) return { resolved: [], unresolvable, tokenCount: 0 };
  const allFiles = git(['ls-files']).split('\n').map((l) => l.trim()).filter(Boolean);
  for (const token of tokens) {
    if (existsSync(token)) { resolved.add(token); continue; }
    // Two-segment tier only applies when the token itself already names a
    // directory segment (e.g. "index.ts's caller" cited as
    // "process-sample-activation/index.ts") — for a token with no "/" this
    // condition is identical to the bare-basename tier below and must NOT
    // run first, or it silently re-introduces the exact first-match-wins bug
    // this fix closes (a bare "SKILL.md" would "twoSeg"-match every file
    // ending in "/SKILL.md" and take the first one, un-checked for ambiguity).
    if (token.includes('/')) {
      const twoSeg = allFiles.filter((f) => f.endsWith(`/${token}`));
      if (twoSeg.length === 1) { resolved.add(twoSeg[0]); continue; }
      if (twoSeg.length > 1) { unresolvable.push({ token, matches: twoSeg }); continue; }
    }
    const baseMatches = allFiles.filter((f) => f.split('/').pop() === token);
    if (baseMatches.length === 1) { resolved.add(baseMatches[0]); continue; }
    if (baseMatches.length > 1) { unresolvable.push({ token, matches: baseMatches }); continue; }
    // 0 matches at every tier — not a citation this check can verify, and
    // not an error either (prose can legitimately mention a bare filename).
  }
  return { resolved: [...resolved].sort(), unresolvable, tokenCount: tokens.size };
}

/** Back-compat wrapper: resolved citations only, no ambiguity reporting. */
export function extractCitedFiles(text) {
  return citationDiagnostics(text).resolved;
}

/**
 * FIX 4 (reviewer HIGH): every neighbouring evidence list is capped
 * (`hard.slice(0,6)`, `soft.slice(0,3)`) — the unresolvable-candidate list
 * was the one exception, and a single ambiguous `SKILL.md` produced a
 * 103-path one-line evidence string that would land straight in `--all`
 * gate output. Capped at 5 matches per token, "…(+N more)" for the rest.
 */
function formatUnresolvable(list) {
  return list.map((u) => {
    const shown = u.matches.slice(0, 5).join(', ');
    const more = u.matches.length > 5 ? `, …(+${u.matches.length - 5} more)` : '';
    return `unresolvable: ${u.token} matches ${u.matches.length} files [${shown}${more}]`;
  }).join(' · ');
}

/**
 * `--stamp-imports <index-path>` — records the direct-import set of every
 * cited file into a sidecar `<index-path>.imports.json`, so a later freshness
 * check can tell whether a cited file's import SHAPE moved, not just whether
 * some line in it changed.
 *
 * Tracked-or-gitignored decision (G5, reversed from the original follow-up
 * note): the sidecar IS the recording that makes the §3f#3 import-shape
 * check reachable at all — a gitignored sidecar is invisible to any
 * downstream agent or fresh worktree, which is exactly the "unreachable for
 * everyone but the machine that ran --stamp-imports" failure this check was
 * built to close. It is committed, not gitignored.
 */
export function stampImports(indexPath) {
  const idx = parseBranchIndex(indexPath);
  if (!idx) {
    process.stderr.write(`branch-index-freshness --stamp-imports: ${indexPath} has no valid Derived-at/Scope-paths header\n`);
    process.exit(2);
  }
  const cited = extractCitedFiles(idx.text);
  const imports = {};
  for (const file of cited) {
    if (!existsSync(file)) continue;
    imports[file] = directImports(readFileSync(file, 'utf8'));
  }
  const sidecarPath = `${indexPath}.imports.json`;
  writeFileSync(sidecarPath, JSON.stringify({ stamped_at: idx.sha, imports }, null, 2) + '\n');
  process.stdout.write(`stamped ${Object.keys(imports).length} cited file(s) to ${sidecarPath}\n`);
  return sidecarPath;
}

/**
 * Internal to `branchIndexFresh`: for the subset of `files` that both (a)
 * exist in the sidecar recorded at the last `--stamp-imports` run and (b)
 * still exist on disk, diff current vs recorded import sets.
 *
 * Fix round: called against the FULL cited set (`extractCitedFiles`), not
 * just the git-diff-derived `hard` subset. The hole this closes (§3f:722-726,
 * "the claim silently becomes wrong while the check stays green") is
 * precisely the case where a cited file's import shape drifted without
 * `git diff --name-only <sha>..HEAD -- <Scope-paths>` ever seeing it — e.g.
 * the cited file lies outside the declared Scope-paths globs.
 *
 * G5 fix round: a missing sidecar used to be a SILENT skip (returned `null`,
 * indistinguishable from "checked, no drift") — invisible to any downstream
 * agent, which is what made the check unreachable for everyone but the
 * machine that last ran `--stamp-imports`. Returns `{severity:'soft', note}`
 * instead when the index DOES cite files but was never stamped, and
 * `{severity:'hard', note}` when a stamped file's import set actually moved
 * — still `null` only when there is genuinely nothing to report (no cited
 * files, or a stamped sidecar with zero drift).
 */
function importShapeNote(indexPath, files) {
  const sidecarPath = `${indexPath}.imports.json`;
  if (!existsSync(sidecarPath)) {
    return files.length ? { severity: 'soft', note: 'imports never stamped — run --stamp-imports' } : null;
  }
  let sidecar;
  try { sidecar = JSON.parse(readFileSync(sidecarPath, 'utf8')); }
  catch {
    // FIX B (reviewer HIGH): an unparseable sidecar used to be silently
    // indistinguishable from "checked, no drift" (`null`). This matters more
    // now than before this batch: B3 made `.imports.json` a COMMITTED,
    // mergeable file, so a merge-conflict-marked (or otherwise corrupted)
    // sidecar is now a real, reachable state — and it would have silently
    // disabled this entire check while the index still read FRESH.
    return { severity: 'soft', note: 'sidecar unparseable — re-run --stamp-imports' };
  }
  const recorded = sidecar.imports || {};
  const driftNotes = [];
  const unrecorded = [];
  for (const file of files) {
    if (!existsSync(file)) continue;
    if (!(file in recorded)) {
      // FIX C (reviewer MEDIUM): a citation added after the last stamp was
      // silently skipped here — the "never stamped" SOFT note only fired
      // when the sidecar was wholly ABSENT. This partial case is the NORMAL
      // state whenever an agent appends an axis row and forgets to re-run
      // --stamp-imports (exactly what both restamp paragraphs warn about);
      // it must announce itself too, not stay silent.
      unrecorded.push(file);
      continue;
    }
    const before = new Set(recorded[file]);
    const after = new Set(directImports(readFileSync(file, 'utf8')));
    const added = [...after].filter((s) => !before.has(s));
    const removed = [...before].filter((s) => !after.has(s));
    if (added.length || removed.length) {
      const bits = [];
      if (added.length) bits.push(`+${added.join(',')}`);
      if (removed.length) bits.push(`-${removed.join(',')}`);
      driftNotes.push(`${file} (${bits.join(' ')})`);
    }
  }
  if (driftNotes.length) return { severity: 'hard', note: driftNotes.join('; ') };
  if (unrecorded.length) return { severity: 'soft', note: `cited but never stamped: ${unrecorded.join(', ')} — run --stamp-imports` };
  return null;
}

// ── CLI: `node scripts/branch-index-freshness.mjs --stamp-imports <index-path>`
// The rest of this module is a library (imported for its exported functions);
// this is its only direct-invocation entry point. Unlike check-branch-index.mjs
// this file IS imported elsewhere (branchIndexFresh etc.), so the guard can't
// simply be deleted — it must stay accurate. FIX 1 (reviewer CRITICAL, sibling
// bug): comparing raw `process.argv[1]` (the invoked path) against
// `fileURLToPath(import.meta.url)` (Node's resolved REALPATH of the module)
// silently mismatches when this script is invoked through a symlink — exactly
// how svc installs `scripts/` into every host farm — making `--stamp-imports`
// a silent no-op and starving the import-shape check of sidecars. Resolve
// argv[1] to its realpath before comparing.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const flagIdx = process.argv.indexOf('--stamp-imports');
  if (flagIdx === -1) {
    process.stderr.write('branch-index-freshness: usage: --stamp-imports <index-path>\n');
    process.exit(2);
  }
  const indexPath = process.argv[flagIdx + 1];
  if (!indexPath) {
    process.stderr.write('branch-index-freshness: --stamp-imports requires <index-path>\n');
    process.exit(2);
  }
  stampImports(indexPath);
}
