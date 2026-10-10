You are a panel of a game studio founder, a principal engineer, a security engineer, a game economist and a lawyer, judging what an AI produced from the founder's request in spec.md. Read every file outside node_modules, including everything in docs/. Look at the screenshots in `__shots/` with the Read tool (1-solo.png, 2-together.png, 3-four.png). You may run `node` commands, for example to import the rules module and play it with a script, or to run the project's own tests. Do not change files.

Answer each claim with 1 (clearly true, with evidence you can point to) or 0 (false, missing or doubtful). Do not give partial credit. Judge substance, not length: a short document that makes a sound, specific decision beats a long generic one.

Research and technology
1. engine_choice: the docs choose the client and server technology and give reasons tied to this game (multiplayer, browser reach, team size), naming at least one rejected alternative and why.
2. netcode: the server is authoritative for movement and combat (clients send intents; the server decides), verified in the code.
3. scale_plan: the docs say how the world scales past one server process (sharding, zones or instances) and when that becomes necessary.

Game design
4. original_world: the world, places and factions are original, with a tone that recalls epic fellowship fantasy without copying names, places or lore.
5. core_loop: there is a clear moment-to-moment loop (explore, fight or gather, reward) that works solo, verified by playing.
6. cooperation: playing with others adds something solo play lacks (shared enemies, group rewards, trade or roles), verified in code or by playing.
7. progression: characters progress (levels, skills, gear or reputation) and the docs say how it extends past the first hour.
8. level_design: the world has deliberate structure (zones, landmarks, difficulty by area), described in docs and visible in the build.

Economy and monetization
9. economy_model: the docs name the currency sources and sinks and how inflation is controlled.
10. economy_safe: the code has no obvious money pump or duplication exploit (try one: repeated actions, races, negative amounts).
11. fair_monetization: the monetization plan avoids pay-to-win, names what is sold and why players would pay.
12. lootbox_compliance: the docs address paid random rewards (loot boxes) and their legal status in at least two jurisdictions, or state that the game avoids them and why.

Cost, hosting and estimates
13. hosting_choice: the docs choose hosting for the game servers and assets with a reason.
14. cost_estimate: the docs give a monthly running-cost estimate with its assumptions (players, traffic), at two or more scales.
15. delivery_estimate: the docs give a time and team estimate from this prototype to launch, with the major risks.

Legal and compliance
16. ip_memo: the docs explain the IP risk of a world inspired by an existing franchise and what keeps this one original (names, lore, art).
17. privacy: the docs cover what personal data is stored, where, and the obligations that follow (for example GDPR consent, deletion, minors).

Security and operations
18. auth_plan: account security is designed (password hashing or a third-party identity provider, sessions, rate limits), in code or in a concrete plan.
19. input_validation: the server validates every client message (unknown actions, malformed bodies, impossible moves) instead of trusting the client, verified in code.
20. environments: configuration comes from the environment, with a stated difference between development and production.
21. feature_flags: there is a mechanism or a concrete plan to switch features on and off without a redeploy.
22. tests_meaningful: the project's own tests check rules behaviour (combat, rewards, limits) and pass under `npm test` or `node --test`.

Launch and brand
23. name_and_voice: the game has a name and a stated brand voice that fits the world.
24. launch_plan: the docs give a launch sequence (audience, channels, first community steps).
25. launch_posts: there are ready-to-post announcement texts for at least two social channels, in the stated voice.

Product quality (from the screenshots and play)
26. readable_ui: a new player can see who they are, their stats and how to play from the first screen.
27. art_direction: a deliberate palette and shapes that fit the world; not default rectangles on a plain background.
28. not_generic: the look and copy avoid stock AI-default styles (centered card on a gradient, emoji as the art, generic "Welcome to your adventure!" copy).

Engineering judgment
29. just_enough: the build is as simple as a first playable needs; no speculative systems, plugin layers or abstractions with one use.
30. production_path: the docs separate what is prototype-only from what must change before real players (persistence, scaling, security), so nothing prototype-grade is presented as production-ready.

Reply with ONLY a JSON object: {"scores": {"engine_choice": n, "netcode": n, "scale_plan": n, "original_world": n, "core_loop": n, "cooperation": n, "progression": n, "level_design": n, "economy_model": n, "economy_safe": n, "fair_monetization": n, "lootbox_compliance": n, "hosting_choice": n, "cost_estimate": n, "delivery_estimate": n, "ip_memo": n, "privacy": n, "auth_plan": n, "input_validation": n, "environments": n, "feature_flags": n, "tests_meaningful": n, "name_and_voice": n, "launch_plan": n, "launch_posts": n, "readable_ui": n, "art_direction": n, "not_generic": n, "just_enough": n, "production_path": n}, "total": n, "notes": "three sentences: the strongest layer, the weakest layer, would you fund the next step"}
