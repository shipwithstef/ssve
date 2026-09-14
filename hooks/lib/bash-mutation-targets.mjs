import path from "node:path";
import { lexSimpleCommand } from "../codex/lib/argv-lex.mjs";

const MUTATING = new Set(["touch", "truncate", "rm", "unlink", "mkdir", "rmdir"]);

function unquote(value) {
  const text = String(value || "").trim();
  if ((text.startsWith("'") && text.endsWith("'")) ||
      (text.startsWith('"') && text.endsWith('"'))) return text.slice(1, -1);
  return text;
}

function add(out, value, cwd) {
  const candidate = unquote(value).replace(/[;,]$/, "");
  if (!candidate || candidate === "/dev/null" || /[$`*?{}[\]]/.test(candidate)) return;
  out.add(path.isAbsolute(candidate) ? path.normalize(candidate) : path.resolve(cwd, candidate));
}

function simpleTargets(command, cwd, out) {
  const lexed = lexSimpleCommand(command);
  if (!lexed.ok) return;
  const argv = [...lexed.argv];
  while (["env", "command", "sudo"].includes(path.basename(argv[0] || ""))) {
    const wrapper = path.basename(argv.shift());
    if (wrapper === "env") {
      while (argv.length) {
        if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(argv[0])) { argv.shift(); continue; }
        if (["-u", "--unset", "-C", "--chdir", "-S", "--split-string"].includes(argv[0])) { argv.splice(0, 2); continue; }
        if (/^--(?:unset|chdir|split-string)=/.test(argv[0]) || argv[0] === "-i" || argv[0] === "--ignore-environment" || argv[0] === "--null") { argv.shift(); continue; }
        break;
      }
    } else if (wrapper === "sudo") {
      while (argv.length) {
        if (["-u", "--user", "-g", "--group", "-h", "--host", "-p", "--prompt", "-C", "--close-from", "-T", "--command-timeout"].includes(argv[0])) { argv.splice(0, 2); continue; }
        if (/^--(?:user|group|host|prompt|close-from|command-timeout)=/.test(argv[0]) || argv[0].startsWith("-")) { argv.shift(); continue; }
        break;
      }
    } else while (argv[0]?.startsWith("-")) argv.shift();
  }
  const executable = path.basename(argv[0] || "");
  const positional = argv.slice(1).filter((arg) => arg !== "--" && !arg.startsWith("-"));
  if (MUTATING.has(executable)) positional.forEach((target) => add(out, target, cwd));
  if (["cp", "mv", "ln", "install"].includes(executable)) {
    const targetAt = argv.findIndex((arg) => ["-t", "--target-directory"].includes(arg));
    const attachedTarget = argv.find((arg) => arg.startsWith("--target-directory="));
    if (targetAt >= 0 && argv[targetAt + 1]) add(out, argv[targetAt + 1], cwd);
    else if (attachedTarget) add(out, attachedTarget.slice(attachedTarget.indexOf("=") + 1), cwd);
    else if (positional.length > 1) add(out, positional.at(-1), cwd);
  }
  if (executable === "tee") positional.forEach((target) => add(out, target, cwd));
  if (executable === "sed" && argv.some((arg) => /^-.*i/.test(arg))) positional.slice(1).forEach((target) => add(out, target, cwd));
  if (executable === "perl" && argv.some((arg) => /^-[A-Za-z]*i/.test(arg))) {
    let skipNext = false;
    argv.slice(1).forEach((arg) => {
      if (skipNext) { skipNext = false; return; }
      if (["-e", "-E"].includes(arg)) { skipNext = true; return; }
      if (!arg.startsWith("-")) add(out, arg, cwd);
    });
  }
  if (executable === "dd") for (const arg of argv.slice(1)) if (arg.startsWith("of=")) add(out, arg.slice(3), cwd);
  if (["sh", "bash", "zsh"].includes(executable)) {
    const at = argv.indexOf("-c");
    if (at >= 0 && argv[at + 1]) classifyInto(argv[at + 1], cwd, out);
  }
}

function literalArguments(source, method, positions = [0]) {
  const found = [];
  const call = new RegExp(`\\b${method.replaceAll(".", "\\.")}\\s*\\(([^)]*)\\)`, "g");
  for (const match of source.matchAll(call)) {
    const args = match[1].match(/(?:"[^"]*"|'[^']*'|[^,])+/g) || [];
    for (const position of positions) if (args[position] && /^\s*["']/.test(args[position])) found.push(args[position].trim());
  }
  return found;
}

function classifyInto(source, cwd, out) {
  simpleTargets(source, cwd, out);

  for (const segment of source.split(/(?:&&|\|\||(?<!\|)\|(?!\|)|;|\n)/)) simpleTargets(segment.trim(), cwd, out);

  for (const method of ["writeFileSync", "appendFileSync", "writeFile", "appendFile", "truncateSync", "unlinkSync", "rmSync", "mkdirSync"]) {
    for (const target of literalArguments(source, method)) add(out, target, cwd);
  }
  for (const method of ["renameSync", "rename", "copyFileSync", "copyFile"]) {
    for (const target of literalArguments(source, method, [1])) add(out, target, cwd);
  }
  for (const method of ["File.write", "File.binwrite", "File.rename", "FileUtils.cp", "FileUtils.mv"]) {
    for (const target of literalArguments(source, method, method === "File.write" || method === "File.binwrite" ? [0] : [1])) add(out, target, cwd);
  }
}

/**
 * Conservatively identify concrete filesystem mutation targets in a Bash tool
 * command. Dynamic paths are deliberately omitted: the authority dispatcher
 * remains responsible for ambiguous-shell denial, while these targets extend
 * the path-specific guards to common indirect writers.
 */
export function classifyBashMutationTargets(command, { cwd = process.cwd() } = {}) {
  const source = String(command || "");
  const out = new Set();

  classifyInto(source, cwd, out);

  // Redirections cover heredocs, jq output, printf/echo writes and shell file
  // creation. Skip descriptor duplication such as 2>&1.
  for (const match of source.matchAll(/(?:^|[^><])(?:\d*)>>?\s*(?!&)("[^"]+"|'[^']+'|[^\s;&|]+)/g)) {
    add(out, match[1], cwd);
  }

  // Python inline writers: open(path, write-mode), pathlib write_* and touch.
  for (const match of source.matchAll(/(?:open|Path)\(\s*(["'][^"']+["'])\s*(?:,\s*["'](?:w|a|x|wb|ab|xb)[^"']*["'])?/g)) {
    const call = match[0];
    if (/^open/.test(call) && !/,\s*["'](?:w|a|x|wb|ab|xb)/.test(call)) continue;
    const tail = source.slice(match.index + call.length, match.index + call.length + 80);
    if (/^Path/.test(call) && !/\.write_(?:text|bytes)|\.touch\(/.test(tail)) continue;
    add(out, match[1], cwd);
  }

  // sed -i and tee in pipelines.
  for (const match of source.matchAll(/\bsed\s+[^\n;&|]*?(?:-i(?:\S*)?|--in-place(?:=\S+)?)\s+[^\n;&|]*?\s+("[^"]+"|'[^']+'|[^\s;&|]+)(?=\s*(?:$|[;&|]))/g)) add(out, match[1], cwd);
  for (const match of source.matchAll(/\btee\s+(?:-[^\s]+\s+)*("[^"]+"|'[^']+'|[^\s;&|]+)/g)) add(out, match[1], cwd);

  return [...out].sort();
}
