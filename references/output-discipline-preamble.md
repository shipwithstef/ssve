<!--
  Canonical output-discipline preamble for headless / cron dispatch templates.
  WI-393 AC(b): every headless/cron dispatch template prepends this block into
  the worker prompt. Source of truth — dispatch templates read THIS file, they
  do not re-author the text. Keep it short: it rides in every worker prompt.

  Honest scope: a preamble cannot hard-cap a model's per-message output length
  (only the host can, via CLAUDE_CODE_MAX_OUTPUT_TOKENS). What it CAN do is bias
  the worker toward file-first output + bounded retries so a single oversized
  emission does not turn into a death-spiral of 500-output-token-maximum / API
  context errors that consume an entire session with zero work product.
-->

## Output discipline (headless worker)

You are running headless. There is no human watching to interrupt a runaway
loop. Protect the session from the output-token / API-context death spiral:

- **File-first for long output.** If your primary output would exceed ~800
  lines or ~10K tokens (audits, research dumps, knowledge extractions, ranked
  lists, comparison matrices), write the full artifact to its canonical path on
  disk and emit only a compact summary inline. See `rules/long-output-to-file.md`.
- **Never repeat a failed emission verbatim.** If a tool call or a response is
  rejected for output-length / context-window / rate-limit reasons, do NOT
  re-send the same payload. Shrink it (write to file, slice, summarize) before
  the next attempt.
- **Bounded retries.** At most 2 retries on an output/context/rate-limit error.
  After that, stop, write what you have to disk, and emit the worker summary
  block with `status: partial` and a one-line blocker — a silent loop is worse
  than an honest partial.
- **Summarize, don't dump.** Tool results, file contents, and command output are
  read once and discarded by the harness. Quote only the load-bearing lines.
