# Proposal: Extend Phase 13 live-evidence pattern to all visual-output skills

**Status: ✅ DONE — superseded by commit 45dbd69 (2026-05-01)**

Original proposal moved here on completion. Final scope and execution differed from draft:
- Phase 1 (svc-native skills): ✅ patched landing-page + design-ui
- Phase 2 (route-workflow post-hook): ✅ shipped — covers external addons (popup-cro, ad-creative, signup-flow-cro, paywall-upgrade-cro, page-cro, form-cro, onboarding-cro) without forking upstream
- Phase 3 (upstream PRs): SKIPPED — Phase 2 hook covers our use case, no upstream coordination needed
- Phase 4 (create-skill template): ✅ MANDATORY checklist added
- Phase 5 (validator): ✅ tier-1 `validate-visual-skills-have-live-evidence.sh` shipped, all 6 checks green

See commit 45dbd69 + `_shared/live-evidence.md` for the canonical artifact.
