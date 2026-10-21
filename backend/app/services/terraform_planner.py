
import hashlib
import os
import shutil
import subprocess
import tempfile
from pathlib import Path, PureWindowsPath


def _validate_terraform_files(
    terraform_files: dict[str, str],
) -> str | None:
    """Return a validation error, or None when inputs are valid."""

    if not isinstance(terraform_files, dict) or not terraform_files:
        return "Terraform files must be a non-empty dictionary."

    for filename, content in terraform_files.items():
        if not isinstance(filename, str) or not filename.strip():
            return "Every Terraform filename must be a non-empty string."

        windows_path = PureWindowsPath(filename)
        path = Path(filename)

        if (
            "\x00" in filename
            or windows_path.is_absolute()
            or windows_path.drive
            or path.is_absolute()
            or "/" in filename
            or "\\" in filename
            or filename in {".", ".."}
        ):
            return f"Invalid Terraform filename: {filename!r}"

        if not (
            filename.endswith(".tf")
            or filename.endswith(".tf.json")
        ):
            return (
                f"Unsupported Terraform filename: {filename!r}. "
                "Only .tf and .tf.json files are allowed."
            )

        if not isinstance(content, str):
            return (
                f"Terraform file content must be a string: "
                f"{filename!r}"
            )

    return None


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def config_digest(terraform_files: dict[str, str]) -> str:
    """Stable digest over the exact configuration being planned."""
    digest = hashlib.sha256()
    for filename in sorted(terraform_files):
        digest.update(filename.encode("utf-8"))
        digest.update(b"\x00")
        digest.update(terraform_files[filename].encode("utf-8"))
    return digest.hexdigest()


def plan_terraform(
    terraform_files: dict[str, str],
    plan_dir: Path | str | None = None,
) -> dict:
    """
    Run terraform plan against validated files without applying them.

    When plan_dir is provided, the exact configuration and a saved plan
    file (terraform plan -out=approved.tfplan) are stored there, and the
    result includes sha256 digests for both. The digests let approval and
    apply verify that the reviewed plan is the plan that gets applied.
    """

    validation_error = _validate_terraform_files(terraform_files)

    if validation_error:
        return {
            "success": False,
            "plan_output": "",
            "plan_error": validation_error,
        }

    if plan_dir is not None:
        plan_dir = Path(plan_dir)
        plan_path = plan_dir / "approved.tfplan"
    else:
        plan_path = None

    with tempfile.TemporaryDirectory(
        prefix="cloudforge-terraform-plan-"
    ) as temp_dir:
        terraform_dir = Path(temp_dir)

        for filename, content in terraform_files.items():
            (terraform_dir / filename).write_text(
                content,
                encoding="utf-8",
            )

        try:
            init_result = subprocess.run(
                [
                    "terraform",
                    "init",
                    "-backend=false",
                    "-input=false",
                    "-no-color",
                ],
                cwd=terraform_dir,
                capture_output=True,
                text=True,
                timeout=300,
            )
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "plan_output": "",
                "plan_error": "Terraform initialization timed out.",
            }
        except OSError as exc:
            return {
                "success": False,
                "plan_output": "",
                "plan_error": f"Unable to start Terraform initialization: {exc}",
            }

        if init_result.returncode != 0:
            return {
                "success": False,
                "plan_output": "",
                "plan_error": (
                    "Terraform initialization failed.\n\n"
                    + init_result.stderr
                ),
            }

        plan_command = [
            "terraform",
            "plan",
            "-input=false",
            "-refresh=false",
            "-no-color",
            "-lock=false",
        ]

        variables_tf = terraform_files.get("variables.tf", "")
        database_password_declared = (
            'variable "database_password"' in variables_tf
        )

        if database_password_declared:
            plan_command.append(
                "-var=database_password="
                "cloudforge-plan-only-placeholder"
            )

        if plan_path is not None:
            plan_command.append("-out=approved.tfplan")

        try:
            plan_result = subprocess.run(
                plan_command,
                cwd=terraform_dir,
                capture_output=True,
                text=True,
                timeout=180,
            )
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "plan_output": "",
                "plan_error": "Terraform planning timed out.",
            }
        except OSError as exc:
            return {
                "success": False,
                "plan_output": "",
                "plan_error": f"Unable to start Terraform planning: {exc}",
            }

        base_result: dict = {
            "success": plan_result.returncode == 0,
            "plan_output": plan_result.stdout,
            "plan_error": plan_result.stderr,
        }

        if plan_path is None:
            return base_result

        if not base_result["success"]:
            base_result["plan_sha256"] = None
            base_result["config_sha256"] = None
            return base_result

        # ---------------------------------------------
        # Persist the saved plan and the exact config.
        # The saved plan may reference sensitive values
        # planned into it, so it stays outside the web
        # root, in secure storage, and is never returned
        # through the API.
        # ---------------------------------------------

        try:
            plan_dir.mkdir(parents=True, exist_ok=True)
            if os.name == "posix":
                os.chmod(plan_dir, 0o700)

            for filename, content in terraform_files.items():
                (plan_dir / filename).write_text(
                    content,
                    encoding="utf-8",
                )

            shutil.copyfile(
                terraform_dir / "approved.tfplan",
                plan_path,
            )

            if os.name == "posix":
                os.chmod(plan_path, 0o600)

            base_result["plan_sha256"] = sha256_file(plan_path)
            base_result["config_sha256"] = config_digest(terraform_files)
        except OSError as exc:
            base_result["success"] = False
            base_result["plan_sha256"] = None
            base_result["config_sha256"] = None
            base_result["plan_error"] = (
                "Terraform plan succeeded, but the saved plan could "
                f"not be persisted: {exc}"
            )

        return base_result
