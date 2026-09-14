import fs from "node:fs";
import path from "node:path";

function jsonCommands(value, out = []) {
  if (Array.isArray(value)) {
    for (const item of value) jsonCommands(item, out);
    return out;
  }
  if (!value || typeof value !== "object") return out;
  for (const [key, child] of Object.entries(value)) {
    if (key === "command" && typeof child === "string") out.push(child);
    else jsonCommands(child, out);
  }
  return out;
}

function governedJsonHooks(configPath, identity) {
  const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const matches = [];
  for (const [event, entries] of Object.entries(parsed.hooks || {})) {
    for (const [entryIndex, entry] of (entries || []).entries()) {
      const hooksList = Array.isArray(entry?.hooks) ? entry.hooks : (entry && typeof entry === "object" ? [entry] : []);
      for (const [hookIndex, hook] of hooksList.entries()) {
        const command = typeof hook?.command === "string" ? hook.command : "";
        if (!command.includes(identity)) continue;
        const eventKey = event.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
        matches.push({
          command,
          stateKey: `${path.resolve(configPath)}:${eventKey}:${entryIndex}:${hookIndex}`,
        });
      }
    }
  }
  return matches;
}

function explicitHookEnabled(stateConfigPath, stateKey) {
  if (!stateConfigPath || !fs.existsSync(stateConfigPath)) return { enabled: true, explicit: false };
  const lines = fs.readFileSync(stateConfigPath, "utf8").split(/\r?\n/);
  let inTarget = false;
  for (const line of lines) {
    const section = line.match(/^\s*\[hooks\.state\.("(?:[^"\\]|\\.)*")\]\s*$/);
    if (section) {
      let decoded = "";
      try { decoded = JSON.parse(section[1]); } catch { decoded = ""; }
      inTarget = decoded === stateKey;
      continue;
    }
    if (/^\s*\[.+\]\s*$/.test(line)) {
      inTarget = false;
      continue;
    }
    if (inTarget && /^\s*enabled\s*=\s*false\s*(?:#.*)?$/.test(line)) {
      return { enabled: false, explicit: true };
    }
    if (inTarget && /^\s*enabled\s*=\s*true\s*(?:#.*)?$/.test(line)) {
      return { enabled: true, explicit: true };
    }
  }
  return { enabled: true, explicit: false };
}

function tomlCommands(text) {
  const commands = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*command\s*=\s*("(?:[^"\\]|\\.)*")\s*(?:#.*)?$/);
    if (!match) continue;
    try { commands.push(JSON.parse(match[1])); } catch { /* invalid command is not evidence */ }
  }
  return commands;
}

export function configuredCommands(configPath, text = fs.readFileSync(configPath, "utf8")) {
  if (path.extname(configPath).toLowerCase() === ".json") {
    return jsonCommands(JSON.parse(text));
  }
  if (path.extname(configPath).toLowerCase() === ".toml") return tomlCommands(text);
  throw new Error(`unsupported governed config format: ${path.extname(configPath) || "<none>"}`);
}

// Bind every routing token to one effective command. Searching the whole config
// lets an unrelated note or sibling hook launder a direct-checkout command.
export function governedRoutingStatus(configPath, wiring, options = {}) {
  if (!wiring?.governed) return { ok: true, reason: "host declares no governed command" };
  const tokens = Array.isArray(wiring.governed_token)
    ? wiring.governed_token.filter(Boolean)
    : (wiring.governed_token ? [wiring.governed_token] : []);
  if (tokens.length === 0) return { ok: false, reason: "governed host missing governed_token" };
  if (!configPath || !fs.existsSync(configPath)) return { ok: false, reason: "host config absent" };

  let commands;
  let jsonHooks = null;
  try {
    commands = configuredCommands(configPath);
    if (path.extname(configPath).toLowerCase() === ".json") {
      jsonHooks = governedJsonHooks(configPath, tokens.at(-1));
    }
  }
  catch (error) { return { ok: false, reason: `host config cannot be parsed: ${error.message}` }; }

  const identity = tokens.at(-1);
  const candidates = commands.filter((command) => command.includes(identity));
  if (candidates.length !== 1) {
    return { ok: false, reason: `expected exactly one governed '${identity}' command, found ${candidates.length}` };
  }
  const missing = tokens.filter((token) => !candidates[0].includes(token));
  if (missing.length) {
    return { ok: false, reason: `effective governed command is missing marker(s): ${missing.join(", ")}` };
  }
  if (wiring.effective_state?.type === "codex-hooks-state") {
    if (!jsonHooks || jsonHooks.length !== 1) {
      return { ok: false, reason: "effective Codex hook position cannot be resolved" };
    }
    if (!options.stateConfigPath || !fs.existsSync(options.stateConfigPath)) {
      return { ok: false, reason: "effective Codex state config is absent" };
    }
    const state = explicitHookEnabled(options.stateConfigPath, jsonHooks[0].stateKey);
    if (!state.enabled) {
      return { ok: false, reason: `effective governed command is explicitly disabled at ${jsonHooks[0].stateKey}` };
    }
  }
  return { ok: true, reason: "one effective governed command routes through the durable launcher", command: candidates[0] };
}
