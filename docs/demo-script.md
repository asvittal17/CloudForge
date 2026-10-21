# CloudForge — Demo Script (5–7 minutes)

Everything in this demo runs locally. **No AWS account, no cloud credentials,
no paid resources.** The deployment gate is shown honestly: real applies are
disabled (`CLOUDFORGE_ALLOW_TERRAFORM_APPLY=0`), and the platform says so.

Pre-run setup (once, before the demo):
1. `docker compose up -d` (PostgreSQL on `127.0.0.1:5434`)
2. Backend: `cd backend && .venv\Scripts\python.exe -m alembic upgrade head && .venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000`
3. Frontend: `cd frontend && npm run dev` → http://localhost:5173
4. Have Terraform CLI and Ollama (`ollama run llama3.2:3b`) available.

---

## Minute 0:00–0:45 — The problem and the product

Open the login page. Say: "CloudForge turns a natural-language request into
Terraform that goes through a real, gated release pipeline — the same shape
you'd want for AI-generated code anywhere: generate, validate, scan, plan,
approve, only then deploy."

Log in with the demo user account.

## 0:45–2:00 — AI generation

Go to the AI Infrastructure page for a project. Enter the sample request:

> "A small Python API service with a PostgreSQL database, private network,
> and an S3 bucket for file uploads."

Show the returned architecture plan (components + relationships as JSON).
Click generate-Terraform and open the artifact viewer: `main.tf`,
`variables.tf`, `outputs.tf` side by side. Point out this is LLM output —
"which is exactly why everything after this is deterministic."

## 2:00–3:00 — Validate + scan

Run **Validate**: `terraform fmt` + `terraform validate` output is shown
directly in the UI. Run **Security scan**: show real Checkov results
(e.g. 24 checks passed, with genuine failing checks listed — never hidden).
Say: "The scanner is fail-closed. If Checkov crashes or returns a malformed
report, the pipeline stops — the artifact can never skip the gate by the
scanner failing."

## 3:00–4:00 — Plan

Run **Plan**. Terraform writes a saved plan (`approved.tfplan`) into protected
storage outside the repository, and the artifact records SHA-256 digests of
the plan file and the exact configuration it was built from. Status becomes
`plan_ready`. Say: "The digests are what guarantee the plan a human approves
is byte-for-byte the plan that would run."

## 4:00–5:00 — Approve

Run **Approve**. The endpoint re-loads the saved plan file and verifies its
digest before accepting the approval, records `approved_at`, and writes an
audit event. Status: `approved`.

## 5:00–6:00 — Apply gate (the honest 403)

Run **Deploy**. The endpoint returns **403 — Terraform applies are disabled**
(`CLOUDFORGE_ALLOW_TERRAFORM_APPLY` is off), and the artifact status is
completely untouched. Say: "This is deliberate. In audit, CI, and demo
environments the platform physically cannot create cloud resources or incur
cost. The gate is checked at the route *and* re-checked inside the applier
immediately before any subprocess could launch."

Mention the full apply path when enabled: digest re-verification, an atomic
`approved → applying` database claim so concurrent applies 409, a per-project
lock, and honest failure classification — if the `terraform apply` subprocess
was actually running and failed, was killed, or timed out, the artifact
becomes `reconciliation_required` (real infrastructure may be partially
changed; it must be reconciled, re-planned and re-approved — never silently
retried), while a failure before any apply subprocess started keeps the
artifact `approved` because nothing was touched. Nothing pretends to be
"deployed".

## 6:00–7:00 — Closing

Show `/health` (or the monitoring summary) reporting real component probes,
and the error-event log showing the audit entries just generated. Close with:
"Tests: 99 backend tests passing, including real-CLI plan round-trips,
tamper-refusal, concurrency, and interrupted-apply reconciliation
regression tests. Frontend lint and build clean. The one documented
production prerequisite is a remote Terraform backend for state locking."

---

## Safe sample inputs and expected outputs

| Step | Input | Expected output |
|---|---|---|
| Register | email + password (any) | account created, role `user` |
| Describe | "A small Python API service with a PostgreSQL database, private network, and an S3 bucket for file uploads." | JSON architecture plan, then 3 Terraform files |
| Validate | — | `terraform fmt` diff (usually none) + `validate: success` |
| Scan | — | passed/failed Checkov counts + failing checks list |
| Plan | — | `plan_ready`, digests recorded, plan file in protected storage |
| Approve | — | `approved` + digest re-verified |
| Deploy (gated) | — | HTTP 403 "applies are disabled", status unchanged |

## Fallback demo (if something breaks live)

- **Ollama down:** skip generation; use the PLAIN-Terraform page — paste any
  valid HCL (keep a known-good `main.tf`/`variables.tf`/`outputs.tf` in
  Notepad) and stage it directly. Pipeline steps are unchanged.
- **Terraform CLI missing:** skip plan; demo approve-gate logic from the scan
  stage and talk through the digest workflow with the stored artifacts.
- **Frontend down:** the whole pipeline is demonstrable via `curl`/httpie
  with JWT login (`POST /auth/login` with JSON `{"email", "password"}`),
  `GET /terraform/{project_id}`, and the plan/approve endpoints.
- **Database down:** show the migration reproducibility: a fresh database +
  `alembic upgrade head` rebuilds the schema, then restart.
