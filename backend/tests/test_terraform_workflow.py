"""
Security-boundary tests for the Terraform saved-plan workflow:

    staged -> (plan: config + saved plan persisted) -> plan_ready
           -> (approve: verifies plan identity)      -> approved
           -> (apply: re-verifies identity, atomic claim,
               disabled unless explicitly allowed)   -> deployed
"""

import os
import shutil
import subprocess
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.routers import terraform as tf_router
from app.services.terraform_planner import (
    config_digest,
    plan_terraform,
    sha256_file,
)
from app.services.terraform_storage import (
    ensure_artifact_storage as _ensure_storage,
    get_artifact_storage_dir,
    get_plan_path,
)


PLAN_DIGEST = "p" * 64
CONFIG_DIGEST = "c" * 64


class MockDB:
    """
    Minimal DB double keyed by model class so router code that queries
    Project and TerraformArtifact separately works with MagicMock.
    """

    def __init__(self, project, artifact):
        self.project = project
        self.artifact = artifact
        self.queries = []
        self.committed = []

        def query_for(model):
            self.queries.append(model)
            goal = self.project if model.__name__ == "Project" else self.artifact
            goal.query_side_effect_calls = self.queries
            return goal.query_mock

        self.query = MagicMock(side_effect=query_for)
        self.commit = MagicMock(side_effect=lambda: self.committed.append(True))
        self.refresh = MagicMock()
        self.add = MagicMock()
        self.delete = MagicMock()


def make_db(project=None, artifact=None):
    """
    Build a project/artifact pair plus a MockDB. Each query() call
    returns its own thread of .filter(...).first() so distinct models
    do not interfere.
    """

    specs = []
    for instance in (project, artifact):
        if instance is None:
            continue
        chain = MagicMock()
        chain.filter.return_value = chain
        instance.query_mock = chain
        specs.append(instance)

    db = MockDB(project, artifact)
    return db


def make_project(project_id=5, owner_id=1):
    project = MagicMock()
    project.id = project_id
    project.owner_id = owner_id
    project.name = "IsoTest"
    return project


def make_artifact(
    status="staged",
    plan_sha256=PLAN_DIGEST,
    config_sha256=CONFIG_DIGEST,
    artifact_id=10,
):
    artifact = MagicMock()
    artifact.id = artifact_id
    artifact.status = status
    artifact.plan_sha256 = plan_sha256
    artifact.config_sha256 = config_sha256
    artifact.main_tf = "terraform { required_version = \">= 1.0.0\" }"
    artifact.variables_tf = ""
    artifact.outputs_tf = ""
    return artifact


# ========================================
# Planner: saved plan persistence
# ========================================


class TestConfigDigest:

    def test_digest_is_stable_and_filename_sensitive(self, tmp_path):
        files_a = {"main.tf": "a", "variables.tf": "b", "outputs.tf": "c"}
        files_b = {"variables.tf": "a", "main.tf": "b", "outputs.tf": "c"}

        assert config_digest(files_a) == config_digest(files_a)
        # Same contents on differently named files must produce a
        # different digest: the plan covers a concrete configuration.
        assert config_digest(files_a) != config_digest(files_b)

    def test_changed_content_changes_digest(self):
        assert config_digest({"main.tf": "a"}) != config_digest(
            {"main.tf": "b"}
        )

    def test_sha256_file_matches_content(self, tmp_path):
        first = tmp_path / "approved.tfplan"
        second = tmp_path / "other.tfplan"
        first.write_text("plan-bytes", encoding="utf-8")
        second.write_text("different-bytes", encoding="utf-8")

        assert sha256_file(first) != sha256_file(second)
        assert sha256_file(first) == sha256_file(first)


def _minimal_terraform_files():
    """Config that requires no providers, so init/plan run offline."""
    return {
        "main.tf": 'terraform { required_version = ">= 1.0.0" }',
        "variables.tf": 'variable "unused_marker" { default = "x" }',
        "outputs.tf": 'output "marker" { value = var.unused_marker }',
    }


def _terraform_available():
    return shutil.which("terraform") is not None


@pytest.mark.skipif(
    not _terraform_available(),
    reason="terraform CLI is not installed",
)
def test_plan_persists_saved_plan_and_digests(tmp_path):
    from app.services.terraform_storage import ensure_artifact_storage

    artifact_dir = ensure_artifact_storage(1, 10, tmp_path)

    result = plan_terraform(
        _minimal_terraform_files(),
        plan_dir=artifact_dir,
    )

    assert result["success"] is True, result["plan_error"]
    assert result["plan_sha256"] is not None
    assert result["config_sha256"] == config_digest(
        _minimal_terraform_files()
    )

    plan_file = get_plan_path(1, 10, tmp_path)
    assert plan_file.is_file()
    assert sha256_file(plan_file) == result["plan_sha256"]

    # Every configuration file was persisted next to the plan.
    for name, content in _minimal_terraform_files().items():
        assert (artifact_dir / name).read_text(
            encoding="utf-8"
        ) == content


@pytest.mark.skipif(
    not _terraform_available(),
    reason="terraform CLI is not installed",
)
def test_plan_without_plan_dir_keeps_legacy_contract(tmp_path):
    result = plan_terraform(_minimal_terraform_files())

    assert result["success"] is True
    assert "plan_sha256" not in result or result["plan_sha256"] is None


@pytest.mark.skipif(
    not _terraform_available(),
    reason="terraform CLI is not installed",
)
def test_saved_plan_is_applyable_artifact(tmp_path):
    """
    The saved plan file must be a real terraform plan artifact,
    loadable by `terraform show` — this proves the persisted plan is
    what apply will later consume, not a text dump.
    """
    artifact_dir = _ensure_storage(1, 20, tmp_path)

    result = plan_terraform(
        _minimal_terraform_files(),
        plan_dir=artifact_dir,
    )
    assert result["success"] is True, result["plan_error"]

    show = subprocess.run(
        ["terraform", "show", "-no-color", str(get_plan_path(1, 20, tmp_path))],
        cwd=artifact_dir,
        capture_output=True,
        text=True,
        timeout=120,
    )

    assert show.returncode == 0, show.stderr
    assert show.stdout.strip() != ""


# ========================================
# Plan endpoint: status + digest bookkeeping
# ========================================


class TestPlanEndpoint:

    @patch.object(tf_router, "plan_terraform")
    @patch.object(tf_router, "ensure_artifact_storage")
    def test_successful_plan_records_identity(
        self, storage_mock, plan_mock
    ):
        plan_mock.return_value = {
            "success": True,
            "plan_output": "Plan: 1 to add.",
            "plan_error": "",
            "plan_sha256": PLAN_DIGEST,
            "config_sha256": CONFIG_DIGEST,
        }

        project, artifact = make_project(), make_artifact(status="staged")
        db = make_db(project, artifact)
        artifact.query_mock.first.return_value = artifact
        project.query_mock.first.return_value = project
        artifact.query_mock.update.return_value = 1

        result = tf_router.plan_staged_terraform(5, 10, user_id=1, db=db)

        assert result["status"] == "plan_ready"
        assert result["plan_sha256"] == PLAN_DIGEST

        transition = artifact.query_mock.update.call_args.args[0]
        assert transition["status"] == "plan_ready"
        assert transition["plan_sha256"] == PLAN_DIGEST
        assert transition["config_sha256"] == CONFIG_DIGEST
        assert transition["planned_at"] is not None
        # A fresh plan identity is never born approved.
        assert transition["approved_at"] is None
        db.commit.assert_called()

    @patch.object(tf_router, "plan_terraform")
    @patch.object(tf_router, "ensure_artifact_storage")
    def test_failed_plan_cannot_become_plan_ready(
        self, storage_mock, plan_mock
    ):
        plan_mock.return_value = {
            "success": False,
            "plan_output": "",
            "plan_error": "invalid configuration",
        }

        project, artifact = make_project(), make_artifact(status="staged")
        db = make_db(project, artifact)
        artifact.query_mock.first.return_value = artifact
        project.query_mock.first.return_value = project
        artifact.query_mock.update.return_value = 1

        result = tf_router.plan_staged_terraform(5, 10, user_id=1, db=db)

        # A failed plan must leave the artifact staged and digest-free
        # so no stale plan can later be approved or applied.
        assert result["status"] == "staged"

        transition = artifact.query_mock.update.call_args.args[0]
        assert transition["status"] == "staged"
        assert transition["plan_sha256"] is None
        assert transition["config_sha256"] is None
        assert transition["planned_at"] is None
        # A failed re-plan also invalidates any previous approval state
        # so stale approval metadata can never survive.
        assert transition["approved_at"] is None
        db.commit.assert_called()


# ========================================
# Approve endpoint: saved-plan identity
# ========================================


class TestApproveEndpoint:

    def _db_for(self, artifact):
        project, artifact = make_project(), artifact
        db = make_db(project, artifact)
        artifact.query_mock.first.return_value = artifact
        project.query_mock.first.return_value = project
        return db, project, artifact

    def test_approve_rejects_artifact_not_plan_ready(self):
        db, _, _ = self._db_for(make_artifact(status="staged"))

        with pytest.raises(HTTPException) as exc:
            tf_router.approve_terraform_artifact(5, 10, user_id=1, db=db)

        assert exc.value.status_code == 400

    def test_approve_rejects_missing_saved_plan_identity(self):
        artifact = make_artifact(status="plan_ready", plan_sha256=None)
        db, _, _ = self._db_for(artifact)

        with pytest.raises(HTTPException) as exc:
            tf_router.approve_terraform_artifact(5, 10, user_id=1, db=db)

        assert exc.value.status_code == 400
        assert "no identified saved plan" in exc.value.detail

    @patch.object(tf_router, "get_plan_path")
    def test_approve_rejects_missing_plan_file(self, plan_path_mock, tmp_path):
        plan_path_mock.side_effect = lambda project_id, artifact_id, root=None: (
            tmp_path / "approved.tfplan"
        )

        db, _, _ = self._db_for(make_artifact(status="plan_ready"))

        with pytest.raises(HTTPException) as exc:
            tf_router.approve_terraform_artifact(5, 10, user_id=1, db=db)

        assert exc.value.status_code == 400
        assert "missing from protected storage" in exc.value.detail

    @patch.object(tf_router, "get_plan_path")
    def test_approve_rejects_tampered_plan_file(
        self, plan_path_mock, tmp_path
    ):
        plan_file = tmp_path / "approved.tfplan"
        plan_file.write_text("TAMPERED PLAN", encoding="utf-8")
        plan_path_mock.side_effect = (
            lambda project_id, artifact_id, root=None: plan_file
        )

        db, _, _ = self._db_for(make_artifact(status="plan_ready"))

        with pytest.raises(HTTPException) as exc:
            tf_router.approve_terraform_artifact(5, 10, user_id=1, db=db)

        assert exc.value.status_code == 400
        assert "has changed" in exc.value.detail
        # The artifact must NOT have been transitioned.
        artifact_status = db.artifact.status
        assert artifact_status != "approved"

    @patch.object(tf_router, "_verify_saved_plan_integrity")
    def test_approve_success_sets_approved_at(self, verify_mock):
        verify_mock.return_value = None

        db, _, artifact = self._db_for(make_artifact(status="plan_ready"))

        result = tf_router.approve_terraform_artifact(5, 10, user_id=1, db=db)

        assert artifact.status == "approved"
        assert artifact.approved_at is not None
        assert result["plan_sha256"] == PLAN_DIGEST


# ========================================
# Apply endpoint: gate, integrity, atomicity
# ========================================


class TestApplyEndpoint:

    def _db_for(self, artifact):
        project, artifact = make_project(), artifact
        db = make_db(project, artifact)
        artifact.query_mock.first.return_value = artifact
        project.query_mock.first.return_value = project
        return db, project, artifact

    @patch.object(tf_router, "applies_are_allowed")
    def test_apply_is_disabled_by_default(self, allowed_mock):
        allowed_mock.return_value = False

        db, _, _ = self._db_for(make_artifact(status="approved"))

        with pytest.raises(HTTPException) as exc:
            tf_router.apply_terraform_artifact(5, 10, user_id=1, db=db)

        assert exc.value.status_code == 403
        assert "disabled" in exc.value.detail
        # No deployment machinery may have been touched.
        assert not any(
            c.__name__ == "TerraformArtifact"
            and len(getattr(c, "mock_calls", [])) > 2
            for c in db.queries
        )

    def test_default_environment_disallows_applies(self, monkeypatch):
        monkeypatch.delenv(
            tf_router.APPLY_ENABLED_ENV, raising=False
        )

        with patch.dict(os.environ, {}, clear=False):
            assert tf_router.applies_are_allowed() is False

    def test_apply_requires_approved_status(self):
        db, _, _ = self._db_for(make_artifact(status="plan_ready"))

        with pytest.raises(HTTPException) as exc:
            tf_router.apply_terraform_artifact(5, 10, user_id=1, db=db)

        assert exc.value.status_code == 400

    @patch.object(tf_router, "applies_are_allowed")
    def test_apply_rejects_missing_plan_identity(self, allowed_mock):
        allowed_mock.return_value = True
        artifact = make_artifact(status="approved", plan_sha256=None)
        db, _, _ = self._db_for(artifact)

        with pytest.raises(HTTPException) as exc:
            tf_router.apply_terraform_artifact(5, 10, user_id=1, db=db)

        assert exc.value.status_code == 400
        assert "no identified saved plan" in exc.value.detail

    @patch.object(tf_router, "_verify_saved_plan_integrity")
    @patch.object(tf_router, "applies_are_allowed")
    def test_apply_rejects_when_saved_plan_is_stale(
        self, allowed_mock, verify_mock
    ):
        allowed_mock.return_value = True
        verify_mock.return_value = (
            "The saved Terraform plan file has changed since it was planned."
        )
        db, _, _ = self._db_for(make_artifact(status="approved"))

        with pytest.raises(HTTPException) as exc:
            tf_router.apply_terraform_artifact(5, 10, user_id=1, db=db)

        assert exc.value.status_code == 400
        assert "has changed" in exc.value.detail

    @patch.object(tf_router, "scan_terraform")
    @patch.object(tf_router, "get_artifact_storage_dir")
    @patch.object(tf_router, "get_plan_path")
    @patch.object(tf_router, "_verify_saved_plan_integrity")
    @patch.object(tf_router, "applies_are_allowed")
    def test_apply_claim_is_atomic(
        self,
        allowed_mock,
        verify_mock,
        plan_path_mock,
        dir_mock,
        scan_mock,
    ):
        allowed_mock.return_value = True
        verify_mock.return_value = None
        plan_path_mock.side_effect = (
            lambda project_id, artifact_id, root=None: MagicMock()
        )
        dir_mock.return_value = MagicMock()
        scan_mock.return_value = {
            "success": True,
            "passed": True,
            "summary": {"failed": 0, "passed": 0, "total": 0},
            "findings": [],
        }

        artifact = make_artifact(status="approved")
        db, _, artifact = self._db_for(artifact)

        # Simulate the conditional UPDATE matching no row: another
        # request already claimed the deployment.
        artifact.query_mock.update.return_value = 0

        with pytest.raises(HTTPException) as exc:
            tf_router.apply_terraform_artifact(5, 10, user_id=1, db=db)

        assert exc.value.status_code == 409
        assert "already deploying" in exc.value.detail
        # apply_saved_plan must never have been called.
        with patch.object(tf_router, "apply_saved_plan") as apply_mock:
            assert apply_mock.called is False

    @patch.object(tf_router, "apply_saved_plan")
    @patch.object(tf_router, "scan_terraform")
    @patch.object(tf_router, "ensure_artifact_storage")
    @patch.object(tf_router, "get_plan_path")
    @patch.object(tf_router, "_verify_saved_plan_integrity")
    @patch.object(tf_router, "applies_are_allowed")
    def test_apply_success_deploys_saved_plan(
        self,
        allowed_mock,
        verify_mock,
        plan_path_mock,
        storage_mock,
        scan_mock,
        apply_mock,
    ):
        allowed_mock.return_value = True
        verify_mock.return_value = None
        plan_path_mock.side_effect = (
            lambda project_id, artifact_id, root=None: MagicMock()
        )
        storage_mock.return_value = MagicMock()
        scan_mock.return_value = {
            "success": True,
            "passed": True,
            "summary": {"failed": 0, "passed": 0, "total": 0},
            "findings": [],
        }
        apply_mock.return_value = {
            "success": True,
            "stage": "apply",
            "apply_output": "Apply complete!",
            "apply_error": "",
        }

        artifact = make_artifact(status="approved")
        db, _, artifact = self._db_for(artifact)
        artifact.query_mock.update.return_value = 1

        result = tf_router.apply_terraform_artifact(5, 10, user_id=1, db=db)

        assert result["status"] == "deployed"
        assert result["success"] is True
        # The saved plan — not the raw files — is what was applied.
        assert apply_mock.call_args.kwargs["plan_path"] is not None

    @patch.object(tf_router, "apply_saved_plan")
    @patch.object(tf_router, "scan_terraform")
    @patch.object(tf_router, "ensure_artifact_storage")
    @patch.object(tf_router, "get_plan_path")
    @patch.object(tf_router, "_verify_saved_plan_integrity")
    @patch.object(tf_router, "applies_are_allowed")
    def test_apply_in_flight_failure_requires_reconciliation(
        self,
        allowed_mock,
        verify_mock,
        plan_path_mock,
        storage_mock,
        scan_mock,
        apply_mock,
    ):
        allowed_mock.return_value = True
        verify_mock.return_value = None
        plan_path_mock.side_effect = (
            lambda project_id, artifact_id, root=None: MagicMock()
        )
        storage_mock.return_value = MagicMock()
        scan_mock.return_value = {
            "success": True,
            "passed": True,
            "summary": {"failed": 0, "passed": 0, "total": 0},
            "findings": [],
        }
        apply_mock.return_value = {
            "success": False,
            "stage": "apply",
            "terraform_apply_started": True,
            "apply_output": "",
            "apply_error": "provider error: quota exceeded",
        }

        artifact = make_artifact(status="approved")
        db, _, artifact = self._db_for(artifact)
        artifact.query_mock.update.return_value = 1

        result = tf_router.apply_terraform_artifact(5, 10, user_id=1, db=db)

        # The apply subprocess WAS in flight and then failed: Terraform
        # may have partially modified real infrastructure. The outcome
        # is uncertain, so the artifact must NOT be returned to
        # approved and must NOT automatically be re-approvable.
        assert result["status"] == "reconciliation_required"
        assert result["success"] is False
        assert "quota exceeded" in result["apply_error"]

    @patch.object(tf_router, "apply_saved_plan")
    @patch.object(tf_router, "scan_terraform")
    @patch.object(tf_router, "ensure_artifact_storage")
    @patch.object(tf_router, "get_plan_path")
    @patch.object(tf_router, "_verify_saved_plan_integrity")
    @patch.object(tf_router, "applies_are_allowed")
    def test_apply_pre_launch_failure_stays_approved_and_retryable(
        self,
        allowed_mock,
        verify_mock,
        plan_path_mock,
        storage_mock,
        scan_mock,
        apply_mock,
    ):
        allowed_mock.return_value = True
        verify_mock.return_value = None
        plan_path_mock.side_effect = (
            lambda project_id, artifact_id, root=None: MagicMock()
        )
        storage_mock.return_value = MagicMock()
        scan_mock.return_value = {
            "success": True,
            "passed": True,
            "summary": {"failed": 0, "passed": 0, "total": 0},
            "findings": [],
        }
        apply_mock.return_value = {
            "success": False,
            "stage": "init",
            "terraform_apply_started": False,
            "apply_output": "",
            "apply_error": "Terraform initialization failed.",
        }

        artifact = make_artifact(status="approved")
        db, _, artifact = self._db_for(artifact)
        artifact.query_mock.update.return_value = 1

        result = tf_router.apply_terraform_artifact(5, 10, user_id=1, db=db)

        # Provably no `terraform apply` subprocess ever started, so
        # real infrastructure is untouched and the SAME approved plan
        # remains retryable.
        assert result["status"] == "approved"
        assert result["success"] is False
        assert "initialization failed" in result["apply_error"]

    def test_apply_rejects_reconciliation_required_status(self):
        """
        After an interrupted/uncertain apply the artifact can never be
        re-applied directly: reconciliation is mandatory first.
        """
        db, _, _ = self._db_for(
            make_artifact(status="reconciliation_required")
        )

        with pytest.raises(HTTPException) as exc:
            tf_router.apply_terraform_artifact(5, 10, user_id=1, db=db)

        assert exc.value.status_code == 400
        assert "reconciliation_required" in exc.value.detail


# ========================================
# Applier: real commands
# ========================================


class TestApplier:

    def test_apply_saved_plan_needs_explicit_enabling(self, monkeypatch):
        from app.services.terraform_applier import applies_are_allowed

        monkeypatch.delenv("CLOUDFORGE_ALLOW_TERRAFORM_APPLY", raising=False)
        assert applies_are_allowed() is False

        monkeypatch.setenv("CLOUDFORGE_ALLOW_TERRAFORM_APPLY", "0")
        assert applies_are_allowed() is False

    def test_project_lock_is_shared_per_id(self):
        from app.services.terraform_applier import get_project_apply_lock

        assert get_project_apply_lock(7) is get_project_apply_lock(7)
        assert get_project_apply_lock(7) is not get_project_apply_lock(8)


def _owned_db_for(artifact):
    project = make_project()
    db = make_db(project, artifact)
    artifact.query_mock.first.return_value = artifact
    project.query_mock.first.return_value = project
    return db, project, artifact


class TestApplyLastLinesOfDefense:

    def test_apply_saved_plan_respects_kill_switch_internally(
        self, monkeypatch, tmp_path
    ):
        """
        The applier must re-check the kill switch immediate before any
        Terraform subprocess could start (defense in depth behind the
        router gate).
        """
        from app.services.terraform_applier import apply_saved_plan

        monkeypatch.setenv("CLOUDFORGE_ALLOW_TERRAFORM_APPLY", "0")
        plan_path = tmp_path / "approved.tfplan"
        plan_path.write_text("plan-bytes", encoding="utf-8")

        with patch(
            "app.services.terraform_applier.subprocess.run"
        ) as run_mock:
            result = apply_saved_plan(
                project_id=1,
                plan_dir=tmp_path,
                plan_path=plan_path,
            )

        assert result["success"] is False
        assert result["stage"] == "authorization"
        assert "disabled" in result["apply_error"]
        run_mock.assert_not_called()

    def test_apply_saved_plan_verifies_digest_before_apply(
        self, monkeypatch, tmp_path
    ):
        """
        The exact approved plan must still match its recorded digest
        right before execution. A modified plan can never reach apply.
        """
        from app.services.terraform_applier import apply_saved_plan

        monkeypatch.setenv("CLOUDFORGE_ALLOW_TERRAFORM_APPLY", "1")
        monkeypatch.setenv("CLOUDFORGE_RDS_PASSWORD", "fixture-only-value")

        plan_path = tmp_path / "approved.tfplan"
        plan_path.write_bytes(b"MUTATED PLAN BYTES")

        result = apply_saved_plan(
            project_id=1,
            plan_dir=tmp_path,
            plan_path=plan_path,
            expected_plan_digest=("f" * 64),
        )

        assert result["success"] is False
        assert result["stage"] == "authorization"
        assert "no longer matches" in result["apply_error"]

    def test_apply_saved_plan_rejects_missing_plan_file(
        self, monkeypatch, tmp_path
    ):
        from app.services.terraform_applier import apply_saved_plan

        monkeypatch.setenv("CLOUDFORGE_ALLOW_TERRAFORM_APPLY", "1")
        monkeypatch.setenv("CLOUDFORGE_RDS_PASSWORD", "fixture-only-value")

        result = apply_saved_plan(
            project_id=1,
            plan_dir=tmp_path,
            plan_path=tmp_path / "approved.tfplan",
            expected_plan_digest=("a" * 64),
        )

        assert result["success"] is False
        assert result["stage"] == "authorization"
        assert "missing" in result["apply_error"]

    def test_project_lock_is_released_on_exception(self, monkeypatch, tmp_path):
        """
        A crash inside the apply critical section must not wedge the
        per-project lock for future deployments.
        """
        from app.services.terraform_applier import (
            apply_saved_plan,
            get_project_apply_lock,
        )

        monkeypatch.setenv("CLOUDFORGE_ALLOW_TERRAFORM_APPLY", "1")
        monkeypatch.setenv("CLOUDFORGE_RDS_PASSWORD", "fixture-only-value")

        with patch(
            "app.services.terraform_applier.subprocess.run",
            side_effect=RuntimeError("explode inside lock"),
        ):
            result = apply_saved_plan(
                project_id=3,
                plan_dir=tmp_path,
                plan_path=tmp_path / "approved.tfplan",
            )

        # The unexpected crash is reported honestly as a failure...
        assert result["success"] is False
        assert "explode inside lock" in result["apply_error"]

        # ...and the lock is free again immediately (non-blocking).
        lock = get_project_apply_lock(3)
        assert lock.acquire(timeout=0)
        lock.release()


class TestOwnershipPreflight:

    def test_unowned_project_is_404_indistinguishable_from_missing(self):
        """
        Every Terraform route resolves its project through
        _get_owned_project, so another user's project is exactly
        indistinguishable from a missing one (404).
        """
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        with pytest.raises(HTTPException) as exc:
            tf_router._get_owned_project(db, 99, user_id=2)

        assert exc.value.status_code == 404
        assert exc.value.detail == "Project not found"

    def test_owned_project_is_returned_directly(self):
        db = MagicMock()
        project = make_project()
        project.query_mock = MagicMock()
        project.query_mock.filter.return_value = project.query_mock
        project.query_mock.first.return_value = project
        db.query.return_value = project.query_mock

        assert tf_router._get_owned_project(db, 5, user_id=1) is project


class TestAuditTrail:

    @patch.object(tf_router, "_record_terraform_action")
    @patch.object(tf_router, "_verify_saved_plan_integrity")
    def test_approval_writes_audit_event(
        self, verify_mock, record_mock
    ):
        verify_mock.return_value = None

        artifact = make_artifact(status="plan_ready")
        db, project, artifact = _owned_db_for(artifact)

        result = tf_router.approve_terraform_artifact(5, 10, user_id=1, db=db)

        assert record_mock.called
        kwargs = record_mock.call_args.kwargs
        assert kwargs["category"] == "terraform_approval"
        assert kwargs["severity"] == "info"
        assert result["status"] == "approved"

    @patch.object(tf_router, "_record_terraform_action")
    def test_apply_failure_writes_error_audit_event(self, record_mock):
        artifact = make_artifact(status="approved")
        db, _, artifact = _owned_db_for(artifact)
        artifact.query_mock.update.return_value = 1

        with (
            patch.object(
                tf_router, "_verify_saved_plan_integrity", return_value=None
            ),
            patch.object(tf_router, "applies_are_allowed", return_value=True),
            patch.object(
                tf_router, "ensure_artifact_storage", return_value=MagicMock()
            ),
            patch.object(
                tf_router, "get_plan_path", side_effect=lambda *_: MagicMock()
            ),
            patch.object(
                tf_router,
                "scan_terraform",
                return_value={
                    "success": True,
                    "passed": True,
                    "summary": {"failed": 0, "passed": 0, "total": 0},
                    "findings": [],
                },
            ),
            patch.object(
                tf_router,
                "apply_saved_plan",
                return_value={
                    "success": False,
                    "stage": "apply",
                    "apply_output": "",
                    "apply_error": "state lock failed",
                },
            ),
        ):
            tf_router.apply_terraform_artifact(5, 10, user_id=1, db=db)

        kwargs = record_mock.call_args.kwargs
        assert kwargs["category"] == "terraform_apply"
        assert kwargs["severity"] == "error"
        assert "state lock failed" in kwargs["message"]
