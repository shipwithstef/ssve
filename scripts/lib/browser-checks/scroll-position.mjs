// Check: after an optional setup sequence (scroll a container, then navigate),
// a scroll container ends at the expected position.
//
// Why: SPAs commonly reuse ONE scroll container across routes. If navigation
// doesn't reset it, a page opens at the PREVIOUS view's scroll offset — e.g.
// "Profile opens scrolled to the bottom." DOM-presence and single-URL loads miss
// this because the bug only appears after scroll + in-app navigation.
//
// Shape: {
//   type: 'scroll-position',
//   container?: string,             // scroll container selector; default document scrolling root
//   expect?: 'top' | 'bottom' | number,  // default 'top'
//   before?: Array<                 // setup run in order before the assertion:
//     | { action: 'scroll', container?: string, to: 'top'|'bottom'|number }
//     | { action: 'click', selector: string }
//   >,
//   tolerancePx?: number,           // default 4
//   waitMs?: number,                // pause after each step + before asserting; default 400
//   name?: string,
// }
// Returns { pass, detail }.

export async function checkScrollPosition(page, check = {}) {
  const container = check.container || null;
  const tol = check.tolerancePx ?? 4;
  const waitMs = check.waitMs ?? 400;
  const before = Array.isArray(check.before) ? check.before : [];

  // Run the setup sequence. A step that cannot execute (missing container, click
  // failure, a scroll-to-bottom that doesn't move) FAILS the check — otherwise
  // the assertion could pass at top without ever reproducing the navigation
  // (MO/NG-01). We report the failing step, not a misleading "ok at top".
  for (let s = 0; s < before.length; s++) {
    const step = before[s];
    if (step.action === 'scroll') {
      const sel = step.container || container;
      const r = await page.evaluate(
        ({ sel, to }) => {
          const el = sel ? document.querySelector(sel) : (document.scrollingElement || document.documentElement);
          if (!el) return { found: false };
          const max = el.scrollHeight - el.clientHeight;
          const before = el.scrollTop;
          el.scrollTop = to === 'bottom' ? max : to === 'top' ? 0 : (typeof to === 'number' ? to : 0);
          return { found: true, max, before, after: el.scrollTop };
        },
        { sel, to: step.to }
      );
      if (!r.found) return { pass: false, detail: `setup step ${s} (scroll): container not found: ${sel || '(document root)'}` };
      if (step.to === 'bottom' && r.max > 0 && r.after <= 0) {
        return { pass: false, detail: `setup step ${s} (scroll to bottom): scroll did not move (max ${r.max}, after ${r.after}) — cannot reproduce navigation` };
      }
    } else if (step.action === 'click') {
      try {
        await page.click(step.selector, { timeout: 3000 });
      } catch (e) {
        return { pass: false, detail: `setup step ${s} (click ${step.selector}) failed: ${e.message.split('\n')[0]}` };
      }
    } else {
      return { pass: false, detail: `unknown setup step action: ${step.action}` };
    }
    await page.waitForTimeout(waitMs);
  }

  // Poll for a stable scroll position (NG-02) — a delayed scroll restoration that
  // fires after a fixed sleep would otherwise escape a single snapshot.
  const measure = () => page.evaluate(
    ({ sel }) => {
      const el = sel ? document.querySelector(sel) : (document.scrollingElement || document.documentElement);
      if (!el) return { found: false };
      return { found: true, scrollTop: Math.round(el.scrollTop), max: Math.round(el.scrollHeight - el.clientHeight) };
    },
    { sel: container }
  );
  let res = await measure();
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(120);
    const next = await measure();
    if (next.found && res.found && next.scrollTop === res.scrollTop) { res = next; break; }
    res = next;
  }

  if (!res.found) return { pass: false, detail: `scroll container not found: ${container || '(document root)'}` };

  const expect = check.expect ?? 'top';
  const target = expect === 'top' ? 0 : expect === 'bottom' ? res.max : Number(expect);
  const pass = Math.abs(res.scrollTop - target) <= tol;
  return {
    pass,
    detail: `scrollTop=${res.scrollTop} (max ${res.max}); expected ${expect}=${target} ±${tol} — ${pass ? 'ok' : 'MISMATCH — container kept a stale offset'}`,
  };
}
