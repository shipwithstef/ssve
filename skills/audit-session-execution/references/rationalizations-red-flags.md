## Rationalization Table

| Thought | Reality |
|---|---|
| "The transcript is enough" | It is not. Start from WI + lane-task graph + decision log. |
| "The user corrected it, so that's fine" | A user correction is evidence of drift, not proof the framework worked. |
| "I can estimate tokens exactly from file length" | You cannot. Tag as `ESTIMATED` unless the tool exposed counts. |
| "Everything bad here is a framework gap" | No. Separate project truth, agent failure, and framework failure. |
| "This session felt messy, that's enough" | Feelings are not findings. Every claim needs file or transcript evidence. |
| "I should jump straight to improve-framework" | Not unless the framework gap is already concrete. This skill exists to make it concrete. |

## Red Flags

- Report has no Expected vs Actual matrix
- Token section states exact numbers without a source
- Findings mix project defects and framework defects in one bucket
- Framework gap section repeats something already locked as fixed in `FRAMEWORK-STATE.md`
- Transcript was read first even though WI/task graph existed
- Transcript was marked unavailable without a host-trace search
