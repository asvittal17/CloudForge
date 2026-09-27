import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import {
  approveTerraform,
  applyTerraform,
  generateAITerraform,
  planStagedTerraform,
  stageTerraform,
} from "../services/api"

const API_BASE_URL = "http://localhost:8000"


// ========================================
// Types
// ========================================

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


// ========================================
// Component
// ========================================

function AIInfrastructure() {
  const navigate = useNavigate()
  const { projectId } = useParams()

  const numericProjectId = Number(projectId)


  // ========================================
  // State
  // ========================================

  const [request, setRequest] = useState("")

  const [plan, setPlan] =
    useState<InfrastructurePlan | null>(null)

  const [terraform, setTerraform] =
    useState<TerraformResult | null>(null)

  const [loading, setLoading] =
    useState(false)

  const [terraformLoading, setTerraformLoading] =
    useState(false)

  const [validationLoading, setValidationLoading] =
    useState(false)

  const [stageLoading, setStageLoading] =
    useState(false)

  const [terraformPlanLoading, setTerraformPlanLoading] =
    useState(false)

  const [error, setError] =
    useState("")

  const [terraformError, setTerraformError] =
    useState("")

  const [validationError, setValidationError] =
    useState("")

  const [stageError, setStageError] =
    useState("")

  const [terraformPlanError, setTerraformPlanError] =
    useState("")

  const [validation, setValidation] =
    useState<TerraformValidationResult | null>(null)

  const [stageResult, setStageResult] =
    useState<TerraformStageResult | null>(null)

  const [terraformPlan, setTerraformPlan] =
    useState<TerraformPlanResult | null>(null)

  const [approvalLoading, setApprovalLoading] =
    useState(false)

  const [approvalError, setApprovalError] =
    useState("")

  const [approvalResult, setApprovalResult] =
    useState<TerraformApprovalResult | null>(null)

  const [deploymentLoading, setDeploymentLoading] =
    useState(false)

  const [deploymentError, setDeploymentError] =
    useState("")

  const [deploymentResult, setDeploymentResult] =
    useState<TerraformDeploymentResult | null>(null)

  const [activeFile, setActiveFile] =
    useState<
      "main.tf" |
      "variables.tf" |
      "outputs.tf"
    >("main.tf")


  // ========================================
  // Generate Architecture
  // ========================================

  async function handleGenerate() {
    if (!request.trim()) {
      setError(
        "Please describe the infrastructure you want to create."
      )
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

      const token =
        localStorage.getItem("access_token")

      const response = await fetch(
        `${API_BASE_URL}/ai/infrastructure`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },

          body: JSON.stringify({
            request: request,
          }),
        }
      )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.detail ||
          "Failed to generate infrastructure"
        )
      }

      setPlan(data)

    } catch (error) {

      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError(
          "Failed to generate infrastructure"
        )
      }

    } finally {
      setLoading(false)
    }
  }


  // ========================================
  // Generate Terraform From AI Plan
  // ========================================

  async function handleGenerateTerraform() {
    if (!plan) {
      return
    }

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

      const result =
        await generateAITerraform({
          cloud_provider:
            plan.cloud_provider,

          region:
            plan.region,

          environment:
            plan.environment,

          architecture:
            plan.architecture,
        })

      setTerraform(result)

    } catch (error) {

      if (error instanceof Error) {
        setTerraformError(
          error.message
        )
      } else {
        setTerraformError(
          "Failed to generate Terraform"
        )
      }

    } finally {
      setTerraformLoading(false)
    }
  }


  // ========================================
  // Validate Terraform
  // ========================================

  async function handleValidateTerraform() {
    if (!terraform) {
      return
    }

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

      const token =
        localStorage.getItem("access_token")

      const response = await fetch(
        `${API_BASE_URL}/ai/terraform/validate`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },

          body: JSON.stringify({
            terraform:
              terraform.terraform,
          }),
        }
      )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.detail ||
          "Failed to validate Terraform"
        )
      }

      setValidation(data)

    } catch (error) {

      if (error instanceof Error) {
        setValidationError(
          error.message
        )
      } else {
        setValidationError(
          "Failed to validate Terraform"
        )
      }

    } finally {
      setValidationLoading(false)
    }
  }


  // ========================================
  // Stage Terraform
  // ========================================

  async function handleStageTerraform() {
    if (!terraform) {
      return
    }

    if (!numericProjectId) {
      setStageError("Invalid project ID.")
      return
    }

    if (!validation?.valid) {
      setStageError(
        "Terraform must be valid before it can be staged."
      )
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

      const result =
        await stageTerraform(
          numericProjectId,
          {
            main_tf:
              terraform.terraform["main.tf"],

            variables_tf:
              terraform.terraform["variables.tf"],

            outputs_tf:
              terraform.terraform["outputs.tf"],
          }
        )

      setStageResult(result)

    } catch (error) {

      if (error instanceof Error) {
        setStageError(error.message)
      } else {
        setStageError(
          "Failed to stage Terraform"
        )
      }

    } finally {
      setStageLoading(false)
    }
  }


  // ========================================
  // Generate Terraform Plan
  // ========================================

  async function handleGenerateTerraformPlan() {

    if (!numericProjectId) {
      setTerraformPlanError(
        "Invalid project ID."
      )
      return
    }

    if (!stageResult) {
      setTerraformPlanError(
        "Terraform must be staged before generating a plan."
      )
      return
    }

    try {
      setTerraformPlanLoading(true)

      setTerraformPlanError("")
      setTerraformPlan(null)

      const result =
        await planStagedTerraform(
          numericProjectId,
          stageResult.id
        )

      setTerraformPlan(result)

    } catch (error) {

      if (error instanceof Error) {
        setTerraformPlanError(
          error.message
        )
      } else {
        setTerraformPlanError(
          "Failed to generate Terraform plan"
        )
      }

    } finally {
      setTerraformPlanLoading(false)
    }
  }


  // ========================================
  // Approve Terraform
  // ========================================

  async function handleApproveTerraform() {
    if (!numericProjectId) {
      setApprovalError("Invalid project ID.")
      return
    }

    if (!stageResult) {
      setApprovalError(
        "Terraform must be staged before approval."
      )
      return
    }

    if (!terraformPlan?.success) {
      setApprovalError(
        "Terraform must have a successful plan before approval."
      )
      return
    }

    try {
      setApprovalLoading(true)
      setApprovalError("")
      setApprovalResult(null)

      const result =
        await approveTerraform(
          numericProjectId,
          stageResult.id
        )

      setApprovalResult(result)

    } catch (error) {
      if (error instanceof Error) {
        setApprovalError(error.message)
      } else {
        setApprovalError(
          "Failed to approve Terraform"
        )
      }
    } finally {
      setApprovalLoading(false)
    }
  }


  // ========================================
  // Copy Terraform
  // ========================================

  async function handleCopyTerraform() {

    if (!terraform) {
      return
    }

    await navigator.clipboard.writeText(
      terraform.terraform[activeFile]
    )
  }


  // ========================================
  // Deploy Terraform
  // ========================================

  async function handleDeployTerraform() {
    if (!numericProjectId) {
      setDeploymentError("Invalid project ID.")
      return
    }

    if (!stageResult) {
      setDeploymentError(
        "Terraform must be staged before deployment."
      )
      return
    }

    if (approvalResult?.status !== "approved") {
      setDeploymentError(
        "Terraform must be approved before deployment."
      )
      return
    }

    if (!terraformPlan?.success) {
      setDeploymentError(
        "Terraform must have a successful plan before deployment."
      )
      return
    }

    try {
      setDeploymentLoading(true)
      setDeploymentError("")
      setDeploymentResult(null)

      const result = await applyTerraform(
        numericProjectId,
        stageResult.id
      )

      setDeploymentResult(result)
    } catch (error) {
      if (error instanceof Error) {
        setDeploymentError(error.message)
      } else {
        setDeploymentError(
          "Terraform deployment failed"
        )
      }
    } finally {
      setDeploymentLoading(false)
    }
  }


  // ========================================
  // UI
  // ========================================

  return (
    <div className="min-h-screen bg-[#0b0d0f] text-[#f3f7f6]">

      {/* ==================================
          Header
      ================================== */}

      <header className="border-b border-[#263035] bg-[#0f1214]">

        <div className="flex h-16 items-center justify-between px-8">

          <div className="flex items-center gap-3">

            <button
              type="button"
              onClick={() =>
                navigate("/dashboard")
              }
              className="text-sm text-[#8a9997] transition hover:text-[#28d7c5]"
            >
              ← Dashboard
            </button>

            <span className="text-[#263035]">
              /
            </span>

            <span className="text-sm font-medium">
              AI Infrastructure
            </span>

          </div>

          <div className="rounded-full border border-[#28d7c5]/20 bg-[#28d7c5]/5 px-3 py-1 text-xs font-medium text-[#28d7c5]">
            CloudForge AI
          </div>

        </div>

      </header>


      {/* ==================================
          Main
      ================================== */}

      <main className="mx-auto max-w-6xl px-6 py-10 lg:px-10">

        {/* Page Header */}

        <div className="mb-8">

          <p className="text-xs font-medium uppercase tracking-[0.15em] text-[#53605f]">
            AI-Powered Infrastructure
          </p>

          <h1 className="mt-2 text-3xl font-semibold">
            Infrastructure Generator
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8a9997]">
            Describe the cloud infrastructure you need
            in natural language. CloudForge AI will
            convert your request into a structured
            infrastructure architecture and Terraform
            configuration.
          </p>

        </div>


        {/* ==================================
            Request Card
        ================================== */}

        <div className="rounded-xl border border-[#263035] bg-[#121619] p-6">

          <p className="text-xs font-medium uppercase tracking-wider text-[#53605f]">
            Infrastructure Request
          </p>

          <h2 className="mt-1 text-lg font-semibold">
            Describe your architecture
          </h2>

          <textarea
            value={request}
            onChange={(event) =>
              setRequest(event.target.value)
            }
            placeholder="Example: Create an AWS infrastructure for a Node.js application with a PostgreSQL database."
            className="mt-5 min-h-[150px] w-full resize-y rounded-lg border border-[#263035] bg-[#0b0d0f] p-4 text-sm leading-6 text-[#f3f7f6] outline-none transition placeholder:text-[#53605f] focus:border-[#28d7c5]/50"
          />

          {error && (
            <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="mt-5 flex justify-end">

            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="rounded-lg bg-[#28d7c5] px-6 py-2.5 text-sm font-semibold text-[#0b0d0f] transition hover:bg-[#63e6be] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Generating Architecture..."
                : "✨ Generate Architecture"}
            </button>

          </div>

        </div>


        {/* ==================================
            Generated Architecture
        ================================== */}

        {plan && (

          <div className="mt-6">

            <div className="mb-4">

              <p className="text-xs font-medium uppercase tracking-wider text-[#53605f]">
                AI Result
              </p>

              <h2 className="mt-1 text-xl font-semibold">
                Generated Architecture
              </h2>

            </div>


            {/* Summary */}

            <div className="grid gap-4 md:grid-cols-3">

              <div className="rounded-xl border border-[#263035] bg-[#121619] p-5">

                <p className="text-xs uppercase tracking-wider text-[#53605f]">
                  Cloud Provider
                </p>

                <p className="mt-2 text-lg font-semibold text-[#28d7c5]">
                  {plan.cloud_provider}
                </p>

              </div>


              <div className="rounded-xl border border-[#263035] bg-[#121619] p-5">

                <p className="text-xs uppercase tracking-wider text-[#53605f]">
                  Region
                </p>

                <p className="mt-2 font-mono text-lg font-semibold">
                  {plan.region}
                </p>

              </div>


              <div className="rounded-xl border border-[#263035] bg-[#121619] p-5">

                <p className="text-xs uppercase tracking-wider text-[#53605f]">
                  Environment
                </p>

                <p className="mt-2 text-lg font-semibold">
                  {plan.environment}
                </p>

              </div>

            </div>


            {/* Architecture Components */}

            <div className="mt-4 grid gap-4 lg:grid-cols-3">

              {/* Network */}

              <div className="rounded-xl border border-[#263035] bg-[#121619] p-5">

                <div className="flex items-center justify-between">

                  <h3 className="font-semibold">
                    Network
                  </h3>

                  <span className="rounded-full bg-[#28d7c5]/10 px-2.5 py-1 text-xs text-[#28d7c5]">
                    VPC
                  </span>

                </div>

                <div className="mt-5 space-y-3 text-sm text-[#8a9997]">

                  <div className="flex justify-between">
                    <span>VPC</span>

                    <span className="font-medium text-[#f3f7f6]">
                      {plan.architecture.network.vpc
                        ? "Enabled"
                        : "Disabled"}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>Public Subnets</span>

                    <span className="font-medium text-[#f3f7f6]">
                      {plan.architecture.network.public_subnets}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>Private Subnets</span>

                    <span className="font-medium text-[#f3f7f6]">
                      {plan.architecture.network.private_subnets}
                    </span>
                  </div>

                </div>

              </div>


              {/* Compute */}

              <div className="rounded-xl border border-[#263035] bg-[#121619] p-5">

                <div className="flex items-center justify-between">

                  <h3 className="font-semibold">
                    Compute
                  </h3>

                  <span className="rounded-full bg-[#28d7c5]/10 px-2.5 py-1 text-xs text-[#28d7c5]">
                    Compute
                  </span>

                </div>

                <div className="mt-5 space-y-3 text-sm text-[#8a9997]">

                  <div className="flex justify-between">
                    <span>Service</span>

                    <span className="font-medium text-[#f3f7f6]">
                      {plan.architecture.compute.service}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>Instances</span>

                    <span className="font-medium text-[#f3f7f6]">
                      {plan.architecture.compute.count}
                    </span>
                  </div>

                </div>

              </div>


              {/* Database */}

              <div className="rounded-xl border border-[#263035] bg-[#121619] p-5">

                <div className="flex items-center justify-between">

                  <h3 className="font-semibold">
                    Database
                  </h3>

                  <span className="rounded-full bg-[#28d7c5]/10 px-2.5 py-1 text-xs text-[#28d7c5]">
                    Database
                  </span>

                </div>

                <div className="mt-5 space-y-3 text-sm text-[#8a9997]">

                  <div className="flex justify-between">
                    <span>Service</span>

                    <span className="font-medium text-[#f3f7f6]">
                      {plan.architecture.database.service}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>Engine</span>

                    <span className="font-medium text-[#f3f7f6]">
                      {plan.architecture.database.engine}
                    </span>
                  </div>

                </div>

              </div>

            </div>


            {/* ==================================
                Generate Terraform
            ================================== */}

            <div className="mt-6 rounded-xl border border-[#28d7c5]/20 bg-[#121619] p-6">

              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                <div>

                  <p className="text-xs font-medium uppercase tracking-wider text-[#53605f]">
                    Infrastructure as Code
                  </p>

                  <h2 className="mt-1 text-xl font-semibold">
                    Generate Terraform
                  </h2>

                  <p className="mt-2 text-sm text-[#8a9997]">
                    Convert the approved AI architecture into
                    deterministic Terraform configuration.
                  </p>

                </div>

                <button
                  type="button"
                  onClick={handleGenerateTerraform}
                  disabled={terraformLoading}
                  className="rounded-lg border border-[#28d7c5]/40 bg-[#28d7c5]/10 px-5 py-2.5 text-sm font-semibold text-[#28d7c5] transition hover:bg-[#28d7c5]/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {terraformLoading
                    ? "Generating Terraform..."
                    : "⚡ Generate Terraform"}
                </button>

              </div>

              {terraformError && (
                <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
                  {terraformError}
                </div>
              )}

            </div>


            {/* ==================================
                Terraform Output
            ================================== */}

            {terraform && (

              <div className="mt-6">

                <div className="mb-4">

                  <p className="text-xs font-medium uppercase tracking-wider text-[#53605f]">
                    Generated Infrastructure as Code
                  </p>

                  <h2 className="mt-1 text-xl font-semibold">
                    Terraform Configuration
                  </h2>

                </div>


                <div className="overflow-hidden rounded-xl border border-[#263035] bg-[#121619]">

                  {/* File Tabs */}

                  <div className="flex overflow-x-auto border-b border-[#263035]">

                    {(
                      [
                        "main.tf",
                        "variables.tf",
                        "outputs.tf",
                      ] as const
                    ).map((file) => (

                      <button
                        key={file}
                        type="button"
                        onClick={() =>
                          setActiveFile(file)
                        }
                        className={`border-r border-[#263035] px-5 py-3 text-sm font-medium transition ${
                          activeFile === file
                            ? "bg-[#28d7c5]/10 text-[#28d7c5]"
                            : "text-[#8a9997] hover:bg-[#0f1214] hover:text-[#f3f7f6]"
                        }`}
                      >
                        {file}
                      </button>

                    ))}

                  </div>


                  {/* Code Header */}

                  <div className="flex items-center justify-between border-b border-[#263035] px-5 py-3">

                    <span className="font-mono text-xs text-[#53605f]">
                      {activeFile}
                    </span>

                    <button
                      type="button"
                      onClick={handleCopyTerraform}
                      className="rounded-md border border-[#263035] px-3 py-1.5 text-xs text-[#8a9997] transition hover:border-[#28d7c5]/40 hover:text-[#28d7c5]"
                    >
                      Copy
                    </button>

                  </div>


                  {/* Code */}

                  <pre className="max-h-[650px] overflow-auto bg-[#0b0d0f] p-6 text-xs leading-6 text-[#c7d2d0]">

                    <code>
                      {terraform.terraform[activeFile]}
                    </code>

                  </pre>


                  {/* ==================================
                      Terraform Validation
                  ================================== */}

                  <div className="border-t border-[#263035] bg-[#0f1214] px-5 py-4">

                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                      <div>

                        <p className="text-sm font-medium">
                          Terraform Validation
                        </p>

                        <p className="mt-1 text-xs text-[#53605f]">
                          Check formatting and Terraform configuration validity.
                        </p>

                      </div>

                      <button
                        type="button"
                        onClick={handleValidateTerraform}
                        disabled={validationLoading}
                        className="rounded-lg bg-[#28d7c5] px-4 py-2 text-xs font-semibold text-[#0b0d0f] transition hover:bg-[#63e6be] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {validationLoading
                          ? "Validating..."
                          : "✓ Validate Terraform"}
                      </button>

                    </div>

                  </div>


                  {/* Validation Error */}

                  {validationError && (

                    <div className="border-t border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-400">

                      {validationError}

                    </div>

                  )}


                  {/* Validation Result */}

                  {validation && (

                    <div
                      className={`border-t px-5 py-4 ${
                        validation.valid
                          ? "border-[#28d7c5]/20 bg-[#28d7c5]/5"
                          : "border-red-500/20 bg-red-500/5"
                      }`}
                    >

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                        <div>

                          <p
                            className={`text-sm font-semibold ${
                              validation.valid
                                ? "text-[#28d7c5]"
                                : "text-red-400"
                            }`}
                          >
                            {validation.valid
                              ? "✓ Terraform configuration is valid"
                              : "✕ Terraform configuration is invalid"}
                          </p>

                          <p className="mt-1 text-xs text-[#8a9997]">

                            Formatting:{" "}

                            {validation.formatted
                              ? "Valid"
                              : "Needs formatting"}

                          </p>

                        </div>


                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            validation.valid
                              ? "bg-[#28d7c5]/10 text-[#28d7c5]"
                              : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {validation.valid
                            ? "VALID"
                            : "INVALID"}
                        </span>

                      </div>


                      {validation.validation_output && (

                        <pre className="mt-4 overflow-auto rounded-lg bg-[#0b0d0f] p-4 text-xs leading-6 text-[#c7d2d0]">
                          {validation.validation_output}
                        </pre>

                      )}


                      {validation.validation_error && (

                        <pre className="mt-4 overflow-auto rounded-lg bg-[#0b0d0f] p-4 text-xs leading-6 text-red-400">
                          {validation.validation_error}
                        </pre>

                      )}

                    </div>

                  )}


                  {/* ==================================
                      Stage Terraform
                  ================================== */}

                  {validation?.valid && (

                    <div className="border-t border-[#263035] bg-[#0f1214] px-5 py-5">

                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                        <div>

                          <p className="text-xs font-medium uppercase tracking-wider text-[#53605f]">
                            Terraform Artifact
                          </p>

                          <h3 className="mt-1 text-base font-semibold">
                            Stage Terraform
                          </h3>

                          <p className="mt-1 text-xs leading-5 text-[#53605f]">
                            Save this validated Terraform configuration
                            to the CloudForge project for the next
                            planning and approval stage.
                          </p>

                        </div>

                        <button
                          type="button"
                          onClick={handleStageTerraform}
                          disabled={
                            stageLoading ||
                            stageResult !== null
                          }
                          className="rounded-lg border border-[#28d7c5]/40 bg-[#28d7c5]/10 px-5 py-2.5 text-xs font-semibold text-[#28d7c5] transition hover:bg-[#28d7c5]/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {stageLoading
                            ? "Staging Terraform..."
                            : stageResult
                              ? "✓ Terraform Staged"
                              : "💾 Stage Terraform"}
                        </button>

                      </div>

                    </div>

                  )}


                  {/* Stage Error */}

                  {stageError && (

                    <div className="border-t border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-400">

                      {stageError}

                    </div>

                  )}


                  {/* Stage Result */}

                  {stageResult && (

                    <div className="border-t border-[#28d7c5]/20 bg-[#28d7c5]/5 px-5 py-5">

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                        <div>

                          <p className="text-sm font-semibold text-[#28d7c5]">
                            ✓ Terraform configuration staged successfully
                          </p>

                          <p className="mt-1 text-xs text-[#8a9997]">
                            Artifact ID:{" "}
                            <span className="font-mono text-[#f3f7f6]">
                              {stageResult.id}
                            </span>
                          </p>

                          <p className="mt-1 text-xs text-[#8a9997]">
                            Project ID:{" "}
                            <span className="font-mono text-[#f3f7f6]">
                              {stageResult.project_id}
                            </span>
                          </p>

                        </div>

                        <span className="rounded-full bg-[#28d7c5]/10 px-3 py-1 text-xs font-medium text-[#28d7c5]">
                          {stageResult.status.toUpperCase()}
                        </span>

                      </div>

                      <p className="mt-3 text-xs text-[#8a9997]">
                        {stageResult.message}
                      </p>

                    </div>

                  )}


                  {/* ==================================
                      Terraform Plan
                  ================================== */}

                  <div className="border-t border-[#263035] bg-[#0f1214] px-5 py-5">

                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                      <div>

                        <p className="text-xs font-medium uppercase tracking-wider text-[#53605f]">
                          Infrastructure Preview
                        </p>

                        <h3 className="mt-1 text-base font-semibold">
                          Terraform Plan
                        </h3>

                        <p className="mt-1 text-xs leading-5 text-[#53605f]">
                          Preview the staged infrastructure changes
                          Terraform intends to make before deployment.
                        </p>

                      </div>


                      <button
                        type="button"
                        onClick={handleGenerateTerraformPlan}
                        disabled={
                          terraformPlanLoading ||
                          !stageResult
                        }
                        className="rounded-lg border border-[#28d7c5]/40 bg-[#28d7c5]/10 px-5 py-2.5 text-xs font-semibold text-[#28d7c5] transition hover:bg-[#28d7c5]/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {terraformPlanLoading
                          ? "Generating Plan..."
                          : stageResult
                            ? "▶ Generate Terraform Plan"
                            : "Stage Terraform First"}
                      </button>

                    </div>

                  </div>


                  {/* Plan Error */}

                  {terraformPlanError && (

                    <div className="border-t border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-400">

                      {terraformPlanError}

                    </div>

                  )}


                  {/* Plan Result */}

                  {terraformPlan && (

                    <div
                      className={`border-t px-5 py-5 ${
                        terraformPlan.success
                          ? "border-[#28d7c5]/20 bg-[#28d7c5]/5"
                          : "border-red-500/20 bg-red-500/5"
                      }`}
                    >

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                        <div>

                          <p className="text-xs uppercase tracking-wider text-[#53605f]">
                            Project
                          </p>

                          <p className="mt-1 text-sm font-semibold">
                            {terraformPlan.project_name}
                          </p>

                          {terraformPlan.artifact_id && (
                            <p className="mt-1 text-xs text-[#8a9997]">
                              Terraform Artifact:{" "}
                              <span className="font-mono text-[#f3f7f6]">
                                #{terraformPlan.artifact_id}
                              </span>
                            </p>
                          )}

                        </div>


                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            terraformPlan.success
                              ? "bg-[#28d7c5]/10 text-[#28d7c5]"
                              : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {terraformPlan.success
                            ? "PLAN READY"
                            : "PLAN FAILED"}
                        </span>

                      </div>


                      {terraformPlan.plan_output && (

                        <div className="mt-5">

                          <div className="mb-2 flex items-center justify-between">

                            <p className="text-xs font-medium uppercase tracking-wider text-[#53605f]">
                              Terraform Execution Plan
                            </p>

                            <span className="text-xs text-[#53605f]">
                              No resources deployed
                            </span>

                          </div>

                          <pre className="max-h-[600px] overflow-auto rounded-lg bg-[#0b0d0f] p-5 text-xs leading-6 text-[#c7d2d0]">
                            {terraformPlan.plan_output}
                          </pre>

                        </div>

                      )}


                      {terraformPlan.plan_error && (

                        <pre className="mt-4 max-h-[400px] overflow-auto rounded-lg bg-[#0b0d0f] p-5 text-xs leading-6 text-red-400">
                          {terraformPlan.plan_error}
                        </pre>

                      )}

                    </div>

                  )}


                  {/* ==================================
                      Terraform Approval
                  ================================== */}

                  {terraformPlan?.success &&
                    stageResult &&
                    !approvalResult && (

                      <div className="border-t border-[#263035] bg-[#0f1214] px-5 py-5">

                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                          <div>

                            <p className="text-xs font-medium uppercase tracking-wider text-[#53605f]">
                              Deployment Approval
                            </p>

                            <h3 className="mt-1 text-base font-semibold">
                              Review Terraform Plan
                            </h3>

                            <p className="mt-1 max-w-2xl text-xs leading-5 text-[#53605f]">
                              Approve this Terraform artifact after reviewing
                              the execution plan. Approval does not deploy
                              infrastructure.
                            </p>

                          </div>

                          <button
                            type="button"
                            onClick={handleApproveTerraform}
                            disabled={approvalLoading}
                            className="rounded-lg bg-[#28d7c5] px-5 py-2.5 text-xs font-semibold text-[#0b0d0f] transition hover:bg-[#63e6be] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {approvalLoading
                              ? "Approving..."
                              : "✓ Approve Infrastructure"}
                          </button>

                        </div>

                      </div>

                    )}


                  {/* Approval Error */}

                  {approvalError && (

                    <div className="border-t border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-400">
                      {approvalError}
                    </div>

                  )}


                  {/* Approval Result */}

                  {approvalResult && (

                    <div className="border-t border-[#28d7c5]/20 bg-[#28d7c5]/5 px-5 py-5">

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                        <div>

                          <p className="text-sm font-semibold text-[#28d7c5]">
                            ✓ Infrastructure approved
                          </p>

                          <p className="mt-1 text-xs text-[#8a9997]">
                            Artifact ID:{" "}
                            <span className="font-mono text-[#f3f7f6]">
                              #{approvalResult.artifact_id}
                            </span>
                          </p>

                          <p className="mt-1 text-xs text-[#8a9997]">
                            Project:{" "}
                            <span className="font-medium text-[#f3f7f6]">
                              {approvalResult.project_name}
                            </span>
                          </p>

                          <p className="mt-1 text-xs text-[#8a9997]">
                            {approvalResult.message}
                          </p>

                        </div>

                        <span className="rounded-full bg-[#28d7c5]/10 px-3 py-1 text-xs font-medium text-[#28d7c5]">
                          {approvalResult.status.toUpperCase()}
                        </span>

                      </div>

                    </div>

                  )}

                  {/* ==================================
                      Terraform Deployment
                  ================================== */}

                  {approvalResult?.status === "approved" &&
                    !deploymentResult && (

                      <div className="border-t border-[#263035] bg-[#0f1214] px-5 py-5">

                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                          <div>

                            <p className="text-xs font-medium uppercase tracking-wider text-[#53605f]">
                              Infrastructure Deployment
                            </p>

                            <h3 className="mt-1 text-base font-semibold">
                              Deploy Approved Infrastructure
                            </h3>

                            <p className="mt-1 max-w-2xl text-xs leading-5 text-[#53605f]">
                              This will run Terraform apply against the approved artifact and create the AWS resources defined in the plan.
                            </p>

                          </div>

                          <button
                            type="button"
                            onClick={handleDeployTerraform}
                            disabled={deploymentLoading}
                            className="rounded-lg bg-[#28d7c5] px-5 py-2.5 text-xs font-semibold text-[#0b0d0f] transition hover:bg-[#63e6be] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deploymentLoading
                              ? "Deploying Infrastructure..."
                              : "🚀 Deploy Infrastructure"}
                          </button>

                        </div>

                        <div className="mt-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 text-xs leading-5 text-yellow-300">
                          Terraform apply creates real AWS resources and may incur AWS charges.
                        </div>

                      </div>

                    )}


                  {/* Deployment Error */}

                  {deploymentError && (

                    <div className="border-t border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-400">
                      {deploymentError}
                    </div>

                  )}


                  {/* Deployment Result */}

                  {deploymentResult && (

                    <div
                      className={`border-t px-5 py-5 ${
                        deploymentResult.success
                          ? "border-[#28d7c5]/20 bg-[#28d7c5]/5"
                          : "border-red-500/20 bg-red-500/5"
                      }`}
                    >

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                        <div>

                          <p
                            className={`text-sm font-semibold ${
                              deploymentResult.success
                                ? "text-[#28d7c5]"
                                : "text-red-400"
                            }`}
                          >
                            {deploymentResult.success
                              ? "✓ Infrastructure deployed successfully"
                              : "✕ Infrastructure deployment failed"}
                          </p>

                          <p className="mt-1 text-xs text-[#8a9997]">
                            Artifact ID:{" "}
                            <span className="font-mono text-[#f3f7f6]">
                              #{deploymentResult.artifact_id}
                            </span>
                          </p>

                          <p className="mt-1 text-xs text-[#8a9997]">
                            Project:{" "}
                            <span className="font-medium text-[#f3f7f6]">
                              {deploymentResult.project_name}
                            </span>
                          </p>

                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            deploymentResult.success
                              ? "bg-[#28d7c5]/10 text-[#28d7c5]"
                              : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {deploymentResult.status.toUpperCase()}
                        </span>

                      </div>

                      {deploymentResult.apply_output && (
                        <div className="mt-5">
                          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[#53605f]">
                            Terraform Apply Output
                          </p>
                          <pre className="max-h-[600px] overflow-auto rounded-lg bg-[#0b0d0f] p-5 text-xs leading-6 text-[#c7d2d0]">
                            {deploymentResult.apply_output}
                          </pre>
                        </div>
                      )}

                      {deploymentResult.apply_error && (
                        <pre className="mt-4 max-h-[400px] overflow-auto rounded-lg bg-[#0b0d0f] p-5 text-xs leading-6 text-red-400">
                          {deploymentResult.apply_error}
                        </pre>
                      )}

                    </div>

                  )}


                </div>

              </div>

            )}


            {/* ==================================
                Raw JSON
            ================================== */}

            <div className="mt-6 rounded-xl border border-[#263035] bg-[#121619] p-5">

              <p className="text-xs font-medium uppercase tracking-wider text-[#53605f]">
                Structured AI Output
              </p>

              <pre className="mt-4 max-h-[500px] overflow-auto rounded-lg bg-[#0b0d0f] p-5 text-xs leading-6 text-[#c7d2d0]">
                {JSON.stringify(
                  plan,
                  null,
                  2
                )}
              </pre>

            </div>

          </div>

        )}

      </main>

    </div>
  )
}

export default AIInfrastructure