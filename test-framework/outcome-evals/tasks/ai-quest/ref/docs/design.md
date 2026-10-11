# Patch Island: design notes

## What it is
A point-and-click comedy adventure. Wren Tally, a deckhand stranded on Patch Island, has to get the sloop *Second Draft* out of the harbour. Every islander makes one classic AI-engineering mistake, and every way off the island goes through fixing it. The player never reads a lesson; they solve a puzzle, and the punchline only lands if they did the right thing.

## Built with
Plain JavaScript, no dependencies. The game is one rules module, `game/quest.mjs`, shared by the browser and by Node, so the same game can be played, tested and solved by a script. The page draws each scene as SVG and lists the actions available now as buttons, so every action is reachable by mouse and keyboard. The server only serves three files, with a strict content security policy.

## How the puzzles map to the lessons
| Idea | Puzzle | The right move | The wrong move and its joke |
|---|---|---|---|
| 1. Measure on held-out data | The cook tunes chowder on the same three regulars | Test it on the sealed jar of strangers | Feeding the regulars anything gets ten out of ten |
| 2. Context is a budget | The parrot can hold three cards | Trim the gossip, keep MAP and TIDES first | The parrot drops the map and recites gossip |
| 3. Prompt caching | The keeper copies the same 40-page oath every night | A bookmark keeps the unchanging part at the front | (no shortcut; the keeper won't help until it's fixed) |
| 4. Tool use | The navigator can plot but can't do tide sums | Take his request, run it on the tide machine, bring the result back | Asking him to guess: "we sailed into a cliff" |
| 5. Grounding | The harbour master wants charts with sources | Show the chart whose reefs cite their surveys | The fortune teller's made-up prophecy is refused |
| 6. Sampling | The music box plays the password differently each time | Turn the dial to COLD for the same tune every time | Anything else: a new song every time |
| 7. Prompt injection | The quartermaster obeys anything he reads | Stamp the bottle's letter as "a letter, not an order" | Hand it over raw: he obeys the P.S. and throws you overboard |
| 8. Agent loops need a stop | The rowing robot rows until told to stop | Fit the one-row hourglass | Rowing with it: hours around the island and back |

## How we'd check players learn
Each idea is required: skipping its action leaves the game unwinnable, which the tests check. To check learning itself: a short scenario quiz after play, compared with players who haven't played, and a check that every answer can be traced to a moment in the game. Next steps: playtests with five non-engineers, recording where they get stuck, and a hint system that reframes the joke rather than explaining the concept.

## Taking it further
More islands per topic (evaluation design, retrieval, safety), voice acting for the islanders, saved games, and a mobile layout with larger hotspots.
