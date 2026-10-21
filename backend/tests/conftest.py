"""
Test environment bootstrap.

CI runs pytest without backend/.env; these defaults keep the suite
deterministic and safe in every environment:

  - JWT signing uses a fixed test-only key instead of `None`
    (python-jose raises JWSError for a missing key, which previously
    made the suite fail in CI while passing locally where .env exists);
  - real Terraform applies are hard-disabled for the whole run. This
    is belt and braces: individual tests that exercise enabled paths
    set the gate themselves via monkeypatch, and no test ever runs a
    real `terraform apply` subprocess.

Conftest runs before any application module is imported, so these
values win over whatever a local development .env contains — the test
suite is never executed with credential-bearing settings.
"""

import os

os.environ.setdefault("SECRET_KEY", "test-only-secret-key-for-ci")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
os.environ.setdefault("CLOUDFORGE_ALLOW_TERRAFORM_APPLY", "0")
