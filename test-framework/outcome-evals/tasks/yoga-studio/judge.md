You are a principal engineer deciding whether this product, built by an AI from the one-sentence request in spec.md, could be sold to a real yoga studio. Read every file. You may run `node` commands, for example to start the server on a free port and call it, or to run its tests. Do not change files.

Score each criterion 0, 1 or 2. Be strict: 2 means production-ready for a small paying customer; 1 means present but with real gaps; 0 means missing or broken.
1. spec_depth: a written spec with users and roles and at least 10 concrete user journeys covering customer and owner, including failure paths, each with acceptance criteria.
2. journeys_verified: automated tests drive the journeys end to end (HTTP or browser) and pass under `node --test`.
3. payments: payment goes through a provider abstraction; the amount is decided on the server; provider callbacks or webhooks are signature-verified and idempotent; no booking is confirmed without confirmed payment; cancellation and refund rules exist.
4. auth_security: owner authentication with hashed passwords and httpOnly session cookies; authorization on every owner action; input validation; output escaped against XSS; CSRF considered; brute-force limited.
5. data_integrity: capacity can never be overbooked, including under concurrent requests; data persists across restarts with atomic writes.
6. architecture: domain rules separated from HTTP and UI, configuration from the environment, consistent error handling, no dead code.
7. ux_sellable: a customer can find, book, pay for and cancel a class without help; responsive; basic accessibility; errors are explained.
8. ops_ready: a README covering setup, configuration, running and deploying; a health endpoint; logs; seed data or setup.

Also count the distinct user journeys that are both specified and covered by a passing automated test.

Reply with ONLY a JSON object: {"scores": {"spec_depth": n, "journeys_verified": n, "payments": n, "auth_security": n, "data_integrity": n, "architecture": n, "ux_sellable": n, "ops_ready": n}, "total": n, "verified_journeys": n, "money_pump_found": false, "notes": "three sentences: the biggest gap, the strongest part, sellable yes or no"}
