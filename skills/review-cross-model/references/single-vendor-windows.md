## Single-Vendor Windows (§4g)

When only one vendor family is reachable (quota, outage, cost), the reviewer
available for this loop is same-family with the executor and shares its
priors — repeating same-family passes approaches a floor set by those shared
priors and buys almost nothing past the first.

**The compensation is mechanism, not more passes.** In a single-vendor window,
every claim that would otherwise go to cross-family review must instead
acquire one of: a mechanical/grep-derived check, a contract claim
(`audit-*-contract.mjs`-style re-derivation from source on every run), a
negative test (deliberately break the check and require it to fail), or be
recorded as **UNVERIFIED** with the reason. It is never silently downgraded to
a same-family pass and marked reviewed.

**Self-terminating.** Record `review_family: cross | same` per round in
the review doc (Step 5 Summary block). When a second, opposite-family vendor becomes
available again, the accumulated `review_family: "same"` receipts ARE the
drain queue for what deserves a real cross-family look — no separate ledger
to maintain. The window ends when that queue is drained, not when the quota
resets. This is the standing justification for same-family (e.g. Opus-only)
review windows.
