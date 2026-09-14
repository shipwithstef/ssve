#!/usr/bin/env node
// scripts/browser-verify.mjs
//
// Compact browser-verify wrapper. Accepts declarative checks, runs them headless
// via Playwright, writes screenshots + DOM dumps to disk, returns only a small
// verdict-shape JSON (<2 KB regardless of page size).
//
// USAGE
//   CLI (arg-form):
//     node scripts/browser-verify.mjs \
//       --url <url-or-file://path> \
//       --wi <WI-NNN> \
//       --check '{"type":"presence","selector":"h1"}' \
//       [--check '{"type":"text-contains","selector":"h1","value":"Hello"}' ...] \
//       [--timeout-ms 10000]
//
//   CLI (stdin JSON-form):
//     echo '{"url":"...","wi":"WI-102","checks":[...]}' | node scripts/browser-verify.mjs --stdin
//
//   Library:
//     import { browserVerify } from './scripts/browser-verify.mjs';
//     const result = await browserVerify({ url, wi, checks, timeoutMs });
//
// OUTPUT
//   {
//     "pass": boolean,
//     "url": "...",
//     "findings": [ { "name": "...", "type": "...", "pass": bool, "detail": "..." }, ... ],
//     "screenshot_path": "docs/specs/work-items/evidence/WI-NNN/<ts>-page.png",
//     "evidence_dir": "docs/specs/work-items/evidence/WI-NNN"
//   }
//
// CONTRACT
//   - Evidence files (screenshots, DOM dumps) written under docs/specs/work-items/evidence/<WI>/
//   - Returned JSON is under 2 KB regardless of page size (paths only, no payloads).
//   - Exit 0 on pass, 1 on any failing check, 2 on infra error (e.g. Playwright missing).
//
// DEPENDENCIES
//   Requires `playwright` installed on the developer machine:
//     npx playwright install chromium
//   If absent, exits 2 with a clear diagnostic.

import fs from 'node:fs';
import path from 'node:path';
import { runCheck, SUPPORTED_TYPES } from './lib/browser-checks/index.mjs';

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_VERDICT_BYTES = 2048;

function isoStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function fail(code, verdict) {
  process.stdout.write(JSON.stringify(verdict) + '\n');
  process.exit(code);
}

function parseArgv(argv) {
  const out = { checks: [], timeoutMs: DEFAULT_TIMEOUT_MS, stdin: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') out.url = argv[++i];
    else if (a === '--wi') out.wi = argv[++i];
    else if (a === '--check') out.checks.push(JSON.parse(argv[++i]));
    else if (a === '--timeout-ms') out.timeoutMs = Number(argv[++i]);
    else if (a === '--auth-state') out.authStatePath = argv[++i];
    else if (a === '--require-selector') out.requireSelector = argv[++i];
    else if (a === '--stdin') out.stdin = true;
  }
  return out;
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch (err) {
    return null;
  }
}

export async function browserVerify({ url, wi, checks, timeoutMs = DEFAULT_TIMEOUT_MS, repoRoot, authStatePath, requireSelector } = {}) {
  if (!url) return { pass: false, error: 'missing url' };
  if (!wi) return { pass: false, error: 'missing wi' };
  if (!Array.isArray(checks) || checks.length === 0) {
    return { pass: false, error: 'checks[] must be a non-empty array' };
  }
  for (const c of checks) {
    if (!SUPPORTED_TYPES.includes(c.type)) {
      return { pass: false, error: `unsupported check type: ${c.type} (supported: ${SUPPORTED_TYPES.join(',')})` };
    }
  }

  repoRoot = repoRoot || process.env.SVC_REPO_ROOT || process.cwd();
  const evidenceDir = path.join(repoRoot, 'docs', 'specs', 'work-items', 'evidence', wi);
  fs.mkdirSync(evidenceDir, { recursive: true });
  const timestamp = isoStamp();

  const pw = await loadPlaywright();
  if (!pw) {
    return {
      pass: false,
      error: 'playwright not installed — run `npx playwright install chromium` then retry',
      code: 'ENOPLAYWRIGHT',
    };
  }

  const browser = await pw.chromium.launch({ headless: true });
  // --auth-state <storageState.json> runs the checks inside a logged-in session.
  // Authenticated screens (a customer FAB, account controls) do not render for an
  // anonymous session — the reason those bugs escaped every existing gate. The
  // app produces the storageState once (Playwright `context.storageState({path})`
  // after a real login) and the gate reuses it.
  let contextOpts = {};
  if (authStatePath) {
    if (!fs.existsSync(authStatePath)) {
      await browser.close();
      return { pass: false, error: `auth-state file not found: ${authStatePath}`, code: 'ENOAUTHSTATE' };
    }
    contextOpts.storageState = authStatePath;
  }
  const context = await browser.newContext(contextOpts);
  const page = await context.newPage();
  page.setDefaultTimeout(timeoutMs);

  const findings = [];
  let screenshotPath = null;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });

    // Auth/readiness marker (NG-03): loading a storageState file does NOT prove the
    // session is still valid — an expired/anonymous session renders the logged-out
    // page, where the authenticated controls never mount and every check would pass
    // vacuously. When --require-selector is given, the marker MUST be present after
    // navigation or the whole run fails closed with a clear reason.
    if (requireSelector) {
      const present = await page
        .locator(requireSelector)
        .first()
        .waitFor({ state: 'attached', timeout: Math.min(timeoutMs, 15000) })
        .then(() => true)
        .catch(() => false);
      if (!present) {
        // Return inside the try — the finally still runs browser.close(); do not
        // close here (that would double-close).
        return {
          pass: false,
          url,
          wi,
          authStatePath: authStatePath || null,
          requireSelector,
          findings: [{
            name: 'auth-readiness-marker',
            pass: false,
            detail: `required selector not found after navigation: ${requireSelector} — session is likely anonymous/expired (storageState loaded but not authenticated), or the page did not render`,
          }],
        };
      }
    }

    // Full-page screenshot as default evidence
    const relPath = path.join('docs', 'specs', 'work-items', 'evidence', wi, `${timestamp}-page.png`);
    screenshotPath = path.join(repoRoot, relPath);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const ctx = { evidenceDir, timestamp, timeoutMs, repoRoot };
    for (const check of checks) {
      findings.push(await runCheck(page, check, ctx));
    }
  } catch (err) {
    findings.push({ name: 'navigation', type: 'nav', pass: false, detail: err.message });
  } finally {
    await browser.close();
  }

  const allPass = findings.every(f => f.pass);
  const verdict = {
    pass: allPass,
    url,
    wi,
    findings,
    screenshot_path: screenshotPath ? path.relative(repoRoot, screenshotPath) : null,
    evidence_dir: path.relative(repoRoot, evidenceDir),
  };
  return verdict;
}

async function mainCli() {
  const args = parseArgv(process.argv.slice(2));
  let input = args;
  if (args.stdin) {
    const chunks = [];
    for await (const c of process.stdin) chunks.push(c);
    input = { ...args, ...JSON.parse(Buffer.concat(chunks).toString('utf8')) };
  }
  const verdict = await browserVerify(input);
  const body = JSON.stringify(verdict);
  // Guard the contract: if stdout is going to exceed the budget, strip detail fields.
  let out = body;
  if (Buffer.byteLength(out, 'utf8') > MAX_VERDICT_BYTES && verdict.findings) {
    verdict.findings = verdict.findings.map(f => ({ name: f.name, type: f.type, pass: f.pass }));
    verdict._truncated = true;
    out = JSON.stringify(verdict);
  }
  process.stdout.write(out + '\n');
  if (verdict.error) process.exit(verdict.code === 'ENOPLAYWRIGHT' ? 2 : 2);
  process.exit(verdict.pass ? 0 : 1);
}

const isDirect = import.meta.url === `file://${process.argv[1]}`;
if (isDirect) {
  mainCli().catch(err => {
    process.stdout.write(JSON.stringify({ pass: false, error: err.message }) + '\n');
    process.exit(2);
  });
}
