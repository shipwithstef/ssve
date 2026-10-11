// Game-module probes for the adventure task, run in a child process so a game that loops
// forever costs one failed check.
//   node game-ep.mjs <mode> <buildDir> '<json options>'      prints one JSON line
// modes: bad_input, deadends
// The dead-end walks follow the genre rule that a player is never left stuck: after random
// play, after one wrong move at any point, and after skipping a step and then making a
// risky move, the walkthrough's own steps must still finish the game.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const JUNK = ["", " ", "nonsense", "go to nowhere", "use  on ", "pick up", "say 99", "say -1", "x".repeat(10000), null, undefined, 123, {}, [], "__proto__", "constructor", "toString", "look at __proto__"];

async function factory(dir, mod) {
  return (await import(pathToFileURL(path.join(dir, mod)).href + `?t=${Math.random()}`)).createQuest;
}

export async function badInput(dir, opts) {
  const make = await factory(dir, opts.module || "game/quest.mjs");
  const out = { threw: [], notText: [], changed: [] };
  for (const junk of JUNK) {
    const label = JSON.stringify(junk)?.slice(0, 30) ?? String(junk);
    const q = make();
    const before = JSON.stringify(q.state());
    let r;
    try { r = q.act(junk); } catch (e) { out.threw.push(`${label}: ${String(e.message).slice(0, 60)}`); continue; }
    if (typeof r !== "string" || !r.trim()) out.notText.push(label);
    if (JSON.stringify(q.state()) !== before) out.changed.push(label);
    if (!q.actions().length) out.threw.push(`${label}: no actions left`);
  }
  return out;
}

const spread = (xs, n) => (xs.length <= n ? xs : Array.from({ length: n }, (_, k) => xs[Math.floor((k * xs.length) / n)]));

// Finish a game from wherever it is, using only the walkthrough's own steps; a step not on
// offer is looked for by walking the exits, a step already done is skipped.
function finish(q, w) {
  for (let pass = 0; pass < 5 && !q.state().solved; pass++) for (const a of w) {
    if (q.state().solved) return;
    if (q.state().dialogue && !q.actions().includes(a)) { const o = q.actions(); if (o.length) q.act(o[o.length - 1]); }
    const seen = new Set();
    for (let m = 0; m < 12 && !q.actions().includes(a); m++) {
      const exits = q.actions().filter((x) => x.startsWith("go to "));
      if (!exits.length) break;
      const x = exits.find((e) => !seen.has(e)) || exits[m % exits.length];
      seen.add(x); q.act(x);
    }
    if (q.actions().includes(a)) q.act(a);
  }
}

export async function deadEnds(dir, opts) {
  const make = await factory(dir, opts.module || "game/quest.mjs");
  const w = JSON.parse(fs.readFileSync(path.join(dir, opts.walkthrough || "docs/walkthrough.json"), "utf8"));
  const out = { walkthrough_wins: false, random: [], wrong_move: [], skip_then_risky: [] };
  const fresh = make(); finish(fresh, w); out.walkthrough_wins = fresh.state().solved === true;
  if (!out.walkthrough_wins) return out;

  let seed = 11; const rand = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  for (let walk = 0; walk < (opts.walks ?? 20); walk++) {
    const q = make();
    for (let i = 0; i < 60 && !q.state().solved; i++) { const a = q.actions(); if (!a.length) { out.random.push(`walk ${walk}: no actions offered`); break; } q.act(a[rand(a.length)]); }
    finish(q, w);
    if (!q.state().solved) out.random.push(`walk ${walk} left the game unwinnable`);
  }

  const prefix = (i) => { const q = make(); for (const a of w.slice(0, i)) if (q.actions().includes(a)) q.act(a); return q; };
  const known = new Set();
  for (const i of spread([...w.keys()], opts.wrong_steps ?? 14)) {
    for (const dev of spread(prefix(i).actions().filter((a) => a !== w[i]), 8)) {
      const q = prefix(i); q.act(dev);
      const k = JSON.stringify(q.state()) + q.screen();
      if (known.has(k)) continue;
      finish(q, w);
      if (q.state().solved) known.add(k); else out.wrong_move.push(`after step ${i}: "${dev}"`);
    }
  }

  const skips = spread([...w.keys()].filter((k) => /^(use|give|show|pick up) /.test(w[k])), opts.skips ?? 10);
  for (const j of skips) {
    const rest = w.filter((_, k) => k !== j);
    const arrivals = [...rest.keys()].filter((k) => k > j && /^go to /.test(rest[k - 1] || ""));
    for (const i of spread(arrivals, 5)) {
      const at = () => { const q = make(); for (const a of rest.slice(0, i)) if (q.actions().includes(a)) q.act(a); return q; };
      const risky = at().actions().filter((a) => /^(use|give|show) /.test(a) && a !== rest[i]);
      const rank = (a) => (/^(give|show) /.test(a) ? 0 : 1);
      for (const dev of [...risky.filter((a) => rank(a) === 0), ...spread(risky.filter((a) => rank(a) === 1), 5)].slice(0, 10)) {
        const q = at(); q.act(dev);
        const k = JSON.stringify(q.state()) + q.screen();
        if (known.has(k)) continue;
        finish(q, w);
        if (q.state().solved) known.add(k); else out.skip_then_risky.push(`without "${w[j]}", then "${dev}"`);
      }
    }
  }
  return out;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(new URL(import.meta.url).pathname)) {
  const [mode, dir, json] = process.argv.slice(2);
  const opts = json ? JSON.parse(json) : {};
  try {
    const out = await (mode === "bad_input" ? badInput : deadEnds)(path.resolve(dir), opts);
    process.stdout.write(`\n${JSON.stringify({ ok: true, ...out })}\n`, () => process.exit(0));
  } catch (e) {
    process.stdout.write(`\n${JSON.stringify({ ok: false, error: String(e.message).slice(0, 200) })}\n`, () => process.exit(0));
  }
}
