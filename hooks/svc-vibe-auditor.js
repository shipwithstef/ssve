/**
 * Serious Vibe Coding — Automated Vibe Auditor (AfterTool Hook)
 * 
 * Automatically triggers visual verification after UI edits
 * to ensure "Masterclass" soul parity.
 */

const { execSync } = require('child_process');
const fs = require('fs');

const payload = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
const { tool_name, tool_input, event_name } = payload;

// Only fire on successful UI file writes
if (event_name === 'AfterTool' && tool_name === 'write_file') {
  const filePath = tool_input.path || tool_input.file_path;
  
  if (filePath.match(/\.(tsx|jsx|vue|css)$/)) {
    console.log(`\n[VibeAudit] UI edit detected: ${filePath}`);
    console.log(`[VibeAudit] Triggering automated visual diff...`);
    
    try {
      // Trigger track-visuals sidecar
      const output = execSync('npx skills run track-visuals --mode diff', { encoding: 'utf8' });
      console.log(output);
    } catch (err) {
      console.log(`[VibeAudit] Visual diff failed or reported regressions.`);
    }
  }
}
