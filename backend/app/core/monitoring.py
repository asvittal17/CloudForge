"""
Central error recording service.

Records sanitized error events from backend exception handling and from
the frontend error reporter. Designed to be recursion-safe: if recording
fails (e.g. the database is down), the failure is printed to stdout only,
never raised, so monitoring can never crash the application or cascade.
"""

import hashlib
import os
import sys
from datetime import datetime, timedelta

from dotenv import load_dotenv
from sqlalchemy.orm import Session

from app.models.error_event import ErrorEvent


load_dotenv()


# Errors with the same fingerprint within this window are merged by
# incrementing `occurrences` instead of creating new rows.
DEDUPE_WINDOW_MINUTES = int(
    os.getenv("ERROR_DEDUPE_WINDOW_MINUTES", "5")
)

# Hard ceiling on stored events to bound database growth.
MAX_ERROR_ROWS = int(
    os.getenv("ERROR_MAX_ROWS", "5000")
)

# Opportunistic retention: fraction of inserts that trigger cleanup.
RETENTION_CHECK_EVERY = 50

_counter = {"inserts": 0}

SOURCES = {"frontend", "backend", "database", "external"}
SEVERITIES = {"info", "warning", "error", "critical"}


def _fingerprint(
    source: str,
    category: str,
    route: str | None,
    message: str,
) -> str:
    material = "|".join(
        [
            source,
            category,
            (route or "").strip(),
            message,
        ]
    )
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


def sanitize(
    value: str | None,
    limit: int = 2000,
) -> str:
    """
    Strip common sensitive material and hard-wraps length.

    Best-effort line-level scrubbing of tokens/credentials that could
    accidentally appear inside exception messages. Request bodies are
    never passed into this function by callers.
    """
    if not value:
        return ""

    import re

    text = str(value)

    patterns = [
        r"(?i)bearer\s+[A-Za-z0-9\-_\.=+/:]{10,}",
        r"(?i)eyJ[A-Za-z0-9\-_]{20,}[A-Za-z0-9\-_/=]*",  # JWT
        r"(?i)(password|passwd|secret|token|api[_-]?key|authorization)\s*[=:]\s*\S+",
        r"(?:postgres(?:\+psycopg)?|postgresql|mysql|mongodb)://[^\s'\"]+",
    ]
    for pattern in patterns:
        text = re.sub(pattern, "[REDACTED]", text)

    text = " ".join(text.split())

    return text[:limit]


def record_error(
    db: Session | None,
    *,
    source: str,
    category: str,
    message: str,
    severity: str = "error",
    route: str | None = None,
    http_method: str | None = None,
    http_status: int | None = None,
    request_id: str | None = None,
    user_id: int | None = None,
    stack_trace: str | None = None,
) -> None:
    """
    Record one error occurrence. Never raises.
    """
    if source not in SOURCES:
        source = "backend"
    if severity not in SEVERITIES:
        severity = "error"

    safe_message = sanitize(message)
    if not safe_message:
        # Never persist a blank event — deranged inputs get a generic tag.
        safe_message = "[no message]"

    route = (route or "")[:300] or None
    request_id = (request_id or "")[:64] or None
    stack_trace = sanitize(stack_trace, limit=8000) if stack_trace else None
    fingerprint = _fingerprint(source, category, route, safe_message[:200])

    try:
        now = datetime.utcnow()

        if db is None:
            # DB unavailable: degrade to stdout only.
            print(
                f"[error-monitor][record-failed-no-db] "
                f"{severity} {source} {category}: {safe_message[:200]}",
                file=sys.stderr,
            )
            return

        dedupe_cutoff = now - timedelta(minutes=DEDUPE_WINDOW_MINUTES)

        existing = (
            db.query(ErrorEvent)
            .filter(
                ErrorEvent.fingerprint == fingerprint,
                ErrorEvent.last_seen_at >= dedupe_cutoff,
            )
            .order_by(ErrorEvent.last_seen_at.desc())
            .first()
        )

        if existing:
            existing.occurrences = (existing.occurrences or 1) + 1
            existing.last_seen_at = now
            if existing.resolution_status == "resolved":
                # A resolved issue occurring again re-opens.
                existing.resolution_status = "open"
            db.commit()
            return

        event = ErrorEvent(
            source=source,
            category=category,
            severity=severity,
            route=route,
            http_method=(http_method or "")[:10] or None,
            http_status=http_status,
            request_id=request_id,
            user_id=user_id,
            message=safe_message,
            stack_trace=stack_trace,
            fingerprint=fingerprint,
            resolution_status="open",
            created_at=now,
            last_seen_at=now,
        )
        db.add(event)
        db.commit()

        _counter["inserts"] += 1

        if _counter["inserts"] % RETENTION_CHECK_EVERY == 0:
            cutoff = now - timedelta(days=int(
                os.getenv("ERROR_RETENTION_DAYS", "30")
            ))
            db.query(ErrorEvent).filter(
                ErrorEvent.created_at < cutoff
            ).delete(synchronize_session=False)
            db.commit()

            total = db.query(ErrorEvent.id).count()
            if total > MAX_ERROR_ROWS:
                keep_ids = (
                    db.query(ErrorEvent.id)
                    .order_by(ErrorEvent.id.desc())
                    .limit(MAX_ERROR_ROWS)
                    .all()
                )
                keep_id_list = [row[0] for row in keep_ids]
                if keep_id_list:
                    stop_id = min(keep_id_list)
                    db.query(ErrorEvent).filter(
                        ErrorEvent.id < stop_id
                    ).delete(synchronize_session=False)
                    db.commit()

    except Exception as record_failure:
        # Monitoring must never crash the application.
        print(
            f"[error-monitor][record-failed] {record_failure}",
            file=sys.stderr,
        )
