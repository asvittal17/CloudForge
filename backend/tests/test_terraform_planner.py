
from unittest.mock import Mock, patch
import subprocess

import pytest

from app.services.terraform_planner import plan_terraform


VALID_FILES = {
    "main.tf": 'terraform { required_version = ">= 1.0.0" }',
    "variables.tf": "",
    "outputs.tf": "",
}


@patch("app.services.terraform_planner.subprocess.run")
def test_plan_succeeds(mock_run):
    mock_run.side_effect = [
        Mock(returncode=0, stdout="init ok", stderr=""),
        Mock(returncode=0, stdout="Plan: 1 to add.", stderr=""),
    ]

    result = plan_terraform(VALID_FILES)

    assert result["success"] is True
    assert result["plan_output"] == "Plan: 1 to add."
    assert result["plan_error"] == ""
    assert mock_run.call_count == 2


@patch("app.services.terraform_planner.subprocess.run")
def test_init_failure_stops_before_plan(mock_run):
    mock_run.return_value = Mock(
        returncode=1,
        stdout="",
        stderr="init failed",
    )

    result = plan_terraform(VALID_FILES)

    assert result["success"] is False
    assert "initialization failed" in result["plan_error"].lower()
    assert mock_run.call_count == 1


@patch("app.services.terraform_planner.subprocess.run")
def test_plan_failure_is_reported(mock_run):
    mock_run.side_effect = [
        Mock(returncode=0, stdout="", stderr=""),
        Mock(returncode=1, stdout="", stderr="invalid config"),
    ]

    result = plan_terraform(VALID_FILES)

    assert result["success"] is False
    assert result["plan_error"] == "invalid config"


@patch("app.services.terraform_planner.subprocess.run")
def test_database_password_placeholder_is_only_added_when_declared(
    mock_run,
):
    mock_run.side_effect = [
        Mock(returncode=0, stdout="", stderr=""),
        Mock(returncode=0, stdout="ok", stderr=""),
    ]

    plan_terraform({
        **VALID_FILES,
        "variables.tf": 'variable "database_password" { type = string }',
    })

    command = mock_run.call_args_list[1].args[0]

    assert (
        "-var=database_password=cloudforge-plan-only-placeholder"
        in command
    )


@patch("app.services.terraform_planner.subprocess.run")
def test_no_password_placeholder_when_variable_is_absent(mock_run):
    mock_run.side_effect = [
        Mock(returncode=0, stdout="", stderr=""),
        Mock(returncode=0, stdout="ok", stderr=""),
    ]

    plan_terraform(VALID_FILES)

    command = mock_run.call_args_list[1].args[0]

    assert not any(
        "database_password" in argument
        for argument in command
    )


@pytest.mark.parametrize(
    "files",
    [
        {},
        {"../outside.tf": "resource {}"},
        {"C:\\outside.tf": "resource {}"},
        {"main.tf": 123},
        {"main.tf": None},
    ],
)
def test_invalid_terraform_inputs_are_rejected(files):
    result = plan_terraform(files)

    assert result["success"] is False
    assert result["plan_error"]


@patch("app.services.terraform_planner.subprocess.run")
def test_init_timeout_returns_structured_error(mock_run):
    mock_run.side_effect = subprocess.TimeoutExpired(
        cmd=["terraform", "init"],
        timeout=300,
    )

    result = plan_terraform(VALID_FILES)

    assert result["success"] is False
    assert result["plan_output"] == ""
    assert result["plan_error"] == "Terraform initialization timed out."
    assert mock_run.call_count == 1


@patch("app.services.terraform_planner.subprocess.run")
def test_plan_timeout_returns_structured_error(mock_run):
    mock_run.side_effect = [
        Mock(returncode=0, stdout="init ok", stderr=""),
        subprocess.TimeoutExpired(
            cmd=["terraform", "plan"],
            timeout=180,
        ),
    ]

    result = plan_terraform(VALID_FILES)

    assert result["success"] is False
    assert result["plan_output"] == ""
    assert result["plan_error"] == "Terraform planning timed out."
    assert mock_run.call_count == 2
