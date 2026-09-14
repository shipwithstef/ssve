---
disable-model-invocation: true
name: wsl2-audio
version: "1.0"
description: >
  Set up, diagnose, and fix audio in WSL2 — covers both Claude Code voice mode and
  general audio (input + output). Use this skill whenever the user mentions: voice mode
  not working in WSL, can't hear anything in WSL2, mic not working in WSL, Claude Code
  voice mode setup, audio/sound issues on Windows Subsystem for Linux, WSLg audio
  problems, PulseAudio in WSL, ALSA in WSL, aplay, arecord, paplay, parecord, or
  speaker-test in a WSL context. Even if they just say "sound doesn't work" or "voice
  mode is broken" and you know they're on WSL2, use this skill.
phases:
  - id: P1-TransportDiagnosis
    trigger: always
    reads: ["WSL environment", "/mnt/wslg/PulseServer", "task request"]
    writes: [".svc/wsl2-audio-transport.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-PulseAlsaInventory
    trigger: always
    reads: ["pactl info", "pactl sinks/sources", "ALSA config"]
    writes: [".svc/wsl2-audio-inventory.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-InstallConfigurePlan
    trigger: missing-tools-or-config
    reads: ["diagnosis output", "package status", "shell profiles"]
    writes: [".svc/wsl2-audio-config.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P4-OutputVerification
    trigger: output-test-needed
    reads: ["PulseAudio sink", "test tone output", "speaker-test output"]
    writes: [".svc/wsl2-audio-output.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P5-InputVerification
    trigger: input-test-needed
    reads: ["PulseAudio source", "mic recording output", "Windows mic permission state"]
    writes: [".svc/wsl2-audio-input.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P6-RestartTroubleshootingGuidance
    trigger: always
    reads: ["verification results", "restart requirements", "fallback status"]
    writes: [".svc/wsl2-audio-guidance.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P7-SelfVerifyContinuation
    trigger: always
    reads: ["diagnosis logs", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required: []
  optional: []
outputs:
  produces: []
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# WSL2 Audio Setup & Troubleshooting

This skill fixes audio in WSL2 — both for Claude Code voice mode (mic input + speaker
output) and general audio playback/recording. The same audio chain powers both:
Application -> ALSA -> PulseAudio plugin -> WSLg PulseAudio server -> Windows RDP audio -> Windows speakers/mic.

WSL2 audio works through a chain: **Application -> ALSA -> PulseAudio plugin -> WSLg PulseAudio server -> Windows RDP audio -> Windows speakers/mic**. Most problems come from a break somewhere in this chain.

## Phase 1: Diagnose the Current State

Before installing or changing anything, figure out what's working and what's not.
Run these commands and interpret the results:

### 1. Check WSLg availability

```bash
ls -la /mnt/wslg/PulseServer
```

- **File exists**: WSLg is available (Windows 11 or updated Windows 10 with WSLg support). This is the expected audio transport.
- **File missing**: WSLg is not available. The user needs either Windows 11, or to set up a manual PulseAudio server on the Windows side (see Phase 3 fallback).

### 2. Check PulseAudio connectivity

```bash
pactl info
```

- **Works and shows `Server Name: pulseaudio`**: PulseAudio server is reachable.
- **`Connection refused` or `command not found`**: Need to install PulseAudio tools and/or configure the connection.

Key fields to note from `pactl info`:
- `Server String` — should be `unix:/mnt/wslg/PulseServer` for WSLg
- `Default Sink` — the output device (usually `RDPSink` for WSLg)
- `Default Source` — the input device (usually `RDPSource` for WSLg)

### 3. Check sinks (output) and sources (input)

```bash
pactl list sinks short
pactl list sources short
```

- You should see at least one sink (for output) and one source (for input).
- `SUSPENDED` state is normal when nothing is actively playing/recording.

### 4. Check volume and mute

```bash
pactl get-sink-volume @DEFAULT_SINK@
pactl get-sink-mute @DEFAULT_SINK@
pactl get-source-volume @DEFAULT_SOURCE@
pactl get-source-mute @DEFAULT_SOURCE@
```

### 5. Check ALSA configuration

```bash
cat ~/.asoundrc 2>/dev/null
cat /etc/asound.conf 2>/dev/null
aplay -l
dpkg -l | grep libasound2-plugins
```

- `aplay -l` showing "no soundcards found" is **normal** in WSL2 — there's no real hardware. Audio works through the ALSA-PulseAudio plugin bridge instead.
- `libasound2-plugins` must be installed for ALSA apps to route through PulseAudio.

## Phase 2: Install and Configure

Based on what's missing from the diagnosis, apply the relevant fixes:

### Install required packages

```bash
sudo apt update
sudo apt install -y pulseaudio-utils libasound2-plugins alsa-utils
```

- `pulseaudio-utils` — provides `pactl`, `paplay`, `parecord`
- `libasound2-plugins` — the ALSA-to-PulseAudio bridge plugin
- `alsa-utils` — provides `aplay`, `arecord`, `speaker-test`

### Configure ALSA to use PulseAudio

Create both user-level and system-level config so all applications route through PulseAudio:

**~/.asoundrc** (user-level):
```
pcm.!default {
    type pulse
    fallback "sysdefault"
}
ctl.!default {
    type pulse
    fallback "sysdefault"
}
```

**/etc/asound.conf** (system-level, needs sudo):
```
pcm.!default {
    type pulse
    fallback "sysdefault"
}
ctl.!default {
    type pulse
    fallback "sysdefault"
}
```

### Set PULSE_SERVER (usually not needed with WSLg)

If `pactl info` can't connect but `/mnt/wslg/PulseServer` exists:

```bash
export PULSE_SERVER=unix:/mnt/wslg/PulseServer
```

Add to `~/.bashrc` or `~/.zshrc` to persist.

## Phase 3: Verify

Test both output and input separately.

### Test output (speakers)

**Method 1 — PulseAudio direct** (tests PulseAudio -> Windows):
```bash
# Generate a 3-second test tone
ffmpeg -f lavfi -i "sine=frequency=440:duration=3" -ar 44100 -ac 2 /tmp/test_tone.wav -y
paplay /tmp/test_tone.wav
```

**Method 2 — ALSA** (tests ALSA -> PulseAudio -> Windows):
```bash
aplay /tmp/test_tone.wav
```

**Method 3 — speaker-test**:
```bash
speaker-test -t sine -f 440 -c 2 -l 1
```

If Method 1 works but Method 2 doesn't, the ALSA config is wrong — recheck `.asoundrc`.
If neither works, the PulseAudio -> Windows link is broken.

### Test input (microphone)

**Method 1 — PulseAudio direct**:
```bash
parecord --channels=1 --rate=44100 --format=s16le /tmp/mic_test.wav &
PID=$!
sleep 3
kill $PID
paplay /tmp/mic_test.wav
```

**Method 2 — ALSA**:
```bash
arecord -D default -f cd -d 3 /tmp/mic_test.wav
aplay /tmp/mic_test.wav
```

If recording works but playback is silent, that's an output problem (go back to output testing).
If recording captures silence, check Windows microphone permissions (see Troubleshooting).

## Phase 4: Troubleshooting

### No sound at all (output)

1. **Check Windows volume** — right-click speaker icon in taskbar, check it's not muted and the correct device is selected.
2. **Restart WSLg** — from PowerShell: `wsl --shutdown`, then reopen WSL.
3. **Check WSL version** — `wsl --version` from PowerShell. WSLg requires WSL 2.0+.
4. **Try a different sink**: `pactl list sinks short` then `pactl set-default-sink <sink_name>`.

### Microphone not working

1. **Windows privacy settings** — Settings > Privacy & Security > Microphone > ensure "Let desktop apps access your microphone" is ON.
2. **Check source exists**: `pactl list sources short` — should show `RDPSource` or similar.
3. **Check source volume**: `pactl set-source-volume @DEFAULT_SOURCE@ 100%`
4. **Unmute source**: `pactl set-source-mute @DEFAULT_SOURCE@ 0`

### PulseAudio connection refused

1. Check WSLg socket: `ls -la /mnt/wslg/PulseServer`
2. If missing, WSLg may not be installed. From PowerShell: `wsl --update`
3. Restart WSL: `wsl --shutdown` from PowerShell, then reopen.

### Fallback: No WSLg available

If WSLg is not available (older Windows 10), the user needs to run a PulseAudio server on Windows:

1. Download PulseAudio for Windows (pulseaudio-1.1.zip from freedesktop.org archives)
2. Edit `etc/pulse/default.pa` to add: `load-module module-native-protocol-tcp auth-anonymous=1`
3. Edit `etc/pulse/daemon.conf`: `exit-idle-time = -1`
4. Run `bin/pulseaudio.exe` on Windows
5. In WSL, set: `export PULSE_SERVER=tcp:$(hostname).local`

This fallback is less reliable than WSLg and may have latency issues.

## Quick Reference

| What to check | Command |
|---|---|
| PulseAudio status | `pactl info` |
| Output devices | `pactl list sinks short` |
| Input devices | `pactl list sources short` |
| Volume (output) | `pactl get-sink-volume @DEFAULT_SINK@` |
| Volume (input) | `pactl get-source-volume @DEFAULT_SOURCE@` |
| Test output | `paplay /tmp/test_tone.wav` |
| Test input | `parecord -d 3 /tmp/mic_test.wav` |
| WSLg socket | `ls /mnt/wslg/PulseServer` |
| ALSA plugin installed | `dpkg -l \| grep libasound2-plugins` |
| Restart WSL | `wsl --shutdown` (from PowerShell) |

## Phase Receipt Contract

When running in task-graph mode, record these phase receipts before marking the `wsl2-audio` task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-TransportDiagnosis --evidence command_output:.svc/wsl2-audio-transport.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-PulseAlsaInventory --evidence command_output:.svc/wsl2-audio-inventory.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-InstallConfigurePlan --evidence command_output:.svc/wsl2-audio-config.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-OutputVerification --evidence command_output:.svc/wsl2-audio-output.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-InputVerification --evidence command_output:.svc/wsl2-audio-input.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-RestartTroubleshootingGuidance --evidence command_output:.svc/wsl2-audio-guidance.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-SelfVerifyContinuation --evidence command_output:.svc/wsl2-audio-self-verify.log
```

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first — this is the cross-host,
  cross-session, cross-subagent source of truth.
- Host UI mirroring (TaskList/TaskUpdate in Claude Code; `/task` + `TaskList`/`TaskOutput` observation in Kimi; `update_plan` in Codex)
  is ONLY performed when running in the parent/top-level session. Detect via:
  host exposes TaskList tool AND no `SVC_SUBAGENT=1` marker in env. If either
  check fails, skip host mirroring — file state is the durable record; the
  orchestrator parent will re-read and re-mirror after the subagent returns.
- Subagents MUST NOT attempt TaskUpdate calls. Trying and failing is not
  graceful; it's silent drift between the subagent's intent and the host UI.
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Chaining

**Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`):**
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

This skill is standalone. It diagnoses and fixes audio — no downstream chaining.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Transport path identified | Confirm whether WSLg PulseServer or Windows PulseAudio fallback is being used, with the command output that proves it. | |
| 2 | Output and input were tested separately | Verify speaker playback and microphone recording each have an explicit test result, or a concrete blocker is reported. | |
| 3 | Persistent config is deliberate | Confirm any `.asoundrc`, `/etc/asound.conf`, or shell profile changes are necessary and described. | |
| 4 | Restart boundary is clear | State whether `wsl --shutdown`, shell reload, or app restart is required before retesting. | |

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
