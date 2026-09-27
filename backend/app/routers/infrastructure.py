from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user_id
from app.db.dependencies import get_db
from app.models.infrastructure import Infrastructure
from app.models.project import Project
from app.schemas.infrastructure import (
    InfrastructureCreate,
    InfrastructureUpdate,
    InfrastructureResponse,
)

router = APIRouter(
    prefix="/infrastructure",
    tags=["Infrastructure"],
)


@router.post(
    "/",
    response_model=InfrastructureResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_infrastructure(
    infrastructure_data: InfrastructureCreate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    project = (
        db.query(Project)
        .filter(
            Project.id == infrastructure_data.project_id,
            Project.owner_id == user_id,
        )
        .first()
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    existing = (
        db.query(Infrastructure)
        .filter(
            Infrastructure.project_id
            == infrastructure_data.project_id
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Infrastructure configuration already exists for this project",
        )

    new_infrastructure = Infrastructure(
        project_id=infrastructure_data.project_id,
        cloud_provider=infrastructure_data.cloud_provider,
        region=infrastructure_data.region,
        environment=infrastructure_data.environment,
        architecture=infrastructure_data.architecture,
    )

    db.add(new_infrastructure)
    db.commit()
    db.refresh(new_infrastructure)

    return new_infrastructure


@router.get(
    "/{project_id}",
    response_model=InfrastructureResponse,
)
def get_infrastructure(
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

    return infrastructure


@router.put(
    "/{project_id}",
    response_model=InfrastructureResponse,
)
def update_infrastructure(
    project_id: int,
    infrastructure_data: InfrastructureUpdate,
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

    infrastructure.cloud_provider = (
        infrastructure_data.cloud_provider
    )

    infrastructure.region = (
        infrastructure_data.region
    )

    infrastructure.environment = (
        infrastructure_data.environment
    )

    infrastructure.architecture = (
        infrastructure_data.architecture
    )

    db.commit()
    db.refresh(infrastructure)

    return infrastructure


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_infrastructure(
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

    db.delete(infrastructure)
    db.commit()

    return None