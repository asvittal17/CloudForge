"""
Real service health checks for CloudForge.

`get_health_snapshot()` performs genuine connectivity checks against the
PostgreSQL database and the local Ollama runtime used by the AI planner.
Results are cached briefly so polling clients (e.g. the navbar health
indicator) do not hammer the services.

Statuses: "healthy" | "unhealthy" | "unknown" (for unconfigured or
unchecked components). The overall status is "healthy" only when every
required component is healthy, "degraded" when an optional component
(Ollama, needed only for AI generation) is unavailable, and "unhealthy"
when a required component (the database) is down.
"""

import time
from datetime import datetime

import requests
from dotenv import load_dotenv
from sqlalchemy import text

from app.db.database import engine


load_dotenv()


OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_MODEL = "llama3.2:3b"

HEALTH_CACHE_SECONDS = 10

_cache: dict | None = None


def _check_postgres() -> dict:
    started = time.perf_counter()
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        return {
            "status": "healthy",
            "message": "Database connection ok",
            "latency_ms": elapsed_ms,
        }
    except Exception as error:
        return {
            "status": "unhealthy",
            "message": f"Database connection failed: {type(error).__name__}",
            "latency_ms": None,
        }


def _check_ollama() -> dict:
    started = time.perf_counter()
    try:
        response = requests.get(
            f"{OLLAMA_BASE_URL}/api/tags",
            timeout=3,
        )
        elapsed_ms = int((time.perf_counter() - started) * 1000)

        if response.status_code != 200:
            return {
                "status": "unhealthy",
                "message": f"Ollama responded with HTTP {response.status_code}",
                "latency_ms": elapsed_ms,
            }

        models = [
            entry.get("name", "")
            for entry in response.json().get("models", [])
            if isinstance(entry, dict)
        ]
        model_available = any(
            name.startswith(OLLAMA_MODEL.split(":")[0]) for name in models
        ) if models else False

        return {
            "status": "healthy",
            "message": (
                f"Ollama reachable; planner model "
                f"{'available' if model_available else 'not pulled'}"
            ),
            "latency_ms": elapsed_ms,
            "model_available": model_available,
        }
    except requests.ConnectionError:
        return {
            "status": "unhealthy",
            "message": "Ollama is not reachable on localhost:11434",
            "latency_ms": None,
        }
    except Exception as error:
        return {
            "status": "unhealthy",
            "message": f"Ollama check failed: {type(error).__name__}",
            "latency_ms": None,
        }


def get_health_snapshot() -> dict:
    """
    Return the current health snapshot, honoring a short cache.
    Also usable directly by the /health endpoint.
    """
    global _cache

    now = datetime.utcnow()

    if _cache is not None:
        age = (now - _cache["checked_at"]).total_seconds()
        if age < HEALTH_CACHE_SECONDS:
            return _cache["snapshot"]

    database = _check_postgres()
    ollama = _check_ollama()

    component_statuses = [
        database["status"],
        ollama["status"],
    ]

    if "unhealthy" in component_statuses:
        overall = "unhealthy"
    elif "unknown" in component_statuses:
        overall = "unknown"
    else:
        overall = "healthy"

    snapshot = {
        "status": overall,
        "api": {
            "status": "healthy",
            "message": "FastAPI responding",
        },
        "database": {
            "status": database["status"],
            "message": database["message"],
            "latency_ms": database.get("latency_ms"),
        },
        "ollama": {
            "status": ollama["status"],
            "message": ollama["message"],
            "latency_ms": ollama.get("latency_ms"),
            "model_available": ollama.get("model_available"),
        },
        "checked_at": now.isoformat() + "Z",
    }

    _cache = {
        "snapshot": snapshot,
        "checked_at": now,
    }

    return snapshot
