// Steady state: the bank answers, and gold always equals the number of earns.
const r = await fetch(process.env.BASE_URL + "/");
if (!r.ok) { console.log("status", r.status); process.exit(1); }
const b = await r.json();
if (b.gold !== b.earns) { console.log(`gold ${b.gold} != earns ${b.earns}`); process.exit(1); }
if (process.env.EXPECT_EARNS && b.earns < Number(process.env.EXPECT_EARNS)) { console.log(`earns ${b.earns} lost`); process.exit(1); }
