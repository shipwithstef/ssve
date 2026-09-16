#!/usr/bin/env node
/**
 * Dual-pass scout assignment and coverage accounting.
 * No provider launches. Frozen snapshot ObjectRefs only.
 */
import { canonicalJson, sha256Bytes, sha256Utf8, CoverageGap, DEFAULT_LIMITS, getByRef, validateRoleOutput } from "./two-box-protocol.mjs";

const KEYWORDS = new Set(["if", "for", "while", "switch", "catch", "return", "function", "typeof", "await", "new", "throw", "case"]);
const FWD_KIND = new Set(["requirement", "entrypoint"]);
const REV_KIND = new Set(["internal", "consumer", "test", "lifecycle"]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sid(prefix, value) {
  return `${prefix}:${sha256Utf8(canonicalJson(value))}`;
}

function requireInt(n, label) {
  if (!Number.isInteger(n) || n < 1) throw new Error(`${label} must be integer >= 1`);
  return n;
}

function rootKey(r) {
  return `${r.path}:${r.start_line}:${r.end_line}`;
}

function isTestPath(p) {
  return /(^|\/)(?:tests?|evals|test-framework)\//.test(p) || /\.(?:test|spec)\./.test(p) || /(^|\/)test-/.test(p);
}

function isLifecyclePath(p) {
  return /(^|\/)(?:hooks|setup)\//.test(p) || /(?:install-git-hooks|lifecycle)/.test(p);
}

function posixNorm(rel) {
  const raw = String(rel).replace(/\\/g, "/");
  if (raw.startsWith("/") || raw.startsWith("~") || raw.includes("\0")) return null;
  const out = [];
  for (const part of raw.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!out.length) return null;
      out.pop();
    } else out.push(part);
  }
  return out.join("/");
}

function joinRel(fromPath, spec) {
  const dir = fromPath.split("/").slice(0, -1).join("/");
  return dir ? `${dir}/${spec}` : spec;
}

function matchScoped(norm, pathSet) {
  if (!norm) return null;
  if (pathSet.has(norm)) return norm;
  for (const ext of [".mjs", ".js", ".cjs", ".ts", ".md"]) {
    if (pathSet.has(norm + ext)) return norm + ext;
  }
  for (const idx of ["/index.mjs", "/index.js", "/index.cjs"]) {
    if (pathSet.has(norm + idx)) return norm + idx;
  }
  return null;
}

function requireContract(contract) {
  if (!isPlainObject(contract)) throw new Error("initialContract must be the Contract output object");
  if (Object.keys(contract).some((k) => /open/i.test(k))) {
    throw new Error("orchestration provides Contract only; Open plan option refused");
  }
  if (typeof contract.plan !== "string" || !contract.plan) throw new Error("initialContract.plan required");
  if (!Array.isArray(contract.decisions) || contract.decisions.length < 1) {
    throw new Error("initialContract must be Contract output, never Open");
  }
  for (const d of contract.decisions) {
    if (!isPlainObject(d) || typeof d.id !== "string" || !d.id) throw new Error("invalid Contract decision");
    if (!Array.isArray(d.original_requirement_ids) || d.original_requirement_ids.length < 1) throw new Error("invalid Contract decision");
    if (typeof d.text !== "string" || !d.text) throw new Error("invalid Contract decision");
    if (!Array.isArray(d.source_citations)) throw new Error("invalid Contract decision");
    for (const c of d.source_citations) {
      if (!isPlainObject(c) || typeof c.path !== "string" || !c.path) throw new Error("invalid source citation");
      if (!Number.isInteger(c.start_line) || !Number.isInteger(c.end_line) || c.start_line < 1 || c.end_line < c.start_line) {
        throw new Error("invalid source citation range");
      }
    }
  }
  return contract;
}

function requireSnapshot(snapshot) {
  if (!isPlainObject(snapshot)) throw new Error("sourceSnapshot required");
  if ("source_tree" in snapshot) throw new Error("user-invented source_tree refused");
  if (!Array.isArray(snapshot.scoped_files)) throw new Error("sourceSnapshot.scoped_files required");
  return snapshot;
}

function loadSources(snapshot, consumerRoot) {
  if (typeof consumerRoot !== "string" || !consumerRoot) throw new Error("consumerRoot required");
  const files = [];
  const byPath = new Map();
  for (const sf of snapshot.scoped_files) {
    if (!isPlainObject(sf) || typeof sf.path !== "string" || !sf.path) throw new Error("scoped_files entry path required");
    if (!isPlainObject(sf.object_ref)) throw new Error(`scoped file missing object_ref: ${sf.path}`);
    const got = getByRef(sf.object_ref, { start: consumerRoot });
    const bytes = Buffer.isBuffer(got.bytes) ? got.bytes : Buffer.from(got.bytes ?? []);
    const sha = sha256Bytes(bytes);
    if ((sf.retained_sha256 || sf.sha256) !== sha) throw new Error(`CAS object does not match retained snapshot hash: ${sf.path}`);
    if (sf.object_ref.sha256 && sf.object_ref.sha256 !== sha) throw new Error(`object_ref.sha256 mismatch: ${sf.path}`);
    if (Number.isInteger(sf.retained_bytes) && bytes.length !== sf.retained_bytes) throw new Error(`retained_bytes mismatch: ${sf.path}`);
    const rec = {
      path: sf.path,
      sha256: sf.sha256 || sha,
      retained_sha256: sha,
      truncated: sf.truncated === true,
      ranges: Array.isArray(sf.ranges) ? sf.ranges : [],
      lines: bytes.toString("utf8").split("\n"),
    };
    rec.symbols = scanSymbols(rec.lines);
    rec.refs = scanRefs(rec.lines);
    files.push(rec);
    byPath.set(rec.path, rec);
  }
  return { files, byPath };
}

// These bytes come from the immutable Contract input, never a later disk read.
// Keep them separate from factual source so Open and traversal roots stay intact.
export function constraintSources(constraints = { paths: [] }) {
  if (!isPlainObject(constraints) || Object.keys(constraints).join() !== "paths" || !Array.isArray(constraints.paths)) {
    throw new CoverageGap("constraints.paths required");
  }
  const seen = new Set();
  return constraints.paths.map((file) => {
    if (!isPlainObject(file) || Object.keys(file).sort().join() !== "path,sha256,text"
        || typeof file.path !== "string" || !file.path || posixNorm(file.path) !== file.path
        || file.path.includes("\\") || file.path === ".git" || file.path.startsWith(".git/")
        || typeof file.text !== "string" || seen.has(file.path)) {
      throw new CoverageGap("invalid or duplicate constraint path/text");
    }
    const bytes = Buffer.from(file.text, "utf8");
    if (bytes.includes(0) || bytes.length > DEFAULT_LIMITS.maxBytes || sha256Bytes(bytes) !== file.sha256) {
      throw new CoverageGap(`constraint bytes/hash mismatch or text budget exceeded: ${file.path}`);
    }
    seen.add(file.path);
    return { path: file.path, sha256: file.sha256, retained_sha256: file.sha256,
      truncated: false, ranges: [], lines: file.text.split("\n"), symbols: [], refs: [] };
  });
}

function scanSymbols(lines) {
  const symbols = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const exported = /\bexport\b/.test(line);
    let m = line.match(/\bfunction\s+(\w+)/);
    if (!m) m = line.match(/\b(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:function\b|\()/);
    if (m && !KEYWORDS.has(m[1])) symbols.push({ name: m[1], line: i + 1, exported });
  }
  return symbols;
}

function scanRefs(lines) {
  const refs = [];
  const fromRe = /\b(?:import|export)\b(?:\s+type)?[^'"\n;]*?\bfrom\s*["']([^"']+)["']/;
  const sideRe = /\bimport\s*["']([^"']+)["']/;
  const reqRe = /\brequire\s*\(\s*["']([^"']+)["']\s*\)/;
  const dynRe = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/;
  const srcRe = /["'`]((?:\.\/|\.\.\/)?[\w@./+-]+\.(?:mjs|cjs|js|ts|md))["'`]/g;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ln = i + 1;
    let m;
    if ((m = line.match(fromRe))) refs.push({ kind: "import", spec: m[1], line: ln });
    if ((m = line.match(sideRe))) refs.push({ kind: "import", spec: m[1], line: ln });
    if ((m = line.match(reqRe))) refs.push({ kind: "require", spec: m[1], line: ln });
    if ((m = line.match(dynRe))) refs.push({ kind: "import", spec: m[1], line: ln });
    srcRe.lastIndex = 0;
    while ((m = srcRe.exec(line))) {
      if (!refs.some((r) => r.line === ln && r.spec === m[1])) refs.push({ kind: "source", spec: m[1], line: ln });
    }
  }
  return refs;
}

function resolveRef(fromPath, spec, pathSet) {
  if (spec.startsWith("node:") || spec.startsWith("/")) return { hit: null, missing: false };
  const relative = spec.startsWith("./") || spec.startsWith("../");
  const norm = posixNorm(relative ? joinRel(fromPath, spec) : spec);
  const hit = matchScoped(norm, pathSet);
  if (hit) return { hit, missing: false };
  return { hit: null, missing: relative, path: norm };
}

function inRetained(file, start, end) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) return false;
  if (end > file.lines.length) return false;
  if (!file.ranges.length) return true;
  return file.ranges.some((r) => r.start_line <= start && r.end_line >= end);
}

function classify(file, start, requirementIds) {
  if (isTestPath(file.path)) return "test";
  if (isLifecyclePath(file.path)) return "lifecycle";
  const sym = file.symbols.find((s) => s.line === start) || file.symbols.find((s) => s.line <= start);
  if (requirementIds?.length && (!sym || sym.exported)) return "requirement";
  if (sym?.exported) return "entrypoint";
  return sym ? "internal" : "entrypoint";
}

function uniqueRoots(list) {
  const seen = new Set();
  const out = [];
  for (const r of list) {
    const k = rootKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

function lineSplit(file) {
  const available = file.lines.flatMap((text, index) => text.trim() && inRetained(file, index + 1, index + 1) ? [index + 1] : []);
  if (available.length < 2) return [];
  const symbols = file.symbols.filter(symbol => available.includes(symbol.line));
  const first = symbols[0]?.line ?? available[0];
  const last = available.findLast(line => line !== first);
  if (!last) return [];
  return [
    {path:file.path,start_line:first,end_line:first,kind:"entrypoint",seed:"retained source entry"},
    {path:file.path,start_line:last,end_line:last,kind:"internal",seed:"retained source consumer/lifecycle boundary"},
  ];
}

function buildGraph(files) {
  const pathSet = new Set(files.map((f) => f.path));
  const edges = [];
  const gaps = [];
  const seenGap = new Set();
  const addGap = (g) => {
    const k = canonicalJson({ path: g.path ?? null, reason: g.reason, start_line: g.start_line ?? null, end_line: g.end_line ?? null });
    if (seenGap.has(k)) return;
    seenGap.add(k);
    gaps.push(g);
  };
  for (const file of files) {
    for (const ref of file.refs) {
      const resolved = resolveRef(file.path, ref.spec, pathSet);
      if (resolved.missing) {
        addGap({
          id: sid("gap", { path: resolved.path, reason: "relative import not in source snapshot", line: ref.line }),
          path: resolved.path || null,
          reason: "relative import not in source snapshot",
          start_line: ref.line,
          end_line: ref.line,
          consequential: true,
        });
        continue;
      }
      if (!resolved.hit) continue;
      const dest = files.find((f) => f.path === resolved.hit);
      const kind = isTestPath(file.path) && (ref.kind === "import" || ref.kind === "require" || ref.kind === "source") ? "test" : ref.kind;
      edges.push({
        from: { path: file.path, line: ref.line, symbol: ref.spec },
        to: { path: dest.path, line: dest.symbols[0]?.line || 1, symbol: dest.symbols[0]?.name || dest.path },
        kind,
        derivation: "heuristic",
        evidence: `heuristic ${kind} ${JSON.stringify(ref.spec)} at ${file.path}:${ref.line}`,
      });
    }
  }
  for (const file of files) {
    for (const d of file.symbols) {
      if (d.name.length < 2) continue;
      const call = new RegExp(`\\b${d.name}\\s*\\(`);
      for (const other of files) {
        for (let i = 0; i < other.lines.length; i++) {
          if (other.path === file.path && i + 1 === d.line) continue;
          if (!call.test(other.lines[i])) continue;
          const kind = isTestPath(other.path) ? "test" : "caller";
          edges.push({
            from: { path: other.path, line: i + 1, symbol: d.name },
            to: { path: file.path, line: d.line, symbol: d.name },
            kind,
            derivation: "heuristic",
            evidence: `heuristic ${kind} ${d.name}() at ${other.path}:${i + 1} -> ${file.path}:${d.line}`,
          });
        }
      }
    }
  }
  edges.sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
  return { edges, gaps };
}

function collectCandidates(contract, files, byPath, edges, changeArchetype, gaps, contextByPath = new Map()) {
  const cands = [];
  for (const d of contract.decisions) {
    for (const c of d.source_citations) {
      const file = byPath.get(c.path) || contextByPath.get(c.path);
      if (!file) {
        gaps.push({
          id: sid("gap", { path: c.path, reason: "cited path not in source snapshot" }),
          path: c.path,
          reason: "cited path not in source snapshot",
          start_line: c.start_line,
          end_line: c.end_line,
          consequential: true,
        });
        continue;
      }
      if (!inRetained(file, c.start_line, c.end_line)) {
        gaps.push({
          id: sid("gap", { path: c.path, reason: file.truncated ? "cited range exceeds truncated snapshot" : "cited range not in retained snapshot" }),
          path: c.path,
          reason: file.truncated ? "cited range exceeds truncated snapshot" : "cited range not in retained snapshot",
          start_line: c.start_line,
          end_line: c.end_line,
          consequential: true,
        });
        continue;
      }
      // Constraint excerpts are supplied to both scouts, outside their distinct
      // traversal roots. They must still resolve the Contract's source citations.
      if (contextByPath.has(c.path)) continue;
      cands.push({
        path: c.path,
        start_line: c.start_line,
        end_line: c.end_line,
        kind: classify(file, c.start_line, d.original_requirement_ids),
        seed: "citation",
        decision_id: d.id,
        requirement_ids: d.original_requirement_ids,
      });
    }
  }
  for (const file of files) {
    for (const s of file.symbols) {
      cands.push({
        path: file.path,
        start_line: s.line,
        end_line: s.line,
        kind: s.exported ? "entrypoint" : "internal",
        seed: changeArchetype,
      });
    }
  }
  for (const e of edges) {
    const kind = e.kind === "test" ? "test" : isLifecyclePath(e.from.path) ? "lifecycle" : "consumer";
    cands.push({ path: e.from.path, start_line: e.from.line, end_line: e.from.line, kind, seed: "graph" });
    cands.push({ path: e.to.path, start_line: e.to.line, end_line: e.to.line, kind: "internal", seed: "graph" });
  }
  return uniqueRoots(cands).filter(root => inRetained(byPath.get(root.path), root.start_line, root.end_line));
}

function pickDual(cands, files) {
  let forward = uniqueRoots(cands.filter((c) => FWD_KIND.has(c.kind)));
  let reverse = uniqueRoots(cands.filter((c) => REV_KIND.has(c.kind)));
  const fill = () => {
    for (const file of files) {
      for (const extra of lineSplit(file)) {
        if (FWD_KIND.has(extra.kind)) forward.push(extra);
        else reverse.push(extra);
      }
    }
    forward = uniqueRoots(forward);
    reverse = uniqueRoots(reverse);
  };
  if (!forward.length || !reverse.length) fill();
  const fkeys = new Set(forward.map(rootKey));
  reverse = reverse.filter((r) => !fkeys.has(rootKey(r)));
  if (!forward.length || !reverse.length) fill();
  reverse = reverse.filter((r) => !new Set(forward.map(rootKey)).has(rootKey(r)));
  if (!forward.length || !reverse.length) {
    const split = files.map(lineSplit).find(roots => roots.length === 2);
    if (!split) throw new CoverageGap("two distinct retained source roots are unavailable");
    forward = [split[0]];
    reverse = [split[1]];
  }
  if (!forward.length || !reverse.length) throw new CoverageGap("empty scout assignment");
  return { forward: forward.slice(0, 4), reverse: reverse.slice(0, 4) };
}

function clipWindow(file, root, maxExcerptLines) {
  const bounds = file.ranges.length ? file.ranges : [{ start_line: 1, end_line: file.lines.length || 1 }];
  const bound = bounds.find((r) => r.start_line <= root.start_line && r.end_line >= root.end_line);
  if (!bound) throw new CoverageGap("assignment root is outside declared source ranges");
  const span = Math.min(maxExcerptLines, root.end_line - root.start_line + 1);
  let start = root.start_line;
  let end = Math.min(bound.end_line, file.lines.length, start + span - 1);
  const pad = Math.max(0, Math.floor((maxExcerptLines - (end - start + 1)) / 2));
  start = Math.max(bound.start_line, start - pad);
  end = Math.min(bound.end_line, file.lines.length, end + pad);
  if (end - start + 1 > maxExcerptLines) end = start + maxExcerptLines - 1;
  if (end < start) end = start;
  return { start, end };
}

function selectExcerpts(byPath, roots, maxExcerptLines, maxTotalBytes, gaps) {
  const excerpts = [];
  let used = 0;
  const seen = new Set();
  for (const root of roots) {
    const file = byPath.get(root.path);
    if (!file) continue;
    const win = clipWindow(file, root, maxExcerptLines);
    let start = win.start;
    let end = win.end;
    let text = file.lines.slice(start - 1, end).join("\n");
    let buf = Buffer.from(text, "utf8");
    while (end > start && used + buf.length > maxTotalBytes) {
      end -= 1;
      text = file.lines.slice(start - 1, end).join("\n");
      buf = Buffer.from(text, "utf8");
    }
    if (used + buf.length > maxTotalBytes) {
      gaps.push({
        id: sid("gap", { path: file.path, reason: "excerpt exceeds maxTotalBytes", start, end: win.end }),
        path: file.path,
        reason: "excerpt exceeds maxTotalBytes",
        start_line: start,
        end_line: win.end,
        consequential: true,
      });
      continue;
    }
    if (end < win.end) {
      gaps.push({
        id: sid("gap", { path: file.path, reason: "excerpt truncated to byte budget", start: end + 1, end: win.end }),
        path: file.path,
        reason: "excerpt truncated to byte budget",
        start_line: end + 1,
        end_line: win.end,
        consequential: true,
      });
    }
    const key = `${file.path}:${start}:${end}`;
    if (seen.has(key)) continue;
    seen.add(key);
    used += buf.length;
    excerpts.push({
      path: file.path,
      start_line: start,
      end_line: end,
      text,
      source_blob_sha256: file.sha256,
      input_excerpt_sha256: sha256Utf8(text),
    });
    if (file.truncated) {
      gaps.push({
        id: sid("gap", { path: file.path, reason: "scoped source truncated in snapshot" }),
        path: file.path,
        reason: "scoped source truncated in snapshot",
        start_line: start,
        end_line: end,
        consequential: true,
      });
    }
  }
  if (!excerpts.length) throw new CoverageGap("empty scout assignment");
  return excerpts;
}

function denominator(excerpts) {
  const files = [...new Set(excerpts.map((e) => e.path))].sort();
  const ranges = excerpts
    .map((e) => ({ path: e.path, start_line: e.start_line, end_line: e.end_line }))
    .sort((a, b) => a.path.localeCompare(b.path) || a.start_line - b.start_line || a.end_line - b.end_line);
  return { files, ranges };
}

function questionsFor(role, roots, changeArchetype) {
  const locs = roots.map((r) => `${r.path}:${r.start_line}-${r.end_line}`).join(", ");
  const texts = role === "scout_forward"
    ? [
      `What forward dependencies and state transitions do requirement/entrypoint roots [${locs}] introduce for this ${changeArchetype} change?`,
      `Which tests cover the caller-facing behavior seeded by [${locs}]?`,
    ]
    : [
      `Which inbound callers or consumers depend on internals at [${locs}]?`,
      `What lifecycle or regression path would break if [${locs}] changed?`,
    ];
  return texts.map((text) => ({
    id: sid("q", { role, text }),
    text,
    consequential: true,
    root_ids: roots.map((r) => r.id),
  }));
}

function incidentEdges(edges, paths) {
  return edges.filter((e) => paths.has(e.from.path) || paths.has(e.to.path));
}

function stampRoots(role, roots) {
  return roots.map((r) => ({
    id: sid("root", { role, path: r.path, start_line: r.start_line, end_line: r.end_line }),
    path: r.path,
    start_line: r.start_line,
    end_line: r.end_line,
    kind: r.kind,
    seed: r.seed,
  }));
}

function buildAssignment(role, rawRoots, byPath, edges, changeArchetype, maxExcerptLines, maxTotalBytes, priorGaps, contextFiles = []) {
  const gaps = [...priorGaps];
  const roots = stampRoots(role, rawRoots);
  const contextRoots = contextFiles.map(file => {
    if (file.lines.length > maxExcerptLines) gaps.push({
      id: sid("gap", { path: file.path, reason: "constraint exceeds excerpt line budget", start: maxExcerptLines + 1 }),
      path: file.path, reason: "constraint exceeds excerpt line budget",
      start_line: maxExcerptLines + 1, end_line: file.lines.length, consequential: true,
    });
    return { path: file.path, start_line: 1, end_line: Math.min(file.lines.length, maxExcerptLines) };
  });
  const supplied = new Map([...byPath, ...contextFiles.map(file => [file.path, file])]);
  const excerpts = selectExcerpts(supplied, [...roots, ...contextRoots], maxExcerptLines, maxTotalBytes, gaps);
  const supplied_denominator = denominator(excerpts);
  const questions = questionsFor(role, roots, changeArchetype);
  const known_gaps = uniqueGaps(gaps);
  const body = {
    change_archetype: changeArchetype,
    roots,
    questions,
    relationship_edges: incidentEdges(edges, new Set(supplied_denominator.files)),
    excerpts,
    supplied_denominator,
    known_gaps,
  };
  return { id: sha256Utf8(canonicalJson({ role, ...body })), role, ...body };
}

function uniqueGaps(gaps) {
  const map = new Map();
  for (const g of gaps) {
    const key = canonicalJson({ path: g.path ?? null, reason: g.reason, start_line: g.start_line ?? null, end_line: g.end_line ?? null });
    if (!map.has(key)) map.set(key, g);
  }
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function fingerprint(a) {
  return canonicalJson({
    roots: a.roots.map((r) => ({ path: r.path, start_line: r.start_line, end_line: r.end_line })).sort((x, y) => rootKey(x).localeCompare(rootKey(y))),
    questions: a.questions.map((q) => q.text).sort(),
  });
}

export function assignDualPass({
  sourceSnapshot,
  initialContract,
  consumerRoot,
  changeArchetype = "feature",
  maxExcerptLines = 200,
  maxTotalBytes = 64000,
  constraints = { paths: [] },
  ...rest
} = {}) {
  if (Object.keys(rest).some((k) => /open/i.test(k))) {
    throw new Error("orchestration provides Contract only; Open plan option refused");
  }
  if (typeof changeArchetype !== "string" || !changeArchetype) throw new Error("changeArchetype required");
  requireInt(maxExcerptLines, "maxExcerptLines");
  requireInt(maxTotalBytes, "maxTotalBytes");
  if (maxExcerptLines > 200 || maxTotalBytes > 64000) throw new CoverageGap("scout input limits exceed reviewed bounds");
  const contract = requireContract(initialContract);
  const snapshot = requireSnapshot(sourceSnapshot);
  const { files, byPath } = loadSources(snapshot, consumerRoot);
  if (!files.length) throw new CoverageGap("empty scout assignment");
  const contextFiles = constraintSources(constraints);
  for (const file of contextFiles) {
    const factual = byPath.get(file.path);
    if (factual && (factual.truncated || factual.retained_sha256 !== file.sha256)) {
      throw new CoverageGap(`conflicting factual and constraint bytes: ${file.path}`);
    }
  }
  const contextByPath = new Map(contextFiles.map(file => [file.path, file]));
  const { edges, gaps: graphGaps } = buildGraph(files);
  const seedGaps = [];
  const cands = collectCandidates(contract, files, byPath, edges, changeArchetype, seedGaps, contextByPath);
  const { forward, reverse } = pickDual(cands, files);
  const scout_forward = buildAssignment("scout_forward", forward, byPath, edges, changeArchetype, maxExcerptLines, maxTotalBytes, [...graphGaps, ...seedGaps], contextFiles);
  const scout_reverse = buildAssignment("scout_reverse", reverse, byPath, edges, changeArchetype, maxExcerptLines, maxTotalBytes, [...graphGaps, ...seedGaps], contextFiles);
  if (!scout_forward.roots.length || !scout_reverse.roots.length || !scout_forward.questions.length || !scout_reverse.questions.length) {
    throw new CoverageGap("empty scout assignment");
  }
  if (fingerprint(scout_forward) === fingerprint(scout_reverse)) throw new CoverageGap("identical scout assignments");
  return { scout_forward, scout_reverse };
}

function assertCitation(c, assignment) {
  if (!isPlainObject(c) || typeof c.path !== "string" || !c.path) throw new Error("citation.path required");
  requireInt(c.start_line, "citation.start_line");
  requireInt(c.end_line, "citation.end_line");
  if (c.end_line < c.start_line) throw new Error("citation range inverted");
  if (!assignment.supplied_denominator.files.includes(c.path)) throw new CoverageGap(`unknown cited path: ${c.path}`);
  const covered = assignment.supplied_denominator.ranges.some((r) => r.path === c.path && r.start_line <= c.start_line && r.end_line >= c.end_line);
  if (!covered) throw new CoverageGap("citation outside supplied ranges");
  if (c.sha256 != null) {
    if (typeof c.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(c.sha256)) throw new Error("citation.sha256 must be SHA256 64-hex or null");
    const ok = assignment.excerpts.some((e) => e.path === c.path && e.start_line <= c.start_line && e.end_line >= c.end_line && (e.source_blob_sha256 === c.sha256 || e.input_excerpt_sha256 === c.sha256));
    if (!ok) throw new CoverageGap("citation hash mismatch");
  }
}

function mergeGaps(known, unread) {
  const map = new Map();
  for (const g of [...(known || []), ...(unread || [])]) {
    if (!isPlainObject(g) || typeof g.reason !== "string" || !g.reason) throw new Error("invalid gap");
    if (g.path != null && (typeof g.path !== "string" || !g.path)) throw new Error("invalid gap.path");
    if (g.start_line != null) requireInt(g.start_line, "gap.start_line");
    if (g.end_line != null) requireInt(g.end_line, "gap.end_line");
    const id = typeof g.id === "string" && g.id ? g.id : sid("gap", g);
    const key = canonicalJson({ path: g.path ?? null, reason: g.reason, start_line: g.start_line ?? null, end_line: g.end_line ?? null });
    const prev = map.get(key);
    map.set(key, {
      id: prev?.id || id,
      path: g.path ?? null,
      reason: g.reason,
      start_line: g.start_line ?? null,
      end_line: g.end_line ?? null,
      consequential: prev?.consequential === true || g.consequential !== false,
    });
  }
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function assignmentCoverage({ assignment, parsed, observed_reads = [] }) {
  if (!isPlainObject(assignment) || (assignment.role !== "scout_forward" && assignment.role !== "scout_reverse")) {
    throw new Error("assignment required");
  }
  if (!isPlainObject(assignment.supplied_denominator) || !Array.isArray(assignment.excerpts)) throw new Error("assignment denominator required");
  if (!isPlainObject(parsed)) throw new Error("parsed scout output required");
  validateRoleOutput(assignment.role, parsed);
  if (!Array.isArray(observed_reads) || observed_reads.length > 0) throw new CoverageGap("tool-free observed_reads must stay empty");
  if (!isPlainObject(parsed.supplied_denominator)) throw new CoverageGap("supplied_denominator must exactly match harness assignment");
  if (canonicalJson(parsed.supplied_denominator) !== canonicalJson(assignment.supplied_denominator)) {
    throw new CoverageGap("supplied_denominator must exactly match harness assignment");
  }
  if (!Array.isArray(parsed.citations) || !Array.isArray(parsed.findings || []) || !Array.isArray(parsed.unread_gaps || [])) {
    throw new Error("parsed citations/findings/unread_gaps must be arrays");
  }
  const findings = parsed.findings || [];
  for (const c of parsed.citations) assertCitation(c, assignment);
  for (const f of findings) {
    if (!isPlainObject(f)) throw new Error("finding must be object");
    if (f.excerpt != null && (f.path == null || f.start_line == null || f.end_line == null)) throw new CoverageGap("finding excerpt requires exact path and range");
    if (f.path != null) {
      if (typeof f.path !== "string" || !f.path) throw new Error("finding.path invalid");
      if (!assignment.supplied_denominator.files.includes(f.path)) throw new CoverageGap(`unknown cited path: ${f.path}`);
      if (f.start_line != null || f.end_line != null) {
        requireInt(f.start_line, "finding.start_line");
        requireInt(f.end_line, "finding.end_line");
        if (f.end_line < f.start_line) throw new Error("finding range inverted");
        const covered = assignment.supplied_denominator.ranges.some((r) => r.path === f.path && r.start_line <= f.start_line && r.end_line >= f.end_line);
        if (!covered) throw new CoverageGap("overclaimed coverage");
        if (f.excerpt != null && !assignment.excerpts.some(e => e.path === f.path && e.start_line <= f.start_line && e.end_line >= f.end_line
            && e.text.split("\n").slice(f.start_line-e.start_line, f.end_line-e.start_line+1).join("\n") === f.excerpt)) {
          throw new CoverageGap("finding excerpt differs from supplied source lines");
        }
      }
    }
  }
  return {
    assignment_id: assignment.id,
    role: assignment.role,
    supplied_files: [...assignment.supplied_denominator.files],
    supplied_ranges: assignment.supplied_denominator.ranges.map((r) => ({ ...r })),
    observed_reads: [],
    citations: parsed.citations,
    unresolved_gaps: mergeGaps(assignment.known_gaps, parsed.unread_gaps),
    semantic_complete: false,
    supplied_denominator: {
      files: [...assignment.supplied_denominator.files],
      ranges: assignment.supplied_denominator.ranges.map((r) => ({ ...r })),
    },
  };
}
