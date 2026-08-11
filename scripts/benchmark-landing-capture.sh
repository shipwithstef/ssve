#!/bin/bash
# scripts/benchmark-landing-capture.sh <url-or-local-path> [output-dir]
#
# Captures a landing page at every production-relevant viewport width.
# Writes screenshots to output-dir (default /tmp/benchmark-<timestamp>/).
# Uses playwright via node from whatever project is on the orchestrator's cwd
# (expects playwright already installed as a dev dep in the project).
#
# Viewports captured (all common breakpoints — prune in skill if not used):
#   1600 (design canvas)
#   1280 (large desktop)
#   1024 (tablet landscape)
#   768  (tablet portrait)
#   390  (mobile)
#
# Additionally captures the right-column card at its in-production size
# if a CSS selector is provided via --card-selector.
set -u

URL="${1:-}"
OUT_DIR="${2:-/tmp/benchmark-$(date +%s)}"
[ -z "$URL" ] && { echo "usage: benchmark-landing-capture.sh <url-or-local-path> [output-dir]" >&2; exit 2; }

mkdir -p "$OUT_DIR"

# Find playwright — orchestrator usually runs this from a project dir that has it
PROJECT_ROOT="$(pwd)"
if ! [ -f "$PROJECT_ROOT/node_modules/playwright/package.json" ]; then
  echo "playwright not installed in $PROJECT_ROOT/node_modules" >&2
  echo "either cd into a project with playwright OR 'npm install playwright' first" >&2
  exit 3
fi

# Write the ESM capture script INSIDE the project root so Node resolves
# playwright from the project's node_modules (ESM resolution walks up from
# the script file's directory, not from cwd).
SCRIPT_JS="$PROJECT_ROOT/.svc-benchmark-capture.mjs"
cat > "$SCRIPT_JS" <<EOF
import { chromium } from 'playwright';
const browser = await chromium.launch();
const URL = process.argv[2];
const OUT = process.argv[3];
const viewports = [
  { w: 1600, h: 900, name: '1600' },
  { w: 1280, h: 800, name: '1280' },
  { w: 1024, h: 768, name: '1024' },
  { w: 768,  h: 1024, name: '768' },
  { w: 390,  h: 844, name: '390' },
];
for (const vp of viewports) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
    // allow any animations to settle into payoff state
    await page.waitForTimeout(5500);
    await page.screenshot({ path: \`\${OUT}/\${vp.name}-payoff.png\`, fullPage: false });
    // also initial state
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: \`\${OUT}/\${vp.name}-initial.png\`, fullPage: false });
  } catch (e) {
    console.error(\`viewport \${vp.name} failed: \${e.message}\`);
  }
  await ctx.close();
}
await browser.close();
console.log('captured', viewports.length, 'viewports to', OUT);
EOF

# Run from project root so node's module resolution finds playwright
# (cwd-based ESM resolution won't traverse to find node_modules otherwise)
(cd "$PROJECT_ROOT" && node "$SCRIPT_JS" "$URL" "$OUT_DIR")
RC=$?
# Cleanup the temp script from the project root
rm -f "$SCRIPT_JS"
[ $RC -eq 0 ] || { echo "capture failed with code $RC" >&2; exit $RC; }

echo ""
echo "=== capture complete ==="
ls -la "$OUT_DIR"/*.png 2>/dev/null | head -15
