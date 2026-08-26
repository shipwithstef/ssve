import path from "node:path";
import { lexSimpleCommand } from "./argv-lex.mjs";
import { WI_ID_BODY } from "../../lib/wi-id.mjs";
// WI-FW-HOOKS-SAFETY-01 (FP-01): Git-valid slash branches are accepted as
// literal refs; filesystem-path safety is enforced separately by the worktree
// identity layer, never by a branch-name regex here.
import { validateLiteralBranchName } from "../../lib/literal-branch.mjs";

const WI = new RegExp(`^${WI_ID_BODY}$`);

// Canonical parser shared by Codex routing, isolation, and bootstrap consume.
export function parseBootstrapCommand(command, { ensurePath = "scripts/svc-ensure-worktree.mjs" } = {}) {
  const lexed = lexSimpleCommand(String(command || ""));
  const tokens = lexed?.ok ? lexed.argv : null;
  if (!tokens || tokens.length < 6 || tokens[0] !== "node") return null;
  const script = path.normalize(tokens[1] || "");
  if (script !== ensurePath && !script.endsWith(`/scripts/svc-ensure-worktree.mjs`)) return null;
  const out = { script, wi: "", branch: "", from: "origin/main", json: false, print_cd: false, handoff: "" };
  for (let i = 2; i < tokens.length; i += 1) {
    const flag = tokens[i];
    if (flag === "--wi" || flag === "--branch" || flag === "--from" || flag === "--handoff") {
      const value = tokens[++i];
      if (!value) return null;
      if (flag === "--wi") out.wi = value;
      else if (flag === "--branch") out.branch = value;
      else if (flag === "--from") out.from = value;
      else out.handoff = value;
      continue;
    }
    if (flag === "--json") { out.json = true; continue; }
    if (flag === "--print-cd") { out.print_cd = true; continue; }
    if (flag === "--authority-v2") { out.authority_v2 = true; continue; }
    return null;
  }
  if (!WI.test(out.wi) || !validateLiteralBranchName(out.branch).ok) return null;
  if (out.from !== "origin/main" && !/^[0-9a-f]{40}$/.test(out.from)) return null;
  if (out.handoff && !/^[A-Za-z0-9_-]{32,128}$/.test(out.handoff)) return null;
  return out;
}

export function canonicalBootstrapShape(command, options = {}) {
  return Boolean(parseBootstrapCommand(command, options));
}
