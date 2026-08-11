# Port / Convert Parity & Visual-Diff: the baseline is the legacy source, not the deployed product

When a **port/convert repo** is asked whether something "differs from the
original", "matches the source", "still looks like before", or any
parity/visual-diff question, you MUST resolve the comparison baseline before
diffing. The single most common failure is comparing against the **deployed
product** — which, after cut-over, already serves the *port's own* build, so the
diff trivially shows "identical / parity" and the real difference is missed.

## The trap

> User: "the landing images look different from the original — validate it."
> Agent diffs the port repo against `https://<product>.app` → "byte-identical,
> parity." **Wrong** — `<product>.app` was already cut over to the port build.
> The actual original lived only in the **legacy source repo**.

(Real failure: example-marketplace landing-hero-restore session, 2026-06-15. The agent
gave a false "parity" answer and only found the real difference — 7 swapped hero
images — after 3 user corrections forced it to run the legacy source repo.)

## The rule

Before any parity / "differs from original" / visual-diff judgment in a
port/convert repo:

1. **Resolve the baseline explicitly.** The "original" is the **legacy source
   repo**, not the deployed product. Find it from:
   - `parity_verification_results.md` / parity baseline docs (cite the `source:` path),
   - a `source_repo` pointer / a sibling checkout,
   - the porting WI / `onboard-repo` record.
2. **Treat the deployed product as suspect.** A cut-over port's production URL
   serves the port build — it is NOT the original. Diffing against it proves
   nothing about source parity.
3. **Diff at the byte level**, not by eye — hash the actual artifacts from each
   side (`curl … | sha256sum`, `git -C <source> show`). Filename/URL matches do
   not prove content matches; content-hashed bundles do, plain `public/` files do not.
4. **State the baseline in the answer.** "Compared port @HEAD vs legacy source
   `<path>@<sha>`" — never an unqualified "they're identical."

## Quick check

Before answering a port parity question, ask: *"What exactly am I comparing
against, and is it the legacy source — or just another copy of the port?"* If you
cannot name the legacy source location, resolve it first; do not answer from the
deployed product.
