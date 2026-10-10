export function parseCsvLine(line) {
  if (typeof line !== "string") throw new TypeError("not a string");
  const out = []; let i = 0;
  while (true) {
    if (line[i] === '"') {
      let v = ""; i++;
      while (true) {
        if (i >= line.length) throw new SyntaxError("unterminated");
        if (line[i] === '"') { if (line[i + 1] === '"') { v += '"'; i += 2; continue; } i++; break; }
        v += line[i++];
      }
      out.push(v);
      if (i === line.length) return out;
      if (line[i] !== ",") throw new SyntaxError("after quote");
      i++;
    } else {
      const j = line.indexOf(",", i);
      if (j < 0) { out.push(line.slice(i)); return out; }
      out.push(line.slice(i, j)); i = j + 1;
    }
  }
}
