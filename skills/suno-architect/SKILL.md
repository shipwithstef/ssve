---
disable-model-invocation: true
name: suno-architect
version: "1.0"
created: 2026-05-16
description: >
  Converts Spotify playlists and thematic prompts into highly calibrated Suno AI
  song recipes or full album concepts, including meta-tags, vocal commands, and
  multi-language phonetic mappings. Use when the user asks for Suno prompts,
  albums, track recipes, lyric structure, or credit-efficient song generation.
inputs:
  required:
    - { path: "(user prompt)", artifact: song-brief }
  optional:
    - { path: "docs/specs/music/<name>/brief.md", artifact: saved-song-brief }
    - { path: "docs/specs/music/<name>/references.md", artifact: music-references }
    - { path: "docs/specs/music/<name>/lyrics.md", artifact: draft-lyrics }
    - { path: "(fresh research notes if current Suno behavior matters)", artifact: suno-research }
outputs:
  produces:
    - { path: "(direct response or suno-outputs/<project>/<track>.txt)", artifact: suno-recipe }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# Suno Architect

**Announce at start:** "I'm using the suno-architect skill to design your custom Suno AI song structure."

## Purpose
This skill transforms a user's reference material (e.g., a Spotify playlist URL, artist list, or vibe description) and a desired theme into perfectly formatted, production-ready prompt packages for Suno AI v3.5. It can operate in **Single Track Mode** or **Album Mode** (generating a cohesive batch of songs). It leverages advanced, undocumented meta-tags and precise phonetic transliteration rules to guarantee high-quality generation and minimize wasted credits.

## Before Starting

Build a bounded context plan before producing recipes:

- Load the latest user prompt and any referenced playlist, artist list, draft lyrics, or target language requirements.
- Check existing `suno-outputs/<project>/` files when continuing an album or track set so titles, motifs, and vocal persona remain consistent.
- If the request depends on current Suno model behavior, pricing, credit rules, or provider UI controls, run `research` before presenting those facts as current.
- Do not bulk-read unrelated output folders. Read only the target project plus any explicitly referenced music/source artifacts.

## Preflight

Verify the target output path before writing durable files:

- Resolve a project slug from the user's requested album, track, or theme.
- Confirm whether the output is a direct chat answer or a saved recipe under `suno-outputs/<project>/`.
- If saving files, check that the target directory is writable and that existing tracks will not be overwritten without an explicit continuation decision.
- Log uncertainty about current Suno model behavior as a research dependency instead of turning stale prompt lore into framework doctrine.

## Input
The user provides:
* **Reference material:** A Spotify playlist link, a list of tracks, or a genre description.
* **Theme/Direction:** What the song/album should be about (e.g., "A Bulgarian album about self-finding, dark electronic vibe").
* **Language/Cultural target:** e.g., English, Bulgarian.
* **Scope (Count):** Number of tracks (e.g., "1 song" or "a 5-track EP"). Defaults to 1 if unspecified.

## Process

### Step 1: Ingestion & Extraction
- If the user provides a Spotify URL, use WebFetch/WebSearch to retrieve the track names and artists.
- Analyze the reference material to extract the core musical DNA:
  - Dominant genres & sub-genres
  - Tempos (e.g., slow burners vs. high-energy club drops)
  - Typical instrumentation
  - Vocal styling (e.g., breathy, raspy, female/male duets)
  - Emotional pacing

### Step 2: Synthesis & Album Pacing (If count > 1)
- If generating an album/EP, act as an Executive Producer:
  - **Track 1:** The atmospheric intro / scene-setter.
  - **Middle Tracks:** The core narrative, varying tempos (e.g., a high-energy banger, a stripped-down ballad).
  - **Final Track:** The grand finale / resolution.
- Define a cohesive title and distinct sonic profile for *each* track based on the source playlist's variety.
- **Hidden Lyrical Easter Eggs (Petar Dunov / Beinsa Douno):** Subtly weave the philosophy, teachings, and famous phrases of the Bulgarian spiritual teacher Petar Dunov into the lyrics. Translate his core concepts (universal love, light, wisdom, truth, the rising sun, the seed growing) into the context of the user's theme (e.g., mapping his teachings of "Light" to "Neon/Code" in a Cyberpunk setting). Do not explicitly state his name in the lyrics, but make the poetry resonate deeply with his teachings (e.g., adapting "Мисли добро, чувствай добро, прави добро" or "Бог е Любов, Мъдрост и Истина").

### Step 3: Application of Suno v3.5 Masterclass Rules (Per Track)
For EVERY track generated, you MUST apply the following rules:

* **The Style Box Bypass (120 chars max):**
   - Provide 4-7 anchor tags followed by: `SEE <SONG_DETAILS> IN LYRICS.`
   - Example: `Bulgarian Pop-Folk, 120 BPM, Female Vocals, Dark Electronic. SEE <SONG_DETAILS> IN LYRICS.`

* **The `<SONG_DETAILS>` Meta-Block:**
   - Place this at the absolute top of the Lyrics box output.
   - Include: `[GENRES: ...]`, `[SOUNDS LIKE: ...]`, `[STYLE: ...]`, `[MOOD: ...]`, `[VOCALS: ...]`, `[ARRANGEMENT: ...]`, `[TEMPO: ...]`, `[PRODUCTION: ...]`, `[STRUCTURE: ...]`, `[DYNAMICS: ...]`, `[EMOTIONS: ...]`

* **Advanced Meta-Tags & Structure (The "Code Word" Strategy):**
   - Always leave exactly ONE blank line between bracketed tags and the lyrics.
   - **Code Word Meta-Tags:** Instead of using generic structural names like `[Verse]` or `[Chorus]`, use short, powerful code words separated by pipes (`|`). For example: `[Light | Wisdom | Build]` or `[Truth | Clarity | Staccato]`.
     - **Why this works:** These code words act as both structural markers for Suno AND hidden philosophical directives (e.g., Petar Dunov's teachings). Suno's engine interprets these emotional/conceptual words as vibe modifiers for the singing style of that block, solving the problem of boring/robotic transitions.
     - **Example replacement:** Instead of `[Verse: Whispered]`, use `[Soul | Whisper | Solitude]`. Instead of `[Chorus]`, use `[Love | Ethereal | Power]`.
   - **Atmospheric Spoken Preludes:** The user actively LIKES when Suno speaks/whispers a short word before singing a line.
     - **CRITICAL SCRIPTING FOR SPOKEN WORDS:** Suno wants to sing everything. To force it to *speak* or *whisper* short, powerful symbolic words (based on Petar Dunov's teachings) without trying to integrate them into the melody or treating them as ad-libs, you MUST break the lyric block. Insert `[Spoken Word | Whisper]` on its own line, followed by the raw word WITHOUT parentheses (e.g., `Любов`), followed by an empty line, and then the actual sung section tag. DO NOT USE PARENTHESES.
     - **Example Structure:**
       `[Spoken Word | Whisper]`
       `Любов`

       `[Разум | Истина | Rhythmic]`
       `В тези кабели тече една безкрайна сила`
   - Use `[Instrumental Break]` to force solos, or disguise it as a code word tag like `[Silence | Flow | Instrumental]`.
   - Use `[Stop]` at the very end.
   - Follow the **4-Line Rule**: keep verses and choruses in blocks of 4 lines for best rhythm parsing. Remove standard periods/commas at the end of lines.

* **Bulgarian Phonetic Hack (If Applicable):**
   - If the user requests Bulgarian (or if Cyrillic fails them), you MUST provide a transliterated Latin-script version of the lyrics utilizing the phonetic rules:
     - "Ъ" = `uh` or `er`
     - Break consonant clusters with hyphens (e.g., `z-drahv`).
     - "Щ" = `sh-t` or `sht`
     - "А"=`ah`, "Е"=`eh`, "Ж"=`zh`, "Х"=`kh`, "Ц"=`ts`, "Я"=`yah`, "Ю"=`you`
   - *Note on Albums:* For large albums, you can output Cyrillic and provide a smaller "phonetic cheat sheet" for the chorus, OR output fully phonetic lyrics if the user specifically requests maximum safety.

### Step 5: Suno UI Sliders & Advanced Toggles (v4.5 / v5)
Suno's newer models rely heavily on generation sliders. For each track, you MUST prescribe these settings based on the desired vibe:
* **Vocal Gender & Persona Locking:** Suno is notorious for ignoring `[female vocal]` or flipping gender mid-duet. Instruct the user to use the **"Persona"** feature (or generate a base track and use **"Cover"**) to lock the vocal identity across the entire album.
* **Weirdness Slider:**
   - `10% - 30%`: Safe, predictable structure (Best for standard Pop/House).
   - `40% - 60%`: Good for adding creative flair without breaking the song.
   - `70% - 80%`: Highly experimental, risky but good for Cyberpunk/Avant-garde.
   - *Warn the user:* 100% Weirdness often causes "radio static" or structural collapse.
* **Style Influence:**
   - `High (80%+)`: Forces the AI to strictly obey the Style Box tags (use when the AI is ignoring genres).
   - `Mid (50%)`: Balances your tags with the model's natural creativity.

## Output Format

### If Album Mode (count > 1):
First, output the **Album Tracklist & Vibe Check**. DO NOT use numbers (1, 2, 3) for the tracks. Use bullet points:
```markdown
## 💽 Album Concept: [Album Name]
**Concept:** [Brief description of the album narrative]

* **[Track Name]** - [Brief vibe: e.g., Ambient Intro, 90 BPM]
* **[Track Name]** - [Brief vibe: e.g., High-energy club drop, 128 BPM]
...
```
Then, output the recipes for the tracks. (To save output limits on huge albums, you may provide fully detailed recipes for the first 2-3 tracks and ask the user if they want the remaining tracks fleshed out, or generate them all if they are short).

### The Recipe Format (Per Track):
**CRITICAL INSTRUCTION FOR OUTPUT:** DO NOT use numbers in front of ANY markdown headers or lines (e.g., do not write "1. Style" or "Track 1"). Users copy-paste the whole block, and Suno will sing the numbers. Do NOT use numbers inside structural tags (e.g., use `[Verse]` instead of `[Verse 1]`). Everything must be bullet points or plain headers.

```markdown
### 🎵 Track: [Song Title]

**Style of Music Box:**
`[4-7 tags]. SEE <SONG_DETAILS> IN LYRICS.`

**Generation Settings (Suno v4.5/v5 Sliders):**
*   **Weirdness:** [e.g., 25% (Keep it stable)]
*   **Style Influence:** [e.g., 75% (Force the Synthwave)]
*   **Persona / Vocal Lock:** [e.g., Use "Persona" feature to lock a raspy male voice]

**Lyrics Box (Copy the code block below):**
~~~text
<SONG_DETAILS>
[GENRES: ...]
[STYLE: ...]
...
</SONG_DETAILS>

[Light | Awakening | Instrumental]
[Instrumental]

[Truth | Reason | Staccato]
Мъдрост ...
...
[Stop]
~~~

**Calibration Guidelines:**
Provide 2-3 bullet points telling the user what to tweak if the AI gets something wrong (e.g., "If Track rushes the vocals, add hyphens between syllables", or "If the song devolves into static, drop the Weirdness slider to 15%").
```

## ZERO NUMBERS RULE
**ABSOLUTE DIRECTIVE:** As an AI, you have a strong bias toward formatting lists with numbers (1., 2., 3.). You MUST override this bias. DO NOT use numbers to start lines. If you use numbers, the user will accidentally copy them into Suno, and Suno WILL sing the numbers. Use bullet points (`*` or `-`) and unnumbered bold headers ONLY.

## Self-Verify

Before declaring done, verify:

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Output matches requested scope | Confirm single-track vs album mode and requested language/theme are reflected in the recipe set | |
| 2 | Suno copy-paste blocks are clean | No numbered list prefixes appear inside Style or Lyrics copy blocks | |
| 3 | Provider-current claims are grounded | Any claim about current Suno model, UI, credit, or pricing behavior is cited from fresh research or marked as assumption | |
| 4 | Saved outputs are deliberate | If files are written, paths are under `suno-outputs/<project>/` and existing files were not overwritten silently | |
| 5 | Continuation state handled | Task graph status is updated when a graph exists; otherwise output is returned directly with no fake lane state | |

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`):

- Treat `Invoke: /suno-architect` in the task description and `metadata.skill` as routing instructions, not explanatory prose.
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume.
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`.
- Mark this skill's task `completed` in `.svc/lane-tasks-<WI>.json` before leaving the skill, then update the host-specific mirror.
- If the recipe output creates a follow-up implementation or publishing task, route back through `route-workflow` instead of inventing an implicit next skill.

If no task graph exists, return the recipe or saved paths directly and do not create lane state.
