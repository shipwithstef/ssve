/** Parse the routing CLI without loading the index or changing routing policy. */
export function parseArgs(argv) {
  const args = { _: [] };
  const values = { "--root": "root", "--intent": "intent", "--files": "files", "--packages": "packages",
    "--env": "env", "--active-skill": "activeSkill", "--next-skill": "nextSkill", "--mode": "mode" };
  const lists = new Set(["files", "packages", "env"]);
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--help" || flag === "-h") { args.help = true; continue; }
    if (flag === "--check") { args.check = true; continue; }
    if (flag === "--no-receipts") { args.noReceipts = true; continue; }
    if (Object.hasOwn(values, flag)) {
      const value = argv[++i]; const key = values[flag];
      if (value === undefined || value.startsWith("--")) throw new Error(`${flag} requires a value`);
      args[key] = lists.has(key) ? [...new Set(value.split(",").map((part) => part.trim()).filter(Boolean))] : value;
    } else if (flag.startsWith("-")) throw new Error(`unknown flag: ${flag}`);
    else args._.push(flag);
  }
  if (args._.length > 1) throw new Error(`unexpected positional argument: ${args._[1]}`);
  if (args.mode !== undefined && !["off", "shadow", "suggest", "active"].includes(args.mode)) {
    throw new Error("--mode must be off, shadow, suggest, or active");
  }
  return args;
}
