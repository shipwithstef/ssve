# Reference Bank Capture — Playwright recipe

The reference bank is the source-of-truth for sector design archetypes. Every landing-page invocation reads from `references/landing-bank/<sector>/` and explicitly cites the anchor it's working from. Without ≥3 captured anchors per sector, `landing-page` fails Self-Verify check #1 and refuses to proceed.

## Sector taxonomy

`<sector>` is a kebab-case slug naming the product class:

- `b2b-saas-crm` — Salesforce, HubSpot, Pipedrive, Attio
- `dev-tools` — Vercel, Linear, Cursor, Stripe Docs
- `vertical-saas-restaurants` — Toast, Square Restaurants, Resy
- `consumer-fitness` — Strava, Zwift, Peloton
- (extend as new projects land in new sectors)

Pick the closest sector. If none fit within ±15% similarity, file a new sector slug and capture 3 anchors before proceeding.

## What ONE anchor contains

```
references/landing-bank/<sector>/<anchor-slug>/
├── hero.png       # Above-the-fold screenshot at 1920×1080
├── hero.webm      # 5-10s scroll-cast capturing motion + first-2-screens content
└── pattern.md     # Manual write-up of WHAT THE ANCHOR IS DOING WELL
```

`pattern.md` schema:

```markdown
# <Anchor name> — <one-line value-prop the page is selling>

**URL:** <url>
**Captured:** YYYY-MM-DD
**Sector:** <sector-slug>

## What it does well
- 3-7 bullets naming SPECIFIC techniques (e.g. "asymmetric hero with right-aligned proof carousel", "trust-bar uses real customer logos not generic gradients", "CTA button uses brand-warm color, not platform default")

## What it gets wrong
- 1-3 bullets — even great pages have weak spots; naming them helps reviewers

## Reusable archetype name
<one-phrase pattern label that other pages can cite>
e.g. "Reverse-J hero with embedded social proof"
```

## Capture command

Use Playwright (or playwright MCP if available):

```bash
# Hero screenshot
npx playwright codegen <url> --viewport-size=1920,1080
# In the recorded script, replace 'newPage()' chain with:
#   await page.setViewportSize({width: 1920, height: 1080});
#   await page.goto('<url>', { waitUntil: 'networkidle' });
#   await page.screenshot({ path: 'hero.png', fullPage: false });

# Or one-shot:
npx playwright screenshot <url> hero.png \
  --viewport-size=1920,1080 \
  --wait-for-load-state=networkidle
```

Scroll-cast (5-10s):

```bash
# Use the playwright MCP browser_take_screenshot for snapshots,
# or record a real scroll with chromium-headless via:
npx puppeteer-recorder <url> hero.webm --duration=8 --scroll-from=0 --scroll-to=2vh
# (or any equivalent screen recorder; output as webm vp9 ~1920x1080)
```

Save both files into the anchor directory, then write `pattern.md` by hand.

## How `landing-page` uses the bank

At Step 1 (Brief synthesis), the skill:
1. Reads `references/landing-bank/<sector>/INDEX.md` (lists all anchors with their archetype names)
2. Picks the anchor whose archetype best matches the brief's product positioning
3. Cites the chosen anchor by path in the brief output: `archetype: <sector>/<anchor-slug>` + `reference: <archetype name from pattern.md>`

If `landing-page` is invoked for a sector with <3 anchors, it halts and instructs the user to capture them first. The skill never makes up archetypes.

## Maintenance

Refresh anchor PNG/WEBM annually (sites redesign). `pattern.md` only changes if the underlying technique shifts. A staleness validator is filed as a follow-on (similar to `validate-launch-knowledge-freshness.sh`).
