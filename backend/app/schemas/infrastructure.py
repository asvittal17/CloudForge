from datetime import datetime

from pydantic import BaseModel


class InfrastructureCreate(BaseModel):
    project_id: int
    cloud_provider: str = "AWS"
    region: str = "ap-south-1"
    environment: str = "development"
    architecture: str | None = None


class InfrastructureUpdate(BaseModel):
    cloud_provider: str
    region: str
    environment: str
    architecture: str | None = None


class InfrastructureResponse(BaseModel):
    id: int
    project_id: int
    cloud_provider: str
    region: str
    environment: str
    architecture: str | None
    created_at: datetime

    class Config:
        from_attributes = True