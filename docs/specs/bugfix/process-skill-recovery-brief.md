# Process-task skill recovery

WI: WI-FW-PROCESS-SKILL-01. Continues the owner-authorized hook recovery fix from PR 47.

Reproduction: the active account completion task 4 declares `process_skill: execute-changeset`, has a matching graph receipt, and has no top-level `skill`. The Codex enforcer renders `--skill undefined`; the loader rejects the correct explicit process skill; automatic recovery also cannot select the declared skill. The repaired transcript/index already agree.

Correction: treat a nonempty explicit process_skill as the fallback skill declaration in the loader, skill enforcer and recovery preparation. Preserve lane-skill precedence. The standalone task graph CLI accepts the same declaration for loading/activation without treating process tasks as new mandatory lane tasks. Missing declarations get an actionable diagnostic, never an undefined loader command. No inference from subject text or generic implementation phase.

Validation: reproduce the original account graph shape; pending activation and active reload; exact returned loader command; valid receipt admits an owned mutation; wrong skill/unknown declaration/foreign ownership still deny; reload preserves graph and receipt bytes. Run focused first-task, recovery and read-only tests, then installed-hook verification. No new general discovery or paid review; retain the owner's existing spending constraint.

Scope excludes product code, task dependencies, parent-task status, historical transcript repair and global review redesign. Main storage/agent data is unaffected.

Risk: selecting the wrong skill can widen task scope. Explicit declarations only, existing precedence and all authority checks remain. Local tests cover both allow and deny behavior. Existing pipeline tests cover ordinary lane graphs and standalone task-graph operation. UI-facing recovery command must be runnable. Installer drift checks must cover all nine hosts.
