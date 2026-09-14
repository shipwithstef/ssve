# Regex Against Case-Sensitive Identifier Conventions

When a regex matches identifiers that follow a case convention
(`onboardingFooUi`, `getUserById`, `kFoo_BarBaz`), **never** combine
the convention-encoding character classes with `IGNORECASE` /
`re.IGNORECASE` / `(?i)` / `--ignore-case` flags. They cancel each other
and produce false positives.

## The trap

```python
# Goal: match clientIds following the convention `onboarding<Tenant>(<Product>)?Ui`
import re
pattern = re.compile(r"^(onboarding|backoffice|userPortal)[A-Z][A-Za-z]+Ui$",
                     re.IGNORECASE)

pattern.match("onboardingDiscountJointAccountUi")   # ✓ correct match
pattern.match("backOfficeApp")                       # ✗ FALSE POSITIVE
                                                     #    "backoffice" matches "backOffice"
                                                     #    "[A-Z]" matches "A" (lowercase 'a' under IGNORECASE)
                                                     #    "[A-Za-z]+" matches "pp"
                                                     #    "Ui" matches nothing - actually wait,
                                                     #    "App" ends in "p", not "i"
                                                     # Refined: this specific case wouldn't match,
                                                     # but `backOfficeAppUi` would, and so would
                                                     # `BACKofficeXyzUi`, `userPortalXyzUI`, etc.
```

The convention `[A-Z]` is **load-bearing** when the identifier scheme is
PascalCase / camelCase. With `IGNORECASE`, `[A-Z]` becomes equivalent to
`[A-Za-z]`, and the regex no longer enforces the convention — it accepts
arbitrary mixed case.

## The rule

| Situation | Use | Don't use |
|-----------|-----|-----------|
| Match identifiers in a case-sensitive convention (camelCase, PascalCase, kebab-case-with-init-cap, etc.) | Plain regex without flags | `re.IGNORECASE`, `(?i)`, `grep -i` |
| Match a token that may appear in any casing | `re.IGNORECASE` is fine | Plain regex (will miss variants) |
| Match a fixed prefix that's case-insensitive but enforce structure on the rest | `^(?i:prefix)RestOfPattern` (Python 3.6+ scoped flag) | Whole-pattern `IGNORECASE` |

## Python pattern: scoped flags

```python
# If you genuinely need the prefix case-insensitive but the structure enforced:
pattern = re.compile(r"^(?i:onboarding|backoffice|userportal)[A-Z][A-Za-z]+Ui$")

# But ask first: do you actually need the prefix case-insensitive? Usually no —
# the convention IS the contract. "BackOffice" should NOT match if the system
# emits "backoffice".
```

## Where this bites

- Mining identifiers from MongoDB / API exports where the convention is the
  source of truth
- Whitelisting / blacklisting via patterns where false positives become
  data-integrity bugs
- Parsing class names, function names, type names from source code
- Validating user input against a naming policy

## Quick check

Before adding `IGNORECASE` to any regex that contains `[A-Z]` or `[a-z]`,
ask: **is the case in this character class load-bearing?** If yes,
`IGNORECASE` is wrong. Strip it.

## Origin

WI-037 implementation 2026-05-06: `extract-oauth-clients.py` initially used
`re.compile(r"^(onboarding|backoffice|userPortal)[A-Z][A-Za-z]+Ui$", re.IGNORECASE)`
to mine per-tenant clientIds from a legacy MongoDB. The `IGNORECASE` flag
matched generic clients like `backOfficeApp` (Mongobee-seeded infrastructure
clients that should NOT have been included). Caught at G5 review as
medium-severity; tightened the regex by removing the flag.
