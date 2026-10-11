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
 * Profiles select which checks run (default: prototype):
 *   prototype   static smoke checks only
 *   mvp         static checks, plus the project's own tests via node --test
 *               when a test script or node --test file is present (must pass)
 *   production  mvp, plus quality-probes when scripts/quality-probes.mjs is
 *               present (mutation score at least 0.6)
 *
 * Stdout is one JSON report. Exit 0 when clean, 1 when there are findings,
 * 2 on a bad invocation. Offline only — no network.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
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
  "own-tests": "Add a test script whose tests exist and pass under node --test.",
  "mutation-threshold": "Strengthen tests until the mutation score reaches the production threshold.",
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
const INPUT_READ = /\b(?:req|request)\s*\.\s*(?:body|query|params)\b|\bawait\s+(?:req|request)\s*\.\s*json\s*\(|\b(?:req|request)\s*\.\s*json\s*\(/;
const VALIDATION = /\b(?:safeParse|z\.\w+|zod|joi|ajv|validator|\.validate\s*\(|schema|typeof\s|Number\.isFinite|Number\.isInteger|if\s*\(\s*!)/i;
const AUTHZ = /\b(?:requireAuth|requireUser|ensureAuth|ensureLoggedIn|isAuthenticated|authorize|withAuth|verifyToken|jwtVerify|passport|req\.user|request\.user|currentUser|getServerSession|getSession|assertCan|permission|authenticate|authenticated)\b/;
const PUBLIC_COMMENT = /(?:\/\/|\*)\s*public\b/;
const PUBLIC_CODE = /\b(?:publicRoute|allowAnonymous|skipAuth)\b/;
const THROWS = /\b(?:await|throw)\b/;
const HANDLED = /\btry\b|\basyncHandler\b|\bcatchAsync\b|\bwrapAsync\b/;
const PROFILES = new Set(["prototype", "mvp", "production"]);
const MUTATION_THRESHOLD = 0.6;
const EXPR_KW = new Set(["return", "throw", "case", "typeof", "void", "delete", "await", "yield", "new", "in", "of", "instanceof", "else", "do"]);
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
  const args = [];
  let argStart = openParen + 1;
  let paren = 0;
  let brace = 0;
  let bracket = 0;
  let quote = null;
  let i = openParen;
  while (i < text.length) {
    const c = text[i];
    if (quote) {
      if (c === "\\") { i += 2; continue; }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === "'" || c === "\"" || c === "`") { quote = c; i++; continue; }
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
    if (c === "(") paren++;
    else if (c === ")") {
      paren--;
      if (paren === 0) {
        args.push(text.slice(argStart, i));
        return { end: i + 1, args };
      }
    } else if (c === "{") brace++;
    else if (c === "}") brace = Math.max(0, brace - 1);
    else if (c === "[") bracket++;
    else if (c === "]") bracket = Math.max(0, bracket - 1);
    else if (c === "," && paren === 1 && brace === 0 && bracket === 0) {
      args.push(text.slice(argStart, i));
      argStart = i + 1;
    }
    i++;
  }
  args.push(text.slice(argStart));
  return { end: text.length, args };
}

function maskComments(text) {
  const chars = text.split("");
  let i = 0;
  let quote = null;
  while (i < text.length) {
    const c = text[i];
    if (quote) {
      if (c === "\\") { i += 2; continue; }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === "'" || c === "\"" || c === "`") { quote = c; i++; continue; }
    if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") {
        chars[i] = " ";
        i++;
      }
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      chars[i] = " ";
      chars[i + 1] = " ";
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) {
        if (chars[i] !== "\n") chars[i] = " ";
        i++;
      }
      if (i < text.length) chars[i] = " ";
      if (i + 1 < text.length) chars[i + 1] = " ";
      i += 2;
      continue;
    }
    i++;
  }
  return chars.join("");
}

function isRejectionHandler(src) {
  const visible = maskComments(src).replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, " ").trim();
  if (!visible) return false;
  if (visible === "null" || visible === "undefined") return false;
  if (/^void\s+0$/.test(visible)) return false;
  return true;
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
    if (ident.word === "then" && call.args.length >= 2 && isRejectionHandler(call.args[1])) return true;
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

function skipRegexLiteral(text, index) {
  let j = index + 1;
  let inClass = false;
  while (j < text.length) {
    const c = text[j];
    if (c === "\n") return null;
    if (c === "\\") { j += 2; continue; }
    if (inClass) {
      if (c === "]") inClass = false;
      j++;
      continue;
    }
    if (c === "[") { inClass = true; j++; continue; }
    if (c === "/") {
      j++;
      while (j < text.length && /[A-Za-z]/.test(text[j])) j++;
      return j;
    }
    j++;
  }
  return null;
}

function precededByAwait(text, dotIndex) {
  let j = dotIndex - 1;
  while (j >= 0) {
    while (j >= 0 && /\s/.test(text[j])) j--;
    if (j < 0) return false;
    const c = text[j];
    if (/[A-Za-z0-9_$]/.test(c)) {
      const end = j;
      while (j >= 0 && /[A-Za-z0-9_$]/.test(text[j])) j--;
      const word = text.slice(j + 1, end + 1);
      if (word === "await" && (j < 0 || !/[A-Za-z0-9_$]/.test(text[j]))) return true;
      continue;
    }
    if (c === "." || c === "(" || c === "[") { j--; continue; }
    if (c === ")" || c === "]") {
      const open = c === ")" ? "(" : "[";
      let depth = 1;
      j--;
      let quote = null;
      while (j >= 0 && depth > 0) {
        const d = text[j];
        if (quote) {
          if (d === quote && text[j - 1] !== "\\") quote = null;
          j--;
          continue;
        }
        if (d === "'" || d === "\"" || d === "`") { quote = d; j--; continue; }
        if (d === c) depth++;
        else if (d === open) depth--;
        j--;
      }
      continue;
    }
    return false;
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
  let expectRegex = true;
  const frames = [{ kind: "code", base: 0 }];
  const inTemplate = () => frames[frames.length - 1].kind === "tmpl";
  while (i < text.length) {
    const c = text[i];
    if (c === "\n") { line++; i++; continue; }
    if (inTemplate()) {
      if (c === "\\") { i += 2; continue; }
      if (c === "`") { frames.pop(); i++; continue; }
      if (c === "$" && text[i + 1] === "{") {
        depth++;
        frames.push({ kind: "code", base: depth });
        expectRegex = true;
        pendingTry = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
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
    if (c === "/" && text[i + 1] !== "=" && expectRegex) {
      const end = skipRegexLiteral(text, i);
      if (end != null) {
        i = end;
        expectRegex = false;
        pendingTry = false;
        continue;
      }
    }
    if (c === "'" || c === "\"" || c === "`") {
      if (c === "`") { frames.push({ kind: "tmpl", base: 0 }); i++; continue; }
      const q = c;
      i++;
      while (i < text.length) {
        if (text[i] === "\\") { i += 2; continue; }
        if (text[i] === "\n") line++;
        if (text[i] === q) { i++; break; }
        i++;
      }
      expectRegex = false;
      pendingTry = false;
      continue;
    }
    if (c === "=" && text[i + 1] === ">") {
      i += 2;
      expectRegex = true;
      pendingTry = false;
      continue;
    }
    if (c === "=") {
      // =, ==, and === can be followed by a regex literal. => was consumed above.
      i++;
      expectRegex = true;
      pendingTry = false;
      continue;
    }
    if (c === "{") {
      depth++;
      if (pendingTry) { tryStack.push(depth); pendingTry = false; }
      expectRegex = true;
      i++;
      continue;
    }
    if (c === "}") {
      if (tryStack.length && tryStack[tryStack.length - 1] === depth) tryStack.pop();
      depth = Math.max(0, depth - 1);
      const frame = frames[frames.length - 1];
      if (frames.length > 1 && frame.kind === "code" && depth < frame.base) frames.pop();
      expectRegex = true;
      pendingTry = false;
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
      expectRegex = EXPR_KW.has(ident.word);
      continue;
    }
    if (/[0-9]/.test(c)) {
      while (i < text.length && /[0-9]/.test(text[i])) i++;
      expectRegex = false;
      pendingTry = false;
      continue;
    }
    if (c === "?" && text[i + 1] === ".") { expectRegex = false; i++; continue; }
    if (c === ".") {
      const ident = readIdent(text, i + 1);
      if (ident && ident.word === "then") {
        const after = skipWsComments(text, ident.end);
        if (text[after] === "(" && !precededByThen(text, i) && !promiseChainHandled(text, i)) {
          if (!(tryStack.length > 0 && precededByAwait(text, i))) {
            hits.push({ line, rule: "unhandled-promise" });
          }
        }
      }
      pendingTry = false;
      expectRegex = false;
      i++;
      continue;
    }
    if ("([{,;:!?~+-*%&|^<>".includes(c)) {
      if (c !== "(") pendingTry = false;
      expectRegex = true;
      i++;
      continue;
    }
    if (c !== "(") pendingTry = false;
    i++;
  }
  return hits;
}

function commentText(text) {
  const parts = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "/" && text[i + 1] === "/") {
      const start = i;
      while (i < text.length && text[i] !== "\n") i++;
      parts.push(text.slice(start, i));
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      const start = i;
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      const end = Math.min(text.length, i + 2);
      parts.push(text.slice(start, end));
      i = end;
      continue;
    }
    if (c === "'" || c === "\"" || c === "`") {
      const q = c;
      i++;
      while (i < text.length) {
        if (text[i] === "\\") { i += 2; continue; }
        if (q !== "`" && text[i] === "\n") break;
        if (text[i] === q) { i++; break; }
        i++;
      }
      continue;
    }
    i++;
  }
  return parts.join("\n");
}

function findFunctionBrace(text, from) {
  let i = skipWsComments(text, from);
  if (/[A-Za-z_$]/.test(text[i] || "")) {
    const ident = readIdent(text, i);
    i = skipWsComments(text, ident.end);
  }
  if (text[i] === "(") {
    const end = balancedEnd(text, i);
    if (end == null) return null;
    i = skipWsComments(text, end);
  }
  return text[i] === "{" ? i : null;
}

function functionBodyRanges(text) {
  const ranges = [];
  let i = 0;
  let expectRegex = true;
  const frames = [{ kind: "code" }];
  while (i < text.length) {
    const c = text[i];
    if (frames[frames.length - 1].kind === "tmpl") {
      if (c === "\\") { i += 2; continue; }
      if (c === "`") { frames.pop(); i++; continue; }
      if (c === "$" && text[i + 1] === "{") { frames.push({ kind: "code" }); i += 2; continue; }
      i++;
      continue;
    }
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
    if (c === "/" && text[i + 1] !== "=" && expectRegex) {
      const end = skipRegexLiteral(text, i);
      if (end != null) { i = end; expectRegex = false; continue; }
    }
    if (c === "'" || c === "\"") {
      const q = c;
      i++;
      while (i < text.length && text[i] !== q && text[i] !== "\n") {
        if (text[i] === "\\") i += 2;
        else i++;
      }
      if (text[i] === q) i++;
      expectRegex = false;
      continue;
    }
    if (c === "`") { frames.push({ kind: "tmpl" }); i++; continue; }
    if (c === "=" && text[i + 1] === ">") {
      i += 2;
      const at = skipWsComments(text, i);
      if (text[at] === "{") {
        const end = balancedEnd(text, at);
        if (end != null) ranges.push({ start: at, end });
      }
      expectRegex = true;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      const ident = readIdent(text, i);
      i = ident.end;
      if (ident.word === "function") {
        const brace = findFunctionBrace(text, ident.end);
        if (brace != null) {
          const end = balancedEnd(text, brace);
          if (end != null) ranges.push({ start: brace, end });
        }
      }
      expectRegex = EXPR_KW.has(ident.word);
      continue;
    }
    if (c === ")" || c === "]") { expectRegex = false; i++; continue; }
    if ("([{,;:!?~+-*%&|^<>".includes(c)) { expectRegex = true; i++; continue; }
    expectRegex = false;
    i++;
  }
  return ranges;
}

function scopeId(ranges, index) {
  let best = -1;
  let size = Infinity;
  for (const range of ranges) {
    const span = range.end - range.start;
    if (index >= range.start && index < range.end && span < size) {
      best = range.start;
      size = span;
    }
  }
  return best;
}

function collectRoutes(text) {
  const masked = maskNonCode(text);
  const ranges = functionBodyRanges(text);
  const routes = [];
  const seen = new Set();
  for (const { re } of ROUTE_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(masked))) {
      const openAt = m.index + m[0].length - 1;
      if (text[openAt] !== "(" && text[openAt] !== "{") continue;
      const end = balancedEnd(text, openAt);
      if (end == null || seen.has(m.index)) continue;
      seen.add(m.index);
      routes.push({
        start: m.index,
        end,
        receiver: receiverOf(text, m.index),
        path: text[openAt] === "(" ? readStringArg(text, openAt) : null,
        scope: scopeId(ranges, m.index),
      });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  routes.sort((a, b) => a.start - b.start);
  return routes;
}

function receiverOf(text, index) {
  const ident = readIdent(text, index);
  return ident ? ident.word : "";
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

function readQuoted(text, at) {
  const q = text[at];
  if (q !== "'" && q !== "\"" && q !== "`") return null;
  let i = at + 1;
  let value = "";
  while (i < text.length && text[i] !== q) {
    if (text[i] === "\\") {
      value += text[i + 1] || "";
      i += 2;
      continue;
    }
    if (text[i] === "\n" && q !== "`") return null;
    if (q === "`" && text[i] === "$" && text[i + 1] === "{") return { value: null, end: i };
    value += text[i];
    i++;
  }
  if (text[i] !== q) return null;
  return { value, end: i + 1 };
}

function readStringArg(text, openParen) {
  const at = skipWsComments(text, openParen + 1);
  const quoted = readQuoted(text, at);
  return quoted ? quoted.value : null;
}

function readArrayPaths(text, openBracket) {
  const end = balancedEnd(text, openBracket);
  if (end == null) return null;
  const paths = [];
  let i = openBracket + 1;
  while (i < end - 1) {
    i = skipWsComments(text, i);
    if (i >= end - 1) break;
    if (text[i] === ",") { i++; continue; }
    const quoted = readQuoted(text, i);
    if (!quoted || quoted.value == null) return paths.length ? paths : null;
    paths.push(quoted.value);
    i = quoted.end;
  }
  return paths;
}

function readMount(text, openParen) {
  const at = skipWsComments(text, openParen + 1);
  const c = text[at];
  if (c === "'" || c === "\"" || c === "`") {
    const quoted = readQuoted(text, at);
    if (!quoted || quoted.value == null) return { cover: "none", paths: [] };
    return { cover: "mounts", paths: [quoted.value] };
  }
  if (c === "[") {
    const paths = readArrayPaths(text, at);
    if (paths == null) return { cover: "none", paths: [] };
    return { cover: "mounts", paths };
  }
  if (c === "/") return { cover: "none", paths: [] };
  const ident = readIdent(text, at);
  if (ident) {
    const rest = skipWsComments(text, ident.end);
    if (text[rest] === "," && !AUTHZ.test(ident.word)) return { cover: "none", paths: [] };
    return { cover: "all", paths: [] };
  }
  if (c === "(" || text.startsWith("function", at) || text.startsWith("async", at)) {
    return { cover: "all", paths: [] };
  }
  return { cover: "none", paths: [] };
}

function collectMiddleware(text) {
  const masked = maskNonCode(text);
  const ranges = functionBodyRanges(text);
  const guards = [];
  const re = /\b(app|router|server|fastify)\s*\.\s*use\s*\(/g;
  let m;
  while ((m = re.exec(masked))) {
    const open = m.index + m[0].length - 1;
    if (text[open] !== "(") continue;
    const end = balancedEnd(text, open);
    if (end == null) continue;
    if (!AUTHZ.test(masked.slice(open, end))) continue;
    const mount = readMount(text, open);
    guards.push({
      receiver: m[1],
      index: m.index,
      scope: scopeId(ranges, m.index),
      cover: mount.cover,
      paths: mount.paths,
    });
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return guards;
}

function mountCovers(mount, routePath) {
  if (routePath == null) return false;
  if (mount === "/" || mount === "") return true;
  const base = mount.endsWith("/") ? mount.slice(0, -1) : mount;
  if (!base) return true;
  return routePath === base || routePath.startsWith(`${base}/`);
}

function middlewareCovers(guard, route) {
  if (guard.receiver !== route.receiver || guard.index >= route.start) return false;
  if (guard.scope !== route.scope) return false;
  if (guard.cover === "all") return true;
  if (guard.cover !== "mounts" || route.path == null) return false;
  return guard.paths.some((mount) => mountCovers(mount, route.path));
}

function routeIsPublic(text, route, codeBody) {
  const notes = leadingNotes(text, route.start);
  const comments = `${notes}\n${commentText(text.slice(route.start, route.end))}`;
  return PUBLIC_COMMENT.test(comments) || PUBLIC_CODE.test(codeBody);
}

function checkHttp(text, findings) {
  const masked = maskNonCode(text);
  const guards = collectMiddleware(text);
  for (const route of collectRoutes(text)) {
    const body = masked.slice(route.start, route.end);
    if (INPUT_READ.test(body) && !VALIDATION.test(body)) {
      findings.push({ line: firstIn(masked, route.start, route.end, INPUT_READ), rule: "http-input-validation" });
    }
    const covered = guards.some((guard) => middlewareCovers(guard, route));
    if (!covered && !AUTHZ.test(body) && !routeIsPublic(text, route, body)) {
      findings.push({ line: lineAt(text, route.start), rule: "http-authz" });
    }
    if (THROWS.test(body) && !HANDLED.test(body)) {
      findings.push({ line: firstIn(masked, route.start, route.end, THROWS), rule: "http-error-handling" });
    }
  }
  const lines = maskComments(text).split("\n");
  for (let n = 0; n < lines.length; n++) {
    const assigned = new RegExp(SECRET_ASSIGN.source, "i").exec(lines[n]);
    if (assigned && !placeholderSecret(assigned[2])) {
      findings.push({ line: n + 1, rule: "http-secret-in-code" });
    }
    const logged = LOG_CALL.exec(lines[n]);
    if (logged && LEAK_IDENT.test(stripStrings(logged[1]))) {
      findings.push({ line: n + 1, rule: "http-secret-in-log" });
    }
  }
}

function maskNonCode(text, { preserveKeys = false } = {}) {
  const chars = text.split("");
  const blankAt = (k) => {
    if (k < chars.length && chars[k] !== "\n") chars[k] = " ";
  };
  const frames = [{ kind: "code", brace: 0 }];
  let i = 0;
  while (i < text.length) {
    const frame = frames[frames.length - 1];
    const c = text[i];
    if (frame.kind === "tmpl") {
      if (c === "\\") {
        blankAt(i);
        blankAt(i + 1);
        i += 2;
        continue;
      }
      if (c === "`") {
        blankAt(i);
        i++;
        frames.pop();
        continue;
      }
      if (c === "$" && text[i + 1] === "{") {
        blankAt(i);
        blankAt(i + 1);
        i += 2;
        frames.push({ kind: "code", brace: 0 });
        continue;
      }
      blankAt(i);
      i++;
      continue;
    }
    if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") {
        blankAt(i);
        i++;
      }
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      blankAt(i);
      blankAt(i + 1);
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) {
        blankAt(i);
        i++;
      }
      blankAt(i);
      blankAt(i + 1);
      i += 2;
      continue;
    }
    if (c === "'" || c === "\"") {
      const q = c;
      const start = i;
      let j = i + 1;
      let closed = false;
      while (j < text.length) {
        if (text[j] === "\\") { j += 2; continue; }
        if (text[j] === "\n") break;
        if (text[j] === q) { closed = true; j++; break; }
        j++;
      }
      let keep = false;
      if (preserveKeys && closed) {
        let k = j;
        while (k < text.length && (text[k] === " " || text[k] === "\t")) k++;
        keep = text[k] === ":";
      }
      if (!keep) {
        for (let t = start; t < j && t < chars.length; t++) blankAt(t);
      }
      i = j;
      continue;
    }
    if (c === "`") {
      blankAt(i);
      i++;
      frames.push({ kind: "tmpl" });
      continue;
    }
    if (c === "{") {
      frame.brace++;
      i++;
      continue;
    }
    if (c === "}") {
      if (frame.brace > 0) frame.brace--;
      else if (frames.length > 1) frames.pop();
      i++;
      continue;
    }
    i++;
  }
  return chars.join("");
}

function isDeclarationAt(text, index) {
  const before = text.slice(Math.max(0, index - 40), index);
  return /(?:async\s+)?function\s*$/.test(before);
}

function findChargeCalls(text) {
  const masked = maskNonCode(text, { preserveKeys: true });
  const calls = [];
  const re = new RegExp(CHARGE_CALL.source, "g");
  let m;
  while ((m = re.exec(masked))) {
    if (isDeclarationAt(text, m.index)) {
      if (m.index === re.lastIndex) re.lastIndex++;
      continue;
    }
    const open = m.index + m[0].length - 1;
    const end = text[open] === "(" ? balancedEnd(text, open) : null;
    const span = masked.slice(m.index, end == null ? masked.length : end);
    calls.push({ line: lineAt(text, m.index), idempotent: /idempotency/i.test(span) });
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return calls;
}

function checkMoney(text, findings) {
  const lines = maskComments(text).split("\n");
  for (let n = 0; n < lines.length; n++) {
    const visible = visibleLine(lines[n]);
    if (MONEY_DECIMAL.test(visible)) findings.push({ line: n + 1, rule: "money-integer-cents" });
    if (CLIENT_PRICE.test(visible)) findings.push({ line: n + 1, rule: "money-server-price" });
  }
  for (const call of findChargeCalls(text)) {
    if (!call.idempotent) findings.push({ line: call.line, rule: "money-idempotency" });
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

function expressionCountsAsName(expr) {
  const trimmed = expr.trim();
  if (!trimmed || trimmed.startsWith("/*") || trimmed.startsWith("//")) return false;
  if (/^(?:null|undefined|false|true)$/.test(trimmed)) return false;
  const literal = /^(['"`])([\s\S]*)\1$/.exec(trimmed);
  if (literal && (literal[1] !== "`" || !literal[2].includes("${"))) {
    return literal[2].trim().length > 0;
  }
  // A dynamic child may render a name. Do not report it as absent.
  return true;
}

function buttonName(text, afterOpen) {
  const close = text.toLowerCase().indexOf("</button", afterOpen);
  const inner = text.slice(afterOpen, close === -1 ? afterOpen : close);
  let i = 0;
  while (i < inner.length) {
    if (inner[i] === "<") {
      const end = inner.indexOf(">", i);
      if (end < 0) return true;
      i = end + 1;
      continue;
    }
    if (inner[i] === "{") {
      const end = balancedEnd(inner, i);
      if (end == null) return true;
      if (expressionCountsAsName(inner.slice(i + 1, end - 1))) return true;
      i = end;
      continue;
    }
    if (!/\s/.test(inner[i])) return true;
    i++;
  }
  return false;
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
  if (rule === "own-tests" || rule === "mutation-threshold") return "profile";
  if (rule.startsWith("http-")) return "http";
  if (rule.startsWith("money-")) return "money";
  if (rule.startsWith("ui-")) return "ui";
  return "js";
}

function compareText(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function testScriptOf(root) {
  const pkg = path.join(root, "package.json");
  if (!fs.existsSync(pkg)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(pkg, "utf8"));
    const script = data && data.scripts && data.scripts.test;
    return typeof script === "string" && script.trim() ? script.trim() : null;
  } catch {
    return null;
  }
}

// Filenames node --test runs by default (js/cjs/mjs only). A name like contest.js
// ends in "test.js" but is not a test file; the separator or a test/ directory is required.
function isOwnTestFile(rel) {
  const norm = toPosix(rel);
  if (/(?:^|\/)test\/.+\.[cm]?js$/.test(norm)) return true;
  const base = norm.slice(norm.lastIndexOf("/") + 1);
  return /(?:^|[._-])test\.[cm]?js$/.test(base) || /^test(?:[.-].+)?\.[cm]?js$/.test(base);
}

function listOwnTestFiles(dir, rel = "", out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const ent of entries) {
    if (ent.isSymbolicLink()) continue;
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      listOwnTestFiles(path.join(dir, ent.name), rel ? `${rel}/${ent.name}` : ent.name, out);
      continue;
    }
    if (!ent.isFile()) continue;
    const child = rel ? `${rel}/${ent.name}` : ent.name;
    if (isOwnTestFile(child)) out.push(toPosix(child));
  }
  return out;
}

function runOwnTests(root) {
  const script = testScriptOf(root);
  const files = listOwnTestFiles(root);
  if (!script && files.length === 0) return { ran: false, reason: "not-present", files };
  const env = { ...process.env, PORT: "0", NODE_ENV: "test" };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ["--test", "--test-reporter=tap", "--test-timeout=15000"], {
    cwd: root,
    encoding: "utf8",
    timeout: 20000,
    env,
  });
  const out = `${result.stdout || ""}\n${result.stderr || ""}`;
  const pass = Number(/^# pass (\d+)/m.exec(out)?.[1] ?? 0);
  const fail = Number(/^# fail (\d+)/m.exec(out)?.[1] ?? 0) + Number(/^# cancelled (\d+)/m.exec(out)?.[1] ?? 0);
  return {
    ran: true,
    pass,
    fail,
    files,
    ok: result.status === 0 && pass > 0 && fail === 0,
    timedOut: result.error?.code === "ETIMEDOUT",
  };
}

function runQualityProbes(root) {
  const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "quality-probes.mjs");
  if (!fs.existsSync(script)) return { ran: false, reason: "not-present", threshold: MUTATION_THRESHOLD };
  const env = { ...process.env, PORT: "0", NODE_ENV: "test" };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [script, root, "--mutants", "8"], {
    cwd: root,
    encoding: "utf8",
    timeout: 25000,
    env,
  });
  let score = null;
  let reason = null;
  if (!result.error && result.status === 0) {
    try {
      const body = JSON.parse(result.stdout);
      score = body.mutation?.score ?? null;
      reason = body.mutation?.reason ?? null;
    } catch {
      score = null;
      reason = "unreadable probe output";
    }
  } else if (result.error) {
    reason = result.error.code || "probe failed";
  } else {
    reason = "probe failed";
  }
  const ok = typeof score === "number" && score + 1e-9 >= MUTATION_THRESHOLD;
  return { ran: true, ok, mutation: score, reason, threshold: MUTATION_THRESHOLD };
}

function profilePlan(profile) {
  const checks = ["static-smoke"];
  const thresholds = { staticFindings: 0 };
  if (profile === "mvp" || profile === "production") {
    checks.push("own-tests");
    thresholds.ownTests = "exist-and-pass";
  }
  if (profile === "production") {
    checks.push("quality-probes");
    thresholds.mutation = MUTATION_THRESHOLD;
  }
  const mode = profile === "production"
    ? "static+own-tests+probes"
    : profile === "mvp"
      ? "static+own-tests"
      : "static";
  return { checks, thresholds, mode };
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
  const profile = options.profile || "prototype";
  if (!PROFILES.has(profile)) throw new Error(`unknown profile: ${profile}`);
  const plan = profilePlan(profile);
  let rels;
  if (options.files && options.files.length) {
    rels = options.files.map((rel) => resolveInRoot(root, rel).rel);
  } else {
    rels = [];
    walk(root, "", rels);
  }
  rels.sort(compareText);
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
  let tests = null;
  let probes = null;
  if (plan.checks.includes("own-tests")) {
    tests = runOwnTests(root);
    if (tests.ran && !tests.ok) {
      const where = testScriptOf(root) ? "package.json" : (tests.files[0] || "package.json");
      findings.push(finding(where, { line: 1, rule: "own-tests" }));
    }
  }
  if (plan.checks.includes("quality-probes")) {
    probes = runQualityProbes(root);
    if (probes.ran && !probes.ok) findings.push(finding(".", { line: 1, rule: "mutation-threshold" }));
  }
  findings.sort((a, b) => compareText(a.file, b.file) || a.line - b.line || compareText(a.rule, b.rule));
  return {
    tool: "harden",
    mode: plan.mode,
    profile,
    checks: plan.checks,
    thresholds: plan.thresholds,
    tests,
    probes,
    ok: findings.length === 0,
    scanned: selection.map((row) => row.file),
    selection,
    findings,
  };
}

function parseArgs(argv) {
  const opts = { root: ".", files: [], profile: "prototype", help: false };
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
