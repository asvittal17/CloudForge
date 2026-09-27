from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Infrastructure(Base):
    __tablename__ = "infrastructures"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id"),
        nullable=False,
        index=True
    )

    cloud_provider: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="AWS"
    )

    region: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="ap-south-1"
    )

    environment: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="development"
    )

    architecture: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )

    project = relationship(
        "Project",
        backref="infrastructure"
    )