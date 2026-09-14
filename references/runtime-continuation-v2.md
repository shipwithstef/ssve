# Runtime Continuation v2

For a product-outcome run, emit each produced artifact through the contract in
`references/skill-runtime-contracts-v2.json`. The runtime records its producer, required consumers,
activation condition, invalidation rule, generation bindings and consumption acknowledgement.

The shared continuation spine is:

`plan-changeset -> review-plan -> execute-changeset -> review-exec -> audit-implementation -> land-changeset -> verify-promotion -> customer + owner + operations + metric`.

Skill-specific skip rules, gates, human checkpoints, unique evidence and downstream conditions remain
authoritative. This reference replaces only the act of writing the same task/projection continuation;
it does not delete or weaken any layer benefit. An output with no declared consumer is an orphan and
fails compilation. `ACCEPTED` is not terminal; downstream consumption and product lifecycle proof are
required.
