import { useState } from "react"
import {
  createInfrastructure,
  updateInfrastructure,
} from "../services/api"
import {
  IconAlertCircle,
  IconChevronDown,
  IconServer,
  IconNetwork,
  IconShield,
  IconPlus,
  IconCheck,
  IconClose,
} from "./Icons"

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
      <div className="relative border-b border-slate-200/90 px-6 py-4 dark:border-[#181f29]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-500/50 to-transparent dark:via-teal-400/50" />
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">
              Cloud Configuration
            </span>
            <h2 className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-white">
              {isEditMode
                ? "Manage Infrastructure Spec"
                : "Configure Cloud Infrastructure"}
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

      <form onSubmit={handleSubmit} className="space-y-5 p-6">
        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <label
              htmlFor="cloud-provider"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
            >
              Provider
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#424e5e]">
                <IconServer className="h-4 w-4" />
              </span>
              <select
                id="cloud-provider"
                value={cloudProvider}
                onChange={(e) => setCloudProvider(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-9 text-xs font-medium text-slate-900 outline-none transition-all duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-[#222a36] dark:bg-[#06080b] dark:text-slate-100 dark:focus:border-teal-400 dark:focus:ring-teal-400/20"
              >
                <option value="AWS">Amazon Web Services (AWS)</option>
                <option value="Azure">Microsoft Azure</option>
                <option value="GCP">Google Cloud Platform (GCP)</option>
              </select>
              <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-[#5b6a7d]" />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400 dark:text-[#525e6e]">
              Target cloud platform for provisioning.
            </p>
          </div>

          <div>
            <label
              htmlFor="region"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
            >
              Target Region
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#424e5e]">
                <IconNetwork className="h-4 w-4" />
              </span>
              <select
                id="region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-9 font-mono text-xs font-medium text-slate-900 outline-none transition-all duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-[#222a36] dark:bg-[#06080b] dark:text-slate-100 dark:focus:border-teal-400 dark:focus:ring-teal-400/20"
              >
                <option value="ap-south-1">ap-south-1 (Mumbai)</option>
                <option value="us-east-1">us-east-1 (N. Virginia)</option>
                <option value="us-west-2">us-west-2 (Oregon)</option>
                <option value="eu-west-1">eu-west-1 (Ireland)</option>
              </select>
              <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-[#5b6a7d]" />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400 dark:text-[#525e6e]">
              Geographic region for resource placement.
            </p>
          </div>

          <div>
            <label
              htmlFor="environment"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
            >
              Environment Tier
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#424e5e]">
                <IconShield className="h-4 w-4" />
              </span>
              <select
                id="environment"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-9 text-xs font-medium text-slate-900 outline-none transition-all duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-[#222a36] dark:bg-[#06080b] dark:text-slate-100 dark:focus:border-teal-400 dark:focus:ring-teal-400/20"
              >
                <option value="development">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
              <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-[#5b6a7d]" />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400 dark:text-[#525e6e]">
              Deployment isolation and safety guardrails.
            </p>
          </div>
        </div>

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
            className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-[#222a36] dark:bg-[#06080b] dark:text-slate-100 dark:placeholder:text-[#424e5e] dark:focus:border-teal-400 dark:focus:ring-teal-400/20"
          />
          <p className="mt-1.5 text-[11px] text-slate-400 dark:text-[#525e6e]">
            Detail components like VPC, subnets, EC2 compute sizing, and managed
            RDS databases.
          </p>
        </div>

        {error && (
          <div className="animate-fade-in flex items-start gap-2.5 rounded-lg border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-600 dark:border-red-400/20 dark:text-red-400">
            <IconAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1 leading-relaxed">{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              className="shrink-0 rounded p-0.5 text-red-400/70 transition hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-300"
              aria-label="Dismiss error"
            >
              <IconClose className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-slate-200/90 pt-4 dark:border-[#181f29]">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#222a36] dark:bg-[#0e1217] dark:text-slate-300 dark:hover:bg-[#151b22]"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-b from-teal-500 to-teal-600 px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-teal-500/20 transition-all duration-200 hover:from-teal-400 hover:to-teal-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none dark:from-teal-500 dark:to-teal-600 dark:text-slate-950 dark:hover:from-teal-400 dark:hover:to-teal-500"
          >
            {loading ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span>Saving specification...</span>
              </>
            ) : (
              <>
                {isEditMode ? (
                  <IconCheck className="h-3.5 w-3.5" />
                ) : (
                  <IconPlus className="h-3.5 w-3.5" />
                )}
                <span>
                  {isEditMode
                    ? "Save Changes"
                    : "Save Infrastructure Spec"}
                </span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default InfrastructureForm
