---
disable-model-invocation: true
name: suno-architect
version: "1.0"
created: 2026-05-16
description: >
  Turn a Spotify playlist or theme into Suno AI song recipes or full album concepts with
  meta-tags, vocal commands and phonetic lyric mapping. Use when asked for Suno prompts,
  track recipes, lyric structure or credit-efficient song generation.
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
Turns a user's reference material (a Spotify playlist URL, artist list, or vibe description) and a theme into copy-paste-ready prompt packages for Suno AI v3.5, in **Single Track Mode** or **Album Mode** (a cohesive batch of songs). It uses meta-tags and phonetic transliteration rules that raise generation quality and cut wasted credits.

## Before Starting

Build a bounded context plan before producing recipes:

- Load the latest user prompt and any referenced playlist, artist list, draft lyrics, or target language requirements.
- When continuing an album or track set, check existing `suno-outputs/<project>/` files so titles, motifs, and vocal persona stay consistent.
- If the request depends on current Suno model behavior, pricing, credit rules, or UI controls, run `research` before presenting those facts as current.
- Read only the target project plus any explicitly referenced music/source artifacts, not unrelated output folders.

## Preflight

Before writing durable files:

- Resolve a project slug from the requested album, track, or theme.
- Decide whether the output is a direct chat answer or a saved recipe under `suno-outputs/<project>/`.
- If saving, check the target directory is writable and that existing tracks are only overwritten after an explicit continuation decision.
- Log uncertainty about current Suno model behavior as a research dependency rather than turning stale prompt lore into framework doctrine.

## Input
The user provides:
* **Reference material:** a Spotify playlist link, a list of tracks, or a genre description.
* **Theme/Direction:** what the song/album is about (e.g., "A Bulgarian album about self-finding, dark electronic vibe").
* **Language/Cultural target:** e.g., English, Bulgarian.
* **Scope (Count):** number of tracks (e.g., "1 song" or "a 5-track EP"). Defaults to 1.

## Process

### Step 1: Ingestion & Extraction
If the user gives a Spotify URL, retrieve track names and artists with WebFetch/WebSearch. Extract the core musical DNA: dominant genres and sub-genres, tempos (slow burners vs. high-energy club drops), typical instrumentation, vocal styling (breathy, raspy, female/male duets), and emotional pacing.

### Step 2: Synthesis & Album Pacing (If count > 1)
- For an album/EP, act as Executive Producer: **Track 1** is the atmospheric intro / scene-setter; **middle tracks** carry the core narrative with varied tempos (a high-energy banger, a stripped-down ballad); the **final track** is the grand finale / resolution.
- Give *each* track a cohesive title and a distinct sonic profile drawn from the source playlist's variety.
- **Hidden Lyrical Easter Eggs (Petar Dunov / Beinsa Douno):** subtly weave the philosophy, teachings, and famous phrases of the Bulgarian spiritual teacher Petar Dunov into the lyrics. Translate his core concepts (universal love, light, wisdom, truth, the rising sun, the seed growing) into the user's theme (e.g., his teachings of "Light" become "Neon/Code" in a Cyberpunk setting). Leave his name out of the lyrics, but let the poetry resonate with his teachings (e.g., adapting "Мисли добро, чувствай добро, прави добро" or "Бог е Любов, Мъдрост и Истина").

### Step 3: Application of Suno v3.5 Masterclass Rules (Per Track)
Apply these rules to every track:

* **The Style Box Bypass (120 chars max):** 4-7 anchor tags followed by `SEE <SONG_DETAILS> IN LYRICS.` — e.g. `Bulgarian Pop-Folk, 120 BPM, Female Vocals, Dark Electronic. SEE <SONG_DETAILS> IN LYRICS.`

* **The `<SONG_DETAILS>` Meta-Block:** at the very top of the Lyrics box, with `[GENRES: ...]`, `[SOUNDS LIKE: ...]`, `[STYLE: ...]`, `[MOOD: ...]`, `[VOCALS: ...]`, `[ARRANGEMENT: ...]`, `[TEMPO: ...]`, `[PRODUCTION: ...]`, `[STRUCTURE: ...]`, `[DYNAMICS: ...]`, `[EMOTIONS: ...]`.

* **Advanced Meta-Tags & Structure (The "Code Word" Strategy):**
   - Leave exactly one blank line between bracketed tags and the lyrics.
   - **Code Word Meta-Tags:** in place of generic names like `[Verse]` or `[Chorus]`, use short, powerful code words separated by pipes (`|`), e.g. `[Light | Wisdom | Build]` or `[Truth | Clarity | Staccato]`.
     - **Why this works:** the code words are both structural markers for Suno and hidden philosophical directives (Petar Dunov's teachings). Suno reads emotional/conceptual words as vibe modifiers for that block's singing style, which fixes boring/robotic transitions.
     - **Example replacement:** `[Verse: Whispered]` → `[Soul | Whisper | Solitude]`; `[Chorus]` → `[Love | Ethereal | Power]`.
   - **Atmospheric Spoken Preludes:** the user likes Suno speaking/whispering a short word before a sung line.
     - **Scripting spoken words:** Suno tries to sing everything, and treats parenthesized words as ad-libs. To make it *speak* or *whisper* a short symbolic word (from Petar Dunov's teachings), break the lyric block: put `[Spoken Word | Whisper]` on its own line, then the raw word with no parentheses (e.g., `Любов`), then an empty line, then the sung section's tag.
     - **Example Structure:**
       `[Spoken Word | Whisper]`
       `Любов`

       `[Разум | Истина | Rhythmic]`
       `В тези кабели тече една безкрайна сила`
   - Use `[Instrumental Break]` to force solos, or disguise it as a code-word tag like `[Silence | Flow | Instrumental]`.
   - End with `[Stop]`.
   - Follow the **4-Line Rule**: verses and choruses in blocks of 4 lines for best rhythm parsing, without periods/commas at line ends.

* **Bulgarian Phonetic Hack (If Applicable):**
   - For Bulgarian (or when Cyrillic fails the user), provide a transliterated Latin-script version of the lyrics using these phonetic rules:
     - "Ъ" = `uh` or `er`
     - Break consonant clusters with hyphens (e.g., `z-drahv`).
     - "Щ" = `sh-t` or `sht`
     - "А"=`ah`, "Е"=`eh`, "Ж"=`zh`, "Х"=`kh`, "Ц"=`ts`, "Я"=`yah`, "Ю"=`you`
   - *Note on Albums:* for large albums, output Cyrillic plus a smaller "phonetic cheat sheet" for the chorus, or fully phonetic lyrics if the user asks for maximum safety.

### Step 5: Suno UI Sliders & Advanced Toggles (v4.5 / v5)
Suno's newer models lean heavily on generation sliders, so prescribe these per track from the desired vibe:
* **Vocal Gender & Persona Locking:** Suno often ignores `[female vocal]` or flips gender mid-duet. Tell the user to lock the vocal identity across the album with the **"Persona"** feature (or generate a base track and use **"Cover"**).
* **Weirdness Slider:**
   - `10% - 30%`: safe, predictable structure (best for standard Pop/House).
   - `40% - 60%`: creative flair without breaking the song.
   - `70% - 80%`: highly experimental, risky but good for Cyberpunk/Avant-garde.
   - *Warn the user:* 100% Weirdness often causes "radio static" or structural collapse.
* **Style Influence:**
   - `High (80%+)`: strict obedience to the Style Box tags (use when the AI ignores genres).
   - `Mid (50%)`: balances your tags with the model's natural creativity.

## Output Format

### If Album Mode (count > 1):
First output the **Album Tracklist & Vibe Check**, with bullet points rather than track numbers:
```markdown
## 💽 Album Concept: [Album Name]
**Concept:** [Brief description of the album narrative]

* **[Track Name]** - [Brief vibe: e.g., Ambient Intro, 90 BPM]
* **[Track Name]** - [Brief vibe: e.g., High-energy club drop, 128 BPM]
...
```
Then output the track recipes. On huge albums, to stay within output limits, fully detail the first 2-3 tracks and ask whether to flesh out the rest (or generate them all if they are short).

### The Recipe Format (Per Track):
Headers and lines carry no leading numbers ("1. Style", "Track 1"), and structural tags carry none either (`[Verse]`, not `[Verse 1]`) — see the Zero Numbers Rule below. Use bullet points or plain headers.

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
Start no line with a number, anywhere in the output. Users copy-paste whole blocks into Suno, and Suno sings any numbers it finds. Numbered lists are a strong formatting habit, so check for them before finishing: use bullet points (`*` or `-`) and unnumbered bold headers only.

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
