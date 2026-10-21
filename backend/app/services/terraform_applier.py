import hashlib
import os
import subprocess
import threading
from pathlib import Path

from dotenv import load_dotenv

from app.services.terraform_planner import sha256_file


load_dotenv()


# ---------------------------------------------
# Global kill switch for real infrastructure
# operations. Applies only run when
# CLOUDFORGE_ALLOW_TERRAFORM_APPLY=1 is explicitly
# configured. This keeps accidental/payable cloud
# changes impossible in audit, CI and demo
# environments.
# ---------------------------------------------

APPLY_ENABLED_ENV = "CLOUDFORGE_ALLOW_TERRAFORM_APPLY"


def applies_are_allowed() -> bool:
    value = os.getenv(APPLY_ENABLED_ENV, "").strip().lower()
    return value in {"1", "true", "yes", "on"}


# ---------------------------------------------
# In-process per-project lock. Local-file state
# provides no distributed locking, so concurrent
# applies against the same project's state must be
# serialized inside this process, and the DB-level
# status guard in the router prevents duplicate
# operations across processes at the API layer.
# ---------------------------------------------

_project_locks: dict[int, threading.Lock] = {}
_project_locks_guard = threading.Lock()


def get_project_apply_lock(project_id: int) -> threading.Lock:
    with _project_locks_guard:
        if project_id not in _project_locks:
            _project_locks[project_id] = threading.Lock()
        return _project_locks[project_id]


def _run(
    command: list[str],
    cwd: Path,
    environment: dict,
    timeout: int,
) -> subprocess.CompletedProcess:
    return subprocess.run(
        command,
        cwd=cwd,
        capture_output=True,
        text=True,
        timeout=timeout,
        env=environment,
    )


def apply_saved_plan(
    project_id: int,
    plan_dir: Path,
    plan_path: Path,
    expected_plan_digest: str | None = None,
) -> dict:
    """
    Apply the exact saved plan that was reviewed and approved.

    Requirements:
      - plan_dir is the directory holding the exact configuration the
        plan was created from (as produced by plan_terraform).
      - plan_path must exist and match the artifact's recorded digest.
      - expected_plan_digest, when provided, re-verifies the saved plan
        on disk immediately before the apply subprocess launches — the
        last line of defense alongside the router-level checks
        (approval status, digest verification, DB status guard).
      - Every result carries `terraform_apply_started`: False ONLY when
        it is provable that no `terraform apply` subprocess was ever
        in flight (gate disabled, config error, plan verification, or
        a spawn failure — the only clean, safe-to-retry failure
        class); True whenever the apply subprocess ran, failed, or
        timed out, because a partially-executed apply may have
        modified real infrastructure in unknown ways.
      - The apply kill switch is re-checked here, immediately before
        launching Terraform, as defense in depth; no apply subprocess
        can run while CLOUDFORGE_ALLOW_TERRAFORM_APPLY is disabled.

    State model (development mode):
      - The backend is disabled for init ("init -backend=false") and
        Terraform's default local state file lives inside the
        artifact's protected storage directory. Local files provide
        no distributed locking or versioning: applies are serialized
        per project in-process and guarded at the API level, and any
        production deployment must move state to a remote backend
        with native locking (e.g. S3 + DynamoDB).

    The RDS password is passed via TF_VAR_database_password and is
    never written to disk or returned to the client.
    """

    # ---------------------------------------------
    # Final authorization check, immediately before
    # any Terraform subprocess may start.
    # ---------------------------------------------
    if not applies_are_allowed():
        return {
            "success": False,
            "stage": "authorization",
            "terraform_apply_started": False,
            "apply_output": "",
            "apply_error": (
                "Terraform applies are disabled "
                f"({APPLY_ENABLED_ENV} is not set to an enabled value)."
            ),
        }

    database_password = os.getenv("CLOUDFORGE_RDS_PASSWORD")

    if not database_password:
        return {
            "success": False,
            "stage": "configuration",
            "terraform_apply_started": False,
            "apply_output": "",
            "apply_error": (
                "CLOUDFORGE_RDS_PASSWORD is not configured "
                "in the backend environment."
            ),
        }

    if expected_plan_digest is not None:
        if not plan_path.is_file():
            return {
                "success": False,
                "stage": "authorization",
                "terraform_apply_started": False,
                "apply_output": "",
                "apply_error": "The approved saved plan file is missing.",
            }
        if sha256_file(plan_path) != expected_plan_digest:
            return {
                "success": False,
                "stage": "authorization",
                "terraform_apply_started": False,
                "apply_output": "",
                "apply_error": (
                    "The saved plan file no longer matches the approved "
                    "plan identity. Deployment refused."
                ),
            }

    with get_project_apply_lock(project_id):

        try:
            environment = os.environ.copy()
            environment["TF_VAR_database_password"] = database_password
        except Exception as exc:
            # The subprocess environment could not be prepared before
            # any Terraform process could exist: infrastructure is
            # provably untouched, so this is safe to retry.
            return {
                "success": False,
                "stage": "configuration",
                "terraform_apply_started": False,
                "apply_output": "",
                "apply_error": (
                    f"Unable to prepare the Terraform environment: {exc}"
                ),
            }

        try:

            # ---------------------------------------------
            # Terraform init in the exact directory holding
            # the planned configuration (needed so the
            # saved plan loads and providers can install).
            # `init -backend=false` cannot modify real
            # infrastructure, so any failure here (including a
            # timeout) is safe to retry.
            # ---------------------------------------------

            try:
                init_result = _run(
                    [
                        "terraform",
                        "init",
                        "-backend=false",
                        "-input=false",
                        "-no-color",
                        "-lock=false",
                    ],
                    cwd=plan_dir,
                    environment=environment,
                    timeout=300,
                )
            except subprocess.TimeoutExpired:
                return {
                    "success": False,
                    "stage": "init",
                    "terraform_apply_started": False,
                    "apply_output": "",
                    "apply_error": "Terraform initialization timed out.",
                }
            except OSError as exc:
                return {
                    "success": False,
                    "stage": "init",
                    "terraform_apply_started": False,
                    "apply_output": "",
                    "apply_error": (
                        f"Unable to start Terraform initialization: {exc}"
                    ),
                }

            if init_result.returncode != 0:
                return {
                    "success": False,
                    "stage": "init",
                    "terraform_apply_started": False,
                    "apply_output": "",
                    "apply_error": (
                        "Terraform initialization failed.\n\n"
                        + init_result.stderr
                    ),
                }

            # ---------------------------------------------
            # Apply the saved plan — no approval prompt and
            # no opportunity for Terraform to plan anything
            # new. The reviewed plan is what gets applied.
            #
            # From here the apply subprocess REALLY RUNS, so
            # every failure is potentially partial: Terraform
            # may have created or changed resources before
            # erroring or being killed. `terraform_apply_started`
            # is False only there was never an `apply` subprocess
            # in flight (spawn failure) — that is the only case
            # callers may treat as a clean retryable failure.
            # ---------------------------------------------

            apply_command = [
                "terraform",
                "apply",
                "-input=false",
                "-no-color",
                "-lock=false",
                str(plan_path),
            ]

            try:
                apply_result = _run(
                    apply_command,
                    cwd=plan_dir,
                    environment=environment,
                    timeout=600,
                )
            except subprocess.TimeoutExpired:
                return {
                    "success": False,
                    "stage": "apply",
                    "terraform_apply_started": True,
                    "apply_output": "",
                    "apply_error": (
                        "Terraform deployment timed out while it may "
                        "still have been modifying infrastructure. The "
                        "outcome is uncertain: reconciliation of the "
                        "real infrastructure is required before any "
                        "further apply."
                    ),
                }
            except OSError as exc:
                # subprocess.run failed to START the apply process,
                # so no Terraform deployment was ever in flight.
                return {
                    "success": False,
                    "stage": "apply",
                    "terraform_apply_started": False,
                    "apply_output": "",
                    "apply_error": (
                        f"Unable to start Terraform deployment: {exc}"
                    ),
                }

            if apply_result.returncode != 0:
                # Terraform ran and reported failure: it may already
                # have applied some resources. Never classified as a
                # clean retryable failure.
                return {
                    "success": False,
                    "stage": "apply",
                    "terraform_apply_started": True,
                    "apply_output": apply_result.stdout,
                    "apply_error": apply_result.stderr,
                }

            return {
                "success": True,
                "stage": "apply",
                "terraform_apply_started": True,
                "apply_output": apply_result.stdout,
                "apply_error": apply_result.stderr,
            }

        except Exception as exc:
            # Unexpected non-subprocess failure. All subprocess
            # lifecycle errors above already returned, so in the
            # current code path no `terraform apply` subprocess can
            # have been in flight — but the flag stays conservative
            # (True) so future refactors can never silently widen the
            # "safe to retry" class. The caller decides the artifact
            # state.
            return {
                "success": False,
                "stage": "apply",
                "terraform_apply_started": True,
                "apply_output": "",
                "apply_error": f"Terraform deployment failed: {exc}",
            }
