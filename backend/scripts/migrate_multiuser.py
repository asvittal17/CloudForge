"""
Idempotent database migration: multi-user roles, account status,
and persistent error-event monitoring.

Safe to run multiple times. Uses SQL guarded by existence checks so it
works against the existing CloudForge database without touching existing
data:

  1. users:        + role (varchar(20) NOT NULL DEFAULT 'user')
                   + is_active (boolean NOT NULL DEFAULT true)
  2. error_events: created if the table does not exist

Run from the backend directory:

    python scripts/migrate_multiuser.py
"""

from sqlalchemy import create_engine, text

import sys
from pathlib import Path

# Allow running as `python scripts/migrate_multiuser.py` and `python -m ...`.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.database import DATABASE_URL


def column_exists(conn, table: str, column: str) -> bool:
    result = conn.execute(
        text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'public' "
            "AND table_name = :table AND column_name = :column"
        ),
        {"table": table, "column": column},
    )
    return result.first() is not None


def table_exists(conn, table: str) -> bool:
    result = conn.execute(
        text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = :table"
        ),
        {"table": table},
    )
    return result.first() is not None


def main() -> None:
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        if table_exists(conn, "users"):
            if not column_exists(conn, "users", "role"):
                conn.execute(
                    text(
                        "ALTER TABLE users "
                        "ADD COLUMN role VARCHAR(20) "
                        "NOT NULL DEFAULT 'user'"
                    )
                )
                conn.execute(
                    text("CREATE INDEX ix_users_role ON users (role)")
                )
                print("users.role column added")
            else:
                print("users.role column already present")

            if not column_exists(conn, "users", "is_active"):
                conn.execute(
                    text(
                        "ALTER TABLE users "
                        "ADD COLUMN is_active BOOLEAN "
                        "NOT NULL DEFAULT true"
                    )
                )
                print("users.is_active column added")
            else:
                print("users.is_active column already present")
        else:
            print(
                "users table not found yet - it will be created "
                "by init_db (Base.metadata.create_all) with all columns"
            )

        conn.commit()

    # err_events table: created through the ORM so the model stays
    # authoritative. create_all is a no-op for existing tables.
    from app.db.database import Base
    from app.models.error_event import ErrorEvent  # noqa: F401

    Base.metadata.create_all(bind=engine)

    print("migration complete")


if __name__ == "__main__":
    main()
