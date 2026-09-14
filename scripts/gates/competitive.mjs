/**
 * Competitive cross-reference gate config.
 *
 * SDKG instance: competitor-analysis. Consumed by structured-gate-engine.mjs.
 * Branches on data.landscape_state with 4-state behavior matrix per WI-140 spec.
 */

import { VERDICTS } from "../lib/structured-gate-engine.mjs";

const SECTION_HEADER = "## Industry Grounding";
const COMPENSATING_HEADER = "## Compensating Control";
const FIRST_MOVER_HEADER = "## First-Mover Risk Checklist";
const COMPENSATING_REQUIRED_FIELDS = ["missing_capability", "why_not_now", "risk_of_workaround", "path_to_replacement"];
const FIRST_MOVER_REQUIRED_ITEMS = ["why_no_one_tried", "what_would_have_to_be_true", "fastest_disconfirmation", "abandonment_trigger"];

function hasSection(artifact, header) {
  return artifact.includes(header);
}

function compensatingControlComplete(artifact) {
  if (!hasSection(artifact, COMPENSATING_HEADER)) return false;
  return COMPENSATING_REQUIRED_FIELDS.every((field) => {
    const re = new RegExp(`${field}\\s*:?\\s*\\S`, "i");
    return re.test(artifact);
  });
}

function firstMoverChecklistComplete(artifact) {
  if (!hasSection(artifact, FIRST_MOVER_HEADER)) return false;
  return FIRST_MOVER_REQUIRED_ITEMS.every((item) => artifact.includes(item));
}

function specHasCompetitiveRiskSection(artifact) {
  return hasSection(artifact, SECTION_HEADER);
}

export default {
  id: "competitive",
  branchField: "landscape_state",
  overrideEnvKey: "SVC_COMPETITIVE_LANDSCAPE_OVERRIDE",
  branches: {
    populated({ data, currentArtifact }) {
      // Per GATE-03: zero competitors do this → BLOCK unless compensating-control present
      if (!specHasCompetitiveRiskSection(currentArtifact)) {
        return {
          verdict: VERDICTS.BLOCK,
          reason: `Spec missing required '${SECTION_HEADER}' section. landscape_state=populated demands explicit cross-reference.`,
          missingFields: [SECTION_HEADER],
          citations: data.competitors.map((c) => ({ name: c.name, mechanism: c.earn_mechanism })),
        };
      }
      const specMentionsCompetitorMechanic = data.competitors.some((c) => {
        const tokens = [c.earn_mechanism, c.enrollment_path].filter(Boolean);
        return tokens.some((t) => currentArtifact.toLowerCase().includes(t.toLowerCase().slice(0, 24)));
      });
      if (!specMentionsCompetitorMechanic) {
        if (!compensatingControlComplete(currentArtifact)) {
          return {
            verdict: VERDICTS.BLOCK,
            reason: `Spec describes mechanic that no competitor uses (none of ${data.competitors.length} match). Compensating Control section required with all 4 fields.`,
            missingFields: COMPENSATING_REQUIRED_FIELDS.filter((f) => !new RegExp(`${f}\\s*:?\\s*\\S`, "i").test(currentArtifact)),
            citations: data.competitors.map((c) => ({ name: c.name, mechanism: c.earn_mechanism })),
          };
        }
        return {
          verdict: VERDICTS.PASS,
          reason: "Divergence from competitor patterns acknowledged via Compensating Control section.",
          missingFields: [],
          citations: data.competitors.map((c) => ({ name: c.name, mechanism: c.earn_mechanism })),
        };
      }
      return { verdict: VERDICTS.PASS, reason: "Spec aligns with at least one competitor pattern.", missingFields: [], citations: [] };
    },

    nascent({ data, currentArtifact }) {
      // Per GATE-04: 1-2 competitors → WARN + require thin_evidence_acknowledged
      if (!/thin_evidence_acknowledged\s*:\s*true/i.test(currentArtifact)) {
        return {
          verdict: VERDICTS.WARN,
          reason: `landscape_state=nascent (${data.competitors.length} competitors). Spec must include 'thin_evidence_acknowledged: true' frontmatter.`,
          missingFields: ["thin_evidence_acknowledged"],
          citations: data.competitors.map((c) => ({ name: c.name })),
        };
      }
      return { verdict: VERDICTS.WARN, reason: "Thin evidence acknowledged.", missingFields: [], citations: [] };
    },

    "none-found"({ currentArtifact }) {
      // Per GATE-05: true greenfield → first-mover risk checklist required
      if (!firstMoverChecklistComplete(currentArtifact)) {
        return {
          verdict: VERDICTS.BLOCK,
          reason: `landscape_state=none-found requires First-Mover Risk Checklist with all 4 items (${FIRST_MOVER_REQUIRED_ITEMS.join(", ")}).`,
          missingFields: FIRST_MOVER_REQUIRED_ITEMS.filter((i) => !currentArtifact.includes(i)),
          citations: [],
        };
      }
      return { verdict: VERDICTS.PASS, reason: "First-mover risk acknowledged with complete checklist.", missingFields: [], citations: [] };
    },

    inapplicable({ data }) {
      // Per GATE-06: skip + log justification (caller logs to pipeline-decisions.jsonl)
      return {
        verdict: VERDICTS.SKIP,
        reason: data.landscape_state_justification || "landscape_state=inapplicable",
        missingFields: !data.landscape_state_justification ? ["landscape_state_justification"] : [],
        citations: [],
      };
    },
  },
};
