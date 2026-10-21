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

Create `.env` (see `.env` for keys to set):

```env
SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_urlsafe(32))">
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
DB_USER=cloudforge
DB_PASSWORD=<your-password>
DB_HOST=localhost
DB_PORT=5434
DB_NAME=cloudforge
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
| POST | `/auth/login` | Get JWT token |
| POST | `/users/` | Create user (authenticated) |
| GET | `/projects/` | List user projects |
| POST | `/projects/` | Create project |
| PUT | `/projects/{id}` | Update project |
| DELETE | `/projects/{id}` | Delete project |
| GET | `/infrastructure/{project_id}` | Get infrastructure config |
| PUT | `/infrastructure/{project_id}` | Update infrastructure config |
| POST | `/ai/infrastructure` | Generate architecture plan from natural language |
| POST | `/ai/terraform` | Generate Terraform from architecture plan |
| POST | `/terraform/{id}/stage` | Stage Terraform artifact |
| POST | `/terraform/{id}/artifacts/{aid}/plan` | Run terraform plan |
| POST | `/terraform/{id}/artifacts/{aid}/approve` | Approve artifact |
| POST | `/terraform/{id}/artifacts/{aid}/apply` | Deploy to AWS |
| POST | `/terraform/{id}/artifacts/{aid}/security-scan` | Run Checkov scan |

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
