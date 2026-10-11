// Pure helper (no probe runtime): is an SVG an illustration or a drawing of basic shapes?
export const MIN = { svgPaths: 6, svgSegments: 40, svgCurves: 8 };

// What an SVG is made of. An illustration has many path segments with curves; a drawing of
// circles, rectangles, lines, polygons and a few straight-edged paths is primitives.
export function svgInfo(text) {
  const shapes = (text.match(/<(?:circle|ellipse|rect|line|polygon|polyline)\b/gi) || []).length;
  const ds = [...text.matchAll(/<path\b[^>]*?\bd\s*=\s*["']([^"']*)["']/gi)].map((m) => m[1]);
  const segs = ds.reduce((n, d) => n + (d.match(/[MLHVCSQTAZmlhvcsqtaz]/g) || []).length, 0);
  const curves = ds.reduce((n, d) => n + (d.match(/[CSQTAcsqta]/g) || []).length, 0);
  const illustration = ds.length >= MIN.svgPaths && segs >= MIN.svgSegments && curves >= MIN.svgCurves && shapes <= ds.length;
  return { shapes, paths: ds.length, segments: segs, curves, illustration };
}
