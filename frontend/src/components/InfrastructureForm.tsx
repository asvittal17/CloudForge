import { useEffect, useState } from "react"

import {
  createInfrastructure,
  updateInfrastructure,
} from "../services/api"


interface Infrastructure {
  id: number
  project_id: number
  cloud_provider: string
  region: string
  environment: string
  architecture: string | null
  created_at: string
}


interface InfrastructureFormProps {
  projectId: number
  existingInfrastructure?: Infrastructure | null
  onSaved: (infrastructure: Infrastructure) => void
  onCancel: () => void
}


function InfrastructureForm({
  projectId,
  existingInfrastructure,
  onSaved,
  onCancel,
}: InfrastructureFormProps) {

  // ========================================
  // Form State
  // ========================================

  const [cloudProvider, setCloudProvider] =
    useState("AWS")

  const [region, setRegion] =
    useState("ap-south-1")

  const [environment, setEnvironment] =
    useState("development")

  const [architecture, setArchitecture] =
    useState("")


  // ========================================
  // UI State
  // ========================================

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState("")


  // ========================================
  // Detect Create / Edit Mode
  // ========================================

  const isEditMode =
    !!existingInfrastructure


  // ========================================
  // Load Existing Infrastructure
  // ========================================

  useEffect(() => {

    if (!existingInfrastructure) {
      return
    }

    setCloudProvider(
      existingInfrastructure.cloud_provider
    )

    setRegion(
      existingInfrastructure.region
    )

    setEnvironment(
      existingInfrastructure.environment
    )

    setArchitecture(
      existingInfrastructure.architecture || ""
    )

  }, [existingInfrastructure])


  // ========================================
  // Submit Form
  // ========================================

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {

    event.preventDefault()

    try {

      setLoading(true)
      setError("")


      let data


      // ====================================
      // Update Existing Infrastructure
      // ====================================

      if (isEditMode) {

        data = await updateInfrastructure(
          projectId,
          cloudProvider,
          region,
          environment,
          architecture.trim()
        )

      }

      // ====================================
      // Create New Infrastructure
      // ====================================

      else {

        data = await createInfrastructure(
          projectId,
          cloudProvider,
          region,
          environment,
          architecture.trim()
        )

      }


      // Send saved data to parent

      onSaved(data)


    } catch (error) {

      if (error instanceof Error) {

        setError(error.message)

      } else {

        setError(
          isEditMode
            ? "Failed to update infrastructure"
            : "Failed to create infrastructure"
        )

      }

    } finally {

      setLoading(false)

    }

  }


  // ========================================
  // UI
  // ========================================

  return (

    <div
      className="rounded-xl border border-[#263035] bg-[#121619] p-6"
    >

      {/* ==================================
          Header
      ================================== */}

      <div className="mb-6">

        <h2 className="text-xl font-semibold text-[#f3f7f6]">

          {isEditMode
            ? "Manage Infrastructure"
            : "Configure Infrastructure"}

        </h2>


        <p className="mt-1 text-sm text-[#8a9997]">

          {isEditMode
            ? "Update the cloud infrastructure configuration for this project."
            : "Define the initial cloud infrastructure for this project."}

        </p>

      </div>


      {/* ==================================
          Form
      ================================== */}

      <form
        onSubmit={handleSubmit}
        className="space-y-5"
      >


        {/* ==================================
            Cloud Provider
        ================================== */}

        <div>

          <label
            htmlFor="cloud-provider"
            className="mb-2 block text-sm font-medium text-[#f3f7f6]"
          >
            Cloud Provider
          </label>


          <select
            id="cloud-provider"
            value={cloudProvider}
            onChange={(event) =>
              setCloudProvider(
                event.target.value
              )
            }
            className="w-full rounded-lg border border-[#263035] bg-[#0b0d0f] px-3 py-2.5 text-sm text-[#f3f7f6] outline-none focus:border-[#28d7c5]"
          >

            <option value="AWS">
              Amazon Web Services (AWS)
            </option>

            <option value="Azure">
              Microsoft Azure
            </option>

            <option value="GCP">
              Google Cloud Platform (GCP)
            </option>

          </select>

        </div>


        {/* ==================================
            Region
        ================================== */}

        <div>

          <label
            htmlFor="region"
            className="mb-2 block text-sm font-medium text-[#f3f7f6]"
          >
            Region
          </label>


          <select
            id="region"
            value={region}
            onChange={(event) =>
              setRegion(
                event.target.value
              )
            }
            className="w-full rounded-lg border border-[#263035] bg-[#0b0d0f] px-3 py-2.5 text-sm text-[#f3f7f6] outline-none focus:border-[#28d7c5]"
          >

            <option value="ap-south-1">
              Asia Pacific (Mumbai) — ap-south-1
            </option>

            <option value="us-east-1">
              US East (N. Virginia) — us-east-1
            </option>

            <option value="us-west-2">
              US West (Oregon) — us-west-2
            </option>

            <option value="eu-west-1">
              Europe (Ireland) — eu-west-1
            </option>

          </select>

        </div>


        {/* ==================================
            Environment
        ================================== */}

        <div>

          <label
            htmlFor="environment"
            className="mb-2 block text-sm font-medium text-[#f3f7f6]"
          >
            Environment
          </label>


          <select
            id="environment"
            value={environment}
            onChange={(event) =>
              setEnvironment(
                event.target.value
              )
            }
            className="w-full rounded-lg border border-[#263035] bg-[#0b0d0f] px-3 py-2.5 text-sm text-[#f3f7f6] outline-none focus:border-[#28d7c5]"
          >

            <option value="development">
              Development
            </option>

            <option value="staging">
              Staging
            </option>

            <option value="production">
              Production
            </option>

          </select>

        </div>


        {/* ==================================
            Architecture
        ================================== */}

        <div>

          <label
            htmlFor="architecture"
            className="mb-2 block text-sm font-medium text-[#f3f7f6]"
          >
            Architecture Description
          </label>


          <textarea
            id="architecture"
            value={architecture}
            onChange={(event) =>
              setArchitecture(
                event.target.value
              )
            }
            placeholder="Describe the infrastructure you want to build..."
            rows={5}
            className="w-full resize-none rounded-lg border border-[#263035] bg-[#0b0d0f] px-3 py-2.5 text-sm text-[#f3f7f6] outline-none placeholder:text-[#53605f] focus:border-[#28d7c5]"
          />


          <p className="mt-2 text-xs text-[#53605f]">

            Example: A VPC with public and private
            subnets, an EC2 application server, and
            an RDS PostgreSQL database.

          </p>

        </div>


        {/* ==================================
            Error
        ================================== */}

        {error && (

          <div
            className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-sm text-red-400"
          >
            {error}
          </div>

        )}


        {/* ==================================
            Buttons
        ================================== */}

        <div className="flex justify-end gap-3 pt-2">

          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-[#263035] px-4 py-2.5 text-sm font-medium text-[#8a9997] transition hover:border-[#53605f] hover:text-[#f3f7f6] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>


          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[#28d7c5] px-5 py-2.5 text-sm font-semibold text-[#0b0d0f] transition hover:bg-[#63e6be] disabled:cursor-not-allowed disabled:opacity-50"
          >

            {loading
              ? isEditMode
                ? "Updating..."
                : "Saving..."
              : isEditMode
                ? "Save Changes"
                : "Save Infrastructure"}

          </button>

        </div>

      </form>

    </div>

  )
}


export default InfrastructureForm