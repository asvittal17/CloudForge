import subprocess
import tempfile
from pathlib import Path


def plan_terraform(terraform_files: dict[str, str]) -> dict:
    """
    Run terraform plan against the supplied Terraform files.

    If the configuration declares a database_password variable,
    a temporary placeholder is supplied only for the plan.

    No real database password is stored or used here.
    """

    with tempfile.TemporaryDirectory(
        prefix="cloudforge-terraform-plan-"
    ) as temp_dir:

        terraform_dir = Path(temp_dir)

        # ----------------------------------------
        # Write Terraform files
        # ----------------------------------------

        for filename, content in terraform_files.items():

            file_path = terraform_dir / filename

            file_path.write_text(
                content,
                encoding="utf-8",
            )

        # ----------------------------------------
        # Terraform Init
        # ----------------------------------------

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

        if init_result.returncode != 0:

            return {
                "success": False,
                "plan_output": "",
                "plan_error": (
                    "Terraform initialization failed.\n\n"
                    + init_result.stderr
                ),
            }

        # ----------------------------------------
        # Terraform Plan command
        # ----------------------------------------

        plan_command = [
            "terraform",
            "plan",
            "-input=false",
            "-refresh=false",
            "-no-color",
            "-lock=false",
        ]

        # ----------------------------------------
        # Check whether database_password exists
        # ----------------------------------------

        variables_tf = terraform_files.get(
            "variables.tf",
            "",
        )

        database_password_declared = (
            'variable "database_password"' in variables_tf
        )

        # ----------------------------------------
        # Add temporary password ONLY when required
        # ----------------------------------------

        if database_password_declared:

            plan_command.append(
                "-var=database_password="
                "cloudforge-plan-only-placeholder"
            )

        # ----------------------------------------
        # Run Terraform Plan
        # ----------------------------------------

        plan_result = subprocess.run(
            plan_command,
            cwd=terraform_dir,
            capture_output=True,
            text=True,
            timeout=180,
        )

        return {
            "success": plan_result.returncode == 0,
            "plan_output": plan_result.stdout,
            "plan_error": plan_result.stderr,
        }