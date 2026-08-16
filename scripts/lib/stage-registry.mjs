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
  return Object.freeze({ ...document, essential: Object.freeze(essential) });
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
