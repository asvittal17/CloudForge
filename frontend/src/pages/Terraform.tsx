import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import {
  generateTerraform,
  validateTerraform,
  planTerraform,
} from "../services/api"


// ========================================
// Terraform Response
// ========================================

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


// ========================================
// Validation Response
// ========================================

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


// ========================================
// Plan Response
// ========================================

interface PlanResponse {
  project_id: number
  project_name: string
  success: boolean
  plan_output: string
  plan_error: string
}


// ========================================
// Terraform File Type
// ========================================

type TerraformFile =
  | "main.tf"
  | "variables.tf"
  | "outputs.tf"


function Terraform() {
  const { projectId } = useParams()
  const navigate = useNavigate()


  // ========================================
  // Terraform State
  // ========================================

  const [terraform, setTerraform] =
    useState<TerraformResponse | null>(null)

  const [activeFile, setActiveFile] =
    useState<TerraformFile>("main.tf")


  // ========================================
  // Generation State
  // ========================================

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState("")


  // ========================================
  // Validation State
  // ========================================

  const [validation, setValidation] =
    useState<ValidationResponse | null>(null)

  const [validating, setValidating] =
    useState(false)


  // ========================================
  // Terraform Plan State
  // ========================================

  const [plan, setPlan] =
    useState<PlanResponse | null>(null)

  const [planning, setPlanning] =
    useState(false)


  // ========================================
  // Copy State
  // ========================================

  const [copied, setCopied] =
    useState(false)


  // ========================================
  // Generate Terraform
  // ========================================

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
      setCopied(false)

      const data =
        await generateTerraform(
          Number(projectId)
        )

      setTerraform(data)

    } catch (error) {

      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError(
          "Failed to generate Terraform"
        )
      }

    } finally {
      setLoading(false)
    }
  }


  // ========================================
  // Validate Terraform
  // ========================================

  async function handleValidateTerraform() {
    if (!projectId) {
      setError("Project ID is missing")
      return
    }

    try {
      setValidating(true)
      setError("")

      const data =
        await validateTerraform(
          Number(projectId)
        )

      setValidation(data)

    } catch (error) {

      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError(
          "Failed to validate Terraform"
        )
      }

    } finally {
      setValidating(false)
    }
  }


  // ========================================
  // Terraform Plan
  // ========================================

  async function handlePlanTerraform() {
    if (!projectId) {
      setError("Project ID is missing")
      return
    }

    try {
      setPlanning(true)
      setError("")
      setPlan(null)

      const data =
        await planTerraform(
          Number(projectId)
        )

      setPlan(data)

    } catch (error) {

      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError(
          "Failed to generate Terraform plan"
        )
      }

    } finally {
      setPlanning(false)
    }
  }


  // ========================================
  // Copy Code
  // ========================================

  async function handleCopy() {
    if (!terraform) {
      return
    }

    const code =
      terraform.files[activeFile]

    try {

      await navigator.clipboard.writeText(
        code
      )

      setCopied(true)

      setTimeout(() => {
        setCopied(false)
      }, 2000)

    } catch {
      setError(
        "Failed to copy Terraform code"
      )
    }
  }


  // ========================================
  // Current Terraform Code
  // ========================================

  const currentCode =
    terraform?.files[activeFile] || ""


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
                navigate(
                  `/projects/${projectId}`
                )
              }
              className="text-sm text-[#8a9997] transition hover:text-[#28d7c5]"
            >
              ← Project
            </button>

            <span className="text-[#263035]">
              /
            </span>

            <span className="text-sm font-medium">
              Terraform
            </span>

          </div>


          <div className="flex items-center gap-3">

            {terraform && (

              <span className="rounded-full border border-[#63e6be]/20 bg-[#63e6be]/5 px-3 py-1 text-xs font-medium text-[#63e6be]">
                Generated
              </span>

            )}

            <button
              type="button"
              onClick={handleGenerateTerraform}
              disabled={loading}
              className="rounded-lg bg-[#28d7c5] px-5 py-2.5 text-sm font-semibold text-[#0b0d0f] transition hover:bg-[#63e6be] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Generating..."
                : "Generate Terraform"}
            </button>

          </div>

        </div>

      </header>


      {/* ==================================
          Main
      ================================== */}

      <main className="mx-auto max-w-7xl px-6 py-10 lg:px-10">

        {/* ==================================
            Page Header
        ================================== */}

        <div className="mb-8">

          <p className="text-xs font-medium uppercase tracking-[0.15em] text-[#53605f]">
            Infrastructure as Code
          </p>

          <h1 className="mt-2 text-3xl font-semibold">
            Terraform Generator
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-[#8a9997]">
            Generate and validate Terraform
            configuration from your CloudForge
            infrastructure settings.
          </p>

        </div>


        {/* ==================================
            Error
        ================================== */}

        {error && (

          <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
            {error}
          </div>

        )}


        {/* ==================================
            Infrastructure Summary
        ================================== */}

        {terraform && (

          <div className="mb-6 grid gap-4 md:grid-cols-4">

            <div className="rounded-xl border border-[#263035] bg-[#121619] p-5">

              <p className="text-xs uppercase tracking-wider text-[#53605f]">
                Project
              </p>

              <p className="mt-2 text-sm font-medium">
                {terraform.project_name}
              </p>

            </div>


            <div className="rounded-xl border border-[#263035] bg-[#121619] p-5">

              <p className="text-xs uppercase tracking-wider text-[#53605f]">
                Provider
              </p>

              <p className="mt-2 text-sm font-medium">
                {terraform.cloud_provider}
              </p>

            </div>


            <div className="rounded-xl border border-[#263035] bg-[#121619] p-5">

              <p className="text-xs uppercase tracking-wider text-[#53605f]">
                Region
              </p>

              <p className="mt-2 font-mono text-sm">
                {terraform.region}
              </p>

            </div>


            <div className="rounded-xl border border-[#263035] bg-[#121619] p-5">

              <p className="text-xs uppercase tracking-wider text-[#53605f]">
                Environment
              </p>

              <p className="mt-2 text-sm font-medium">
                {terraform.environment}
              </p>

            </div>

          </div>

        )}


        {/* ==================================
            Empty State
        ================================== */}

        {!terraform && !loading && (

          <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-[#263035] bg-[#121619] px-6 text-center">

            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[#28d7c5]/20 bg-[#28d7c5]/5">

              <span className="text-xl text-[#28d7c5]">
                TF
              </span>

            </div>


            <h2 className="mt-5 text-xl font-semibold">
              Terraform not generated
            </h2>


            <p className="mt-2 max-w-md text-sm text-[#8a9997]">
              Generate Terraform code from the
              infrastructure configuration stored
              for this project.
            </p>


            <button
              type="button"
              onClick={handleGenerateTerraform}
              className="mt-6 rounded-lg bg-[#28d7c5] px-5 py-2.5 text-sm font-semibold text-[#0b0d0f] transition hover:bg-[#63e6be]"
            >
              Generate Terraform
            </button>

          </div>

        )}


        {/* ==================================
            Terraform Code
        ================================== */}

        {terraform && (

          <div className="overflow-hidden rounded-xl border border-[#263035] bg-[#121619]">

            {/* ==================================
                File Tabs
            ================================== */}

            <div className="flex items-center justify-between border-b border-[#263035]">

              <div className="flex">

                {(
                  [
                    "main.tf",
                    "variables.tf",
                    "outputs.tf",
                  ] as TerraformFile[]
                ).map((file) => (

                  <button
                    key={file}
                    type="button"
                    onClick={() =>
                      setActiveFile(file)
                    }
                    className={`border-r border-[#263035] px-5 py-3 text-sm font-medium transition ${
                      activeFile === file
                        ? "border-b-2 border-b-[#28d7c5] bg-[#181d20] text-[#28d7c5]"
                        : "text-[#8a9997] hover:bg-[#181d20] hover:text-[#f3f7f6]"
                    }`}
                  >
                    {file}
                  </button>

                ))}

              </div>


              {/* Copy */}

              <button
                type="button"
                onClick={handleCopy}
                className="mr-3 rounded-lg border border-[#263035] px-3 py-1.5 text-xs font-medium text-[#8a9997] transition hover:border-[#28d7c5]/50 hover:text-[#28d7c5]"
              >
                {copied
                  ? "Copied!"
                  : "Copy Code"}
              </button>

            </div>


            {/* ==================================
                Code
            ================================== */}

            <div className="overflow-auto">

              <pre className="min-h-[520px] p-6 text-sm leading-6 text-[#c7d2d0]">

                <code>
                  {currentCode}
                </code>

              </pre>

            </div>

          </div>

        )}


        {/* ==================================
            Validation
        ================================== */}

        {terraform && (

          <div className="mt-6 rounded-xl border border-[#263035] bg-[#121619] p-6">

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

              <div>

                <p className="text-xs font-medium uppercase tracking-wider text-[#53605f]">
                  Terraform Validation
                </p>

                <h2 className="mt-1 text-lg font-semibold">
                  Check configuration
                </h2>

                <p className="mt-1 text-sm text-[#8a9997]">
                  Run Terraform formatting and
                  validation without deploying anything.
                </p>

              </div>


              <div className="flex flex-wrap gap-3">

                {/* Validate */}

                <button
                  type="button"
                  onClick={handleValidateTerraform}
                  disabled={validating}
                  className="rounded-lg border border-[#28d7c5]/40 px-5 py-2.5 text-sm font-semibold text-[#28d7c5] transition hover:bg-[#28d7c5]/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {validating
                    ? "Validating..."
                    : "Validate Terraform"}
                </button>


                {/* Plan */}

                <button
                  type="button"
                  onClick={handlePlanTerraform}
                  disabled={planning}
                  className="rounded-lg bg-[#28d7c5] px-5 py-2.5 text-sm font-semibold text-[#0b0d0f] transition hover:bg-[#63e6be] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {planning
                    ? "Generating Plan..."
                    : "Preview Terraform Plan"}
                </button>

              </div>

            </div>


            {/* ==================================
                Validation Result
            ================================== */}

            {validation && (

              <div className="mt-6 border-t border-[#263035] pt-6">

                <div className="grid gap-4 md:grid-cols-2">

                  {/* Valid */}

                  <div
                    className={`rounded-lg border p-4 ${
                      validation.valid
                        ? "border-[#63e6be]/20 bg-[#63e6be]/5"
                        : "border-red-500/20 bg-red-500/5"
                    }`}
                  >

                    <p className="text-xs uppercase tracking-wider text-[#53605f]">
                      Terraform Validate
                    </p>

                    <p
                      className={`mt-2 text-lg font-semibold ${
                        validation.valid
                          ? "text-[#63e6be]"
                          : "text-red-400"
                      }`}
                    >
                      {validation.valid
                        ? "✓ Configuration is valid"
                        : "✕ Configuration is invalid"}
                    </p>

                  </div>


                  {/* Formatting */}

                  <div
                    className={`rounded-lg border p-4 ${
                      validation.formatted
                        ? "border-[#63e6be]/20 bg-[#63e6be]/5"
                        : "border-yellow-500/20 bg-yellow-500/5"
                    }`}
                  >

                    <p className="text-xs uppercase tracking-wider text-[#53605f]">
                      Terraform Format
                    </p>

                    <p
                      className={`mt-2 text-lg font-semibold ${
                        validation.formatted
                          ? "text-[#63e6be]"
                          : "text-yellow-400"
                      }`}
                    >
                      {validation.formatted
                        ? "✓ Properly formatted"
                        : "⚠ Formatting required"}
                    </p>

                  </div>

                </div>


                {/* Validation Output */}

                {(validation.validation_output ||
                  validation.validation_error) && (

                  <div className="mt-4">

                    <p className="mb-2 text-xs uppercase tracking-wider text-[#53605f]">
                      Validation Output
                    </p>

                    <pre
                      className={`overflow-auto rounded-lg border p-4 text-xs leading-5 ${
                        validation.valid
                          ? "border-[#263035] bg-[#0b0d0f] text-[#63e6be]"
                          : "border-red-500/20 bg-red-500/5 text-red-400"
                      }`}
                    >
                      {validation.validation_output ||
                        validation.validation_error}
                    </pre>

                  </div>

                )}

              </div>

            )}


            {/* ==================================
                Terraform Plan Result
            ================================== */}

            {plan && (

              <div className="mt-6 border-t border-[#263035] pt-6">

                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                  <div>

                    <p className="text-xs font-medium uppercase tracking-wider text-[#53605f]">
                      Terraform Execution Plan
                    </p>

                    <h2 className="mt-1 text-lg font-semibold">
                      Infrastructure Preview
                    </h2>

                    <p className="mt-1 text-sm text-[#8a9997]">
                      Preview the infrastructure Terraform
                      would create or change.
                    </p>

                  </div>


                  <div
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      plan.success
                        ? "border border-[#63e6be]/20 bg-[#63e6be]/5 text-[#63e6be]"
                        : "border border-red-500/20 bg-red-500/5 text-red-400"
                    }`}
                  >
                    {plan.success
                      ? "Plan Successful"
                      : "Plan Failed"}
                  </div>

                </div>


                {/* Plan Output */}

                <div className="mt-5">

                  <p className="mb-2 text-xs uppercase tracking-wider text-[#53605f]">
                    Plan Output
                  </p>

                  <pre
                    className={`max-h-[600px] overflow-auto rounded-lg border p-5 text-xs leading-5 ${
                      plan.success
                        ? "border-[#263035] bg-[#0b0d0f] text-[#c7d2d0]"
                        : "border-red-500/20 bg-red-500/5 text-red-400"
                    }`}
                  >
                    {plan.success
                      ? plan.plan_output
                      : plan.plan_error ||
                        "Terraform plan failed."}
                  </pre>

                </div>


                {/* Plan Explanation */}

                {plan.success && (

                  <div className="mt-4 rounded-lg border border-[#263035] bg-[#0b0d0f] p-4">

                    <p className="text-xs font-medium uppercase tracking-wider text-[#53605f]">
                      What this means
                    </p>

                    <p className="mt-2 text-sm leading-6 text-[#8a9997]">
                      Terraform has calculated the infrastructure
                      changes without deploying them to AWS.
                      Resources marked with <span className="font-mono text-[#63e6be]">+</span>
                      would be created when an approved
                      Terraform apply is eventually executed.
                    </p>

                  </div>

                )}

              </div>

            )}

          </div>

        )}

      </main>

    </div>
  )
}


export default Terraform