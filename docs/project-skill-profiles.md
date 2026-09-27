# Project skill profiles

The installed SSVE library remains available to every host. A project profile selects a small working set from the current project and task, using the existing deterministic skill router. Selection reads local project signals, the active/next skill, explicit skill requests, and optional `.svc/project-preferences.json` fields `skills.include` and `skills.exclude`. An explicit request or required router pin remains accessible even when excluded by a preference. The profile does not change global skill files, native permissions, model choice, or other project preferences.

```bash
node scripts/skill-profile.mjs select --project "$PWD" --intent "fix framework routing bug" --host grok
node scripts/skill-router.mjs route --root /path/to/ssve --project-root "$PWD" --intent "fix framework routing bug" --no-receipts
node scripts/skill-profile.mjs load --project "$PWD" --skill research
node scripts/skill-profile.mjs usage --project "$PWD"
```

`select` gives canonical paths, reasons, and first-party catalog counts so the exposure reduction is measurable without claiming token savings. `load` reads a requested skill body only when needed. The router's `--project-root` filters optional suggestions against the profile while leaving required pins intact. A UI task can select `design-ux`, `design-ui`, and same-job comparison tools; a framework bug task leaves out marketing and unrelated environment skills. An unlisted skill can still be explicitly requested by name. Preferences are project-local. Missing or invalid preference files, including symlinks and files over 16 KiB, fall back to the default profile with a diagnostic. Unknown names in a preference section likewise leave the skills preferences unapplied; only `--explicit-skill` treats an unknown name as an error:

```json
{"skills":{"include":["research"],"exclude":["analyze-marketing"]}}
```

For Codex, `launch-codex` computes per-process `-c skills.config=[...]` exclusions **only** for installed paths proven to point to the SSVE source. It passes through native arguments after `--` unchanged. `codex-args` previews the generated arguments. The wrapper refuses existing native skill configuration (including inline TOML), a selected Codex profile (which might contain skill settings), or a conflicting project directory, because replacing user choices would be unsafe. It leaves foreign and system skills untouched. This can reduce the SSVE entries in Codex's native prompt/discovery surface for that process. Start Codex through the wrapper when strict SSVE catalog filtering is wanted:

```bash
node scripts/skill-profile.mjs codex-args --project "$PWD" --intent "fix button" -- --model your-model
node scripts/skill-profile.mjs launch-codex --project "$PWD" --intent "fix button" -- --model your-model
```

Grok Build CLI currently has no verified project-scoped skill ignore setting; its documented `[skills].ignore` is user-level, and `GROK_CONFIG` does not carry the skills table. A Grok profile is routing guidance, not a native catalog filter. Claude supports project `skillOverrides`; this helper only reports that capability and does not alter Claude settings. Cursor similarly receives guidance without a verified native per-project hide operation. Deferred MCP tool search does not hide skill metadata.

`usage` counts observed graph tasks and router decisions by skill and lists frequently suggested skills with no recorded completed graph task for manual inspection. It never auto-disables a skill. It is a local coverage/usage signal, not a measure of skill quality, token savings, or host invocations that were not recorded. No prompt text or personal data is uploaded by these commands.

Host references: [Codex skills](https://learn.chatgpt.com/docs/build-skills), [Claude skills](https://code.claude.com/docs/en/skills), [Claude output styles](https://code.claude.com/docs/en/output-styles), [Cursor skills](https://prod.cursor.com/docs/skills), [Grok skills](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-pager/docs/user-guide/08-skills.md), [Grok configuration](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-pager/docs/user-guide/05-configuration.md).
