#!/usr/bin/env bash
# Tier-1 validator: open proposals that reach the SLA age must be triaged.
# Origin: WI-210.

set -euo pipefail

# Keep standalone invocation isolated from active host/session state.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/fixture-home.sh"
svc_require_fixture "$@"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

PASS=0
FAIL=0

pass() {
  echo "  ✓ $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  ✗ $1"
  FAIL=$((FAIL + 1))
}

run_check() {
  local root="$1"
  local today="$2"
  node --input-type=module - "$root" "$today" "$REPO_ROOT" <<'NODE'
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const { isValidWiId } = await import(pathToFileURL(path.join(process.argv[4], "hooks/lib/wi-id.mjs")));

const root = process.argv[2];
const todayText = process.argv[3];
const dayMs = 24 * 60 * 60 * 1000;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseDay(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ageDays(fileName, today) {
  const proposalDate = parseDay(fileName.slice(0, 10));
  if (!proposalDate) return null;
  return Math.floor((today.getTime() - proposalDate.getTime()) / dayMs);
}

function extractBodyMetadata(body) {
  const metadata = {};
  for (const line of body.split("\n")) {
    const match = line.match(/^\s*(?:\*\*)?(accepted_wi|backlog_wi|rejected_reason|deferred_until|reason|blocked_reason)(?:\*\*)?\s*:\s*(.+?)\s*$/i);
    if (match && match[2].trim()) {
      metadata[match[1].toLowerCase()] = match[2].trim();
    }
  }
  return metadata;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateDisposition(fileName, metadata, today, rootPath, errors) {
  const hasAccepted = isNonEmptyString(metadata.accepted_wi);
  const hasBacklog = Object.hasOwn(metadata, "backlog_wi");
  const hasRejected = isNonEmptyString(metadata.rejected_reason);
  const hasDeferred = isNonEmptyString(metadata.deferred_until);

  if (!hasAccepted && !hasBacklog && !hasRejected && !hasDeferred) {
    errors.push(`${fileName}: missing accepted_wi, backlog_wi, rejected_reason, or deferred_until`);
    return;
  }

  if (hasBacklog) {
    if (hasAccepted || hasRejected || hasDeferred) errors.push(`${fileName}: backlog_wi conflicts with another disposition`);
    if (!isValidWiId(metadata.backlog_wi)) errors.push(`${fileName}: backlog_wi must use the canonical WI identifier grammar`);
    else {
      const wiPath=path.join(rootPath, "docs/specs/work-items", `${metadata.backlog_wi}.md`);
      if (!fs.existsSync(wiPath)) errors.push(`${fileName}: backlog_wi ${metadata.backlog_wi} does not exist`);
      else {
        const status=fs.readFileSync(wiPath,"utf8").match(/^\*\*Status:\*\*\s*(.+)$/mi)?.[1] || "";
        if (!/^(backlog|pending|blocked|identified|in_progress|in-progress|in progress|planned|draft)\b/i.test(status)) errors.push(`${fileName}: backlog_wi must have an explicit unfinished status`);
      }
    }
    if (!isNonEmptyString(metadata.reason)) errors.push(`${fileName}: backlog_wi requires a reason`);
  }

  if (hasAccepted && !isValidWiId(metadata.accepted_wi)) {
    errors.push(`${fileName}: accepted_wi must use the canonical WI identifier grammar`);
  }

  if (hasAccepted) {
    const wiPath = path.join(rootPath, "docs", "specs", "work-items", `${metadata.accepted_wi}.md`);
    if (!fs.existsSync(wiPath)) {
      errors.push(`${fileName}: accepted_wi ${metadata.accepted_wi} does not exist`);
    }
  }

  if (hasDeferred) {
    const deferred = parseDay(metadata.deferred_until);
    if (!deferred) {
      errors.push(`${fileName}: deferred_until must be YYYY-MM-DD`);
    } else if (deferred.getTime() < today.getTime()) {
      errors.push(`${fileName}: deferred_until ${metadata.deferred_until} has expired`);
    } else if (Number.isInteger(metadata.max_defer_days)) {
      const deferDays = Math.floor((deferred.getTime() - today.getTime()) / dayMs);
      if (deferDays > metadata.max_defer_days && !isNonEmptyString(metadata.blocked_reason)) {
        errors.push(`${fileName}: deferred_until beyond ${metadata.max_defer_days} days requires blocked_reason`);
      }
    }
    if (!isNonEmptyString(metadata.reason)) {
      errors.push(`${fileName}: deferred_until requires a non-empty reason`);
    }
  }
}

function validate(rootPath, todayText) {
  const today = parseDay(todayText);
  if (!today) throw new Error(`invalid today: ${todayText}`);

  const proposalsDir = path.join(rootPath, "proposals");
  const triagePath = path.join(proposalsDir, "triage.json");
  const errors = [];

  if (!fs.existsSync(triagePath)) {
    return { errors: ["proposals/triage.json is missing"], total: 0, dispositioned: 0 };
  }

  const triage = readJson(triagePath);
  if (triage.schema !== 1) {
    errors.push("proposals/triage.json schema must be 1");
  }
  if (!Number.isInteger(triage.max_open_days) || triage.max_open_days < 1) {
    errors.push("proposals/triage.json max_open_days must be an integer >= 1");
  }
  if (!Number.isInteger(triage.max_defer_days) || triage.max_defer_days < 1) {
    errors.push("proposals/triage.json max_defer_days must be an integer >= 1");
  }
  if (!triage.entries || typeof triage.entries !== "object" || Array.isArray(triage.entries)) {
    errors.push("proposals/triage.json entries must be an object");
  }

  if (errors.length > 0) return { errors, total: 0, dispositioned: 0 };

  const proposalFiles = fs
    .readdirSync(proposalsDir)
    .filter((fileName) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(fileName))
    .sort();
  const proposalSet = new Set(proposalFiles);
  const doneDir = path.join(proposalsDir, "done");
  const doneProposalSet = fs.existsSync(doneDir)
    ? new Set(
        fs
          .readdirSync(doneDir)
          .filter((fileName) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(fileName))
      )
    : new Set();

  for (const entryName of Object.keys(triage.entries)) {
    if (!proposalSet.has(entryName) && !doneProposalSet.has(entryName)) {
      errors.push(`${entryName}: triage entry has no matching open or archived proposal`);
    }
  }

  let dispositioned = 0;
  for (const fileName of proposalFiles) {
    const body = fs.readFileSync(path.join(proposalsDir, fileName), "utf8");
    const bodyMetadata = extractBodyMetadata(body);
    const registryMetadata = triage.entries[fileName] ?? {};
    const metadata = { max_defer_days: triage.max_defer_days, ...bodyMetadata, ...registryMetadata };
    const before = errors.length;
    validateDisposition(fileName, metadata, today, rootPath, errors);
    if (errors.length === before) dispositioned += 1;
  }

  return { errors, total: proposalFiles.length, dispositioned };
}

const { errors, total, dispositioned } = validate(root, todayText);
console.log(`proposal-triage: ${dispositioned}/${total} direct proposals dispositioned`);
if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}
NODE
}

make_fixture() {
  local root="$1"
  mkdir -p "$root/proposals" "$root/docs/specs/work-items"
}

echo "=== Tier 1: proposal triage SLA ==="

TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

make_fixture "$TMP_ROOT/missing"
printf '# Old proposal\n' > "$TMP_ROOT/missing/proposals/2026-05-01-old.md"
cat > "$TMP_ROOT/missing/proposals/triage.json" <<'JSON'
{ "schema": 1, "max_open_days": 1, "max_defer_days": 14, "entries": {} }
JSON
if run_check "$TMP_ROOT/missing" "2026-05-10" >"$TMP_ROOT"/proposal-triage-missing.out 2>&1; then
  fail "self-test detects missing triage metadata"
else
  pass "self-test detects missing triage metadata"
fi

make_fixture "$TMP_ROOT/deferred"
printf '# Old proposal\n' > "$TMP_ROOT/deferred/proposals/2026-05-01-old.md"
cat > "$TMP_ROOT/deferred/proposals/triage.json" <<'JSON'
{
  "schema": 1,
  "max_open_days": 1,
  "max_defer_days": 14,
  "entries": {
    "2026-05-01-old.md": {
      "deferred_until": "2026-05-20",
      "reason": "Needs dedicated review."
    }
  }
}
JSON
if run_check "$TMP_ROOT/deferred" "2026-05-10" >"$TMP_ROOT"/proposal-triage-deferred.out 2>&1; then
  pass "self-test accepts future deferred_until with reason"
else
  fail "self-test accepts future deferred_until with reason"
fi

make_fixture "$TMP_ROOT/long-deferred-blocked"
printf '# Old proposal\n' > "$TMP_ROOT/long-deferred-blocked/proposals/2026-05-01-old.md"
cat > "$TMP_ROOT/long-deferred-blocked/proposals/triage.json" <<'JSON'
{
  "schema": 1,
  "max_open_days": 1,
  "max_defer_days": 14,
  "entries": {
    "2026-05-01-old.md": {
      "deferred_until": "2026-06-10",
      "reason": "Needs dedicated review.",
      "blocked_reason": "Waiting for external host capability release."
    }
  }
}
JSON
if run_check "$TMP_ROOT/long-deferred-blocked" "2026-05-10" >"$TMP_ROOT"/proposal-triage-long-blocked.out 2>&1; then
  pass "self-test accepts long deferred_until with blocked_reason"
else
  fail "self-test accepts long deferred_until with blocked_reason"
fi

make_fixture "$TMP_ROOT/long-deferred-missing-blocker"
printf '# Old proposal\n' > "$TMP_ROOT/long-deferred-missing-blocker/proposals/2026-05-01-old.md"
cat > "$TMP_ROOT/long-deferred-missing-blocker/proposals/triage.json" <<'JSON'
{
  "schema": 1,
  "max_open_days": 1,
  "max_defer_days": 14,
  "entries": {
    "2026-05-01-old.md": {
      "deferred_until": "2026-06-10",
      "reason": "Needs dedicated review."
    }
  }
}
JSON
if run_check "$TMP_ROOT/long-deferred-missing-blocker" "2026-05-10" >"$TMP_ROOT"/proposal-triage-long-missing.out 2>&1; then
  fail "self-test rejects long deferred_until without blocked_reason"
else
  pass "self-test rejects long deferred_until without blocked_reason"
fi

make_fixture "$TMP_ROOT/accepted"
printf '# Old proposal\naccepted_wi: WI-999\n' > "$TMP_ROOT/accepted/proposals/2026-05-01-old.md"
printf '# WI-999\n' > "$TMP_ROOT/accepted/docs/specs/work-items/WI-999.md"
cat > "$TMP_ROOT/accepted/proposals/triage.json" <<'JSON'
{ "schema": 1, "max_open_days": 1, "max_defer_days": 14, "entries": {} }
JSON
if run_check "$TMP_ROOT/accepted" "2026-05-10" >"$TMP_ROOT"/proposal-triage-accepted.out 2>&1; then
  pass "self-test accepts in-file accepted_wi metadata"
else
  fail "self-test accepts in-file accepted_wi metadata"
fi

# Namespaced work items are canonical too; syntax does not prove existence.
printf '# Named proposal\naccepted_wi: WI-FW-FIXTURE-01\n' > "$TMP_ROOT/accepted/proposals/2026-05-01-old.md"
printf '# WI-FW-FIXTURE-01\n' > "$TMP_ROOT/accepted/docs/specs/work-items/WI-FW-FIXTURE-01.md"
if run_check "$TMP_ROOT/accepted" "2026-05-10" >"$TMP_ROOT/named.out" 2>&1; then
  pass "self-test accepts an existing namespaced WI"
else
  fail "self-test accepts an existing namespaced WI"
fi
rm "$TMP_ROOT/accepted/docs/specs/work-items/WI-FW-FIXTURE-01.md"
if run_check "$TMP_ROOT/accepted" "2026-05-10" >"$TMP_ROOT/named-missing.out" 2>&1; then
  fail "self-test rejects a missing namespaced WI"
elif grep -q 'does not exist' "$TMP_ROOT/named-missing.out"; then
  pass "self-test rejects a missing namespaced WI"
else
  fail "self-test rejects a missing namespaced WI for the wrong reason"
fi

make_fixture "$TMP_ROOT/backlog"
printf '# Proposal\n' > "$TMP_ROOT/backlog/proposals/2026-05-01-old.md"
printf '# WI-FW-BACKLOG\n\n**Status:** backlog\n' > "$TMP_ROOT/backlog/docs/specs/work-items/WI-FW-BACKLOG.md"
printf '# WI-DONE\n\n**Status:** VERIFIED\n' > "$TMP_ROOT/backlog/docs/specs/work-items/WI-DONE.md"
for scenario in valid missing-wi missing-reason conflicting wrong-type empty terminal; do
  node --input-type=module - "$TMP_ROOT/backlog/proposals/triage.json" "$scenario" <<'JS'
import fs from 'node:fs';const [p,scenario]=process.argv.slice(2);
const e={backlog_wi:'WI-FW-BACKLOG',reason:'Owned unfinished work; preserve owner freeze.'};
if(scenario==='missing-wi')e.backlog_wi='WI-MISSING';
if(scenario==='missing-reason')delete e.reason;
if(scenario==='conflicting')e.deferred_until='2026-05-11';
if(scenario==='wrong-type'){e.backlog_wi=7;e.rejected_reason='wrong type must not be ignored';}
if(scenario==='empty'){e.backlog_wi='';e.rejected_reason='empty must not be ignored';}
if(scenario==='terminal')e.backlog_wi='WI-DONE';
fs.writeFileSync(p,JSON.stringify({schema:1,max_open_days:1,max_defer_days:14,entries:{'2026-05-01-old.md':e}}));
JS
  result=0
  run_check "$TMP_ROOT/backlog" "2026-05-10" >"$TMP_ROOT/backlog-$scenario.out" 2>&1 || result=$?
  if [[ "$scenario" == valid && "$result" == 0 ]] || [[ "$scenario" != valid && "$result" != 0 ]]; then
    pass "backlog disposition $scenario"
  else
    cat "$TMP_ROOT/backlog-$scenario.out"
    fail "backlog disposition $scenario"
  fi
done

TODAY="${PROPOSAL_TRIAGE_TODAY:-$(date -u +%F)}"
if run_check "$REPO_ROOT" "$TODAY" >"$TMP_ROOT"/proposal-triage-current.out 2>&1; then
  cat "$TMP_ROOT"/proposal-triage-current.out
  pass "all SLA-aged open proposals have triage metadata"
else
  cat "$TMP_ROOT"/proposal-triage-current.out
  fail "all SLA-aged open proposals have triage metadata"
fi

if grep -Eq '^proposal-triage: [0-9]+/[0-9]+ direct proposals dispositioned$' "$TMP_ROOT"/proposal-triage-current.out \
  && awk -F'[:/ ]+' '/^proposal-triage:/{exit !($2==$3)}' "$TMP_ROOT"/proposal-triage-current.out; then
  pass "current validator prints a complete numerator/denominator"
else
  fail "current validator does not prove numerator equals denominator"
fi

if grep -Fq "max_open_days" proposals/triage.json; then
  pass "triage registry declares the SLA window"
else
  fail "triage registry declares the SLA window"
fi

echo
echo "proposal triage SLA: $PASS passed, $FAIL failed"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
