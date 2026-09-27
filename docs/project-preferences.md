# Project communication preferences

The optional `.svc/project-preferences.json` file controls how an agent
explains work in this project. Keep it project-local so one repository can
favor a brief technical style while another favors introductory explanations.
The latest direct user request takes precedence over this file. The global
`~/.svc/builder-profile.md` remains background knowledge about the builder;
this reader does not parse it or copy private profile content into telemetry.

A complete example:

```json
{
  "communication": {
    "explanation_level": "intermediate",
    "style": "plain_stepwise"
  },
  "learning": {
    "mode": "opportunistic",
    "difficulty": "beginner"
  }
}
```

All fields are optional. The defaults are `beginner` explanation level,
`plain_stepwise` style, `off` learning mode, and `beginner` exercise
difficulty. This means ordinary updates state the outcome and next step in
short, clear language; no exercise appears unless learning is explicitly
enabled in the project or requested for the current session. Explanation
levels adjust the detail after that simple lead: beginner names each action
and explains necessary terms, intermediate assumes routine development
knowledge, and advanced adds precise tradeoffs and evidence without a long
tutorial.

`learning.mode: opportunistic` permits a brief, optional exercise during
a natural wait. It does not add a workflow task or delay the work. Each offer
points to a real project file or decision, takes about one minute, and never
requires an answer. Only one unanswered offer may be present in a session;
a skip suppresses further offers for that session. A direct user request to
stop teaching takes precedence. Do not treat an offer as a completed lesson or
an achievement.

For example, while a check runs in this repository:

- Beginner: "Optional one-minute exercise: open
  `scripts/skill-router.mjs`. Which CLI command only checks the routing
  index, and which one proposes a skill?"
- Advanced: "Optional one-minute exercise: inspect
  `scripts/lib/skill-router.mjs`. Why do required pins bypass the optional
  card budget, and what failure would occur if they did not?"

Read the effective profile without changing files:

```bash
node scripts/project-preferences.mjs --root /path/to/project
```

The JSON response includes `source` (`default`, `project`, or
`invalid`) and `diagnostics`. A missing file uses defaults. An invalid,
oversized, or symlinked file also uses safe defaults and names the field or
file problem without echoing its contents. The reader accepts unrelated
top-level keys so other project preferences can share the same file; it
never rewrites the file. Full project teaching remains the explicit
`teach-project` Socratic flow or its existing post-promotion owner guide.
