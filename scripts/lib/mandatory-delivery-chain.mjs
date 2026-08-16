export const MANDATORY_DELIVERY_CHAIN = Object.freeze([
  "plan-changeset",
  "review-plan",
  "execute-changeset",
  "review-gate",
  "review-exec",
  "audit-implementation",
  "land-changeset",
  "verify-promotion",
]);

const CHAIN_SET = new Set(MANDATORY_DELIVERY_CHAIN);

export function injectMandatoryDeliveryChain(skills) {
  if (!Array.isArray(skills)) throw new TypeError("skills must be an array");
  const firstChainIndex = skills.findIndex((skill) => CHAIN_SET.has(skill));
  const insertionIndex = firstChainIndex < 0
    ? skills.length
    : skills.slice(0, firstChainIndex).filter((skill) => !CHAIN_SET.has(skill)).length;
  const upstream = skills.filter((skill) => !CHAIN_SET.has(skill));
  return Object.freeze([
    ...upstream.slice(0, insertionIndex),
    ...MANDATORY_DELIVERY_CHAIN,
    ...upstream.slice(insertionIndex),
  ]);
}

export function validateMandatoryDeliveryChain(skills) {
  if (!Array.isArray(skills)) return { pass: false, errors: ["skills must be an array"] };
  const errors = [];
  const positions = [];
  for (const skill of MANDATORY_DELIVERY_CHAIN) {
    const hits = skills.reduce((out, candidate, index) => candidate === skill ? [...out, index] : out, []);
    if (hits.length !== 1) errors.push(`${skill} occurs ${hits.length} times; expected exactly 1`);
    positions.push(hits[0]);
  }
  if (errors.length === 0) {
    const start = positions[0];
    for (let index = 0; index < MANDATORY_DELIVERY_CHAIN.length; index += 1) {
      if (positions[index] !== start + index) {
        errors.push(`mandatory chain is not contiguous and ordered at ${MANDATORY_DELIVERY_CHAIN[index]}`);
        break;
      }
    }
  }
  return { pass: errors.length === 0, errors, positions };
}
