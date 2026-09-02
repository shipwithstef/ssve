function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function validateEvidenceSchema(value, schema, rootSchema = schema, location = "$") {
  if (schema.$ref) {
    if (!schema.$ref.startsWith("#/")) return [`${location}: unsupported schema reference`];
    const target = schema.$ref.slice(2).split("/").reduce((cursor, key) => cursor?.[key], rootSchema);
    return target ? validateEvidenceSchema(value, target, rootSchema, location) : [`${location}: unresolved schema reference`];
  }
  if (schema.anyOf) {
    const branches = schema.anyOf.map((branch) => validateEvidenceSchema(value, branch, rootSchema, location));
    if (!branches.some((errors) => errors.length === 0)) return [`${location}: no anyOf branch matched`];
  }
  if (schema.allOf) {
    const errors = schema.allOf.flatMap((branch) => validateEvidenceSchema(value, branch, rootSchema, location));
    if (errors.length) return errors;
  }
  if (Object.prototype.hasOwnProperty.call(schema, "const") && canonical(value) !== canonical(schema.const)) return [`${location}: const mismatch`];
  const errors = [];
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  const actual = value === null ? "null" : Array.isArray(value) ? "array" : Number.isInteger(value) ? "integer" : typeof value;
  if (types.length && !types.includes(actual) && !(actual === "integer" && types.includes("number"))) return [`${location}: expected ${types.join("|")}, got ${actual}`];
  if (schema.enum && !schema.enum.some((entry) => canonical(entry) === canonical(value))) errors.push(`${location}: outside enum`);
  if (typeof value === "string" && schema.pattern && !(new RegExp(schema.pattern).test(value))) errors.push(`${location}: pattern mismatch`);
  if (typeof value === "string" && schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${location}: below minLength`);
  if (typeof value === "string" && schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${location}: above maxLength`);
  if (typeof value === "number" && schema.minimum !== undefined && value < schema.minimum) errors.push(`${location}: below minimum`);
  if (typeof value === "number" && schema.maximum !== undefined && value > schema.maximum) errors.push(`${location}: above maximum`);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const key of schema.required || []) if (!Object.prototype.hasOwnProperty.call(value, key)) errors.push(`${location}: missing ${key}`);
    if (schema.additionalProperties === false) for (const key of Object.keys(value)) if (!Object.prototype.hasOwnProperty.call(schema.properties || {}, key)) errors.push(`${location}: unexpected ${key}`);
    for (const [key, child] of Object.entries(schema.properties || {})) if (Object.prototype.hasOwnProperty.call(value, key)) errors.push(...validateEvidenceSchema(value[key], child, rootSchema, `${location}.${key}`));
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${location}: below minItems`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${location}: above maxItems`);
    if (schema.uniqueItems === true && new Set(value.map(canonical)).size !== value.length) errors.push(`${location}: duplicate items violate uniqueItems`);
    if (schema.items) value.forEach((entry, index) => errors.push(...validateEvidenceSchema(entry, schema.items, rootSchema, `${location}[${index}]`)));
  }
  return errors;
}
