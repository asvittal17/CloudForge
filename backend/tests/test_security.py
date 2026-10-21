from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from jose import jwt

from app.core import security
from app.models.user import User


def test_password_hash_verifies_correct_password():
    password_hash = security.hash_password("Strong-Test-Password-123")

    assert password_hash != "Strong-Test-Password-123"
    assert security.verify_password("Strong-Test-Password-123", password_hash)
    assert not security.verify_password("Wrong-Password", password_hash)


def test_access_token_contains_subject_and_expiration():
    token = security.create_access_token({"sub": "123", "email": "test@example.com"})

    payload = jwt.decode(
        token,
        security.SECRET_KEY,
        algorithms=[security.ALGORITHM],
    )

    assert payload["sub"] == "123"
    assert payload["email"] == "test@example.com"
    assert "exp" in payload


def test_current_user_id_rejects_invalid_token():
    with pytest.raises(HTTPException) as exc:
        security.get_current_user_id("not-a-valid-token")

    assert exc.value.status_code == 401


def test_current_user_returns_active_user():
    user = MagicMock(spec=User)
    user.id = 123
    user.is_active = True
    user.role = "user"

    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = user
    token = security.create_access_token({"sub": "123"})

    result = security.get_current_user(token=token, db=db)

    assert result is user


def test_current_user_rejects_missing_user():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    token = security.create_access_token({"sub": "123"})

    with pytest.raises(HTTPException) as exc:
        security.get_current_user(token=token, db=db)

    assert exc.value.status_code == 401


def test_current_user_rejects_disabled_user():
    user = MagicMock(spec=User)
    user.is_active = False

    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = user
    token = security.create_access_token({"sub": "123"})

    with pytest.raises(HTTPException) as exc:
        security.get_current_user(token=token, db=db)

    assert exc.value.status_code == 401


def test_current_user_rejects_nonnumeric_subject():
    token = jwt.encode(
        {
            "sub": "not-a-number",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        },
        security.SECRET_KEY,
        algorithm=security.ALGORITHM,
    )

    with pytest.raises(HTTPException) as exc:
        security.get_current_user(token=token, db=MagicMock())

    assert exc.value.status_code == 401


def test_regular_user_cannot_pass_admin_guard():
    user = MagicMock(spec=User)
    user.role = "user"

    with pytest.raises(HTTPException) as exc:
        security.get_admin_user(current_user=user)

    assert exc.value.status_code == 403


def test_admin_passes_admin_guard():
    user = MagicMock(spec=User)
    user.role = "admin"

    assert security.get_admin_user(current_user=user) is user
