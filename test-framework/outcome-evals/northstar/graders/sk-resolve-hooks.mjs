// Resolve hook behind sk-resolve.mjs: "@graders/<file>" -> this directory.
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const GRADERS = path.dirname(fileURLToPath(import.meta.url));
const PREFIX = "@graders/";

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(PREFIX)) {
    const target = path.resolve(GRADERS, specifier.slice(PREFIX.length));
    if (target !== GRADERS && target.startsWith(GRADERS + path.sep)) return nextResolve(pathToFileURL(target).href, context);
  }
  return nextResolve(specifier, context);
}
