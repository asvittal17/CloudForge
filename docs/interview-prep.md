# CloudForge — Interview Preparation

Answers are grounded in the actual code, not fluff. Where a limitation exists,
it is stated plainly — interviewers reward honesty over deflection.

---

### Q1. Walk me through what happens when a user clicks "Deploy".

The route is authenticated (`get_current_user_id`), resolves the project
through `_get_owned_project` (owner_id filter; foreign projects 404 exactly
like missing ones, which also blocks IDOR), loads the artifact, and guards on
status `approved`. `applies_are_allowed()` is checked first — while the
kill switch `CLOUDFORGE_ALLOW_TERRAFORM_APPLY` is off the endpoint returns an
honest 403 and nothing else happens. Then saved-plan integrity is verified
(SHA-256 on disk vs `plan_sha256`), Checkov gates the pipeline, an atomic
conditional `UPDATE terraform_artifacts SET status='applying' WHERE id=? AND
project_id=? AND status='approved'` claims the artifact — a concurrent second
request loses and gets 409. `apply_saved_plan` re-checks the kill switch,
re-verifies the digest, takes the per-project lock, and runs
`terraform apply -input=false -no-color -lock=false approved.tfplan` — the
saved plan file, never a fresh plan. Success → `deployed`. Failure is
classified by whether the apply subprocess was actually in flight: it was
(ran and failed, was killed, or timed out) → the artifact becomes
`reconciliation_required`, because infrastructure may be partially changed
and nothing can prove a clean outcome — it must be reconciled, re-planned,
re-verified and re-approved before another apply. It provably never started
(gate disabled, init/config failure, digest refusal) → the artifact returns
to `approved` and the same plan stays retryable. Either way a
`terraform_apply` audit event records the real error.

### Q2. Why digest verification in three places (approve, router, applier)?

The invariant is "the plan a human reviewed is the plan that executes."
Checking during approve validates the artifact at approval time, at the router
it protects against files changed between approval and the request, and inside
the applier it is the last line of defense immediately before the subprocess.
Defense in depth is cheap here; one missed check is expensive.

### Q3. How do you prevent two concurrent applies on the same artifact?

Three layers: (1) an atomic conditional `UPDATE` in SQL — only one request's
`UPDATE` matches `status='approved'`; the loser's returns 0 rowcount and gets
a 409; (2) a per-project `threading.Lock` serializing applies within the
process; (3) the state machine itself. The lock uses a context manager, so an
exception inside the critical section still releases it — there's a regression
test that raises `RuntimeError` mid-apply and proves `lock.acquire(timeout=0)`
succeeds right after.

### Q4. What are the limitations of the local-state model?

`terraform init -backend=false` with a local state file in protected storage
gives no distributed locking, no state versioning, and — because the lock is
in-process — no multi-node serialization. That's why the README names the
explicit production prerequisite: a remote backend (e.g. S3 + DynamoDB) with
native locking. The code documents the limitation where the decision is made
rather than hiding it.

### Q5. Why fail-closed in the Checkov scanner, and what was the tricky bug?

Malformed or missing scanner output must never allow a scan to "pass" — the
parser validates the report structure and treats an unrecognizable one as a
scan failure, stopping the pipeline. The tricky defect was invoking Checkov
through the Windows `.cmd` shim (silent breakage) and trusting `passed_checks`
lists that newer Checkov runtimes may omit — fixed by invoking
`python -m checkov.main` with `sys.executable`, tolerating compact reports by
using Checkov's own summary counts, and still failing closed when required
data is absent. The version is pinned because an unpinned Checkov update
changed report shapes once already.

### Q6. What did the tests actually cover, and what's mocked vs real?

99 backend tests passing, including dedicated interrupted-apply
reconciliation regression tests (startup recovery, in-flight versus
pre-launch failure classification, blocked re-apply from
`reconciliation_required`, concurrent re-plan 409, and Checkov
summary-consistency failures). Real: Terraform CLI plan round-trips (plan file
created, digests match, `terraform show` reads it back — these skip when
Terraform is absent and never run apply), live Checkov report parsing.
Mocked/margin: subprocess env in apply tests (kill-switch behavior), DB
session chains in the endpoint unit tests. The distinction is explicit in the
test file structure so reviewers can tell them apart.

### Q7. How do migrations stay trustworthy?

The initial schema is a real migration (not an empty baseline), so a fresh
database plus `alembic upgrade head` reproduces the live schema exactly —
verified on a disposable database, then dropped. The plan-integrity columns
were a follow-up migration. Rule: verify schema changes against a fresh
cluster, not just the long-lived dev database.

### Q8. How is authentication implemented?

argon2 password hashing, JWT access tokens (python-jose) with expiry, and a
`get_current_user_id` dependency on every protected route. Roles (`user`/
`admin`) gate admin endpoints; admins can't demote themselves; disabling an
account blocks new logins. Registration always creates role `user` —
there's no path where a test or fixture silently re-enables or promotes
accounts in a live database.

### Q9. What would you do next with another week?

In priority order: route-level code splitting to clear the 512 kB bundle
 advisory; a `/metrics`-style endpoint for the audit log; remote-backend
 wiring behind an opt-in flag; property tests on the digest/claim race using
 real threads; running the CI workflow on GitHub and making it required for
 merges.

### Q10. What mistake in this project taught you the most?

Trusting tool output shape: Checkov's report schema changed out from under a
version pin that had never been validated against PyPI, and a `.cmd` shim
masked a broken entrypoint on Windows. The fix — verify the pin exists, invoke
the module directly, validate the report structure, fail closed — is now a
pattern I'd apply to any third-party integration, not just this one.

---

### One-line architecture summary for the opener

"CloudForge is a FastAPI/React control plane that turns natural language into
Terraform through local Ollama, then forces every change through
validate → Checkov → saved plan with SHA-256 identity → human approval >
gated apply, with an explicit kill switch so demo and CI environments can
never touch real cloud resources."
