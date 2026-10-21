from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.monitoring import record_error
from app.core.security import get_admin_user
from app.db.dependencies import get_db
from app.models.error_event import ErrorEvent
from app.models.infrastructure import Infrastructure
from app.models.project import Project
from app.models.terraform_artifact import TerraformArtifact
from app.models.user import User


router = APIRouter(
    prefix="/admin",
    tags=["Admin Console"],
)


class UserAdminResponse(BaseModel):
    """
    Safe user administration record. Contains no credentials of any kind.
    """
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    created_at: object
    project_count: int = 0
    artifact_count: int = 0


class UserRoleUpdate(BaseModel):
    role: str = Field(pattern="^(user|admin)$")


class UserActiveUpdate(BaseModel):
    is_active: bool


# ========================================
# Platform statistics (admin only)
# ========================================

@router.get("/stats")
def admin_stats(
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    return {
        "users_total": db.query(func.count(User.id)).scalar() or 0,
        "users_active": (
            db.query(func.count(User.id))
            .filter(User.is_active.is_(True))
            .scalar()
            or 0
        ),
        "admins_total": (
            db.query(func.count(User.id))
            .filter(User.role == "admin")
            .scalar()
            or 0
        ),
        "projects_total": db.query(func.count(Project.id)).scalar() or 0,
        "infrastructure_total": (
            db.query(func.count(Infrastructure.id)).scalar() or 0
        ),
        "artifacts_total": (
            db.query(func.count(TerraformArtifact.id)).scalar() or 0
        ),
        "artifacts_deployed": (
            db.query(func.count(TerraformArtifact.id))
            .filter(TerraformArtifact.status == "deployed")
            .scalar()
            or 0
        ),
        "errors_open": (
            db.query(func.count(ErrorEvent.id))
            .filter(ErrorEvent.resolution_status == "open")
            .scalar()
            or 0
        ),
    }


# ========================================
# User management (admin only)
# ========================================

@router.get("/users")
def list_users(
    search: str | None = Query(default=None, max_length=120),
    role: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    sort_by: str = Query(default="created_at", pattern="^(id|name|email|created_at|project_count)$"),
    order: str = Query(default="desc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """
    Paginated, filterable, sortable user directory for the Admin Console.

    Sort by project_count is implemented via a LEFT JOIN aggregate.
    """
    project_count_sq = (
        db.query(
            Project.owner_id.label("owner_id"),
            func.count(Project.id).label("project_count"),
        )
        .group_by(Project.owner_id)
        .subquery()
    )

    artifact_count_sq = (
        db.query(
            Project.owner_id.label("owner_id"),
            func.count(TerraformArtifact.id).label("artifact_count"),
        )
        .join(
            TerraformArtifact,
            TerraformArtifact.project_id == Project.id,
        )
        .group_by(Project.owner_id)
        .subquery()
    )

    query = (
        db.query(
            User,
            func.coalesce(project_count_sq.c.project_count, 0).label("project_count"),
            func.coalesce(artifact_count_sq.c.artifact_count, 0).label("artifact_count"),
        )
        .outerjoin(
            project_count_sq,
            project_count_sq.c.owner_id == User.id,
        )
        .outerjoin(
            artifact_count_sq,
            artifact_count_sq.c.owner_id == User.id,
        )
    )

    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            User.name.ilike(pattern) | User.email.ilike(pattern)
        )
    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active.is_(is_active))

    total = query.count()

    sort_column = {
        "id": User.id,
        "name": User.name,
        "email": User.email,
        "created_at": User.created_at,
        "project_count": func.coalesce(project_count_sq.c.project_count, 0),
    }[sort_by]

    if order == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    rows = (
        query
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [
        {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active,
            "created_at": user.created_at,
            "project_count": int(project_count),
            "artifact_count": int(artifact_count),
        }
        for user, project_count, artifact_count in rows
    ]

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": items,
    }


@router.patch("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Change a user's role. An admin cannot demote themselves."""
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if user.id == current_admin.id and payload.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot change their own role",
        )

    user.role = payload.role
    db.commit()
    db.refresh(user)

    record_error(
        db,
        source="backend",
        category="admin_action",
        message=(
            f"Admin '{current_admin.email}' set role of user "
            f"{user.id} ({user.email}) to '{user.role}'"
        ),
        severity="info",
        route=f"/admin/users/{user.id}/role",
        http_method="PATCH",
        http_status=200,
    )

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
    }


@router.patch("/users/{user_id}/status")
def update_user_status(
    user_id: int,
    payload: UserActiveUpdate,
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Enable or disable an account. Disabled accounts cannot log in."""
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if user.id == current_admin.id and not payload.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot disable their own account",
        )

    user.is_active = payload.is_active
    db.commit()
    db.refresh(user)

    record_error(
        db,
        source="backend",
        category="admin_action",
        message=(
            f"Admin '{current_admin.email}' set account status of user "
            f"{user.id} ({user.email}) to "
            f"{'active' if user.is_active else 'disabled'}"
        ),
        severity="info",
        route=f"/admin/users/{user.id}/status",
        http_method="PATCH",
        http_status=200,
    )

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
    }
