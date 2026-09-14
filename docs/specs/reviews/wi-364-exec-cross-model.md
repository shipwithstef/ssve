# WI-364 — G6 review-exec (cross-model, codex)

**Round 1** (full merge-base diff, 60.6KB package, stdin dispatch): 3 findings, verdict reject.
- WI364-G6-001 HIGH — linter spawn failure masqueraded as staleness (codex sandbox EPERM repro)
- WI364-G6-002 MEDIUM — desc-merge absorbs in-marker description edits
- WI364-G6-003 MEDIUM — duplicate marker pairs undetected (first-match regex)

**Dispositions:** 001 accepted-patched (drift vs could-not-run attribution, both fail closed); 002 rejected-with-evidence (G2 byte-identity invariant; names/order/membership enforced; amendment §1 + audit F2); 003 accepted-patched (markerCount per id, pair-count error).

**Patch:** checkpoint-3 `67d5c8c0` (22+/2-). Negatives proven: dup fixture exit 1 "found 2 begin / 2 end"; generator-missing shows could-not-run; mirrors fresh; linter PASS; validator 14/14.

**Round 2** (patch delta): all 3 dispositions accepted=true, **verdict: approve**. Codex note on 001: "this sandbox reproduced EPERM attribution, while direct mirror --check returned fresh."

Protocol notes: first dispatch failed on MAX_ARG_STRLEN (argv package) → stdin; second package rebuilt two-dot→three-dot (foreign main-side files excluded, 400KB→60KB). No output corruption either round (streak ends at 6).
