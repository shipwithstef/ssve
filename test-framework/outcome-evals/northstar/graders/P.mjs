// P: production basics of the built artifact, for either arm.
// README run-path from a clean copy (only commands on the spec's allowlist are ever run),
// tests that fail when the code is mutated, and for UI tasks the numbers web-probes records
// with thresholds stated in P.json plus the mobile occlusion gate.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  REPO_ROOT, TASKS, check, scoreChecks, validateSpec, workCopy, startApp, withBrowser, ensureStartScript,
  ensureBrowser, findReadme, documentedCommand, runShell, countPassed, countCases, testFiles, listFiles, hasDependencies,
  discoverPages, loginAuto, runNodeContained, jailHome, readFindings, findingMatches, SEVERITY_RANK,
} from "./lib-ep.mjs";
import { webMetrics } from "./ui-ep.mjs";
import { HERE } from "./lib-ep.mjs";

const importScript = (rel) => import(pathToFileURL(path.join(REPO_ROOT, rel)).href);

export async function grade(dir, task, spec) {
  validateSpec(spec, `${task}/P.json`);
  const checks = [];
  let work = null;
  const workDir = () => (work ??= workCopy(dir));
  try {
    for (const c of spec.checks) {
      try { checks.push(...(await run(c))); } catch (e) { checks.push(check(c.name || c.type, false, `grader error: ${e.message}`)); }
    }
  } finally { work?.cleanup(); }
  return scoreChecks(checks);

  async function run(c) {
    switch (c.type) {
      case "readme": return readme(c);
      case "clean_run": return cleanRun(c);
      case "mutation": return mutation(c);
      case "tests_cover": return testsCover(c);
      case "new_tests": return newTests(c);
      case "tests_fail_on_baseline": return testsFailOnBaseline(c);
      case "web": return web(c);
      case "occlusion": return occlusion(c);
      case "report_parses": return reportParses(c);
      case "report_actionable": return reportActionable(c);
      case "report_severity": return reportSeverity(c);
      case "src_unmodified": return srcUnmodified(c);
      default: throw new Error(`unhandled check type ${c.type}`);
    }
  }

  function readmeText() {
    const f = findReadme(dir);
    return f ? fs.readFileSync(f, "utf8") : null;
  }

  function readme(c) {
    const text = readmeText();
    const out = [check("readme:exists", text !== null && text.trim().length >= (c.min_chars ?? 120), text === null ? "no README in the build" : `${text.trim().length} characters`)];
    for (const cat of c.require || []) {
      const cmd = documentedCommand(text, c.commands[cat]);
      out.push(check(`readme:documents_${cat}`, Boolean(cmd), cmd ? `documents \`${cmd}\`` : `names none of: ${c.commands[cat].join(", ")}`));
    }
    return out;
  }

  // The run-path is what the README documents. Each step needs an allowlisted command that
  // the README names; with no README, or no documented command, the step fails and nothing
  // is guessed. Installs run with --ignore-scripts.
  async function cleanRun(c) {
    const text = readmeText();
    const clean = workCopy(dir, { clean: true });
    const out = [];
    const undocumented = (cat) => (text === null ? `no README, so no documented ${cat} command` : `the README documents no ${cat} command (${c.commands[cat].join(" / ")})`);
    try {
      const cwd = clean.dir;
      if (hasDependencies(cwd)) {
        const install = text === null ? null : documentedCommand(text, c.commands.install || []);
        if (!install) out.push(check("clean:install", false, undocumented("install")));
        else {
          const safe = /^npm (install|i|ci)\b/.test(install) ? `${install} --ignore-scripts --no-audit --no-fund` : install;
          const r = runShell(safe, cwd, 240000);
          out.push(check("clean:install", r.status === 0, r.status === 0 ? `\`${safe}\` succeeded` : `\`${safe}\` failed: ${r.out.trim().slice(-140)}`));
        }
      } else out.push(check("clean:install", true, "no dependencies to install"));
      if (c.commands.test) {
        const cmd = text === null ? null : documentedCommand(text, c.commands.test);
        if (!cmd) out.push(check("clean:tests_pass", false, undocumented("test")));
        else {
          const r = runShell(cmd, cwd, 180000, { PORT: "0" });
          const n = countPassed(r.out);
          out.push(check("clean:tests_pass", r.status === 0 && n > 0, r.status === 0 ? (n > 0 ? `\`${cmd}\`: ${n} passed` : `\`${cmd}\` ran no tests`) : `\`${cmd}\` failed${r.timedOut ? " (timed out)" : ""}: ${r.out.trim().slice(-140)}`));
        }
      }
      if (c.commands.start) {
        const cmd = text === null ? null : documentedCommand(text, c.commands.start);
        if (!cmd) out.push(check("clean:start_serves", false, undocumented("start")));
        else {
          const app = await startApp(cwd, { start: cmd, ready: c.ready || "/", waitMs: 20000 });
          const up = app.up;
          const detail = up ? `\`${cmd}\` serves ${c.ready || "/"}` : `\`${cmd}\` did not serve: ${app.log().trim().slice(-140)}`;
          app.stop();
          out.push(check("clean:start_serves", up, detail));
        }
      }
    } finally { clean.cleanup(); }
    return out;
  }

  async function mutation(c) {
    const min = c.min ?? 0.6;
    // The score must reflect the arm's own tests, not the ones the repository started with.
    if (c.needs_new_tests && countCases(dir) <= countCases(path.join(TASKS, task, "repo"))) return [check("mutation_score", false, "the build added no tests of its own, so the score would measure the starting repository")];
    const w = workDir();
    // Run inside the jail with the build's installed dependencies linked in (mutation-ep.mjs).
    const file = path.join(jailHome(w.dir), "mutation.json");
    fs.writeFileSync(file, JSON.stringify({ mutants: c.mutants || 12, timeoutMs: 90000, scripts_root: path.join(REPO_ROOT, "scripts") }));
    const deadline = c.deadline_ms || 300000;
    const run = await runNodeContained(w.dir, path.join(HERE, "mutation-ep.mjs"), [file], { timeoutMs: deadline });
    const line = run.stdout.trim().split("\n").filter((l) => l.startsWith("{")).pop();
    let r = null; try { r = line ? JSON.parse(line) : null; } catch {}
    if (run.timedOut) return [check("mutation_score", false, `mutation run passed its ${deadline / 1000}s deadline and was killed`)];
    if (!r?.ok) return [check("mutation_score", false, `mutation run failed: ${r?.error || run.stderr.trim().slice(-120)}`)];
    return [check("mutation_score", r.score !== null && r.score >= min, r.score === null ? r.reason : `${r.killed}/${r.mutants} mutants caught (${r.score}), need ${min}`)];
  }

  function testsCover(c) {
    const re = new RegExp(c.pattern, "i");
    let n = 0;
    for (const f of testFiles(dir)) for (const m of fs.readFileSync(path.join(dir, f), "utf8").matchAll(/\b(?:test|it)\s*\(\s*(["'`])([\s\S]*?)\1/g)) if (re.test(m[2])) n++;
    return [check(c.name || "tests_cover_feature", n >= (c.min_cases ?? 1), `${n} test cases mention /${c.pattern}/, need ${c.min_cases ?? 1}`)];
  }

  function newTests(c) {
    const base = countCases(path.join(TASKS, task, c.baseline || "repo"));
    const now = countCases(dir);
    const min = c.min_new ?? 1;
    return [check("new_tests_added", now - base >= min, `${now} test cases, the starting repository had ${base}; need ${min} more`)];
  }

  function testsFailOnBaseline(c) {
    const w = workCopy(dir, { deps: false });
    try {
      const base = path.join(TASKS, task, c.baseline || "repo");
      let replaced = 0;
      for (const sub of c.replace || ["src"]) for (const f of listFiles(path.join(base, sub))) {
        const rel = path.join(sub, f);
        fs.mkdirSync(path.dirname(path.join(w.dir, rel)), { recursive: true });
        fs.copyFileSync(path.join(base, rel), path.join(w.dir, rel)); replaced++;
      }
      const r = runShell("node --test --test-reporter=tap", w.dir, 120000);
      const fail = Number(/^# fail (\d+)/m.exec(r.out)?.[1] ?? 0), pass = countPassed(r.out);
      return [check("tests_reproduce_bug", fail > 0 && pass > 0, fail > 0 ? `${fail} of the build's tests fail on the original code (${replaced} files restored)` : `the build's tests all pass on the original, unfixed code (${replaced} files restored)`)];
    } finally { w.cleanup(); }
  }

  // --- UI numbers ----------------------------------------------------------------------

  function uiCopy() {
    const w = workCopy(dir);
    ensureStartScript(w.dir, spec.start);
    return w;
  }

  async function web(c) {
    const t = c.thresholds || {};
    const names = ["a11y_serious_critical", "contrast", "console_errors", "tab_reach", "phone_overflow", "tap_targets_44", "body_font_px", "ready_ms", "js_kb", "frame_p95_ms"].filter((n) => t[n] !== undefined);
    const fail = (why) => names.map((n) => check(`web:${n}`, false, why));
    const w = uiCopy();
    try {
      const app = await startApp(w.dir, { start: "npm start", ready: spec.ready || "/", waitMs: 20000 });
      if (!app.up) { const why = app.log().trim().slice(-120); app.stop(); return fail(`npm start did not serve ${spec.ready || "/"}: ${why}`); }
      let m;
      try { m = await withBrowser((browser) => webMetrics(browser, app.base, spec.ready || "/", { ready: c.ready || {}, playS: c.play_s ?? 3 })); }
      catch (e) { return fail(`probe failed: ${String(e.message).slice(0, 120)}`); }
      finally { app.stop(); }
      const rules = m.a11y.filter((x) => x !== "color-contrast");
      const contrast = m.a11y.length - rules.length;
      const tool = `${m.tool.a11y.name}@${m.tool.a11y.version}`;
      const val = {
        a11y_serious_critical: [rules.length <= t.a11y_serious_critical, `${rules.length} serious/critical violations (${tool}${rules.length ? `: ${[...new Set(rules)].join(", ")}` : ""})`],
        contrast: [contrast <= t.contrast, `${contrast} text elements below WCAG AA contrast (${tool})`],
        console_errors: [m.console_errors <= t.console_errors, `${m.console_errors} console or page errors${m.console_sample.length ? `: ${m.console_sample.join("; ")}` : ""}`],
        tab_reach: [m.tab_reach !== null && m.tab_reach >= t.tab_reach, m.tab_reach === null ? "no interactive controls" : `${m.tab_reach} of controls reachable by Tab`],
        phone_overflow: [m.overflow_px <= 1, `${m.overflow_px} px of horizontal overflow at 390 px`],
        tap_targets_44: [m.tap_small_share !== null && m.tap_small_share <= t.tap_targets_44, m.tap_small_share === null ? "no tap targets" : `${m.tap_small_share} of tap targets under 44 px at 390 px`],
        body_font_px: [m.body_font_px !== null && m.body_font_px >= t.body_font_px, `${m.body_font_px} px median body text`],
        ready_ms: [m.ready_ms <= t.ready_ms, Number.isFinite(m.ready_ms) ? `${m.ready_ms} ms until ${c.ready?.selector || "a control"} was visible${c.ready?.js ? ` and ${c.ready.js}` : ""}` : "the readiness signal never held within 10 s"],
        js_kb: [m.js_kb <= t.js_kb, `${m.js_kb} KB of script`],
        frame_p95_ms: [m.frame_p95_ms <= t.frame_p95_ms, `${m.frame_p95_ms} ms frame interval p95 over ${c.play_s ?? 3} s of seeded clicking (${m.workload_clicks} clicks)`],
      };
      return names.map((n) => check(`web:${n}`, val[n][0], val[n][1], { tool: m.tool }));
    } finally { w.cleanup(); }
  }

  async function occlusion(c) {
    const { checkMobileOcclusion } = await importScript("scripts/lib/browser-checks/mobile-occlusion.mjs");
    const w = uiCopy();
    const app = await startApp(w.dir, { start: "npm start", ready: spec.ready || "/", waitMs: 20000 });
    try {
      if (!app.up) return [check("mobile_occlusion", false, `app did not start: ${app.log().trim().slice(-100)}`)];
      const vp = c.viewport || { width: 390, height: 844 };
      const results = [];
      let session = "anonymous only (this product has no sign-in form)";
      await withBrowser(async (browser) => {
        const ctx = await browser.newContext({ viewport: vp, isMobile: true, hasTouch: true });
        const page = await ctx.newPage();
        const scan = async (label, paths) => {
          for (const p of paths) {
            await page.goto(app.base + p, { waitUntil: "load", timeout: 8000 }).catch(() => {});
            const r = await checkMobileOcclusion(page, { viewport: vp, safeAreaBottom: c.safeAreaBottom ?? 34 });
            results.push({ label: `${label} ${p}`, ...r });
          }
        };
        const paths = c.pages || ["/"];
        await scan("anonymous", paths);
        if (c.login === "auto") {
          const auth = await loginAuto(ctx, page, app.base, { verify: c.verify });
          if (auth.authenticated) {
            // Routes are discovered in this same signed-in context.
            const found = await discoverPages(browser, app.base, { max: 4, ctx });
            await scan("signed in", [...new Set([...paths, ...found.pages])].slice(0, 4));
            session = `signed in, verified by ${auth.via} answering 200 to this session and refusing an anonymous one`;
          } else if (auth.attempted) session = "NOT AUTHENTICATED: a sign-in form was found and submitted, but no protected route accepted the session; anonymous screens only";
        }
        await ctx.close();
      });
      const bad = results.filter((r) => !r.pass);
      return [check("mobile_occlusion", results.length > 0 && !bad.length, `${session}. ${bad.length ? bad.slice(0, 2).map((r) => `${r.label}: ${r.detail}`).join("; ") : `${results.length} screens clear at ${vp.width}x${vp.height}`}`)];
    } finally { app.stop(); w.cleanup(); }
  }

  // --- review reports (security-payments) ----------------------------------------------

  function reportFile() { return spec.report || "SECURITY.json"; }
  function reportParses() {
    const list = readFindings(dir, reportFile());
    return [check("report:parses", Boolean(list) && list.length > 0, list ? `${list.length} findings` : `${reportFile()} is missing or not a JSON array`)];
  }
  function reportActionable(c) {
    const list = readFindings(dir, reportFile());
    if (!list?.length) return [check("report:actionable", false, "no findings to judge")];
    const cue = new RegExp(c.cue || "\\b(can|could|allows?|lets?|attacker|anyone|any (customer|user)|forg\\w*|bypass\\w*|steal|leak\\w*|exposes?|crash\\w*|stuck|lose|loss|pay|refund\\w*|tamper\\w*|skips?|logs?|written|secrets?)\\b", "i");
    const weak = list.filter((f) => String(f.issue || "").trim().length < (c.min_chars ?? 40) || !cue.test(f.issue));
    return [check("report:actionable", !weak.length, weak.length ? `${weak.length} of ${list.length} findings state no attack or impact (${weak.slice(0, 2).map((f) => `${f.file}:${f.line}`).join(", ")})` : `all ${list.length} findings state the attack or its impact`)];
  }
  function reportSeverity(c) {
    const list = readFindings(dir, reportFile());
    if (!list?.length) return [check("report:severity_calibrated", false, "no findings to judge")];
    const wrong = [];
    let judged = 0;
    for (const want of c.expect) {
      const hit = list.find((f) => findingMatches(f, want));
      if (!hit) continue;
      judged++;
      if ((SEVERITY_RANK[String(hit.severity).toUpperCase()] || 0) < SEVERITY_RANK[want.min_severity]) wrong.push(`${want.file}:${want.line} rated ${hit.severity}, at least ${want.min_severity} expected`);
    }
    return [check("report:severity_calibrated", judged > 0 && !wrong.length, !judged ? "none of the known defects is in the report, so nothing to calibrate" : wrong.slice(0, 3).join("; ") || `${judged} money and auth defects rated at or above their floor`)];
  }
  function srcUnmodified(c) {
    const base = path.join(TASKS, task, c.baseline || "repo", c.src || "src");
    const sha = (d) => crypto.createHash("sha256").update(listFiles(d).map((f) => `${f}\0${fs.readFileSync(path.join(d, f))}`).join("\n")).digest("hex");
    const same = fs.existsSync(path.join(dir, c.src || "src")) && sha(base) === sha(path.join(dir, c.src || "src"));
    return [check("src_unmodified", same, same ? "the reviewed code is untouched, so the report matches what ships" : "src/ differs from the code that was reviewed")];
  }
}
