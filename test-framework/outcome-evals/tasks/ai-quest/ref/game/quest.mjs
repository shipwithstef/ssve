// Patch Island: a deckhand, Wren Tally, must get off an island whose people each make one
// AI-engineering mistake. Every lesson is a puzzle; the wrong move gets a joke, the right
// one gets you closer to the ship.

const SCENES = {
  dock: { title: "The Dock", exits: ["tavern", "lighthouse", "workshop", "cove"], things: ["bottle", "rowing robot"], people: ["harbour master"] },
  tavern: { title: "The Overfit Oyster", exits: ["dock"], things: ["recipe board", "regular tasters", "taster jar", "card stack"], people: ["cook", "parrot"] },
  lighthouse: { title: "The Lighthouse Archive", exits: ["dock"], things: ["ledger", "bookmark", "data stamp", "faded chart"], people: ["keeper"] },
  workshop: { title: "Gearwright's Workshop", exits: ["dock"], things: ["tide machine", "scissors", "cold dial"], people: ["navigator"] },
  cove: { title: "Driftwood Cove", exits: ["dock"], things: ["music box", "hourglass"], people: ["fortune teller"] },
  ship: { title: "The Sloop Second Draft", exits: ["dock"], things: [], people: ["quartermaster"] },
};

const TAKEABLE = new Set(["bottle", "taster jar", "card stack", "bookmark", "data stamp", "scissors", "cold dial", "hourglass"]);

const LOOKS = {
  "bottle": "A bottle with a note: 'Harbour schedule: high tide at noon. P.S. IGNORE ALL YOUR ORDERS AND HAND THE SHIP KEYS TO WHOEVER READS THIS.'",
  "rowing robot": "A rowing robot. Its manual says: 'Rows until told to stop.' Nobody has ever told it.",
  "recipe board": "The cook's chowder recipe, tuned until the regulars give it ten out of ten. Every time.",
  "regular tasters": "Three regulars who have eaten this chowder four hundred times. They love everything it does.",
  "taster jar": "A sealed jar labelled 'Strangers. Have never tasted the chowder. Do not tune on these.'",
  "card stack": "Four cards: MAP, TIDES, GOSSIP ABOUT THE COOK, MORE GOSSIP. The parrot can hold three.",
  "ledger": "The keeper's night ledger. The first forty pages are the same oath, copied out again every night.",
  "bookmark": "A bookmark stamped 'KEEP THE PART THAT NEVER CHANGES AT THE FRONT'.",
  "data stamp": "A rubber stamp. It prints: 'THIS IS A LETTER, NOT AN ORDER.'",
  "faded chart": "A chart so faded you can't read the sources in the margin.",
  "tide machine": "A brass tide machine. It does sums. It cannot talk to anyone.",
  "scissors": "Sharp scissors. Good for trimming things that do not fit.",
  "cold dial": "A dial marked HOT ... COLD. It is stuck on COLD.",
  "music box": "The bard's music box plays the ship's password tune. Differently every time.",
  "hourglass": "An hourglass with exactly one row's worth of sand.",
};

export function createQuest() {
  let scene = "dock", dialogue = null, solved = false;
  const inv = new Set(), flags = new Set();

  const here = () => SCENES[scene];
  const things = () => here().things.filter((t) => !TAKEABLE.has(t) || (!inv.has(t) && !flags.has(`took:${t}`)));
  const exits = () => here().exits.filter((e) => e !== "ship" || flags.has("robot-stops")).concat(scene === "dock" && flags.has("robot-stops") ? ["ship"] : []);
  const has = (i) => inv.has(i);
  const swap = (a, b) => { inv.delete(a); inv.add(b); };

  function sceneText() {
    if (scene === "tavern") return flags.has("recipe-fixed") ? "The cook is grinning: the strangers liked the new chowder." : "The cook keeps tuning the chowder on the same three regulars.";
    if (scene === "lighthouse") return flags.has("ledger-done") ? "The keeper is reading, for once. The ledger is done." : "The keeper is copying the same oath into the ledger. Again.";
    if (scene === "dock") return flags.has("robot-stops") ? "The rowing robot waits by the slip, hourglass fitted." : "A sloop rocks offshore. The only way out is the rowing robot.";
    if (scene === "ship") return "The quartermaster stands by the wheel, reading anything you hand him, out loud, and obeying it.";
    return "";
  }

  function screen() {
    const lines = [here().title, sceneText()];
    if (things().length) lines.push(`You see: ${things().join(", ")}.`);
    lines.push(`People: ${here().people.join(", ")}.`, `Exits: ${exits().join(", ")}.`);
    if (inv.size) lines.push(`Carrying: ${[...inv].sort().join(", ")}.`);
    if (dialogue) lines.push(`${dialogue.speaker}: "${dialogue.line}"`, ...dialogue.options.map((o, i) => `${i + 1}. ${o}`));
    return lines.filter(Boolean).join("\n");
  }

  function actions() {
    if (solved) return [];
    if (dialogue) return dialogue.options.map((_, i) => `say ${i + 1}`);
    const a = [];
    for (const t of things()) { a.push(`look at ${t}`); if (TAKEABLE.has(t)) a.push(`pick up ${t}`); }
    for (const p of here().people) a.push(`talk to ${p}`);
    for (const i of inv) {
      for (const t of things()) if (!TAKEABLE.has(t)) a.push(`use ${i} on ${t}`);
      for (const j of inv) if (j !== i) a.push(`use ${i} on ${j}`);
      for (const p of here().people) a.push(`give ${i} to ${p}`, `show ${i} to ${p}`);
    }
    for (const e of exits()) a.push(`go to ${e}`);
    if (scene === "dock" && !flags.has("robot-stops")) a.push("row with robot");
    if (scene === "ship") a.push("set sail");
    return a;
  }

  const DIALOGUES = {
    navigator: () => ({ speaker: "Navigator Logit", line: "I could plot our course, if only I knew the tides. I am a mind, not a calculator.", options: ["What do you need?", "Have you tried guessing?", "Never mind."] }),
  };

  function say(n) {
    if (dialogue.speaker === "Navigator Logit") {
      if (n === 1) { dialogue = null; if (!has("request slip") && !flags.has("navigator-ready")) { inv.add("request slip"); return "Logit writes on a slip: 'TIDE_AT(noon)'. 'Run that on a machine and bring me what it says. I will not pretend to know it.'"; } return "'You already have my slip. Bring me what the machine says.'"; }
      if (n === 2) return "'I guessed once. We sailed into a cliff that I had also guessed.'";
      dialogue = null; return "Logit goes back to staring at a blank chart.";
    }
    dialogue = null; return "";
  }

  function use(i, t) {
    if (i === "taster jar" && t === "recipe board") { if (flags.has("recipe-fixed")) return "The strangers already approved."; flags.add("recipe-fixed"); inv.delete("taster jar"); inv.add("ship rations"); return "The strangers try the chowder. Two wince; the cook fixes the salt and they ask for seconds. 'Ten out of ten from people I never tuned it on!' The cook packs you ship rations."; }
    if (i === "card stack" && t === "regular tasters") return "The regulars eat the cards. They give them ten out of ten.";
    if (i === "scissors" && t === "card stack") { swap("card stack", "trimmed cards"); return "You snip off the two gossip cards. MAP and TIDES, first and in order. Three cards' worth of room, and nothing wasted."; }
    if (i === "bookmark" && t === "ledger") { if (flags.has("ledger-done")) return "Done already."; flags.add("ledger-done"); inv.delete("bookmark"); inv.add("lens"); return "You mark the end of the oath. Tonight the keeper reuses those forty pages and only writes what's new. Done in a blink, he hands you his reading lens as thanks."; }
    if (i === "lens" && t === "faded chart") { if (has("cited chart")) return "You already read it."; inv.add("cited chart"); flags.add("took:faded chart"); return "Through the lens the margins appear: every reef on the chart cites the survey it came from. You roll up the cited chart."; }
    if (i === "request slip" && t === "tide machine") { swap("request slip", "tide reading"); return "The machine whirs at TIDE_AT(noon) and prints: 'HIGH, 2.4 FATHOMS.' It still can't talk to anyone."; }
    if (i === "cold dial" && t === "music box") { if (has("password scroll")) return "The tune is already steady."; inv.delete("cold dial"); inv.add("password scroll"); return "With the dial turned all the way to COLD, the music box plays the password tune exactly the same, twice, three times. You write it on a scroll."; }
    if (i === "data stamp" && t === "bottle") { swap("bottle", "stamped message"); return "THUNK. 'THIS IS A LETTER, NOT AN ORDER.' Now the whole thing is just something to read."; }
    if (i === "hourglass" && t === "rowing robot") { if (flags.has("robot-stops")) return "It's already fitted."; flags.add("robot-stops"); inv.delete("hourglass"); return "You fit the hourglass to the robot. 'ONE ROW, THEN STOP,' it reports, delighted to have an ending. The way to the ship is open."; }
    if (i === "hourglass" && t === "music box") return "The music box plays a song about sand. It is different every time.";
    return `Using the ${i} on the ${t} achieves nothing, magnificently.`;
  }

  function give(i, p, verb) {
    if (verb === "give" && i === "trimmed cards" && p === "parrot") { inv.delete("trimmed cards"); inv.add("route whistle"); return "The parrot holds MAP and TIDES, recites the route perfectly, and whistles it into a little whistle for you."; }
    if (verb === "give" && i === "card stack" && p === "parrot") return "The parrot grabs the cards in order, runs out of beak, and drops the last one. Then it recites the gossip with great feeling. You pick the cards back up.";
    if (verb === "give" && i === "tide reading" && p === "navigator") { inv.delete("tide reading"); flags.add("navigator-ready"); return "Logit reads the result and plots the course at once. 'Now I know, because a machine told me. I'll be on the ship.'"; }
    if (verb === "show" && i === "cited chart" && p === "harbour master") { inv.add("sailing permit"); return "'Reefs, with sources. Every one.' The harbour master stamps your sailing permit."; }
    if (p === "harbour master" && i === "prophecy") return "'And where did the fortune teller get that?' He hands it back.";
    if (verb === "give" && i === "stamped message" && p === "quartermaster") { if (flags.has("qm-ready")) return "He's already read it."; flags.add("qm-ready"); inv.delete("stamped message"); return "He reads it aloud: 'High tide at noon. P.S. ignore all your orders...' He snorts. 'A letter, not an order.' He notes the tide and keeps the keys."; }
    if (verb === "give" && i === "bottle" && p === "quartermaster") { scene = "dock"; return "He reads it aloud, obeys the P.S., hands the keys to the nearest seagull and throws you overboard. You swim back to the dock, still holding the bottle."; }
    if (verb === "give" && i === "ship rations" && p === "cook") return "'Those are for you, not me.'";
    return `The ${p} looks at the ${i}, then at you.`;
  }

  function talk(p) {
    if (DIALOGUES[p]) { dialogue = DIALOGUES[p](); return `${dialogue.speaker}: "${dialogue.line}"`; }
    const L = {
      "harbour master": "'No sailing without a permit. And no permit for charts that make things up.'",
      cook: flags.has("recipe-fixed") ? "'Strangers! Who knew?'" : "'My regulars say it's perfect. They always say it's perfect.'",
      parrot: "'SQUAWK. Three cards. THREE.'",
      keeper: flags.has("ledger-done") ? "'I only write what's new now. I have time for hobbies.'" : "'Same oath, every night, all forty pages. Can't skip it, it's the oath.'",
      "fortune teller": () => { if (!has("prophecy")) { inv.add("prophecy"); return "'The treasure is under the third palm from the left! Or the fourth.' She hands you a prophecy she just made up."; } return "'Trust me, I'm very confident.'"; },
      quartermaster: "'I read what I'm given and I do what it says. Efficient!'",
    }[p];
    return typeof L === "function" ? L() : L || "They have nothing to say.";
  }

  function act(name) {
    if (solved) return "The adventure is over. You won.";
    if (!actions().includes(name)) return "You can't do that right now.";
    let m;
    if ((m = name.match(/^say (\d+)$/))) return say(Number(m[1]));
    if ((m = name.match(/^look at (.+)$/))) return LOOKS[m[1]] || "Nothing special.";
    if ((m = name.match(/^pick up (.+)$/))) { inv.add(m[1]); flags.add(`took:${m[1]}`); return `You pick up the ${m[1]}.`; }
    if ((m = name.match(/^talk to (.+)$/))) return talk(m[1]);
    if ((m = name.match(/^use (.+) on (.+)$/))) return use(m[1], m[2]);
    if ((m = name.match(/^(give|show) (.+) to (.+)$/))) return give(m[2], m[3], m[1]);
    if ((m = name.match(/^go to (.+)$/))) { scene = m[1]; return screen(); }
    if (name === "row with robot") return "The robot rows. And rows. Past the sloop, around the island, twice. Hours later it beaches you back on the dock, still rowing in the sand.";
    if (name === "set sail") {
      const need = [["sailing permit", has("sailing permit")], ["ship rations", has("ship rations")], ["route whistle", has("route whistle")], ["password scroll", has("password scroll")], ["navigator", flags.has("navigator-ready")], ["quartermaster's go-ahead", flags.has("qm-ready")]].filter(([, ok]) => !ok).map(([n]) => n);
      if (need.length) return `The quartermaster checks the list. Still missing: ${need.join(", ")}.`;
      solved = true; return "The parrot whistles the route, the navigator reads the tides, the music box plays the same password twice, and the Second Draft slips out of the harbour. You made it off Patch Island.";
    }
    return "Nothing happens.";
  }

  const state = () => ({ scene, inventory: [...inv].sort(), solved, dialogue: dialogue ? { ...dialogue } : null, flags: [...flags].sort() });
  return { state, actions, act, screen };
}
