# Tier-3 Judged Coverage (WI-368, 2026-06-07)

Top-10 load-bearing skills registered in `skill-baselines.json` (judge prompts pinned at `judge_prompt_version`; scores comparable across runs only within a prompt version).

| Skill | Artifact judged | Scenario source |
|---|---|---|
| route-workflow | routing decision + lane graph | live WI runs or tier-2 route scenarios |
| write-spec | feature spec | tier-2 write-spec scenario output |
| plan-changeset | manifest (blueprints!) | tier-2 / live manifests |
| execute-changeset | exec trail | live checkpoint+receipt trails |
| review-gate | findings artifact | tier-2 review scenarios |
| diagnose-bug | (pre-existing) diagnose-bug-typo | first judged scenario |
| validate-feature | validation report | tier-2 scenario |
| write-e2e | e2e spec + assertion strategy | tier-2 scenario |
| verify-promotion | verification report | live G7 reports |
| capture-idea | emitted WI doc | proposal fixtures |

**Run contract:** `EVALS=1` sessions only; `./run-tier3.sh <artifact> <dimension>`; budget ~$0.25-0.40/judgment, full sweep ≈ 30 judgments. Plumbing smoke (this WI): one judgment on a live WI-361 manifest excerpt — see results dir.
