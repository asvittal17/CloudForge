import os
import subprocess
import tempfile
from pathlib import Path

from dotenv import load_dotenv


load_dotenv()


def apply_terraform(
    terraform_files: dict[str, str],
) -> dict:
    """
    Apply an approved Terraform configuration.

    The RDS database password is loaded from the backend
    environment and passed to Terraform through:

        TF_VAR_database_password

    The password is never written into the Terraform files.
    """

    database_password = os.getenv(
        "CLOUDFORGE_RDS_PASSWORD"
    )

    if not database_password:
        return {
            "success": False,
            "stage": "configuration",
            "apply_output": "",
            "apply_error": (
                "CLOUDFORGE_RDS_PASSWORD is not configured "
                "in the backend environment."
            ),
        }

    with tempfile.TemporaryDirectory(
        prefix="cloudforge-terraform-apply-"
    ) as temp_dir:

        terraform_dir = Path(temp_dir)

        # ---------------------------------------------
        # Write Terraform files
        # ---------------------------------------------

        for filename, content in terraform_files.items():

            file_path = terraform_dir / filename

            file_path.write_text(
                content,
                encoding="utf-8",
            )

        # ---------------------------------------------
        # Prepare environment
        # ---------------------------------------------

        environment = os.environ.copy()

        # Terraform automatically reads variables
        # using the TF_VAR_<variable_name> convention.
        environment[
            "TF_VAR_database_password"
        ] = database_password

        # ---------------------------------------------
        # Terraform Init
        # ---------------------------------------------

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
            env=environment,
        )

        if init_result.returncode != 0:

            return {
                "success": False,
                "stage": "init",
                "apply_output": "",
                "apply_error": (
                    "Terraform initialization failed.\n\n"
                    + init_result.stderr
                ),
            }

        # ---------------------------------------------
        # Terraform Apply
        # ---------------------------------------------

        apply_result = subprocess.run(
            [
                "terraform",
                "apply",
                "-auto-approve",
                "-input=false",
                "-no-color",
                "-lock=false",
            ],
            cwd=terraform_dir,
            capture_output=True,
            text=True,
            timeout=600,
            env=environment,
        )

        return {
            "success": apply_result.returncode == 0,
            "stage": "apply",
            "apply_output": apply_result.stdout,
            "apply_error": apply_result.stderr,
        }