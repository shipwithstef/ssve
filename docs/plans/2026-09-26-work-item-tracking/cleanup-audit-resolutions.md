# Prior cleanup audit dispositions

Actual independent review: Cursor `claude-opus-5-5-high`, execution review of main commit `130db2bff74229348b1cf6db7892615ec9ca239d`, full commit diff and installed wiring. Evidence: `.svc/external-review-artifacts/wi570-plan/cleanup-audit/opus-r3/{findings,receipt}.json`. Reviewer verdict FAIL; these dispositions are not claims of completion.

| Finding | Decision and proof needed |
|---|---|
| F-001 permission grants | Reject proposed preservation of hook allow grants. The owner explicitly retains native host permissions. A hook execution trust prompt is distinct from permissionDecision; retaining allow cannot establish native trust. Removed input rewrites must never retain grants issued for a different operation. |
| F-002 environment precedence | Reject: owner AGENTS explicitly selects environment, then owner file, then advisory. Hooks are workflow guidance, not the native security boundary. |
| F-003 stale enforcement claims | Accept documentation correction. Standalone chain checks remain strict; hook wrapping follows hook mode. Do not introduce a hidden exception restoring blocking behavior. |
| F-004 stale direct managed hooks | Accept. Exact ownership must precede identity matching; remove obsolete managed hooks, preserve foreign lookalikes, and prove second wiring is byte stable. |
| F-005 Gemini timeout units | Accept. Seconds enter shared wrapper; Gemini receives milliseconds. Assert exact emitted timeout. |
| F-006 detached process lifecycle | Accept. Host deadline must exceed inner deadline; boundary termination must clean up its own child process group. Validate with a real process fixture. |
| F-007 command parsing at wiring | Accept bounded validation of generated managed commands before installation; malformed generated commands must not become repeatedly failing runtime hooks. |
| F-008 misleading advisory text | Accept. Findings must explicitly describe continuation and retain useful independent diagnostics. Remove false recovery claims when proposed replacement was discarded; quiet routine heartbeat no-ops. |
| F-009 Cursor read-only payload | Investigate with an authentic payload fixture. Do not authorize ambiguous mutation through a guessed cwd. Read-only commands should be classified without requiring mutation authority. |
| F-010 hypothetical future version migration | Defer until a real migration exists. Broadly trusting numeric directories would weaken exact ownership; current version and supported legacy layouts must remain tested. |
| F-011 changing Node executable | Require byte stability for unchanged setup. An actual runtime/command change may legitimately need new native trust. Do not forge host approval or pin an unavailable runtime. |
| F-012 stale lifecycle state | Accept factual documentation and state reconciliation using hosted main and install evidence. Missing formal phase receipts remain disclosed; never mark them complete from a merge alone. |
| F-013 malformed owner policy | Retain documented advisory fallback with actionable warning. Restoring fail-closed default contradicts owner request. |
| F-014 unbounded stdin | Investigate as part of process deadline repair; deadline must cover boundary lifetime, not only child execution. |
| F-015 host context fields | Verify actual supported host protocol before changing emitted context fields. No new interoperability claim without proof. |

Implementation owners: hook worker owns runtime/wiring repairs; controller owns documentation, final integration, installed-state proof and review disposition. Focused regressions first, one integrated free suite before release, then hosted checks and all-host drift verification.
