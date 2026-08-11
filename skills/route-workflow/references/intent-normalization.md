# Intent Normalization

Use this before route classification when a user message contains recoverable
typos, split words, non-native phrasing, or noisy skill names. The purpose is to
preserve intent, not to improve style.

## Contract

1. Keep the original user text available for audit.
2. Produce a short `normalized_intent` that removes only recoverable noise.
3. Route from `normalized_intent` when the noisy surface form would change the
   selected skill, lane, or continuation behavior.
4. Log material normalization in `.svc/pipeline-decisions.jsonl` under
   `details.routing_context`:

```json
{
  "routing_context": {
    "original_user_text": "<verbatim>",
    "normalized_intent": "<semantic equivalent>",
    "normalization_applied": true,
    "normalization_evidence": ["split-word: ful lverifications -> full verifications"]
  }
}
```

## Allowed Normalizations

| Noisy Form | Normalized Intent Fragment |
|---|---|
| `should improvmeent for this thing` | `should be an improvement for this thing` |
| `itnelligent parsing` | `intelligent parsing` |
| `ful lverifications` | `full verifications` |
| `browser trakc visual` | `browser, track-visuals` |
| `wait waht you are suppsoed to validate` | `wait, what are you supposed to validate` |
| `post dpeloyemnt`, `post deployment`, `after deploy`, `post deploy` | `post-deployment validation` |
| `run e2e after deployment`, `post deploy e2e`, `validated post deployment` | `run E2E against the deployed production URL after deployment` |
| `I tnink` | `I think` |
| `tetjourney`, `testjourney`, `test journey` | `test-journeys` |
| `route workflow`, `route-workflow`, `/route-workflow` | `route-workflow` |

## Constraint-Preserving Modifiers

Words such as `post-deploy`, `post deployment`, `after deploy`, `production`,
`prod`, `live`, and an explicit production URL are evidence-stage constraints,
not flavor text. Preserve them in `normalized_intent`.

If the normalized request asks for E2E, visual, browser, API, or validation
`post-deploy`/`after deploy`, pre-deploy local evidence can only be supporting
evidence. It does not satisfy the requested proof.

## Guardrails

| Do | Do Not |
|---|---|
| Correct obvious keystroke noise before skill matching. | Infer a new feature, artifact, or lane that was not present. |
| Resolve known skill-name variants like `testjourney` to `test-journeys`. | Treat a typo-heavy correction as a fresh goal by default. |
| Prefer the smallest semantic change that makes the text routable. | Use normalization to soften urgency or remove constraints. |
| Log the normalized interpretation when it changes route choice. | Hide the original text from audit artifacts. |

## Routing Rule

If the original text and normalized text would route differently, pick the
normalized route only when the normalization is supported by visible evidence
from the user's words. Otherwise classify the turn as ambiguous and use the
normal route-workflow checkpoint instead of guessing.
