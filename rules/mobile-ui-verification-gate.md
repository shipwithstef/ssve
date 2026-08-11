# Rule: Mobile UI changes need device-realistic, authenticated, perceptual gates

svc verifies **logic** well (build, lint, DOM-presence e2e, adversarial code
review) but had **near-zero device-realistic perceptual gates** for an app's
authenticated mobile UI. Six bugs shipped to a user through that blind spot in
one program — each caught by a human testing on-device, not by any gate:

| Bug | Why every existing gate missed it |
|---|---|
| Sample FAB half-hidden behind the bottom tab bar | headless `env(safe-area-inset-bottom)=0` → the nav never grows; DOM-presence e2e only checks the FAB exists |
| Logout under the phone home indicator | same safe-area blindness |
| FAB vanished while scrolling discovery | no gate exercises scroll state |
| Profile opened scrolled to the bottom | no gate exercises navigation scroll-restoration |
| Hero card clipped at 390px | perceptual — a DOM assertion passed while the card was clipped |
| (all of the above) render only for a **logged-in customer** | every gate ran an **anonymous** session, so the controls never even rendered |

## Rule

Any **browser-visible change to a mobile / app screen** — one with fixed/sticky
chrome (bottom tab bar, sticky header, FAB), a scroll container reused across
routes, or any authenticated view a mobile user reaches — MUST pass these gates
**before land/deploy**, run at a real phone viewport against a **seeded logged-in
session** (not anonymous):

```bash
# 1. produce a logged-in session ONCE (app-specific login → storageState json)
#    e.g. Playwright: await context.storageState({ path: '.svc/auth/customer.json' })

AUTH=.svc/auth/customer.json   # the seeded-customer session

# 2. occlusion + safe-area (fixed chrome / gesture-bar clipping)
node scripts/browser-verify.mjs --url "<screen-url>" --wi <WI> --auth-state "$AUTH" \
  --check '{"type":"mobile-occlusion","viewport":{"width":390,"height":844},"safeAreaBottom":34}'

# 3. navigation scroll-restoration (page must open at the top, not inherit scroll)
node scripts/browser-verify.mjs --url "<screen-url>" --wi <WI> --auth-state "$AUTH" \
  --check '{"type":"scroll-position","container":"<scroll-container>","expect":"top",
           "before":[{"action":"scroll","to":"bottom"},{"action":"click","selector":"<in-app-link>"}]}'

# 4. perceptual regression (a screenshot diff, NOT a DOM-presence assertion)
node scripts/browser-verify.mjs --url "<screen-url>" --wi <WI> --auth-state "$AUTH" \
  --check '{"type":"screenshot-matches","selector":"<region>","baseline":"<golden.png>"}'
```

**DOM-presence assertions do not satisfy this rule** — "the element is in the DOM"
passed while the FAB was clipped and the hero was cut off. Every browser-visible
mobile change needs at least the occlusion gate + a perceptual diff; add the
scroll gate whenever the change touches navigation or a shared scroll container.

## Enforcement

**Mechanically wired (a gate fails if you skip it):**

- Registered in `skills-manifest.json` `rules[]` (auto-injected when a session
  touches `mobile-occlusion.mjs` / `scroll-position.mjs` / `browser-verify.mjs`);
  `validate-rules-registered.sh` (tier-1) fails if it is on disk but unregistered.
- `track-visuals` — Hard rule "mobile occlusion + safe-area gate" mandates the
  occlusion gate at capture time for mobile screens.
- Tier-1 self-tests prove the detectors themselves still catch the bug class:
  `test-framework/evals/tier-1/validate-mobile-occlusion-gate.sh` and
  `validate-scroll-position-gate.sh`. Both **require Playwright** — a behavioral
  gate that can't run a browser fails rather than skips green.

**Reviewer policy (not yet a blocking hook — enforced by review judgement):**

- `review-exec` / `route-workflow` should treat a browser-visible mobile diff
  whose only evidence is a DOM-presence e2e as a **MEDIUM** finding
  ("perceptual/device gate missing") and request the occlusion + perceptual gates
  before land/deploy. This is a review obligation, not a mechanical block; the
  scroll gate is additionally expected whenever the diff touches navigation or a
  shared scroll container. Elevate to a wired gate once drift is observed
  (`rules/tier-1-promotion.md`).

## Why this exists

Logic gates prove the code is *correct*; they cannot prove the screen *looks and
works right on a phone*. Without device-realistic (safe-area-emulated),
authenticated, perceptual gates, the human is the visual-regression suite —
which is exactly how these six shipped. Captured 2026-07-11 from the
Example Marketplace WI-SAMPLE-NAV-01 / WI-SCROLL-TOP-01 / WI-HERO-MOBILE-01 findings.
