// Check: attribute `attr` on the first matching element equals `value`.
// Shape: { type: 'attr-equals', selector: '...', attr: 'href', value: '...', name?: '...' }
export async function checkAttrEquals(page, { selector, attr, value }) {
  if (!selector) return { pass: false, detail: 'missing selector' };
  if (!attr) return { pass: false, detail: 'missing attr' };
  if (value == null) return { pass: false, detail: 'missing value' };
  const count = await page.locator(selector).count();
  if (count === 0) return { pass: false, detail: 'selector matched 0 elements' };
  const actual = await page.locator(selector).first().getAttribute(attr);
  return {
    pass: actual === value,
    detail: actual === value ? 'matched' : `expected "${value}", got "${actual}"`,
  };
}
