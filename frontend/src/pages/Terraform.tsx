import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import {
  generateTerraform,
  validateTerraform,
  planTerraform,
} from "../services/api"
import { Navbar } from "../components/Navbar"
import { CodeViewer } from "../components/CodeViewer"
import { WorkflowStepper } from "../components/WorkflowStepper"
import type { WorkflowStepId } from "../components/WorkflowStepper"
import {
  IconArrowLeft,
  IconFileCode,
  IconCheckCircle,
  IconAlertCircle,
  IconPlay,
} from "../components/Icons"

interface TerraformResponse {
  project_id: number
  project_name: string
  cloud_provider: string
  region: string
  environment: string
  files: {
    "main.tf": string
    "variables.tf": string
    "outputs.tf": string
  }
}

interface ValidationResponse {
  project_id: number
  project_name: string
  valid: boolean
  formatted: boolean
  format_output: string
  format_error: string
  validation_output: string
  validation_error: string
}

interface PlanResponse {
  project_id: number
  project_name: string
  success: boolean
  plan_output: string
  plan_error: string
}

type TerraformFile = "main.tf" | "variables.tf" | "outputs.tf"

function Terraform() {
  const { projectId } = useParams()
  const navigate = useNavigate()

  const [terraform, setTerraform] = useState<TerraformResponse | null>(null)
  const [activeFile, setActiveFile] = useState<TerraformFile>("main.tf")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [validation, setValidation] = useState<ValidationResponse | null>(null)
  const [validating, setValidating] = useState(false)

  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [planning, setPlanning] = useState(false)

  async function handleGenerateTerraform() {
    if (!projectId) {
      setError("Project ID is missing")
      return
    }

    try {
      setLoading(true)
      setError("")
      setValidation(null)
      setPlan(null)

      const data = await generateTerraform(Number(projectId))
      setTerraform(data)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Failed to generate Terraform")
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleValidateTerraform() {
    if (!projectId) {
      setError("Project ID is missing")
      return
    }

    try {
      setValidating(true)
      setError("")

      const data = await validateTerraform(Number(projectId))
      setValidation(data)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Failed to validate Terraform")
      }
    } finally {
      setValidating(false)
    }
  }

  async function handlePlanTerraform() {
    if (!projectId) {
      setError("Project ID is missing")
      return
    }

    try {
      setPlanning(true)
      setError("")
      setPlan(null)

      const data = await planTerraform(Number(projectId))
      setPlan(data)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Failed to generate Terraform plan")
      }
    } finally {
      setPlanning(false)
    }
  }

  // Calculate workflow stage
  const currentStep: WorkflowStepId = plan
    ? "approve"
    : validation
      ? "plan"
      : terraform
        ? "validate"
        : "generate"

  const completedSteps: WorkflowStepId[] = []
  if (terraform) completedSteps.push("generate")
  if (validation?.valid) completedSteps.push("validate")
  if (plan?.success) completedSteps.push("plan")

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-[#030507] dark:text-slate-100">
      {/* Top Navbar */}
      <Navbar
        breadcrumbs={[
          { label: "Console", href: "/dashboard" },
          { label: "Projects", href: `/projects/${projectId}` },
          { label: "Terraform IaC" },
        ]}
      />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Back navigation */}
        <button
          type="button"
          onClick={() => navigate(`/projects/${projectId}`)}
          className="mb-6 flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-900 dark:text-[#768597] dark:hover:text-slate-200"
        >
          <IconArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Project Workspace</span>
        </button>

        {/* Workflow Stepper */}
        <div className="mb-8">
          <WorkflowStepper
            currentStep={currentStep}
            completedSteps={completedSteps}
          />
        </div>

        {/* Page Header */}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">
                Infrastructure as Code
              </span>
              <span className="text-slate-300 dark:text-[#232b36]">•</span>
              <span className="font-mono text-xs text-slate-500 dark:text-[#657385]">
                Terraform Engine
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              Terraform Generator
            </h1>
            <p className="mt-1 max-w-2xl text-xs text-slate-500 dark:text-[#8090a2]">
              Generate, format, validate, and plan Terraform configuration files from your CloudForge architecture specification.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleGenerateTerraform}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-50 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
            >
              {loading ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span>Generating Terraform...</span>
                </>
              ) : (
                <>
                  <IconFileCode className="h-4 w-4" />
                  <span>{terraform ? "Regenerate Terraform" : "Generate Terraform"}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mt-6 flex items-center gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-600 dark:text-red-400">
            <IconAlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Infrastructure Metadata Strip */}
        {terraform && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#1c222b] dark:bg-[#080b0f]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                Project
              </span>
              <p className="mt-1 font-semibold text-slate-900 dark:text-white truncate">
                {terraform.project_name}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#1c222b] dark:bg-[#080b0f]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                Cloud Provider
              </span>
              <p className="mt-1 font-semibold text-teal-600 dark:text-teal-400">
                {terraform.cloud_provider}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#1c222b] dark:bg-[#080b0f]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                Region
              </span>
              <p className="mt-1 font-mono font-semibold text-slate-900 dark:text-white">
                {terraform.region}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#1c222b] dark:bg-[#080b0f]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                Environment
              </span>
              <p className="mt-1 capitalize font-semibold text-slate-900 dark:text-white">
                {terraform.environment}
              </p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!terraform && !loading && (
          <div className="mt-8 flex min-h-[380px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm dark:border-[#222a36] dark:bg-[#080b0f]">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 ring-1 ring-teal-500/30 dark:bg-teal-400/10 dark:text-teal-400">
              <IconFileCode className="h-6 w-6" />
            </div>

            <h2 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">
              Terraform files not generated yet
            </h2>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500 dark:text-[#768597]">
              Synthesize deterministic HCL configuration code from the infrastructure specifications saved in this project.
            </p>

            <button
              type="button"
              onClick={handleGenerateTerraform}
              className="mt-6 flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-500 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
            >
              <IconFileCode className="h-4 w-4" />
              <span>Generate Terraform</span>
            </button>
          </div>
        )}

        {/* Code Preview Section */}
        {terraform && (
          <div className="mt-8 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                  Terraform Source Code
                </span>
                <span className="font-mono text-[11px] text-slate-400 dark:text-[#525e6e]">
                  Target: {terraform.cloud_provider} • {terraform.region}
                </span>
              </div>

              <CodeViewer
                files={terraform.files}
                activeFile={activeFile}
                onSelectFile={(f) => setActiveFile(f as TerraformFile)}
                maxHeight="480px"
                title={`${terraform.project_name} / terraform`}
              />
            </div>

            {/* Validation & Plan Action Bar */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1c222b] dark:bg-[#080b0f]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                    Quality Gate
                  </span>
                  <h2 className="mt-0.5 text-base font-semibold text-slate-900 dark:text-white">
                    Validate & Plan Configuration
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-[#768597]">
                    Execute syntax formatting, semantic validation, and dry-run change calculation without applying changes to AWS.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleValidateTerraform}
                    disabled={validating}
                    className="flex items-center gap-1.5 rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-2 text-xs font-semibold text-teal-600 transition hover:bg-teal-500/20 disabled:opacity-50 dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-300"
                  >
                    {validating ? (
                      <>
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        <span>Validating...</span>
                      </>
                    ) : (
                      <>
                        <IconCheckCircle className="h-3.5 w-3.5" />
                        <span>Validate Terraform</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handlePlanTerraform}
                    disabled={planning}
                    className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-50 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
                  >
                    {planning ? (
                      <>
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        <span>Generating Plan...</span>
                      </>
                    ) : (
                      <>
                        <IconPlay className="h-3 w-3" />
                        <span>Preview Execution Plan</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Validation Result Box */}
              {validation && (
                <div className="mt-6 border-t border-slate-200/80 pt-6 dark:border-[#171e27]">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div
                      className={`flex items-center justify-between rounded-xl border p-4 ${
                        validation.valid
                          ? "border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10"
                          : "border-red-500/20 bg-red-500/5 dark:bg-red-500/10"
                      }`}
                    >
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                          Validation Check
                        </span>
                        <p
                          className={`mt-1 font-semibold ${
                            validation.valid ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
                          }`}
                        >
                          {validation.valid ? "✓ Configuration is valid" : "✕ Configuration is invalid"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-mono text-[9px] font-bold ${
                          validation.valid
                            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                            : "bg-red-500/20 text-red-700 dark:text-red-300"
                        }`}
                      >
                        {validation.valid ? "PASSED" : "FAILED"}
                      </span>
                    </div>

                    <div
                      className={`flex items-center justify-between rounded-xl border p-4 ${
                        validation.formatted
                          ? "border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10"
                          : "border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10"
                      }`}
                    >
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                          Format Check
                        </span>
                        <p
                          className={`mt-1 font-semibold ${
                            validation.formatted ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {validation.formatted ? "✓ Canonical HCL formatting" : "⚠ Formatting required"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-mono text-[9px] font-bold ${
                          validation.formatted
                            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                            : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        {validation.formatted ? "CANONICAL" : "FORMAT NEEDED"}
                      </span>
                    </div>
                  </div>

                  {(validation.validation_output || validation.validation_error) && (
                    <div className="mt-4">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                        Validation Output Log
                      </p>
                      <pre className="overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800 dark:border-[#1e2531] dark:bg-[#06080b] dark:text-slate-200">
                        {validation.validation_output || validation.validation_error}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Execution Plan Box */}
              {plan && (
                <div className="mt-6 border-t border-slate-200/80 pt-6 dark:border-[#171e27]">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                        Dry Run Result
                      </span>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                        Terraform Execution Plan
                      </h3>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold ${
                        plan.success
                          ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
                      }`}
                    >
                      {plan.success ? "PLAN SUCCESSFUL" : "PLAN FAILED"}
                    </span>
                  </div>

                  <div className="mt-4">
                    <pre className="max-h-[500px] overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-5 font-mono text-xs leading-relaxed text-slate-200 dark:border-[#1e2531] dark:bg-[#040608]">
                      {plan.success ? plan.plan_output : plan.plan_error || "Plan execution failed."}
                    </pre>
                  </div>

                  {plan.success && (
                    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-xs dark:border-[#171e27] dark:bg-[#0c1015]">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        Dry-Run Verification Notice:
                      </span>
                      <p className="mt-1 text-slate-500 dark:text-[#768597]">
                        Terraform determined resource changes without modifying any cloud infrastructure. Resources marked with{" "}
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">+</span> would be provisioned when an approved Terraform apply is executed.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default Terraform