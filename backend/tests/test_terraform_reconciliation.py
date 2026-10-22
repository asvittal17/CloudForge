"""
Regression tests for interrupted and uncertain Terraform deployments.

Contracts verified here:

  - startup recovery moves artifacts stranded in "applying" to
    "reconciliation_required" and NEVER back to "approved";
  - a "reconciliation_required" artifact cannot be approved or
    deployed, but CAN be re-planned (the instructed recovery path);
  - re-planning invalidates the previous plan identity and approval
    state, and a concurrent state change cannot be clobbered;
  - the applier distinguishes provably clean failures (no terraform
    apply subprocess ever ran — safe to retry) from outcomes where
    the apply subprocess was in flight and failed, was killed, or
    timed out (uncertain: infrastructure may be partially modified).

No test here ever enables the apply gate against real infrastructure;
all Terraform subprocesses are mocked.
"""

import subprocess
from unittest.mock import MagicMock, Mock, patch

import pytest
from fastapi import HTTPException

from app.services.terraform_recovery import recover_interrupted_applies
from app.services.terraform_applier import apply_saved_plan
from app.routers import terraform as tf_router

from test_terraform_workflow import (
    CONFIG_DIGEST,
    PLAN_DIGEST,
    make_artifact,
    make_db,
    make_project,
)


# ========================================
# Startup recovery
# ========================================


def _recovery_db(artifacts):
    db = MagicMock()
    chain = MagicMock()
    chain.filter.return_value = chain
    chain.all.return_value = artifacts
    db.query.return_value = chain
    return db


class TestStartupRecovery:

    def test_stranded_applying_becomes_reconciliation_required(self):
        artifact = MagicMock()
        artifact.status = "applying"

        recovered = recover_interrupted_applies(_recovery_db([artifact]))

        assert recovered == 1
        # The whole point of the fix: never returned to "approved".
        assert artifact.status == "reconciliation_required"

    def test_nothing_stranded_commits_nothing(self):
        recovered = recover_interrupted_applies(_recovery_db([]))

        assert recovered == 0

    def test_multiple_stranded_artifacts_all_recovered(self):
        first, second = MagicMock(), MagicMock()
        first.status = "applying"
        second.status = "applying"

        recovered = recover_interrupted_applies(
            _recovery_db([first, second])
        )

        assert recovered == 2
        assert first.status == "reconciliation_required"
        assert second.status == "reconciliation_required"


# ========================================
# Reconciliation lifecycle through the router
# ========================================


def _plan_endpoint_db(artifact):
    project = make_project()
    db = make_db(project, artifact)
    artifact.query_mock.first.return_value = artifact
    project.query_mock.first.return_value = project
    return db


class TestReconciliationLifecycle:

    def test_reconciliation_required_cannot_be_approved(self):
        artifact = make_artifact(status="reconciliation_required")
        db = _plan_endpoint_db(artifact)

        with pytest.raises(HTTPException) as exc:
            tf_router.approve_terraform_artifact(
                5, 10, user_id=1, db=db
            )

        assert exc.value.status_code == 400
        assert "reconciliation_required" in exc.value.detail

    def test_replan_is_allowed_from_reconciliation_required(self):
        """
        The recovery path instructed by integrity errors: reconcile
        externally, then RE-PLAN, re-verify, re-approve. Re-planning
        from "reconciliation_required" must work.
        """
        artifact = make_artifact(status="reconciliation_required")
        db = _plan_endpoint_db(artifact)
        artifact.query_mock.update.return_value = 1

        with (
            patch.object(
                tf_router,
                "plan_terraform",
                return_value={
                    "success": True,
                    "plan_output": "Plan: 1 to add.",
                    "plan_error": "",
                    "plan_sha256": PLAN_DIGEST,
                    "config_sha256": CONFIG_DIGEST,
                },
            ),
            patch.object(
                tf_router,
                "ensure_artifact_storage",
                return_value=MagicMock(),
            ),
        ):
            result = tf_router.plan_staged_terraform(
                5, 10, user_id=1, db=db
            )

        assert result["status"] == "plan_ready"
        transition = artifact.query_mock.update.call_args.args[0]
        assert transition["status"] == "plan_ready"
        # The interrupted-apply artifact is never born approved again.
        assert transition["approved_at"] is None

    def test_replan_allowed_from_plan_ready_and_approved(self):
        for start_status in ("plan_ready", "approved"):
            artifact = make_artifact(status=start_status)
            db = _plan_endpoint_db(artifact)
            artifact.query_mock.update.return_value = 1

            with (
                patch.object(
                    tf_router,
                    "plan_terraform",
                    return_value={
                        "success": True,
                        "plan_output": "ok",
                        "plan_error": "",
                        "plan_sha256": PLAN_DIGEST,
                        "config_sha256": CONFIG_DIGEST,
                    },
                ),
                patch.object(
                    tf_router,
                    "ensure_artifact_storage",
                    return_value=MagicMock(),
                ),
            ):
                result = tf_router.plan_staged_terraform(
                    5, 10, user_id=1, db=db
                )

            assert result["status"] == "plan_ready", start_status
            transition = artifact.query_mock.update.call_args.args[0]
            assert transition["approved_at"] is None

    def test_plan_rejected_for_applying_and_deployed(self):
        for start_status in ("applying", "deployed"):
            artifact = make_artifact(status=start_status)
            db = _plan_endpoint_db(artifact)

            with pytest.raises(HTTPException) as exc:
                tf_router.plan_staged_terraform(5, 10, user_id=1, db=db)

            assert exc.value.status_code == 400, start_status
            assert start_status in exc.value.detail

    def test_concurrent_state_change_during_plan_is_409(self):
        """
        The plan transition is a conditional UPDATE: if another request
        (approve/apply/re-plan) already changed the artifact while the
        plan subprocess ran, the plan is refused instead of silently
        overwriting that state.
        """
        artifact = make_artifact(status="plan_ready")
        db = _plan_endpoint_db(artifact)
        artifact.query_mock.update.return_value = 0

        with (
            patch.object(
                tf_router,
                "plan_terraform",
                return_value={
                    "success": True,
                    "plan_output": "ok",
                    "plan_error": "",
                    "plan_sha256": PLAN_DIGEST,
                    "config_sha256": CONFIG_DIGEST,
                },
            ),
            patch.object(
                tf_router,
                "ensure_artifact_storage",
                return_value=MagicMock(),
            ),
        ):
            with pytest.raises(HTTPException) as exc:
                tf_router.plan_staged_terraform(5, 10, user_id=1, db=db)

        assert exc.value.status_code == 409


# ========================================
# Inconsistent legacy artifacts
# ========================================


class TestLegacyInconsistentArtifacts:
    """
    Rows found in the wild with status="approved" but NULL plan
    metadata (created before saved-plan integrity existed). They must
    never be approvable or deployable, and the safe recovery is the
    same as for interrupted applies: re-plan fresh (new digests, no
    inherited approval), then approve fresh. No row or plan file is
    ever deleted during recovery.
    """

    def _legacy(self):
        return make_artifact(
            status="approved",
            plan_sha256=None,
            config_sha256=None,
        )

    def test_legacy_approved_cannot_be_approved(self):
        artifact = self._legacy()
        db = _plan_endpoint_db(artifact)

        with pytest.raises(HTTPException) as exc:
            tf_router.approve_terraform_artifact(5, 10, user_id=1, db=db)

        assert exc.value.status_code == 400
        assert "successful Terraform plan" in exc.value.detail

    def test_legacy_approved_cannot_be_deployed(self):
        artifact = self._legacy()
        db = _plan_endpoint_db(artifact)

        with pytest.raises(HTTPException) as exc:
            tf_router.apply_terraform_artifact(5, 10, user_id=1, db=db)

        # Refused either by the disabled apply gate (403, checked
        # first) or by the missing saved-plan identity (400); both
        # paths prevent deployment. The 400 path with the gate enabled
        # is covered by
        # TestApplyEndpoint.test_apply_rejects_missing_plan_identity.
        assert exc.value.status_code in (400, 403)
        assert exc.value.status_code != 200

    def test_legacy_approved_can_be_replanned_with_fresh_approval(
        self,
    ):
        """
        Re-planning the legacy artifact produces a complete new plan
        identity (digests recorded, approved_at cleared) so approval
        must happen fresh through the normal verified workflow.
        """
        artifact = self._legacy()
        db = _plan_endpoint_db(artifact)
        artifact.query_mock.update.return_value = 1

        with (
            patch.object(
                tf_router,
                "plan_terraform",
                return_value={
                    "success": True,
                    "plan_output": "Plan: 1 to add.",
                    "plan_error": "",
                    "plan_sha256": PLAN_DIGEST,
                    "config_sha256": CONFIG_DIGEST,
                },
            ),
            patch.object(
                tf_router,
                "ensure_artifact_storage",
                return_value=MagicMock(),
            ),
        ):
            result = tf_router.plan_staged_terraform(5, 10, user_id=1, db=db)

        assert result["success"] is True
        assert result["status"] == "plan_ready"
        transition = artifact.query_mock.update.call_args.args[0]
        assert transition["plan_sha256"] == PLAN_DIGEST
        assert transition["config_sha256"] == CONFIG_DIGEST
        assert transition["approved_at"] is None


# ========================================
# Applier outcome classification
# ========================================


def _enabled_apply_env(monkeypatch, tmp_path):
    monkeypatch.setenv("CLOUDFORGE_ALLOW_TERRAFORM_APPLY", "1")
    monkeypatch.setenv("CLOUDFORGE_RDS_PASSWORD", "fixture-only-value")
    plan_path = tmp_path / "approved.tfplan"
    plan_path.write_bytes(b"fixture plan bytes")
    return plan_path


PATCHABLE_RUN = "app.services.terraform_applier.subprocess.run"


class TestApplierOutcomeClassification:

    def test_init_timeout_is_clean_and_retryable(self, monkeypatch, tmp_path):
        _enabled_apply_env(monkeypatch, tmp_path)

        with patch(
            PATCHABLE_RUN,
            side_effect=subprocess.TimeoutExpired(cmd=[], timeout=300),
        ):
            result = apply_saved_plan(
                project_id=1,
                plan_dir=tmp_path,
                plan_path=tmp_path / "approved.tfplan",
            )

        assert result["success"] is False
        assert result["stage"] == "init"
        assert result["terraform_apply_started"] is False

    def test_init_failure_is_clean_and_retryable(self, monkeypatch, tmp_path):
        _enabled_apply_env(monkeypatch, tmp_path)

        with patch(
            PATCHABLE_RUN,
            return_value=Mock(returncode=1, stdout="", stderr="boom"),
        ):
            result = apply_saved_plan(
                project_id=1,
                plan_dir=tmp_path,
                plan_path=tmp_path / "approved.tfplan",
            )

        assert result["success"] is False
        assert result["stage"] == "init"
        assert result["terraform_apply_started"] is False

    def test_apply_failure_with_running_subprocess_is_uncertain(
        self, monkeypatch, tmp_path
    ):
        """
        A nonzero exit from `terraform apply` means the process ran:
        some resources may already exist. Never a clean retry.
        """
        plan_path = _enabled_apply_env(monkeypatch, tmp_path)

        with patch(
            PATCHABLE_RUN,
            side_effect=[
                Mock(returncode=0, stdout="init ok", stderr=""),
                Mock(returncode=1, stdout="", stderr="provider crash"),
            ],
        ):
            result = apply_saved_plan(
                project_id=1,
                plan_dir=tmp_path,
                plan_path=plan_path,
            )

        assert result["success"] is False
        assert result["stage"] == "apply"
        assert result["terraform_apply_started"] is True

    def test_apply_timeout_with_running_subprocess_is_uncertain(
        self, monkeypatch, tmp_path
    ):
        plan_path = _enabled_apply_env(monkeypatch, tmp_path)

        with patch(
            PATCHABLE_RUN,
            side_effect=[
                Mock(returncode=0, stdout="init ok", stderr=""),
                subprocess.TimeoutExpired(cmd=[], timeout=600),
            ],
        ):
            result = apply_saved_plan(
                project_id=1,
                plan_dir=tmp_path,
                plan_path=plan_path,
            )

        assert result["success"] is False
        assert result["stage"] == "apply"
        assert result["terraform_apply_started"] is True

    def test_apply_spawn_failure_is_clean(self, monkeypatch, tmp_path):
        """
        subprocess.run failing to START the apply process means no
        Terraform deployment was ever in flight.
        """
        plan_path = _enabled_apply_env(monkeypatch, tmp_path)

        with patch(
            PATCHABLE_RUN,
            side_effect=[
                Mock(returncode=0, stdout="init ok", stderr=""),
                OSError("apply binary could not be spawned"),
            ],
        ):
            result = apply_saved_plan(
                project_id=1,
                plan_dir=tmp_path,
                plan_path=plan_path,
            )

        assert result["success"] is False
        assert result["stage"] == "apply"
        assert result["terraform_apply_started"] is False

    def test_gate_refusal_is_clean(self, monkeypatch, tmp_path):
        from app.services.terraform_applier import apply_saved_plan

        monkeypatch.setenv("CLOUDFORGE_ALLOW_TERRAFORM_APPLY", "0")
        result = apply_saved_plan(
            project_id=1,
            plan_dir=tmp_path,
            plan_path=tmp_path / "approved.tfplan",
        )

        assert result["success"] is False
        assert result["stage"] == "authorization"
        assert result["terraform_apply_started"] is False

    def test_success_reports_started_true(self, monkeypatch, tmp_path):
        plan_path = _enabled_apply_env(monkeypatch, tmp_path)

        with patch(
            PATCHABLE_RUN,
            side_effect=[
                Mock(returncode=0, stdout="init ok", stderr=""),
                Mock(returncode=0, stdout="Apply complete!", stderr=""),
            ],
        ):
            result = apply_saved_plan(
                project_id=1,
                plan_dir=tmp_path,
                plan_path=plan_path,
            )

        assert result["success"] is True
        assert result["stage"] == "apply"
        assert result["terraform_apply_started"] is True
