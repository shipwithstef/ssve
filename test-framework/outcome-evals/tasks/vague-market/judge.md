You are grading a small browser game that an AI built from a founder's short request (in spec.md). Read every file in this directory. You may run `node` commands, for example to start the server on a free port and call its API with `node -e "..."` fetch calls, or to run its tests. Do not change any files.

Score each criterion 0, 1 or 2. Be strict: 2 means a reviewer at a good studio would accept it as is.
1. playable_loop: a clear loop (buy, sell, progress over days or turns) that works end to end.
2. economy_sound: prices react to player actions, and there is no money pump. Try buying and immediately selling the same good, and repeating any cycle; profit from an instant round trip scores 0.
3. server_authority: money and rules are enforced on the server; inputs are validated (unknown goods, negative or huge quantities, malformed JSON); the client cannot set coins.
4. architecture: clear separation of game rules from HTTP and UI; readable, no dead code; rules testable without the server.
5. tests: automated tests exist, cover the economy rules and edge cases, and pass (`node --test`).
6. ux: feels like a game rather than a form: state is visible, actions give feedback, errors are explained to the player.

Reply with ONLY a JSON object: {"scores": {"playable_loop": n, "economy_sound": n, "server_authority": n, "architecture": n, "tests": n, "ux": n}, "total": n, "money_pump_found": true|false, "notes": "two sentences"}
