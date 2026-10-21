import os
from pathlib import Path, PureWindowsPath


DEFAULT_STORAGE_ROOT = Path(
    os.getenv(
        "CLOUDFORGE_TERRAFORM_STORAGE",
        r"D:\CloudForge-data\terraform",
    )
)


def _validate_id(value: int, name: str) -> None:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ValueError(f"{name} must be a positive integer.")


def _get_root(storage_root: Path | str | None = None) -> Path:
    return Path(storage_root or DEFAULT_STORAGE_ROOT).resolve()


def get_project_storage_dir(
    project_id: int,
    storage_root: Path | str | None = None,
) -> Path:
    _validate_id(project_id, "project_id")
    root = _get_root(storage_root)
    project_dir = (root / f"project-{project_id}").resolve()

    if not project_dir.is_relative_to(root):
        raise ValueError("Terraform storage path escapes its root.")

    return project_dir


def get_artifact_storage_dir(
    project_id: int,
    artifact_id: int,
    storage_root: Path | str | None = None,
) -> Path:
    _validate_id(artifact_id, "artifact_id")
    project_dir = get_project_storage_dir(project_id, storage_root)
    artifact_dir = (project_dir / f"artifact-{artifact_id}").resolve()

    if not artifact_dir.is_relative_to(project_dir):
        raise ValueError("Terraform artifact path escapes its project.")

    return artifact_dir


def ensure_artifact_storage(
    project_id: int,
    artifact_id: int,
    storage_root: Path | str | None = None,
) -> Path:
    artifact_dir = get_artifact_storage_dir(
        project_id, artifact_id, storage_root
    )
    artifact_dir.mkdir(parents=True, exist_ok=True)

    if os.name == "posix":
        os.chmod(artifact_dir, 0o700)

    return artifact_dir


def get_plan_path(
    project_id: int,
    artifact_id: int,
    storage_root: Path | str | None = None,
) -> Path:
    return get_artifact_storage_dir(
        project_id, artifact_id, storage_root
    ) / "approved.tfplan"


def get_state_path(
    project_id: int,
    artifact_id: int | None = None,
    storage_root: Path | str | None = None,
) -> Path:
    """Return the local state path for an artifact's working directory.

    In the development state model, `terraform apply <plan file>` runs
    inside the artifact's storage directory and the local backend
    writes `terraform.tfstate` there. Each artifact therefore keeps an
    isolated state file. Without artifact_id the project-scoped state
    path is returned for migration/tooling purposes.
    """
    if artifact_id is not None:
        _validate_id(artifact_id, "artifact_id")
        return get_artifact_storage_dir(
            project_id, artifact_id, storage_root
        ) / "terraform.tfstate"

    return get_project_storage_dir(project_id, storage_root) / "terraform.tfstate"
