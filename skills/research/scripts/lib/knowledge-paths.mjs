import path from 'node:path';
import { fileURLToPath } from 'node:url';

const thisFile = fileURLToPath(import.meta.url);
const scriptsLibDir = path.dirname(thisFile);
const frameworkRoot = path.resolve(scriptsLibDir, '..', '..', '..', '..');

export function getFrameworkRoot() {
  return frameworkRoot;
}

export function getKnowledgeRoot() {
  if (process.env.SVC_KNOWLEDGE_DIR) {
    return path.resolve(process.env.SVC_KNOWLEDGE_DIR);
  }
  return path.join(frameworkRoot, 'references', 'knowledge');
}

export function resolveKnowledgePath(input) {
  const knowledgeRoot = getKnowledgeRoot();
  if (!input) return knowledgeRoot;
  if (path.isAbsolute(input)) return path.normalize(input);

  const normalized = input.replace(/\\/g, '/').replace(/\/+$/, '');
  if (normalized === 'references/knowledge') return knowledgeRoot;
  if (normalized.startsWith('references/knowledge/')) {
    return path.join(knowledgeRoot, normalized.slice('references/knowledge/'.length));
  }

  return path.join(knowledgeRoot, normalized);
}

export function displayKnowledgePath(input) {
  const resolved = resolveKnowledgePath(input);
  return path.relative(process.cwd(), resolved) || '.';
}
