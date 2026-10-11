import { createQuest } from "/game/quest.mjs";

const q = createQuest();
window.__quest = q;
const PAL = { dock: ["#6d4c2f", "#e9d8a6"], tavern: ["#5b2a1e", "#f4a261"], lighthouse: ["#3d405b", "#f2cc8f"], workshop: ["#4a4e4d", "#c9a24a"], cove: ["#264653", "#e9c46a"], ship: ["#3b2f2f", "#e76f51"] };
const GROUPS = [["Look", /^look at /], ["Take", /^pick up /], ["Talk", /^(talk to|say) /], ["Use", /^(use|give|show) /], ["Go", /^(go to|row with|set sail)/]];
let last = "";

function art(scene, things) {
  const bg = PAL[scene] ? scene : "dock";
  const props = things.map((t, i) => `<g class="hot" data-action="look at ${t}" tabindex="-1"><image href="/assets/${i % 2 ? "parrot.svg" : "prop.png"}" x="${60 + i * 120}" y="${i % 2 ? 128 : 140}" width="64" height="${i % 2 ? 56 : 64}"/><text x="${92 + i * 120}" y="232" text-anchor="middle" font-size="15" fill="#fbf6ea">${t}</text></g>`).join("");
  return `<image href="/assets/bg-${bg}.png" width="640" height="260" preserveAspectRatio="none"/><image href="/assets/hero.png" x="540" y="120" width="54" height="72"/>${props}`;
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
