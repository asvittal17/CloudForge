import { useState } from "react"
import {
  createInfrastructure,
  updateInfrastructure,
} from "../services/api"
import { IconAlertCircle, IconChevronDown } from "./Icons"

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
  const [cloudProvider, setCloudProvider] = useState(
    () => existingInfrastructure?.cloud_provider ?? "AWS"
  )
  const [region, setRegion] = useState(
    () => existingInfrastructure?.region ?? "ap-south-1"
  )
  const [environment, setEnvironment] = useState(
    () => existingInfrastructure?.environment ?? "development"
  )
  const [architecture, setArchitecture] = useState(
    () => existingInfrastructure?.architecture ?? ""
  )

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const isEditMode = !!existingInfrastructure

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setLoading(true)
      setError("")

      let data: Infrastructure

      if (isEditMode) {
        data = await updateInfrastructure(
          projectId,
          cloudProvider,
          region,
          environment,
          architecture.trim()
        )
      } else {
        data = await createInfrastructure(
          projectId,
          cloudProvider,
          region,
          environment,
          architecture.trim()
        )
      }

      onSaved(data)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
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

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-[#1e2531] dark:bg-[#090c10]">
      {/* Header */}
      <div className="border-b border-slate-200/90 px-6 py-4 dark:border-[#181f29]">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">
              Cloud Configuration
            </span>
            <h2 className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-white">
              {isEditMode ? "Manage Infrastructure Spec" : "Configure Cloud Infrastructure"}
            </h2>
          </div>
          <span className="rounded-full border border-teal-500/20 bg-teal-500/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-teal-600 dark:border-teal-400/20 dark:bg-teal-400/10 dark:text-teal-300">
            {isEditMode ? "UPDATE MODE" : "NEW SPEC"}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-[#768597]">
          {isEditMode
            ? "Update the cloud provider, target region, environment tier, and architecture specification."
            : "Define the cloud environment targets and high-level architecture before generating Terraform."}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <div className="grid gap-5 sm:grid-cols-3">
          {/* Cloud Provider */}
          <div>
            <label
              htmlFor="cloud-provider"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
            >
              Provider
            </label>
            <div className="relative">
              <select
                id="cloud-provider"
                value={cloudProvider}
                onChange={(e) => setCloudProvider(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-900 outline-none transition focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:border-[#222a36] dark:bg-[#06080b] dark:text-slate-100 dark:focus:border-teal-400 dark:focus:ring-teal-400/30"
              >
                <option value="AWS">Amazon Web Services (AWS)</option>
                <option value="Azure">Microsoft Azure</option>
                <option value="GCP">Google Cloud Platform (GCP)</option>
              </select>
              <IconChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
            </div>
          </div>

          {/* Region */}
          <div>
            <label
              htmlFor="region"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
            >
              Target Region
            </label>
            <div className="relative">
              <select
                id="region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-xs font-medium text-slate-900 outline-none transition focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:border-[#222a36] dark:bg-[#06080b] dark:text-slate-100 dark:focus:border-teal-400 dark:focus:ring-teal-400/30"
              >
                <option value="ap-south-1">ap-south-1 (Mumbai)</option>
                <option value="us-east-1">us-east-1 (N. Virginia)</option>
                <option value="us-west-2">us-west-2 (Oregon)</option>
                <option value="eu-west-1">eu-west-1 (Ireland)</option>
              </select>
              <IconChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
            </div>
          </div>

          {/* Environment */}
          <div>
            <label
              htmlFor="environment"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
            >
              Environment Tier
            </label>
            <div className="relative">
              <select
                id="environment"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-900 outline-none transition focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:border-[#222a36] dark:bg-[#06080b] dark:text-slate-100 dark:focus:border-teal-400 dark:focus:ring-teal-400/30"
              >
                <option value="development">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
              <IconChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Architecture Description */}
        <div>
          <label
            htmlFor="architecture"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
          >
            Architecture Specification
          </label>
          <textarea
            id="architecture"
            rows={4}
            value={architecture}
            onChange={(e) => setArchitecture(e.target.value)}
            placeholder="e.g. AWS VPC with public and private subnets, EC2 micro services, and RDS PostgreSQL database."
            className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:border-[#222a36] dark:bg-[#06080b] dark:text-slate-100 dark:placeholder:text-[#424e5e] dark:focus:border-teal-400 dark:focus:ring-teal-400/30"
          />
          <p className="mt-1.5 text-[11px] text-slate-400 dark:text-[#525e6e]">
            Detail components like VPC, subnets, EC2 compute sizing, and managed RDS databases.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-600 dark:text-red-400">
            <IconAlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200/90 dark:border-[#181f29]">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-[#222a36] dark:bg-[#0e1217] dark:text-slate-300 dark:hover:bg-[#151b22]"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-50 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
          >
            {loading ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span>Saving specification...</span>
              </>
            ) : (
              <span>{isEditMode ? "Save Changes" : "Save Infrastructure Spec"}</span>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default InfrastructureForm