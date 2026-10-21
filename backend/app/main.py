import os
import uuid
import traceback

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.orm import Session

from app.core.monitoring import record_error
from app.routers.users import router as users_router
from app.routers.auth import router as auth_router
from app.routers.projects import router as projects_router
from app.routers.infrastructure import router as infrastructure_router
from app.routers.terraform import router as terraform_router
from app.routers.ai import router as ai_router
from app.routers.admin import router as admin_router
from app.routers.monitoring import router as monitoring_router


load_dotenv()


FRONTEND_ORIGIN = "http://localhost:5173"

app = FastAPI(
    title="CloudForge API",
    description="AI-Powered Cloud Infrastructure & DevOps Automation Platform",
    version="0.2.0",
)


# ========================================
# CORS
# ========================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],

    expose_headers=["X-Request-ID"],
)


# ========================================
# Request correlation + error monitoring
# ========================================

def _is_skip_path(path: str) -> bool:
    """Docs, root liveness and swagger endpoints are never error events."""
    return (
        path in ("/", "/health")
        or path.startswith(("/docs", "/openapi.json", "/redoc"))
    )


class ErrorMonitoringMiddleware(BaseHTTPMiddleware):
    """
    Assigns a correlation id to every request and records genuine
    application errors exactly once per occurrence:

      - unhandled exceptions -> critical
      - server errors (HTTP 5xx) -> error
      - rejected auth attempts (401/403) -> warning

    Client-input statuses (400/404/409/422) are normal API usage and are
    not recorded. HTTPException-based 401/403/500s emitted by endpoint
    bodies are recorded here — and nowhere else — because
    http_exception_handler below only decorates responses without
    recording, which prevents duplicate-handler double logging.
    """

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
        request.state.request_id = request_id

        path = request.url.path

        try:
            response = await call_next(request)
        except Exception as unhandled:
            # Truly unhandled exception (anything the endpoint handler
            # didn't convert into HTTPException). Return a clean JSON 500
            # with CORS-consistent headers.
            if not _is_skip_path(path):
                record_error_safe(
                    request,
                    request_id=request_id,
                    category="unhandled_exception",
                    severity="critical",
                    message=f"{type(unhandled).__name__}: {unhandled}",
                    http_status=500,
                    stack=traceback.format_exception(
                        type(unhandled),
                        unhandled,
                        unhandled.__traceback__,
                    ),
                )

            return JSONResponse(
                status_code=500,
                content={
                    "detail": "Internal server error",
                    "request_id": request_id,
                },
                headers=self._cors_headers(request_id),
            )

        status_code = response.status_code

        if not _is_skip_path(path):
            if status_code >= 500:
                record_error_safe(
                    request,
                    request_id=request_id,
                    category="http_server_error",
                    severity="error",
                    message=f"Handler returned HTTP {status_code}",
                    http_status=status_code,
                )
            elif status_code in (401, 403):
                record_error_safe(
                    request,
                    request_id=request_id,
                    category="unauthorized_access",
                    severity="warning",
                    message=(
                        "Rejected request with HTTP "
                        f"{status_code} — invalid credentials or "
                        "insufficient privileges"
                    ),
                    http_status=status_code,
                )

        response.headers["X-Request-ID"] = request_id

        return response

    @staticmethod
    def _cors_headers(request_id: str) -> dict:
        return {
            "X-Request-ID": request_id,
            "Access-Control-Allow-Origin": FRONTEND_ORIGIN,
            "Access-Control-Allow-Credentials": "true",
        }


def record_error_safe(
    request: Request,
    *,
    request_id: str,
    category: str,
    severity: str,
    message: str,
    http_status: int | None,
    stack: str | None = None,
) -> None:
    """
    Record an error event in a short-lived session. Never raises:
    if the database itself is down, the failure degrades to stderr.
    """
    try:
        from app.db.database import SessionLocal

        db: Session = SessionLocal()
        try:
            record_error(
                db,
                source="backend",
                category=category,
                message=message,
                severity=severity,
                route=request.url.path,
                http_method=request.method,
                http_status=http_status,
                request_id=request_id,
                stack_trace=stack,
            )
        finally:
            db.close()
    except Exception as record_failure:  # pragma: no cover
        import sys

        print(f"[error-monitor] record failed: {record_failure}", file=sys.stderr)


app.add_middleware(ErrorMonitoringMiddleware)


# ========================================
# Routers
# ========================================

app.include_router(users_router)
app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(infrastructure_router)
app.include_router(terraform_router)
app.include_router(ai_router)
app.include_router(admin_router)
app.include_router(monitoring_router)


# ========================================
# Root
# ========================================

@app.get("/")
def root():
    return {
        "message": "CloudForge API is running",
        "version": "0.2.0",
    }


@app.get("/health")
def health_check():
    """
    Real component health check: PostgreSQL connectivity and Ollama
    availability, with a short-lived cache to avoid hammering services.
    Overall status maps component severities:

      - required component (database) unhealthy -> "unhealthy"
      - optional component (ollama) unhealthy   -> "degraded"
      - everything healthy                      -> "healthy"
    """
    from app.services.health import get_health_snapshot

    snapshot = get_health_snapshot()

    # Overall: database problems are fatal; AI runtime is optional.
    if snapshot["database"]["status"] == "unhealthy":
        snapshot["status"] = "unhealthy"
    elif snapshot["ollama"]["status"] != "healthy":
        snapshot["status"] = "degraded"
    else:
        snapshot["status"] = "healthy"

    return snapshot


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """
    Decorates every HTTPException response with a correlation ID and
    CORS-safe headers. Recording happens in ErrorMonitoringMiddleware
    when the response passes through it — this handler intentionally
    does NOT record anything (single-capture guarantee).
    """
    request_id = getattr(request.state, "request_id", None) or uuid.uuid4().hex

    headers = dict(exc.headers or {})
    headers["X-Request-ID"] = request_id
    headers.setdefault("Access-Control-Allow-Origin", FRONTEND_ORIGIN)
    headers.setdefault("Access-Control-Allow-Credentials", "true")

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "request_id": request_id,
        },
        headers=headers,
    )


# ========================================
# Startup bootstrap
# ========================================

def bootstrap_runtime() -> None:
    """
    - Create missing tables (error_events included). Idempotent.
    - Promote configured emails to the administrator role.

      Controlled bootstrap: set CLOUDFORGE_ADMIN_EMAILS
      (comma-separated) in backend/.env before starting the server.
      New registrations are always role="user" and never elevated
      automatically.
    """
    from app.db.database import Base, engine, SessionLocal
    from app.models.user import User
    from app.models.project import Project
    from app.models.infrastructure import Infrastructure
    from app.models.terraform_artifact import TerraformArtifact
    from app.models.error_event import ErrorEvent

    Base.metadata.create_all(bind=engine)

    admin_emails_env = os.getenv("CLOUDFORGE_ADMIN_EMAILS", "")
    admin_emails = [
        email.strip().lower()
        for email in admin_emails_env.split(",")
        if email.strip()
    ]

    if not admin_emails:
        return

    db: Session = SessionLocal()
    try:
        for email in admin_emails:
            user = db.query(User).filter(User.email == email).first()
            if user and user.role != "admin":
                user.role = "admin"
                print(f"[bootstrap] promoted '{email}' to administrator")
        db.commit()
    finally:
        db.close()


bootstrap_runtime()


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
    )

