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
    """
    Format and validate generated Terraform files without
    creating or modifying any cloud infrastructure.

    Returns the existing response fields expected by CloudForge.
    """

    if not isinstance(terraform_files, dict) or not terraform_files:
        return {
            "valid": False,
            "formatted": False,
            "format_output": "",
            "format_error": "No Terraform files were provided.",
            "validation_output": "",
            "validation_error": "Terraform validation cannot proceed without files.",
        }

    with tempfile.TemporaryDirectory(
        prefix="cloudforge-terraform-"
    ) as temp_dir:

        terraform_dir = Path(temp_dir)

        # -----------------------------
        # Write Terraform Files
        # -----------------------------

        try:
            for filename, content in terraform_files.items():
                relative_path = Path(filename)

                # Prevent writing files outside the temporary directory.
                if (
                    relative_path.is_absolute()
                    or ".." in relative_path.parts
                    or not relative_path.parts
                ):
                    return {
                        "valid": False,
                        "formatted": False,
                        "format_output": "",
                        "format_error": f"Invalid Terraform filename: {filename}",
                        "validation_output": "",
                        "validation_error": "Terraform validation stopped because a filename was invalid.",
                    }

                if not isinstance(content, str):
                    return {
                        "valid": False,
                        "formatted": False,
                        "format_output": "",
                        "format_error": f"Invalid content for Terraform file: {filename}",
                        "validation_output": "",
                        "validation_error": "Terraform file contents must be strings.",
                    }

                file_path = terraform_dir / relative_path
                file_path.parent.mkdir(parents=True, exist_ok=True)
                file_path.write_text(content, encoding="utf-8")

        except OSError as exc:
            return {
                "valid": False,
                "formatted": False,
                "format_output": "",
                "format_error": clean_terminal_output(str(exc)),
                "validation_output": "",
                "validation_error": "Failed to write Terraform files.",
            }

        

        # -----------------------------
        # Terraform Format
        # -----------------------------
        # Automatically format files before checking them.

        try:
            fmt_apply_result = subprocess.run(
                [
                    "terraform",
                    "fmt",
                    "-recursive",
                ],
                cwd=terraform_dir,
                capture_output=True,
                text=True,
                timeout=30,
            )

        except FileNotFoundError:
            return {
                "valid": False,
                "formatted": False,
                "format_output": "",
                "format_error": "Terraform CLI was not found. Install Terraform and ensure it is available in PATH.",
                "validation_output": "",
                "validation_error": "Terraform validation could not start.",
            }

        except subprocess.TimeoutExpired:
            return {
                "valid": False,
                "formatted": False,
                "format_output": "",
                "format_error": "Terraform formatting timed out.",
                "validation_output": "",
                "validation_error": "Terraform validation stopped because formatting timed out.",
            }

        if fmt_apply_result.returncode != 0:
            return {
                "valid": False,
                "formatted": False,
                "format_output": clean_terminal_output(
                    fmt_apply_result.stdout
                ),
                "format_error": clean_terminal_output(
                    fmt_apply_result.stderr
                ),
                "validation_output": "",
                "validation_error": "Terraform formatting failed.",
            }

        # Verify formatting after applying it.

        try:
            fmt_result = subprocess.run(
                [
                    "terraform",
                    "fmt",
                    "-check",
                    "-diff",
                    "-recursive",
                ],
                cwd=terraform_dir,
                capture_output=True,
                text=True,
                timeout=30,
            )

        except subprocess.TimeoutExpired:
            return {
                "valid": False,
                "formatted": False,
                "format_output": clean_terminal_output(
                    fmt_apply_result.stdout
                ),
                "format_error": "Terraform formatting verification timed out.",
                "validation_output": "",
                "validation_error": "Terraform validation stopped because formatting verification timed out.",
            }

        formatted = fmt_result.returncode == 0

        format_output = clean_terminal_output(
            "\n".join(
                part
                for part in [
                    fmt_apply_result.stdout,
                    fmt_result.stdout,
                ]
                if part
            )
        )

        format_error = clean_terminal_output(
            "\n".join(
                part
                for part in [
                    fmt_apply_result.stderr,
                    fmt_result.stderr,
                ]
                if part
            )
        )

        # -----------------------------
        # Terraform Init
        # -----------------------------
        # Backend initialization is disabled to avoid configuring
        # or accessing a remote Terraform state backend.

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
                "valid": False,
                "formatted": formatted,
                "format_output": format_output,
                "format_error": format_error,
                "validation_output": "",
                "validation_error": "Terraform initialization timed out.",
            }

        if init_result.returncode != 0:
            return {
                "valid": False,
                "formatted": formatted,
                "format_output": format_output,
                "format_error": format_error,
                "validation_output": clean_terminal_output(
                    init_result.stdout
                ),
                "validation_error": (
                    "Terraform initialization failed.\n\n"
                    + clean_terminal_output(init_result.stderr)
                ),
            }

        # -----------------------------
        # Terraform Validate
        # -----------------------------

        try:
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

        except subprocess.TimeoutExpired:
            return {
                "valid": False,
                "formatted": formatted,
                "format_output": format_output,
                "format_error": format_error,
                "validation_output": "",
                "validation_error": "Terraform validation timed out.",
            }

        except FileNotFoundError:
            return {
                "valid": False,
                "formatted": formatted,
                "format_output": format_output,
                "format_error": format_error,
                "validation_output": "",
                "validation_error": "Terraform CLI was not found during validation.",
            }

        # -----------------------------
        # Final Result
        # -----------------------------

        validation_output = clean_terminal_output(
            validate_result.stdout
        )
        validation_error = clean_terminal_output(
            validate_result.stderr
        )

        return {
            "valid": validate_result.returncode == 0,
            "formatted": formatted,
            "format_output": format_output,
            "format_error": format_error,
            "validation_output": validation_output,
            "validation_error": validation_error,
        }