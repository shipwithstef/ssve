// Check: an element matching `selector` is present in the DOM.
// Shape: { type: 'presence', selector: '...', name?: '...' }
export async function checkPresence(page, { selector }) {
  if (!selector) return { pass: false, detail: 'missing selector' };
  const count = await page.locator(selector).count();
  return { pass: count > 0, detail: `found ${count} element(s)` };
}
