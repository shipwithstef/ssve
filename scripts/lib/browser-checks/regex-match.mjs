// Check: textContent of the first matching element matches `pattern` (regex).
// Shape: { type: 'regex-match', selector: '...', pattern: '...', flags?: 'i', name?: '...' }
export async function checkRegexMatch(page, { selector, pattern, flags }) {
  if (!selector) return { pass: false, detail: 'missing selector' };
  if (!pattern) return { pass: false, detail: 'missing pattern' };
  const count = await page.locator(selector).count();
  if (count === 0) return { pass: false, detail: 'selector matched 0 elements' };
  const text = (await page.locator(selector).first().textContent()) ?? '';
  const re = new RegExp(pattern, flags || '');
  return {
    pass: re.test(text),
    detail: re.test(text) ? 'regex matched' : `regex /${pattern}/${flags || ''} did not match`,
  };
}
