# Large review input — harness assessment, 2026-09-15

WI: WI-FW-PROMPT-INSPECTION-01. Scope: input transport and inspection compatibility,
not a model-quality ranking or completed native benchmark. Checked installed CLI
help, canonical framework source and official documentation. No paid model calls.

## Findings by harness

| Harness | Observed native interface | Current SVC general review route | Two-Box planning | Impact / qualification needed |
|---|---|---|---|---|
| Codex 0.154.0 | `exec` reads stdin with `-`; `debug prompt-input` accepts a positional prompt and has no file/stdin input option in installed help. | Exact package sent to stdin (`run-external-review.mjs:1242`, shared spawn `:738`). | Only implemented planning host; full prompt is inspected as argv, capped at 100,000 bytes. | Confirmed immediate blocker. Align native inspection with file/stdin input; preserve actual model-visible context evidence. |
| Claude Code 2.1.240 | Print mode and text/stream-json input; official docs show piped input. | Package sent to stdin; model/effort/schema/isolation flags supplied separately (`:1251`). | Unsupported by current planning tuple checks. | No matching prompt-in-argv defect found in general adapter. Test large native input and argv schema bounds; general-review compatibility does not qualify a new planning host. |
| Cursor Agent 2026.09.10-fd3934a | Print/plan modes; official docs describe piped stdin. | Declared review envelope plus package on stdin (`:1255`). | Unsupported. | Prompt transport avoids this single-argument limit. Verify complete native input and rule/context inclusion. Session identity defect is separate and remains separately tracked. |
| Grok Build 1.0.31 | Native `--prompt-file PATH`, `--verbatim` and structured output. | Writes the complete envelope/package to an artifact file and passes only its path (`:1264`). | Unsupported. | Already follows the proposed native file pattern. Test immutable file lifetime, exact bytes, resume and large schema arguments. No model-switch workaround is authorized by file support. |
| AGY / Antigravity 1.2.3 | Installed `agy --help` supports print mode and text/stream-json input. | Dispatcher writes a private mode-0600 file, passes a short instruction asking the agent to read it, and adds its directory (`dispatch-agy.mjs:189–209`). | Unsupported. | Already uses the owner's file-reference idea. This is agent-mediated access, not automatic initial-prompt ingestion. Current receipt records package hash/length, not demonstrated complete model reads; evaluate native stdin or verified read coverage for roles permitting tools. |
| Kimi Code 1.49.0 | Print mode accepts stdin text/stream-json; native help and official docs corroborate. | No branch in canonical external-review launcher. | Unsupported. | A transport option for future adapter qualification; it is not an interchangeable review route today. |
| OpenCode 1.18.21 | `run --file` attaches files; local help and official docs corroborate. | No canonical review branch. | Unsupported. | Attachment expansion, complete inclusion, instruction discovery, output schema and identity need qualification before adding an adapter. |
| Gemini CLI | Official headless docs support piping input. `gemini` was not found on this session's PATH. | No canonical review branch; AGY is a distinct supported route, not the Gemini CLI. | Unsupported. | Documented native option only; installed-runtime and adapter parity remain unverified. |
| MiMo-Code | Native CLI not found by the checked `mimocode` command; capability not established here. | No canonical review branch. | Unsupported. | Do not infer readiness from general host provisioning or OpenCode ancestry. Needs a separate capability probe if selected. |

The general launcher accepts exactly five host routes: codex, claude, cursor,
grok and agy. Nine provisioned skill/hook hosts do not imply nine implemented
review transports. Two-Box has a further explicit Codex-only restriction in
`two-box-role-launch.mjs:98` and `isolated-plan-analysis.mjs:97`.

## Measured failure and test scope

`docs/specs/evidence/framework-large-input/transport-assessment-20260915.json`
records source hashes and deterministic checks:

- General input acquisition preserved 1,235,010 bytes exactly through both a file
  and a two-chunk stream. Multibyte UTF-8 and literal shell syntax were preserved.
- A 90,269-byte Open Box prompt passed construction; 110,000 bytes of facts failed
  the shared 100,000-byte role guard before any provider call.
- `/usr/bin/true` accepted a 131,071-byte argument; 131,072 and 1,048,576 bytes
  returned E2BIG on this machine. These are local OS facts, not universal limits.
- Earlier account evidence measures a revision packet of at least 210,360 bytes,
  with its last coverage object omitted. This is a lower bound, not a new accepted
  planning output; the invalid scout citation remains invalid.

No native harness processed the 1.24 MB synthetic review in this assessment.
Input reader checks cannot establish model comprehension, context capacity,
file-read coverage, provider availability, isolation or release certification.

## Alternatives

| Option | Assessment |
|---|---|
| Raise 100 KB to 1 MB while retaining argv | Reject: reproduced E2BIG at 128 KiB on this machine. |
| Common frozen artifact plus stdin/native file ingestion | Recommended default: reuse working general-review paths, make inspection consume the same bytes, retain exact restart/hash evidence. |
| Ask the agent to read a file | Valid where file tools and read coverage are part of the role contract; AGY already uses it. Insufficient as an unverified substitute for a tool-free initial prompt. |
| Structured RPC/API request body | Valid transport when already qualified for the selected host; needs identity, authentication, context and inspection parity. An API key/provider change is not implied by fixing a CLI limit. |
| Local native-request capture provider | Diagnostic alternative already prototyped. More lifecycle/provenance/parity work; not the default repair unless simpler native interfaces cannot meet the evidence contract. |
| Split or summarize the plan to fit | Not a transport repair. Only valid through an explicit completeness-preserving planning design; silently deleting requirements/findings is unacceptable. |

## Exact operational impact

The affected path can stop before the current model call, even though the model
could accept the text. Earlier planning stages may already have run. Retrying the
same bytes, renewing a lease, changing the root assistant or choosing a different
ordinary-review model does not fix the current Codex-only inspection path.
Growing diffs, source excerpts, original plans and scout findings make recurrence
plausible across consumer repositories. Actual frequency and monetary loss are
unknown; the defect is not evidence of data corruption or a deployed product bug.

File/stdin transport removes the OS argument bottleneck but not model token,
output, quota, timeout or memory limits. Those need independent preflight and
actionable error classifications. All large argv values, including schemas and
config strings, need coverage. SVC should stop once on permanent input/capability
failures and identify the needed repair rather than driving identical retries.

## Required conformance suite before calling this fixed

For every enabled general-review adapter and every enabled planning role, verify
99 KB / 101 KB / 128 KiB boundary / 256 KB / 1 MiB inputs; UTF-8; exact frozen bytes
and declared envelopes; file/stream failure and EOF handling; immutable resume;
hash mismatch; cancellation and cleanup. Verify tool/context isolation, schema
and model identity at the transport's claimed evidence level. Test negative
fallbacks: no truncation, no unapproved host change, no offline-to-live promotion.
Run bounded native qualification after deterministic tests. Unsupported hosts
remain explicitly unsupported until their adapters are separately qualified.

## Sources and limits

- [Codex CLI reference](https://developers.openai.com/codex/cli/reference/): stdin for exec versus positional input for debug prompt inspection; installed help is the version-specific source.
- [Claude CLI reference](https://code.claude.com/docs/en/cli-usage): piped input and print mode.
- [Cursor output formats](https://docs.cursor.com/en/cli/reference/output-format): piped stdin; [context behavior](https://docs.cursor.com/en/cli/using) includes project rule discovery.
- [Grok headless and ACP](https://docs.x.ai/build/cli/headless-scripting): headless and structured stream options. Installed `grok --help` supplies the observed native prompt-file flag.
- [Kimi command reference](https://moonshotai.github.io/kimi-cli/en/reference/kimi-command.html): print/input formats; installed help explicitly names stdin.
- [OpenCode CLI](https://opencode.ai/docs/cli/): run/file attachment interface.
- [Gemini headless reference](https://geminicli.com/docs/cli/headless/): documented piped input; no installed native qualification in this session.
- [curl file/stdin input](https://curl.se/docs/manpage.html#--data-binary): a primary example of loading file contents into a request body without putting them in argv.

Raw installed help excerpts/version evidence are saved alongside the deterministic
JSON. Canonical source references are bound by SHA-256 there; future source or CLI
updates invalidate assumptions and require rechecking affected cases.
