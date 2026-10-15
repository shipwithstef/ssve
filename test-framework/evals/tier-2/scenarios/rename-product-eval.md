# Tier 2 Scenario: rename-product routing

## Skill Under Test

`rename-product`

## Setup

Routing comprehension only. The prompt does not name the owning skill for either request.

## Prompt

```
Route each request on its own. Choose the skill from the request. Do not name a skill anywhere except the selected line.

Request A: The live product needs a new name. The name is already chosen, and its domain and trademark are checked. Move the product's copy, identifiers, cloud resources, domain, docs, local folders, and agent memory onto that name.

Request B: Rename an internal package identifier in the repository. Leave the live product name, cloud resources, domain, and local folders unchanged.

For each request print exactly two lines. The second line is `selected:` and the one skill name, with no other text on that line.

Request A
selected:

Request B
selected:
```

## Expected Outputs

- Request A `selected:` is exactly `rename-product`.
- Request B `selected:` is exactly `plan-changeset`.
- The prompt does not supply those selections.
- A reversed `selected:` value fails that request's check.

## Assertions

### Process Checks
```json
[
  {"type":"output_regex","regex":"^Request A\\nselected: rename-product$","flags":"m","label":"Request A selected: rename-product"},
  {"type":"output_regex","regex":"^Request B\\nselected: plan-changeset$","flags":"m","label":"Request B selected: plan-changeset"}
]
```

## Reversed-selection fixture

This answer must fail both process checks. Each `selected:` line is anchored to its request and must be the exact skill.

```
Request A
selected: plan-changeset

Request B
selected: rename-product
```

Rejecting regexes, flags `m`:

- `^Request A\nselected: rename-product$`
- `^Request B\nselected: plan-changeset$`
