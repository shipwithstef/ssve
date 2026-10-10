### External-Anchor Mode

Capture a third-party landing page for `landing-page`'s reference bank. Different from `baseline` mode in three ways: (1) the URL is external, not the project's own pages; (2) output path is `references/landing-bank/<sector>/<anchor-slug>/` not `docs/specs/visuals/`; (3) only captures the **hero** PNG + a short **scroll-cast** WEBM, not full inventory.

**When to use:**
- A `landing-page` invocation needs an anchor for a sector that has a `pattern.md` but missing `hero.png`/`hero.webm`
- Refreshing an anchor whose binary captures are stale (>12mo per `validate-landing-page-freshness.sh`)

**Inputs (caller provides):**
- `url` — the page to capture (e.g., `https://pos.toasttab.com`)
- `sector` — kebab-case slug from `references/landing-bank/<sector>/INDEX.md`
- `anchor` — kebab-case slug from the same INDEX.md table

**Step 1: Browser pre-flight** (same as Baseline Mode Step 2 pre-flight — prefer `browse` daemon over Playwright MCP for token efficiency)

**Step 2: Hero PNG capture (1920×1080 above-fold)**

```bash
# Preferred: browse
browse goto "<url>"
browse viewport 1920x1080
browse screenshot "references/landing-bank/<sector>/<anchor>/hero.png"

# Fallback: Playwright MCP (only when browse unavailable)
# browser_navigate → <url>
# browser_resize → { width: 1920, height: 1080 }
# browser_take_screenshot → references/landing-bank/<sector>/<anchor>/hero.png
```

**Step 3: Scroll-cast WEBM (5-10s, captures motion + first 2 screens)**

```bash
# browse offers scroll-cast natively if available; otherwise puppeteer-recorder
npx puppeteer-recorder "<url>" "references/landing-bank/<sector>/<anchor>/hero.webm" \
  --duration=8 --scroll-from=0 --scroll-to=200vh
```

If neither is available, set `hero.webm` as TODO in `pattern.md` and note WEBM capture as deferred.

**Step 4: Update INDEX.md row**

In `references/landing-bank/<sector>/INDEX.md`, mark the anchor row's binary capture status from TODO → captured `<date>`. Existing `pattern.md` content is left untouched.

**Step 5: Update `pattern.md` Captured field**

Edit `references/landing-bank/<sector>/<anchor>/pattern.md`:
- Change `**Captured:** YYYY-MM-DD (pattern.md only; hero.png/.webm TODO-capture)` to `**Captured:** YYYY-MM-DD (binary captures fresh)`

**Output contract** — return ONLY the file paths to the caller; do NOT return raw screenshots, DOM dumps, or page text. Per `references/browser-verify-doctrine.md`, raw page-sized payloads in stdout burn parent-orchestrator tokens fast.

**What this mode is NOT:**
- It does NOT modify the `docs/specs/visuals/` baseline (that's project-owned UI)
- It does NOT update or compare any baseline
- It does NOT analyze the captured page (that's `pattern.md`'s job, manual)
- It does NOT validate page health (LCP, CLS, etc.)

---
