
import json
from unittest.mock import MagicMock, patch

from app.services.terraform_security_scanner import scan_terraform


VALID_REPORT = {
    "results": {
        "failed_checks": [],
        "passed_checks": [
            {"check_id": "CKV_AWS_999"}
        ],
        "skipped_checks": [],
    }
}


def run_scanner_with_report(report, returncode=0):
    result = MagicMock()
    result.returncode = returncode
    result.stdout = json.dumps(report)
    result.stderr = ""

    with (
        patch(
            "app.services.terraform_security_scanner.Path.is_file",
            return_value=True,
        ),
        patch(
            "app.services.terraform_security_scanner.subprocess.run",
            return_value=result,
        ),
    ):
        return scan_terraform({"main.tf": 'resource "aws_vpc" "main" {}'})


def test_valid_report_with_no_failed_checks_passes():
    result = run_scanner_with_report(VALID_REPORT)

    assert result["success"] is True
    assert result["passed"] is True
    assert result["summary"]["failed"] == 0


def test_valid_report_with_failed_check_fails_security_gate():
    report = {
        "results": {
            "failed_checks": [
                {
                    "check_id": "CKV_AWS_130",
                    "check_name": "Example security finding",
                }
            ],
            "passed_checks": [],
            "skipped_checks": [],
        }
    }

    result = run_scanner_with_report(report, returncode=1)

    assert result["success"] is True
    assert result["passed"] is False
    assert result["summary"]["failed"] == 1
    assert result["findings"][0]["check_id"] == "CKV_AWS_130"


def test_missing_failed_checks_list_fails_closed():
    report = {
        "results": {
            "passed_checks": [],
            "skipped_checks": [],
        }
    }

    result = run_scanner_with_report(report)

    assert result["success"] is False
    assert result["passed"] is False
    assert "failed_checks" in result["error"]


def test_compact_report_without_passed_list_counts_from_summary():
    """
    Checkov 3.x `--compact` omits the passed_checks list even when
    many checks passed. Counts must be taken from the summary block
    instead of failing the scan.
    """
    report = {
        "summary": {"passed": 29, "failed": 0, "skipped": 0},
        "results": {
            "failed_checks": [],
        },
    }

    result = run_scanner_with_report(report)

    assert result["success"] is True
    assert result["passed"] is True
    assert result["summary"]["passed"] == 29
    assert result["summary"]["failed"] == 0
    assert result["summary"]["total"] == 29


def test_compact_report_with_failures_keeps_failed_details():
    report = {
        "summary": {"passed": 24, "failed": 2, "skipped": 0},
        "results": {
            "failed_checks": [
                {"check_id": "CKV_AWS_158"},
                {"check_id": "CKV_AWS_21"},
            ],
        },
    }

    result = run_scanner_with_report(report, returncode=1)

    assert result["success"] is True
    assert result["passed"] is False
    assert result["summary"]["passed"] == 24
    assert result["summary"]["failed"] == 2
    assert [f["check_id"] for f in result["findings"]] == [
        "CKV_AWS_158",
        "CKV_AWS_21",
    ]


def test_malformed_check_entry_fails_closed():
    report = {
        "results": {
            "failed_checks": [{"check_name": "Missing check ID"}],
            "passed_checks": [],
            "skipped_checks": [],
        }
    }

    result = run_scanner_with_report(report)

    assert result["success"] is False
    assert result["passed"] is False
    assert "invalid entry" in result["error"]


def test_malformed_json_fails_closed():
    result = MagicMock()
    result.returncode = 0
    result.stdout = "not valid JSON"
    result.stderr = ""

    with (
        patch(
            "app.services.terraform_security_scanner.Path.is_file",
            return_value=True,
        ),
        patch(
            "app.services.terraform_security_scanner.subprocess.run",
            return_value=result,
        ),
    ):
        scan_result = scan_terraform({"main.tf": "# test"})

    assert scan_result["success"] is False
    assert scan_result["passed"] is False
    assert "valid JSON" in scan_result["error"]


def test_nonzero_execution_error_fails_closed():
    result = MagicMock()
    result.returncode = 2
    result.stdout = ""
    result.stderr = "Checkov execution error"

    with (
        patch(
            "app.services.terraform_security_scanner.Path.is_file",
            return_value=True,
        ),
        patch(
            "app.services.terraform_security_scanner.subprocess.run",
            return_value=result,
        ),
    ):
        scan_result = scan_terraform({"main.tf": "# test"})

    assert scan_result["success"] is False
    assert scan_result["passed"] is False
    assert "exited with code 2" in scan_result["error"]


def test_multiple_reports_are_combined_correctly():
    """Checkov can emit a LIST of reports; entries and counts combine."""
    report = [
        {
            "summary": {"passed": 3, "failed": 1, "skipped": 0},
            "results": {
                "failed_checks": [{"check_id": "CKV_AWS_21"}],
                "passed_checks": [
                    {"check_id": "A"},
                    {"check_id": "B"},
                    {"check_id": "C"},
                ],
                "skipped_checks": [],
            },
        },
        {
            "summary": {"passed": 2, "failed": 0, "skipped": 0},
            "results": {
                "failed_checks": [],
                "passed_checks": [
                    {"check_id": "D"},
                    {"check_id": "E"},
                ],
                "skipped_checks": [],
            },
        },
    ]

    result = run_scanner_with_report(report, returncode=1)

    assert result["success"] is True
    assert result["passed"] is False
    assert result["summary"] == {
        "passed": 5,
        "failed": 1,
        "skipped": 0,
        "total": 6,
    }
    assert [f["check_id"] for f in result["findings"]] == ["CKV_AWS_21"]


def test_summary_failed_count_without_failure_details_fails_closed():
    """
    A summary claiming failed checks while the failed_checks list is
    empty is inconsistent: the scan must fail, never pass.
    """
    report = {
        "summary": {"passed": 5, "failed": 2, "skipped": 0},
        "results": {
            "failed_checks": [],
            "skipped_checks": [],
        },
    }

    result = run_scanner_with_report(report)

    assert result["success"] is False
    assert result["passed"] is False
    assert "inconsistent" in result["error"]


def test_malformed_summary_counts_are_never_silently_zeroed():
    report = {
        "summary": {"passed": "three", "failed": 0, "skipped": 0},
        "results": {
            "failed_checks": [],
            "skipped_checks": [],
        },
    }

    result = run_scanner_with_report(report)

    assert result["success"] is False
    assert result["passed"] is False
    assert "malformed" in result["error"]


def test_boolean_summary_counts_fail_closed():
    report = {
        "summary": {"passed": True, "failed": 0, "skipped": 0},
        "results": {
            "failed_checks": [],
            "skipped_checks": [],
        },
    }

    result = run_scanner_with_report(report)

    assert result["success"] is False
    assert result["passed"] is False
    assert "malformed" in result["error"]


def test_listed_vs_declared_pass_count_mismatch_fails_closed():
    report = {
        "summary": {"passed": 5, "failed": 0, "skipped": 0},
        "results": {
            "failed_checks": [],
            "passed_checks": [{"check_id": "X"}],
            "skipped_checks": [],
        },
    }

    result = run_scanner_with_report(report)

    assert result["success"] is False
    assert result["passed"] is False
    assert "inconsistent" in result["error"]


def test_declared_total_mismatch_fails_closed():
    report = {
        "summary": {"passed": 1, "failed": 0, "skipped": 0, "total": 5},
        "results": {
            "failed_checks": [],
            "passed_checks": [{"check_id": "X"}],
            "skipped_checks": [],
        },
    }

    result = run_scanner_with_report(report)

    assert result["success"] is False
    assert result["passed"] is False
    assert "inconsistent" in result["error"]


def test_passed_count_unverifiable_without_list_or_summary_fails_closed():
    """
    Neither a passed_checks list nor a summary count: the passed total
    cannot be verified, so the scan fails closed instead of guessing.
    """
    report = {
        "results": {
            "failed_checks": [],
        }
    }

    result = run_scanner_with_report(report)

    assert result["success"] is False
    assert result["passed"] is False
    assert "cannot be verified" in result["error"]


def test_scanner_timeout_fails_closed():
    import subprocess as _subprocess

    with (
        patch(
            "app.services.terraform_security_scanner.Path.is_file",
            return_value=True,
        ),
        patch(
            "app.services.terraform_security_scanner.subprocess.run",
            side_effect=_subprocess.TimeoutExpired(cmd=[], timeout=180),
        ),
    ):
        scan_result = scan_terraform({"main.tf": "# test"})

    assert scan_result["success"] is False
    assert scan_result["passed"] is False
    assert "timed out" in scan_result["error"]
