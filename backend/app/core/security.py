
import os
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.db.dependencies import get_db
from app.models.user import User


# Load environment variables from .env
load_dotenv()


password_hasher = PasswordHasher()


# JWT configuration
SECRET_KEY = os.getenv("SECRET_KEY")

ALGORITHM = os.getenv(
    "ALGORITHM",
    "HS256"
)

ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv(
        "ACCESS_TOKEN_EXPIRE_MINUTES",
        "60"
    )
)


# Swagger / Bearer token configuration
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/token"
)


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(
    password: str,
    password_hash: str
) -> bool:
    try:
        password_hasher.verify(
            password_hash,
            password
        )
        return True

    except Exception:
        return False


def create_access_token(
    data: dict
) -> str:
    to_encode = data.copy()

    expire = (
        datetime.now(timezone.utc)
        + timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )
    )

    to_encode.update({
        "exp": expire
    })

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


def _credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={
            "WWW-Authenticate": "Bearer"
        },
    )


def get_current_user_id(
    token: str = Depends(oauth2_scheme)
) -> int:
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("sub")

        if user_id is None:
            raise _credentials_exception()

        return int(user_id)

    except (JWTError, ValueError, TypeError):
        raise _credentials_exception()


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Resolve the authenticated, active user for the request.

    Raises 401 for invalid or expired tokens, missing users,
    malformed user IDs, and disabled accounts.
    """
    credentials_exception = _credentials_exception()

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("sub")

        if user_id is None:
            raise credentials_exception

        # Validate the subject before querying the database.
        user_id = int(user_id)

    except (JWTError, ValueError, TypeError):
        raise credentials_exception

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account has been disabled by an administrator",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def get_admin_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Server-verified administrator guard for the Admin Console API.

    The role is read from the database on every request — never from
    the JWT alone, from the UI, or from local storage.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator privileges are required for this resource",
        )

    return current_user
