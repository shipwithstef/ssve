# SR1 — Spot VM recovery (2026-10-03)

① Delivered
- Boot recovery reconciles task records using changed boot identity and kernel locks.
- Interrupted attempts persist; exact-session dispatch uses recorded continuation text.
- Durable reservations prevent repeat dispatch in one boot; lifetime automatic cap is two.
- Paid/live cards require owner action; adopted/unknown records also stay held.
- Five-second Azure polling checkpoints local Preempt/Terminate events and signals a flush.
- Collector watch owns its lock for its lifetime; status/web expose recovery and owner attach.
- Four user units installed from this checkout; linger was already enabled (no sudo run).
- Only scripts/orch/ and docs/orch/ changed for SR1; unrelated research remains untouched.

② Verification
- `node --test scripts/orch/*.test.mjs`: 33 passed, 0 failed, no inference.
- Fake boot/dispatch tests cover duplicate/concurrent recovery, paid holds and the two-resume cap.
- Real user-scope fake worker tests cover paid reservation refusal and exact auto-resume.
- Installer regression and `systemd-analyze --user verify`: PASS; manifest linter: PASS.
- Live collector SIGUSR1 flush advanced revision immediately; status endpoint: HTTP 200.
- IMDS poll healthy for vm-agent-swarm with zero scheduled events at verification.
- `systemctl --user status` after recovery, 14:43 UTC:
  - orch-recover.service: enabled; active (exited); status=0/SUCCESS.
  - orch-collect.service: enabled; active (running).
  - orch-serve.service: enabled; active (running).
  - orch-preempt.service: enabled; active (running).
- View: http://100.126.92.3:8790/ (serve.env selects bind/port).
- Owner attach displayed: `claude --resume 6f0343ba-6f5e-4731-a94d-1256048ae265`.
- Parent ID verified from the Claude transcript containing SR1 dispatch; Claude was not started.
- Live recovery held d1a (adopted) and p1b (missing boot); current-boot workers stayed untouched.

③ Limits / broader checks
- Full Tier-1 sweep: 399 passed, 3 failed, including one 180-second timeout.
- Docs audit: six broken links in pre-existing docs/control-pane-design.md.
- Legacy-backfill audit: pre-existing unqueued research domains, including spot-recovery.
- Two-box-transmutation isolated retry PASS (130 tests passed, 1 hermetic skip); timeout resolved.
- Real eviction and paid provider resume were not exercised; this restores guest processes
  after VM startup, without external capacity restart, cross-VM fencing or off-VM backup.
