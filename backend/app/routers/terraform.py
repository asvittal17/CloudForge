import subprocess
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user_id
from app.db.dependencies import get_db
from app.models.infrastructure import Infrastructure
from app.models.project import Project
from app.models.terraform_artifact import (
    STATUS_APPROVED,
    STATUS_APPLYING,
    STATUS_DEPLOYED,
    STATUS_PLAN_READY,
    STATUS_RECONCILIATION_REQUIRED,
    STATUS_STAGED,
    TerraformArtifact,
)
from app.schemas.terraform import (
    TerraformStageRequest,
    TerraformStageResponse,
)
from app.services.terraform_applier import (
    APPLY_ENABLED_ENV,
    apply_saved_plan,
    applies_are_allowed,
)
from app.services.terraform_generator import generate_terraform
from app.services.terraform_planner import (
    config_digest,
    plan_terraform,
    sha256_file,
)
from app.services.terraform_storage import (
    ensure_artifact_storage,
    get_artifact_storage_dir,
    get_plan_path,
)
from app.services.terraform_validator import validate_terraform
from app.services.terraform_security_scanner import scan_terraform


router = APIRouter(
    prefix="/terraform",
    tags=["Terraform"],
)


def _get_owned_project(
    db: Session,
    project_id: int,
    user_id: int,
) -> Project:
    """
    Single ownership preflight for every Terraform route.

    Ownership and authentication are checked in ONE place. A project
    owned by someone else is indistinguishable from a missing project
    (404), which also protects against insecure direct object
    references.
    """
    project = (
        db.query(Project)
        .filter(
            Project.id == project_id,
            Project.owner_id == user_id,
        )
        .first()
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    return project


def _record_terraform_action(
    db: Session,
    *,
    category: str,
    message: str,
    project_id: int,
    artifact_id: int,
    severity: str,
) -> None:
    """
    Append a deployment audit event. record_error never raises, so
    audit failures cannot break the deployment workflow.
    """
    from app.core.monitoring import record_error

    record_error(
        db,
        source="backend",
        category=category,
        message=message,
        severity=severity,
        route=f"/terraform/{project_id}/artifacts/{artifact_id}",
        http_method="POST",
        http_status=200,
    )


# ========================================
# Generate Terraform
# ========================================

@router.get("/{project_id}")
def generate_project_terraform(
    project_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(db, project_id, user_id)

    infrastructure = (
        db.query(Infrastructure)
        .filter(
            Infrastructure.project_id == project_id
        )
        .first()
    )

    if not infrastructure:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Infrastructure configuration not found",
        )

    try:
        terraform_files = generate_terraform(
            infrastructure
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )

    return {
        "project_id": project.id,
        "project_name": project.name,
        "cloud_provider": infrastructure.cloud_provider,
        "region": infrastructure.region,
        "environment": infrastructure.environment,
        "files": terraform_files,
    }


# ========================================
# Validate Terraform
# ========================================

@router.get("/{project_id}/validate")
def validate_project_terraform(
    project_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(db, project_id, user_id)

    # Validate the Terraform artifact produced by the AI Builder,
    # rather than regenerating a separate configuration from Infrastructure.
    artifact = (
        db.query(TerraformArtifact)
        .filter(
            TerraformArtifact.project_id == project_id,
            TerraformArtifact.status.in_(
                [STATUS_STAGED, STATUS_PLAN_READY, STATUS_APPROVED]
            ),
        )
        .order_by(TerraformArtifact.id.desc())
        .first()
    )

    if artifact is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "No staged Terraform artifact was found. "
                "Compile and stage the AI-generated Terraform first."
            ),
        )

    terraform_files = {
        "main.tf": artifact.main_tf or "",
        "variables.tf": artifact.variables_tf or "",
        "outputs.tf": artifact.outputs_tf or "",
    }

    missing_files = [
        filename
        for filename, content in terraform_files.items()
        if not content.strip()
    ]
    if missing_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "The staged Terraform artifact is missing required file(s): "
                + ", ".join(missing_files)
            ),
        )

    try:
        validation_result = validate_terraform(terraform_files)

    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="Terraform validation timed out",
        )

    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Terraform executable was not found",
        )

    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Terraform validation failed: {error}",
        )

    return {
        "project_id": project.id,
        "project_name": project.name,
        "artifact_id": artifact.id,
        "artifact_status": artifact.status,
        "valid": validation_result["valid"],
        "formatted": validation_result["formatted"],
        "format_output": validation_result["format_output"],
        "format_error": validation_result["format_error"],
        "validation_output": validation_result["validation_output"],
        "validation_error": validation_result["validation_error"],
    }


# ========================================
# Terraform Plan
# ========================================

@router.get("/{project_id}/plan")
def plan_project_terraform(
    project_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(db, project_id, user_id)

    infrastructure = (
        db.query(Infrastructure)
        .filter(
            Infrastructure.project_id == project_id
        )
        .first()
    )

    if not infrastructure:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Infrastructure configuration not found",
        )

    try:
        terraform_files = generate_terraform(
            infrastructure
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )

    try:
        plan_result = plan_terraform(
            terraform_files
        )

    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="Terraform plan timed out",
        )

    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Terraform executable was not found",
        )

    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Terraform plan failed: {error}",
        )

    return {
        "project_id": project.id,
        "project_name": project.name,
        "success": plan_result["success"],
        "plan_output": plan_result["plan_output"],
        "plan_error": plan_result["plan_error"],
    }


# ========================================
# Stage Terraform Artifact
# ========================================

@router.post(
    "/{project_id}/stage",
    response_model=TerraformStageResponse,
)
def stage_terraform(
    project_id: int,
    request_data: TerraformStageRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(db, project_id, user_id)

    if not request_data.main_tf.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="main.tf cannot be empty",
        )

    if not request_data.variables_tf.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="variables.tf cannot be empty",
        )

    if not request_data.outputs_tf.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="outputs.tf cannot be empty",
        )

    artifact = TerraformArtifact(
        project_id=project_id,
        main_tf=request_data.main_tf,
        variables_tf=request_data.variables_tf,
        outputs_tf=request_data.outputs_tf,
        status="staged",
    )

    db.add(artifact)
    db.commit()
    db.refresh(artifact)

    return {
        "id": artifact.id,
        "project_id": artifact.project_id,
        "status": artifact.status,
        "message": "Terraform configuration staged successfully",
    }


# ========================================

# ========================================
# Scan Terraform Artifact for Security Issues
# ========================================

@router.post("/{project_id}/artifacts/{artifact_id}/security-scan")
def scan_staged_terraform_security(
    project_id: int,
    artifact_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Scan the exact Terraform artifact stored in the database."""

    project = _get_owned_project(db, project_id, user_id)

    artifact = (
        db.query(TerraformArtifact)
        .filter(
            TerraformArtifact.id == artifact_id,
            TerraformArtifact.project_id == project_id,
        )
        .first()
    )

    if artifact is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Terraform artifact not found",
        )

    allowed_statuses = {
        STATUS_STAGED,
        STATUS_PLAN_READY,
        STATUS_APPROVED,
    }
    if artifact.status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "This Terraform artifact cannot be scanned in its current "
                f"status: '{artifact.status}'."
            ),
        )

    terraform_files = {
        "main.tf": artifact.main_tf or "",
        "variables.tf": artifact.variables_tf or "",
        "outputs.tf": artifact.outputs_tf or "",
    }

    try:
        result = scan_terraform(terraform_files)
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="Terraform security scan timed out",
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Checkov executable was not found. Verify the backend "
                "virtual environment."
            ),
        )
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Terraform security scan failed: {error}",
        )

    if not isinstance(result, dict):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Terraform security scanner returned an unexpected response.",
        )

    # A completed scan with failed checks is still a valid scan result.
    # `passed` indicates whether the security policy checks passed.
    return {
        "project_id": project.id,
        "project_name": project.name,
        "artifact_id": artifact.id,
        "artifact_status": artifact.status,
        **result,
    }


# ========================================
# Plan Staged Terraform Artifact
# ========================================

@router.post(
    "/{project_id}/artifacts/{artifact_id}/plan"
)
def plan_staged_terraform(
    project_id: int,
    artifact_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(db, project_id, user_id)

    artifact = (
        db.query(TerraformArtifact)
        .filter(
            TerraformArtifact.id == artifact_id,
            TerraformArtifact.project_id == project_id,
        )
        .first()
    )

    if not artifact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Terraform artifact not found",
        )

    # Re-planning is allowed from any pre-deployment state so an
    # interrupted apply, a stale approval, or tampered plan files can
    # be recovered exactly the way the integrity errors instruct:
    # reconcile/inspect externally, then re-plan, re-verify and
    # re-approve. An artifact that is currently applying or deployed
    # is never planned.
    eligible_statuses = {
        STATUS_STAGED,
        STATUS_PLAN_READY,
        STATUS_APPROVED,
        STATUS_RECONCILIATION_REQUIRED,
    }
    if artifact.status not in eligible_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Terraform artifact cannot be planned "
                f"because its status is '{artifact.status}'."
            ),
        )

    # The transition below is guarded on the status an artifact had
    # when planning STARTED; a concurrent apply/approve/re-plan that
    # already moved the artifact on is never silently overwritten.
    original_status = artifact.status

    terraform_files = {
        "main.tf": artifact.main_tf,
        "variables.tf": artifact.variables_tf,
        "outputs.tf": artifact.outputs_tf,
    }

    try:
        artifact_dir = ensure_artifact_storage(
            project_id, artifact_id
        )
        plan_result = plan_terraform(
            terraform_files,
            plan_dir=artifact_dir,
        )

    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="Terraform plan timed out",
        )

    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Terraform executable was not found",
        )

    except OSError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Terraform planning failed: {error}",
        )

    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Terraform planning failed: {error}",
        )

    utcnow = datetime.utcnow()

    if plan_result.get("success", False):
        # The artifact is now identified by the exact configuration it
        # was planned from and the saved plan produced for it. The
        # transition uses a conditional UPDATE (mirroring the apply
        # claim) so no concurrent approval or apply on this artifact
        # can be clobbered by this request.
        claimed = (
            db.query(TerraformArtifact)
            .filter(
                TerraformArtifact.id == artifact_id,
                TerraformArtifact.project_id == project_id,
                TerraformArtifact.status == original_status,
            )
            .update(
                {
                    "status": STATUS_PLAN_READY,
                    "plan_sha256": plan_result["plan_sha256"],
                    "config_sha256": plan_result["config_sha256"],
                    "planned_at": utcnow,
                    # Any previous approval belonged to the OLD plan
                    # identity and is invalidated by re-planning.
                    "approved_at": None,
                }
            )
        )
        plan_outcome_status = STATUS_PLAN_READY
    else:
        # A failed or unpersisted plan must never be approvable, and
        # it leaves no old plan metadata that could look valid for a
        # new configuration.
        claimed = (
            db.query(TerraformArtifact)
            .filter(
                TerraformArtifact.id == artifact_id,
                TerraformArtifact.project_id == project_id,
                TerraformArtifact.status == original_status,
            )
            .update(
                {
                    "status": STATUS_STAGED,
                    "plan_sha256": None,
                    "config_sha256": None,
                    "planned_at": None,
                    "approved_at": None,
                }
            )
        )
        plan_outcome_status = STATUS_STAGED

    db.commit()

    if claimed != 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "The Terraform artifact changed state concurrently "
                "while the plan was being created. Reload the artifact "
                "and try again."
            ),
        )

    db.refresh(artifact)

    return {
        "artifact_id": artifact.id,
        "project_id": project.id,
        "project_name": project.name,
        # Explicit planning outcome for the API contract: `success` is
        # true EXACTLY when a plan was generated AND persisted, which
        # is also what moved the artifact to plan_ready. Callers must
        # never infer success from plan_output text or plan_error
        # emptiness.
        "success": plan_result.get("success", False),
        "status": plan_outcome_status,
        "plan_output": plan_result.get("plan_output", ""),
        "plan_error": plan_result.get("plan_error", ""),
        "plan_sha256": plan_result.get("plan_sha256"),
        "config_sha256": plan_result.get("config_sha256"),
        "planned_at": artifact.planned_at,
    }


def _verify_saved_plan_integrity(
    project_id: int,
    artifact: TerraformArtifact,
) -> str | None:
    """
    Verify that the saved plan identified by the artifact still exists
    and is byte-for-byte the plan that was generated and approved.
    Also verifies the stored configuration matches the planned digest.

    Returns an error message when verification fails, else None.
    """

    plan_path = get_plan_path(project_id, artifact.id)

    if not plan_path.is_file():
        return (
            "The saved Terraform plan file is missing from protected "
            "storage. Re-plan this artifact to create it."
        )

    if sha256_file(plan_path) != artifact.plan_sha256:
        return (
            "The saved Terraform plan file has changed since it was "
            "planned. The approved plan identity no longer matches; "
            "re-plan this artifact."
        )

    # The configuration must be exactly what was planned: if any
    # stored .tf file differs, the saved plan no longer corresponds
    # to the artifact the user sees.
    stored_files = {
        "main.tf": artifact.main_tf,
        "variables.tf": artifact.variables_tf,
        "outputs.tf": artifact.outputs_tf,
    }

    if config_digest(stored_files) != artifact.config_sha256:
        return (
            "The artifact configuration has changed since the plan "
            "was generated. Re-plan this artifact before approval."
        )

    artifact_dir = get_artifact_storage_dir(project_id, artifact.id)
    for filename, content in stored_files.items():
        stored_path = artifact_dir / filename
        if not stored_path.is_file() or (
            stored_path.read_text(encoding="utf-8") != content
        ):
            return (
                f"The stored configuration file '{filename}' is "
                "missing from or differs in protected storage. "
                "Re-plan this artifact."
            )

    return None


# ========================================
# Approve Terraform Artifact
# ========================================

@router.post(
    "/{project_id}/artifacts/{artifact_id}/approve"
)
def approve_terraform_artifact(
    project_id: int,
    artifact_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(db, project_id, user_id)

    artifact = (
        db.query(TerraformArtifact)
        .filter(
            TerraformArtifact.id == artifact_id,
            TerraformArtifact.project_id == project_id,
        )
        .first()
    )

    if not artifact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Terraform artifact not found",
        )

    if artifact.status != STATUS_PLAN_READY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Terraform artifact can only be approved "
                "after a successful Terraform plan. "
                f"Current status: '{artifact.status}'."
            ),
        )

    if not artifact.plan_sha256 or not artifact.config_sha256:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Terraform artifact has no identified saved plan to "
                "approve. Re-plan this artifact to create one."
            ),
        )

    try:
        plan_error = _verify_saved_plan_integrity(
            project_id, artifact
        )
    except OSError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Saved plan verification failed: {error}",
        )

    if plan_error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=plan_error,
        )

    artifact.status = STATUS_APPROVED
    artifact.approved_at = datetime.utcnow()

    db.commit()
    db.refresh(artifact)

    _record_terraform_action(
        db,
        category="terraform_approval",
        message=(
            f"User {user_id} approved artifact {artifact.id} "
            f"in project {project_id} (plan sha256 "
            f"{artifact.plan_sha256})"
        ),
        project_id=project_id,
        artifact_id=artifact.id,
        severity="info",
    )

    return {
        "artifact_id": artifact.id,
        "project_id": project.id,
        "project_name": project.name,
        "status": artifact.status,
        "plan_sha256": artifact.plan_sha256,
        "config_sha256": artifact.config_sha256,
        "approved_at": artifact.approved_at,
        "message": "Terraform artifact approved successfully",
    }


# ========================================
# Apply Approved Terraform Artifact
# ========================================

@router.post(
    "/{project_id}/artifacts/{artifact_id}/apply"
)
def apply_terraform_artifact(
    project_id: int,
    artifact_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(db, project_id, user_id)

    # ----------------------------------------
    # Find Terraform artifact
    # ----------------------------------------

    artifact = (
        db.query(TerraformArtifact)
        .filter(
            TerraformArtifact.id == artifact_id,
            TerraformArtifact.project_id == project_id,
        )
        .first()
    )

    if not artifact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Terraform artifact not found",
        )

    # ----------------------------------------
    # SAFETY CHECK
    # Only APPROVED artifacts can be deployed
    # ----------------------------------------

    if artifact.status != STATUS_APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Terraform artifact can only be deployed "
                "after approval. "
                f"Current status: '{artifact.status}'."
            ),
        )

    # ----------------------------------------
    # AUDIT MODE GATE
    # Real infrastructure operations stay disabled
    # unless explicitly allowed in this environment.
    # ----------------------------------------

    if not applies_are_allowed():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Real infrastructure deployment is disabled: "
                f"{APPLY_ENABLED_ENV} is not set to an enabled value, "
                "so no terraform apply subprocess can run until the "
                "gate is deliberately enabled with the required "
                "infrastructure credentials. Planning, scanning, "
                "integrity verification and approval remain available."
            ),
        )

    # ----------------------------------------
    # SAVED PLAN INTEGRITY
    # The approved plan file must still exist and match
    # the digests recorded at plan/approval time.
    # ----------------------------------------

    if not artifact.plan_sha256 or not artifact.config_sha256:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Terraform artifact has no identified saved plan. "
                "Re-plan and re-approve this artifact."
            ),
        )

    try:
        integrity_error = _verify_saved_plan_integrity(
            project_id, artifact
        )
    except OSError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Saved plan verification failed: {error}",
        )

    if integrity_error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=integrity_error,
        )

    # ----------------------------------------
    # SECURITY GATE
    # Re-scan the exact stored artifact immediately before apply.
    # Fail closed if Checkov cannot run or any policy checks fail.
    # ----------------------------------------

    terraform_files = {
        "main.tf": artifact.main_tf,
        "variables.tf": artifact.variables_tf,
        "outputs.tf": artifact.outputs_tf,
    }

    try:
        security_result = scan_terraform(terraform_files)
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Deployment blocked: Terraform security scan failed: {error}",
        )

    if not security_result.get("success", False):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "message": "Deployment blocked because the security scan could not complete.",
                "error": security_result.get(
                    "error",
                    "Terraform security scan failed",
                ),
            },
        )

    if not security_result.get("passed", False):
        summary = security_result.get("summary", {})
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "message": (
                    "Deployment blocked by CloudForge security policy. "
                    "Resolve the failed checks before applying this artifact."
                ),
                "artifact_id": artifact.id,
                "failed_checks": summary.get("failed", 0),
                "passed_checks": summary.get("passed", 0),
                "total_checks": summary.get("total", 0),
                "findings": security_result.get("findings", []),
            },
        )

    # ----------------------------------------
    # ATOMIC CLAIM
    # Transition approved -> applying with a conditional
    # UPDATE so a second concurrent request cannot start a
    # duplicate deployment while one is in flight.
    # ----------------------------------------

    claimed = (
        db.query(TerraformArtifact)
        .filter(
            TerraformArtifact.id == artifact.id,
            TerraformArtifact.project_id == project_id,
            TerraformArtifact.status == STATUS_APPROVED,
        )
        .update(
            {"status": STATUS_APPLYING}
        )
    )
    db.commit()

    if claimed != 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This Terraform artifact is not open for deployment: "
                "it is already deploying, deployed, or its status "
                "changed concurrently. Refresh and try again."
            ),
        )

    plan_path = get_plan_path(project_id, artifact.id)
    plan_dir = ensure_artifact_storage(project_id, artifact.id)
    apply_result: dict | None = None

    try:
        apply_result = apply_saved_plan(
            project_id=project_id,
            plan_dir=plan_dir,
            plan_path=plan_path,
            expected_plan_digest=artifact.plan_sha256,
        )
    except Exception as error:
        # apply_saved_plan is designed to return structured failures;
        # an escape here means the failure happened before/around the
        # call itself, so no apply subprocess could have been in
        # flight (classified conservatively by the flag below).
        apply_result = {
            "success": False,
            "stage": "apply",
            "terraform_apply_started": False,
            "apply_output": "",
            "apply_error": f"Terraform deployment failed: {error}",
        }

    # ----------------------------------------
    # Accurate final status. A success never pretends
    # to be pending; a failure never pretends to be
    # deployed; and an outcome where the apply
    # subprocess was actually in flight can never be
    # treated as clean or automatically re-approved:
    # Terraform may have partially created or changed
    # real infrastructure before failing or being
    # killed, and nothing on the server can prove a
    # clean result afterwards.
    # ----------------------------------------

    db.refresh(artifact)

    apply_started = apply_result.get("terraform_apply_started", True)

    if apply_result.get("success", False):
        artifact.status = STATUS_DEPLOYED
        final_severity = "info"
        outcome_message = "deployment reported success"
    elif apply_started:
        artifact.status = STATUS_RECONCILIATION_REQUIRED
        final_severity = "error"
        outcome_message = (
            "deployment FAILED at stage "
            f"'{apply_result.get('stage', 'unknown')}': "
            f"{apply_result.get('apply_error', '')[:300]} "
            "-> the artifact is now 'reconciliation_required' because "
            "the real infrastructure outcome is uncertain; it must be "
            "reconciled, then re-planned and re-approved, before any "
            "further apply."
        )
    else:
        # Provably NO `terraform apply` subprocess was ever started:
        # real infrastructure is untouched, so retrying the very same
        # approved plan later is demonstrably safe and the artifact
        # returns to "approved".
        artifact.status = STATUS_APPROVED
        final_severity = "error"
        outcome_message = (
            "deployment FAILED at stage "
            f"'{apply_result.get('stage', 'unknown')}': "
            f"{apply_result.get('apply_error', '')[:300]} "
            "(no terraform apply subprocess ever started; "
            "infrastructure untouched, artifact remains 'approved')"
        )

    db.commit()
    db.refresh(artifact)

    _record_terraform_action(
        db,
        category="terraform_apply",
        message=(
            f"User {user_id} applied artifact {artifact.id} in "
            f"project {project_id}: {outcome_message}"
        ),
        project_id=project_id,
        artifact_id=artifact.id,
        severity=final_severity,
    )

    return {
        "artifact_id": artifact.id,
        "project_id": project.id,
        "project_name": project.name,
        "status": artifact.status,
        "plan_sha256": artifact.plan_sha256,
        **apply_result,
    }
