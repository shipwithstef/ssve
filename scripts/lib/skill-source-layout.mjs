import fs from "node:fs";
import path from "node:path";

export const SKILLS_SOURCE_DIRNAME = "skills";

export function skillsSourceRoot(repoRoot) {
  return path.join(repoRoot, SKILLS_SOURCE_DIRNAME);
}

export function skillSourceDir(repoRoot, skillName) {
  if (typeof skillName !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skillName)) {
    throw new Error(`invalid skill name: ${JSON.stringify(skillName)}`);
  }
  return path.join(skillsSourceRoot(repoRoot), skillName);
}

export function skillSourceFile(repoRoot, skillName) {
  return path.join(skillSourceDir(repoRoot, skillName), "SKILL.md");
}

function isContained(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

export function validateSkillSource(repoRoot, skillName) {
  const root = skillsSourceRoot(repoRoot);
  const directory = skillSourceDir(repoRoot, skillName);
  const file = skillSourceFile(repoRoot, skillName);
  try {
    const rootStat = fs.lstatSync(root);
    const directoryStat = fs.lstatSync(directory);
    const fileStat = fs.lstatSync(file);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return { ok: false, reason: "source root is not a real directory" };
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) return { ok: false, reason: "skill source is not a real directory" };
    if (!fileStat.isFile() || fileStat.isSymbolicLink()) return { ok: false, reason: "SKILL.md is not a real file" };
    const realRoot = fs.realpathSync(root);
    const realDirectory = fs.realpathSync(directory);
    const realFile = fs.realpathSync(file);
    if (!isContained(realRoot, realDirectory) || !isContained(realRoot, realFile)) return { ok: false, reason: "skill source escapes packaged root" };
    return { ok: true, directory, file };
  } catch (error) {
    return { ok: false, reason: error.code || error.message };
  }
}

export function listSourceSkillNames(repoRoot) {
  const root = skillsSourceRoot(repoRoot);
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .filter((entry) => validateSkillSource(repoRoot, entry.name).ok)
    .map((entry) => entry.name)
    .sort();
}
