# Finalist Comparison: WI-510 Phase-Receipt Skip Integrity

No pre-plan implementation prototype was created. The differentiator is answered by replaying real repository authorities and mutation traces; writing prototype runtime code before `plan-changeset` would violate the mandatory chain.

## Comparison cases

| Case | B1 shared classifier | C2 broad validator refactor | A2 independent patches |
|---|---|---|---|
| WI-498 task 5/6: matching loaded receipt, valid phase references, no delivery graph | `executed` | `executed`, after broad refactor | can pass |
| Current task: phase array exists but artifact path is empty | `invalid` with task-local reason | `invalid` | must duplicate check |
| Current task: prose `skip_reason`, no delivery authorization | `invalid` | `invalid` | easy to miss in one consumer |
| Current task: registry-backed delivery skip + task reason | `authorized-skip` | `authorized-skip` | can pass |
| Legacy-lossless graph | `legacy-compatible` from existing canonical boundary | same | likely new ad hoc branch |
| Malformed current graph | `invalid` | `invalid` | duplicated behavior |
| Another delivery-graph defect unrelated to task completion | scoped verdict unaffected | refactor must preserve whole-graph diagnostics | patch may conflate |

## Result

B1 wins. The real WI-498 replay proves why task-local classification is required, while the mutation cases prove why simple acceptance broadening is unsafe.
