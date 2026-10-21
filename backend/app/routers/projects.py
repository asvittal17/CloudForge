from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user_id
from app.db.dependencies import get_db
from app.models.infrastructure import Infrastructure
from app.models.project import Project
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
)


router = APIRouter(
    prefix="/projects",
    tags=["Projects"]
)


@router.get(
    "/summary",
    response_model=None,
)
def get_projects_summary(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    User-scoped workspace metrics for the dashboard.

    All counts are computed from real database rows and scoped to the
    authenticated user's projects only.
    """
    from datetime import datetime, timedelta

    from sqlalchemy import func

    from app.models.terraform_artifact import TerraformArtifact

    project_ids = [
        row.id
        for row in db.query(Project.id).filter(Project.owner_id == user_id).all()
    ]

    summary: dict = {
        "projects": len(project_ids),
        "infrastructure": 0,
        "artifacts": 0,
        "artifacts_staged": 0,
        "artifacts_plan_ready": 0,
        "artifacts_approved": 0,
        "artifacts_deployed": 0,
        "recent_activity": [],
        "generated_at": datetime.utcnow(),
    }

    if not project_ids:
        return summary

    summary["infrastructure"] = (
        db.query(func.count(Infrastructure.id))
        .filter(Infrastructure.project_id.in_(project_ids))
        .scalar()
        or 0
    )

    artifact_query = (
        db.query(TerraformArtifact)
        .filter(TerraformArtifact.project_id.in_(project_ids))
    )

    summary["artifacts"] = artifact_query.count()
    summary["artifacts_staged"] = artifact_query.filter(
        TerraformArtifact.status == "staged"
    ).count()
    summary["artifacts_plan_ready"] = artifact_query.filter(
        TerraformArtifact.status == "plan_ready"
    ).count()
    summary["artifacts_approved"] = artifact_query.filter(
        TerraformArtifact.status == "approved"
    ).count()
    summary["artifacts_deployed"] = artifact_query.filter(
        TerraformArtifact.status == "deployed"
    ).count()

    # Recent activity = most recent projects and artifacts (real events).
    cutoff = datetime.utcnow() - timedelta(days=30)
    activity: list[dict] = []

    recent_projects = (
        db.query(Project)
        .filter(Project.owner_id == user_id, Project.created_at >= cutoff)
        .order_by(Project.created_at.desc())
        .limit(3)
        .all()
    )
    for project in recent_projects:
        activity.append({
            "kind": "project_created",
            "label": project.name,
            "project_id": project.id,
            "created_at": project.created_at,
        })

    recent_artifacts = (
        db.query(TerraformArtifact)
        .filter(
            TerraformArtifact.project_id.in_(project_ids),
            TerraformArtifact.created_at >= cutoff,
        )
        .order_by(TerraformArtifact.created_at.desc())
        .limit(5)
        .all()
    )
    for artifact in recent_artifacts:
        activity.append({
            "kind": "artifact_staged",
            "label": f"Artifact #{artifact.id}",
            "status": artifact.status,
            "project_id": artifact.project_id,
            "created_at": artifact.created_at,
        })

    activity.sort(key=lambda item: item["created_at"], reverse=True)
    summary["recent_activity"] = activity[:8]

    return summary


@router.post(
    "/",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED
)
def create_project(
    project_data: ProjectCreate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    new_project = Project(
        name=project_data.name,
        description=project_data.description,
        owner_id=user_id
    )

    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    return new_project


@router.get(
    "/",
    response_model=list[ProjectResponse]
)
def get_projects(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    projects = (
        db.query(Project)
        .filter(Project.owner_id == user_id)
        .all()
    )

    return projects


@router.get(
    "/{project_id}",
    response_model=ProjectResponse
)
def get_project(
    project_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    project = (
        db.query(Project)
        .filter(
            Project.id == project_id,
            Project.owner_id == user_id
        )
        .first()
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    return project


@router.put(
    "/{project_id}",
    response_model=ProjectResponse
)
def update_project(
    project_id: int,
    project_data: ProjectUpdate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    project = (
        db.query(Project)
        .filter(
            Project.id == project_id,
            Project.owner_id == user_id
        )
        .first()
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    if project_data.name is not None:
        project.name = project_data.name
    if project_data.description is not None:
        project.description = project_data.description

    db.commit()
    db.refresh(project)

    

    return project

@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
def delete_project(
    project_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    project = (
        db.query(Project)
        .filter(
            Project.id == project_id,
            Project.owner_id == user_id
        )
        .first()
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    db.delete(project)
    db.commit()

    return None