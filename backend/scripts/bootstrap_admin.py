"""
Controlled administrator bootstrap utility.

Promotes the accounts listed in CLOUDFORGE_ADMIN_EMAILS (backend/.env)
to the "admin" role. Run after registering the designated admin account:

    python scripts/bootstrap_admin.py

Does NOT create accounts or passwords — register the account first, then
promote it. Never runs automatically for new registrations.
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv

load_dotenv()

from app.db.database import SessionLocal  # noqa: E402
from app.models.user import User  # noqa: E402


def main() -> None:
    raw = os.getenv("CLOUDFORGE_ADMIN_EMAILS", "")
    emails = [
        email.strip().lower()
        for email in raw.split(",")
        if email.strip()
    ]

    if not emails:
        print(
            "No CLOUDFORGE_ADMIN_EMAILS configured in backend/.env. "
            "Set it to the email(s) that should be administrators."
        )
        return

    db = SessionLocal()
    try:
        for email in emails:
            user = db.query(User).filter(User.email == email).first()
            if not user:
                print(
                    f"[skip] '{email}' has no account yet — "
                    "register it first, then run this script again"
                )
                continue
            if user.role == "admin":
                print(f"[ok]   '{email}' is already an administrator")
                continue
            user.role = "admin"
            print(f"[promoted] '{email}' -> admin")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
