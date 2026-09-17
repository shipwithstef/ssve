#!/usr/bin/env node
/**
 * Host-dependent native 1MiB planning-request qualification. No paid inference.
 * Not part of the hermetic tier-1 suite. Writes retained evidence on success.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as isolation from "./lib/isolated-plan-analysis.mjs";
import * as capture from "./lib/native-planning-request-capture.mjs";
import * as protocol from "./lib/two-box-protocol.mjs";
import { getObject } from "./lib/review-evidence-store.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EVIDENCE = path.join(ROOT, "docs/specs/evidence/framework-large-input/native-1mib-inspect.json");

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

export async function qualifyNative1MiB({ writeEvidence = false } = {}) {
  const resolved = spawnSync("sh", ["-c", "command -v codex"], { encoding: "utf8" });
  if (resolved.status !== 0 || !resolved.stdout.trim()) {
    fail("installed Codex required for native 1MiB no-inference qualification");
  }
  const binary = resolved.stdout.trim();
  const help = spawnSync(binary, ["debug", "prompt-input", "--help"], { encoding: "utf8" });
  const q = capture.qualifyInspectHelp(`${help.stdout}\n${help.stderr}`);
  if (q.native_complete_input !== false) fail("installed debug prompt-input now advertises native complete input");
  const marker = "UTF8-café-1MiB";
  const prompt = `${"x".repeat(1048576 - Buffer.byteLength(marker))}${marker}`;
  if (Buffer.byteLength(prompt) !== 1048576) fail("prompt must be exactly 1MiB");
  const tuple = { host: "codex", family: "openai", model: "gpt-5.6-sol", effort: "high" };
  const result = isolation.assertEffectiveIsolation({
    role: "open_box",
    tuple,
    prompt,
    schema: protocol.outputSchemaForCall("open_box"),
    consumerRoot: ROOT,
    mode: "inspect",
  });
  try {
    isolation.assertIsolationAuthority(result.proof, {
      fixture: false,
      requested: tuple,
      schema: protocol.outputSchemaForCall("open_box"),
      inspectMessages: JSON.parse(getObject(result.proof.native_prompt.sha256, { start: ROOT }).bytes.toString("utf8")),
    });
    const evidence = {
      recorded_at: new Date().toISOString(),
      evidence_class: "native_no_inference_1mib",
      inference_calls: 0,
      binary: result.proof.binary,
      frozen_request: result.proof.frozen_request,
      inspection_authority: result.proof.inspection_authority,
      capture_inference: result.proof.capture_inference,
      usable_live: result.proof.effective.usable_live,
      token_budget: {
        checked: result.proof.token_budget.checked,
        fits: result.proof.token_budget.fits,
        estimated_tokens: result.proof.token_budget.estimated_tokens,
        estimate_kind: result.proof.token_budget.estimate_kind,
        enforcement: result.proof.token_budget.enforcement,
        envelope_bytes: result.proof.token_budget.envelope_bytes,
        contextWindow: result.proof.token_budget.contextWindow,
        outputReserveTokens: result.proof.token_budget.outputReserveTokens,
      },
      prompt_sha256: result.proof.prompt_sha256,
      exact_prompt_count: result.proof.diagnosis.exact_prompt_count,
    };
    if (writeEvidence) {
      fs.mkdirSync(path.dirname(EVIDENCE), { recursive: true });
      fs.writeFileSync(EVIDENCE, `${JSON.stringify(evidence, null, 2)}\n`);
    }
    return evidence;
  } finally {
    result.cleanup();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  qualifyNative1MiB({ writeEvidence: true }).then((evidence) => {
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  }).catch((error) => {
    fail(error.message);
  });
}
