from fastapi import APIRouter, HTTPException, status

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