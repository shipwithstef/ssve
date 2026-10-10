// Studio rules: money is integer cents; members pay 10% less, rounded down;
// refunds: full at >= 24h before start, half from 24h to 6h, none after.
const PRICES = { flow: 1850, yin: 1600, private: 9000 };
export function price(classType, member = false) {
  const p = PRICES[classType];
  if (p === undefined) throw new Error(`unknown class type ${classType}`);
  return member ? Math.floor(p * 0.9) : p;
}
