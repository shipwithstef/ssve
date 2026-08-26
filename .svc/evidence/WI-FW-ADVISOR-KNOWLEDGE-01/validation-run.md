# Validation evidence — WI-FW-ADVISOR-KNOWLEDGE-01 (2026-08-26)

| Check | Command | Result |
|---|---|---|
| Index Verify commands | node -e includedSkills.length / reviewGates keys / laneDefinitions keys; grep -cE AP headers anti-patterns.md; ls provision/hosts/*.json \| wc -l; ls tier-1/*.sh \| wc -l | 103 / G1-G7 / 7 lanes named / 34 / 9 / 325 — all match index claims |
| Manifest lint | `node scripts/lint-skills-manifest.mjs` | PASS (103 skills, 58 routing core) |
| Frontmatter AST | `node test-framework/evals/tier-1/validate-frontmatter-ast.mjs` | 3098 passed, 0 failed |
| Skill structure | `bash test-framework/evals/tier-1/validate-skill-structure.sh` | 1251 passed, 0 failed |
| Self-Verify sections | `bash test-framework/evals/tier-1/validate-self-verify-sections.sh` | PASS |
| route-workflow numbering | `bash test-framework/evals/tier-1/validate-route-workflow-self-verify-numbering.sh` | PASS — 19 rows contiguous |
| Surface tier-1 (cos + route-workflow) | `bash test-framework/evals/run-all-evals.sh --surface skills/cos/SKILL.md,skills/route-workflow/SKILL.md` | 3 scripts passed incl. validate-memory-company-v2 + validate-owner-decision-v2 |
| Task graph | `node scripts/task-graph.mjs validate .svc/lane-tasks-WI-FW-ADVISOR-KNOWLEDGE-01.json` | PASS — 5 tasks completed |
| Independent adversarial review | subagent REVIEW pass over full diff + new files | APPROVE with notes; MEDIUM finding #1 (fabricated section anchor) fixed in same session; LOWs #2/#3/#4/#5 addressed |

Post-fix re-validation: frontmatter AST + skill structure + manifest lint re-run green after citation/table fixes.
