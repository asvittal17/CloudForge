"""
Startup recovery for Terraform applies that were interrupted by a
killed or crashed backend process.

Kept out of app.main so it can be imported and regression-tested
without executing the server bootstrap (which touches the database).
"""

from sqlalchemy.orm import Session

from app.models.terraform_artifact import (
    STATUS_APPLYING,
    STATUS_RECONCILIATION_REQUIRED,
    TerraformArtifact,
)


def recover_interrupted_applies(db: Session) -> int:
    """
    Reset artifacts stranded in "applying" by an interrupted process.

    An artifact found in "applying" was mid-deployment when the
    previous process disappeared. Terraform may have partially created
    or changed real infrastructure before dying, and nothing on the
    server can prove a clean outcome. The safe state is therefore
    "reconciliation_required":

      - apply only ever accepts status "approved", so a stranded
        artifact can never be re-applied automatically;
      - recovery must not re-approve it either;
      - after reconciliation against the real infrastructure, the
        artifact is re-planned, re-verified and re-approved, and only
        then may it be applied again.

    Returns the number of recovered artifacts.
    """
    stranded = (
        db.query(TerraformArtifact)
        .filter(TerraformArtifact.status == STATUS_APPLYING)
        .all()
    )

    for artifact in stranded:
        artifact.status = STATUS_RECONCILIATION_REQUIRED

    if stranded:
        db.commit()

    return len(stranded)
