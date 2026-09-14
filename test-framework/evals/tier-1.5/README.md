# Tier 1.5: Skill Comprehension & Triggering

Tier 1.5 tests whether the LLM understands svc skill contracts and can route to the correct skill.

## Structure

```
tier-1.5/
├── prompts/
│   ├── comprehension/     # Q&A prompt files (52 skills)
│   └── triggering/        # Realistic user prompts (10 skills)
├── test-skill-comprehension.sh   # Tests factual knowledge of each skill
├── test-skill-triggering.sh      # Tests routing to correct skill
└── README.md
```

## Comprehension Prompts (`prompts/comprehension/*.txt`)

Each file tests one skill with one or more Q&A pairs:

```
Skill: <skill-name>

Q: What is the maximum line count for a SKILL.md?
A: Expected pattern: 500 lines

Q: What naming convention should skills follow?
A: Expected pattern: verb-noun
```

The test runner:
1. Reads the skill's `SKILL.md` for context
2. Sends the question to the LLM
3. Checks if the answer contains the expected pattern

## Triggering Prompts (`prompts/triggering/*.txt`)

Each file contains a realistic user request that should trigger a specific skill:

```
I have a bug in my REST API — the PUT endpoint returns a 500 error...
```

The test runner:
1. Sends the user prompt + skill manifest context to the LLM
2. Checks if the LLM selects the correct skill

## Running

```bash
# Run all tier-1.5 tests
bash test-framework/evals/tier-1.5/test-skill-comprehension.sh
bash test-framework/evals/tier-1.5/test-skill-triggering.sh

# Run as part of full eval suite (requires EVALS=1)
EVALS=1 bash test-framework/evals/run-all-evals.sh
```

## Cost

- Comprehension: ~5K tokens per Q&A pair, ~30-60s each
- Triggering: ~10K tokens per prompt, ~60s each
