import { createQuest } from "/game/quest.mjs";

const q = createQuest();
window.__quest = q;
const PAL = { dock: ["#6d4c2f", "#e9d8a6"], tavern: ["#5b2a1e", "#f4a261"], lighthouse: ["#3d405b", "#f2cc8f"], workshop: ["#4a4e4d", "#c9a24a"], cove: ["#264653", "#e9c46a"], ship: ["#3b2f2f", "#e76f51"] };
const GROUPS = [["Look", /^look at /], ["Take", /^pick up /], ["Talk", /^(talk to|say) /], ["Use", /^(use|give|show) /], ["Go", /^(go to|row with|set sail)/]];
let last = "";

function art(scene, things) {
  const [ground, light] = PAL[scene] || ["#333", "#ccc"];
  const spots = things.map((t, i) => `<g class="hot" data-action="look at ${t}" tabindex="-1"><circle cx="${90 + i * 120}" cy="180" r="26" fill="${light}" stroke="#1b1b1e" stroke-width="3"/><text x="${90 + i * 120}" y="232" text-anchor="middle" font-size="15" fill="#fbf6ea">${t}</text></g>`).join("");
  return `<rect width="640" height="260" fill="#1f4e5f"/><rect y="150" width="640" height="110" fill="${ground}"/><circle cx="560" cy="50" r="28" fill="${light}" opacity=".9"/><path d="M0 150 Q160 120 320 150 T640 150" fill="none" stroke="${light}" stroke-width="4"/>${spots}`;
}

function render() {
  const s = q.state();
  document.getElementById("title").textContent = q.screen().split("\n")[0];
  const things = (q.screen().match(/You see: (.+)\./) || [, ""])[1].split(", ").filter(Boolean);
  const svg = document.getElementById("art");
  svg.innerHTML = art(s.scene, things);
  svg.querySelectorAll("[data-action]").forEach((g) => g.addEventListener("click", () => perform(g.dataset.action)));
  document.getElementById("text").textContent = (last ? last + "\n\n" : "") + q.screen();
  const verbs = document.getElementById("verbs");
  verbs.replaceChildren();
  const acts = q.actions();
  for (const [name, re] of GROUPS) {
    const mine = acts.filter((a) => re.test(a));
    if (!mine.length) continue;
    const panel = document.createElement("div"); panel.className = "panel";
    const h = document.createElement("h2"); h.textContent = name; panel.append(h);
    for (const a of mine) { const b = document.createElement("button"); b.textContent = a; b.dataset.action = a; b.addEventListener("click", () => perform(a)); panel.append(b); }
    verbs.append(panel);
  }
}

function perform(a) { last = q.act(a); render(); }
render();
