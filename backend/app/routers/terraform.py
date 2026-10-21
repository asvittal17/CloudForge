import subprocess

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user_id
from app.db.dependencies import get_db
from app.models.infrastructure import Infrastructure
from app.models.project import Project
from app.models.terraform_artifact import TerraformArtifact
from app.schemas.terraform import (
    TerraformStageRequest,
    TerraformStageResponse,
)
from app.services.terraform_applier import apply_terraform
from app.services.terraform_generator import generate_terraform
from app.services.terraform_planner import plan_terraform
from app.services.terraform_validator import validate_terraform
from app.services.terraform_security_scanner import scan_terraform


router = APIRouter(
    prefix="/terraform",
    tags=["Terraform"],
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

    # Validate the Terraform artifact produced by the AI Builder,
    # rather than regenerating a separate configuration from Infrastructure.
    artifact = (
        db.query(TerraformArtifact)
        .filter(
            TerraformArtifact.project_id == project_id,
            TerraformArtifact.status.in_(
                ["staged", "plan_ready", "approved"]
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

    project = (
        db.query(Project)
        .filter(
            Project.id == project_id,
            Project.owner_id == user_id,
        )
        .first()
    )

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

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

    allowed_statuses = {"staged", "plan_ready", "approved"}
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

    if artifact.status != "staged":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Terraform artifact cannot be planned "
                f"because its status is '{artifact.status}'."
            ),
        )

    terraform_files = {
        "main.tf": artifact.main_tf,
        "variables.tf": artifact.variables_tf,
        "outputs.tf": artifact.outputs_tf,
    }

    try:
        result = plan_terraform(
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
            detail=f"Terraform planning failed: {error}",
        )

    if result["success"]:
        artifact.status = "plan_ready"

        db.commit()
        db.refresh(artifact)

    return {
        "artifact_id": artifact.id,
        "project_id": project.id,
        "project_name": project.name,
        "status": artifact.status,
        **result,
    }


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

    if artifact.status != "plan_ready":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Terraform artifact can only be approved "
                "after a successful Terraform plan. "
                f"Current status: '{artifact.status}'."
            ),
        )

    artifact.status = "approved"

    db.commit()
    db.refresh(artifact)

    return {
        "artifact_id": artifact.id,
        "project_id": project.id,
        "project_name": project.name,
        "status": artifact.status,
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
    # ----------------------------------------
    # Verify project ownership
    # ----------------------------------------

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

    if artifact.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Terraform artifact can only be deployed "
                "after approval. "
                f"Current status: '{artifact.status}'."
            ),
        )

    # ----------------------------------------
    # Prepare Terraform files
    # ----------------------------------------

    terraform_files = {
        "main.tf": artifact.main_tf,
        "variables.tf": artifact.variables_tf,
        "outputs.tf": artifact.outputs_tf,
    }

    # ----------------------------------------
    # SECURITY GATE
    # Re-scan the exact stored artifact immediately before apply.
    # Fail closed if Checkov cannot run or any policy checks fail.
    # ----------------------------------------

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
    # Apply Terraform only after the security gate passes.
    # ----------------------------------------

    try:
        result = apply_terraform(
            terraform_files=terraform_files,
        )

    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="Terraform deployment timed out",
        )

    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Terraform executable was not found",
        )

    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Terraform deployment failed: {error}",
        )

    # ----------------------------------------
    # Update artifact status
    # ----------------------------------------

    if result["success"]:
        artifact.status = "deployed"

        db.commit()
        db.refresh(artifact)

    return {
        "artifact_id": artifact.id,
        "project_id": project.id,
        "project_name": project.name,
        "status": artifact.status,
        **result,
    }
