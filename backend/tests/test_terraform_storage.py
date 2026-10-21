
import pytest

from app.services.terraform_storage import (
    ensure_artifact_storage,
    get_artifact_storage_dir,
    get_plan_path,
    get_state_path,
)


def test_artifact_storage_is_project_isolated(tmp_path):
    first = get_artifact_storage_dir(1, 10, tmp_path)
    second = get_artifact_storage_dir(2, 10, tmp_path)

    assert first != second
    assert first.is_relative_to(tmp_path.resolve())
    assert second.is_relative_to(tmp_path.resolve())


def test_plan_and_state_paths_are_separate(tmp_path):
    plan = get_plan_path(1, 10, tmp_path)
    state = get_state_path(1, 10, tmp_path)

    assert plan.name == "approved.tfplan"
    assert state.name == "terraform.tfstate"
    assert plan != state


@pytest.mark.parametrize(
    "project_id,artifact_id",
    [
        (0, 1),
        (-1, 1),
        (1, 0),
        (True, 1),
        (1, False),
    ],
)
def test_invalid_ids_are_rejected(tmp_path, project_id, artifact_id):
    with pytest.raises(ValueError):
        get_artifact_storage_dir(
            project_id,
            artifact_id,
            tmp_path,
        )


def test_ensure_storage_creates_directory(tmp_path):
    result = ensure_artifact_storage(3, 25, tmp_path)

    assert result.is_dir()
    assert result.name == "artifact-25"
    assert result.parent.name == "project-3"


def test_state_is_artifact_isolated(tmp_path):
    first = get_state_path(1, 10, tmp_path)
    second = get_state_path(1, 11, tmp_path)
    other_project = get_state_path(2, 10, tmp_path)

    assert first != second
    assert first != other_project
    assert first.parent == get_artifact_storage_dir(1, 10, tmp_path)
