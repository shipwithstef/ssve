#!/usr/bin/env node
// skills/ingest-guide/scripts/convert-to-ingest-ready.mjs
// Convert various research outputs into canonical ingest-ready.json.
//
// USAGE:
//   node skills/ingest-guide/scripts/convert-to-ingest-ready.mjs \
//     --source-id <id> \
//     --input <path> \
//     --output <path> \
//     --from <format> \
//     [--raw-source <path>] \
//     [--extraction-method <detached|inline|reused|manual>]
//
// Supported --from formats:
//   - research-log      : raw text log from research detached runner
//   - capabilities-md    : references/knowledge/<domain>/CAPABILITIES.md
//   - prescope-md       : docs/specs/research-prescope-<source>.md
//   - extracted-json    : already-structured JSON (passthrough + validation)
//   - raw-md            : generic markdown (heuristic extraction)
//
// EXIT: 0 = output written, 1 = error

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.env.SVC_REPO_ROOT || process.cwd();

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = argv[i + 1];
    switch (a) {
      case '--source-id': out.source_id = v; i++; break;
      case '--input': out.input = v; i++; break;
      case '--output': out.output = v; i++; break;
      case '--from': out.from = v; i++; break;
      case '--raw-source': out.raw_source = v; i++; break;
      case '--extraction-method': out.extraction_method = v; i++; break;
    }
  }
  return out;
}

function fail(msg, extra = {}) {
  console.error(JSON.stringify({ verdict: 'failed', reason: msg, ...extra }));
  process.exit(1);
}

function pass(payload) {
  console.log(JSON.stringify({ verdict: 'ok', ...payload }));
}

function fileExists(p) {
  try { fs.accessSync(p, fs.constants.R_OK); return true; } catch { return false; }
}

function guessDomain(sourceId) {
  // Simple heuristic: if source-id contains a known domain slug, use it
  const knownDomains = ['google-ai', 'claude', 'vercel', 'supabase', 'base44', 'capacitor', 'ionic'];
  for (const d of knownDomains) {
    if (sourceId.includes(d)) return d;
  }
  return null;
}

function parseClaimsFromText(text) {
  const claims = [];
  let id = 1;

  // Heuristic 1: numbered list items that look like claims
  const numberedRegex = /^\s*\d+\.\s+(.+)$/gm;
  let m;
  while ((m = numberedRegex.exec(text)) !== null) {
    const claimText = m[1].trim();
    if (claimText.length > 20) {
      claims.push({
        id: id++,
        text: claimText,
        type: 'assertion',
        upstream_url: null,
        confidence: 'medium',
      });
    }
  }

  // Heuristic 2: lines starting with "- " that contain "claim" or technique-like words
  if (claims.length === 0) {
    const bulletRegex = /^\s*[-*]\s+(.+)$/gm;
    while ((m = bulletRegex.exec(text)) !== null) {
      const claimText = m[1].trim();
      if (claimText.length > 20 && /\b(claim|technique|pattern|result|method|approach|strategy)\b/i.test(claimText)) {
        claims.push({
          id: id++,
          text: claimText,
          type: 'technique',
          upstream_url: null,
          confidence: 'medium',
        });
      }
    }
  }

  return claims;
}

function extractUrls(text) {
  const urlRegex = /https?:\/\/[^\s\)\"\'>]+/g;
  const urls = new Set();
  let m;
  while ((m = urlRegex.exec(text)) !== null) {
    urls.add(m[0]);
  }
  return Array.from(urls);
}

function convertFromResearchLog(text, sourceId, rawSourcePath) {
  const claims = parseClaimsFromText(text);
  const urls = extractUrls(text);
  const upstreamFetch = {
    attempted: urls.length > 0,
    status: urls.length > 0 ? 'ok' : 'n/a',
    url: urls[0] || null,
    excerpt: null,
    failure_reason: null,
  };

  return {
    schema_version: '1.0',
    source_id: sourceId,
    produced_by: 'research',
    produced_at: new Date().toISOString(),
    extraction_method: 'detached',
    claims,
    upstream_urls: urls,
    content_summary: text.split('\n').slice(0, 3).join(' ').substring(0, 200),
    upstream_fetch: upstreamFetch,
    domain: guessDomain(sourceId),
    raw_source_path: rawSourcePath || `docs/specs/ingest-guide/${sourceId}-raw.md`,
    provenance: urls.map(u => ({
      url: u,
      retrieved_at: new Date().toISOString(),
      retrieval_method: 'gemini-cli',
    })),
  };
}

function convertFromCapabilitiesMd(text, sourceId, rawSourcePath) {
  const claims = parseClaimsFromText(text);
  const urls = extractUrls(text);

  return {
    schema_version: '1.0',
    source_id: sourceId,
    produced_by: 'research',
    produced_at: new Date().toISOString(),
    extraction_method: 'reused',
    claims,
    upstream_urls: urls,
    content_summary: `Reused CAPABILITIES.md for ${sourceId}`,
    upstream_fetch: { attempted: false, status: 'n/a', url: null, excerpt: null, failure_reason: null },
    domain: guessDomain(sourceId),
    raw_source_path: rawSourcePath || `references/knowledge/domains/${sourceId}/CAPABILITIES.md`,
    provenance: [],
  };
}

function convertFromExtractedJson(jsonText, sourceId, rawSourcePath) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    fail('input is not valid JSON', { error: e.message });
  }

  // Validate minimum required fields
  if (!Array.isArray(parsed.claims)) {
    fail('JSON input missing claims array');
  }

  return {
    schema_version: parsed.schema_version || '1.0',
    source_id: sourceId,
    produced_by: parsed.produced_by || 'research',
    produced_at: parsed.produced_at || new Date().toISOString(),
    extraction_method: parsed.extraction_method || 'manual',
    claims: parsed.claims.map((c, i) => ({
      id: c.id || i + 1,
      text: c.text || c.claim || '',
      type: c.type || 'assertion',
      upstream_url: c.upstream_url || null,
      confidence: c.confidence || 'medium',
    })),
    upstream_urls: parsed.upstream_urls || [],
    content_summary: parsed.content_summary || '',
    upstream_fetch: parsed.upstream_fetch || { attempted: false, status: 'n/a', url: null, excerpt: null, failure_reason: null },
    domain: parsed.domain || guessDomain(sourceId),
    raw_source_path: rawSourcePath || parsed.raw_source_path || '',
    provenance: parsed.provenance || [],
  };
}

function convertFromRawMd(text, sourceId, rawSourcePath) {
  const claims = parseClaimsFromText(text);
  const urls = extractUrls(text);

  return {
    schema_version: '1.0',
    source_id: sourceId,
    produced_by: 'research',
    produced_at: new Date().toISOString(),
    extraction_method: 'inline',
    claims,
    upstream_urls: urls,
    content_summary: text.split('\n').slice(0, 3).join(' ').substring(0, 200),
    upstream_fetch: { attempted: false, status: 'n/a', url: null, excerpt: null, failure_reason: null },
    domain: guessDomain(sourceId),
    raw_source_path: rawSourcePath || `docs/specs/ingest-guide/${sourceId}-raw.md`,
    provenance: [],
  };
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  if (!a.source_id) fail('missing --source-id');
  if (!a.input) fail('missing --input');
  if (!a.output) fail('missing --output');
  if (!a.from) fail('missing --from (research-log|capabilities-md|prescope-md|extracted-json|raw-md)');
  if (!fileExists(a.input)) fail('input file not found', { input: a.input });

  const text = fs.readFileSync(a.input, 'utf-8');
  let artifact;

  switch (a.from) {
    case 'research-log':
      artifact = convertFromResearchLog(text, a.source_id, a.raw_source);
      break;
    case 'capabilities-md':
      artifact = convertFromCapabilitiesMd(text, a.source_id, a.raw_source);
      break;
    case 'prescope-md':
      // Prescope is a plan, not extraction; fall through to raw-md heuristics
      artifact = convertFromRawMd(text, a.source_id, a.raw_source);
      break;
    case 'extracted-json':
      artifact = convertFromExtractedJson(text, a.source_id, a.raw_source);
      break;
    case 'raw-md':
      artifact = convertFromRawMd(text, a.source_id, a.raw_source);
      break;
    default:
      fail(`unknown --from format: ${a.from}`);
  }

  if (a.extraction_method) {
    artifact.extraction_method = a.extraction_method;
  }

  fs.mkdirSync(path.dirname(a.output), { recursive: true });
  fs.writeFileSync(a.output, JSON.stringify(artifact, null, 2), 'utf-8');

  pass({
    output: a.output,
    source_id: a.source_id,
    from: a.from,
    claim_count: artifact.claims.length,
    extraction_method: artifact.extraction_method,
  });
}

main();
