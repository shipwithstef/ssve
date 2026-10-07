`status.json` records collector revision 20 on 2026-10-03 from this VM after the
CP2 liveness fix. Paths and session IDs are replaced; private launch/process
metadata is omitted. `status.ts` exports the same JSON because the isolated mod
test host loads TypeScript imports, not JSON/filesystem imports. Test variants
change specific fields (clock, dependencies, malformed state) explicitly.
