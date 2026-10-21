from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.routers import auth
from app.models.user import User


@pytest.fixture
def db():
    return MagicMock()


def test_register_creates_regular_user(db, monkeypatch):
    db.query.return_value.filter.return_value.first.return_value = None
    db.refresh.side_effect = lambda user: setattr(user, "id", 123)
    monkeypatch.setattr(auth, "hash_password", lambda password: "hashed-password")

    result = auth.register(
        auth.RegisterRequest(
            name=" Test User ",
            email="TEST@example.com",
            password="StrongPassword123",
        ),
        db=db,
    )

    created_user = db.add.call_args.args[0]

    assert result["id"] == 123
    assert result["email"] == "test@example.com"
    assert created_user.name == "Test User"
    assert created_user.password_hash == "hashed-password"
    assert created_user.role == "user"
    assert created_user.is_active is True
    db.commit.assert_called_once()


def test_register_rejects_duplicate_email(db):
    existing_user = MagicMock(spec=User)
    db.query.return_value.filter.return_value.first.return_value = existing_user

    with pytest.raises(HTTPException) as exc:
        auth.register(
            auth.RegisterRequest(
                name="Test User",
                email="test@example.com",
                password="StrongPassword123",
            ),
            db=db,
        )

    assert exc.value.status_code == 409
    db.add.assert_not_called()


def test_login_returns_access_token_for_valid_credentials(db, monkeypatch):
    user = MagicMock(spec=User)
    user.id = 123
    user.email = "test@example.com"
    user.password_hash = "hashed-password"
    user.is_active = True

    db.query.return_value.filter.return_value.first.return_value = user
    monkeypatch.setattr(auth, "verify_password", lambda password, hashed: True)
    monkeypatch.setattr(auth, "create_access_token", lambda data: "test-token")

    result = auth.login(
        auth.LoginRequest(
            email="TEST@example.com",
            password="StrongPassword123",
        ),
        db=db,
    )

    assert result == {
        "access_token": "test-token",
        "token_type": "bearer",
    }


def test_login_rejects_invalid_password(db, monkeypatch):
    user = MagicMock(spec=User)
    user.password_hash = "hashed-password"
    user.is_active = True

    db.query.return_value.filter.return_value.first.return_value = user
    monkeypatch.setattr(auth, "verify_password", lambda password, hashed: False)

    with pytest.raises(HTTPException) as exc:
        auth.login(
            auth.LoginRequest(
                email="test@example.com",
                password="WrongPassword123",
            ),
            db=db,
        )

    assert exc.value.status_code == 401


def test_login_rejects_disabled_user(db, monkeypatch):
    user = MagicMock(spec=User)
    user.password_hash = "hashed-password"
    user.is_active = False

    db.query.return_value.filter.return_value.first.return_value = user
    monkeypatch.setattr(auth, "verify_password", lambda password, hashed: True)

    with pytest.raises(HTTPException) as exc:
        auth.login(
            auth.LoginRequest(
                email="test@example.com",
                password="StrongPassword123",
            ),
            db=db,
        )

    assert exc.value.status_code == 401
