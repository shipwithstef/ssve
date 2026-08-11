// Check: on a mobile viewport WITH the device safe-area emulated, no genuinely
// actionable element is (a) substantially occluded by fixed/sticky chrome, or
// (b) a FIXED/STICKY control pinned inside the bottom gesture-bar/home-indicator
// zone.
//
// Why: DOM-presence checks are perceptually blind, and headless Chromium reports
// env(safe-area-inset-bottom)=0 so a fixed nav never grows — hiding the whole
// "button behind the tab bar / under the home indicator" class. This check sets
// a real safe-area inset via CDP, freezes animations, then measures.
//
// Shape: {
//   type: 'mobile-occlusion',
//   viewport?: {width,height},        // default {width:390,height:844}
//   safeAreaBottom?: number,          // device inset px; default 34
//   interactiveSelector?: string,     // override the guarded set
//   ignoreSelector?: string,          // exempt elements (decorative/known-safe)
//   safeAreaOwnerSelector?: string,   // fixed elements allowed in the safe zone (e.g. a nav that owns the inset)
//   occlusionRatioThreshold?: number, // fraction of an element's tap area that may be covered; default 0.30
//   safeAreaOverlapPx?: number,       // px a fixed control may extend into the zone before failing; default 4
//   settleMs?: number,                // default 450
//   name?: string,
// }
// Returns { pass, detail }.
//
// Robustness (per adversarial review MO-01..09): safe-area rule applies to
// fixed/sticky only (flow content can be scrolled into view); [data-testid] is
// NOT a default control; occlusion samples an inset grid, not two centre points;
// open shadow roots are traversed; inert/aria-hidden/pointer-events:none/
// clipped elements are skipped (so a modal's inert background is not flagged);
// animations are frozen before measuring; and CDP-unavailable is a distinct,
// non-passing "unsupported" result rather than a silent 0-inset render.

const DEFAULT_INTERACTIVE =
  'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), ' +
  'select:not([disabled]), textarea:not([disabled]), [role="button"], [role="link"], ' +
  '[role="tab"], [role="menuitem"], [role="switch"], [role="checkbox"], ' +
  '[tabindex]:not([tabindex="-1"]), [onclick]';

export async function checkMobileOcclusion(page, check = {}) {
  const vp = check.viewport || { width: 390, height: 844 };
  const safeAreaBottom = check.safeAreaBottom ?? 34;
  const interactiveSelector = check.interactiveSelector || DEFAULT_INTERACTIVE;
  const ignoreSelector = check.ignoreSelector || null;
  const safeAreaOwnerSelector = check.safeAreaOwnerSelector || null;
  const occlusionRatioThreshold = check.occlusionRatioThreshold ?? 0.30;
  const safeAreaOverlapPx = check.safeAreaOverlapPx ?? 4;
  const settleMs = check.settleMs ?? 450;

  await page.setViewportSize(vp);
  await page.emulateMedia({ reducedMotion: 'reduce' }).catch(() => {});

  let safeAreaEmulated = false;
  try {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', {
      insets: { top: 0, bottom: safeAreaBottom, left: 0, right: 0 },
    });
    safeAreaEmulated = true;
  } catch { /* older Chromium — reported below */ }

  // Freeze animations/transitions so geometry is stable (MO-08).
  await page.addStyleTag({
    content: '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;scroll-behavior:auto!important}',
  }).catch(() => {});

  await page.waitForTimeout(settleMs);

  const problems = await page.evaluate(
    (opts) => {
      const {
        safeAreaBottom, interactiveSelector, ignoreSelector, safeAreaOwnerSelector,
        occlusionRatioThreshold, safeAreaOverlapPx, vpH, vpW,
      } = opts;

      const csOf = (el) => el.getRootNode().host ? getComputedStyle(el) : getComputedStyle(el);
      const posOf = (el) => getComputedStyle(el).position;
      const isFixedOrSticky = (el) => { const p = posOf(el); return p === 'fixed' || p === 'sticky'; };
      const fixedAncestor = (el) => {
        for (let n = el; n; n = n.parentElement || (n.getRootNode() && n.getRootNode().host)) {
          if (n.nodeType === 1 && isFixedOrSticky(n)) return n;
          if (!n.parentElement && !(n.getRootNode() && n.getRootNode().host)) break;
        }
        return null;
      };

      // Descend from a composed hit into open shadow roots (MO-05). document
      // .elementsFromPoint returns the shadow HOST, not the leaf inside its shadow
      // tree — so a `position:fixed` element living inside an open web-component
      // shadow root (its host not itself fixed) would otherwise be invisible to the
      // occlusion test. Pierce downward while the current node exposes an OPEN
      // shadowRoot. Limit: CLOSED shadow roots cannot be pierced (the browser gives
      // no access) — occlusion by a fixed element inside a closed shadow root whose
      // host isn't fixed is a documented blind spot, rare in app code.
      const pierce = (node, x, y) => {
        let cur = node;
        for (let depth = 0; cur && cur.shadowRoot && depth < 8; depth++) {
          const inner = cur.shadowRoot.elementFromPoint(x, y);
          if (!inner || inner === cur) break;
          cur = inner;
        }
        return cur;
      };

      // Recursively collect elements matching a selector across open shadow roots (MO-05).
      const queryDeep = (sel, root = document, acc = []) => {
        root.querySelectorAll(sel).forEach((e) => acc.push(e));
        root.querySelectorAll('*').forEach((e) => { if (e.shadowRoot) queryDeep(sel, e.shadowRoot, acc); });
        return acc;
      };
      const setOfDeep = (sel) => (sel ? new Set(queryDeep(sel)) : new Set());

      // Effective actionability: skip elements made non-actionable by any
      // ancestor (display:none/visibility:hidden/opacity:0/pointer-events:none/
      // inert/aria-hidden) — this is what keeps a modal's inert background from
      // being reported (MO-06).
      const isActionable = (el) => {
        for (let n = el; n && n.nodeType === 1; n = n.parentElement || (n.getRootNode() && n.getRootNode().host)) {
          const s = getComputedStyle(n);
          if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
          if (s.pointerEvents === 'none') return false;
          if (n.hasAttribute && (n.hasAttribute('inert') || n.getAttribute('aria-hidden') === 'true')) return false;
          if (!n.parentElement && !(n.getRootNode() && n.getRootNode().host)) break;
        }
        return true;
      };

      // Visible rect intersected with the viewport (and with clipping ancestors,
      // approximated by the viewport — full clip-chain intersection is overkill
      // for the tap-area estimate).
      const visibleRect = (el) => {
        const r = el.getBoundingClientRect();
        const left = Math.max(0, r.left), top = Math.max(0, r.top);
        const right = Math.min(vpW, r.right), bottom = Math.min(vpH, r.bottom);
        if (right - left < 6 || bottom - top < 6) return null;
        return { left, top, right, bottom, w: right - left, h: bottom - top };
      };

      const ignored = setOfDeep(ignoreSelector);
      const owners = setOfDeep(safeAreaOwnerSelector);
      const isOwned = (el) => { for (let n = el; n; n = n.parentElement) if (owners.has(n)) return true; return false; };

      const labelOf = (el) =>
        (el.getAttribute('aria-label') || el.getAttribute('data-testid') ||
          (el.textContent || '').trim().slice(0, 32) || el.tagName).toString();

      const els = queryDeep(interactiveSelector);
      const safeZoneTop = vpH - safeAreaBottom;
      const problems = [];
      const seen = new Set();

      for (const el of els) {
        if (seen.has(el) || ignored.has(el)) continue;
        seen.add(el);
        if (!isActionable(el)) continue;
        const vr = visibleRect(el);
        if (!vr) continue;
        const label = labelOf(el);

        // (a) OCCLUSION via an inset sample grid over the visible tap area (MO-03).
        //     Count samples whose topmost composed element is DIFFERENT fixed/
        //     sticky chrome. Fail when the covered fraction exceeds the threshold.
        const N = 4; // 4x4 = 16 inset samples
        let total = 0, covered = 0, occluder = null;
        for (let i = 0; i < N; i++) {
          for (let j = 0; j < N; j++) {
            const x = vr.left + vr.w * ((i + 0.5) / N);
            const y = vr.top + vr.h * ((j + 0.5) / N);
            if (x < 0 || y < 0 || x >= vpW || y >= vpH) continue;
            total++;
            const stack = document.elementsFromPoint(x, y); // composed, top-first
            // find the first element that isn't self/descendant/ancestor, piercing
            // open shadow roots so a fixed leaf inside a web component is seen (MO-05).
            let hit = null;
            for (const cand of stack) {
              if (cand === el || el.contains(cand) || cand.contains(el)) { hit = null; break; }
              const deep = pierce(cand, x, y);
              if (deep === el || el.contains(deep) || (deep && deep.contains(el))) { hit = null; break; }
              hit = deep || cand; break;
            }
            if (hit && (isFixedOrSticky(hit) || fixedAncestor(hit))) {
              covered++;
              occluder = occluder || labelOf(fixedAncestor(hit) || hit).slice(0, 40);
            }
          }
        }
        if (total > 0 && covered / total > occlusionRatioThreshold) {
          problems.push({ el: label, issue: 'occluded-by-fixed-chrome', occluder, coverage: +(covered / total).toFixed(2) });
          continue;
        }

        // (b) SAFE-AREA: only FIXED/STICKY controls (flow content can scroll into
        //     view — MO-01) that aren't declared safe-area owners (MO-04), whose
        //     box extends more than a tolerance into the gesture-bar zone.
        const selfFixed = isFixedOrSticky(el) || fixedAncestor(el);
        if (selfFixed && !isOwned(el)) {
          const r = el.getBoundingClientRect();
          if (r.bottom - safeZoneTop > safeAreaOverlapPx && r.top < vpH) {
            problems.push({
              el: label, issue: 'in-safe-area-zone',
              overlap_px: Math.round(r.bottom - safeZoneTop), safe_zone_top: Math.round(safeZoneTop),
            });
          }
        }
      }
      return problems;
    },
    {
      safeAreaBottom, interactiveSelector, ignoreSelector, safeAreaOwnerSelector,
      occlusionRatioThreshold, safeAreaOverlapPx, vpH: vp.height, vpW: vp.width,
    }
  );

  const scope = `@ ${vp.width}x${vp.height}, safe-area ${safeAreaBottom}px`;
  if (!safeAreaEmulated) {
    // MO-09: distinct unsupported-capability result; still surface any occlusion
    // found (occlusion detection does not need the inset), but never pass.
    const occ = problems.filter((p) => p.issue === 'occluded-by-fixed-chrome');
    return {
      pass: false,
      detail:
        `UNSUPPORTED: Chromium lacks Emulation.setSafeAreaInsetsOverride — safe-area dimension NOT verified ${scope}` +
        (occ.length ? `; occlusion still found: ${occ.map((p) => `"${p.el}"`).join(', ')}` : ''),
    };
  }
  const pass = problems.length === 0;
  const detail = pass
    ? `ok — no occluded/safe-area-clipped controls ${scope}`
    : `${problems.length} issue(s) ${scope}: ` +
      problems.slice(0, 8).map((p) =>
        `"${p.el}"[${p.issue}${p.occluder ? ` by ${p.occluder} ${Math.round(p.coverage * 100)}%` : ''}${p.overlap_px ? ` +${p.overlap_px}px` : ''}]`
      ).join('; ');
  return { pass, detail };
}
