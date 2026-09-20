#!/usr/bin/env node

/**
 * Serious Vibe Coding — A2UI Catalog Generator
 * 
 * Automatically parses React/Vue components from src/components/ui/
 * and generates a valid A2UI Catalog JSON for Claude Design.
 */

import fs from 'fs';
import path from 'path';

const UI_DIR = 'src/components/ui';
const OUTPUT_FILE = 'docs/specs/ui/catalog.json';

function generateCatalog() {
  if (!fs.existsSync(UI_DIR)) {
    console.log(`[A2UI] Skipping: ${UI_DIR} not found.`);
    return;
  }

  const components = {};
  const files = fs.readdirSync(UI_DIR).filter(f => f.match(/\.(tsx|jsx|vue)$/)).sort();

  for (const file of files) {
    const name = path.parse(file).name;
    const content = fs.readFileSync(path.join(UI_DIR, file), 'utf8');

    // Heuristic for single-line primitive/literal declarations, not a TypeScript parser.
    const props = {};
    const propMatches = content.matchAll(/(\w+)\??:\s*((?=(?:string|number|boolean)\b|["'])(?:"[^"\r\n]*"|'[^'\r\n]*'|[^;,}\r\n])+)/g);
    const literalUnion = /^(?:"[^"\\]*"|'[^'\\]*')(?:\s*\|\s*(?:"[^"\\]*"|'[^'\\]*'))*$/;
    for (const [, propName, declaration] of propMatches) {
      const type = declaration.trim().replace(/,$/, "").trim();
      if (["string", "number", "boolean"].includes(type)) props[propName] = { type };
      else if (literalUnion.test(type)) {
        const values = [...type.matchAll(/"([^"\\]*)"|'([^'\\]*)'/g)].map((m) => m[1] ?? m[2]);
        props[propName] = { type: "string", enum: [...new Set(values)] };
      }
    }

    components[name] = {
      type: "object",
      properties: {
        component: { const: name },
        ...props
      }
    };
  }

  const catalog = {
    catalogId: `https://svc.local/catalog/${path.basename(process.cwd())}`,
    components
  };

  if (!fs.existsSync(path.dirname(OUTPUT_FILE))) {
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(catalog, null, 2));
  console.log(`[A2UI] Generated catalog with ${Object.keys(components).length} components → ${OUTPUT_FILE}`);
}

generateCatalog();
