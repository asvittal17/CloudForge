from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


# ---------------------------------------------
# Artifact lifecycle states. Strings live in the
# `status` column (String(30)) — new states must
# fit that length.
# ---------------------------------------------

STATUS_STAGED = "staged"
STATUS_PLAN_READY = "plan_ready"
STATUS_APPROVED = "approved"
STATUS_APPLYING = "applying"
STATUS_DEPLOYED = "deployed"

# Interrupted or uncertain apply outcome. Terraform ran and the real
# infrastructure may have been partially created or changed; nothing
# on the server can prove a clean result. ARTIFACTS IN THIS STATE ARE
# NEVER SAFE TO RE-APPLY AUTOMATICALLY: they require infrastructure
# reconciliation (compare real infrastructure against the plan/state,
# then re-plan, re-verify and re-approve) — the apply route only ever
# accepts status "approved".
STATUS_RECONCILIATION_REQUIRED = "reconciliation_required"


class TerraformArtifact(Base):
    __tablename__ = "terraform_artifacts"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id"),
        nullable=False,
        index=True
    )

    main_tf: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )

    variables_tf: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )

    outputs_tf: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="staged"
    )

    # ---------------------------------------------
    # Saved-plan integrity. When an artifact reaches
    # "plan_ready", the exact saved plan file and the
    # configuration it was planned from are persisted
    # outside the web root and identified by digests.
    # Approval and apply verify these digests so the
    # reviewed plan is provably the plan that is applied.
    # ---------------------------------------------

    config_sha256: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True
    )

    plan_sha256: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True
    )

    planned_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    project = relationship(
        "Project",
        backref="terraform_artifacts"
    )