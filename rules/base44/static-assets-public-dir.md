# Base44 + Cloudflare CDN: public/* Static Assets Must Be Committed AND Verified by Content-Type

When a Base44 frontend references a static asset under `public/` (e.g. `<img src="/foo.png" />` or a hardcoded path in JSX/CSS), three independent failures can hide a missing asset behind misleading 200 OK responses. Engineers waste hours debugging "the image isn't showing" while the deploy reports green.

The asset is only truly deployed when ALL THREE of these are true:

1. **The file exists and is tracked in git** — `git ls-files public/<asset>` returns the path
2. **Base44 deploy bundled it** — `last_git_commit_hash` matches origin AND the file is reachable on the production domain
3. **CDN serves the actual binary** — `curl -sI https://<app>.app/<asset>` returns `Content-Type: image/png` (or matching MIME), NOT `text/html`

**HTTP 200 alone is NOT proof of deploy.** The Base44 SPA serves `index.html` (HTTP 200, `Content-Type: text/html`) for any unknown route — including missing static asset paths. Cloudflare then caches that fallback at the edge with TTL up to 1 hour.

## Three Independent Failure Modes (all observed in WI-174 iter-6)

### A. Asset matched a blanket `.gitignore` rule and never landed in git

Example Marketplace's `.gitignore:51` has `*.png` as a blanket pattern (intended to exclude bot-generated experiment images, but it catches production assets too). Adding `public/cozy-jazz.png` via `git add` SILENTLY skips the file:

```bash
$ git add public/cozy-jazz.png
The following paths are ignored by one of your .gitignore files:
public/cozy-jazz.png
hint: Use -f if you really want to add them.
```

If the engineer doesn't read the hint output, the commit lands without the asset. Build passes locally (Vite reads from working tree), deploy reports green, production breaks.

**Detection:** `git ls-files public/<asset>` returns nothing → asset is NOT in deploy.
**Fix:** `git add -f public/<asset>` to bypass ignore.

### B. Cloudflare CDN cached the SPA 404 fallback during the broken window

Once the JSX references the missing asset path, Cloudflare's edge starts requesting it. The SPA returns `index.html` for the missing path. Cloudflare caches that response at the edge for the path, by default with up to 1 hour TTL.

When the asset is later committed and deployed correctly, the CDN edge keeps serving the cached HTML — for the original URL, with no query string. New visitors hitting `/cozy-jazz.png` continue receiving HTML even after the file is on origin.

```
Headers diagnostic on the broken URL:
  HTTP/2 200
  content-type: text/html; charset=utf-8     ← WRONG MIME
  cf-cache-status: HIT                       ← cached at edge
  age: 1108                                  ← cached 18 min ago
```

Compare to a working asset (committed before the broken window):
```
  HTTP/2 200
  content-type: image/png                    ← correct
  content-length: 226010                     ← real binary size
  cf-cache-status: HIT (or MISS, doesn't matter)
```

**Detection:** `curl -sI` returns `content-type: text/html` and the file is in `git ls-files` → CDN cache stale.
**Fix options (in order of preference):**

1. **Cache-bust the references in JSX** — add `?v=YYYYMMDD` query string to every reference to the affected paths. Browsers treat query-stringed URLs as new resources, CDN fetches from origin, real PNG served. Old `?v`-less URLs continue to serve HTML until TTL expires; nothing references them post-fix.
   ```jsx
   const LOGO_DARK = "/logo-transparent-dark-v2.png?v=20260506";
   nightPhoto: "/cozy-jazz.png?v=20260506",
   ```
2. **Purge Cloudflare cache for the path** — requires zone-scoped API token. For Example Marketplace the zone is `fbb3b2cb0a98367fcc9b130558294ed3` (zone ID), token stored locally:
   ```bash
   CF_TOKEN="<from .env.local or 1Password>"
   curl -X POST "https://api.cloudflare.com/client/v4/zones/fbb3b2cb0a98367fcc9b130558294ed3/purge_cache" \
     -H "Authorization: Bearer $CF_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"files":["https://example-marketplace.app/cozy-jazz.png","https://example-marketplace.app/cocktail-lounge.png"]}'
   ```
   Verify with `curl -sI https://example-marketplace.app/cozy-jazz.png` immediately — should return `image/png` once propagation completes (seconds).
3. **Wait** — cache TTL expires naturally within an hour. Acceptable for low-stakes paths; not for launch-impacting hero images.

### C. Local Vite build masks the issue

`npm run build` reads from the working tree, NOT from git. So an untracked PNG in `public/` will appear in `dist/` — the local dist preview "works." Engineers see green builds and assume deploy will follow.

The real test is `git ls-files` BEFORE pushing, and `curl -sI <url>` AFTER pushing.

## Required Pre-Deploy Checklist for Any New public/ Asset

Before pushing any commit that references a new asset path from JSX/CSS:

```bash
# 1. The file exists locally
ls -la public/<asset>

# 2. The file is tracked in git (NOT silently ignored)
git ls-files public/<asset>
# If empty → ignored. Use git add -f, or update .gitignore to allow.

# 3. The reference in code matches the file path EXACTLY
grep -rE '"/<asset>"' src/ public/

# 4. After push + deploy
curl -sI "https://<app>.app/<asset>" | grep -i content-type
# Must be image/png (or matching MIME). Anything containing text/html → broken.
```

## Forbidden Shortcuts

- ❌ **Trusting HTTP 200** — the SPA always returns 200 for unknown routes. Always read `Content-Type`.
- ❌ **Skipping `git ls-files` before push** — local build success ≠ origin deploy success when assets are gitignored.
- ❌ **Ignoring `git add` "paths are ignored" hint output** — that hint IS the failure signal.
- ❌ **Adding new files to `public/` and assuming `git add public/` will catch them** — blanket `*.png` / `*.svg` ignore rules silently skip them.
- ❌ **Purging Cloudflare cache as the FIRST move when an asset breaks** — confirm git tracking + Base44 deploy first; CDN cache is the third-line check.

## Why This Rule Exists

Real failure mode in Example Marketplace WI-174 iter-6 (2026-05-06): commit `bb96737` added `Landing.jsx` + `HeroRotation.jsx` references to `/cozy-jazz.png`, `/cocktail-lounge.png`, `/wine-tasting.png`, and `/logo-transparent-dark-v2.png` for dark-mode/night-sector hero rotation. None of the PNG files were committed (caught by `.gitignore:51` blanket `*.png`). User reported "all the images for dark mode not available in live app." Diagnosis took 15 minutes:
- `git ls-files` → confirmed missing
- `curl -sI` → confirmed `text/html` fallback
- Force-add via `git add -f` (commit `b3aa771`) → still HTML (CDN cache HIT)
- Cache-bust references with `?v=20260506` (commit `bef5c9a`) → real PNGs served

Three commits and a deploy cycle could have been one if the pre-deploy checklist had been followed.

## Reviewer Hooks

- `audit-implementation` — for any commit touching `public/` paths or adding new image references in JSX, run the 4-step checklist above before declaring complete
- `review-gate` G3 — block PRs that add `<img src="/X" />` references where `git ls-files public/X` returns nothing; this is the silent-failure pattern
- A pre-commit hook is also proposed: if staged changes add a string matching `"/[a-z0-9-]+\.(png|jpg|webp|svg)"` to JSX/CSS but no file at `public/<that-name>` is staged, warn loudly (do not block — sometimes refs go to external URLs, but warn). Status: not implemented yet; track as TODO if the failure recurs.

## Related

- `rules/base44/function-deploy-404-check-secrets.md` — sister failure mode (404 from missing secret looks like missing function)
- `rules/post-fix-evidence-before-next-fix.md` — read response headers (Content-Type) before re-deploying
- `~/.claude/skills/base44-environment/SKILL.md` § "Static asset deploy gotchas" — operational quick-reference

## Severity When Violated

**MEDIUM** for new project work (caught in eyeball check). **HIGH** if the asset is launch-impacting (hero image, payment-flow icon, brand mark) — silently broken visuals on production landing reduce conversion with no error signal in logs.
