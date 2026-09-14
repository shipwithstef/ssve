// scripts/lib/browser-checks/index.mjs
// Dispatcher for per-check-type implementations.
//
// Each check is:  { type, selector?, value?, pattern?, attr?, count?, name? }
// Each result is: { name, type, pass, detail? }

import { checkPresence } from './presence.mjs';
import { checkTextContains } from './text-contains.mjs';
import { checkRegexMatch } from './regex-match.mjs';
import { checkAttrEquals } from './attr-equals.mjs';
import { checkCountElements } from './count-elements.mjs';
import { checkScreenshotMatches } from './screenshot-matches.mjs';
import { checkMobileOcclusion } from './mobile-occlusion.mjs';
import { checkScrollPosition } from './scroll-position.mjs';

const REGISTRY = {
  'presence': checkPresence,
  'text-contains': checkTextContains,
  'regex-match': checkRegexMatch,
  'attr-equals': checkAttrEquals,
  'count-elements': checkCountElements,
  'screenshot-matches': checkScreenshotMatches,
  'mobile-occlusion': checkMobileOcclusion,
  'scroll-position': checkScrollPosition,
};

export async function runCheck(page, check, ctx) {
  const impl = REGISTRY[check.type];
  const name = check.name || `${check.type}:${check.selector || '-'}`;
  if (!impl) {
    return { name, type: check.type, pass: false, detail: `unknown check type: ${check.type}` };
  }
  try {
    const { pass, detail } = await impl(page, check, ctx);
    return { name, type: check.type, pass, ...(detail !== undefined ? { detail } : {}) };
  } catch (err) {
    return { name, type: check.type, pass: false, detail: `error: ${err.message}` };
  }
}

export const SUPPORTED_TYPES = Object.keys(REGISTRY);
