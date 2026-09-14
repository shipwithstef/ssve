import { readFileSync } from "node:fs";

const CLASSES = new Set(["essential", "conditional", "situational"]);

export function validateStageRegistry(document, source = "stage registry") {
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new Error(`${source} must be a JSON object`);
  }
  if (!Array.isArray(document.stages) || document.stages.length === 0) {
    throw new Error(`${source} has no "stages" array`);
  }
  const seen = new Set();
  for (const stage of document.stages) {
    if (!stage || typeof stage.key !== "string" || stage.key.length === 0) {
      throw new Error(`${source} has an entry with no "key"`);
    }
    if (seen.has(stage.key)) throw new Error(`${source} has duplicate stage key "${stage.key}"`);
    seen.add(stage.key);
    if (!CLASSES.has(stage.class)) {
      throw new Error(`${source} entry "${stage.key}" has class "${stage.class}"; expected essential|conditional|situational`);
    }
  }
  const essential = document.stages.filter((stage) => stage.class === "essential").map((stage) => stage.key);
  if (essential.length === 0) throw new Error(`${source} has zero essential-class stages`);
  const profiles = document.story_type_profiles;
  if (!profiles || typeof profiles !== "object" || Array.isArray(profiles)) {
    throw new Error(`${source} has no "story_type_profiles" object`);
  }
  const classByKey = new Map(document.stages.map((stage) => [stage.key, stage.class]));
  for (const [profile, stages] of Object.entries(profiles)) {
    if (!Array.isArray(stages)) throw new Error(`${source} profile "${profile}" is not an array`);
    for (const key of stages) {
      if (!seen.has(key)) throw new Error(`${source} profile "${profile}" references unknown stage "${key}"`);
      if (classByKey.get(key) === "situational") {
        throw new Error(`${source} profile "${profile}" requires situational stage "${key}"`);
      }
    }
  }
  if (document.mandatory_chain_segments !== undefined) {
    validateMandatoryChainSegments(document, source);
  }
  return Object.freeze({ ...document, essential: Object.freeze(essential) });
}

const CHAIN_RECEIPT_TYPES = new Set([
  "plan-manifest",
  "review-plan",
  "exec-record",
  "review-exec",
  "audit-implementation",
]);
const CHECKPOINT_SKILLS = new Set(["plan-changeset", "execute-changeset", "land-changeset"]);

export function deriveMandatoryChainSegments(document) {
  const segments = document.mandatory_chain_segments;
  if (!Array.isArray(segments)) return [];
  return segments.map((seg) => ({
    id: seg.id,
    stages: seg.steps.map((step) => step.skill),
    checkpoint_after: seg.checkpoint_after_skill,
    emits: Array.isArray(seg.emits) ? seg.emits : [],
  }));
}

export function validateMandatoryChainSegments(document, source = "stage registry", allowedSkills = null) {
  const segments = document.mandatory_chain_segments;
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error(`${source} missing mandatory_chain_segments array`);
  }
  const stageKeys = new Set(document.stages.map((stage) => stage.key));
  const skillAllowlist = allowedSkills instanceof Set ? allowedSkills
    : Array.isArray(allowedSkills) ? new Set(allowedSkills)
    : null;
  const ids = new Set();
  const checkpointSeen = new Set();
  for (const seg of segments) {
    if (!seg || typeof seg.id !== "string" || !seg.id) {
      throw new Error(`${source} segment missing id`);
    }
    if (ids.has(seg.id)) throw new Error(`${source} duplicate segment id "${seg.id}"`);
    ids.add(seg.id);
    if (!Array.isArray(seg.steps) || seg.steps.length === 0) {
      throw new Error(`${source} segment "${seg.id}" has no steps`);
    }
    if (!CHECKPOINT_SKILLS.has(seg.checkpoint_after_skill)) {
      throw new Error(`${source} segment "${seg.id}" checkpoint_after_skill must be plan-changeset|execute-changeset|land-changeset`);
    }
    checkpointSeen.add(seg.checkpoint_after_skill);
    for (const step of seg.steps) {
      if (!step || typeof step.skill !== "string") {
        throw new Error(`${source} segment "${seg.id}" step missing skill`);
      }
      if (skillAllowlist && !skillAllowlist.has(step.skill)) {
        throw new Error(`${source} segment "${seg.id}" references unknown skill "${step.skill}" (not in includedSkills or mandatoryChainOutOfLane)`);
      }
      if (step.stage_key !== null && typeof step.stage_key === "string" && !stageKeys.has(step.stage_key)) {
        throw new Error(`${source} segment "${seg.id}" references unknown stage_key "${step.stage_key}"`);
      }
    }
    for (const emit of seg.emits || []) {
      if (!CHAIN_RECEIPT_TYPES.has(emit)) {
        throw new Error(`${source} segment "${seg.id}" emits unknown chain receipt type "${emit}"`);
      }
    }
  }
  for (const skill of CHECKPOINT_SKILLS) {
    if (!checkpointSeen.has(skill)) {
      throw new Error(`${source} mandatory_chain_segments missing checkpoint_after_skill for ${skill}`);
    }
  }
}

export function loadStageRegistry(filePath = "references/stage-registry.json") {
  let text;
  try { text = readFileSync(filePath, "utf8"); }
  catch (error) { throw new Error(`stage registry not found or unreadable: ${filePath} — ${error.message}`); }
  let document;
  try { document = JSON.parse(text); }
  catch (error) { throw new Error(`stage registry is invalid JSON: ${filePath} — ${error.message}`); }
  return validateStageRegistry(document, filePath);
}
