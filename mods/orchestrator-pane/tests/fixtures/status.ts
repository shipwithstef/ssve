// Same sanitized fixture as status.json; no credentials or live bindings.
export const recorded = {
  "schema_version": 1,
  "revision": 22,
  "generated_at": "2026-10-03T12:04:18.321Z",
  "collector_heartbeat_at": "2026-10-03T12:04:18.321Z",
  "tasks": [
    {
      "id": "d1a",
      "title": "D1a Problem Scout UX",
      "goal_id": "novisenti",
      "lane": "M1",
      "description": "Read-only observation of an externally launched worker",
      "state": "done (unverified exit)",
      "attempt_id": "adopt-d1a",
      "adopted": true,
      "session_id": "recorded-session-d1a",
      "executor": {
        "cli": "cursor",
        "model": "grok-4.7-medium",
        "effort": "medium",
        "cli_version": null
      },
      "elapsed_ms": 1668299,
      "estimate_ms": {
        "low": 3600000,
        "high": 3600000,
        "basis": "owner_estimate"
      },
      "events_last_3": [
        "tool completed: shellToolCall",
        "reported: Problem Scout now defaults to Problem mode and 3 results, and a selected-programme request is sent only after the programme, version, and constraints are visible.\n\nThe form stays on the existing Gener",
        "result done (reported)"
      ],
      "blockers": [
        {
          "code": "unknown_exit",
          "description": "No matching live process or durable exit code; outcome unverified"
        }
      ],
      "depends_on": [],
      "acceptance": [],
      "log_path": "/recorded/logs/d1a.jsonl",
      "completion_report_ref": "/recorded/d1a-report.md",
      "verification_state": "unverified"
    },
    {
      "id": "p1b",
      "title": "p1b",
      "goal_id": "novisenti",
      "lane": "M1",
      "description": "Read-only observation of an externally launched worker",
      "state": "done (unverified exit)",
      "attempt_id": "adopt-p1b",
      "adopted": true,
      "session_id": "recorded-session-p1b",
      "executor": {
        "cli": "cursor",
        "model": "Grok 4.7 256K Medium",
        "effort": "medium",
        "cli_version": null
      },
      "elapsed_ms": 2465868,
      "estimate_ms": {
        "low": null,
        "high": null,
        "basis": "unknown"
      },
      "events_last_3": [
        "system",
        "reported: P1b is a local diagnosis only. The 2 October exception origin stays unverified. Current code already stops an undispatched fatal research tail, so `providers.ts` is unchanged.\n\nCommit `7b1e8f8` on `te",
        "result done (reported)"
      ],
      "blockers": [
        {
          "code": "unknown_exit",
          "description": "No matching live process or durable exit code; outcome unverified"
        }
      ],
      "depends_on": [],
      "acceptance": [],
      "log_path": "/recorded/logs/p1b.jsonl",
      "completion_report_ref": "/recorded/p1b-report.md",
      "verification_state": "unverified"
    },
    {
      "id": "p1c-r",
      "title": "P1c-r tiered model pin (Astra only for analysis)",
      "goal_id": "novisenti",
      "lane": "R",
      "description": "P1c-r tiered model pin (Astra only for analysis)",
      "state": "running",
      "attempt_id": "588eb872-de4b-4b1a-9c2f-ed3b27909d58",
      "adopted": false,
      "session_id": "recorded-session-p1c-r",
      "executor": {
        "cli": "codex",
        "model": "gpt-6.1-sol",
        "effort": "high",
        "cli_version": "codex-cli 0.160.0",
        "requested_model": "gpt-6.1-sol",
        "resolved_model": "gpt-6.1-sol"
      },
      "elapsed_ms": 943505,
      "estimate_ms": {
        "low": 5400000,
        "high": 5400000,
        "basis": "owner_estimate"
      },
      "events_last_3": [
        "command started: /bin/bash -lc 'flock /home/dianast/.local/state/novisenti/focused-backend-test.lock systemd-run --user --unit=novisenti-p1cr-server-tests-final --wait --pipe --",
        "command started: /bin/bash -lc 'git diff -- server/analysis/providers.ts | head -230; git diff --check'",
        "command exited 0: /bin/bash -lc 'git diff -- server/analysis/providers.ts | head -230; git diff --check'"
      ],
      "blockers": [],
      "depends_on": [],
      "acceptance": [],
      "log_path": "/recorded/logs/p1c-r.jsonl",
      "completion_report_ref": null,
      "verification_state": "unverified"
    }
  ],
  "goals": [
    {
      "id": "novisenti",
      "title": "novisenti",
      "lanes": [
        {
          "id": "M1",
          "title": "M1",
          "tasks": [
            {
              "id": "d1a",
              "title": "D1a Problem Scout UX",
              "goal_id": "novisenti",
              "lane": "M1",
              "description": "Read-only observation of an externally launched worker",
              "state": "done (unverified exit)",
              "attempt_id": "adopt-d1a",
              "adopted": true,
              "session_id": "recorded-session-d1a",
              "executor": {
                "cli": "cursor",
                "model": "grok-4.7-medium",
                "effort": "medium",
                "cli_version": null
              },
              "elapsed_ms": 1668299,
              "estimate_ms": {
                "low": 3600000,
                "high": 3600000,
                "basis": "owner_estimate"
              },
              "events_last_3": [
                "tool completed: shellToolCall",
                "reported: Problem Scout now defaults to Problem mode and 3 results, and a selected-programme request is sent only after the programme, version, and constraints are visible.\n\nThe form stays on the existing Gener",
                "result done (reported)"
              ],
              "blockers": [
                {
                  "code": "unknown_exit",
                  "description": "No matching live process or durable exit code; outcome unverified"
                }
              ],
              "depends_on": [],
              "acceptance": [],
              "log_path": "/recorded/logs/d1a.jsonl",
              "completion_report_ref": "/recorded/d1a-report.md",
              "verification_state": "unverified"
            },
            {
              "id": "p1b",
              "title": "p1b",
              "goal_id": "novisenti",
              "lane": "M1",
              "description": "Read-only observation of an externally launched worker",
              "state": "done (unverified exit)",
              "attempt_id": "adopt-p1b",
              "adopted": true,
              "session_id": "recorded-session-p1b",
              "executor": {
                "cli": "cursor",
                "model": "Grok 4.7 256K Medium",
                "effort": "medium",
                "cli_version": null
              },
              "elapsed_ms": 2465868,
              "estimate_ms": {
                "low": null,
                "high": null,
                "basis": "unknown"
              },
              "events_last_3": [
                "system",
                "reported: P1b is a local diagnosis only. The 2 October exception origin stays unverified. Current code already stops an undispatched fatal research tail, so `providers.ts` is unchanged.\n\nCommit `7b1e8f8` on `te",
                "result done (reported)"
              ],
              "blockers": [
                {
                  "code": "unknown_exit",
                  "description": "No matching live process or durable exit code; outcome unverified"
                }
              ],
              "depends_on": [],
              "acceptance": [],
              "log_path": "/recorded/logs/p1b.jsonl",
              "completion_report_ref": "/recorded/p1b-report.md",
              "verification_state": "unverified"
            }
          ]
        },
        {
          "id": "R",
          "title": "R",
          "tasks": [
            {
              "id": "p1c-r",
              "title": "P1c-r tiered model pin (Astra only for analysis)",
              "goal_id": "novisenti",
              "lane": "R",
              "description": "P1c-r tiered model pin (Astra only for analysis)",
              "state": "running",
              "attempt_id": "588eb872-de4b-4b1a-9c2f-ed3b27909d58",
              "adopted": false,
              "session_id": "recorded-session-p1c-r",
              "executor": {
                "cli": "codex",
                "model": "gpt-6.1-sol",
                "effort": "high",
                "cli_version": "codex-cli 0.160.0",
                "requested_model": "gpt-6.1-sol",
                "resolved_model": "gpt-6.1-sol"
              },
              "elapsed_ms": 943505,
              "estimate_ms": {
                "low": 5400000,
                "high": 5400000,
                "basis": "owner_estimate"
              },
              "events_last_3": [
                "command started: /bin/bash -lc 'flock /home/dianast/.local/state/novisenti/focused-backend-test.lock systemd-run --user --unit=novisenti-p1cr-server-tests-final --wait --pipe --",
                "command started: /bin/bash -lc 'git diff -- server/analysis/providers.ts | head -230; git diff --check'",
                "command exited 0: /bin/bash -lc 'git diff -- server/analysis/providers.ts | head -230; git diff --check'"
              ],
              "blockers": [],
              "depends_on": [],
              "acceptance": [],
              "log_path": "/recorded/logs/p1c-r.jsonl",
              "completion_report_ref": null,
              "verification_state": "unverified"
            }
          ]
        }
      ],
      "priority": 2,
      "desired_state": "active",
      "observed_state": "needs_owner",
      "child": {
        "session_id": "child-exact",
        "generation": 2,
        "effort": "low",
        "state": "needs_owner",
        "health": "native_ownership_unverified"
      },
      "budget": {
        "mode": "counts-v1",
        "claude_turn_cap": 8,
        "worker_caps": {
          "codex": {
            "runs": 4
          },
          "cursor": {
            "runs": null
          },
          "agy": {
            "runs": 0
          }
        }
      },
      "usage": {
        "claude": {
          "turns": 2
        },
        "workers": {
          "codex": {
            "attempts": 1
          },
          "cursor": {
            "attempts": 2
          },
          "agy": {
            "attempts": 0
          }
        }
      },
      "reserved": {
        "claude_turns": null,
        "worker_runs": {
          "codex": 1,
          "cursor": 0,
          "agy": 0
        }
      },
      "remaining": {
        "claude_turns": 6,
        "worker_runs": {
          "codex": 3,
          "cursor": null,
          "agy": 0
        }
      },
      "blockers": [
        {
          "code": "needs_owner",
          "description": "Reconcile native restart ownership"
        },
        {
          "code": "attention_pending",
          "description": "Monitor expired; restore explicitly"
        }
      ]
    },
    {
      "id": "empty",
      "title": "Empty goal",
      "priority": 1,
      "desired_state": "paused",
      "observed_state": "paused",
      "child": {
        "session_id": null,
        "generation": 1,
        "effort": "low",
        "state": "needs_owner",
        "health": "unobserved"
      },
      "lanes": [],
      "blockers": [
        {
          "code": "needs_owner",
          "description": "Child unbound; budget unknown"
        }
      ]
    }
  ],
  "warnings": [],
  "registry_revision": 6,
  "orchestrators": [
    {
      "role": "parent",
      "goal_id": "novisenti",
      "session_id": "parent-exact",
      "generation": 2,
      "registry_revision": 6,
      "state": "needs_owner",
      "effort": "low",
      "auto_start": false,
      "cwd": "/recorded/planning",
      "attach_command": "cd '/recorded/planning' && 'env' 'ORCH_STATE_DIR=/recorded/state' 'node' '/recorded/scripts/orch/sessions.mjs' 'attach' '--role' 'parent' '--session-id' 'parent-exact' '--generation' '2'",
      "resume_command": "cd '/recorded/planning' && 'env' 'ORCH_STATE_DIR=/recorded/state' 'node' '/recorded/scripts/orch/sessions.mjs' 'resume' '--role' 'parent' '--session-id' 'parent-exact' '--generation' '2' '--native-stopped' 'true' '--live-verified' 'true'",
      "reason": "Owner must verify native stopped and LOW; parent first"
    },
    {
      "role": "child",
      "goal_id": "novisenti",
      "session_id": "child-exact",
      "generation": 2,
      "registry_revision": 6,
      "state": "needs_owner",
      "effort": "low",
      "auto_start": false,
      "cwd": "/recorded/planning",
      "attach_command": "cd '/recorded/planning' && 'env' 'ORCH_STATE_DIR=/recorded/state' 'node' '/recorded/scripts/orch/sessions.mjs' 'attach' '--role' 'child' '--session-id' 'child-exact' '--generation' '2'",
      "resume_command": "cd '/recorded/planning' && 'env' 'ORCH_STATE_DIR=/recorded/state' 'node' '/recorded/scripts/orch/sessions.mjs' 'resume' '--role' 'child' '--session-id' 'child-exact' '--generation' '2' '--native-stopped' 'true' '--live-verified' 'true'",
      "reason": "Owner must verify native stopped and LOW; parent first"
    }
  ]
};
