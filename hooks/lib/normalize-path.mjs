// normalize-path — canonical repo-path normalizer shared by the index libs
// (WI-458 / no-loss audit C1). Extracted byte-identical from the duplicate
// `const norm` in learning-index.mjs + owner-index.mjs to remove the dup.
//
// Backslashes -> forward slashes; strip a single leading "./". Pure, no I/O.
export const norm = (p) => String(p).replace(/\\/g, "/").replace(/^\.\//, "");
export default norm;
