
import json
import subprocess
import sys
import tempfile
from pathlib import Path


# Recommendations are guidance, not automatic Terraform modifications.
# Recommendations are guidance, not automatic Terraform modifications.
# CloudForge priorities are advisory classifications, not official Checkov severity.
REMEDIATIONS = {
    "CKV_AWS_130": {
        "title": "Disable automatic public IP assignment for private subnets",
        "why": "Automatically assigned public IP addresses can expose instances to direct internet routing when network controls also permit it.",
        "recommendation": "For private subnets, set map_public_ip_on_launch = false. Keep internet-facing workloads in explicitly designed public subnets and restrict ingress with security groups and routing controls.",
        "severity": "HIGH",
        "context": "Confirm whether this subnet is intended to be public or private before changing it.",
    },
    "CKV_AWS_23": {
        "title": "Add descriptions to security groups and rules",
        "why": "Descriptions make the purpose and ownership of network access rules easier to review and audit.",
        "recommendation": "Add meaningful description values to aws_security_group resources and their ingress/egress rules. Describe the workload, traffic purpose, and approved source where practical.",
        "severity": "LOW",
        "context": "Descriptions improve reviewability but do not themselves restrict traffic.",
    },
    "CKV2_AWS_62": {
        "title": "Review S3 event notifications",
        "why": "Event notifications can be needed for event-driven processing and downstream integrations.",
        "recommendation": "Configure S3 event notifications if the application requires event-driven processing. Otherwise, assess whether this policy applies to the bucket's purpose.",
        "severity": "MEDIUM",
        "context": "Do not add notifications without a consumer and a clear event-processing requirement.",
    },
    "CKV2_AWS_6": {
        "title": "Block unintended public access to S3",
        "why": "Public access settings can expose objects or bucket policies to unintended audiences.",
        "recommendation": "Configure aws_s3_bucket_public_access_block with block_public_acls = true, ignore_public_acls = true, block_public_policy = true, and restrict_public_buckets = true unless public access is explicitly required and approved.",
        "severity": "HIGH",
        "context": "If the bucket intentionally serves public content, document the exception and review the exact exposure.",
    },
    "CKV2_AWS_61": {
        "title": "Define an S3 lifecycle policy",
        "why": "Lifecycle rules help control storage growth and enforce data-retention practices.",
        "recommendation": "Define an aws_s3_bucket_lifecycle_configuration with transitions or expiration rules that match retention, recovery, and compliance requirements.",
        "severity": "LOW",
        "context": "Choose retention periods carefully; expiration can permanently remove data.",
    },
    "CKV_AWS_18": {
        "title": "Enable S3 server access logging",
        "why": "Access logs can support investigations and operational auditing of requests to a bucket.",
        "recommendation": "Enable S3 server access logging and configure a separate destination bucket with suitable access controls, retention, and protection against unintended public access.",
        "severity": "MEDIUM",
        "context": "Consider log volume, storage costs, and the destination bucket's security.",
    },
    "CKV_AWS_144": {
        "title": "Assess S3 cross-region replication",
        "why": "Replication can improve recovery options for workloads with regional resilience requirements.",
        "recommendation": "Enable S3 cross-region replication if required by the business continuity or disaster recovery strategy. Configure versioning, replication permissions, destination controls, and recovery objectives.",
        "severity": "MEDIUM",
        "context": "Replication adds cost and operational complexity; align it with recovery requirements.",
    },
    "CKV_AWS_21": {
        "title": "Enable S3 bucket versioning",
        "why": "Versioning can help recover earlier object versions after accidental overwrites or deletions.",
        "recommendation": "Add an aws_s3_bucket_versioning resource with status = \"Enabled\" when version recovery is appropriate for the workload.",
        "severity": "MEDIUM",
        "context": "Review lifecycle rules and storage costs for retained object versions.",
    },
    "CKV_AWS_145": {
        "title": "Use AWS KMS encryption for S3 when required",
        "why": "Customer-managed or AWS-managed KMS keys can provide encryption controls and auditability for stored objects.",
        "recommendation": "Configure default S3 server-side encryption with an appropriate KMS key when required by your security policy. Review key policy, IAM permissions, key lifecycle, and costs.",
        "severity": "MEDIUM",
        "context": "Choose the encryption mode according to data sensitivity and organizational requirements.",
    },
}

DEFAULT_REMEDIATION = {
    "title": "Review the failed Checkov policy",
    "why": "The Terraform configuration did not satisfy this security policy. The exact risk depends on the resource and the policy's intent.",
    "recommendation": "Open the Checkov guideline, inspect the affected resource and code lines, and apply a targeted Terraform change that satisfies the policy without breaking the intended architecture.",
    "severity": "UNCLASSIFIED",
    "context": "CloudForge has no rule-specific remediation registered for this check yet. Do not treat this generic guidance as a confirmed fix.",
}


def scan_terraform(terraform_files: dict[str, str]) -> dict:
    """
    Scan Terraform configuration using Checkov and attach
    remediation recommendations to known security findings.

    This performs local static analysis only. It does not deploy
    infrastructure or execute Terraform apply.
    """

    if not terraform_files:
        return {
            "success": False,
            "passed": False,
            "summary": {},
            "findings": [],
            "error": "No Terraform files provided.",
        }

    try:
        scripts_dir = Path(sys.executable).resolve().parent
        checkov_launcher = scripts_dir / "checkov.cmd"

        if not checkov_launcher.is_file():
            return {
                "success": False,
                "passed": False,
                "summary": {},
                "findings": [],
                "error": (
                    f"Checkov launcher not found: {checkov_launcher}"
                ),
            }

        with tempfile.TemporaryDirectory(
            prefix="cloudforge-security-"
        ) as temp_dir:

            terraform_dir = Path(temp_dir).resolve()

            for filename, content in terraform_files.items():
                if not isinstance(filename, str):
                    return {
                        "success": False,
                        "passed": False,
                        "summary": {},
                        "findings": [],
                        "error": "Terraform filenames must be strings.",
                    }

                file_path = Path(filename)

                if (
                    file_path.name != filename
                    or filename in {".", ".."}
                    or not (
                        filename.endswith(".tf")
                        or filename.endswith(".tf.json")
                    )
                    or not isinstance(content, str)
                ):
                    return {
                        "success": False,
                        "passed": False,
                        "summary": {},
                        "findings": [],
                        "error": (
                            f"Unsupported Terraform filename: {filename}"
                        ),
                    }

                (terraform_dir / filename).write_text(
                    content,
                    encoding="utf-8",
                )

            if not any(terraform_dir.iterdir()):
                return {
                    "success": False,
                    "passed": False,
                    "summary": {},
                    "findings": [],
                    "error": "No supported Terraform files found.",
                }

            result = subprocess.run(
                [
                    str(checkov_launcher),
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

            try:
                report = json.loads(result.stdout)
            except json.JSONDecodeError:
                return {
                    "success": False,
                    "passed": False,
                    "summary": {},
                    "findings": [],
                    "error": (
                        "Checkov did not return valid JSON. "
                        f"Exit code: {result.returncode}. "
                        f"Output: "
                        f"{result.stderr[-2000:] or result.stdout[-2000:]}"
                    ),
                }

            if isinstance(report, list):
                report = next(
                    (
                        item for item in report
                        if isinstance(item, dict)
                    ),
                    {},
                )

            if not isinstance(report, dict):
                return {
                    "success": False,
                    "passed": False,
                    "summary": {},
                    "findings": [],
                    "error": "Unexpected Checkov report format.",
                }

            results = report.get("results", {})

            if not isinstance(results, dict):
                return {
                    "success": False,
                    "passed": False,
                    "summary": {},
                    "findings": [],
                    "error": "Checkov report has no valid results section.",
                }

            failed_checks = results.get("failed_checks", [])
            passed_checks = results.get("passed_checks", [])
            skipped_checks = results.get("skipped_checks", [])

            findings = []

            for check in failed_checks:
                if not isinstance(check, dict):
                    continue

                check_id = check.get("check_id", "UNKNOWN")
                remediation = REMEDIATIONS.get(check_id, DEFAULT_REMEDIATION)

                findings.append({
                    "check_id": check_id,
                    "check_name": check.get(
                        "check_name",
                        "Unnamed security check",
                    ),
                    # Use Checkov's severity when available.
                    # Otherwise, label our recommendation level
                    # separately rather than claiming it is official.
                    "severity": check.get("severity") or "UNKNOWN",
                    "recommendation_priority": remediation.get(
                        "severity",
                        "UNCLASSIFIED",
                    ),
                    "remediation_title": remediation.get(
                        "title",
                        "Review the failed Checkov policy",
                    ),
                    "why_it_matters": remediation.get(
                        "why",
                        DEFAULT_REMEDIATION["why"],
                    ),
                    "remediation_context": remediation.get(
                        "context",
                        DEFAULT_REMEDIATION["context"],
                    ),
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
                    "recommendation": remediation.get(
                        "recommendation",
                        DEFAULT_REMEDIATION["recommendation"],
                    ),
                })

            summary = {
                "passed": len(passed_checks),
                "failed": len(failed_checks),
                "skipped": len(skipped_checks),
                "total": (
                    len(passed_checks)
                    + len(failed_checks)
                    + len(skipped_checks)
                ),
            }

            execution_success = result.returncode in (0, 1)

            return {
                "success": execution_success,
                "passed": (
                    execution_success
                    and len(failed_checks) == 0
                ),
                "summary": summary,
                "findings": findings,
                "error": (
                    None
                    if execution_success
                    else (
                        f"Checkov exited with code "
                        f"{result.returncode}: "
                        f"{result.stderr[-2000:]}"
                    )
                ),
            }

    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "passed": False,
            "summary": {},
            "findings": [],
            "error": "Security scan timed out after 180 seconds.",
        }

    except OSError as exc:
        return {
            "success": False,
            "passed": False,
            "summary": {},
            "findings": [],
            "error": f"Unable to run security scan: {exc}",
        }
