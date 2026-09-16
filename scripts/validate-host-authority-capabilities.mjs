#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOSTS = ["antigravity", "claude", "codex", "cursor", "gemini", "grok", "kimi", "mimo-code", "opencode"];

function parse(argv) { const index = argv.indexOf("--root"); return index >= 0 ? path.resolve(argv[index + 1]) : process.cwd(); }

const CODEX_ISOLATION_ARGV_FLAGS = ["--ephemeral", "--ignore-user-config", "--skip-git-repo-check", "--json", "--output-schema"];
const CODEX_FEATURE_OFF = ["shell_tool", "unified_exec", "multi_agent", "multi_agent_v2", "plugins", "apps", "view_image", "browser_use", "computer_use", "memories", "remote_plugin", "workspace_dependencies", "skill_search", "image_generation", "hooks", "code_mode", "code_mode_host", "tool_suggest"];
const CODEX_FORBIDDEN_SUBSTITUTES = ["--read-only", "--ignore-rules", "landlock", "fresh_session_launch"];
const CODEX_SKILL_SCOPES = ["global", "system", "plugin"];

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function argvIncludesFlag(argv, flag) {
  return Array.isArray(argv) && argv.includes(flag);
}

function argvHasSandboxReadOnly(argv) {
  if (!Array.isArray(argv)) return false;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--sandbox" && argv[index + 1] === "read-only") return true;
  }
  return false;
}

function validateIsolatedPlanAnalysis(host, value) {
  const errors = [];
  if (!isPlainObject(value)) {
    errors.push(`${host}: authority_capabilities.isolated_plan_analysis must be an object`);
    return errors;
  }
  if (typeof value.enabled !== "boolean") errors.push(`${host}: isolated_plan_analysis.enabled must be boolean`);
  if (value.grants_runtime_isolation !== false) {
    errors.push(`${host}: isolated_plan_analysis.grants_runtime_isolation must be false because availability never grants runtime isolation`);
  }
  if (value.availability_only !== true) {
    errors.push(`${host}: isolated_plan_analysis.availability_only must be true`);
  }
  if (value.enabled === true && host !== "codex") {
    errors.push(`${host}: isolated_plan_analysis.enabled=true is only allowed for the proven Codex adapter`);
  }
  if (host === "codex") {
    if (value.enabled !== true) errors.push("codex: isolated_plan_analysis.enabled must be true for the available Codex adapter (availability only)");
    if (value.adapter !== "codex-exec") errors.push("codex: isolated_plan_analysis.adapter must be codex-exec");
    if (value.transport !== "frozen-payload") errors.push("codex: isolated_plan_analysis.transport must be frozen-payload");
    if (value.tool_free !== true) errors.push("codex: isolated_plan_analysis.tool_free must be true");
    if (value.model_flag !== "-m") errors.push("codex: isolated_plan_analysis.model_flag must be -m");
    if (value.effort_flag !== "-c") errors.push("codex: isolated_plan_analysis.effort_flag must be -c");
    if (value.effort_config_key !== "model_reasoning_effort") errors.push("codex: isolated_plan_analysis.effort_config_key must be model_reasoning_effort");
    if (value.stdin_prompt !== true) errors.push("codex: isolated_plan_analysis.stdin_prompt must be true");
    if (value.no_resume_or_fork !== true) errors.push("codex: isolated_plan_analysis.no_resume_or_fork must be true");
    const argv = value.exec_argv;
    if (!Array.isArray(argv) || argv.some((item) => typeof item !== "string") || argv.length < 7) {
      errors.push("codex: isolated_plan_analysis.exec_argv must be a string argv array declaring Codex exec flags and the sandbox mode value");
    } else {
      for (const flag of CODEX_ISOLATION_ARGV_FLAGS) {
        if (!argvIncludesFlag(argv, flag)) errors.push(`codex: isolated_plan_analysis.exec_argv must include ${flag}`);
      }
      if (!argvHasSandboxReadOnly(argv)) errors.push("codex: isolated_plan_analysis.exec_argv must include --sandbox read-only as adjacent tokens");
      if (argvIncludesFlag(argv, "--read-only")) errors.push("codex: isolated_plan_analysis.exec_argv must not use unsupported --read-only as isolation");
      if (argvIncludesFlag(argv, "--ignore-rules")) errors.push("codex: isolated_plan_analysis.exec_argv must not use --ignore-rules as instruction isolation");
    }
    const forbidden = value.forbidden_isolation_substitutes;
    if (!Array.isArray(forbidden) || !CODEX_FORBIDDEN_SUBSTITUTES.every((item) => forbidden.includes(item))) {
      errors.push("codex: forbidden_isolation_substitutes must declare --read-only, --ignore-rules, landlock, and fresh_session_launch");
    }
    const overrides = value.invocation_overrides;
    if (!isPlainObject(overrides)) {
      errors.push("codex: isolated_plan_analysis.invocation_overrides must be an object of invocation-scoped controls");
    } else {
      if (overrides.project_doc_max_bytes !== 0) errors.push("codex: invocation_overrides.project_doc_max_bytes must be 0");
      if (overrides.web_search !== "disabled") errors.push("codex: invocation_overrides.web_search must be disabled");
      if (overrides.developer_instructions !== "") errors.push("codex: invocation_overrides.developer_instructions must be an empty string");
      const features = overrides.features;
      if (!isPlainObject(features)) {
        errors.push("codex: invocation_overrides.features must be an object of boolean feature flags");
      } else {
        if (features.skip_host_skill_discovery !== true) errors.push("codex: features.skip_host_skill_discovery must be true");
        for (const name of CODEX_FEATURE_OFF) {
          if (features[name] !== false) errors.push(`codex: invocation_overrides.features.${name} must be false`);
        }
      }
      const skillsConfig = overrides.skills_config;
      if (!isPlainObject(skillsConfig) || skillsConfig.disable_discovered !== true || skillsConfig.mutate_skill_files !== false) {
        errors.push("codex: invocation_overrides.skills_config must disable discovered global/system/plugin skills without mutating skill files");
      } else if (!Array.isArray(skillsConfig.scope) || !CODEX_SKILL_SCOPES.every((item) => skillsConfig.scope.includes(item))) {
        errors.push("codex: invocation_overrides.skills_config.scope must include global, system, and plugin");
      }
    }
    const inspection = value.prompt_inspection;
    if (!isPlainObject(inspection) || inspection.required !== true) {
      errors.push("codex: isolated_plan_analysis.prompt_inspection must be an object with required true");
    } else {
      if (inspection.command !== "codex debug prompt-input") errors.push("codex: prompt_inspection.command must be codex debug prompt-input");
      if (inspection.scope !== "invocation") errors.push("codex: prompt_inspection.scope must be invocation");
      if (inspection.builder !== "same_as_live_launch") errors.push("codex: prompt_inspection.builder must be same_as_live_launch");
      const large = inspection.large_request;
      if (!isPlainObject(large)) {
        errors.push("codex: prompt_inspection.large_request must declare planning byte and inspect transports");
      } else {
        if (large.planning_max_bytes !== 1048576) errors.push("codex: prompt_inspection.large_request.planning_max_bytes must be 1048576");
        if (large.native_inspect !== "positional_prompt_input") errors.push("codex: prompt_inspection.large_request.native_inspect must be positional_prompt_input until help advertises file/stdin");
        if (large.native_inspect_complete_input !== false) errors.push("codex: prompt_inspection.large_request.native_inspect_complete_input must be false for installed prompt-input");
        if (large.oversized_prompt_transport !== "native_request_capture") errors.push("codex: prompt_inspection.large_request.oversized_prompt_transport must be native_request_capture");
        if (large.capture_is_live_authority !== false) errors.push("codex: prompt_inspection.large_request.capture_is_live_authority must be false");
        if (large.qualified_inspect_authorizes_live_stdin !== true) errors.push("codex: prompt_inspection.large_request.qualified_inspect_authorizes_live_stdin must be true");
        if (large.token_budget_separate_from_bytes !== true) errors.push("codex: prompt_inspection.large_request.token_budget_separate_from_bytes must be true");
        if (large.inference_uses_stdin !== true) errors.push("codex: prompt_inspection.large_request.inference_uses_stdin must be true");
      }
    }
    const canary = value.live_canary;
    if (!isPlainObject(canary) || canary.required !== true) {
      errors.push("codex: isolated_plan_analysis.live_canary must be an object with required true");
    } else {
      if (canary.tool_events !== "abort_on_any") errors.push("codex: live_canary.tool_events must be abort_on_any");
      if (canary.offline_never_unlocks_live !== true) errors.push("codex: live_canary.offline_never_unlocks_live must be true");
    }
  } else if (value.enabled === false) {
    if (typeof value.reason !== "string" || value.reason.trim().length < 60) {
      errors.push(`${host}: isolated_plan_analysis.enabled=false requires a concrete reason (pending equivalent adapter proof)`);
    } else if (!/adapter/i.test(value.reason)) {
      errors.push(`${host}: isolated_plan_analysis.reason must name the missing equivalent adapter proof`);
    }
  }
  return errors;
}

export function validateHostCapabilities(root) {
  const errors = [];
  for (const host of HOSTS) {
    const file = path.join(root, "provision", "hosts", `${host}.json`);
    let manifest;
    try { manifest = JSON.parse(fs.readFileSync(file, "utf8")); } catch (error) { errors.push(`${host}: ${error.message}`); continue; }
    const value = manifest.authority_capabilities;
    if (!value || typeof value !== "object") { errors.push(`${host}: missing authority_capabilities`); continue; }
    for (const field of ["stable_session_identity", "stable_child_identity", "mutating_child_execution"]) if (typeof value[field] !== "boolean") errors.push(`${host}: ${field} must be boolean`);
    if (!['sandbox', 'wrapper', 'none'].includes(value.filesystem_containment)) errors.push(`${host}: invalid filesystem_containment`);
    if (value.mutating_child_execution && (!value.stable_session_identity || !value.stable_child_identity || value.filesystem_containment === "none")) errors.push(`${host}: child mutation lacks identity or containment`);
    if (value.filesystem_containment === "wrapper" && value.containment_launcher !== "scripts/svc-contained-exec.mjs") errors.push(`${host}: wrapper launcher is not canonical`);
    if (!manifest.wiring?.hook_capable && value.mutating_child_execution) errors.push(`${host}: non-hook-capable host cannot enable delegated mutation`);
    errors.push(...validateIsolatedPlanAnalysis(host, value.isolated_plan_analysis));
  }
  return errors;
}

export function run(argv = process.argv.slice(2)) {
  const root = parse(argv); const errors = validateHostCapabilities(root);
  if (errors.length) { for (const error of errors) process.stderr.write(`[host-authority] ${error}\n`); return 1; }
  process.stdout.write(`HOST AUTHORITY PASS: ${HOSTS.length} manifests declare identity and containment support\n`); return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = run();
