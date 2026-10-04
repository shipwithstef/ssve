# SSVE skill audit — 2026-10-03

Decision: **disable none**. All 106 source skills have incoming textual references; 19 have no observed Claude invocation or targeted Codex read. Incomplete retention, other-host evidence and owner provenance prevent calling those skills unused. Preserve the review/receipt chain. Trial narrower descriptions before considering consolidation.

Scope: analysis only; this document is the sole output. Root `S=/home/dianast/app-workspaces/ssve`; HEAD `305c20d54106c4a6f3d634e1f364da4e1bf96b08` (tracked source clean). SHA-256 of sorted `relative-path + NUL + bytes` for `skills/*/SKILL.md`: `f9f3b001383fea46aee3c214a40c025991415a58e82caa03ac715ef5adef0547`.

**Evidence and counting rules**

- Window: **2026-08-04 16:10:36 ≤ event UTC < 2026-10-03 16:10:36** (60 days; excludes this audit). Scan all projects, not only SSVE. Claude: 15 JSONL files / 14 unique sessions, retained events Sep 28–Oct 3. Codex: 1,354 files / 1,353 sessions before cutoff, retained events Aug 23–Oct 3. Earlier days are unobserved, not confirmed zero-use.
- Claude counts deduplicate `tool_use.id`, inspect `name=Skill` input `skill`/`name`, plus anchored user slash/`<command-name>` invocations. Its three Skill calls are foreign (`claude-api`, `plugin-authoring`, `loop`); **zero SSVE calls/slashes found**. No targeted SSVE body reads passed the read filter.
- Codex has no equivalent Skill event here. **`r` means targeted SKILL.md read attempts, NOT proven workflow executions**: deduplicate `call_id`; inspect function/custom calls and embedded shell read segments (`cat`, `sed`, `head`, `tail`, file-read tools). Separate pipes/commands; exclude grep results, catalogs, tool outputs and bare mentions. Count each skill once per call. Dynamic/glob reads may be missed; failures and audit reads may be included. Exact invocation totals are unknown. Five explicit `/route-workflow` requests are separate from its read count.
- Cursor: 989 readable `agent-transcripts/**/*.jsonl` exports inspected; tool reads provide supporting evidence (`U`), but exports lack event timestamps, so they are excluded from 60-day counts. Its 963 chat databases were not decoded. AGY: 145 `brain/**/transcript_full.jsonl` exports inspected; 69 dated `File Path: …/<skill>/SKILL.md` view receipts (`A`), excluding chunk mirrors. Binary-only history/other machines remain unknown.
- References: exact identifier boundaries in other SKILL.md files, rules, framework/skill-local scripts, hooks and references; exclude own package. Counts are distinct files: `K/R/S/H/D` respectively. `D` includes registries; textual hits (especially ordinary words like research) are not all executable dependencies. Manifest membership alone is not usage. Named-user hits were searched separately from instruction/catalog blocks; `O` is a protective hit, not proof of a human-authored invocation. Missing `O` does not prove owner indifference.
- Table token column is **source description / observed Claude description**, each approximately `ceil(characters/4)`; excludes name/path/wrapper/body tokens. Skill links point directly to declared triggers. `–` means absent from captured listing; `0` means name-only. `X/*suffix:line` identifies the unique file recursively under `~/.codex/sessions`; `A` means `~/.gemini/antigravity-cli/brain`. Every zero is limited to this corpus/filter.

**What Claude actually exposes**

`L=~/.claude/projects/-home-dianast-app-workspaces-novisenti/6f0343ba-6f5e-4731-a94d-1256048ae265.jsonl`, lines 26, 110, 567, 598, 810, 867, 2007: seven distinct skill-listing records in **one** session, duplicated initially under the hourshub-port project path. All 102 non-DMI SSVE names appear in every one of these listings; 49 initially have descriptions (~5,117 tokens), later 47 (~5,041). The table gives their observed description range.

**No SSVE skill is demonstrated to be listed in every Claude session's system prompt.** Nine sessions have prompt snapshots; eight have no SSVE skill catalog, one has the separate listing attachments above; five lack snapshots. Do not multiply one interactive catalog by all sessions. `grow-social`, `suno-architect`, `svc-advisor`, `wsl2-audio` already declare `disable-model-invocation: true` and are absent from that listing. Full source descriptions total ~10,890 tokens (~10,395 excluding those four); this is a source ceiling, not measured session spend.

| Skill (declared trigger) | Invocations Claude / Codex†, last 60d | Referenced by (files; example under S) | Description tokens source / Claude | Verdict | Evidence |
|---|---:|---|---:|---|---|
| [ad-video-script](/home/dianast/app-workspaces/ssve/skills/ad-video-script/SKILL.md:4) | 0 / 7r | K2/D5; `K(grow-social):13` | 223 / 223 | needs-owner | X/*d4e945ea7ae9.jsonl:51; A3; U4 |
| [align-feature](/home/dianast/app-workspaces/ssve/skills/align-feature/SKILL.md:18) | 0 / 6r | K3/S2/D3; `K(decide):43` | 151 / 151 | keep | X/*a75472558026.jsonl:1085; U36 |
| [analyze-competitors](/home/dianast/app-workspaces/ssve/skills/analyze-competitors/SKILL.md:4) | 0 / 0r | K23/S8/D24; `K(assess-market-readiness):19` | 135 / 135 | needs-owner | no C/X read hit; U1 |
| [analyze-domain](/home/dianast/app-workspaces/ssve/skills/analyze-domain/SKILL.md:4) | 0 / 1r | K8/S5/D16; `K(analyze-competitors):11` | 138 / 138 | needs-owner | X/*ed7edf6ffddc.jsonl:531; A1; U1 |
| [analyze-marketing](/home/dianast/app-workspaces/ssve/skills/analyze-marketing/SKILL.md:7) | 0 / 5r | K4/S1/D11; `K(validate-feature):954` | 161 / 161 | needs-owner | X/*8f28c73f9b3f.jsonl:2754; A1; U1 |
| [assess-market-readiness](/home/dianast/app-workspaces/ssve/skills/assess-market-readiness/SKILL.md:4) | 0 / 2r | K2/R1/S1/D8; `K(capability-concierge):71` | 150 / 150 | needs-owner | X/*580902f29a84.jsonl:17444 |
| [audit-ac](/home/dianast/app-workspaces/ssve/skills/audit-ac/SKILL.md:4) | 0 / 5r | K12/S5/D14; `K(write-e2e):101` | 111 / 111 | keep | X/*606fff5e3732.jsonl:644 |
| [audit-coverage](/home/dianast/app-workspaces/ssve/skills/audit-coverage/SKILL.md:4) | 0 / 2r | K3/R1/S1/H1/D11; `K(onboard-repo):19` | 152 / 152 | needs-owner | X/*a9b96440acb9.jsonl:30 |
| [audit-feature](/home/dianast/app-workspaces/ssve/skills/audit-feature/SKILL.md:17) | 0 / 36r | K2/S3/D3; `K(decide):41` | 130 / 130 | keep | X/*278d568262df.jsonl:41; U3 |
| [audit-implementation](/home/dianast/app-workspaces/ssve/skills/audit-implementation/SKILL.md:6) | 0 / 399r | K15/R14/S20/D30; `K(execute-changeset):382` | 112 / 112 | keep | X/*7d03359ba41e.jsonl:15; O; U13 |
| [audit-session-execution](/home/dianast/app-workspaces/ssve/skills/audit-session-execution/SKILL.md:4) | 0 / 51r | R1/S5/H3/D13; `scripts/validate-task-graph-lane.mjs:159` | 130 / 130 | keep | X/*443db43ca25f.jsonl:13; A1; U1 |
| [base44-environment](/home/dianast/app-workspaces/ssve/skills/base44-environment/SKILL.md:4) | 0 / 0r | K1/R3/S4/H4/D8; `K(diagnose-bug):499` | 45 / 45 | needs-owner | no C/X read hit; O; U1 |
| [benchmark-landing](/home/dianast/app-workspaces/ssve/skills/benchmark-landing/SKILL.md:4) | 0 / 9r | K6/S2/D16; `K(verify-promotion):381` | 118 / 118 | needs-owner | X/*97932f0db62b.jsonl:5661; A3; U4 |
| [blend-external](/home/dianast/app-workspaces/ssve/skills/blend-external/SKILL.md:4) | 0 / 0r | K6/S1/D12; `K(improve-framework):178` | 101 / 101 | needs-owner | no C/X read hit; A1 |
| [blend-private](/home/dianast/app-workspaces/ssve/skills/blend-private/SKILL.md:4) | 0 / 0r | K1/S1/D6; `K(ingest-guide):152` | 110 / 110 | needs-owner | no C/X read hit; P1 |
| [blind-control-plan](/home/dianast/app-workspaces/ssve/skills/blind-control-plan/SKILL.md:6) | 0 / 12r | K1/S2/D4; `K(craft-prompt):32` | 145 / 145 | keep | X/*f102c200c095.jsonl:1174; U8 |
| [build-personas](/home/dianast/app-workspaces/ssve/skills/build-personas/SKILL.md:4) | 0 / 7r | K15/S7/H1/D13; `K(analyze-competitors):60` | 88 / 88 | needs-owner | X/*6d8c8e6e9a40.jsonl:2663 |
| [capability-concierge](/home/dianast/app-workspaces/ssve/skills/capability-concierge/SKILL.md:13) | 0 / 1r | K4/S3/D10; `K(honest-diagnosis):40` | 149 / 149 | needs-owner | X/*98ae53cc3f11.jsonl:989; U3 |
| [capability-registry](/home/dianast/app-workspaces/ssve/skills/capability-registry/SKILL.md:4) | 0 / 5r | K8/S3/H1/D8; `K(capability-concierge):26` | 150 / 150 | keep | X/*580902f29a84.jsonl:2157; O; U1 |
| [capture-idea](/home/dianast/app-workspaces/ssve/skills/capture-idea/SKILL.md:4) | 0 / 10r | K1/S3/D9; `K(validate-feature):826` | 97 / 97 | needs-owner | X/*1f74b7bb4e94.jsonl:210; U9 |
| [catalog-domain-capabilities](/home/dianast/app-workspaces/ssve/skills/catalog-domain-capabilities/SKILL.md:4) | 0 / 0r | K3/S3/H1/D8; `K(analyze-domain):339` | 119 / 119 | needs-owner | no C/X read hit; P1 |
| [comms](/home/dianast/app-workspaces/ssve/skills/comms/SKILL.md:4) | 0 / 2r | K2/S2/D10; `K(grow-social):12` | 37 / 37 | needs-owner | X/*ed7edf6ffddc.jsonl:120; A1; U1 |
| [cos](/home/dianast/app-workspaces/ssve/skills/cos/SKILL.md:4) | 0 / 4r | S2/D6; `scripts/company-state.mjs:34` | 39 / 39 | needs-owner | X/*8e33bd1bb406.jsonl:12551; O; A2; U26 |
| [counsel](/home/dianast/app-workspaces/ssve/skills/counsel/SKILL.md:4) | 0 / 8r | K3/S2/D11; `K(decide):195` | 33 / 33 | needs-owner | X/*a0cc2ab3b651.jsonl:14 |
| [craft-prompt](/home/dianast/app-workspaces/ssve/skills/craft-prompt/SKILL.md:7) | 0 / 4r | S1/D3; `scripts/prompt-floor-route.mjs:3` | 184 / 184 | needs-owner | X/*70efdb565f93.jsonl:3848 |
| [create-skill](/home/dianast/app-workspaces/ssve/skills/create-skill/SKILL.md:4) | 0 / 8r | K5/R1/S1/H1/D15; `K(ingest-guide-batch):5` | 136 / 136 | needs-owner | X/*279b0f3e5c0d.jsonl:1406; U1; M3 |
| [customer-cs](/home/dianast/app-workspaces/ssve/skills/customer-cs/SKILL.md:4) | 0 / 0r | K1/S1/D3; `K(revops):25` | 36 / 36 | needs-owner | no C/X read hit; P1 |
| [decide](/home/dianast/app-workspaces/ssve/skills/decide/SKILL.md:16) | 0 / 2r | K18/S13/H1/D27; `K(blind-control-plan):33` | 143 / 143 | needs-owner | X/*ed7edf6ffddc.jsonl:105; O |
| [define-code-style](/home/dianast/app-workspaces/ssve/skills/define-code-style/SKILL.md:4) | 0 / 0r | K4/S1/D7; `K(explore-solutions):69` | 117 / 117 | needs-owner | no C/X read hit; P1 |
| [design-logo](/home/dianast/app-workspaces/ssve/skills/design-logo/SKILL.md:11) | 0 / 1r | K2/D7; `K(generate-visuals):60` | 153 / 153 | needs-owner | X/*580902f29a84.jsonl:18901; U1 |
| [design-tech](/home/dianast/app-workspaces/ssve/skills/design-tech/SKILL.md:7) | 0 / 74r | K23/R1/S12/H4/D25; `K(track-visuals):69` | 39 / 39 | keep | X/*a399d57bb5e9.jsonl:1747; O; U5 |
| [design-ui](/home/dianast/app-workspaces/ssve/skills/design-ui/SKILL.md:14) | 0 / 57r | K13/S10/H2/D30; `K(track-visuals):9` | 40 / 40 | keep | X/*1aae1c22dd0b.jsonl:185; O; U3 |
| [design-ux](/home/dianast/app-workspaces/ssve/skills/design-ux/SKILL.md:18) | 0 / 21r | K18/S10/H2/D23; `K(design-tech):78` | 40 / 40 | keep | X/*418d6d55f49f.jsonl:16; O |
| [diagnose-bug](/home/dianast/app-workspaces/ssve/skills/diagnose-bug/SKILL.md:8) | 0 / 271r | K11/R2/S20/H3/D21; `K(manage-finops):110` | 89 / 89 | keep | X/*a399d57bb5e9.jsonl:1280; O; U13 |
| [discover-skills](/home/dianast/app-workspaces/ssve/skills/discover-skills/SKILL.md:4) | 0 / 1r | K2/R1/D10; `K(analyze-domain):33` | 76 / 76 | needs-owner | X/*8f28c73f9b3f.jsonl:711 |
| [discuss-phase](/home/dianast/app-workspaces/ssve/skills/discuss-phase/SKILL.md:4) | 0 / 1r | K2/D13; `K(design-tech):105` | 91 / 91 | needs-owner | X/*ed3950381ca1.jsonl:1009 |
| [dispatch-waves](/home/dianast/app-workspaces/ssve/skills/dispatch-waves/SKILL.md:4) | 0 / 51r | K3/S7/D8; `K(review-exec):386` | 114 / 114 | keep | X/*1eafd4532d38.jsonl:125; O; U4 |
| [evaluate-rule](/home/dianast/app-workspaces/ssve/skills/evaluate-rule/SKILL.md:4) | 0 / 3r | K3/S3/D6; `K(blend-external):519` | 152 / 152 | needs-owner | X/*ed7edf6ffddc.jsonl:26 |
| [evolve-framework](/home/dianast/app-workspaces/ssve/skills/evolve-framework/SKILL.md:4) | 0 / 2r | K9/R1/S5/H2/D8; `K(blend-external):202` | 70 / 70 | keep | X/*18b852a96e63.jsonl:14; A1 |
| [execute-changeset](/home/dianast/app-workspaces/ssve/skills/execute-changeset/SKILL.md:4) | 0 / 400r | K25/R5/S29/H6/D44; `K(track-visuals):10` | 57 / 57 | keep | X/*a399d57bb5e9.jsonl:2212; O; A1; U63 |
| [explore-solutions](/home/dianast/app-workspaces/ssve/skills/explore-solutions/SKILL.md:8) | 0 / 5r | K7/S5/H1/D14; `K(define-code-style):61` | 122 / 122 | needs-owner | X/*6a64e2f2cd44.jsonl:771 |
| [explore-ux](/home/dianast/app-workspaces/ssve/skills/explore-ux/SKILL.md:4) | 0 / 2r | K1/S1/D4; `K(propose-ux-improvements):7` | 149 / 149 | needs-owner | X/*8de6111c53a5.jsonl:2785 |
| [extract-bootstrap](/home/dianast/app-workspaces/ssve/skills/extract-bootstrap/SKILL.md:4) | 0 / 0r | K1/D7; `K(explore-solutions):139` | 90 / 90 | needs-owner | no C/X read hit |
| [fin-analyst](/home/dianast/app-workspaces/ssve/skills/fin-analyst/SKILL.md:4) | 0 / 3r | K1/S1/D4; `K(revops):25` | 34 / 34 | needs-owner | X/*d00c4431ff93.jsonl:16; U2 |
| [find-opportunity](/home/dianast/app-workspaces/ssve/skills/find-opportunity/SKILL.md:4) | 0 / 0r | K5/D10; `K(capability-concierge):87` | 98 / 98 | needs-owner | no C/X read hit; U9 |
| [generate-visuals](/home/dianast/app-workspaces/ssve/skills/generate-visuals/SKILL.md:4) | 0 / 1r | K3/D6; `K(landing-page):182` | 148 / 148 | needs-owner | X/*706a4ba2e988.jsonl:24; U2 |
| [grow-social](/home/dianast/app-workspaces/ssve/skills/grow-social/SKILL.md:5) | 0 / 7r | D3; `references/skill-routing-overrides.json:213` | 146 / – | needs-owner | X/*97932f0db62b.jsonl:5237; DMI |
| [growth-eng](/home/dianast/app-workspaces/ssve/skills/growth-eng/SKILL.md:4) | 0 / 3r | K1/S1/D3; `K(growth-lead):25` | 39 / 39 | needs-owner | X/*f04183414ae9.jsonl:15; U43 |
| [growth-lead](/home/dianast/app-workspaces/ssve/skills/growth-lead/SKILL.md:4) | 0 / 6r | K4/S2/D8; `K(grow-social):13` | 40 / 0–40 | needs-owner | X/*8f28c73f9b3f.jsonl:691; U4 |
| [honest-diagnosis](/home/dianast/app-workspaces/ssve/skills/honest-diagnosis/SKILL.md:11) | 0 / 0r | S2/D4; `scripts/honest-diagnosis.mjs:2` | 97 / 0 | needs-owner | no C/X read hit |
| [improve-framework](/home/dianast/app-workspaces/ssve/skills/improve-framework/SKILL.md:4) | 0 / 49r | K10/R1/S6/H3/D13; `K(blend-external):202` | 86 / 0 | keep | X/*9d4d92c236d9.jsonl:71; O; A1; U50 |
| [infra-sre](/home/dianast/app-workspaces/ssve/skills/infra-sre/SKILL.md:4) | 0 / 7r | S1/D4; `scripts/company-state.mjs:36` | 36 / 0–36 | needs-owner | X/*a4006abc6b32.jsonl:24 |
| [ingest-guide](/home/dianast/app-workspaces/ssve/skills/ingest-guide/SKILL.md:4) | 0 / 1r | K2/R1/S2/D6; `K(ingest-guide-batch):5` | 110 / 0 | needs-owner | X/*8f28c73f9b3f.jsonl:166 |
| [ingest-guide-batch](/home/dianast/app-workspaces/ssve/skills/ingest-guide-batch/SKILL.md:4) | 0 / 0r | D6; `references/model-routing.md:213` | 104 / 0 | needs-owner | no C/X read hit; M1 |
| [land-changeset](/home/dianast/app-workspaces/ssve/skills/land-changeset/SKILL.md:4) | 0 / 449r | K14/R1/S16/H1/D23; `K(execute-changeset):182` | 55 / 0 | keep | X/*a399d57bb5e9.jsonl:5748; O; A1; U37 |
| [landing-page](/home/dianast/app-workspaces/ssve/skills/landing-page/SKILL.md:4) | 0 / 13r | K11/S3/D14; `K(track-visuals):69` | 117 / 0 | needs-owner | X/*8f28c73f9b3f.jsonl:2754; O; A1 |
| [launch-knowledge](/home/dianast/app-workspaces/ssve/skills/launch-knowledge/SKILL.md:12) | 0 / 1r | S1/D11; `scripts/retrofit-skill-frontmatter.mjs:31` | 129 / 0 | needs-owner | X/*26ea0f660bbc.jsonl:1336; U3 |
| [list-work-items](/home/dianast/app-workspaces/ssve/skills/list-work-items/SKILL.md:4) | 0 / 4r | K1/R1/D7; `K(sync-work-items):92` | 48 / 0 | needs-owner | X/*dea5ce54ada5.jsonl:16; U13 |
| [manage-finops](/home/dianast/app-workspaces/ssve/skills/manage-finops/SKILL.md:6) | 0 / 22r | K5/R1/S4/D11; `K(design-tech):511` | 142 / 0 | needs-owner | X/*6a64e2f2cd44.jsonl:507 |
| [manage-learnings](/home/dianast/app-workspaces/ssve/skills/manage-learnings/SKILL.md:4) | 0 / 2r | K4/R1/S3/D11; `K(blend-external):315` | 71 / 0 | needs-owner | X/*ed7edf6ffddc.jsonl:230; U1 |
| [market-intel](/home/dianast/app-workspaces/ssve/skills/market-intel/SKILL.md:4) | 0 / 2r | K1/S2/D6; `K(growth-lead):25` | 36 / 0 | needs-owner | X/*8f28c73f9b3f.jsonl:701 |
| [mine-builder](/home/dianast/app-workspaces/ssve/skills/mine-builder/SKILL.md:4) | 0 / 2r | K3/D9; `K(verify-promotion):342` | 87 / 0 | needs-owner | X/*ed7edf6ffddc.jsonl:230; A1; U1 |
| [monetization-architecture](/home/dianast/app-workspaces/ssve/skills/monetization-architecture/SKILL.md:4) | 0 / 3r | K3/D9; `K(design-tech):755` | 125 / 0 | needs-owner | X/*e2d0a44afc60.jsonl:1838 |
| [onboard-repo](/home/dianast/app-workspaces/ssve/skills/onboard-repo/SKILL.md:4) | 0 / 4r | K7/R1/S4/H1/D12; `K(diagnose-bug):247` | 94 / 0 | needs-owner | X/*97085b2110cf.jsonl:411; O; A1; U6 |
| [plan-blast-radius](/home/dianast/app-workspaces/ssve/skills/plan-blast-radius/SKILL.md:4) | 0 / 9r | D6; `references/phase-receipts.md:259` | 153 / 0 | needs-owner | X/*ed7edf6ffddc.jsonl:120; U2 |
| [plan-capabilities](/home/dianast/app-workspaces/ssve/skills/plan-capabilities/SKILL.md:9) | 0 / 3r | K1/S3/H1/D6; `K(platform-operating-architect):130` | 106 / 0 | needs-owner | X/*98ae53cc3f11.jsonl:989 |
| [plan-changeset](/home/dianast/app-workspaces/ssve/skills/plan-changeset/SKILL.md:4) | 0 / 212r | K28/R1/S30/H5/D33; `K(blind-control-plan):8` | 53 / 0 | keep | X/*a399d57bb5e9.jsonl:1685; O; A5; U24 |
| [platform-operating-architect](/home/dianast/app-workspaces/ssve/skills/platform-operating-architect/SKILL.md:9) | 0 / 0r | K1/S1/D6; `K(launch-knowledge):124` | 145 / 0 | needs-owner | no C/X read hit; U1 |
| [privacy-dpo](/home/dianast/app-workspaces/ssve/skills/privacy-dpo/SKILL.md:4) | 0 / 23r | K1/S1/D6; `K(growth-eng):25` | 32 / 0 | keep | X/*a3b6c1f4f98c.jsonl:330 |
| [procurement](/home/dianast/app-workspaces/ssve/skills/procurement/SKILL.md:4) | 0 / 0r | S1/D14; `scripts/company-state.mjs:36` | 38 / 0 | needs-owner | no C/X read hit |
| [produce-ad-video](/home/dianast/app-workspaces/ssve/skills/produce-ad-video/SKILL.md:4) | 0 / 3r | K1/D5; `K(ad-video-script):13` | 134 / 0 | needs-owner | X/*279b0f3e5c0d.jsonl:6052; A2; U23 |
| [product-lead](/home/dianast/app-workspaces/ssve/skills/product-lead/SKILL.md:4) | 0 / 1r | S2/D5; `scripts/sync-native-agents.mjs:25` | 35 / 0 | needs-owner | X/*e2d0a44afc60.jsonl:61024 |
| [propose-ux-improvements](/home/dianast/app-workspaces/ssve/skills/propose-ux-improvements/SKILL.md:4) | 0 / 22r | S2/D3; `scripts/select-tier1-validators-v2.mjs:45` | 71 / 0 | needs-owner | X/*4f0fa13e5360.jsonl:43; U5 |
| [quick-fix](/home/dianast/app-workspaces/ssve/skills/quick-fix/SKILL.md:4) | 0 / 1r | K6/S11/H1/D12; `K(improve-framework):179` | 81 / 0 | needs-owner | X/*888befa8c429.jsonl:570; O; retired |
| [recall-stack-knowledge](/home/dianast/app-workspaces/ssve/skills/recall-stack-knowledge/SKILL.md:4) | 0 / 1r | K2/S2/D9; `K(mine-builder):810` | 95 / 0 | needs-owner | X/*2548d5fa4bb8.jsonl:3396; A1; U3 |
| [refresh-competitors](/home/dianast/app-workspaces/ssve/skills/refresh-competitors/SKILL.md:4) | 0 / 0r | K1/D10; `K(catalog-domain-capabilities):416` | 105 / 0 | needs-owner | no C/X read hit; M2 |
| [research](/home/dianast/app-workspaces/ssve/skills/research/SKILL.md:8) | 0 / 78r | K43/R6/S18/H5/D136; `K(assess-market-readiness):52` | 242 / 0 | keep | X/*64dda7ae43d5.jsonl:16; O; U54 |
| [reverse-engineer](/home/dianast/app-workspaces/ssve/skills/reverse-engineer/SKILL.md:4) | 0 / 0r | K1/D5; `K(strategic-decision):93` | 141 / 0 | needs-owner | no C/X read hit |
| [review-cross-model](/home/dianast/app-workspaces/ssve/skills/review-cross-model/SKILL.md:9) | 0 / 401r | K4/R3/S8/D18; `K(review-exec):9` | 124 / 0 | keep | X/*a399d57bb5e9.jsonl:3577; O; A1; U81 |
| [review-exec](/home/dianast/app-workspaces/ssve/skills/review-exec/SKILL.md:7) | 0 / 424r | K8/R1/S20/H1/D16; `K(execute-changeset):189` | 168 / 0 | keep | X/*d78fc0c6772e.jsonl:23; O; A2; U101 |
| [review-gate](/home/dianast/app-workspaces/ssve/skills/review-gate/SKILL.md:11) | 0 / 154r | K17/R15/S22/H1/D34; `K(execute-changeset):27` | 62 / 0 | keep | X/*a399d57bb5e9.jsonl:2699; O; A4; U17 |
| [review-plan](/home/dianast/app-workspaces/ssve/skills/review-plan/SKILL.md:9) | 0 / 352r | K12/S23/D18; `K(craft-prompt):32` | 167 / 0 | keep | X/*a399d57bb5e9.jsonl:2104; O; A6; U26 |
| [review-security](/home/dianast/app-workspaces/ssve/skills/review-security/SKILL.md:8) | 0 / 78r | K6/R3/S10/D15; `K(execute-changeset):343` | 80 / 0 | keep | X/*a399d57bb5e9.jsonl:1861; U2 |
| [revops](/home/dianast/app-workspaces/ssve/skills/revops/SKILL.md:4) | 0 / 0r | S2/D10; `scripts/sync-native-agents.mjs:34` | 35 / 0 | needs-owner | no C/X read hit |
| [roadmap-evaluation](/home/dianast/app-workspaces/ssve/skills/roadmap-evaluation/SKILL.md:4) | 0 / 8r | K6/R1/S1/D6; `K(capability-concierge):71` | 106 / 0 | needs-owner | X/*e2d0a44afc60.jsonl:54 |
| [route-workflow](/home/dianast/app-workspaces/ssve/skills/route-workflow/SKILL.md:4) | 0 / 644r | K70/R4/S28/H4/D38; `K(track-visuals):95` | 108 / 0 | keep | X/*260e5a878ba2.jsonl:23; O; U132; Q5 |
| [security-ops](/home/dianast/app-workspaces/ssve/skills/security-ops/SKILL.md:4) | 0 / 21r | S2/D5; `scripts/sync-native-agents.mjs:29` | 35 / 0 | keep | X/*011e5e6691f9.jsonl:75 |
| [stage-revenue](/home/dianast/app-workspaces/ssve/skills/stage-revenue/SKILL.md:4) | 0 / 0r | K4/D8; `K(capability-concierge):164` | 135 / 0 | needs-owner | no C/X read hit |
| [strategic-decision](/home/dianast/app-workspaces/ssve/skills/strategic-decision/SKILL.md:8) | 0 / 8r | R1/S2/H1/D10; `scripts/retrofit-skill-frontmatter.mjs:24` | 102 / 0 | needs-owner | X/*719f6066a36f.jsonl:14; U2 |
| [suno-architect](/home/dianast/app-workspaces/ssve/skills/suno-architect/SKILL.md:6) | 0 / 1r | K1/D3; `K(produce-ad-video):108` | 77 / – | needs-owner | X/*e81de70be85d.jsonl:39; DMI |
| [svc-advisor](/home/dianast/app-workspaces/ssve/skills/svc-advisor/SKILL.md:5) | 0 / 35r | K1/S1/H1/D8; `K(route-workflow):115` | 133 / – | keep | X/*a399d57bb5e9.jsonl:600; O; A15; U13; DMI |
| [sync-spec-code](/home/dianast/app-workspaces/ssve/skills/sync-spec-code/SKILL.md:4) | 0 / 11r | K16/S9/D13; `K(write-e2e):95` | 121 / 0 | keep | X/*2e8af320e799.jsonl:264; O |
| [sync-work-items](/home/dianast/app-workspaces/ssve/skills/sync-work-items/SKILL.md:4) | 0 / 8r | K6/R1/S1/D8; `K(list-work-items):59` | 60 / 0 | needs-owner | X/*ed7edf6ffddc.jsonl:531; U1 |
| [tax-auditor](/home/dianast/app-workspaces/ssve/skills/tax-auditor/SKILL.md:4) | 0 / 1r | S1/D3; `scripts/company-state.mjs:35` | 33 / 0 | needs-owner | X/*580902f29a84.jsonl:14391 |
| [teach-project](/home/dianast/app-workspaces/ssve/skills/teach-project/SKILL.md:4) | 0 / 5r | K2/R1/D6; `K(mine-builder):591` | 131 / 0 | needs-owner | X/*98ae53cc3f11.jsonl:1119; O |
| [test-framework](/home/dianast/app-workspaces/ssve/skills/test-framework/SKILL.md:4) | 0 / 2r | K11/R3/S25/H1/D28; `K(track-visuals):116` | 129 / 0 | keep | X/*8e33bd1bb406.jsonl:15333; O; U1 |
| [test-journeys](/home/dianast/app-workspaces/ssve/skills/test-journeys/SKILL.md:7) | 0 / 102r | K5/S10/D20; `K(verify-promotion):104` | 114 / 0 | keep | X/*a399d57bb5e9.jsonl:656; A9; U1 |
| [track-topology-diff](/home/dianast/app-workspaces/ssve/skills/track-topology-diff/SKILL.md:4) | 0 / 0r | D8; `references/phase-receipts.md:259` | 143 / 0 | needs-owner | no C/X read hit; A1; U1 |
| [track-visuals](/home/dianast/app-workspaces/ssve/skills/track-visuals/SKILL.md:4) | 0 / 74r | K15/R1/S11/H1/D27; `K(generate-visuals):56` | 117 / 0 | keep | X/*4b456746cccf.jsonl:86; U5 |
| [validate-feature](/home/dianast/app-workspaces/ssve/skills/validate-feature/SKILL.md:6) | 0 / 30r | K28/R2/S9/H1/D27; `K(analyze-competitors):400` | 92 / 0 | keep | X/*6d8c8e6e9a40.jsonl:211; O; U5 |
| [verify-promotion](/home/dianast/app-workspaces/ssve/skills/verify-promotion/SKILL.md:7) | 0 / 370r | K20/R3/S23/H1/D30; `K(track-visuals):124` | 55 / 0 | keep | X/*260e5a878ba2.jsonl:31; O; A2; U36 |
| [write-e2e](/home/dianast/app-workspaces/ssve/skills/write-e2e/SKILL.md:9) | 0 / 33r | K9/R3/S14/H1/D18; `K(verify-promotion):111` | 130 / 0 | keep | X/*a399d57bb5e9.jsonl:6358; O; U5 |
| [write-journeys](/home/dianast/app-workspaces/ssve/skills/write-journeys/SKILL.md:4) | 0 / 12r | K17/S7/H1/D13; `K(design-tech):743` | 120 / 0 | keep | X/*4fe127677c90.jsonl:113; A1 |
| [write-spec](/home/dianast/app-workspaces/ssve/skills/write-spec/SKILL.md:14) | 0 / 18r | K28/R1/S12/H2/D25; `K(design-tech):77` | 68 / 0 | keep | X/*f54031f4f6d3.jsonl:58; O; U8 |
| [write-vision](/home/dianast/app-workspaces/ssve/skills/write-vision/SKILL.md:4) | 0 / 6r | K9/S4/D13; `K(analyze-domain):10` | 111 / 0 | needs-owner | X/*e2d0a44afc60.jsonl:53050; O |
| [wsl2-audio](/home/dianast/app-workspaces/ssve/skills/wsl2-audio/SKILL.md:5) | 0 / 0r | K1/D6; `K(produce-ad-video):109` | 139 / – | needs-owner | no C/X read hit; DMI |

† `0 / 0r` is zero observed calls/reads, never a claim of zero true executions. `K(name):line` expands to `S/skills/name/SKILL.md:line`; `U` is undated Cursor supporting reads. `keep` protects the used pipeline/audit/security contracts; `needs-owner` preserves uncertain optional scope. No merge verdict is asserted from similarity alone.

**Cost and duplication findings**

- Catalog pressure is observed; harmful outcomes or monetary waste per skill are **not** established. Optional descriptions consume space while `route-workflow`, `plan-changeset`, `review-exec` and other frequently read core skills appear name-only in L. Broad trigger wording may compete for routing, but logs do not establish that it caused a bad decision.
- `quick-fix` is explicitly retired (`S/skills/quick-fix/SKILL.md:74–100`), yet remains installed and referenced. Treat it as a compatibility redirect; clarify metadata only after owner review. Its observed Claude description cost is already zero; deleting it cannot claim an 81-token saving in this catalog.
- Avoid treating `evolve-framework`/`improve-framework` as redundant: opportunity discovery versus implementing fixes. Likewise `audit-feature`/`align-feature`/`sync-spec-code` cover audit, remediation and spec synchronization. Review wrappers preserve distinct gates, receipts and reusable external-review calls. Keep those boundaries.

**Reversible action list — proposals only; nothing applied**

P0: leave every skill enabled as currently configured. No skill passes the requested disable test (zero use AND no incoming references AND not owner-named), and the missing history adds uncertainty. No hooks, rules, gates, source directories or installed links should be removed on this evidence.

P1: owner-reviewed **session-only name-only** trial, restricted to orchestration work that does not need these triggers. Incoming callers must still resolve the skills explicitly. Each command starts a fresh trial; restore by ending that trial and running the listed fresh baseline command in the same directory. Preserve any normal model/permission arguments; these examples change only skill visibility.

| Skill | Exact trial command | Restore command | Gross description space freed |
|---|---|---|---:|
| blend-private | `claude --settings '{"skillOverrides":{"blend-private":"name-only"}}'` | `claude` (new session without override) | ~110 tokens |
| catalog-domain-capabilities | `claude --settings '{"skillOverrides":{"catalog-domain-capabilities":"name-only"}}'` | `claude` (new session without override) | ~119 tokens |
| customer-cs | `claude --settings '{"skillOverrides":{"customer-cs":"name-only"}}'` | `claude` (new session without override) | ~36 tokens |
| define-code-style | `claude --settings '{"skillOverrides":{"define-code-style":"name-only"}}'` | `claude` (new session without override) | ~117 tokens |

Combined trial: `claude --settings '{"skillOverrides":{"blend-private":"name-only","catalog-domain-capabilities":"name-only","customer-cs":"name-only","define-code-style":"name-only"}}'`; restore: start `claude` without that flag. These four currently resolve as personal-skill symlinks into S, not plugin skills. Global and inspected SSVE project settings contain no skillOverrides; do not persist a new setting during the trial.

Mechanism verification: [Claude skill visibility](https://code.claude.com/docs/en/skills#override-skill-visibility-from-settings) documents `name-only` and `off`; [CLI settings](https://code.claude.com/docs/en/cli-reference) accepts inline JSON for one session. A future eligible disable uses the same command with `"off"` for that individually approved name; restore is a new baseline launch without the override. **Eligible disable names today: none.** Source archiving would affect shared symlinks and installer drift, so it is not the first trial mechanism.

P1 acceptance: compare fresh sessions with identical model, project, settings and prompt; capture `/context` Skills size and actual `skill_listing`. Verify required chain calls and explicit access to each trial skill still work. If relevant automatic routing worsens, end the trial and launch the baseline. No evaluation sessions or paid calls were launched by this audit.

M1 (`needs-owner`): investigate **ingest-guide-batch → ingest-guide batch mode**. Its description and body explicitly say it delegates per-guide work (`S/skills/ingest-guide-batch/SKILL.md:4,58–65`); preserve fan-out isolation, concurrency, failure handling and digest. Keep the old ID as a thin compatible entry until all callers migrate. No observed C/X reads for batch; source-description ceiling ~104 tokens, observed Claude saving **0**.

M2 (`needs-owner`): investigate **refresh-competitors → analyze-competitors refresh mode**, retaining scheduled invocation, state baselines, diff-only bounds and output paths. `S/skills/refresh-competitors/SKILL.md:61,75–100,197` explicitly separates refresh from discovery; this is shared implementation opportunity, not proven duplication. Ceiling ~105 tokens; observed Claude saving **0**. Do not merge if the distinct mode costs more or weakens the boundary.

M3 (`needs-owner`): compare **create-skill** with host `skill-creator` before any consolidation. Its description explicitly identifies the Anthropic fork with SSVE additions. Preserve manifest/install synchronization, chain receipts and project-skill creation; host implementations are not interchangeable. No token-saving claim without a measured common implementation and retained adapter.

For each future merge: use one dedicated reviewed commit, retain legacy IDs/paths until caller validation passes, and restore with `git revert <that-merge-commit>` followed by normal all-host convergence. Run relevant contract/manifest checks, the mandatory release suite and caller smoke tests before promotion. A source-body refactor alone saves no catalog tokens; retaining a full old description also saves none.

Expected savings: **0 applied; budget planning should assume 0 verified net tokens/session.** P1 frees ~382 description tokens (110+119+36+117) in the observed interactive catalog, ~7.6% of its latest SSVE description allocation. Net reduction may be 0–382 because budgeted catalogs can refill with other descriptions; this may improve core-skill visibility instead. Sessions without this catalog save 0. M1+M2 offer at most 209 source-description tokens before replacement text, and 0 in the captured catalog; do not add hypothetical savings to P1.

Limits: read attempts do not establish completion, cached prompt tokens do not equal full-price input, and per-turn repeated listings do not imply repeated uncached charges. Complete older retention, explicit owner pins and before/after prompt measurements are prerequisites for stronger removal or financial claims.
