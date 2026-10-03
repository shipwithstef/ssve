#!/usr/bin/env bash
set -euo pipefail
umask 077
orch_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)
printf 'Boot startup requires linger. If disabled, ask the owner to run: sudo loginctl enable-linger %s\n' "$(id -un)"
if [[ $(loginctl show-user "$(id -un)" -p Linger --value) != yes ]]; then
  printf 'Linger is disabled; enable it before installing. No sudo command was run.\n' >&2
  exit 1
fi
orch_node=$(command -v node)
orch_units="$HOME/.config/systemd/user"
orch_config="$HOME/.config/orch"
mkdir -p -- "$orch_units" "$orch_config"
if [[ ! -f "$orch_config/serve.env" ]]; then
  printf 'ORCH_SERVE_BIND=127.0.0.1\nORCH_SERVE_PORT=8787\n' > "$orch_config/serve.env"
fi
# Escape systemd quoted strings and specifiers; preserve the installed CLI PATH.
python3 - "$orch_root" "$orch_node" "$PATH" "$orch_units" <<'PY'
import pathlib, re, sys
root, node, cli_path, units = sys.argv[1:]
def quote(value):
    return '"' + value.replace('\\', '\\\\').replace('"', '\\"').replace('%', '%%') + '"'
for template in (pathlib.Path(root) / 'scripts/orch/systemd').glob('*.service'):
    text = template.read_text()
    text = text.replace('WorkingDirectory=@ORCH_ROOT@', 'WorkingDirectory=' + root.replace('%', '%%'))
    text = text.replace('Environment=PATH=@ORCH_PATH@', 'Environment=' + quote('PATH=' + cli_path))
    text = re.sub(r'@ORCH_NODE@ @ORCH_ROOT@(/scripts/orch/\S+)', lambda m: quote(node) + ' ' + quote(root + m[1]), text)
    (pathlib.Path(units) / template.name).write_text(text)
PY
systemd-analyze --user verify "$orch_units"/orch-{recover,collect,serve,preempt}.service
systemctl --user daemon-reload
systemctl --user enable orch-recover.service
systemctl --user enable --now orch-collect.service orch-serve.service orch-preempt.service
systemctl --user --no-pager --full status orch-collect.service orch-serve.service orch-preempt.service
