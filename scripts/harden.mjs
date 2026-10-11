#!/usr/bin/env node
/**
 * harden.mjs — static checks selected by file type (organism plan P1.3c).
 *
 *   node scripts/harden.mjs --root <dir> [--file <path>]... [--files a,b]
 *                            [--changed a,b] [--profile prototype|mvp|production]
 *
 * http/server: input validation, authz on every route, errors that do not crash,
 *              no secrets in code or logs.
 * money:       integer cents, server-side price, idempotency.
 * ui:          basic accessibility.
 * js:          JSON.parse outside try, .then without a rejection handler.
 *
 * Stdout is one JSON report. Exit 0 when clean, 1 when there are findings,
 * 2 on a bad invocation. Heuristics only — no network and no runtime probes.
 */
import fs from "node:fs";
import path from "node:path";
import { isMain } from "./lib/is-main.mjs";

const SCAN_EXT = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".vue", ".svelte", ".html", ".htm"]);
const JS_EXT = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".vue", ".svelte", ".html", ".htm"]);
const UI_EXT = new Set([".jsx", ".tsx", ".vue", ".svelte", ".html", ".htm"]);
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage", ".next", ".svc", "vendor"]);
const MAX_BYTES = 700_000;
const CATEGORY_ORDER = ["http", "money", "ui", "js"];

const FIX = {
  "json-parse-without-try": "Wrap JSON.parse in try/catch and handle invalid JSON without crashing.",
  "unhandled-promise": "Attach .catch or pass an onRejected handler so a rejection is not unhandled.",
  "http-input-validation": "Validate request body, query, and params (schema or explicit checks) before use.",
  "http-authz": "Authorize this route (middleware or an explicit public marker) before the handler runs.",
  "http-error-handling": "Wrap the handler in try/catch and send an error response instead of crashing.",
  "http-secret-in-code": "Remove the hardcoded secret and read it from the environment at runtime.",
  "http-secret-in-log": "Do not log secrets, tokens, or passwords.",
  "money-integer-cents": "Store and charge money as integer cents, not a floating-point amount.",
  "money-server-price": "Price the charge on the server from the catalog; do not trust a client-sent price.",
  "money-idempotency": "Pass an idempotency key so a retry cannot double-charge.",
  "ui-img-alt": "Give the image an alt attribute (use an empty alt only when it is decorative).",
  "ui-button-name": "Give the button visible text or an aria-label.",
  "ui-input-label": "Associate the input with a label, aria-label, or aria-labelledby.",
  "ui-click-target": "Use a button, or add a role and a keyboard handler, so the control is accessible.",
};

const RULES_BY_CATEGORY = {
  http: ["http-input-validation", "http-authz", "http-error-handling", "http-secret-in-code", "http-secret-in-log"],
  money: ["money-integer-cents", "money-server-price", "money-idempotency"],
  ui: ["ui-img-alt", "ui-button-name", "ui-input-label", "ui-click-target"],
  js: ["json-parse-without-try", "unhandled-promise"],
};

const SECRET_ASSIGN = new RegExp(
  "\\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|private[_-]?key|auth[_-]?token)\\b\\s*[:=]\\s*(['\"`])([^'\"`\\n]{8,})\\1",
  "i",
);
const LOG_CALL = /\b(?:console|logger|log)\s*\.\s*(?:log|debug|info|warn|error|trace)\s*\(([^)\n]*)\)/;
const LEAK_IDENT = /\b(?:password|passwd|secret|api_?key|apiKey|accessToken|access_token|privateKey|private_key|sessionToken|authorization|token)\b/;
const MONEY_DECIMAL = /\b(price|amount|cost|total|fee|subtotal|unit_amount|unitAmount|price_cents|amount_cents|unit_amount_cents)\b\s*[:=]\s*(?:parseFloat|Number)\s*\(|\b(price|amount|cost|total|fee|subtotal|unit_amount|unitAmount|price_cents|amount_cents|unit_amount_cents)\b\s*[:=]\s*-?\d+\.\d+/;
const CLIENT_PRICE = /\b(?:req|request)\s*\.\s*(?:body|query)\s*\.\s*(?:price|amount|total|fee|unit_amount|unitAmount)\b|(?:const|let|var)\s*\{[^}\n]*\b(?:price|amount|total|fee)\b[^}\n]*\}\s*=\s*(?:req|request)\s*\.\s*body\b/;
const CHARGE_CALL = /\b(?:paymentIntents|charges|refunds)\s*\.\s*create\s*\(|\bcheckout(?:\s*\.\s*\w+)+\s*\.\s*create\s*\(|\bstripe(?:\s*\.\s*\w+)+\s*\.\s*create\s*\(|\b(?:chargeCustomer|createCharge|capturePayment|createPayment)\s*\(/;
const CHARGE_DECL = /\b(?:async\s+)?function\s+(?:chargeCustomer|createCharge|capturePayment|createPayment)\s*\(/g;
const INPUT_READ = /\b(?:req|request)\s*\.\s*(?:body|query|params)\b|\bawait\s+(?:req|request)\s*\.\s*json\s*\(|\b(?:req|request)\s*\.\s*json\s*\(/;
const VALIDATION = /\b(?:safeParse|z\.\w+|zod|joi|ajv|validator|\.validate\s*\(|schema|typeof\s|Number\.isFinite|Number\.isInteger|if\s*\(\s*!)/i;
const AUTHZ = /\b(?:requireAuth|requireUser|ensureAuth|ensureLoggedIn|isAuthenticated|authorize|withAuth|verifyToken|jwtVerify|passport|req\.user|request\.user|currentUser|getServerSession|getSession|assertCan|permission|authenticate|authenticated)\b/;
const PUBLIC_ROUTE = /(?:\/\/|\*)\s*public\b|\b(?:publicRoute|allowAnonymous|skipAuth)\b/;
const THROWS = /\b(?:await|throw)\b/;
const HANDLED = /\btry\b|\basyncHandler\b|\bcatchAsync\b|\bwrapAsync\b/;
const ROUTE_PATTERNS = [
  { re: /\b(?:app|router|server|fastify)\s*\.\s*(?:get|post|put|patch|delete|all|head|options)\s*\(/g, kind: "call" },
  { re: /\bhttp\.createServer\s*\(/g, kind: "call" },
  { re: /\bDeno\.serve\s*\(/g, kind: "call" },
  { re: /export\s+(?:async\s+)?function\s+(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b[^{]*\{/g, kind: "body" },
  { re: /export\s+const\s+(?:GET|POST|PUT|PATCH|DELETE)\b[^{]*\{/g, kind: "body" },
];

function toPosix(rel) {
  return rel.split(path.sep).join("/");
}

function lineAt(text, index) {
  let line = 1;
  const end = Math.min(index, text.length);
  for (let i = 0; i < end; i++) if (text[i] === "\n") line++;
  return line;
}

function stripLineComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === "\"" || c === "`") { quote = c; continue; }
    if (c === "/" && line[i + 1] === "/") return line.slice(0, i);
  }
  return line;
}

function stripStrings(fragment) {
  return fragment.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, "''");
}

function visibleLine(line) {
  return stripStrings(stripLineComment(line));
}

function isTestPath(rel) {
  return /(^|\/)(?:__tests__|e2e)\//.test(rel)
    || /(^|\/)tests?\//.test(rel)
    || /\.(?:test|spec)\.[^.]+$/.test(rel);
}

function isHttpPath(rel) {
  return /(^|\/)(?:server|routes?|router|api|handlers?|controllers?|middleware)\.[^/]+$/i.test(rel)
    || /(^|\/)(?:routes?|api|controllers?|handlers?|middleware|pages\/api|app\/api)\//i.test(rel)
    || /\/route\.[cm]?[jt]sx?$/i.test(rel);
}

function isHttpText(text) {
  return /\b(?:app|router|server|fastify)\s*\.\s*(?:get|post|put|patch|delete|all|head|options)\s*\(/.test(text)
    || /export\s+(?:async\s+)?function\s+(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/.test(text)
    || /export\s+const\s+(?:GET|POST|PUT|PATCH|DELETE)\b/.test(text)
    || /\b(?:http\.createServer|Deno\.serve)\s*\(/.test(text);
}

function isMoneyPath(rel) {
  return /(^|\/)[^/]*(?:pay|billing|checkout|invoice|stripe|wallet|charge|price)[^/]*$/i.test(rel);
}

function isMoneyText(text) {
  return /\b(?:stripe|paymentIntents|payment_intent|chargeCustomer|createCharge|capturePayment|createPayment|amount_cents|price_cents|unit_amount)\b/.test(text)
    || /\b(?:checkout\.sessions|charges\.create|refunds\.create)\b/.test(text);
}

function isUiText(text) {
  return /<(?:img|button|input|div|span)\b/i.test(text);
}

export function classifyFile(rel, text) {
  const ext = path.extname(rel).toLowerCase();
  const cats = [];
  if (isHttpPath(rel) || isHttpText(text)) cats.push("http");
  if (isMoneyPath(rel) || isMoneyText(text)) cats.push("money");
  if (UI_EXT.has(ext) || (SCAN_EXT.has(ext) && isUiText(text))) cats.push("ui");
  if (JS_EXT.has(ext)) cats.push("js");
  return CATEGORY_ORDER.filter((cat) => cats.includes(cat));
}

function rulesFor(categories) {
  const rules = [];
  for (const cat of categories) rules.push(...RULES_BY_CATEGORY[cat]);
  return rules;
}

function placeholderSecret(value) {
  if (value.length < 8) return true;
  if (value.includes("${")) return true;
  return /^(?:changeme|placeholder|example|redacted|dummy|fake|password|secret|token|your-api-key|todo|test-key|xxx+|n\/a)$/i.test(value);
}

function skipWsComments(text, index) {
  let i = index;
  while (i < text.length) {
    const c = text[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") { i++; continue; }
    if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i = Math.min(text.length, i + 2);
      continue;
    }
    break;
  }
  return i;
}

function readIdent(text, index) {
  if (!/[A-Za-z_$]/.test(text[index] || "")) return null;
  let i = index + 1;
  while (i < text.length && /[A-Za-z0-9_$]/.test(text[i])) i++;
  return { word: text.slice(index, i), end: i };
}

function balancedEnd(text, openIdx) {
  const open = text[openIdx];
  const close = open === "(" ? ")" : open === "{" ? "}" : open === "[" ? "]" : "";
  if (!close) return null;
  let depth = 0;
  let quote = null;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === "\"" || c === "`") { quote = c; continue; }
    if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i = Math.min(text.length, i + 1);
      continue;
    }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return null;
}

function callInfo(text, openParen) {
  let depth = 0;
  let topComma = false;
  let quote = null;
  for (let i = openParen; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === "\"" || c === "`") { quote = c; continue; }
    if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }
    if (c === "(") {
      depth++;
    } else if (c === ")") {
      depth--;
      if (depth === 0) return { end: i + 1, topComma };
    } else if (c === "," && depth === 1) topComma = true;
  }
  return { end: text.length, topComma };
}

function promiseChainHandled(text, dotIndex) {
  let i = dotIndex;
  for (let guard = 0; guard < 50; guard++) {
    if (text[i] === "?" && text[i + 1] === ".") i += 1;
    if (text[i] !== ".") return false;
    const ident = readIdent(text, i + 1);
    if (!ident) return false;
    const after = skipWsComments(text, ident.end);
    if (text[after] !== "(") return false;
    const call = callInfo(text, after);
    if (call.end <= after) return false;
    if (ident.word === "catch") return true;
    if (ident.word === "then" && call.topComma) return true;
    if (ident.word !== "then" && ident.word !== "finally") return false;
    const next = skipWsComments(text, call.end);
    if (!(text[next] === "." || (text[next] === "?" && text[next + 1] === "."))) return false;
    i = next;
  }
  return false;
}

function precededByThen(text, dotIndex) {
  let j = dotIndex - 1;
  while (j >= 0 && /\s/.test(text[j])) j--;
  if (text[j] !== ")") return false;
  let depth = 0;
  for (let k = j; k >= 0; k--) {
    const c = text[k];
    if (c === ")") depth++;
    else if (c === "(") {
      depth--;
      if (depth === 0) {
        let p = k - 1;
        while (p >= 0 && /\s/.test(text[p])) p--;
        const end = p;
        while (p >= 0 && /[A-Za-z0-9_$]/.test(text[p])) p--;
        return text.slice(p + 1, end + 1) === "then";
      }
    }
  }
  return false;
}

function scanJs(text) {
  const hits = [];
  let i = 0;
  let line = 1;
  let depth = 0;
  const tryStack = [];
  let pendingTry = false;
  while (i < text.length) {
    const c = text[i];
    if (c === "\n") { line++; i++; continue; }
    if (c === " " || c === "\t" || c === "\r") { i++; continue; }
    if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) {
        if (text[i] === "\n") line++;
        i++;
      }
      i = Math.min(text.length, i + 2);
      continue;
    }
    if (c === "'" || c === "\"" || c === "`") {
      const q = c;
      i++;
      while (i < text.length) {
        if (text[i] === "\\") { i += 2; continue; }
        if (text[i] === "\n") line++;
        if (text[i] === q) { i++; break; }
        i++;
      }
      continue;
    }
    if (c === "{") {
      depth++;
      if (pendingTry) { tryStack.push(depth); pendingTry = false; }
      i++;
      continue;
    }
    if (c === "}") {
      if (tryStack.length && tryStack[tryStack.length - 1] === depth) tryStack.pop();
      depth = Math.max(0, depth - 1);
      i++;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      const startLine = line;
      const ident = readIdent(text, i);
      i = ident.end;
      if (ident.word === "try") pendingTry = true;
      else pendingTry = false;
      if (ident.word === "JSON" && text.slice(i, i + 6) === ".parse" && tryStack.length === 0) {
        hits.push({ line: startLine, rule: "json-parse-without-try" });
      }
      continue;
    }
    if (c === "?" && text[i + 1] === ".") { i++; continue; }
    if (c === ".") {
      const ident = readIdent(text, i + 1);
      if (ident && ident.word === "then") {
        const after = skipWsComments(text, ident.end);
        if (text[after] === "(" && !precededByThen(text, i) && !promiseChainHandled(text, i)) {
          hits.push({ line, rule: "unhandled-promise" });
        }
      }
      pendingTry = false;
      i++;
      continue;
    }
    if (c !== "(") pendingTry = false;
    i++;
  }
  return hits;
}

function collectRoutes(text) {
  const routes = [];
  const seen = new Set();
  for (const { re } of ROUTE_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const openAt = m.index + m[0].length - 1;
      const end = balancedEnd(text, openAt);
      if (end == null || seen.has(m.index)) continue;
      seen.add(m.index);
      routes.push({ start: m.index, end });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  routes.sort((a, b) => a.start - b.start);
  return routes;
}

function leadingNotes(text, index) {
  const lines = text.slice(0, index).split("\n");
  const kept = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed === "") continue;
    if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
      kept.push(lines[i]);
      continue;
    }
    break;
  }
  return kept.reverse().join("\n");
}

function firstIn(text, from, to, regex) {
  const m = new RegExp(regex.source, regex.flags.replace("g", "")).exec(text.slice(from, to));
  if (!m) return null;
  return lineAt(text, from + m.index);
}

function checkHttp(text, findings) {
  for (const route of collectRoutes(text)) {
    const body = text.slice(route.start, route.end);
    const notes = leadingNotes(text, route.start);
    if (INPUT_READ.test(body) && !VALIDATION.test(body)) {
      findings.push({ line: firstIn(text, route.start, route.end, INPUT_READ), rule: "http-input-validation" });
    }
    if (!AUTHZ.test(body) && !PUBLIC_ROUTE.test(notes) && !PUBLIC_ROUTE.test(body)) {
      findings.push({ line: lineAt(text, route.start), rule: "http-authz" });
    }
    if (THROWS.test(body) && !HANDLED.test(body)) {
      findings.push({ line: firstIn(text, route.start, route.end, THROWS), rule: "http-error-handling" });
    }
  }
  const lines = text.split("\n");
  for (let n = 0; n < lines.length; n++) {
    const code = stripLineComment(lines[n]);
    const assigned = new RegExp(SECRET_ASSIGN.source, "i").exec(code);
    if (assigned && !placeholderSecret(assigned[2])) {
      findings.push({ line: n + 1, rule: "http-secret-in-code" });
    }
    const logged = LOG_CALL.exec(code);
    if (logged && LEAK_IDENT.test(stripStrings(logged[1]))) {
      findings.push({ line: n + 1, rule: "http-secret-in-log" });
    }
  }
}

function isChargeInvocation(visible) {
  if (!CHARGE_CALL.test(visible)) return false;
  // A declaration (`function chargeCustomer(`) is not a charge. Strip those
  // so a real call on the same line still counts.
  return CHARGE_CALL.test(visible.replace(CHARGE_DECL, ""));
}

function checkMoney(text, findings) {
  const lines = text.split("\n");
  let idempotent = false;
  const chargeAt = [];
  for (let n = 0; n < lines.length; n++) {
    const visible = visibleLine(lines[n]);
    if (/idempotency/i.test(visible)) idempotent = true;
    if (MONEY_DECIMAL.test(visible)) findings.push({ line: n + 1, rule: "money-integer-cents" });
    if (CLIENT_PRICE.test(visible)) findings.push({ line: n + 1, rule: "money-server-price" });
    if (isChargeInvocation(visible)) chargeAt.push(n + 1);
  }
  if (!idempotent) {
    for (const line of chargeAt) findings.push({ line, rule: "money-idempotency" });
  }
}

function tagAttrs(text, start) {
  let i = start;
  let quote = null;
  let brace = 0;
  const from = start;
  while (i < text.length && i - from < 4000) {
    const c = text[i];
    if (quote) {
      if (c === "\\") { i += 2; continue; }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === "'" || c === "\"" || c === "`") { quote = c; i++; continue; }
    if (c === "{") { brace++; i++; continue; }
    if (c === "}") { brace = Math.max(0, brace - 1); i++; continue; }
    if (c === ">" && brace === 0) return text.slice(start, i);
    i++;
  }
  return text.slice(start, i);
}

function wrappedInLabel(text, openIndex) {
  const before = text.slice(0, openIndex);
  const open = Math.max(before.toLowerCase().lastIndexOf("<label"), -1);
  if (open < 0) return false;
  const close = before.toLowerCase().lastIndexOf("</label");
  return open > close;
}

function inputLabeled(text, attrs) {
  if (/\baria-label(?:ledby)?\s*=/.test(attrs)) return true;
  const idm = /\bid\s*=\s*["'{]([^"'}]+)["'}]/.exec(attrs);
  if (!idm) return false;
  const id = idm[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("\\b(?:for|htmlFor)\\s*=\\s*[\"'{]" + id + "[\"'}]").test(text);
}

function buttonName(text, afterOpen) {
  const close = text.toLowerCase().indexOf("</button", afterOpen);
  const inner = text.slice(afterOpen, close === -1 ? afterOpen : close);
  const plain = inner.replace(/<[^>]*>/g, "").replace(/\{[^}]*\}/g, "").trim();
  return plain.length > 0;
}

function checkUi(text, findings) {
  const re = /<(img|button|input|div|span)\b/gi;
  let m;
  while ((m = re.exec(text))) {
    const name = m[1].toLowerCase();
    const attrs = tagAttrs(text, m.index + m[0].length - 0);
    const open = text.slice(m.index, m.index + m[0].length + attrs.length);
    const line = lineAt(text, m.index);
    if (name === "img" && !/\balt\s*=/.test(open)) {
      findings.push({ line, rule: "ui-img-alt" });
    } else if (name === "button") {
      const named = /\baria-label(?:ledby)?\s*=/.test(open);
      const after = m.index + m[0].length + attrs.length + 1;
      const selfClose = /\/\s*>$/.test(text.slice(m.index, after));
      if (!named && (selfClose || !buttonName(text, after))) {
        findings.push({ line, rule: "ui-button-name" });
      }
    } else if (name === "input") {
      if (/\btype\s*=\s*["']?(?:hidden|submit|button|reset|image)\b/.test(open)) continue;
      if (!wrappedInLabel(text, m.index) && !inputLabeled(text, open)) {
        findings.push({ line, rule: "ui-input-label" });
      }
    } else if (/(?:onClick|onclick|@click|v-on:click)\s*=/.test(open)) {
      const role = /\brole\s*=/.test(open);
      const keys = /(?:onKeyDown|onKeyUp|onKeyPress|onkeydown|onkeyup|@keydown|v-on:keydown)\s*=/.test(open);
      if (!role || !keys) findings.push({ line, rule: "ui-click-target" });
    }
    if (m.index === re.lastIndex) re.lastIndex++;
  }
}

function finding(file, hit) {
  return {
    file,
    line: hit.line,
    location: `${file}:${hit.line}`,
    rule: hit.rule,
    category: categoryOf(hit.rule),
    fix: FIX[hit.rule],
  };
}

function categoryOf(rule) {
  if (rule.startsWith("http-")) return "http";
  if (rule.startsWith("money-")) return "money";
  if (rule.startsWith("ui-")) return "ui";
  return "js";
}

function checkText(rel, text) {
  const categories = classifyFile(rel, text);
  const hits = [];
  if (categories.includes("js")) hits.push(...scanJs(text));
  if (categories.includes("http")) checkHttp(text, hits);
  if (categories.includes("money")) checkMoney(text, hits);
  if (categories.includes("ui")) checkUi(text, hits);
  const seen = new Set();
  const findings = [];
  for (const hit of hits) {
    if (!hit.line) continue;
    const key = `${hit.line}:${hit.rule}`;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push(finding(rel, hit));
  }
  return { categories, rules: rulesFor(categories), findings };
}

function walk(dir, rel, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isSymbolicLink()) continue;
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      walk(path.join(dir, ent.name), rel ? `${rel}/${ent.name}` : ent.name, out);
      continue;
    }
    if (!ent.isFile()) continue;
    const child = rel ? `${rel}/${ent.name}` : ent.name;
    if (!SCAN_EXT.has(path.extname(ent.name).toLowerCase())) continue;
    if (isTestPath(child)) continue;
    out.push(child);
  }
}

function resolveInRoot(root, rel) {
  const abs = path.resolve(root, rel);
  const relTo = path.relative(root, abs);
  if (relTo.startsWith("..") || path.isAbsolute(relTo)) {
    throw new Error(`file escapes root: ${rel}`);
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    throw new Error(`not a file: ${rel}`);
  }
  const realRoot = fs.realpathSync(root);
  const real = fs.realpathSync(abs);
  const relReal = path.relative(realRoot, real);
  if (relReal.startsWith("..") || path.isAbsolute(relReal)) {
    throw new Error(`file escapes root: ${rel}`);
  }
  return { abs: real, rel: toPosix(relTo) };
}

export function hardenProject(options = {}) {
  const root = path.resolve(options.root || ".");
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`not a directory: ${options.root || "."}`);
  }
  const profile = options.profile || "production";
  let rels;
  if (options.files && options.files.length) {
    rels = options.files.map((rel) => resolveInRoot(root, rel).rel);
  } else {
    rels = [];
    walk(root, "", rels);
  }
  rels.sort();
  const selection = [];
  const findings = [];
  for (const rel of rels) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      throw new Error(`not a file: ${rel}`);
    }
    if (fs.statSync(abs).size > MAX_BYTES) continue;
    const text = fs.readFileSync(abs, "utf8");
    const checked = checkText(toPosix(rel), text);
    selection.push({ file: toPosix(rel), categories: checked.categories, rules: checked.rules });
    findings.push(...checked.findings);
  }
  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule));
  return {
    tool: "harden",
    mode: "static",
    profile,
    ok: findings.length === 0,
    scanned: selection.map((row) => row.file),
    selection,
    findings,
  };
}

function parseArgs(argv) {
  const opts = { root: ".", files: [], profile: "production", help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") opts.help = true;
    else if (a === "--root" || a === "--profile") {
      const value = argv[++i];
      if (!value) throw new Error(`missing value for ${a}`);
      if (a === "--root") opts.root = value;
      else opts.profile = value;
    } else if (a === "--file") {
      const value = argv[++i];
      if (!value) throw new Error("missing value for --file");
      opts.files.push(value);
    } else if (a === "--files" || a === "--changed") {
      const value = argv[++i];
      if (!value) throw new Error(`missing value for ${a}`);
      opts.files.push(...value.split(",").map((part) => part.trim()).filter(Boolean));
    } else if (a.startsWith("-")) throw new Error(`unknown argument: ${a}`);
    else opts.files.push(a);
  }
  return opts;
}

function run(argv) {
  const opts = parseArgs(argv);
  if (opts.help) {
    process.stdout.write("usage: node scripts/harden.mjs --root <dir> [--file <path>]... [--files a,b] [--profile prototype|mvp|production]\n");
    return 0;
  }
  const report = hardenProject(opts);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report.ok ? 0 : 1;
}

if (isMain(import.meta.url)) {
  try {
    process.exit(run(process.argv.slice(2)));
  } catch (err) {
    process.stderr.write(`harden: ${err.message}\n`);
    process.exit(2);
  }
}
