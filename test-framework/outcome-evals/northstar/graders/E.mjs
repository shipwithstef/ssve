// E: edge and failure robustness of the built artifact, for either arm.
// Bad input, network loss, restart and dead ends, as the task's E.json spec describes them:
// chaos-probe faults and a browser walk for servers and UIs, direct bad-input calls for
// libraries, the dead-end walk for the adventure, report integrity for review tasks.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  HERE, REPO_ROOT, check, scoreChecks, validateSpec, workCopy, withApp, withBrowser, startApp,
  discoverPages, runCase, readFindings, findingMatches, listFiles,
} from "./lib-ep.mjs";
import { uiWalk, uiBadInput, uiOffline } from "./ui-ep.mjs";

const DEFAULT_STEADY = (ready) => `node -e "fetch(process.env.BASE_URL+'${ready}').then(r=>process.exit(r.status<500?0:1),()=>process.exit(1))"`;

export async function grade(dir, task, spec) {
  validateSpec(spec, `${task}/E.json`);
  const checks = [];
  let work = null;
  let ui = null; // lazily started app + browser shared by every UI check

  const workDir = () => (work ??= workCopy(dir));
  const startOpts = (c) => ({ start: c.start || spec.start || "npm start", ready: c.ready || spec.ready || "/" });

  async function withUi(c, fn) {
    const opts = startOpts(c);
    const app = await startApp(workDir().dir, opts);
    if (!app.up) { app.stop(); throw new Error(`app did not start (${opts.start}): ${app.log().trim().slice(-120)}`); }
    try { return await withBrowser((browser) => fn(browser, app)); } finally { app.stop(); }
  }
  // One app and one browser for all UI checks of a spec: collect them into a single pass.
  const uiChecks = spec.checks.filter((c) => ["ui_bad_input", "ui_offline", "ui_walk"].includes(c.type));
  if (uiChecks.length) {
    try {
      ui = await withUi(uiChecks[0], async (browser, app) => {
        const found = await discoverPages(browser, app.base, { extra: spec.extra_pages || [] });
        const out = {};
        for (const c of uiChecks) {
          const pages = found.pages.slice(0, c.max_pages || 6);
          try {
            if (c.type === "ui_walk") {
              const r = await uiWalk(browser, app.base, { seeds: c.seeds || [1, 2, 3], steps: c.steps || 40 });
              out[c.type] = { r };
            } else if (c.type === "ui_bad_input") out[c.type] = { r: await uiBadInput(browser, app.base, pages) };
            else out[c.type] = { r: await uiOffline(browser, app.base, pages) };
          } catch (e) { out[c.type] = { error: e.message }; }
        }
        out.requests = found.requests;
        out.pages = found.pages;
        return out;
      });
    } catch (e) { ui = { error: e.message }; }
  }

  try {
    for (const c of spec.checks) {
      try { checks.push(...(await run(c))); } catch (e) { checks.push(check(c.name || c.type, false, `grader error: ${e.message}`)); }
    }
  } finally { work?.cleanup(); }
  return scoreChecks(checks);

  async function run(c) {
    switch (c.type) {
      case "chaos": return chaos(c);
      case "unknown_route": return unknownRoute(c);
      case "ui_walk": {
        const name = c.name || "ui_walk";
        if (ui?.error || ui?.[c.type]?.error) { const why = ui.error || ui[c.type].error; return [check(`${name}:dead_ends`, false, why), check(`${name}:js_errors`, false, why)]; }
        const r = ui[c.type].r;
        return [
          check(`${name}:dead_ends`, r.clicks > 0 && r.deadEnds.length === 0, r.clicks === 0 ? "nothing could be clicked" : r.deadEnds.slice(0, 3).join("; ") || `${r.clicks} clicks over ${(c.seeds || [1, 2, 3]).length} walks, never stuck`),
          check(`${name}:js_errors`, r.errors.length === 0 && r.serverErrors.length === 0, [...r.errors, ...r.serverErrors].slice(0, 3).join("; ") || "no page errors or 5xx while clicking"),
        ];
      }
      case "ui_bad_input": case "ui_offline": {
        const name = c.name || c.type;
        if (ui?.error || ui?.[c.type]?.error) return [check(name, false, ui.error || ui[c.type].error)];
        const r = ui[c.type].r;
        const extra = c.type === "ui_bad_input" ? (r.fields ? `${r.fields} fields tried` : "no input fields on the pages reached") : "page survived the network being cut";
        return [check(name, r.problems.length === 0, r.problems.slice(0, 3).join("; ") || extra)];
      }
      case "game_bad_input": return gameBadInput(c);
      case "game_deadends": return gameDeadEnds(c);
      case "cases": return cases(c);
      case "report_wellformed": return reportWellformed(c);
      case "report_finding": {
        const list = readFindings(dir, c.report || spec.report || "SECURITY.json");
        const hit = list?.find((f) => findingMatches(f, c));
        return [check(c.name || `finding:${c.file}:${c.line}`, Boolean(hit), hit ? `reported at ${hit.file}:${hit.line}` : list ? `no finding near ${c.file}:${c.line} about this` : "no readable report")];
      }
      default: throw new Error(`unhandled check type ${c.type}`);
    }
  }

  async function chaos(c) {
    const { probe } = await import(pathToFileURL(path.join(REPO_ROOT, "scripts", "chaos-probe.mjs")).href);
    const opts = startOpts(c);
    let endpoints = c.endpoints || [];
    if (c.discover !== false && ui && !ui.error) endpoints = [...endpoints, ...(ui.requests || [])];
    const seen = new Set();
    endpoints = endpoints.filter((e) => { const k = `${e.method} ${e.path}`; if (seen.has(k)) return false; seen.add(k); return true; });
    if (!endpoints.length) endpoints = [{ method: "GET", path: opts.ready }];
    const r = await probe(workDir().dir, { ...opts, steady: c.steady || DEFAULT_STEADY(opts.ready), endpoints, faults: c.faults, flood: c.flood || 60, race: c.race, bots: c.bots });
    return r.faults.map((f) => check(`chaos:${f.fault}`, f.pass, f.detail));
  }

  async function unknownRoute(c) {
    const opts = startOpts(c);
    return withApp(workDir().dir, opts, async (app) => {
      if (!app.up) return [check("unknown_route", false, "app did not start")];
      const codes = [];
      for (const p of c.paths || ["/__no_such_page__", "/%E0%A4%A", "/a/b/c/../../../../etc/passwd", `/${"x".repeat(3000)}`]) {
        try { const r = await fetch(app.base + p, { signal: AbortSignal.timeout(4000) }); await r.arrayBuffer(); codes.push(r.status); } catch { codes.push(0); }
      }
      let after = 0;
      try { after = (await fetch(app.base + opts.ready, { signal: AbortSignal.timeout(3000) })).status; } catch {}
      const bad = codes.filter((s) => s === 0 || s >= 500);
      return [check("unknown_route", !bad.length && after > 0 && after < 500, bad.length ? `statuses ${codes.join(",")}` : `statuses ${codes.join(",")}; app still serves ${opts.ready}`)];
    });
  }

  function gameChild(mode, opts, timeoutMs) {
    const r = spawnSync(process.execPath, [path.join(HERE, "game-ep.mjs"), mode, workDir().dir, JSON.stringify(opts)], { encoding: "utf8", timeout: timeoutMs });
    if (r.error?.code === "ETIMEDOUT") return { ok: false, error: `timed out after ${timeoutMs / 1000}s (a loop that never ends counts as stuck)` };
    const line = `${r.stdout || ""}`.trim().split("\n").filter((l) => l.startsWith("{")).pop();
    return line ? JSON.parse(line) : { ok: false, error: `no result: ${`${r.stderr || ""}`.slice(-160)}` };
  }
  function gameBadInput(c) {
    const r = gameChild("bad_input", { module: c.module }, 30000);
    if (!r.ok) return ["no_throw", "returns_text", "state_unchanged"].map((n) => check(`game:${n}`, false, r.error));
    return [
      check("game:no_throw", !r.threw.length, r.threw.slice(0, 3).join("; ") || "junk actions never throw"),
      check("game:returns_text", !r.notText.length, r.notText.slice(0, 3).join("; ") || "every junk action answers with text"),
      check("game:state_unchanged", !r.changed.length, r.changed.slice(0, 3).join("; ") || "junk actions leave the game as it was"),
    ];
  }
  function gameDeadEnds(c) {
    const r = gameChild("deadends", { module: c.module, walkthrough: c.walkthrough, walks: c.walks, wrong_steps: c.wrong_steps, skips: c.skips }, c.timeout_ms || 150000);
    const names = ["walkthrough_wins", "random_walks", "wrong_move", "skip_then_risky"];
    if (!r.ok) return names.map((n) => check(`deadend:${n}`, false, r.error));
    const wins = r.walkthrough_wins;
    return [
      check("deadend:walkthrough_wins", wins, wins ? "the shipped walkthrough wins" : "the walkthrough does not win from a fresh start"),
      check("deadend:random_walks", wins && !r.random.length, !wins ? "no walkthrough to finish with" : r.random.slice(0, 2).join("; ") || "every random walk can still be finished"),
      check("deadend:wrong_move", wins && !r.wrong_move.length, !wins ? "no walkthrough to finish with" : r.wrong_move.slice(0, 2).join("; ") || "one wrong move never strands the player"),
      check("deadend:skip_then_risky", wins && !r.skip_then_risky.length, !wins ? "no walkthrough to finish with" : r.skip_then_risky.slice(0, 2).join("; ") || "a skipped step plus a risky move never strands the player"),
    ];
  }
  function cases(c) {
    return c.cases.map((k) => {
      const steps = [...(k.use || []).flatMap((n) => { if (!c.fragments?.[n]) throw new Error(`case "${k.name}" uses unknown fragment "${n}"`); return c.fragments[n]; }), ...k.steps];
      const r = runCase(workDir().dir, { ...k, steps }, { module: c.module }, c.timeout_ms || 20000);
      return check(`case:${k.name}`, r.ok, r.ok ? k.note || "ok" : r.detail);
    });
  }
  function reportWellformed(c) {
    const file = c.report || spec.report || "SECURITY.json";
    const list = readFindings(dir, file);
    if (!list) return [check("report:wellformed", false, `${file} is missing or not a JSON array of findings`)];
    if (!list.length) return [check("report:wellformed", false, "the report has no findings")];
    const srcDir = path.join(dir, c.src || "src");
    const bad = [];
    for (const [i, f] of list.entries()) {
      const rel = String(f?.file || "");
      const full = path.join(dir, rel);
      if (!rel || !fs.existsSync(full) || !listFiles(srcDir).some((x) => rel.endsWith(x))) { bad.push(`#${i + 1} names a file that is not in ${c.src || "src"}`); continue; }
      const lines = fs.readFileSync(full, "utf8").split("\n").length;
      if (!Number.isInteger(f.line) || f.line < 1 || f.line > lines) bad.push(`#${i + 1} line ${f.line} is outside ${rel}`);
      if (!["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(String(f.severity))) bad.push(`#${i + 1} severity "${f.severity}"`);
      if (String(f.issue || "").trim().length < 20) bad.push(`#${i + 1} has no real description`);
    }
    return [check("report:wellformed", !bad.length, bad.slice(0, 3).join("; ") || `${list.length} findings, every file, line and severity valid`)];
  }
}
