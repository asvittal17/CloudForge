# CloudForge

AI-powered cloud infrastructure control plane. Describe infrastructure in plain language, get production-ready Terraform through a gated stage → plan → approve → deploy pipeline.

## Stack

- **Backend:** FastAPI, SQLAlchemy 2, PostgreSQL, Pydantic v2, argon2, JWT (python-jose)
- **Frontend:** React 19, Vite, Tailwind CSS v4, React Router v7
- **AI:** Local Ollama (llama3.2:3b) for architecture planning
- **Security:** Checkov for Terraform scanning, terraform fmt/validate/plan

## Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 16
- Ollama running locally with `llama3.2:3b` model
- Terraform CLI
- Checkov

## Quick Start

### 1. Database

```bash
docker compose up -d
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate  # Windows
pip install -r requirements.txt
```

Create `.env` from the provided `.env.example`:

```env
SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_urlsafe(32))">
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
DB_USER=cloudforge
DB_PASSWORD=<your-password>
DB_HOST=127.0.0.1
DB_PORT=5434
DB_NAME=cloudforge
CLOUDFORGE_ADMIN_EMAILS=<comma-separated admin emails for bootstrap promotion>
CLOUDFORGE_ALLOW_TERRAFORM_APPLY=0
```

- `CLOUDFORGE_ALLOW_TERRAFORM_APPLY=1` is the explicit gate for real
  `terraform apply` runs. It defaults to **disabled**: while disabled, no
  `terraform apply` subprocess can run and the artifact's deployment status
  is left untouched (the apply endpoint responds 403). Enabling real
  deployments is a deliberate configuration decision for an environment that
  holds the required infrastructure credentials (AWS credentials plus
  `CLOUDFORGE_RDS_PASSWORD`); audit, CI and demo environments never enable it.
- Saved Terraform plans (`approved.tfplan`) and local dev state are stored in
  `CLOUDFORGE_TERRAFORM_STORAGE` (default `D:\CloudForge-data\terraform`),
  always outside the repository and web root.

Apply the schema migrations to a fresh database:

```bash
cd backend
.venv\Scripts\python.exe -m alembic upgrade head
```

Run:

```bash
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Self-service registration (creates role="user") |
| POST | `/auth/login` | Get JWT token |
| POST | `/users/` | Create user (admin only) |
| GET | `/projects/` | List user projects |
| GET | `/projects/summary` | Workspace metrics for the signed-in user |
| POST | `/projects/` | Create project |
| PUT | `/projects/{id}` | Update project |
| DELETE | `/projects/{id}` | Delete project |
| GET | `/infrastructure/{project_id}` | Get infrastructure config |
| PUT | `/infrastructure/{project_id}` | Update infrastructure config |
| POST | `/ai/infrastructure` | Generate architecture plan from natural language |
| POST | `/ai/terraform` | Generate Terraform from architecture plan |
| POST | `/terraform/{id}/stage` | Stage Terraform artifact |
| POST | `/terraform/{id}/artifacts/{aid}/security-scan` | Run Checkov scan |
| POST | `/terraform/{id}/artifacts/{aid}/plan` | Save a plan file + record its digests |
| POST | `/terraform/{id}/artifacts/{aid}/approve` | Approve the identified saved plan |
| POST | `/terraform/{id}/artifacts/{aid}/apply` | Apply the exact approved plan |
| GET | `/admin/stats` | Platform statistics (admin) |
| GET | `/admin/users` | Paginated user directory (admin) |
| PATCH | `/admin/users/{id}/role` | Change role (admin, cannot demote self) |
| PATCH | `/admin/users/{id}/status` | Enable/disable account (admin) |
| GET | `/monitoring/summary` | Health + error summary (admin) |
| GET | `/monitoring/errors` | Error event list (admin) |
| GET | `/health` | Real component health (database, Ollama) |

## Deployment pipeline safety model

`staged` → `validate/fmt` → `security-scan (Checkov, fail-closed)` →
`plan` (saved plan file + configuration kept in protected storage identified by
SHA-256 digests) → `plan_ready` → `approve` (verifies plan file identity) →
`approved` → `apply` (re-verifies digests, atomic `approved → applying` claim,
re-scans, applies the saved plan file, real resources only when
`CLOUDFORGE_ALLOW_TERRAFORM_APPLY=1`) → `deployed` on success.

Failure outcomes are classified honestly and never silently retried:

- the `terraform apply` subprocess was **in flight** and then failed, was
  killed, or timed out → the artifact becomes `reconciliation_required`.
  Terraform may already have created or changed real infrastructure, and
  nothing on the server can prove a clean result. The artifact cannot be
  applied or re-approved from this state: reconciliation against the real
  infrastructure is followed by re-planning, re-verification and
  re-approval before any further apply.
- it is **provable** that no apply subprocess ever started (gate disabled,
  configuration error, init failure, plan-digest refusal) → the artifact
  stays/returns to `approved`, because real infrastructure is provably
  untouched and the very same approved plan remains retryable.
- crash recovery applies the same rule: artifacts stranded in `applying`
  by a killed backend move to `reconciliation_required` at startup — never
  automatically back to `approved`.

Re-planning is explicitly allowed from `plan_ready`, `approved`, and
`reconciliation_required` (it is the instructed recovery path); a
successful re-plan invalidates the previous plan digest and approval state,
and the transition is a conditional database update so concurrent approve
or apply requests cannot be clobbered.

Limitations of the development state model: Terraform runs with
`-backend=false` and a local state file inside each artifact's protected
storage directory; applies are serialized per project in-process and guarded
at the API level, but local files provide no distributed locking. Production
deployments must configure a remote backend with native locking (for example
S3 + DynamoDB).

## Tests

Backend (from `backend/`, requires the venv; no AWS credentials needed —
tests that drive the real Terraform CLI skip themselves when Terraform is
absent, and no test ever runs `terraform apply`):

```bash
.venv\Scripts\python.exe -m pytest -q
.venv\Scripts\python.exe -m pip check
```

Frontend (from `frontend/`):

```bash
npm ci
npm audit --audit-level=high
npm run lint
npm run build
```

CI (`.github/workflows/ci.yml`) runs the backend suite with `pip check` and
the frontend `npm ci`/audit/lint/build pipeline, with
`CLOUDFORGE_ALLOW_TERRAFORM_APPLY=0` forced in the environment.

## Demo

`docs/demo-script.md` contains a 5–7 minute demo script with safe sample
inputs, expected outputs, and a fallback demo that requires no AWS
provisioning (the pipeline is demonstrated through `staged → plan_ready →
approved` with the apply gate honestly reporting 403 while disabled).
`docs/interview-prep.md` covers likely interview questions grounded in the
code, and `docs/project-report.md` / `docs/CloudForge-Project-Report.pdf`
contain the written project report.

## Project Structure

```
backend/
  app/
    core/security.py       # JWT, argon2, auth dependency
    db/                    # SQLAlchemy engine, session, init
    models/                # ORM models
    routers/               # FastAPI route handlers
    schemas/               # Pydantic request/response models
    services/              # Ollama, Terraform, Checkov integrations
frontend/src/
  components/              # Navbar, Sidebar, modals, viewers
  context/                 # Theme provider
  pages/                   # Login, Dashboard, ProjectDetails, Terraform, AIInfrastructure
  services/api.ts          # Centralized API client
```
