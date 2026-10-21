from datetime import datetime, timedelta

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.monitoring import sanitize
from app.core.security import get_current_user, get_admin_user
from app.db.dependencies import get_db
from app.models.error_event import ErrorEvent
from app.models.project import Project
from app.models.terraform_artifact import TerraformArtifact
from app.models.user import User
from app.services.health import get_health_snapshot


load_dotenv()


router = APIRouter(
    prefix="/monitoring",
    tags=["Monitoring"],
)


class FrontendErrorReport(BaseModel):
    """
    Ingest payload from the frontend error reporter.

    Only pre-sanitized metadata is accepted. The request body is never
    recorded; message length is hard-capped.
    """
    message: str = Field(min_length=1, max_length=1000)
    category: str = Field(default="js_runtime", max_length=60)
    severity: str = Field(default="error", max_length=20)
    route: str | None = Field(default=None, max_length=300)
    stack: str | None = Field(default=None, max_length=4000)
    request_id: str | None = Field(default=None, max_length=64)


def _error_row(event: ErrorEvent) -> dict:
    return {
        "id": event.id,
        "created_at": event.created_at,
        "last_seen_at": event.last_seen_at,
        "source": event.source,
        "severity": event.severity,
        "category": event.category,
        "route": event.route,
        "http_method": event.http_method,
        "http_status": event.http_status,
        "request_id": event.request_id,
        "user_id": event.user_id,
        "message": event.message,
        "occurrences": event.occurrences,
        "resolution_status": event.resolution_status,
    }


class FrontendErrorRateLimiter:
    """
    Tiny fixed-window in-memory limiter so a broken frontend cannot
    flood the monitoring store. Per-process only; adequate for the
    single-node CloudForge deployment.
    """

    def __init__(self, max_events: int, window_seconds: int):
        self.max_events = max_events
        self.window_seconds = window_seconds
        self._buckets: dict[str, list[float]] = {}

    def allow(self, key: str) -> bool:
        now = datetime.utcnow().timestamp()
        bucket = self._buckets.get(key)
        if bucket is None:
            bucket = []
            self._buckets[key] = bucket

        cutoff = now - self.window_seconds
        bucket[:] = [t for t in bucket if t > cutoff]
        if len(bucket) >= self.max_events:
            return False
        bucket.append(now)
        return True


_frontend_limiter = FrontendErrorRateLimiter(
    max_events=20,
    window_seconds=60,
)


def _counts(db: Session, since: datetime) -> dict:
    rows = (
        db.query(
            ErrorEvent.severity,
            func.count(ErrorEvent.id),
        )
        .filter(ErrorEvent.created_at >= since)
        .group_by(ErrorEvent.severity)
        .all()
    )
    by_severity = {severity: count for severity, count in rows}
    return {
        "total": sum(by_severity.values()),
        "critical": by_severity.get("critical", 0),
        "error": by_severity.get("error", 0),
        "warning": by_severity.get("warning", 0),
        "info": by_severity.get("info", 0),
        "open": (
            db.query(func.count(ErrorEvent.id))
            .filter(
                ErrorEvent.created_at >= since,
                ErrorEvent.resolution_status == "open",
            )
            .scalar()
        ),
    }


# ========================================
# System health + stats summary (admin)
# ========================================

@router.get("/summary")
def monitoring_summary(
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    now = datetime.utcnow()
    health = get_health_snapshot()
    errors_24h = _counts(db, now - timedelta(hours=24))

    return {
        "health": health,
        "users_total": db.query(func.count(User.id)).scalar() or 0,
        "users_active": (
            db.query(func.count(User.id))
            .filter(User.is_active.is_(True))
            .scalar()
            or 0
        ),
        "projects_total": db.query(func.count(Project.id)).scalar() or 0,
        "infrastructure_total": db.query(func.count(Project.id)).scalar() or 0,
        "artifacts_total": db.query(func.count(TerraformArtifact.id)).scalar() or 0,
        "artifacts_deployed": (
            db.query(func.count(TerraformArtifact.id))
            .filter(TerraformArtifact.status == "deployed")
            .scalar()
            or 0
        ),
        "errors_24h": errors_24h,
        "generated_at": now,
    }


# ========================================
# Admin console stats (admin)
# ========================================

@router.get("/admin-stats")
def admin_stats(
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    now = datetime.utcnow()
    errors_7d = _counts(db, now - timedelta(days=7))
    health = get_health_snapshot()

    recent_registrations = (
        db.query(User)
        .order_by(User.id.desc())
        .limit(5)
        .all()
    )

    last_error = (
        db.query(ErrorEvent)
        .order_by(ErrorEvent.last_seen_at.desc())
        .first()
    )

    return {
        "health": health,
        "users_total": db.query(func.count(User.id)).scalar() or 0,
        "users_active": (
            db.query(func.count(User.id))
            .filter(User.is_active.is_(True))
            .scalar()
            or 0
        ),
        "projects_total": db.query(func.count(Project.id)).scalar() or 0,
        "infrastructure_total": db.query(func.count(Project.id)).scalar() or 0,
        "artifacts_total": db.query(func.count(TerraformArtifact.id)).scalar() or 0,
        "errors_7d": errors_7d,
        "last_error_at": last_error.last_seen_at if last_error else None,
        "recent_registrations": [
            {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "role": user.role,
                "created_at": user.created_at,
            }
            for user in recent_registrations
        ],
        "generated_at": now,
    }


# ========================================
# Error list (admin)
# ========================================

@router.get("/errors")
def list_errors(
    source: str | None = Query(default=None),
    severity: str | None = Query(default=None),
    resolution_status: str | None = Query(default=None),
    hours: int = Query(default=72, ge=1, le=720),
    search: str | None = Query(default=None, max_length=120),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    query = db.query(ErrorEvent)

    cutoff = datetime.utcnow() - timedelta(hours=hours)
    query = query.filter(ErrorEvent.last_seen_at >= cutoff)

    if source:
        query = query.filter(ErrorEvent.source == source)
    if severity:
        query = query.filter(ErrorEvent.severity == severity)
    if resolution_status:
        query = query.filter(ErrorEvent.resolution_status == resolution_status)
    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                ErrorEvent.message.ilike(pattern),
                ErrorEvent.route.ilike(pattern),
                ErrorEvent.category.ilike(pattern),
            )
        )

    total = query.count()

    events = (
        query.order_by(ErrorEvent.last_seen_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [_error_row(event) for event in events],
    }


@router.get("/errors/{event_id}")
def get_error_detail(
    event_id: int,
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    event = db.query(ErrorEvent).filter(ErrorEvent.id == event_id).first()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Error event not found",
        )

    detail = _error_row(event)
    detail["stack_trace"] = event.stack_trace

    return detail


class ResolutionUpdate(BaseModel):
    resolution_status: str = Field(pattern="^(open|acknowledged|resolved)$")


@router.patch("/errors/{event_id}")
def update_error_resolution(
    event_id: int,
    payload: ResolutionUpdate,
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    event = db.query(ErrorEvent).filter(ErrorEvent.id == event_id).first()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Error event not found",
        )

    event.resolution_status = payload.resolution_status
    db.commit()
    db.refresh(event)

    return _error_row(event)


# ========================================
# Frontend error ingest
# ========================================

@router.post("/frontend-errors", status_code=status.HTTP_202_ACCEPTED)
def report_frontend_error(
    report: FrontendErrorReport,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Accept sanitized frontend error reports.

    Accessible with or without a valid token: capture must work even
    when the triggering failure is authentication itself. A valid token
    is decoded opportunistically to attribute an owner when possible.
    Rate limited per client IP to prevent flooding.
    """
    client_ident = request.client.host if request.client else "unknown"

    if not _frontend_limiter.allow(client_ident):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many error reports",
        )

    allowed_severities = {"info", "warning", "error", "critical"}
    severity = report.severity if report.severity in allowed_severities else "error"

    # Opportunistic user attribution (never fails the request)
    current_user_id = None
    auth_header = request.headers.get("Authorization") or ""
    token = auth_header[7:].strip() if auth_header.startswith("Bearer ") else ""

    try:
        from jose import jwt as jose_jwt
        from jose import JWTError

        from app.core.security import ALGORITHM, SECRET_KEY

        if token:
            try:
                payload = jose_jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                sub = payload.get("sub")
                if sub and sub.isdigit():
                    user = (
                        db.query(User)
                        .filter(User.id == int(sub))
                        .first()
                    )
                    if user and user.is_active:
                        current_user_id = user.id
            except (JWTError, ValueError):
                pass
    except Exception:
        pass

    from app.core.monitoring import record_error

    record_error(
        db,
        source="frontend",
        category=report.category[:60],
        message=report.message[:1000],
        severity=severity,
        route=report.route,
        request_id=report.request_id,
        user_id=current_user_id,
        stack_trace=report.stack,
    )

    return {"status": "accepted"}
