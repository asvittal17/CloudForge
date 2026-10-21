
import json
import subprocess
import sys
import tempfile
from pathlib import Path


# Recommendations are guidance, not automatic Terraform modifications.
# These priorities are advisory classifications, not official Checkov severity.
REMEDIATIONS = {
    "CKV_AWS_130": {
        "title": "Disable automatic public IP assignment for private subnets",
        "why": (
            "Automatically assigned public IP addresses can expose instances "
            "to direct internet routing when network controls also permit it."
        ),
        "recommendation": (
            "For private subnets, set map_public_ip_on_launch = false. "
            "Keep internet-facing workloads in explicitly designed public "
            "subnets and restrict ingress with security groups and routing controls."
        ),
        "severity": "HIGH",
        "context": (
            "Confirm whether this subnet is intended to be public or private "
            "before changing it."
        ),
    },
    "CKV_AWS_23": {
        "title": "Add descriptions to security groups and rules",
        "why": (
            "Descriptions make the purpose and ownership of network access "
            "rules easier to review and audit."
        ),
        "recommendation": (
            "Add meaningful description values to aws_security_group resources "
            "and their ingress/egress rules. Describe the workload, traffic "
            "purpose, and approved source where practical."
        ),
        "severity": "LOW",
        "context": (
            "Descriptions improve reviewability but do not themselves "
            "restrict traffic."
        ),
    },
    "CKV2_AWS_62": {
        "title": "Review S3 event notifications",
        "why": (
            "Event notifications can be needed for event-driven processing "
            "and downstream integrations."
        ),
        "recommendation": (
            "Configure S3 event notifications if the application requires "
            "event-driven processing. Otherwise, assess whether this policy "
            "applies to the bucket's purpose."
        ),
        "severity": "MEDIUM",
        "context": (
            "Do not add notifications without a consumer and a clear "
            "event-processing requirement."
        ),
    },
    "CKV2_AWS_6": {
        "title": "Block unintended public access to S3",
        "why": (
            "Public access settings can expose objects or bucket policies "
            "to unintended audiences."
        ),
        "recommendation": (
            "Configure aws_s3_bucket_public_access_block with block_public_acls "
            "= true, ignore_public_acls = true, block_public_policy = true, "
            "and restrict_public_buckets = true unless public access is "
            "explicitly required and approved."
        ),
        "severity": "HIGH",
        "context": (
            "If the bucket intentionally serves public content, document "
            "the exception and review the exact exposure."
        ),
    },
    "CKV2_AWS_61": {
        "title": "Define an S3 lifecycle policy",
        "why": (
            "Lifecycle rules help control storage growth and enforce "
            "data-retention practices."
        ),
        "recommendation": (
            "Define an aws_s3_bucket_lifecycle_configuration with transitions "
            "or expiration rules that match retention, recovery, and "
            "compliance requirements."
        ),
        "severity": "LOW",
        "context": (
            "Choose retention periods carefully; expiration can permanently "
            "remove data."
        ),
    },
    "CKV_AWS_18": {
        "title": "Enable S3 server access logging",
        "why": (
            "Access logs can support investigations and operational auditing "
            "of requests to a bucket."
        ),
        "recommendation": (
            "Enable S3 server access logging and configure a separate "
            "destination bucket with suitable access controls, retention, "
            "and protection against unintended public access."
        ),
        "severity": "MEDIUM",
        "context": (
            "Consider log volume, storage costs, and the destination "
            "bucket's security."
        ),
    },
    "CKV_AWS_144": {
        "title": "Assess S3 cross-region replication",
        "why": (
            "Replication can improve recovery options for workloads with "
            "regional resilience requirements."
        ),
        "recommendation": (
            "Enable S3 cross-region replication if required by the business "
            "continuity or disaster recovery strategy. Configure versioning, "
            "replication permissions, destination controls, and recovery objectives."
        ),
        "severity": "MEDIUM",
        "context": (
            "Replication adds cost and operational complexity; align it "
            "with recovery requirements."
        ),
    },
    "CKV_AWS_21": {
        "title": "Enable S3 bucket versioning",
        "why": (
            "Versioning can help recover earlier object versions after "
            "accidental overwrites or deletions."
        ),
        "recommendation": (
            "Add an aws_s3_bucket_versioning resource with status = "
            '"Enabled" when version recovery is appropriate for the workload.'
        ),
        "severity": "MEDIUM",
        "context": (
            "Review lifecycle rules and storage costs for retained object versions."
        ),
    },
    "CKV_AWS_145": {
        "title": "Use AWS KMS encryption for S3 when required",
        "why": (
            "Customer-managed or AWS-managed KMS keys can provide encryption "
            "controls and auditability for stored objects."
        ),
        "recommendation": (
            "Configure default S3 server-side encryption with an appropriate "
            "KMS key when required by your security policy. Review key policy, "
            "IAM permissions, key lifecycle, and costs."
        ),
        "severity": "MEDIUM",
        "context": (
            "Choose the encryption mode according to data sensitivity and "
            "organizational requirements."
        ),
    },
}

DEFAULT_REMEDIATION = {
    "title": "Review the failed Checkov policy",
    "why": (
        "The Terraform configuration did not satisfy this security policy. "
        "The exact risk depends on the resource and the policy's intent."
    ),
    "recommendation": (
        "Open the Checkov guideline, inspect the affected resource and code "
        "lines, and apply a targeted Terraform change that satisfies the policy "
        "without breaking the intended architecture."
    ),
    "severity": "UNCLASSIFIED",
    "context": (
        "CloudForge has no rule-specific remediation registered for this "
        "check yet. Do not treat this generic guidance as a confirmed fix."
    ),
}


def _failure(error: str) -> dict:
    """Return a consistent fail-closed scanner response."""
    return {
        "success": False,
        "passed": False,
        "summary": {},
        "findings": [],
        "error": error,
    }


def _summary_int(summary: dict, key: str) -> int | None:
    """
    Read one declared summary count. Absent -> None; malformed -> raise.
    A malformed count is never silently turned into zero.
    """
    if key not in summary:
        return None
    value = summary[key]
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError(
            f"Checkov summary field '{key}' is malformed: {value!r}"
        )
    return value


def _validate_report(report) -> list[dict]:
    """
    Validate a Checkov JSON payload and return one record per report
    entry (Checkov can emit a list of reports, one per framework).

    Structural contract enforced per report entry:

      - `results` is a dict and `failed_checks` is a mandatory list
        whose entries carry a non-empty string `check_id`;
      - `passed_checks` and `skipped_checks` are optional lists;
        Checkov 3.x `--compact` omits the passed list even when many
        checks passed, so counts may instead come from the summary block;
      - when a `summary` block exists, every one of `passed`, `failed`,
        `skipped`, `total` it declares must be a non-negative integer
        — malformed counts fail the scan instead of becoming zero.

    Consistency between declared summary counts and the parsed lists
    (for example a summary claiming failed checks while the failed
    list is empty) is enforced per report by `_combined_counts`.
    """
    if isinstance(report, dict):
        reports = [report]
    elif isinstance(report, list) and report:
        reports = report
    else:
        raise ValueError("Unexpected or empty Checkov report format.")

    records: list[dict] = []

    for report_item in reports:
        if not isinstance(report_item, dict):
            raise ValueError(
                "Checkov report contains an invalid report entry."
            )

        summary: dict = {}
        raw_summary = report_item.get("summary")
        if raw_summary is not None:
            if not isinstance(raw_summary, dict):
                raise ValueError(
                    "Checkov report has a malformed summary section."
                )
            for key in ("passed", "failed", "skipped", "total"):
                _summary_int(raw_summary, key)
            summary = raw_summary

        results = report_item.get("results")
        if not isinstance(results, dict):
            raise ValueError(
                "Checkov report has no valid results section."
            )

        record: dict = {}
        for group_name in (
            "failed_checks",
            "passed_checks",
            "skipped_checks",
        ):
            checks = results.get(group_name, None)

            if checks is None:
                if group_name == "failed_checks":
                    raise ValueError(
                        f"Checkov report is missing a valid "
                        f"'{group_name}' list."
                    )
                # Compact reports omit lists that carry no detail.
                record[group_name] = None
                continue

            if not isinstance(checks, list):
                raise ValueError(
                    f"Checkov report is missing a valid "
                    f"'{group_name}' list."
                )

            for check in checks:
                if (
                    not isinstance(check, dict)
                    or not isinstance(check.get("check_id"), str)
                    or not check["check_id"].strip()
                ):
                    raise ValueError(
                        f"Checkov report contains an invalid entry "
                        f"in '{group_name}'."
                    )

            record[group_name] = checks

        record["summary"] = summary
        records.append(record)

    return records


def _combined_counts(records: list[dict]) -> tuple[list, list, list, dict]:
    """
    Combine validated per-report records into global lists and counts.
    Any inconsistency raises ValueError so the scan fails closed:

      - a summary `failed` count that disagrees with the mandatory
        failed_checks list (this catches compact-style reports
        claiming failures with no failure details);
      - an omitted `passed_checks`/`skipped_checks` list may only be
        counted from the summary block when the summary declares it;
        if the summary omits it as well, the report is unverifiable;
      - a declared `total` must equal the passed + failed + skipped
        entries that were declared or observed for that report.
    """
    all_failed: list = []
    all_passed: list = []
    all_skipped: list = []

    total_passed = 0
    total_failed = 0
    total_skipped = 0

    for record in records:
        summary = record["summary"]
        failed_list = record["failed_checks"]

        failed_declared = _summary_int(summary, "failed")
        if failed_declared is not None and failed_declared != len(failed_list):
            raise ValueError(
                "Checkov report is inconsistent: the summary reports "
                f"{failed_declared} failed check(s), but the "
                f"failed_checks list contains {len(failed_list)} "
                "entit(ies). The failure details cannot be trusted."
            )

        def _resolved_group(
            group_key: str,
            declared_key: str,
            failure_label: str,
        ) -> tuple[int, list]:
            check_list = record.get(group_key)
            declared = _summary_int(summary, declared_key)
            if check_list is None:
                if declared is None:
                    raise ValueError(
                        f"Checkov report omits both the "
                        f"'{group_key}' list and a summary "
                        f"'{declared_key}' count; the "
                        f"{failure_label} total cannot be verified."
                    )
                return declared, []
            if declared is not None and declared != len(check_list):
                raise ValueError(
                    "Checkov report is inconsistent: the summary "
                    f"reports {declared} {failure_label} check(s), but "
                    f"the '{group_key}' list contains "
                    f"{len(check_list)} entit(ies)."
                )
            return len(check_list), list(check_list)

        report_passed, passed_group = _resolved_group(
            "passed_checks", "passed", "passed"
        )
        report_skipped, skipped_group = _resolved_group(
            "skipped_checks", "skipped", "skipped"
        )

        declared_total = _summary_int(summary, "total")
        expected_total = report_passed + len(failed_list) + report_skipped
        if declared_total is not None and declared_total != expected_total:
            raise ValueError(
                "Checkov report is inconsistent: the summary reports a "
                f"total of {declared_total} check(s), but "
                f"{expected_total} passed/failed/skipped entries were "
                "declared or listed."
            )

        all_failed.extend(failed_list)
        all_passed.extend(passed_group)
        all_skipped.extend(skipped_group)
        total_passed += report_passed
        total_failed += len(failed_list)
        total_skipped += report_skipped

    combined = {
        "passed": total_passed,
        "failed": total_failed,
        "skipped": total_skipped,
        "total": total_passed + total_failed + total_skipped,
    }
    return all_failed, all_passed, all_skipped, combined


def scan_terraform(terraform_files: dict[str, str]) -> dict:
    """
    Scan Terraform configuration using Checkov and attach
    remediation recommendations to known security findings.

    This performs local static analysis only. It does not deploy
    infrastructure or execute Terraform apply.
    """
    if not isinstance(terraform_files, dict) or not terraform_files:
        return _failure("No Terraform files provided.")

    try:
        # Invoke Checkov as a Python module through the CURRENT
        # interpreter. The venv's checkov.cmd shim resolves "python"
        # from PATH internally, which can silently pick a different
        # interpreter without Checkov installed. sys.executable is
        # always the interpreter hosting this service.
        from importlib.util import find_spec

        if find_spec("checkov") is None:
            return _failure(
                "Checkov is not installed in the backend environment. "
                "Install the project requirements."
            )

        with tempfile.TemporaryDirectory(
            prefix="cloudforge-security-"
        ) as temp_dir:
            terraform_dir = Path(temp_dir).resolve()

            for filename, content in terraform_files.items():
                if not isinstance(filename, str):
                    return _failure(
                        "Terraform filenames must be strings."
                    )

                file_path = Path(filename)

                if (
                    not filename
                    or file_path.name != filename
                    or filename in {".", ".."}
                    or not (
                        filename.endswith(".tf")
                        or filename.endswith(".tf.json")
                    )
                    or not isinstance(content, str)
                ):
                    return _failure(
                        f"Unsupported Terraform filename or content: "
                        f"{filename!r}"
                    )

                (terraform_dir / filename).write_text(
                    content,
                    encoding="utf-8",
                )

            if not any(terraform_dir.iterdir()):
                return _failure(
                    "No supported Terraform files found."
                )

            result = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "checkov.main",
                    "-d",
                    str(terraform_dir),
                    "--framework",
                    "terraform",
                    "--output",
                    "json",
                    "--quiet",
                    "--compact",
                ],
                cwd=str(terraform_dir),
                capture_output=True,
                text=True,
                timeout=180,
                shell=False,
            )

            # Checkov uses exit code 1 for policy findings in common
            # configurations. Other non-zero codes indicate execution failure.
            if result.returncode not in (0, 1):
                return _failure(
                    f"Checkov exited with code {result.returncode}: "
                    f"{(result.stderr or result.stdout)[-2000:]}"
                )

            try:
                report = json.loads(result.stdout)
            except (json.JSONDecodeError, TypeError) as exc:
                details = (result.stderr or result.stdout or str(exc))[-2000:]
                return _failure(
                    "Checkov did not return valid JSON. "
                    f"Exit code: {result.returncode}. Output: {details}"
                )

            try:
                failed_checks, passed_checks, skipped_checks, summary = (
                    _combined_counts(_validate_report(report))
                )
            except ValueError as exc:
                return _failure(str(exc))

            findings = []

            for check in failed_checks:
                check_id = check["check_id"]
                remediation = REMEDIATIONS.get(
                    check_id,
                    DEFAULT_REMEDIATION,
                )

                findings.append({
                    "check_id": check_id,
                    "check_name": check.get(
                        "check_name",
                        "Unnamed security check",
                    ),
                    # Checkov's severity is separate from our
                    # advisory remediation priority.
                    "severity": check.get("severity") or "UNKNOWN",
                    "recommendation_priority": remediation.get(
                        "severity",
                        "UNCLASSIFIED",
                    ),
                    "remediation_title": remediation["title"],
                    "why_it_matters": remediation["why"],
                    "remediation_context": remediation["context"],
                    "resource": check.get(
                        "resource",
                        "Unknown resource",
                    ),
                    "file_path": check.get("file_path", ""),
                    "file_line_range": check.get(
                        "file_line_range",
                        [],
                    ),
                    "guideline": check.get("guideline", ""),
                    "code_block": check.get("code_block", []),
                    "recommendation": remediation["recommendation"],
                })

            # A valid scan can complete successfully while finding
            # policy violations. "success" means the scan ran
            # correctly; "passed" means it found no failed checks.
            # `_combined_counts` already failed the scan on any
            # malformed or inconsistent summary data, so a nonzero
            # failure count can never pass here.
            execution_success = result.returncode in (0, 1)
            scan_passed = execution_success and not failed_checks

            return {
                "success": execution_success,
                "passed": scan_passed,
                "summary": summary,
                "findings": findings,
                "error": None,
            }

    except subprocess.TimeoutExpired:
        return _failure(
            "Security scan timed out after 180 seconds."
        )

    except OSError as exc:
        return _failure(
            f"Unable to run security scan: {exc}"
        )
