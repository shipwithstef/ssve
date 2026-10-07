export const SHELL_TOOLS = new Set([
  "Bash",
  "exec_command",
  "functions.exec_command",
  "Shell",
  "run_shell_command",
  "shell",
  "run_terminal_command",
]);

export function isShellTool(name) {
  return SHELL_TOOLS.has(String(name || ""));
}
