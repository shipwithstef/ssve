// normalize-ac-table — deterministic sha256 binding of a spec's Acceptance
// Criteria, shared by the baton distiller (plan-changeset), check-chain-receipts,
// and the tier-1 binding validator (WI-381).
//
// The plan-manifest baton's `ac_digests` is a NAVIGATION index, never the
// authoritative AC source — the live spec is. To stop a baton from silently
// going stale when ACs are REVISED mid-pipeline, the baton stores a sha256 over
// the spec's normalized AC signatures; downstream consumers recompute it and
// fail on mismatch (forcing a re-distill).
//
// Normalization is deliberately:
//   INSENSITIVE to  — checkbox progress flips (- [ ] ↔ - [x]); execution-time
//                     `*(...)*` verification annotations appended to a checklist
//                     AC; an AC table's proof/status columns (only id + first
//                     requirement cell are hashed).
//   SENSITIVE to    — real AC requirement-text changes, additions, removals
//                     (exactly the revisions WI-381 AC1 must catch).
// Both formats svc uses are handled: markdown AC tables (`| AC | Description | …`)
// and checklist ACs (`- [ ] …`). Distiller and validator share THIS function, so
// the binding is internally consistent by construction.

import { createHash } from "node:crypto";

// Extract the Acceptance Criteria section: from the first heading whose text
// contains "Acceptance Criteria" to the next heading of the same-or-higher level
// (or EOF).
export function extractAcSection(specText) {
  const lines = String(specText).split("\n");
  let start = -1, startLevel = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+.*acceptance criteria/i);
    if (m) { start = i; startLevel = m[1].length; break; }
  }
  if (start === -1) return "";
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+/);
    if (m && m[1].length <= startLevel) { end = i; break; }
  }
  return lines.slice(start + 1, end).join("\n");
}

const norm = (s) => String(s).replace(/\s+/g, " ").trim().toLowerCase();

// Stable per-AC signatures (identifier + requirement). Order-preserving.
export function acSignatures(specText) {
  const section = extractAcSection(specText);
  const sigs = [];
  for (const raw of section.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/^\|/.test(line)) {                                  // markdown table row
      if (/^\|[\s:|-]+\|?$/.test(line)) continue;            // separator |---|---|
      const cells = line.split("|").map((c) => c.trim()).filter((c) => c.length);
      if (!cells.length) continue;
      if (/^(ac|acceptance criteria|id|#|criteria)$/i.test(cells[0])) continue; // header row
      sigs.push(norm(cells[0]) + "::" + norm(cells[1] || ""));   // id + requirement; drop proof/status cols
    } else if (/^[-*]\s*\[[ xX]\]/.test(line)) {             // checklist AC
      let t = line.replace(/^[-*]\s*\[[ xX]\]\s*/, "");      // strip checkbox state
      t = t.replace(/\s*\*\([^)]*\)\*\s*$/, "");             // strip trailing *(...)* verification annotation
      sigs.push(norm(t));
    } else {
      // Work-item ACs use labeled bullets: "- **AC-531-1:** requirement".
      // Bind the stable label and requirement while ignoring Markdown styling.
      const labeled = line.match(/^[-*]\s+\*\*([^*]+):\*\*\s+(.+)$/);
      if (labeled) sigs.push(norm(labeled[1]) + "::" + norm(labeled[2]));
    }
  }
  return sigs;
}

// sha256 over the normalized AC signatures (the value stored in the baton and
// recomputed by validators). Deterministic; empty spec → hash of "".
export function acTableSha256(specText) {
  return createHash("sha256").update(acSignatures(specText).join("\n"), "utf8").digest("hex");
}
