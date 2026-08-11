#!/usr/bin/env node

/**
 * Serious Vibe Coding — W3C Token Linter
 * 
 * Scans for hardcoded hex/px values that should be semantic tokens.
 * Enforces use of docs/specs/ui/tokens.json.
 */

import fs from 'fs';
import { execSync } from 'child_process';

const TOKENS_FILE = 'docs/specs/ui/tokens.json';

function lintTokens() {
  if (!fs.existsSync(TOKENS_FILE)) {
    console.log(`[TokenLint] Skipping: ${TOKENS_FILE} not found.`);
    return;
  }

  const tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
  const hexValues = new Set();
  
  // Flatten token values for easy lookup
  const walk = (obj) => {
    for (const k in obj) {
      if (typeof obj[k] === 'object' && obj[k] !== null) {
        if (obj[k].$value) hexValues.add(obj[k].$value.toLowerCase());
        else walk(obj[k]);
      }
    }
  };
  walk(tokens);

  console.log(`[TokenLint] Monitoring ${hexValues.size} semantic values...`);

  try {
    // Get staged changes
    const diff = execSync('git diff --staged -- "*.tsx" "*.jsx" "*.css" "*.vue"', { encoding: 'utf8' });
    const lines = diff.split('\n');
    let errors = 0;

    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        const matches = line.match(/#[a-fA-F0-9]{3,8}|(\d+px)/g);
        if (matches) {
          for (const val of matches) {
            if (hexValues.has(val.toLowerCase())) {
              console.error(`[TokenLint] ERROR: Hardcoded value "${val}" matches a semantic token. Use the token key instead.`);
              errors++;
            }
          }
        }
      }
    }

    if (errors > 0) {
      console.error(`\n[TokenLint] FAILED: ${errors} token violations found.`);
      process.exit(1);
    } else {
      console.log(`[TokenLint] PASS: No hardcoded token violations.`);
    }
  } catch (err) {
    console.log(`[TokenLint] No staged UI changes to lint.`);
  }
}

lintTokens();
