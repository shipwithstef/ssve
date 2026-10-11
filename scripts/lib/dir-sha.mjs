// sha256 over a whole directory tree: every regular file, relative paths sorted bytewise, each
// contributing len(path) path len(bytes) bytes with 8-byte big-endian lengths, so no file name or
// content can imitate the framing of another tree. Symlinks and other non-regular entries are refused
// (a symlink could point outside the frozen tree). Used to freeze the reserve tasks.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function dirSha(dir) {
  const files = [];
  const walk = (d, rel) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isSymbolicLink()) throw new Error(`symlink in frozen task directory: ${r}`);
      if (e.isDirectory()) walk(path.join(d, e.name), r);
      else if (e.isFile()) files.push(r);
      else throw new Error(`non-regular file in frozen task directory: ${r}`);
    }
  };
  walk(dir, "");
  files.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const h = crypto.createHash("sha256");
  const len = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; };
  for (const r of files) {
    const name = Buffer.from(r), body = fs.readFileSync(path.join(dir, r));
    h.update(len(name.length)); h.update(name); h.update(len(body.length)); h.update(body);
  }
  return h.digest("hex");
}
