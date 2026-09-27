import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import {
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
  IconCheckCircle,
  IconAlertCircle,
  IconPlay,
  IconShield,
  IconNetwork,
  IconServer,
  IconDatabase,
} from "../components/Icons"

const API_BASE_URL = "http://localhost:8000"

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
  project_name: string
  success: boolean
  plan_output: string
  plan_error: string
  artifact_id?: number
  project_id?: number
  status?: string
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

function AIInfrastructure() {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const numericProjectId = Number(projectId)

  // State
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

  // Generate Architecture
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

  // Generate Terraform
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

  // Validate Terraform
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

  // Stage Terraform
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

  // Plan Terraform
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

  // Approve Terraform
  async function handleApproveTerraform() {
    if (!numericProjectId) {
      setApprovalError("Invalid project ID.")
      return
    }
    if (!stageResult) {
      setApprovalError("Terraform must be staged before approval.")
      return
    }
    if (!terraformPlan?.success) {
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

  // Deploy Terraform
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
    if (!terraformPlan?.success) {
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

  // Calculate current workflow step
  const currentStep: WorkflowStepId = deploymentResult
    ? "deploy"
    : approvalResult?.status === "approved"
      ? "deploy"
      : terraformPlan?.success
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
  if (terraformPlan?.success) completedSteps.push("plan")
  if (approvalResult?.status === "approved") completedSteps.push("approve")
  if (deploymentResult?.success) completedSteps.push("deploy")

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
        {/* Back Link */}
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
        <div className="mb-8">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">
              Autonomous Cloud Ops
            </span>
            <span className="text-slate-300 dark:text-[#232b36]">•</span>
            <span className="font-mono text-xs text-slate-500 dark:text-[#657385]">
              Natural Language to IaC
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            AI Infrastructure Builder
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-slate-500 dark:text-[#8090a2]">
            Describe desired cloud architecture in plain language. CloudForge AI generates verified topology, outputs production-ready Terraform, and coordinates the controlled stage-plan-approve pipeline.
          </p>
        </div>

        {/* Prompt Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-[#1c222b] dark:bg-[#080b0f]">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                Step 1: Architecture Prompt
              </span>
              <h2 className="mt-0.5 text-base font-semibold text-slate-900 dark:text-white">
                Describe Target Architecture
              </h2>
            </div>
            <span className="flex items-center gap-1 rounded-full border border-teal-500/20 bg-teal-500/10 px-2.5 py-0.5 font-mono text-[9px] font-bold text-teal-600 dark:border-teal-400/20 dark:bg-teal-400/10 dark:text-teal-300">
              <IconAI className="h-3 w-3" />
              <span>OLLAMA ENGINE</span>
            </span>
          </div>

          {/* Quick Example Chips */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-400 dark:text-[#525e6e]">
              Try template:
            </span>
            {[
              "3-tier AWS web app with VPC and RDS PostgreSQL",
              "Serverless REST API with DynamoDB & public subnet",
              "Production Docker container cluster with private VPC",
            ].map((template) => (
              <button
                key={template}
                type="button"
                onClick={() => setRequest(template)}
                className="rounded-md border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-[11px] text-slate-600 transition hover:border-teal-500/40 hover:bg-slate-100 hover:text-teal-700 dark:border-[#1e2531] dark:bg-[#0d1117] dark:text-[#768597] dark:hover:border-teal-400/40 dark:hover:text-teal-300"
              >
                {template}
              </button>
            ))}
          </div>

          <textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            rows={4}
            placeholder="e.g. Create an AWS infrastructure for a high-availability Node.js backend with an RDS PostgreSQL database and a private VPC subnet."
            className="mt-4 w-full resize-none rounded-xl border border-slate-300 bg-white p-4 text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:border-[#222a36] dark:bg-[#05070a] dark:text-slate-100 dark:placeholder:text-[#424e5e] dark:focus:border-teal-400 dark:focus:ring-teal-400/30"
          />

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
              <IconAlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100 dark:border-[#141a22]">
            <span className="text-[11px] text-slate-400 dark:text-[#525e6e]">
              Press generate to synthesize architecture model
            </span>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !request.trim()}
              className="flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-50 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
            >
              {loading ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span>Synthesizing Architecture...</span>
                </>
              ) : (
                <>
                  <IconAI className="h-4 w-4" />
                  <span>Generate Architecture</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Step 2: Architecture Result */}
        {plan && (
          <div className="mt-8 space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1c222b] dark:bg-[#080b0f]">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                    Step 2: AI Result
                  </span>
                  <h2 className="mt-0.5 text-base font-semibold text-slate-900 dark:text-white">
                    Synthesized Architecture Model
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 dark:border-[#1e2531] dark:text-slate-400 dark:hover:bg-[#12161f]"
                >
                  {showRawJson ? "Hide JSON" : "View Raw JSON"}
                </button>
              </div>

              {/* Topology Components Grid */}
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                {/* Network */}
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-[#171e27] dark:bg-[#0c1015]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Network Tier
                    </span>
                    <IconNetwork className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div className="mt-3 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400 dark:text-[#768597]">VPC</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {plan.architecture.network.vpc ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 dark:text-[#768597]">Public Subnets</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">
                        {plan.architecture.network.public_subnets}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 dark:text-[#768597]">Private Subnets</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">
                        {plan.architecture.network.private_subnets}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Compute */}
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-[#171e27] dark:bg-[#0c1015]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Compute Tier
                    </span>
                    <IconServer className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div className="mt-3 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400 dark:text-[#768597]">Service</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {plan.architecture.compute.service}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 dark:text-[#768597]">Instances</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">
                        {plan.architecture.compute.count}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 dark:text-[#768597]">Region</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">
                        {plan.region}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Database */}
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-[#171e27] dark:bg-[#0c1015]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Database Tier
                    </span>
                    <IconDatabase className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div className="mt-3 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400 dark:text-[#768597]">Service</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {plan.architecture.database.service}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 dark:text-[#768597]">Engine</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {plan.architecture.database.engine}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 dark:text-[#768597]">Environment</span>
                      <span className="capitalize text-slate-800 dark:text-slate-200">
                        {plan.environment}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Raw JSON toggle container */}
              {showRawJson && (
                <div className="mt-5">
                  <pre className="max-h-[300px] overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200 dark:border-[#1e2531] dark:bg-[#05070a]">
                    {JSON.stringify(plan, null, 2)}
                  </pre>
                </div>
              )}

              {/* Terraform Generator Action */}
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-slate-100 dark:border-[#141a22]">
                <p className="text-xs text-slate-500 dark:text-[#768597]">
                  Next step: Compile verified architecture into HCL Terraform source files.
                </p>

                <button
                  type="button"
                  onClick={handleGenerateTerraform}
                  disabled={terraformLoading}
                  className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-50 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
                >
                  {terraformLoading ? (
                    <>
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      <span>Synthesizing Terraform...</span>
                    </>
                  ) : (
                    <>
                      <IconPlay className="h-3 w-3" />
                      <span>Compile Terraform Code</span>
                    </>
                  )}
                </button>
              </div>

              {terraformError && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
                  <IconAlertCircle className="h-4 w-4 shrink-0" />
                  <span>{terraformError}</span>
                </div>
              )}
            </div>

            {/* Step 3: Terraform IDE Code Preview */}
            {terraform && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                      Step 3: Terraform Source Code
                    </span>
                    <span className="font-mono text-[11px] text-slate-400 dark:text-[#525e6e]">
                      Generated Files: main.tf, variables.tf, outputs.tf
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

                {/* Step 4: Validation Gate */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1c222b] dark:bg-[#080b0f]">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                        Step 4: Quality & Validation Gate
                      </span>
                      <h3 className="mt-0.5 text-base font-semibold text-slate-900 dark:text-white">
                        Terraform Syntax & Rule Verification
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-[#768597]">
                        Validate provider schemas and code format without executing any infrastructure changes.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleValidateTerraform}
                      disabled={validationLoading}
                      className="flex items-center gap-1.5 rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-2 text-xs font-semibold text-teal-600 transition hover:bg-teal-500/20 disabled:opacity-50 dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-300"
                    >
                      {validationLoading ? (
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
                  </div>

                  {validationError && (
                    <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
                      <IconAlertCircle className="h-4 w-4 shrink-0" />
                      <span>{validationError}</span>
                    </div>
                  )}

                  {validation && (
                    <div className="mt-5 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div
                          className={`rounded-xl border p-4 ${
                            validation.valid
                              ? "border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10"
                              : "border-red-500/20 bg-red-500/5 dark:bg-red-500/10"
                          }`}
                        >
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                            Schema Validation
                          </span>
                          <p
                            className={`mt-1 font-semibold ${
                              validation.valid ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
                            }`}
                          >
                            {validation.valid ? "✓ Configuration is valid" : "✕ Validation failed"}
                          </p>
                        </div>

                        <div
                          className={`rounded-xl border p-4 ${
                            validation.formatted
                              ? "border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10"
                              : "border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10"
                          }`}
                        >
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                            Code Formatting
                          </span>
                          <p
                            className={`mt-1 font-semibold ${
                              validation.formatted ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {validation.formatted ? "✓ Canonical format" : "⚠ Formatting required"}
                          </p>
                        </div>
                      </div>

                      {(validation.validation_output || validation.validation_error) && (
                        <pre className="overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800 dark:border-[#1e2531] dark:bg-[#06080b] dark:text-slate-200">
                          {validation.validation_output || validation.validation_error}
                        </pre>
                      )}
                    </div>
                  )}

                  {/* Step 5: Stage Artifact */}
                  {validation?.valid && (
                    <div className="mt-6 border-t border-slate-200/80 pt-6 dark:border-[#171e27]">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                            Step 5: Staging Gate
                          </span>
                          <h4 className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
                            Stage Terraform Artifact
                          </h4>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-[#768597]">
                            Persist the validated configuration as an immutable artifact ready for plan and human approval.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={handleStageTerraform}
                          disabled={stageLoading || stageResult !== null}
                          className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-50 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
                        >
                          {stageLoading ? (
                            <>
                              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              <span>Staging Artifact...</span>
                            </>
                          ) : stageResult ? (
                            <span>✓ Artifact Staged</span>
                          ) : (
                            <span>Stage Terraform Artifact</span>
                          )}
                        </button>
                      </div>

                      {stageError && (
                        <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
                          <IconAlertCircle className="h-4 w-4 shrink-0" />
                          <span>{stageError}</span>
                        </div>
                      )}

                      {stageResult && (
                        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 dark:bg-emerald-500/10">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              ✓ Artifact successfully staged
                            </span>
                            <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
                              ARTIFACT #{stageResult.id}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                            {stageResult.message}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 6: Plan Staged Artifact */}
                  {stageResult && (
                    <div className="mt-6 border-t border-slate-200/80 pt-6 dark:border-[#171e27]">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                            Step 6: Plan Preview
                          </span>
                          <h4 className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
                            Generate Terraform Dry-Run Plan
                          </h4>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-[#768597]">
                            Compute the exact AWS resource differences and review planned additions before approval.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={handleGenerateTerraformPlan}
                          disabled={terraformPlanLoading}
                          className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-50 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
                        >
                          {terraformPlanLoading ? (
                            <>
                              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              <span>Generating Plan...</span>
                            </>
                          ) : (
                            <>
                              <IconPlay className="h-3 w-3" />
                              <span>Generate Execution Plan</span>
                            </>
                          )}
                        </button>
                      </div>

                      {terraformPlanError && (
                        <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
                          <IconAlertCircle className="h-4 w-4 shrink-0" />
                          <span>{terraformPlanError}</span>
                        </div>
                      )}

                      {terraformPlan && (
                        <div className="mt-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-900 dark:text-white">
                              {terraformPlan.project_name} — Execution Plan
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 font-mono text-[9px] font-bold ${
                                terraformPlan.success
                                  ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                  : "bg-red-500/20 text-red-700 dark:text-red-300"
                              }`}
                            >
                              {terraformPlan.success ? "PLAN READY" : "PLAN FAILED"}
                            </span>
                          </div>

                          {terraformPlan.plan_output && (
                            <pre className="max-h-[450px] overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200 dark:border-[#1e2531] dark:bg-[#040608]">
                              {terraformPlan.plan_output}
                            </pre>
                          )}

                          {terraformPlan.plan_error && (
                            <pre className="max-h-[300px] overflow-auto rounded-xl border border-red-500/20 bg-red-500/10 p-4 font-mono text-xs leading-relaxed text-red-400">
                              {terraformPlan.plan_error}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 7: Approval Gate */}
                  {terraformPlan?.success && stageResult && (
                    <div className="mt-6 border-t border-slate-200/80 pt-6 dark:border-[#171e27]">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                            Step 7: Governance Gate
                          </span>
                          <h4 className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
                            Review & Approve Terraform Artifact
                          </h4>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-[#768597]">
                            Authorizes the artifact for execution. Approval does not immediately trigger live AWS deployment.
                          </p>
                        </div>

                        {!approvalResult && (
                          <button
                            type="button"
                            onClick={handleApproveTerraform}
                            disabled={approvalLoading}
                            className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-50 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
                          >
                            {approvalLoading ? (
                              <>
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                <span>Approving...</span>
                              </>
                            ) : (
                              <>
                                <IconShield className="h-3.5 w-3.5" />
                                <span>Approve Artifact</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {approvalError && (
                        <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
                          <IconAlertCircle className="h-4 w-4 shrink-0" />
                          <span>{approvalError}</span>
                        </div>
                      )}

                      {approvalResult && (
                        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 dark:bg-emerald-500/10">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              ✓ Artifact #{approvalResult.artifact_id} Approved
                            </span>
                            <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
                              APPROVED
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                            {approvalResult.message}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 8: Deployment Final Stage */}
                  {approvalResult?.status === "approved" && (
                    <div className="mt-6 border-t border-slate-200/80 pt-6 dark:border-[#171e27]">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                            Step 8: Cloud Deployment
                          </span>
                          <h4 className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
                            Execute Terraform Apply
                          </h4>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-[#768597]">
                            Runs terraform apply against the approved artifact to provision real cloud resources.
                          </p>
                        </div>

                        {!deploymentResult && (
                          <button
                            type="button"
                            onClick={handleDeployTerraform}
                            disabled={deploymentLoading}
                            className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-50 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
                          >
                            {deploymentLoading ? (
                              <>
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                <span>Deploying Infrastructure...</span>
                              </>
                            ) : (
                              <span>Deploy Infrastructure</span>
                            )}
                          </button>
                        )}
                      </div>

                      <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
                        Notice: Terraform apply interacts with your configured cloud account and provisions real resources.
                      </div>

                      {deploymentError && (
                        <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
                          <IconAlertCircle className="h-4 w-4 shrink-0" />
                          <span>{deploymentError}</span>
                        </div>
                      )}

                      {deploymentResult && (
                        <div className="mt-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-900 dark:text-white">
                              {deploymentResult.success ? "✓ Deployment Succeeded" : "✕ Deployment Failed"}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 font-mono text-[9px] font-bold ${
                                deploymentResult.success
                                  ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                  : "bg-red-500/20 text-red-700 dark:text-red-300"
                              }`}
                            >
                              {deploymentResult.status.toUpperCase()}
                            </span>
                          </div>

                          {deploymentResult.apply_output && (
                            <pre className="max-h-[450px] overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200 dark:border-[#1e2531] dark:bg-[#040608]">
                              {deploymentResult.apply_output}
                            </pre>
                          )}

                          {deploymentResult.apply_error && (
                            <pre className="max-h-[300px] overflow-auto rounded-xl border border-red-500/20 bg-red-500/10 p-4 font-mono text-xs leading-relaxed text-red-400">
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