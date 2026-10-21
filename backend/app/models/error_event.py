from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class ErrorEvent(Base):
    """
    Persistent error-event store for frontend and backend monitoring.

    Every record is sanitized at write time: no request bodies, tokens,
    credentials, or connection strings are ever stored. Stack traces are
    stored only from trusted internal sources (backend exceptions) and are
    exposed only to administrators.
    """

    __tablename__ = "error_events"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    # "frontend" | "backend" | "database" | "external"
    source: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True
    )

    # "info" | "warning" | "error" | "critical"
    severity: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True
    )

    # Free-form machine category, e.g. "unhandled_exception",
    # "unauthorized_access", "js_runtime", "api_request_failed"
    category: Mapped[str] = mapped_column(
        String(60),
        nullable=False,
        index=True
    )

    # Backend: request path. Frontend: SPA route.
    route: Mapped[str | None] = mapped_column(
        String(300),
        nullable=True
    )

    http_method: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True
    )

    http_status: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True
    )

    request_id: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True
    )

    user_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        index=True
    )

    # Sanitized one-line human-readable message.
    message: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )

    # Full stack trace. Backend-only; never sent from or shown to
    # ordinary users. Admin-only exposure.
    stack_trace: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    # Stable hash grouping duplicate occurrences.
    fingerprint: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True
    )

    # Aggregate count of merged duplicate events.
    occurrences: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1
    )

    # "open" | "acknowledged" | "resolved"
    resolution_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="open",
        index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    __table_args__ = (
        Index("ix_error_events_fingerprint_last_seen", "fingerprint", "last_seen_at"),
    )
