
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.db.dependencies import get_db
from app.models.user import User
from app.schemas.ai import (
    InfrastructureAIRequest,
    InfrastructureAIResponse,
    AITerraformRequest,
    AITerraformResponse,
    AITerraformValidateRequest,
    AITerraformValidateResponse,
)

from app.services.ai_infrastructure import (
    generate_infrastructure_plan,
)

from app.services.terraform_generator import (
    generate_terraform_from_ai_plan,
)

from app.services.terraform_validator import (
    validate_terraform,
)

from app.services.terraform_security_scanner import (
    scan_terraform,
)


router = APIRouter(
    prefix="/ai",
    tags=["AI"],
)


# ============================================================
# Generate AI Infrastructure Architecture
# ============================================================

@router.post(
    "/infrastructure",
    response_model=InfrastructureAIResponse,
)
def generate_ai_infrastructure(
    request_data: InfrastructureAIRequest,
    current_user: User = Depends(get_current_user),
):
    if not request_data.request.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Infrastructure request cannot be empty",
        )

    try:
        infrastructure_plan = generate_infrastructure_plan(
            request_data.request
        )

    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI infrastructure generation failed: {error}",
        )

    return infrastructure_plan


# ============================================================
# Generate Terraform From AI Architecture
# ============================================================

@router.post(
    "/terraform",
    response_model=AITerraformResponse,
)
def generate_ai_terraform(
    request_data: AITerraformRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        terraform_files = generate_terraform_from_ai_plan(
            request_data.model_dump()
        )

    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )

    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI Terraform generation failed: {error}",
        )

    return {
        "cloud_provider": request_data.cloud_provider,
        "region": request_data.region,
        "environment": request_data.environment,
        "architecture": request_data.architecture,
        "terraform": terraform_files,
    }


# ============================================================
# Validate AI-Generated Terraform
# ============================================================

@router.post(
    "/terraform/validate",
    response_model=AITerraformValidateResponse,
)
def validate_ai_terraform(
    request_data: AITerraformValidateRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        result = validate_terraform(
            request_data.terraform
        )

        return result

    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Terraform validation failed: {error}",
        )


# ============================================================
# Scan AI-Generated Terraform for Security Issues
# ============================================================

@router.post(
    "/terraform/security-scan",
)
def scan_ai_terraform_security(
    request_data: AITerraformValidateRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        result = scan_terraform(
            request_data.terraform
        )

        # Distinguish scanner execution errors from security findings.
        # A completed scan can succeed even when checks fail.
        if not result.get("success", False):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result.get(
                    "error",
                    "Terraform security scan failed",
                ),
            )

        return result

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Terraform security scan failed: {error}",
        )
