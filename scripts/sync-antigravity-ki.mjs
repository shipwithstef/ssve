#!/usr/bin/env node

/**
 * sync-antigravity-ki.mjs — Converts svc project state into an Antigravity Knowledge Item
 * 
 * Auto-creates a KI so Antigravity "knows" the project context, routing, and steering rules
 * immediately upon starting a chat, without needing to be told to "Read ANTIGRAVITY.md".
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const appDataDir = path.join(os.homedir(), '.gemini', 'antigravity');

// We hash the current working directory to tie the KI to THIS specific workspace
const cwdHash = crypto.createHash('md5').update(process.cwd()).digest('hex').substring(0, 8);
const kiDir = path.join(appDataDir, 'knowledge', `svc-context-${cwdHash}`);
const artifactsDir = path.join(kiDir, 'artifacts');

try {
  fs.mkdirSync(artifactsDir, { recursive: true });

  const metadata = {
    summary: `Serious Vibe Coding (svc) Framework rules and project state for the workspace at ${process.cwd()}. Contains active routing rules and tech stack steering context. READ the artifacts here before making technical decisions.`,
    timestamp: new Date().toISOString(),
    references: ["ANTIGRAVITY.md", "docs/specs/project-state.md", "docs/specs/router-context.md"]
  };

  fs.writeFileSync(path.join(kiDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

  // Bootstrap ANTIGRAVITY.md from template if missing
  const localAntigravityPath = path.resolve(process.cwd(), 'ANTIGRAVITY.md');
  const templatePath = path.join(appDataDir, 'skills', 'ANTIGRAVITY.md');
  if (!fs.existsSync(localAntigravityPath) && fs.existsSync(templatePath)) {
      fs.copyFileSync(templatePath, localAntigravityPath);
      console.log(`  ✓ Bootstrapped ANTIGRAVITY.md template to new workspace`);
  }

  let synced = 0;
  // Sync core baseline files into the knowledge base
  const filesToSync = [
    'ANTIGRAVITY.md', 
    'docs/specs/project-state.md', 
    'docs/specs/router-context.md',
    'docs/specs/agent-topology.md'
  ];

  filesToSync.forEach(f => {
      const fullPath = path.resolve(process.cwd(), f);
      if (fs.existsSync(fullPath)) {
          // Flatten path so everything fits in the artifacts dir cleanly
          const dest = path.join(artifactsDir, f.replace(/\//g, '_'));
          fs.copyFileSync(fullPath, dest);
          console.log(`  ✓ Synced ${f} to Antigravity KI`);
          synced++;
      }
  });

  if (synced > 0) {
      console.log(`\nAntigravity Knowledge Item successfully mapped for this workspace.`);
      console.log(`Context will automatically load in future sessions.`);
  } else {
      console.log(`\nNo svc tracking files found yet. Run onboard-repo or create ANTIGRAVITY.md first.`);
  }

} catch (err) {
  console.error("Failed to sync Antigravity KI:", err.message);
}
