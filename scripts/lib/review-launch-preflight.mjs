// Cursor provides exact model IDs and provider display names in --list-models.
// This is a catalog claim plus successful exact-model argv, never a server model echo.
const FAMILY_LABEL = { anthropic: /^Claude\b/i, xai: /^Grok\b/i, google: /^Gemini\b/i, openai: /^(?:GPT|Codex|OpenAI|o[0-9])\b/i };

export function cursorCatalogEntry(output, model) {
  for (const line of String(output).split(/\r?\n/)) {
    const match = /^([a-z][a-z0-9._-]*)\s+-\s+(.+)$/i.exec(line.trim());
    if (match?.[1] === model) return { model: match[1], label: match[2].trim() };
  }
  return null;
}

export function cursorCatalogDecision(output, tuple, authority = 'independent') {
  const entry = cursorCatalogEntry(output, tuple.model === 'cursor-auto' ? 'auto' : tuple.model);
  if (!entry) return { ok: false, classification: 'model_unavailable', detail: `Cursor catalog does not list exact model ${tuple.model}` };
  if (tuple.family === 'multi') return { ok: true, entry };
  const pattern = FAMILY_LABEL[tuple.family];
  if (!pattern && authority === 'advisory') return { ok: true, entry };
  if (!pattern || !pattern.test(entry.label)) return { ok: false, classification: 'model_mismatch', detail: `Cursor catalog family disagrees with ${tuple.family} for ${tuple.model}` };
  return { ok: true, entry };
}

export function cursorIndependentModelShape(tuple) {
  if (!tuple || tuple.host !== 'cursor' || tuple.family === 'multi' || !FAMILY_LABEL[tuple.family]) return false;
  // Family is verified against Cursor's live catalog before launch; model IDs can
  // change their word order without a framework update. This only checks that
  // the owner selected an exact preset whose ID encodes the requested effort.
  return /^[a-z][a-z0-9._-]+$/.test(tuple.model) &&
    new RegExp(`-${tuple.effort}(?:-fast)?$`).test(tuple.model);
}

// Launcher 2.5.7 issued Cursor plan-mode receipts before exact catalog checks
// existed. Read that historical attestation only with its original argv shape;
// current launchers must use the catalog-verified ask-mode evidence.
export function cursorExactRouteEvidenceValid(receipt) {
  const evidence = receipt?.model_attestation?.evidence;
  const current = evidence === 'cursor_catalog_exact_model_plus_ask_mode_success_no_server_model_echo';
  const historical = receipt?.launcher_version === '2.5.7' &&
    evidence === 'cursor_plan_mode_exact_model_argv_plus_successful_json_exit_no_server_model_echo' &&
    receipt?.attempts?.length === 1;
  if (!current && !historical) return false;
  const attempt = receipt?.attempts?.at(-1);
  const command = attempt?.command;
  const argv = command?.argv;
  if (attempt?.tuple?.host !== 'cursor' || attempt?.tuple?.model !== receipt.invocation_tuple?.model ||
      typeof command?.binary !== 'string' || !command.binary || !Array.isArray(argv) ||
      (historical && command.binary !== 'cursor-agent')) return false;
  const singleArg = flag => argv.filter(value => value === flag).length === 1;
  return singleArg('--mode') && argv[argv.indexOf('--mode') + 1] === (current ? 'ask' : 'plan') &&
    singleArg('--model') && argv[argv.indexOf('--model') + 1] === receipt.invocation_tuple.model &&
    argv.includes('--print') && singleArg('--output-format') &&
    argv[argv.indexOf('--output-format') + 1] === 'json';
}

export function resolveReviewTimeout({ host, transportOptions = {}, environment = {}, defaultSeconds = 1800, defaultLockStaleSeconds = 3660 }) {
  const invalid = message => { throw new Error(message); };
  const positive = (value, label, maximum = Number.MAX_SAFE_INTEGER) => {
    if (!/^[0-9]+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > maximum)
      invalid(`${label} must be an integer from 1 to ${maximum}`);
    return Number(value);
  };
  if (transportOptions === null || typeof transportOptions !== 'object' || Array.isArray(transportOptions)) invalid('transport_options must be an object');
  const hostOptions = host ? transportOptions[host] : undefined;
  if (hostOptions !== undefined && (hostOptions === null || typeof hostOptions !== 'object' || Array.isArray(hostOptions))) invalid(`transport_options.${host} must be an object`);
  const policyValue = hostOptions?.timeout_seconds;
  const policySeconds = policyValue === undefined ? null : positive(policyValue, `transport_options.${host}.timeout_seconds`, 7200);
  const envValue = environment.SVC_EXTERNAL_REVIEW_TIMEOUT_SECONDS;
  const envSeconds = envValue === undefined || envValue === '' ? null : positive(envValue, 'SVC_EXTERNAL_REVIEW_TIMEOUT_SECONDS', 7200);
  const seconds = envSeconds ?? policySeconds ?? defaultSeconds;
  const source = envSeconds !== null ? 'environment' : policySeconds !== null ? 'owner-policy' : 'framework-default';
  const minimumLockStaleSeconds = 2 * seconds + 60;
  const lockValue = environment.SVC_EXTERNAL_REVIEW_LOCK_STALE_SECONDS;
  const explicitLock = lockValue !== undefined && lockValue !== '';
  const staleSeconds = explicitLock ? positive(lockValue, 'SVC_EXTERNAL_REVIEW_LOCK_STALE_SECONDS') : Math.max(defaultLockStaleSeconds, minimumLockStaleSeconds);
  if (staleSeconds < minimumLockStaleSeconds) invalid(`SVC_EXTERNAL_REVIEW_LOCK_STALE_SECONDS must be at least ${minimumLockStaleSeconds} for the effective ${seconds}-second reviewer timeout`);
  return { seconds, source, staleSeconds };
}
