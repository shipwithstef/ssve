#!/usr/bin/env bash
# Run one offline validator with private host/account roots and no inherited
# credentials or task authority. Source code remains the candidate under test.
# Callers may source this helper for standalone validators as well as the runner.
svc_run_fixture() (
  set -euo pipefail
  local fixture_base fixture_source fixture_common fixture_root fixture_tmp provider rc
  # Existing ignored evaluation results keep durable fixtures outside operator HOME/XDG configuration.
  fixture_source="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
  fixture_common="$(git -C "$fixture_source" rev-parse --path-format=absolute --git-common-dir)"
  fixture_base="$(dirname "$fixture_common")/test-framework/results"
  mkdir -p "$fixture_base"
  fixture_root="$(mktemp -d "$fixture_base/svc-eval-home-XXXXXX")"
  # Disposable test repositories must not inherit the canonical repository by ancestry.
  fixture_tmp="$(mktemp -d /tmp/svc-eval-tmp-XXXXXX)"
  trap 'rm -rf -- "$fixture_root" "$fixture_tmp"' EXIT
  mkdir -p "$fixture_root/home" "$fixture_root/bin" "$fixture_root/config" "$fixture_root/cache" "$fixture_root/state" "$fixture_root/runtime" "$fixture_root/data"
  chmod 700 "$fixture_root" "$fixture_root"/*
  cat > "$fixture_root/home/.gitconfig" <<'GIT'
[user]
    name = SVC Offline Fixture
    email = fixture@example.invalid
[commit]
    gpgsign = false
[init]
    defaultBranch = main
GIT
  # Fixture-owned fake CLIs can prepend their bin directory as usual. These
  # final guards prevent accidental calls to real subscription transports.
  for provider in claude codex kimi gemini opencode cursor-agent agent grok mimo; do
    cat > "$fixture_root/bin/$provider" <<'PROVIDER'
#!/usr/bin/env bash
printf 'SVC-OFFLINE-PROVIDER: real provider invocation is disabled in Tier 1\n' >&2
exit 78
PROVIDER
    chmod 700 "$fixture_root/bin/$provider"
  done
  # Keep the caller PATH (actions/setup-node, nvm, or the suite node) ahead of
  # /usr/bin:/bin so fixtures do not silently select an older system Node.
  # Join only non-empty components: an empty PATH entry is the current
  # directory in POSIX lookup. Do not bake a workstation node path into this
  # helper.
  local fixture_path part saved_ifs saved_noglob
  fixture_path="$fixture_root/bin"
  if [[ -n "${PATH:-}" ]]; then
    saved_ifs="$IFS"
    saved_noglob=0
    case $- in *f*) saved_noglob=1 ;; esac
    IFS=':'
    set -f
    for part in $PATH; do
      if [[ -n "$part" && "$part" != "." && "$part" != "./" ]]; then
        fixture_path="$fixture_path:$part"
      fi
    done
    if (( saved_noglob == 0 )); then
      set +f
    fi
    IFS="$saved_ifs"
  fi
  fixture_path="$fixture_path:/usr/bin:/bin"
  env -i \
    PATH="$fixture_path" \
    HOME="$fixture_root/home" \
    XDG_CONFIG_HOME="$fixture_root/config" \
    XDG_CACHE_HOME="$fixture_root/cache" \
    XDG_STATE_HOME="$fixture_root/state" \
    XDG_DATA_HOME="$fixture_root/data" \
    XDG_RUNTIME_DIR="$fixture_root/runtime" \
    TMPDIR="$fixture_tmp" \
    GIT_CEILING_DIRECTORIES=/tmp \
    LANG=C.UTF-8 LC_ALL=C.UTF-8 SHELL=/bin/bash \
    USER="$(id -un)" LOGNAME="$(id -un)" \
    GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL="$fixture_root/home/.gitconfig" \
    SVC_TEST_DURABLE_BASE="$fixture_root/cache" \
    SVC_TIER1_FIXTURE_HOME="$fixture_root/home" \
    "$@" && rc=0 || rc=$?
  exit "$rc"
)

# Standalone host validators use the same isolation as the aggregate runner.
# The inner invocation has the marker set by svc_run_fixture and proceeds once.
svc_require_fixture() {
  if [[ "${SVC_TIER1_FIXTURE_HOME:-}" == "$HOME" ]]; then return 0; fi
  local rc
  svc_run_fixture bash "$0" "$@" && rc=0 || rc=$?
  exit "$rc"
}
