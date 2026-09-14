#!/usr/bin/env node
// svc-json-merge-driver — deterministic 3-way merge for mutable .svc/*.json state.
//
// WHY (WI-398): parallel orchestrator sessions (the user multi-clauds ~25% of
// the time) collide on mutable .svc/*.json state. `merge=union` (used for
// .jsonl) CORRUPTS JSON — it concatenates both sides into `{...}{...}`, invalid
// JSON. There is no built-in git driver that merges JSON safely, so this is it.
//
// Git invokes:  node svc-json-merge-driver.mjs %O %A %B %P
//   %O = ancestor (base) blob path       argv[2]
//   %A = ours blob path (WRITE result)   argv[3]
//   %B = theirs blob path                argv[4]
//   %P = pathname in repo (messages)     argv[5]
// Exit 0 = merged cleanly (result written to %A). Non-0 = conflict; the driver
// writes STANDARD conflict markers into %A (both versions verbatim, invalid
// JSON) so the conflict is VISIBLE and cannot be silently `git add`ed away
// (Gemini G6 #1). If this driver is NOT registered in a clone's .git/config,
// git silently falls back to its default text merge (conflict markers on
// overlap) — also safe. The driver is therefore a strict, non-breaking UPGRADE:
// it auto-resolves the realistic parallel case (two sessions add different keys
// / array elements) and conflicts ONLY on a TRUE overlapping edit.
//
// LOSSLESS BY CONSTRUCTION: every key/element present on either side survives a
// clean merge (object keys deep-merge; arrays use a 3-way MULTISET merge that
// preserves duplicates and honors both sides' additions/deletions — Gemini G6
// #2). Identity/equality use a CANONICAL key-sorted serialization so key-order
// differences never spuriously duplicate or split data (Gemini G6 #3).
// FOREIGN-WORKTREE SAFE (AC3): operates ONLY on the absolute paths git passes as
// argv — never reads cwd, never `chdir`s, never writes a relative `.svc/` path.

import fs from "node:fs";

const [, , basePath, oursPath, theirsPath, repoPath = "<unknown>"] = process.argv;

class Conflict extends Error {}

// Canonical serialization: recursively sort object keys so equality and array
// identity are independent of property order (Gemini G6 #3).
function canon(x) {
  if (x === null || typeof x !== "object") return JSON.stringify(x) ?? "null";
  if (Array.isArray(x)) return "[" + x.map(canon).join(",") + "]";
  return "{" + Object.keys(x).sort().map((k) => JSON.stringify(k) + ":" + canon(x[k])).join(",") + "}";
}
const deepEqual = (a, b) => canon(a) === canon(b);
const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

function readRaw(p) { try { return fs.readFileSync(p, "utf8"); } catch { return ""; } }
function parseMaybe(raw) {
  if (raw.trim() === "") return { ok: true, val: undefined };   // missing/empty ancestor is legal
  try { return { ok: true, val: JSON.parse(raw) }; }
  catch (e) { return { ok: false, err: e.message }; }
}

// Stable id of an array element: a real id field if present, else its canonical
// value. Lets keyed collections (tasks/receipts) merge by id and scalar/id-less
// arrays merge by value.
const idField = (el) => isObj(el) ? (el.id ?? el.task_id ?? el.ac_id ?? el.sha ?? el.key) : undefined;
const idOf = (el) => { const f = idField(el); return f !== undefined ? "#" + String(f) : "=" + canon(el); };
const allKeyed = (arr) => arr.length > 0 && arr.every((el) => idField(el) !== undefined);

// 3-way MULTISET merge for id-less / primitive arrays: result count per distinct
// value = max(0, ours + theirs - base) — preserves duplicates, merges disjoint
// additions, honors deletions. Deterministic emission order: base, then ours-new,
// then theirs-new.
function mergeMultiset(base, ours, theirs) {
  const baseArr = Array.isArray(base) ? base : [];
  const countBy = (arr) => { const m = new Map(); for (const el of arr) { const k = canon(el); m.set(k, (m.get(k) || 0) + 1); } return m; };
  const bc = countBy(baseArr), oc = countBy(ours), tc = countBy(theirs);
  const want = new Map();
  for (const k of new Set([...bc.keys(), ...oc.keys(), ...tc.keys()])) {
    const c = Math.max(0, (oc.get(k) || 0) + (tc.get(k) || 0) - (bc.get(k) || 0));
    if (c > 0) want.set(k, c);
  }
  const out = [], done = new Map();
  const emit = (el) => { const k = canon(el); const w = want.get(k) || 0; const d = done.get(k) || 0; if (d < w) { out.push(el); done.set(k, d + 1); } };
  for (const el of baseArr) emit(el);
  for (const el of ours) emit(el);
  for (const el of theirs) emit(el);
  return out;
}

// 3-way merge of one node. Throws Conflict on a genuine overlapping edit.
function merge3(base, ours, theirs) {
  if (deepEqual(ours, theirs)) return ours;   // identical edit, or both unchanged
  if (deepEqual(base, ours)) return theirs;   // only theirs changed
  if (deepEqual(base, theirs)) return ours;   // only ours changed

  if (isObj(ours) && isObj(theirs)) {
    const b = isObj(base) ? base : {};
    const out = {};
    for (const k of new Set([...Object.keys(ours), ...Object.keys(theirs)])) {
      const inO = has(ours, k), inT = has(theirs, k), inB = has(b, k);
      if (inO && inT) out[k] = merge3(inB ? b[k] : undefined, ours[k], theirs[k]);
      else if (inO) {
        if (inB && deepEqual(b[k], ours[k])) continue;                 // theirs deleted unmodified key → honor delete
        if (inB && !deepEqual(b[k], ours[k])) throw new Conflict(`key "${k}": ours modified, theirs deleted`);
        out[k] = ours[k];                                              // ours added → keep
      } else {
        if (inB && deepEqual(b[k], theirs[k])) continue;               // ours deleted unmodified key → honor delete
        if (inB && !deepEqual(b[k], theirs[k])) throw new Conflict(`key "${k}": theirs modified, ours deleted`);
        out[k] = theirs[k];                                            // theirs added → keep
      }
    }
    return out;
  }

  if (Array.isArray(ours) && Array.isArray(theirs)) {
    // Keyed collections (every element on both sides carries a stable id) merge
    // element-wise so same-id bodies merge or conflict; everything else uses the
    // lossless multiset merge.
    if (!allKeyed(ours) || !allKeyed(theirs)) return mergeMultiset(base, ours, theirs);
    const bArr = Array.isArray(base) ? base : [];
    const bMap = new Map(bArr.map((el) => [idOf(el), el]));
    const oMap = new Map(ours.map((el) => [idOf(el), el]));
    const tMap = new Map(theirs.map((el) => [idOf(el), el]));
    const order = [], seen = new Set();
    for (const el of [...ours, ...theirs]) { const id = idOf(el); if (!seen.has(id)) { order.push(id); seen.add(id); } }
    const out = [];
    for (const id of order) {
      const inO = oMap.has(id), inT = tMap.has(id), inB = bMap.has(id);
      if (inO && inT) out.push(merge3(inB ? bMap.get(id) : undefined, oMap.get(id), tMap.get(id)));
      else if (inO) {
        if (inB && deepEqual(bMap.get(id), oMap.get(id))) continue;    // theirs dropped unmodified element → delete
        if (inB) throw new Conflict(`array element "${id}": ours modified, theirs deleted`);
        out.push(oMap.get(id));                                        // ours added → keep
      } else {
        if (inB && deepEqual(bMap.get(id), tMap.get(id))) continue;    // ours dropped unmodified element → delete
        if (inB) throw new Conflict(`array element "${id}": theirs modified, ours deleted`);
        out.push(tMap.get(id));                                        // theirs added → keep
      }
    }
    return out;
  }

  // scalar vs scalar, or a type change (object↔array↔scalar) — both diverged.
  throw new Conflict(`overlapping edit (ours=${JSON.stringify(ours)} theirs=${JSON.stringify(theirs)})`);
}

const oursRaw = readRaw(oursPath);
const theirsRaw = readRaw(theirsPath);
const ours = parseMaybe(oursRaw);
const theirs = parseMaybe(theirsRaw);
const base = parseMaybe(readRaw(basePath));

// Write standard conflict markers into %A so the conflict is VISIBLE and cannot
// be silently resolved by `git add` (both sides preserved verbatim, invalid
// JSON). Then exit non-zero so git records the unmerged path (Gemini G6 #1).
function writeConflict(reason) {
  const markers =
    `<<<<<<< ours (svc-json: ${reason})\n` +
    (oursRaw.endsWith("\n") ? oursRaw : oursRaw + "\n") +
    `=======\n` +
    (theirsRaw.endsWith("\n") ? theirsRaw : theirsRaw + "\n") +
    `>>>>>>> theirs\n`;
  try { fs.writeFileSync(oursPath, markers); } catch { /* leave %A as-is; git still flags unmerged */ }
  process.stderr.write(`svc-json-merge: ${repoPath}: ${reason} — wrote conflict markers for manual resolution\n`);
  process.exit(1);
}

if (!ours.ok || !theirs.ok) {
  writeConflict(`unparseable JSON (${!ours.ok ? "ours" : "theirs"}: ${(!ours.ok ? ours.err : theirs.err)})`);
}

try {
  const merged = merge3(base.val, ours.val, theirs.val);
  fs.writeFileSync(oursPath, JSON.stringify(merged, null, 2) + "\n");
  process.exit(0);
} catch (e) {
  if (e instanceof Conflict) writeConflict(e.message);
  process.stderr.write(`svc-json-merge: ${repoPath}: ${e.stack || e.message}\n`);
  process.exit(1);
}
