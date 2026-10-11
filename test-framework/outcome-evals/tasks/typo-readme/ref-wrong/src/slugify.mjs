/**
 * Turn a title into a URL-safe slug.
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
  return String(text ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
