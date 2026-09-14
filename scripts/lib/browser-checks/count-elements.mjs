// Check: number of elements matching `selector` equals (or satisfies cmp) `count`.
// Shape: { type: 'count-elements', selector: '...', count: N, cmp?: '=='|'>='|'<='|'>'|'<', name?: '...' }
export async function checkCountElements(page, { selector, count: expected, cmp }) {
  if (!selector) return { pass: false, detail: 'missing selector' };
  if (expected == null) return { pass: false, detail: 'missing count' };
  const actual = await page.locator(selector).count();
  const op = cmp || '==';
  const pass = (() => {
    switch (op) {
      case '==': return actual === expected;
      case '>=': return actual >= expected;
      case '<=': return actual <= expected;
      case '>': return actual > expected;
      case '<': return actual < expected;
      default: return false;
    }
  })();
  return { pass, detail: `actual=${actual} ${op} expected=${expected}` };
}
