import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import {
  API_BASE_URL,
  approveTerraform,
  applyTerraform,
  generateAITerraform,
  planStagedTerraform,
  stageTerraform,
} from "../services/api"
import { Navbar } from "../components/Navbar"
import { CodeViewer } from "../components/CodeViewer"
import { WorkflowStepper } from "../components/WorkflowStepper"
import type { WorkflowStepId } from "../components/WorkflowStepper"
import {
  IconArrowLeft,
  IconAI,
  IconCheck,
  IconCheckCircle,
  IconAlertCircle,
  IconAlertTriangle,
  IconPlay,
  IconShield,
  IconNetwork,
  IconServer,
  IconDatabase,
  IconTerminal,
} from "../components/Icons"

interface InfrastructurePlan {
  cloud_provider: string
  region: string
  environment: string

  architecture: {
    network: {
      vpc: boolean
      public_subnets: number
      private_subnets: number
    }

    compute: {
      service: string
      count: number
    }

    database: {
      service: string
      engine: string
    }
  }
}

interface TerraformResult {
  cloud_provider: string
  region: string
  environment: string
  architecture: InfrastructurePlan["architecture"]
  terraform: {
    "main.tf": string
    "variables.tf": string
    "outputs.tf": string
  }
}

interface TerraformValidationResult {
  valid: boolean
  formatted: boolean
  format_output: string
  format_error: string
  validation_output: string
  validation_error: string
}

interface TerraformPlanResult {
  artifact_id: number
  project_id: number
  project_name: string
  status: string
  // Explicit outcome from the backend: true EXACTLY when the plan was
  // generated AND persisted and the artifact reached plan_ready.
  // Never infer success from plan_output text (this used to be the
  // bug: the field existed here but the API omitted it, so it was
  // undefined and every success gate read falsy).
  success: boolean
  plan_output: string
  plan_error: string
  plan_sha256: string | null
  config_sha256: string | null
  planned_at: string | null
}

interface TerraformStageResult {
  id: number
  project_id: number
  status: string
  message: string
}

interface TerraformApprovalResult {
  artifact_id: number
  project_id: number
  project_name: string
  status: string
  message: string
}

interface TerraformDeploymentResult {
  artifact_id: number
  project_id: number
  project_name: string
  status: string
  success: boolean
  stage: string
  apply_output: string
  apply_error: string
}

type BannerTone = "error" | "success" | "warning" | "info"

const bannerStyles: Record<BannerTone, string> = {
  error:
    "border-red-500/25 bg-red-500/10 text-red-600 dark:border-red-500/30 dark:text-red-400",
  success:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:border-emerald-500/30 dark:text-emerald-400",
  warning:
    "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:border-amber-500/30 dark:text-amber-300",
  info:
    "border-teal-500/25 bg-teal-500/10 text-teal-700 dark:border-teal-500/30 dark:text-teal-300",
}

function Spinner({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <span
      className={`animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  )
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: BannerTone
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      role={tone === "error" || tone === "warning" ? "alert" : undefined}
      className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-xs leading-relaxed ${bannerStyles[tone]}`}
    >
      <span className="mt-px shrink-0">{icon}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function StatusPill({
  tone,
  children,
}: {
  tone: BannerTone
  children: React.ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[9px] font-bold tracking-wide ${bannerStyles[tone]}`}
    >
      {children}
    </span>
  )
}

function TierCard({
  icon,
  title,
  caption,
  children,
}: {
  icon: React.ReactNode
  title: string
  caption: string
  children: React.ReactNode
}) {
  return (
    <div className="group rounded-2xl border border-slate-200/80 bg-slate-50/40 p-5 transition-colors hover:border-teal-500/30 hover:bg-white dark:border-[#171e27] dark:bg-[#0c1015] dark:hover:border-teal-400/30 dark:hover:bg-[#0e1319]">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-teal-500/20 bg-teal-500/10 text-teal-500 dark:border-teal-400/20 dark:text-teal-400">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {title}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-[#5b6779]">
            {caption}
          </p>
        </div>
      </div>
      <dl className="mt-4 divide-y divide-slate-100 dark:divide-[#161d26]">
        {children}
      </dl>
    </div>
  )
}

function TierRow({
  label,
  value,
  mono = true,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <dt className="text-[11px] font-medium text-slate-400 dark:text-[#657385]">
        {label}
      </dt>
      <dd
        className={`truncate text-xs font-semibold text-slate-800 dark:text-slate-100 ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  )
}

function StepHeader({
  index,
  kicker,
  title,
  description,
  children,
}: {
  index: string
  kicker: string
  title: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-teal-500/20 bg-teal-500/10 font-mono text-[10px] font-bold text-teal-600 dark:border-teal-400/20 dark:text-teal-400">
          {index}
        </span>
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
            {kicker}
          </span>
          <h3 className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
            {title}
          </h3>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-[#768597]">
            {description}
          </p>
        </div>
      </div>
      {children}
    </div>
  )
}

function ActionButton({
  onClick,
  disabled,
  loading,
  loadingLabel,
  idleLabel,
  idleIcon,
  variant = "primary",
}: {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  loadingLabel: string
  idleLabel: React.ReactNode
  idleIcon?: React.ReactNode
  variant?: "primary" | "outline"
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 focus:ring-offset-white dark:focus:ring-offset-[#080b0f]"
  const primary =
    "bg-teal-600 text-white shadow-sm hover:bg-teal-500 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
  const outline =
    "border border-teal-500/30 bg-teal-500/10 text-teal-600 hover:bg-teal-500/20 dark:border-teal-400/30 dark:text-teal-300 dark:hover:bg-teal-400/20"

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${variant === "primary" ? primary : outline}`}
    >
      {loading ? (
        <>
          <Spinner />
          <span>{loadingLabel}</span>
        </>
      ) : (
        <>
          {idleIcon}
          {idleLabel}
        </>
      )}
    </button>
  )
}

function AIInfrastructure() {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const numericProjectId = Number(projectId)

  const [request, setRequest] = useState("")
  const [plan, setPlan] = useState<InfrastructurePlan | null>(null)
  const [terraform, setTerraform] = useState<TerraformResult | null>(null)

  const [loading, setLoading] = useState(false)
  const [terraformLoading, setTerraformLoading] = useState(false)
  const [validationLoading, setValidationLoading] = useState(false)
  const [stageLoading, setStageLoading] = useState(false)
  const [terraformPlanLoading, setTerraformPlanLoading] = useState(false)
  const [approvalLoading, setApprovalLoading] = useState(false)
  const [deploymentLoading, setDeploymentLoading] = useState(false)

  const [error, setError] = useState("")
  const [terraformError, setTerraformError] = useState("")
  const [validationError, setValidationError] = useState("")
  const [stageError, setStageError] = useState("")
  const [terraformPlanError, setTerraformPlanError] = useState("")
  const [approvalError, setApprovalError] = useState("")
  const [deploymentError, setDeploymentError] = useState("")

  const [validation, setValidation] = useState<TerraformValidationResult | null>(null)
  const [stageResult, setStageResult] = useState<TerraformStageResult | null>(null)
  const [terraformPlan, setTerraformPlan] = useState<TerraformPlanResult | null>(null)
  const [approvalResult, setApprovalResult] = useState<TerraformApprovalResult | null>(null)
  const [deploymentResult, setDeploymentResult] = useState<TerraformDeploymentResult | null>(null)

  const [activeFile, setActiveFile] = useState<"main.tf" | "variables.tf" | "outputs.tf">("main.tf")
  const [showRawJson, setShowRawJson] = useState(false)

  async function handleGenerate() {
    if (!request.trim()) {
      setError("Please describe the infrastructure you want to create.")
      return
    }

    try {
      setLoading(true)
      setError("")
      setTerraform(null)
      setTerraformError("")
      setValidation(null)
      setValidationError("")
      setStageResult(null)
      setStageError("")
      setTerraformPlan(null)
      setTerraformPlanError("")
      setApprovalResult(null)
      setApprovalError("")
      setDeploymentResult(null)
      setDeploymentError("")

      const token = localStorage.getItem("access_token")
      const response = await fetch(`${API_BASE_URL}/ai/infrastructure`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ request }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.detail || "Failed to generate infrastructure")
      }
      setPlan(data)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Failed to generate infrastructure")
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateTerraform() {
    if (!plan) return

    try {
      setTerraformLoading(true)
      setTerraformError("")
      setValidation(null)
      setValidationError("")
      setStageResult(null)
      setStageError("")
      setTerraformPlan(null)
      setTerraformPlanError("")
      setApprovalResult(null)
      setApprovalError("")
      setDeploymentResult(null)
      setDeploymentError("")

      const result = await generateAITerraform({
        cloud_provider: plan.cloud_provider,
        region: plan.region,
        environment: plan.environment,
        architecture: plan.architecture,
      })

      setTerraform(result)
    } catch (err) {
      if (err instanceof Error) {
        setTerraformError(err.message)
      } else {
        setTerraformError("Failed to generate Terraform")
      }
    } finally {
      setTerraformLoading(false)
    }
  }

  async function handleValidateTerraform() {
    if (!terraform) return

    try {
      setValidationLoading(true)
      setValidationError("")
      setValidation(null)
      setStageResult(null)
      setStageError("")
      setTerraformPlan(null)
      setTerraformPlanError("")
      setApprovalResult(null)
      setApprovalError("")
      setDeploymentResult(null)
      setDeploymentError("")

      const token = localStorage.getItem("access_token")
      const response = await fetch(`${API_BASE_URL}/ai/terraform/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ terraform: terraform.terraform }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.detail || "Failed to validate Terraform")
      }
      setValidation(data)
    } catch (err) {
      if (err instanceof Error) {
        setValidationError(err.message)
      } else {
        setValidationError("Failed to validate Terraform")
      }
    } finally {
      setValidationLoading(false)
    }
  }

  async function handleStageTerraform() {
    if (!terraform) return
    if (!numericProjectId) {
      setStageError("Invalid project ID.")
      return
    }
    if (!validation?.valid) {
      setStageError("Terraform must be valid before it can be staged.")
      return
    }

    try {
      setStageLoading(true)
      setStageError("")
      setStageResult(null)
      setApprovalResult(null)
      setApprovalError("")
      setDeploymentResult(null)
      setDeploymentError("")

      const result = await stageTerraform(numericProjectId, {
        main_tf: terraform.terraform["main.tf"],
        variables_tf: terraform.terraform["variables.tf"],
        outputs_tf: terraform.terraform["outputs.tf"],
      })
      setStageResult(result)
    } catch (err) {
      if (err instanceof Error) {
        setStageError(err.message)
      } else {
        setStageError("Failed to stage Terraform")
      }
    } finally {
      setStageLoading(false)
    }
  }

  async function handleGenerateTerraformPlan() {
    if (!numericProjectId) {
      setTerraformPlanError("Invalid project ID.")
      return
    }
    if (!stageResult) {
      setTerraformPlanError("Terraform must be staged before generating a plan.")
      return
    }

    try {
      setTerraformPlanLoading(true)
      setTerraformPlanError("")
      setTerraformPlan(null)

      const result = await planStagedTerraform(numericProjectId, stageResult.id)
      setTerraformPlan(result)
    } catch (err) {
      if (err instanceof Error) {
        setTerraformPlanError(err.message)
      } else {
        setTerraformPlanError("Failed to generate Terraform plan")
      }
    } finally {
      setTerraformPlanLoading(false)
    }
  }

  async function handleApproveTerraform() {
    if (!numericProjectId) {
      setApprovalError("Invalid project ID.")
      return
    }
    if (!stageResult) {
      setApprovalError("Terraform must be staged before approval.")
      return
    }
    if (!hasValidPlan) {
      setApprovalError("Terraform must have a successful plan before approval.")
      return
    }

    try {
      setApprovalLoading(true)
      setApprovalError("")
      setApprovalResult(null)

      const result = await approveTerraform(numericProjectId, stageResult.id)
      setApprovalResult(result)
    } catch (err) {
      if (err instanceof Error) {
        setApprovalError(err.message)
      } else {
        setApprovalError("Failed to approve Terraform")
      }
    } finally {
      setApprovalLoading(false)
    }
  }

  async function handleDeployTerraform() {
    if (!numericProjectId) {
      setDeploymentError("Invalid project ID.")
      return
    }
    if (!stageResult) {
      setDeploymentError("Terraform must be staged before deployment.")
      return
    }
    if (approvalResult?.status !== "approved") {
      setDeploymentError("Terraform must be approved before deployment.")
      return
    }
    if (!hasValidPlan) {
      setDeploymentError("Terraform must have a successful plan before deployment.")
      return
    }

    try {
      setDeploymentLoading(true)
      setDeploymentError("")
      setDeploymentResult(null)

      const result = await applyTerraform(numericProjectId, stageResult.id)
      setDeploymentResult(result)
    } catch (err) {
      if (err instanceof Error) {
        setDeploymentError(err.message)
      } else {
        setDeploymentError("Terraform deployment failed")
      }
    } finally {
      setDeploymentLoading(false)
    }
  }

  // A plan is only valid when the backend says the execution plan was
  // generated AND persisted (`success`) AND the artifact reached the
  // plan_ready state with fresh identity metadata. Rendering
  // "Plan Ready" from plan_output text alone would be dishonest.
  const hasValidPlan =
    terraformPlan?.success === true && terraformPlan.status === "plan_ready"

  const currentStep: WorkflowStepId = deploymentResult
    ? "deploy"
    : approvalResult?.status === "approved"
      ? "deploy"
      : hasValidPlan
        ? "approve"
        : stageResult
          ? "plan"
          : validation?.valid
            ? "stage"
            : terraform
              ? "validate"
              : "generate"

  const completedSteps: WorkflowStepId[] = []
  if (plan) completedSteps.push("generate")
  if (validation?.valid) completedSteps.push("validate")
  if (stageResult) completedSteps.push("stage")
  if (hasValidPlan) completedSteps.push("plan")
  if (approvalResult?.status === "approved") completedSteps.push("approve")
  if (deploymentResult?.success) completedSteps.push("deploy")

  const publicSubnets = plan?.architecture.network.public_subnets ?? 0
  const privateSubnets = plan?.architecture.network.private_subnets ?? 0
  const subnetTotal = publicSubnets + privateSubnets || 1
  const publicPct = Math.round((publicSubnets / subnetTotal) * 100)
  const privatePct = 100 - publicPct

  const templates = [
    "3-tier AWS web app with VPC and RDS PostgreSQL",
    "Serverless REST API with DynamoDB & public subnet",
    "Production Docker container cluster with private VPC",
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-[#030507] dark:text-slate-100">
      <Navbar
        breadcrumbs={[
          { label: "Console", href: "/dashboard" },
          { label: "Projects", href: `/projects/${projectId}` },
          { label: "AI Infrastructure" },
        ]}
      />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate(`/projects/${projectId}`)}
          className="mb-6 inline-flex items-center gap-1.5 rounded-md px-1 text-xs font-medium text-slate-500 transition hover:text-teal-600 dark:text-[#768597] dark:hover:text-teal-300"
        >
          <IconArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Project Workspace</span>
        </button>

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/25 bg-teal-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:border-teal-400/25 dark:text-teal-300">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                Autonomous Cloud Ops
              </span>
              <span className="hidden items-center gap-1.5 font-mono text-[11px] text-slate-400 sm:inline-flex dark:text-[#5b6779]">
                <IconTerminal className="h-3 w-3" />
                Natural Language → IaC
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              AI Infrastructure Builder
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-[#8090a2]">
              Describe your desired cloud architecture in plain language. CloudForge AI
              synthesizes a verified topology, outputs production-ready Terraform, and guides
              the controlled stage → plan → approve pipeline to deployment.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center dark:border-[#1c222b] dark:bg-[#080b0f]">
              <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">06</p>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#5b6779]">
                Pipeline
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center dark:border-[#1c222b] dark:bg-[#080b0f]">
              <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">Ollama</p>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#5b6779]">
                Engine
              </p>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <WorkflowStepper
            currentStep={currentStep}
            completedSteps={completedSteps}
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-[#1c222b] dark:bg-[#080b0f]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                <span className="h-1 w-1 rounded-full bg-teal-500" />
                Step 1 · Architecture Prompt
              </span>
              <h2 className="mt-1.5 text-base font-semibold text-slate-900 dark:text-white">
                Describe Target Architecture
              </h2>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-teal-500/20 bg-teal-500/10 px-2.5 py-1 font-mono text-[9px] font-bold text-teal-600 dark:border-teal-400/20 dark:text-teal-300">
              <IconAI className="h-3 w-3" />
              <span>Ollama Engine</span>
            </span>
          </div>

          <div className="mt-5">
            <div className="flex items-center gap-2 overflow-hidden rounded-xl border border-slate-300 bg-white transition focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/20 dark:border-[#222a36] dark:bg-[#05070a] dark:focus-within:border-teal-400 dark:focus-within:ring-teal-400/20">
              <textarea
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                rows={4}
                spellCheck={false}
                placeholder="e.g. Create an AWS infrastructure for a high-availability Node.js backend with an RDS PostgreSQL database and a private VPC subnet."
                className="min-h-[104px] w-full resize-none bg-transparent p-4 text-sm leading-relaxed text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-[#424e5e]"
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400 dark:text-[#525e6e]">
                Be specific about provider, region, tiers, and networking for best results.
              </span>
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-400 dark:text-[#525e6e]">
                {request.length.toLocaleString()} chars
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400 dark:text-[#525e6e]">
              <IconAI className="h-3.5 w-3.5 text-teal-500" />
              Try a template
            </span>
            {templates.map((template) => (
              <button
                key={template}
                type="button"
                onClick={() => setRequest(template)}
                className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-[11px] text-slate-600 transition hover:border-teal-500/40 hover:bg-teal-500/5 hover:text-teal-700 dark:border-[#1e2531] dark:bg-[#0d1117] dark:text-[#768597] dark:hover:border-teal-400/40 dark:hover:text-teal-300"
              >
                <span className="h-1 w-1 shrink-0 rounded-full bg-slate-300 transition group-hover:bg-teal-500 dark:bg-[#33404f]" />
                <span className="truncate">{template}</span>
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-5">
              <Banner tone="error" icon={<IconAlertCircle className="h-4 w-4" />}>
                {error}
              </Banner>
            </div>
          )}

          <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-[#141a22]">
            <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-[#525e6e]">
              <IconCheck className="h-3.5 w-3.5 text-teal-500" />
              <span>Synthesize an architecture model before compiling Terraform.</span>
            </div>

            <ActionButton
              onClick={handleGenerate}
              loading={loading}
              loadingLabel="Synthesizing Architecture..."
              idleLabel={
                <>
                  <IconAI className="h-4 w-4" />
                  <span>Generate Architecture</span>
                </>
              }
              disabled={!request.trim()}
            />
          </div>
        </div>

        {plan && (
          <div className="mt-8 space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1c222b] dark:bg-[#080b0f]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                    <span className="h-1 w-1 rounded-full bg-teal-500" />
                    Step 2 · AI Result
                  </span>
                  <h2 className="mt-1.5 text-base font-semibold text-slate-900 dark:text-white">
                    Synthesized Architecture Model
                  </h2>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <StatusPill tone="success">
                    <IconCheckCircle className="h-3 w-3" />
                    Generated
                  </StatusPill>
                  <button
                    type="button"
                    onClick={() => setShowRawJson(!showRawJson)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 dark:border-[#1e2531] dark:text-slate-400 dark:hover:bg-[#12161f]"
                  >
                    <IconTerminal className="h-3.5 w-3.5" />
                    {showRawJson ? "Hide JSON" : "View Raw JSON"}
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <TierCard
                  icon={<IconNetwork className="h-4 w-4" />}
                  title="Network Tier"
                  caption="Isolation & routing"
                >
                  <TierRow
                    label="VPC"
                    mono={false}
                    value={
                      <span
                        className={`inline-flex items-center gap-1 ${
                          plan.architecture.network.vpc
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-slate-400"
                        }`}
                      >
                        {plan.architecture.network.vpc ? (
                          <IconCheckCircle className="h-3.5 w-3.5" />
                        ) : (
                          <IconAlertCircle className="h-3.5 w-3.5" />
                        )}
                        {plan.architecture.network.vpc ? "Enabled" : "Disabled"}
                      </span>
                    }
                  />
                  <TierRow label="Public Subnets" value={publicSubnets} />
                  <TierRow label="Private Subnets" value={privateSubnets} />
                  <div className="pt-3">
                    <div className="mb-1.5 flex items-center justify-between text-[10px] font-medium text-slate-400 dark:text-[#5b6779]">
                      <span>Subnet split</span>
                      <span className="font-mono">
                        {publicPct}% / {privatePct}%
                      </span>
                    </div>
                    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-[#141a22]">
                      <div
                        className="bg-teal-500 transition-all"
                        style={{ width: `${publicPct}%` }}
                      />
                      <div
                        className="bg-cyan-400 transition-all"
                        style={{ width: `${privatePct}%` }}
                      />
                    </div>
                  </div>
                </TierCard>

                <TierCard
                  icon={<IconServer className="h-4 w-4" />}
                  title="Compute Tier"
                  caption="Workloads & scaling"
                >
                  <TierRow label="Service" mono={false} value={plan.architecture.compute.service} />
                  <TierRow label="Instances" value={plan.architecture.compute.count} />
                  <TierRow label="Region" value={plan.region} />
                  <TierRow
                    label="Provider"
                    value={plan.cloud_provider.toUpperCase()}
                  />
                </TierCard>

                <TierCard
                  icon={<IconDatabase className="h-4 w-4" />}
                  title="Database Tier"
                  caption="Persistence & storage"
                >
                  <TierRow label="Service" mono={false} value={plan.architecture.database.service} />
                  <TierRow label="Engine" value={plan.architecture.database.engine} />
                  <TierRow label="Environment" mono={false} value={plan.environment} />
                  <TierRow label="Region" value={plan.region} />
                </TierCard>
              </div>

              {showRawJson && (
                <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 dark:border-[#1e2531]">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:border-[#1e2531] dark:bg-[#0b0e13] dark:text-[#525e6e]">
                    Raw JSON
                  </div>
                  <pre className="max-h-[300px] overflow-auto bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200 dark:bg-[#05070a]">
                    {JSON.stringify(plan, null, 2)}
                  </pre>
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-[#141a22]">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#768597]">
                  <IconPlay className="h-3.5 w-3.5 text-teal-500" />
                  <span>Next: compile the verified architecture into HCL Terraform source files.</span>
                </div>

                <ActionButton
                  onClick={handleGenerateTerraform}
                  loading={terraformLoading}
                  loadingLabel="Synthesizing Terraform..."
                  idleLabel={
                    <>
                      <IconPlay className="h-3 w-3" />
                      <span>Compile Terraform Code</span>
                    </>
                  }
                />
              </div>

              {terraformError && (
                <div className="mt-4">
                  <Banner tone="error" icon={<IconAlertCircle className="h-4 w-4" />}>
                    {terraformError}
                  </Banner>
                </div>
              )}
            </div>

            {terraform && (
              <div className="space-y-6">
                <div>
                  <div className="mb-3 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                      Step 3 · Terraform Source Code
                    </span>
                    <span className="font-mono text-[11px] text-slate-400 dark:text-[#525e6e]">
                      main.tf · variables.tf · outputs.tf
                    </span>
                  </div>

                  <CodeViewer
                    files={terraform.terraform}
                    activeFile={activeFile}
                    onSelectFile={(f) => setActiveFile(f as "main.tf" | "variables.tf" | "outputs.tf")}
                    maxHeight="460px"
                    title="AI Synthesized Terraform"
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1c222b] dark:bg-[#080b0f]">
                  <StepHeader
                    index="04"
                    kicker="Quality & Validation Gate"
                    title="Terraform Syntax & Rule Verification"
                    description="Validate provider schemas and code format without executing any infrastructure changes."
                  >
                    <ActionButton
                      variant="outline"
                      onClick={handleValidateTerraform}
                      loading={validationLoading}
                      loadingLabel="Validating..."
                      idleLabel={
                        <>
                          <IconCheckCircle className="h-3.5 w-3.5" />
                          <span>Validate Terraform</span>
                        </>
                      }
                    />
                  </StepHeader>

                  {validationError && (
                    <div className="mt-4">
                      <Banner tone="error" icon={<IconAlertCircle className="h-4 w-4" />}>
                        {validationError}
                      </Banner>
                    </div>
                  )}

                  {validation && (
                    <div className="mt-5 space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div
                          className={`rounded-xl border p-4 ${
                            validation.valid
                              ? "border-emerald-500/20 bg-emerald-500/5 dark:border-emerald-500/25 dark:bg-emerald-500/10"
                              : "border-red-500/20 bg-red-500/5 dark:border-red-500/25 dark:bg-red-500/10"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                              Schema Validation
                            </span>
                            {validation.valid ? (
                              <StatusPill tone="success">
                                <IconCheck className="h-3 w-3" />
                                Passed
                              </StatusPill>
                            ) : (
                              <StatusPill tone="error">
                                <IconAlertCircle className="h-3 w-3" />
                                Failed
                              </StatusPill>
                            )}
                          </div>
                          <p
                            className={`mt-2 text-sm font-semibold ${
                              validation.valid
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {validation.valid
                              ? "Configuration is valid"
                              : "Validation failed"}
                          </p>
                        </div>

                        <div
                          className={`rounded-xl border p-4 ${
                            validation.formatted
                              ? "border-emerald-500/20 bg-emerald-500/5 dark:border-emerald-500/25 dark:bg-emerald-500/10"
                              : "border-amber-500/20 bg-amber-500/5 dark:border-amber-500/25 dark:bg-amber-500/10"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                              Code Formatting
                            </span>
                            {validation.formatted ? (
                              <StatusPill tone="success">
                                <IconCheck className="h-3 w-3" />
                                Canonical
                              </StatusPill>
                            ) : (
                              <StatusPill tone="warning">
                                <IconAlertTriangle className="h-3 w-3" />
                                Needs format
                              </StatusPill>
                            )}
                          </div>
                          <p
                            className={`mt-2 text-sm font-semibold ${
                              validation.formatted
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {validation.formatted
                              ? "Canonical format"
                              : "Formatting required"}
                          </p>
                        </div>
                      </div>

                      {(validation.validation_output || validation.validation_error) && (
                        <pre className="max-h-[300px] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800 dark:border-[#1e2531] dark:bg-[#06080b] dark:text-slate-200">
                          {validation.validation_output || validation.validation_error}
                        </pre>
                      )}
                    </div>
                  )}

                  {validation?.valid && (
                    <div className="mt-6 border-t border-slate-200/80 pt-6 dark:border-[#171e27]">
                      <StepHeader
                        index="05"
                        kicker="Staging Gate"
                        title="Stage Terraform Artifact"
                        description="Persist the validated configuration as an immutable artifact ready for plan and human approval."
                      >
                        <ActionButton
                          onClick={handleStageTerraform}
                          disabled={stageResult !== null}
                          loading={stageLoading}
                          loadingLabel="Staging Artifact..."
                          idleLabel={
                            stageResult ? (
                              <>
                                <IconCheck className="h-3.5 w-3.5" />
                                <span>Artifact Staged</span>
                              </>
                            ) : (
                              <span>Stage Terraform Artifact</span>
                            )
                          }
                        />
                      </StepHeader>

                      {stageError && (
                        <div className="mt-4">
                          <Banner tone="error" icon={<IconAlertCircle className="h-4 w-4" />}>
                            {stageError}
                          </Banner>
                        </div>
                      )}

                      {stageResult && (
                        <div className="mt-4">
                          <Banner
                            tone="success"
                            icon={<IconCheckCircle className="h-4 w-4" />}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold">
                                Artifact successfully staged
                              </span>
                              <span className="font-mono text-[10px] font-bold">
                                ARTIFACT #{stageResult.id}
                              </span>
                            </div>
                            <p className="mt-1 text-slate-600 dark:text-slate-300">
                              {stageResult.message}
                            </p>
                          </Banner>
                        </div>
                      )}
                    </div>
                  )}

                  {stageResult && (
                    <div className="mt-6 border-t border-slate-200/80 pt-6 dark:border-[#171e27]">
                      <StepHeader
                        index="06"
                        kicker="Plan Preview"
                        title="Generate Terraform Dry-Run Plan"
                        description="Compute the exact AWS resource differences and review planned additions before approval."
                      >
                        <ActionButton
                          onClick={handleGenerateTerraformPlan}
                          loading={terraformPlanLoading}
                          loadingLabel="Generating Plan..."
                          idleLabel={
                            <>
                              <IconPlay className="h-3 w-3" />
                              <span>Generate Execution Plan</span>
                            </>
                          }
                        />
                      </StepHeader>

                      {terraformPlanError && (
                        <div className="mt-4">
                          <Banner tone="error" icon={<IconAlertCircle className="h-4 w-4" />}>
                            {terraformPlanError}
                          </Banner>
                        </div>
                      )}

                      {terraformPlan && (
                        <div className="mt-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-900 dark:text-white">
                              {terraformPlan.project_name} — Execution Plan
                            </span>
                            {hasValidPlan ? (
                              <StatusPill tone="success">
                                <IconCheckCircle className="h-3 w-3" />
                                Plan Ready
                              </StatusPill>
                            ) : (
                              <StatusPill tone="error">
                                <IconAlertCircle className="h-3 w-3" />
                                Plan Failed
                              </StatusPill>
                            )}
                          </div>

                          {terraformPlan.plan_output && (
                            <pre className="max-h-[450px] overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200 dark:border-[#1e2531] dark:bg-[#040608]">
                              {terraformPlan.plan_output}
                            </pre>
                          )}

                          {terraformPlan.plan_error && (
                            <pre className="max-h-[300px] overflow-auto rounded-xl border border-red-500/25 bg-red-500/10 p-4 font-mono text-xs leading-relaxed text-red-400">
                              {terraformPlan.plan_error}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {hasValidPlan && stageResult && (
                    <div className="mt-6 border-t border-slate-200/80 pt-6 dark:border-[#171e27]">
                      <StepHeader
                        index="07"
                        kicker="Governance Gate"
                        title="Review & Approve Terraform Artifact"
                        description="Authorizes the artifact for execution. Approval does not immediately trigger live AWS deployment."
                      >
                        {!approvalResult && (
                          <ActionButton
                            onClick={handleApproveTerraform}
                            loading={approvalLoading}
                            loadingLabel="Approving..."
                            idleLabel={
                              <>
                                <IconShield className="h-3.5 w-3.5" />
                                <span>Approve Artifact</span>
                              </>
                            }
                          />
                        )}
                      </StepHeader>

                      {approvalError && (
                        <div className="mt-4">
                          <Banner tone="error" icon={<IconAlertCircle className="h-4 w-4" />}>
                            {approvalError}
                          </Banner>
                        </div>
                      )}

                      {approvalResult && (
                        <div className="mt-4">
                          <Banner
                            tone="success"
                            icon={<IconShield className="h-4 w-4" />}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold">
                                Artifact #{approvalResult.artifact_id} approved
                              </span>
                              <span className="font-mono text-[10px] font-bold">
                                APPROVED
                              </span>
                            </div>
                            <p className="mt-1 text-slate-600 dark:text-slate-300">
                              {approvalResult.message}
                            </p>
                          </Banner>
                        </div>
                      )}
                    </div>
                  )}

                  {approvalResult?.status === "approved" && (
                    <div className="mt-6 border-t border-slate-200/80 pt-6 dark:border-[#171e27]">
                      <StepHeader
                        index="08"
                        kicker="Cloud Deployment"
                        title="Execute Terraform Apply"
                        description="Runs terraform apply against the approved artifact to provision real cloud resources."
                      >
                        {!deploymentResult && (
                          <ActionButton
                            onClick={handleDeployTerraform}
                            loading={deploymentLoading}
                            loadingLabel="Deploying Infrastructure..."
                            idleLabel={
                              <>
                                <IconPlay className="h-3.5 w-3.5" />
                                <span>Deploy Infrastructure</span>
                              </>
                            }
                          />
                        )}
                      </StepHeader>

                      <div className="mt-4">
                        <Banner
                          tone="warning"
                          icon={<IconAlertTriangle className="h-4 w-4" />}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="min-w-0">
                              <p className="font-semibold">
                                Destructive action — provisions real cloud resources
                              </p>
                              <p className="mt-0.5 text-amber-700 dark:text-amber-300">
                                Terraform apply will interact with your configured cloud
                                account and can incur cost or modify production state. Verify
                                the plan above before continuing.
                              </p>
                            </div>
                          </div>
                        </Banner>
                      </div>

                      {deploymentError && (
                        <div className="mt-4">
                          <Banner tone="error" icon={<IconAlertCircle className="h-4 w-4" />}>
                            {deploymentError}
                          </Banner>
                        </div>
                      )}

                      {deploymentResult && (
                        <div className="mt-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-900 dark:text-white">
                              {deploymentResult.success
                                ? "Deployment succeeded"
                                : "Deployment failed"}
                            </span>
                            {deploymentResult.success ? (
                              <StatusPill tone="success">
                                <IconCheckCircle className="h-3 w-3" />
                                {deploymentResult.status.toUpperCase()}
                              </StatusPill>
                            ) : (
                              <StatusPill tone="error">
                                <IconAlertCircle className="h-3 w-3" />
                                {deploymentResult.status.toUpperCase()}
                              </StatusPill>
                            )}
                          </div>

                          {deploymentResult.apply_output && (
                            <pre className="max-h-[450px] overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200 dark:border-[#1e2531] dark:bg-[#040608]">
                              {deploymentResult.apply_output}
                            </pre>
                          )}

                          {deploymentResult.apply_error && (
                            <pre className="max-h-[300px] overflow-auto rounded-xl border border-red-500/25 bg-red-500/10 p-4 font-mono text-xs leading-relaxed text-red-400">
                              {deploymentResult.apply_error}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default AIInfrastructure
