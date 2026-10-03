# SR3 — Shutdown interruption recovery (2026-10-03)
① What
- Preempt/Terminate marks current attempts interrupting; supervisor SIGTERM persists interrupted, including exit 1.
- Short metadata locks preserve interruption through heartbeat/session/exit writes; explicit owner stops remain stopped.
- Recovery includes finished interruptions, signal failures, missing clean exits and prior-boot journal/checkpoint shutdown windows.
- Bound parent native auto-resume accepts generation 2 without a supervised nonce; binding, live-owner and once-per-boot guards remain.
② How
- `node --test scripts/orch/*.test.mjs`: 86 passed, 0 failed; real user scopes use fake workers, no inference.
- Replay preserves p4-fix 19:07:11.930Z and side01-activate 19:07:11.787Z exit-1 evidence; both resume once, then the bound parent.
- Live journal confirms the incident window; parent 6f0343ba-6f5e-4731-a94d-1256048ae265 matches generation 2 and is already live.
- Watcher/collector restarted from this checkout; both and server active, IMDS healthy. Units unchanged; no daemon-reload needed.
- Syntax, manifest lint, diff checks and file persistence passed.
③ Issues
- Full Tier-1: 398 pass, 4 fail: existing docs links, legacy knowledge queue, unchanged SR2 receipt fixture scanner finding, two-box timeout.
- No new eviction or native Claude launch; existing supervisors retain loaded code. Local commit only, no push; unrelated research preserved.
