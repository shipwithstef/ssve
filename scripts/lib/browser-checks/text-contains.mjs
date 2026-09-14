// Check: the first element matching `selector` contains `value` as a substring of its textContent.
// Shape: { type: 'text-contains', selector: '...', value: '...', name?: '...' }
export async function checkTextContains(page, { selector, value }) {
  if (!selector) return { pass: false, detail: 'missing selector' };
  if (value == null) return { pass: false, detail: 'missing value' };
  const loc = page.locator(selector).first();
  const count = await page.locator(selector).count();
  if (count === 0) return { pass: false, detail: 'selector matched 0 elements' };
  const text = (await loc.textContent()) ?? '';
  return {
    pass: text.includes(value),
    detail: text.includes(value) ? `matched` : `text did not contain "${value}"`,
  };
}
