// Browser helpers for probes. Kept apart from sk-probe.mjs, which reads its nonce from stdin
// when imported, so that graders and tests can import these without touching stdin.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// Browser probes: Playwright from OE_PLAYWRIGHT, else the global npm install, else the bare name.
export async function playwright() {
  let entry = process.env.OE_PLAYWRIGHT;
  if (!entry) {
    const root = spawnSync("npm", ["root", "-g"], { encoding: "utf8" }).stdout?.trim() || "";
    const g = path.join(root, "playwright", "index.mjs");
    entry = fs.existsSync(g) ? g : "playwright";
  }
  return import(entry.startsWith("/") ? pathToFileURL(entry).href : entry);
}

// Launches Chromium. When Playwright's own browser revision is not installed (a host that
// updated Playwright without re-running its install), fall back to another Chromium on the
// machine: OE_CHROMIUM, a browser in the Playwright cache, or a system Chrome/Chromium.
export async function launchBrowser(pw) {
  try { return await pw.chromium.launch(); } catch (first) {
    const cache = path.join(os.homedir(), ".cache", "ms-playwright");
    const cached = fs.existsSync(cache) ? fs.readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1])).flatMap((d) => ["chrome-linux64/chrome", "chrome-linux/chrome"].map((x) => path.join(cache, d, x))) : [];
    for (const exe of [process.env.OE_CHROMIUM, ...cached, "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean)) {
      if (!fs.existsSync(exe)) continue;
      try { return await pw.chromium.launch({ executablePath: exe, args: ["--no-sandbox"] }); } catch { /* try the next one */ }
    }
    throw first;
  }
}
