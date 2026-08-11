#!/usr/bin/env node
// scan-verification-delegation.mjs
//
// Detects closeout language that delegates runtime verification to the user
// instead of providing automated evidence. Companion engine for WI-197 + WI-199.
//
// Detection engine. The Stop-hook hard block is wired through
// hooks/svc-verification-delegation-guard.sh.
//
// Patterns + carve-outs are loaded from references/verification-delegation-patterns.json.
// The schema and behavior are documented there as the single source of truth.
//
// Usage:
//   --text "..."         Scan a literal string.
//   --file <path>        Scan the file's contents.
//   --stdin              Read text from stdin (used by Stop hook in Phase B).
//   --input-path <path>  Pass the source path so input_path carve-outs can match.
//   --format json|tsv    Output format. Default json.
//   --min-severity X     Override minimum reported severity (LOW|MEDIUM|HIGH).
//
// Library import:
//   import { scanText, loadConfig } from "./scan-verification-delegation.mjs";
//   const findings = scanText(text, { config, inputPath });

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, isAbsolute } from "node:path";

const SEVERITY_RANK = { LOW: 1, MEDIUM: 2, HIGH: 3 };

function repoRootFromHere() {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..");
}

export function loadConfig(path) {
  const repoRoot = repoRootFromHere();
  const cfgPath = path ?? resolve(repoRoot, "references/verification-delegation-patterns.json");
  if (!existsSync(cfgPath)) {
    throw new Error(`patterns config not found at ${cfgPath}`);
  }
  return JSON.parse(readFileSync(cfgPath, "utf8"));
}

// Strip Python/Perl-style inline flag groups (e.g., "(?im)" or "(?i)") from
// the front of a pattern and translate them into JS RegExp flags. JS does not
// support inline flag groups; without this pre-process the RegExp constructor
// throws "Invalid group".
function extractInlineFlags(regex, defaultFlags) {
  const m = regex.match(/^\(\?([imsux]+)\)/);
  if (!m) return { regex, flags: defaultFlags };
  const inline = m[1];
  const merged = new Set([...defaultFlags.split(""), ...inline.split("")]);
  return {
    regex: regex.slice(m[0].length),
    flags: [...merged].join(""),
  };
}

function compilePatterns(arr, flagsDefault = "i") {
  return arr.map((p) => {
    const overrideFlags = p.flags ?? null;
    const base = overrideFlags ?? flagsDefault;
    const { regex, flags } = extractInlineFlags(p.regex, base);
    return { ...p, re: new RegExp(regex, flags) };
  });
}

// Find evidence anchors anywhere in the surrounding window (default: full text).
function hasEvidenceAnchor(text, anchorsCompiled) {
  for (const a of anchorsCompiled) {
    if (a.re.test(text)) return { matched: true, by: a.id };
  }
  return { matched: false };
}

function applyCarveOuts(text, inputPath, carveOutsCompiled) {
  for (const c of carveOutsCompiled) {
    if (c.match_kind === "input_path" && inputPath && c.re.test(inputPath)) {
      return { exempt: true, by: c.id, reason: c.reason };
    }
    if (c.match_kind === "surrounding_text" && c.re.test(text)) {
      return { exempt: true, by: c.id, reason: c.reason };
    }
  }
  return { exempt: false };
}

export function scanText(text, opts = {}) {
  const config = opts.config ?? loadConfig(opts.configPath);
  const minSeverity = opts.minSeverity ?? config.config?.default_min_severity ?? "MEDIUM";
  const minRank = SEVERITY_RANK[minSeverity];
  const inputPath = opts.inputPath ?? null;

  const delegationPatterns = compilePatterns(config.delegation_patterns ?? [], "gi");
  const evidenceAnchors = compilePatterns(config.evidence_anchor_patterns ?? [], "i");
  const carveOuts = compilePatterns(config.carve_outs ?? [], "i");

  const carve = applyCarveOuts(text, inputPath, carveOuts);
  if (carve.exempt) {
    return {
      findings: [],
      exempt: true,
      exempt_by: carve.by,
      exempt_reason: carve.reason,
    };
  }

  const findings = [];
  for (const p of delegationPatterns) {
    if (SEVERITY_RANK[p.severity] < minRank) continue;
    p.re.lastIndex = 0;
    let m;
    while ((m = p.re.exec(text)) !== null) {
      // Compute a small surrounding window for evidence-anchor check
      const windowStart = Math.max(0, m.index - 200);
      const windowEnd = Math.min(text.length, m.index + m[0].length + 200);
      const window = text.slice(windowStart, windowEnd);
      const evidence = hasEvidenceAnchor(window, evidenceAnchors);
      findings.push({
        pattern: p.id,
        severity: p.severity,
        match: m[0],
        index: m.index,
        evidence_anchor_present: evidence.matched,
        evidence_anchor_by: evidence.by ?? null,
        actionable: !evidence.matched,
      });
      // Avoid infinite loop on zero-length match
      if (m.index === p.re.lastIndex) p.re.lastIndex++;
    }
  }

  return {
    findings,
    exempt: false,
    actionable_count: findings.filter((f) => f.actionable).length,
    total_count: findings.length,
  };
}

function parseArgs(argv) {
  const out = { format: "json", minSeverity: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--text") out.text = argv[++i];
    else if (a === "--file") out.file = argv[++i];
    else if (a === "--stdin") out.stdin = true;
    else if (a === "--input-path") out.inputPath = argv[++i];
    else if (a === "--format") out.format = argv[++i];
    else if (a === "--min-severity") out.minSeverity = argv[++i];
    else if (a === "--config") out.configPath = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function readStdinSync() {
  const chunks = [];
  // Node's readFileSync of /dev/stdin is the simplest portable read for short
  // bash-pipelined input.
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.error(
      "Usage: scan-verification-delegation.mjs [--text <s> | --file <p> | --stdin] [--input-path <p>] [--format json|tsv] [--min-severity LOW|MEDIUM|HIGH]"
    );
    process.exit(2);
  }

  let text = "";
  let resolvedInputPath = args.inputPath ?? null;
  if (args.text !== undefined) {
    text = args.text;
  } else if (args.file) {
    const fp = isAbsolute(args.file) ? args.file : resolve(process.cwd(), args.file);
    text = readFileSync(fp, "utf8");
    resolvedInputPath = resolvedInputPath ?? fp;
  } else if (args.stdin) {
    text = readStdinSync();
  } else {
    console.error("scan-verification-delegation: provide --text, --file, or --stdin");
    process.exit(2);
  }

  const result = scanText(text, {
    configPath: args.configPath,
    minSeverity: args.minSeverity,
    inputPath: resolvedInputPath,
  });

  if (args.format === "tsv") {
    if (result.exempt) {
      console.log(`exempt\t${result.exempt_by}\t${result.exempt_reason}`);
      process.exit(0);
    }
    for (const f of result.findings) {
      console.log(
        [f.pattern, f.severity, f.actionable ? "actionable" : "evidence-anchored", f.match.replace(/\s+/g, " ")].join("\t")
      );
    }
  } else {
    console.log(JSON.stringify(result, null, 2));
  }

  // CLI mode exits 0 for scan/report use. The Stop hook imports this engine and
  // maps actionable HIGH findings to a hard block.
  process.exit(0);
}

const isMainModule = import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url.endsWith(process.argv[1]);
if (isMainModule) {
  main().catch((err) => {
    console.error(err.stack || err.message);
    process.exit(2);
  });
}
