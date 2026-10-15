#!/usr/bin/env python3
"""Generic retirement-gate template.

Control flow for permanently deleting old cloud resources after a cutover.
Provider calls stay outside this file. The in-memory check proves four
doctored inputs fail closed. Running this file does not contact a cloud
and does not delete anything.
"""
import datetime as dt
import hashlib
import json
import tempfile
from pathlib import Path

NOT_FOUND_MARKERS = ("ResourceNotFound", "could not be found")
VOLATILE = {"etag", "lastModified", "provisioningState", "systemData"}


class GateError(Exception):
    def __init__(self, gate, why):
        super().__init__(f"{gate}: {why}")
        self.gate = gate
        self.why = why


def stable_hash(value):
    """Hash configuration. Volatile provider fields are stripped first."""

    def strip(node):
        if isinstance(node, list):
            return [strip(item) for item in node]
        if isinstance(node, dict):
            return {key: strip(node[key]) for key in sorted(node) if key not in VOLATILE}
        return node

    raw = json.dumps(strip(value), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode()).hexdigest()


def iter_slots(window_start, last, interval):
    """Slots whose interval has fully elapsed, including the final slot.

    `slot < last - interval` skips that last slot. Use `slot + interval <= last`.
    """
    slot = window_start
    while slot + interval <= last:
        yield slot
        slot += interval


def check_soak(rows, window_start, last, interval, probe_names, old_apps):
    missing, failing = [], []
    checked = 0
    wanted = set(probe_names)
    for slot in iter_slots(window_start, last, interval):
        got = [row for row in rows if row.get("at") == slot and row.get("kind") != "metrics"]
        names = {row.get("name") for row in got}
        if wanted and not wanted <= names:
            missing.append(slot)
        elif got and not all(row.get("ok") for row in got if row.get("name") in wanted):
            failing.append(slot)
        checked += 1
    hours = {}
    for row in rows:
        if row.get("kind") != "metrics" or not row.get("ok"):
            continue
        at = row["at"]
        if not (window_start <= at < last):
            continue
        hour = at.replace(minute=0, second=0, microsecond=0)
        hours.setdefault(hour, set()).add(row.get("app"))
    good = {hour for hour, apps in hours.items() if set(old_apps) <= apps}
    expected = int((last - window_start).total_seconds() // 3600)
    return {
        "ok": not missing and not failing and len(good) >= expected,
        "slotsChecked": checked,
        "missing": missing,
        "failing": failing,
        "metricHours": len(good),
        "expectedMetricHours": expected,
    }


def require_list(returncode, payload, stderr=""):
    """A failed or null read is not an empty inventory.

    stderr is accepted so callers can pass the CLI text through, and then
    ignored: phrases like "empty" or "throttled" are not an inventory.
    """
    del stderr
    if returncode != 0:
        raise GateError("read", "query failed; this is not an empty result")
    if payload is None:
        raise GateError("read", "null is not an empty list")
    if not isinstance(payload, list):
        raise GateError("read", "expected a list")
    return payload


def is_gone(returncode, stderr):
    """Gone only on an explicit not-found signal."""
    if returncode == 0:
        return False
    text = stderr or ""
    return any(marker in text for marker in NOT_FOUND_MARKERS)


def require_gone(returncode, stderr, name):
    if not is_gone(returncode, stderr):
        raise GateError("delete", f"{name} is not proven gone")


def assert_group_empty(returncode, payload, name):
    """A failed or null child listing is not an empty group."""
    children = require_list(returncode, payload)
    if children:
        raise GateError("group", f"{name} still has children")


def deletion_plan(seen_ids, allow_ids, protected_ids):
    """Delete only the allow-list. Unknown ids are kept."""
    allow, protected, seen = set(allow_ids), set(protected_ids), set(seen_ids)
    if not allow:
        raise GateError("inventory", "empty allow-list")
    if allow & protected:
        raise GateError("inventory", "allow-list intersects the protected list")
    unknown = sorted(seen - allow - protected)
    return {"delete": sorted(allow), "keep_unknown": unknown}


def protected_diff(before, after, allowed_removals):
    changed = []
    for key in sorted(set(before) | set(after)):
        if before.get(key) == after.get(key):
            continue
        if key in allowed_removals and key in before and key not in after:
            continue
        changed.append(key)
    return changed


def record_managed_group(report, name, present):
    """A child group that lingers is an error, not a warning."""
    report.setdefault("deleted", []).append(
        {"kind": "managed-group", "name": name, "gone": not present}
    )
    if present:
        report.setdefault("errors", []).append(
            {"gate": "managed-group", "why": f"{name} still present"}
        )


def arm_schedule(approval, backup_exported):
    if not approval or not approval.get("allowListSha256") or not approval.get("approvedAt"):
        raise GateError("approval", "record human approval before scheduling")
    if not backup_exported:
        raise GateError("backup", "export configuration and templates before scheduling")


def execute(report_path, body):
    """Every exit writes a report. Unexpected errors still exit non-zero."""
    report = {"ok": False, "errors": [], "gates": {}}
    try:
        body(report)
    except GateError as err:
        report["errors"].append({"gate": err.gate, "why": err.why})
    except Exception as err:
        report["errors"].append({"gate": "exception", "why": type(err).__name__})
    report["ok"] = not report["errors"]
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    return 0 if report["ok"] else 1


def adversarial_cases():
    """Doctored inputs. A name in the returned list failed open."""
    problems = []
    start = dt.datetime(2026, 1, 1, tzinfo=dt.timezone.utc)
    interval = dt.timedelta(minutes=10)
    last = start + dt.timedelta(minutes=30)
    final = start + (2 * interval)
    rows = [
        {"at": start, "kind": "probe", "name": "new-root", "ok": True},
        {"at": start + interval, "kind": "probe", "name": "new-root", "ok": True},
    ]
    soak = check_soak(rows, start, last, interval, ["new-root"], [])
    if soak["ok"] or final not in soak["missing"]:
        problems.append("final-slot")

    hour_last = start + dt.timedelta(hours=2)
    metric_rows = [
        {"at": start, "kind": "metrics", "app": "app-a", "ok": True},
        {"at": start, "kind": "metrics", "app": "app-b", "ok": True},
        {"at": start + dt.timedelta(hours=1), "kind": "metrics", "app": "app-a", "ok": True},
    ]
    metrics = check_soak(metric_rows, start, hour_last, interval, [], ["app-a", "app-b"])
    if metrics["ok"] or metrics["metricHours"] != 1 or metrics["expectedMetricHours"] != 2:
        problems.append("metric-hour")

    try:
        require_list(1, [], "throttled")
        problems.append("errored-read")
    except GateError:
        pass

    ambiguous = False
    if is_gone(1, "AuthorizationFailed") or is_gone(0, "") or not is_gone(1, "ResourceNotFound"):
        ambiguous = True
    try:
        require_list(0, None, "")
        ambiguous = True
    except GateError:
        pass
    try:
        assert_group_empty(0, None, "rg-oldname-prod")
        ambiguous = True
    except GateError:
        pass
    try:
        assert_group_empty(1, [], "rg-oldname-prod")
        ambiguous = True
    except GateError:
        pass
    try:
        require_gone(1, "AuthorizationFailed", "rg-oldname-prod")
        ambiguous = True
    except GateError:
        pass
    if require_list(0, [], "") != []:
        ambiguous = True
    if ambiguous:
        problems.append("ambiguous-lookup")
    return problems


def main():
    dest = Path(tempfile.mkdtemp()) / "retirement-report.json"

    def body(report):
        problems = adversarial_cases()
        report["gates"]["adversarial"] = {"ok": not problems, "problems": problems}
        if problems:
            raise GateError("adversarial", ",".join(problems))

    code = execute(dest, body)
    if code != 0 or not dest.is_file():
        raise SystemExit(1)
    raise SystemExit(0)


if __name__ == "__main__":
    main()
