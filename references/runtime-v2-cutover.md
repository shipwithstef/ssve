# Runtime v2 Cutover Contract

Local validation can make the runtime `shadow-ready`; it cannot prove the direction-to-live SLO.
One explicitly authorized real Sample feature canary is measured from accepted owner direction
through production live verification against both limits: at least 24x faster than its evidence-backed
baseline and never more than 60 active engineering minutes. It also requires an executed rollback
proof. A passing first canary may set `slo_status=CANARY_PASS`, but it does not enable default
cutover. Default admission additionally requires high-confidence measured p95 evidence from at least
three comparable runs. The canary may not mutate Sample until the owner authorizes that product run.

Report publication truth separately: implemented, locally verified, committed, pushed, merged,
installed and production-proven are different states. Until the first real canary passes,
`slo_status=TARGET` and `production_proven=false`; until the three-run calibration also passes,
`default_cutover=false`.
