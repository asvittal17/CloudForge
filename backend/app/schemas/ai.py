from typing import Any

from pydantic import BaseModel


class InfrastructureAIRequest(BaseModel):
    request: str


class InfrastructureAIResponse(BaseModel):
    cloud_provider: str
    region: str
    environment: str
    architecture: dict[str, Any]


class AITerraformRequest(BaseModel):
    cloud_provider: str
    region: str
    environment: str
    architecture: dict[str, Any]


class AITerraformResponse(BaseModel):
    cloud_provider: str
    region: str
    environment: str
    architecture: dict[str, Any]
    terraform: dict[str, str]


class AITerraformValidateRequest(BaseModel):
    terraform: dict[str, str]


class AITerraformValidateResponse(BaseModel):
    valid: bool
    formatted: bool
    format_output: str
    format_error: str
    validation_output: str
    validation_error: str