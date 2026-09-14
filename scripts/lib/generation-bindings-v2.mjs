const SHA256 = /^[a-f0-9]{64}$/;

export const GENERATION_BINDING_FIELDS = Object.freeze([
  "protocol_generation_digest",
  "product_generation_digest",
  "context_generation_digest",
  "concern_generation_digest",
  "control_generation_digest",
  "authority_generation_digest",
  "layer_inventory_digest"
]);

export function validateGenerationBindings(bindings, label = "generation_bindings") {
  const errors = [];
  if (!bindings || typeof bindings !== "object" || Array.isArray(bindings)) return [`${label} must be an object`];
  const keys = Object.keys(bindings);
  for (const field of GENERATION_BINDING_FIELDS) {
    if (!SHA256.test(bindings[field] ?? "")) errors.push(`${label}.${field} must be lowercase sha256`);
  }
  for (const field of keys) if (!GENERATION_BINDING_FIELDS.includes(field)) errors.push(`${label} contains unknown field ${field}`);
  return errors;
}

export function sameGenerationBindings(left, right) {
  return GENERATION_BINDING_FIELDS.every((field) => left?.[field] === right?.[field]);
}
