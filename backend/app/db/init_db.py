from app.db.database import Base, engine

from app.models.user import User
from app.models.project import Project
from app.models.infrastructure import Infrastructure
from app.models.terraform_artifact import TerraformArtifact


def init_db():
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")


if __name__ == "__main__":
    init_db()