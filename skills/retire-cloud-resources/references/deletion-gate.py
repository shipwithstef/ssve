#!/usr/bin/env python3
"""Fail-closed deletion guards for Lane 10 Phase 20+.

Provider calls stay outside this file. Running it does not contact a cloud
and does not delete anything. Committed output uses aliases and hashes.
"""
import datetime as dt
import hashlib
import json
import re
import tempfile
from pathlib import Path

PROVIDER_ID = re.compile(
    r"/subscriptions/[0-9A-Fa-f-]{8,}|arn:[A-Za-z0-9][A-Za-z0-9:._/-]{8,}"
)
TARGET_NOT_FOUND = {"ResourceNotFound", "NotFound", "404"}
REJECT_CODES = {
    "AccountNotFound",
    "AuthenticationFailed",
    "AuthorizationFailed",
    "DependencyNotFound",
    "ExpiredAuthenticationToken",
    "InvalidAuthenticationToken",
    "InvalidAuthenticationTokenTenant",
    "LinkedAuthorizationFailed",
    "ParentResourceNotFound",
    "ResourceCollectionNotFound",
    "SubscriptionNotFound",
}
REQUIRED_GATES = {
    "dry-run": ("inventory", "protected", "soak", "drain", "references", "adversarial"),
    "apply": (
        "inventory",
        "protected",
        "soak",
        "drain",
        "references",
        "adversarial",
        "approval",
        "backup",
        "gone",
        "smoke",
    ),
    "self-test": ("adversarial",),
}
VOLATILE = {"etag", "lastModified", "provisioningState", "systemData"}
METRIC_STEP = dt.timedelta(hours=1)


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


def assert_public_safe(payload):
    """Committed artifacts may contain aliases and hashes, never a resource id."""
    text = payload if isinstance(payload, str) else json.dumps(payload, sort_keys=True, default=_json_default)
    if PROVIDER_ID.search(text):
        raise GateError("redaction", "committed artifact contains a resource id")
    return text


def commit_allow_entry(entry):
    """Restricted entry keeps the exact id. The committed entry does not."""
    if not isinstance(entry, dict):
        raise GateError("redaction", "allow-list entry must be an object")
    resource_id = entry.get("id")
    alias = entry.get("alias")
    kind = entry.get("kind")
    if not isinstance(resource_id, str) or not resource_id.strip():
        raise GateError("redaction", "restricted allow-list entry needs an exact id")
    if not isinstance(alias, str) or not alias.strip():
        raise GateError("redaction", "committed allow-list entry needs an alias")
    if PROVIDER_ID.search(alias) or alias.strip() == resource_id.strip():
        raise GateError("redaction", "alias must not be a full resource id")
    if not isinstance(kind, str) or not kind.strip():
        raise GateError("redaction", "kind is required")
    public = {
        "alias": alias.strip(),
        "sha256": hashlib.sha256(resource_id.encode()).hexdigest(),
        "kind": kind.strip(),
    }
    assert_public_safe(public)
    return public


def canonical_allow_digest(entries):
    if not isinstance(entries, list) or not entries:
        raise GateError("approval", "canonical allow-list is empty")
    raw = json.dumps(entries, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode()).hexdigest()


def _name_list(values, label, allow_empty):
    if isinstance(values, str) or not isinstance(values, (list, tuple)):
        raise GateError("soak", f"{label} must be an explicit list")
    names = []
    for item in values:
        if not isinstance(item, str) or not item.strip():
            raise GateError("soak", f"{label} entries must be non-empty strings")
        names.append(item.strip())
    if not allow_empty and not names:
        raise GateError("soak", f"{label} is empty")
    return names


def validate_metric_contract(contract):
    """Names, inactivity thresholds, and substitutions come from the cutover plan."""
    if not isinstance(contract, dict):
        raise GateError("soak", "cutover plan must define the metric contract")
    names = _name_list(contract.get("names"), "approved metric names", allow_empty=False)
    thresholds = contract.get("inactivity")
    if not isinstance(thresholds, dict) or set(thresholds) != set(names):
        raise GateError("soak", "each approved metric needs an inactivity threshold")
    for name in names:
        limit = thresholds[name]
        if isinstance(limit, bool) or not isinstance(limit, (int, float)) or limit < 0:
            raise GateError("soak", "inactivity threshold must be a non-negative number")
    substitutions = contract.get("substitutions") or {}
    if not isinstance(substitutions, dict):
        raise GateError("soak", "substitutions must be a map")
    approved = set(names)
    for source, target in substitutions.items():
        if not isinstance(source, str) or not source.strip() or target not in approved:
            raise GateError("soak", "substitution target is not an approved metric")
    return names, thresholds, substitutions


def _aware_bounds(window_start, last, interval):
    if not isinstance(window_start, dt.datetime) or not isinstance(last, dt.datetime):
        raise GateError("soak", "window bounds must be datetimes")
    if window_start.tzinfo is None or last.tzinfo is None:
        raise GateError("soak", "window bounds must be timezone-aware")
    if last <= window_start:
        raise GateError("soak", "window must be positive")
    if not isinstance(interval, dt.timedelta) or interval <= dt.timedelta(0):
        raise GateError("soak", "interval must be positive")
    return window_start, last, interval


def iter_slots(window_start, last, interval):
    """Probe slots whose interval has fully elapsed, including the final slot."""
    if interval <= dt.timedelta(0):
        raise GateError("soak", "interval must be positive")
    slot = window_start
    while slot + interval <= last:
        yield slot
        slot += interval


def iter_metric_intervals(window_start, last):
    """Hour blocks anchored at window_start, including a short final block.

    Calendar-hour buckets hide the tail. A 00:30–02:30 window is
    [00:30, 01:30) and [01:30, 02:30), not hours 00 and 01.
    """
    cursor = window_start
    while cursor < last:
        end = min(cursor + METRIC_STEP, last)
        if end <= cursor:
            raise GateError("soak", "metric interval did not advance")
        yield cursor, end
        cursor = end


def _under_threshold(value, limit):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    return value <= limit


def _metric_providers(names, substitutions):
    providers = {name: {name} for name in names}
    for source, target in substitutions.items():
        providers[target].add(source)
    return providers


def _interval_covered(rows, start, end, apps, names, thresholds, providers):
    for app in apps:
        for name in names:
            if not any(_metric_hit(row, start, end, app, providers[name], thresholds[name]) for row in rows):
                return False
    return True


def _metric_hit(row, start, end, app, accepted, limit):
    at = row.get("at")
    return (
        row.get("kind") == "metrics"
        and isinstance(at, dt.datetime)
        and at.tzinfo is not None
        and start <= at < end
        and row.get("app") == app
        and row.get("metric") in accepted
        and _under_threshold(row.get("value"), limit)
    )


def _slot_probes_ok(rows, slot, probes):
    found = {}
    for row in rows:
        if row.get("kind") == "metrics" or row.get("at") != slot:
            continue
        found.setdefault(row.get("name"), []).append(row.get("ok") is True)
    return all(found.get(name) and all(found[name]) for name in probes)


def check_drain(dependencies):
    """Serving dependencies must be drained. Healthy and still serving is not drained."""
    if not isinstance(dependencies, list) or not dependencies:
        raise GateError("drain", "serving-dependency evidence is required")
    failing = []
    for item in dependencies:
        if not isinstance(item, dict):
            raise GateError("drain", "each serving dependency must be an object")
        name = item.get("name")
        if not isinstance(name, str) or not name.strip():
            raise GateError("drain", "each serving dependency needs a name")
        evidence = item.get("evidence")
        assert_public_safe(name)
        if evidence is not None:
            assert_public_safe(evidence)
        drained = item.get("drained") is True and isinstance(evidence, str) and evidence.strip()
        if not drained:
            failing.append(name.strip())
    result = {"ok": not failing, "failing": failing}
    assert_public_safe(result)
    return result


def check_soak(rows, window_start, last, interval, probe_names, old_apps, metric_contract, serving_dependencies):
    """Validate subjects first. Evidence is evaluated only after that succeeds."""
    window_start, last, interval = _aware_bounds(window_start, last, interval)
    probes = _name_list(probe_names, "probe matrix", allow_empty=False)
    apps = _name_list(old_apps, "old apps", allow_empty=False)
    names, thresholds, substitutions = validate_metric_contract(metric_contract)
    drain = check_drain(serving_dependencies)
    if not isinstance(rows, list):
        raise GateError("soak", "evidence rows must be a list")

    missing, failing = [], []
    checked = 0
    for slot in iter_slots(window_start, last, interval):
        checked += 1
        if not _slot_probes_ok(rows, slot, probes):
            missing.append(slot.isoformat())
        else:
            continue
    if checked == 0:
        missing.append(window_start.isoformat())

    providers = _metric_providers(names, substitutions)
    good = 0
    expected = 0
    missing_metrics = []
    for start, end in iter_metric_intervals(window_start, last):
        expected += 1
        if _interval_covered(rows, start, end, apps, names, thresholds, providers):
            good += 1
        else:
            missing_metrics.append(start.isoformat())

    probes_ok = not missing and not failing and checked > 0
    metrics_ok = expected > 0 and good == expected and not missing_metrics
    return {
        "ok": probes_ok and metrics_ok and drain["ok"],
        "slotsChecked": checked,
        "missing": missing,
        "failing": failing,
        "metricHours": good,
        "expectedMetricHours": expected,
        "missingMetricIntervals": missing_metrics,
        "drainFailing": drain["failing"],
    }


def require_list(returncode, payload, stderr=""):
    """A failed or null read is not an empty inventory."""
    del stderr
    if returncode != 0:
        raise GateError("read", "query failed; this is not an empty result")
    if payload is None:
        raise GateError("read", "null is not an empty list")
    if not isinstance(payload, list):
        raise GateError("read", "expected a list")
    return payload


def parse_provider_error(stderr):
    text = stderr or ""
    paren = re.search(r"\(([A-Za-z][A-Za-z0-9]+)\)", text)
    if paren:
        return paren.group(1)
    prefixed = re.match(r"\s*([A-Za-z][A-Za-z0-9]+)\s*:", text)
    if prefixed:
        return prefixed.group(1)
    bare = re.fullmatch(r"\s*([A-Za-z][A-Za-z0-9]+)\s*", text)
    return bare.group(1) if bare else ""


def mentions_exact(text, resource_id):
    if not isinstance(resource_id, str) or not resource_id:
        return False
    pattern = re.compile(
        r"(?<![A-Za-z0-9_./:-])" + re.escape(resource_id) + r"(?![A-Za-z0-9_./:-])"
    )
    return pattern.search(text or "") is not None


def is_gone(returncode, stderr, resource_id):
    """Not-found counts only for the requested resource. Dependency and auth errors do not."""
    if returncode == 0 or not isinstance(resource_id, str) or not resource_id:
        return False
    code = parse_provider_error(stderr)
    if not code or code in REJECT_CODES or code not in TARGET_NOT_FOUND:
        return False
    return mentions_exact(stderr, resource_id)


def require_gone(returncode, stderr, name):
    if not is_gone(returncode, stderr, name):
        raise GateError("delete", f"{name} is not proven gone")


def assert_group_empty(returncode, payload, name):
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
    return {"delete": sorted(allow), "keep_unknown": sorted(seen - allow - protected)}


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
    assert_public_safe(name)
    report.setdefault("deleted", []).append({"kind": "managed-group", "name": name, "gone": not present})
    if present:
        report.setdefault("errors", []).append({"gate": "managed-group", "why": f"{name} still present"})


def assert_approval(approval, canonical_sha256, when):
    if not isinstance(approval, dict):
        raise GateError("approval", f"{when}: recorded human approval is required")
    approver = approval.get("approver")
    if not isinstance(approver, str) or not approver.strip():
        raise GateError("approval", f"{when}: approver identity is required")
    if approval.get("humanApproved") is not True:
        raise GateError("approval", f"{when}: recorded human approval is required")
    approved_at = approval.get("approvedAt")
    if not isinstance(approved_at, str) or not approved_at.strip():
        raise GateError("approval", f"{when}: approval time is required")
    if not isinstance(canonical_sha256, str) or len(canonical_sha256) != 64:
        raise GateError("approval", f"{when}: canonical allow-list digest is required")
    if approval.get("allowListSha256") != canonical_sha256:
        raise GateError("approval", f"{when}: approval digest does not match the canonical allow-list")
    assert_public_safe(approval)


def arm_schedule(approval, backup_exported, canonical_entries):
    assert_approval(approval, canonical_allow_digest(canonical_entries), "schedule")
    if not backup_exported:
        raise GateError("backup", "export configuration and templates before scheduling")


def assert_apply_approval(approval, canonical_entries):
    """Recompute the digest from the current allow-list. A stale approval does not apply."""
    assert_approval(approval, canonical_allow_digest(canonical_entries), "apply")


def decommission_receipt(slug, report_relpath, report):
    """Lane 10 receipt. Links the sanitized gate report and copies no resource ids."""
    if not isinstance(slug, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
        raise GateError("receipt", "slug must be kebab-case")
    if not isinstance(report_relpath, str) or report_relpath.startswith("/") or ".." in report_relpath.split("/"):
        raise GateError("receipt", "report link must be a relative path")
    assert_public_safe(report)
    assert_public_safe(report_relpath)
    text = "\n".join([
        "# Decommission receipt",
        "",
        f"Slug: {slug}",
        f"Detailed gate report: {report_relpath}",
        f"Mode: {report.get('mode')}",
        f"Ok: {bool(report.get('ok'))}",
        "",
        "Full resource identifiers stay in the restricted artifact outside git.",
        "",
    ])
    assert_public_safe(text)
    return text


def seal(report):
    """Failed and missing gates for the selected mode become blocking errors."""
    errors = report.get("errors")
    if not isinstance(errors, list):
        errors = []
        report["errors"] = errors
    gates = report.get("gates")
    if not isinstance(gates, dict):
        gates = {}
        report["gates"] = gates
    seen = {(item.get("gate"), item.get("why")) for item in errors if isinstance(item, dict)}

    def add(gate, why):
        if (gate, why) not in seen:
            errors.append({"gate": gate, "why": why})
            seen.add((gate, why))

    required = REQUIRED_GATES.get(report.get("mode"))
    if required is None:
        add("mode", "mode must be dry-run, apply, or self-test")
        required = ()
    for name, gate in gates.items():
        if isinstance(gate, dict) and gate.get("ok") is False:
            add(name, "gate failed")
    for name in required:
        gate = gates.get(name)
        if not isinstance(gate, dict) or gate.get("ok") is not True:
            add(name, "required gate did not pass")
    report["ok"] = not errors


def _json_default(value):
    if isinstance(value, dt.datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=dt.timezone.utc)
        return value.isoformat()
    raise TypeError(type(value).__name__)


def _fallback_report(mode, gate, why):
    return {
        "ok": False,
        "mode": mode if mode in REQUIRED_GATES else None,
        "errors": [{"gate": gate, "why": why}],
        "gates": {},
    }


def execute(report_path, body):
    """Every exit writes a public report. Write and serialization failures stay non-zero."""
    report = {"ok": False, "errors": [], "gates": {}}
    try:
        body(report)
    except GateError as err:
        report["errors"].append({"gate": err.gate, "why": err.why})
    except Exception as err:
        report["errors"].append({"gate": "exception", "why": type(err).__name__})
    try:
        seal(report)
    except Exception as err:
        report.setdefault("errors", []).append({"gate": "seal", "why": type(err).__name__})
        report["ok"] = False
    mode = report.get("mode")
    try:
        payload = json.dumps(report, indent=2, default=_json_default) + "\n"
        assert_public_safe(payload)
    except GateError as err:
        report = _fallback_report(mode, err.gate, err.why)
        payload = json.dumps(report, indent=2) + "\n"
    except (TypeError, ValueError):
        report = _fallback_report(mode, "report", "serialization failed")
        payload = json.dumps(report, indent=2) + "\n"
    try:
        report_path.write_text(payload)
    except OSError:
        return 1
    return 0 if report.get("ok") else 1


def _expect_error(problems, name, fn):
    try:
        fn()
    except GateError:
        return
    problems.append(name)


def _probe_rows(start, last, interval, name):
    rows = []
    slot = start
    while slot + interval <= last:
        rows.append({"at": slot, "kind": "probe", "name": name, "ok": True})
        slot += interval
    return rows


def _metric(at, app, value=0):
    return {"at": at, "kind": "metrics", "app": app, "metric": "requests", "value": value}


def adversarial_cases():
    """Doctored inputs. A name in the returned list failed open."""
    problems = []
    start = dt.datetime(2026, 1, 1, tzinfo=dt.timezone.utc)
    interval = dt.timedelta(minutes=10)
    last = start + dt.timedelta(minutes=30)
    final = start + (2 * interval)
    contract = {"names": ["requests"], "inactivity": {"requests": 0}, "substitutions": {"legacy_requests": "requests"}}
    drain_ok = [{"name": "old-app", "drained": True, "evidence": "serving dependencies below the plan threshold"}]
    apps = ["app-a", "app-b"]

    rows = [
        {"at": start, "kind": "probe", "name": "new-root", "ok": True},
        {"at": start + interval, "kind": "probe", "name": "new-root", "ok": True},
        _metric(start, "app-a"),
        _metric(start, "app-b"),
    ]
    soak = check_soak(rows, start, last, interval, ["new-root"], apps, contract, drain_ok)
    if soak["ok"] or final.isoformat() not in soak["missing"]:
        problems.append("final-slot")

    _expect_error(problems, "zero-window", lambda: check_soak(
        None, start, start, interval, ["new-root"], apps, contract, drain_ok
    ))
    _expect_error(problems, "zero-interval", lambda: check_soak(
        None, start, last, dt.timedelta(0), ["new-root"], apps, contract, drain_ok
    ))
    _expect_error(problems, "empty-probe-matrix", lambda: check_soak(
        None, start, last, interval, [], apps, contract, drain_ok
    ))
    _expect_error(problems, "missing-subjects", lambda: check_soak(
        None, start, last, interval, ["new-root"], None, contract, drain_ok
    ))

    hour_last = start + dt.timedelta(hours=2)
    metric_rows = _probe_rows(start, hour_last, interval, "new-root") + [
        _metric(start, "app-a"),
        _metric(start, "app-b"),
        _metric(start + dt.timedelta(hours=1), "app-a"),
    ]
    metrics = check_soak(metric_rows, start, hour_last, interval, ["new-root"], apps, contract, drain_ok)
    if metrics["ok"] or metrics["metricHours"] != 1 or metrics["expectedMetricHours"] != 2:
        problems.append("metric-hour")

    anchor = dt.datetime(2026, 1, 1, 0, 30, tzinfo=dt.timezone.utc)
    anchor_end = dt.datetime(2026, 1, 1, 2, 30, tzinfo=dt.timezone.utc)
    anchored_rows = _probe_rows(anchor, anchor_end, interval, "new-root")
    for at in (anchor, dt.datetime(2026, 1, 1, 1, 0, tzinfo=dt.timezone.utc)):
        anchored_rows.extend([_metric(at, "app-a"), _metric(at, "app-b")])
    anchored = check_soak(anchored_rows, anchor, anchor_end, interval, ["new-root"], apps, contract, drain_ok)
    if anchored["ok"] or anchored["missing"] or anchored["metricHours"] != 1 or anchored["expectedMetricHours"] != 2:
        problems.append("anchored-final-hour")
    covered = _probe_rows(anchor, anchor_end, interval, "new-root")
    for at in (anchor, anchor + dt.timedelta(hours=1)):
        covered.extend([_metric(at, "app-a"), _metric(at, "app-b")])
    if not check_soak(covered, anchor, anchor_end, interval, ["new-root"], apps, contract, drain_ok)["ok"]:
        problems.append("anchored-covered-window")

    loud = _probe_rows(start, hour_last, interval, "new-root") + [
        _metric(start, "app-a", 5),
        _metric(start, "app-b", 5),
        _metric(start + dt.timedelta(hours=1), "app-a", 5),
        _metric(start + dt.timedelta(hours=1), "app-b", 5),
    ]
    if check_soak(loud, start, hour_last, interval, ["new-root"], apps, contract, drain_ok)["ok"]:
        problems.append("threshold")
    unknown = _probe_rows(start, hour_last, interval, "new-root") + [
        {"at": start, "kind": "metrics", "app": "app-a", "metric": "cpu", "value": 0},
        {"at": start, "kind": "metrics", "app": "app-b", "metric": "cpu", "value": 0},
    ]
    if check_soak(unknown, start, hour_last, interval, ["new-root"], apps, contract, drain_ok)["metricHours"] != 0:
        problems.append("unknown-metric")

    healthy = check_drain([{"name": "old-app", "healthy": True, "drained": False, "evidence": "requests still arriving"}])
    if healthy["ok"]:
        problems.append("healthy-not-drained")
    _expect_error(problems, "missing-drain-evidence", lambda: check_drain([]))

    _expect_error(problems, "errored-read", lambda: require_list(1, [], "throttled"))
    target = "old-prod-group"
    gone_text = f"(ResourceNotFound) {target} could not be found"
    ambiguous = False
    if is_gone(1, "AuthorizationFailed", target) or is_gone(0, "", target) or not is_gone(1, gone_text, target):
        ambiguous = True
    if is_gone(1, "SubscriptionNotFound: subscription could not be found", target):
        ambiguous = True
    if is_gone(1, "(ResourceNotFound) other-group could not be found", target):
        ambiguous = True
    if is_gone(1, f"(AccountNotFound) account could not be found", target):
        ambiguous = True
    if is_gone(1, f"(AuthenticationFailed) token rejected", target):
        ambiguous = True
    if is_gone(1, f"(DependencyNotFound) {target} could not be found", target):
        ambiguous = True
    if is_gone(1, "could not be found", target):
        ambiguous = True
    try:
        require_list(0, None, "")
        ambiguous = True
    except GateError:
        pass
    try:
        assert_group_empty(0, None, target)
        ambiguous = True
    except GateError:
        pass
    try:
        assert_group_empty(1, [], target)
        ambiguous = True
    except GateError:
        pass
    try:
        require_gone(1, "AuthorizationFailed", target)
        ambiguous = True
    except GateError:
        pass
    if require_list(0, [], "") != []:
        ambiguous = True
    if ambiguous:
        problems.append("ambiguous-lookup")

    listed = [{"alias": "old-prod-group", "kind": "group"}]
    other = [{"alias": "old-prod-group", "kind": "group"}, {"alias": "extra", "kind": "group"}]
    approval = {
        "approver": "operator",
        "humanApproved": True,
        "approvedAt": "2026-01-02T00:00:00Z",
        "allowListSha256": canonical_allow_digest(listed),
    }
    _expect_error(
        problems,
        "approval-identity-and-digest",
        lambda: arm_schedule(
            {"allowListSha256": "f" * 64, "approvedAt": "2026-01-02T00:00:00Z"},
            True,
            listed,
        ),
    )
    try:
        arm_schedule(approval, True, listed)
    except GateError:
        problems.append("approval-valid-schedule")
    _expect_error(problems, "apply-digest-revalidation", lambda: assert_apply_approval(approval, other))
    try:
        assert_apply_approval(approval, listed)
    except GateError:
        problems.append("apply-digest-match")

    synthetic = "/subscriptions/" + ("0" * 8) + "-" + ("0" * 4) + "-" + ("0" * 4) + "-" + ("0" * 4) + "-" + ("0" * 12) + "/resourceGroups/example-group"
    public = commit_allow_entry({"id": synthetic, "alias": "old-prod-group", "kind": "group"})
    if synthetic in json.dumps(public) or "/subscriptions/" in json.dumps(public):
        problems.append("committed-id-leak")
    _expect_error(
        problems,
        "alias-is-id",
        lambda: commit_allow_entry({"id": synthetic, "alias": synthetic, "kind": "group"}),
    )
    _expect_error(
        problems,
        "receipt-leaks-id",
        lambda: decommission_receipt("cutover", "docs/plans/cutover/retirement-report.json", {"mode": "dry-run", "id": synthetic}),
    )
    receipt = decommission_receipt("cutover", "docs/plans/cutover/retirement-report.json", {"mode": "dry-run", "ok": False})
    if "/subscriptions/" in receipt or "old-prod-group" not in receipt and "cutover" not in receipt:
        problems.append("receipt-shape")

    dest = Path(tempfile.mkdtemp()) / "missing-slot.json"

    def missing_body(report):
        report["mode"] = "dry-run"
        failed = dict(soak)
        failed["missing"] = list(soak["missing"]) + [final]
        report["gates"]["soak"] = failed
        for name in ("inventory", "protected", "drain", "references", "adversarial"):
            report["gates"][name] = {"ok": True}
        raise GateError("soak", "missing slot")

    code = execute(dest, missing_body)
    try:
        written = json.loads(dest.read_text())
    except (OSError, json.JSONDecodeError):
        written = {}
    if code == 0 or written.get("ok") is not False or final.isoformat() not in dest.read_text():
        problems.append("missing-slot-report")

    ignored = Path(tempfile.mkdtemp()) / "ignored.json"

    def ignored_body(report):
        report["mode"] = "dry-run"
        report["gates"]["soak"] = {"ok": False, "missing": [final.isoformat()]}
        for name in ("inventory", "protected", "drain", "references", "adversarial"):
            report["gates"][name] = {"ok": True}

    if execute(ignored, ignored_body) == 0 or json.loads(ignored.read_text()).get("ok") is not False:
        problems.append("failed-gate-ignored")

    absent = Path(tempfile.mkdtemp()) / "absent.json"

    def absent_body(report):
        report["mode"] = "apply"
        report["gates"] = {}

    if execute(absent, absent_body) == 0 or json.loads(absent.read_text()).get("ok") is not False:
        problems.append("missing-gates")

    leaked = Path(tempfile.mkdtemp()) / "leaked.json"

    def leaked_body(report):
        report["mode"] = "self-test"
        report["gates"]["adversarial"] = {"ok": True}
        report["errors"].append({"gate": "x", "why": synthetic})

    if execute(leaked, leaked_body) == 0 or "/subscriptions/" in leaked.read_text():
        problems.append("report-leaks-id")

    blocked = Path(tempfile.mkdtemp())

    def blocked_body(report):
        report["mode"] = "self-test"
        report["gates"]["adversarial"] = {"ok": True}

    if execute(blocked, blocked_body) != 1:
        problems.append("report-write-failure")
    return problems


def main():
    dest = Path(tempfile.mkdtemp()) / "retirement-report.json"

    def body(report):
        problems = adversarial_cases()
        report["mode"] = "self-test"
        report["gates"]["adversarial"] = {"ok": not problems, "problems": problems}
        if problems:
            raise GateError("adversarial", ",".join(problems))

    code = execute(dest, body)
    if code != 0 or not dest.is_file():
        raise SystemExit(1)
    written = json.loads(dest.read_text())
    if written.get("ok") is not True:
        raise SystemExit(1)
    raise SystemExit(0)


if __name__ == "__main__":
    main()
