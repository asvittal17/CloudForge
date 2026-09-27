import re
import subprocess
import tempfile
from pathlib import Path


def clean_terminal_output(text: str) -> str:
    """
    Remove ANSI terminal color/control sequences
    before sending Terraform output to the frontend.
    """
    ansi_escape = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")
    return ansi_escape.sub("", text)


def validate_terraform(terraform_files: dict[str, str]) -> dict:
    with tempfile.TemporaryDirectory(
        prefix="cloudforge-terraform-"
    ) as temp_dir:

        terraform_dir = Path(temp_dir)

        # Write Terraform files
        for filename, content in terraform_files.items():
            file_path = terraform_dir / filename
            file_path.write_text(
                content,
                encoding="utf-8"
            )

        # -----------------------------
        # Terraform Format Check
        # -----------------------------

        fmt_result = subprocess.run(
            [
                "terraform",
                "fmt",
                "-check",
                "-diff",
            ],
            cwd=terraform_dir,
            capture_output=True,
            text=True,
            timeout=30,
        )

        # -----------------------------
        # Terraform Init
        # -----------------------------

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
                "valid": False,
                "formatted": fmt_result.returncode == 0,
                "format_output": clean_terminal_output(
                    fmt_result.stdout
                ),
                "format_error": clean_terminal_output(
                    fmt_result.stderr
                ),
                "validation_output": "",
                "validation_error": (
                    "Terraform initialization failed.\n\n"
                    + clean_terminal_output(init_result.stderr)
                ),
            }

        # -----------------------------
        # Terraform Validate
        # -----------------------------

        validate_result = subprocess.run(
            [
                "terraform",
                "validate",
                "-no-color",
            ],
            cwd=terraform_dir,
            capture_output=True,
            text=True,
            timeout=60,
        )

        return {
            "valid": validate_result.returncode == 0,
            "formatted": fmt_result.returncode == 0,
            "format_output": clean_terminal_output(
                fmt_result.stdout
            ),
            "format_error": clean_terminal_output(
                fmt_result.stderr
            ),
            "validation_output": clean_terminal_output(
                validate_result.stdout
            ),
            "validation_error": clean_terminal_output(
                validate_result.stderr
            ),
        }