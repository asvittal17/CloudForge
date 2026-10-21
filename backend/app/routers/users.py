from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import get_admin_user, hash_password
from app.db.dependencies import get_db
from app.models.user import User
from app.schemas.user import UserCreate


router = APIRouter(
    prefix="/users",
    tags=["Users"]
)


@router.post("/")
def create_user(
    user: UserCreate,
    current_admin = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Create a user on behalf of someone else. Administrators only."""
    existing = db.query(User).filter(User.email == user.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists"
        )

    new_user = User(
        name=user.name,
        email=user.email.lower().strip(),
        password_hash=hash_password(user.password),
        role="user",
        is_active=True,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "id": new_user.id,
        "name": new_user.name,
        "email": new_user.email
    }
