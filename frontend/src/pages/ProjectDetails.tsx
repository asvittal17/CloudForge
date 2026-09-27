import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { getInfrastructure } from "../services/api"
import InfrastructureForm from "../components/InfrastructureForm"
import { Navbar } from "../components/Navbar"
import {
  IconArrowLeft,
  IconInfrastructure,
  IconFileCode,
  IconDeployments,
  IconMonitoring,
  IconAI,
  IconChevronRight,
} from "../components/Icons"

interface Project {
  id: number
  name: string
  description: string | null
  owner_id: number
  created_at: string
}

interface Infrastructure {
  id: number
  project_id: number
  cloud_provider: string
  region: string
  environment: string
  architecture: string | null
  created_at: string
}

function ProjectDetails() {
  const { projectId } = useParams()
  const navigate = useNavigate()

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [infrastructure, setInfrastructure] = useState<Infrastructure | null>(null)
  const [loadingInfrastructure, setLoadingInfrastructure] = useState(true)
  const [infrastructureError, setInfrastructureError] = useState("")
  const [showInfrastructureForm, setShowInfrastructureForm] = useState(false)

  // Load Project
  useEffect(() => {
    async function loadProject() {
      try {
        setLoading(true)
        setError("")

        const token = localStorage.getItem("access_token")
        const response = await fetch(
          `http://localhost:8000/projects/${projectId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.detail || "Failed to load project")
        }
        setProject(data)
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError("Failed to load project")
        }
      } finally {
        setLoading(false)
      }
    }

    loadProject()
  }, [projectId])

  // Load Infrastructure
  useEffect(() => {
    if (!projectId) return

    async function loadInfra() {
      try {
        setLoadingInfrastructure(true)
        setInfrastructureError("")

        const data = await getInfrastructure(Number(projectId))
        setInfrastructure(data)
      } catch (err) {
        if (err instanceof Error) {
          setInfrastructureError(err.message)
        } else {
          setInfrastructureError("Failed to load infrastructure")
        }
      } finally {
        setLoadingInfrastructure(false)
      }
    }

    loadInfra()
  }, [projectId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900 dark:bg-[#030507] dark:text-white">
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-[#768597]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
          <span>Loading project workspace...</span>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 text-slate-900 dark:bg-[#030507] dark:text-white">
        <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-white p-8 text-center shadow-xl dark:border-red-500/20 dark:bg-[#090c10]">
          <p className="text-sm font-semibold text-red-600 dark:text-red-400">
            {error || "Project not found"}
          </p>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="mt-5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-500 dark:bg-teal-500 dark:text-slate-950"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-[#030507] dark:text-slate-100">
      {/* Top Navbar */}
      <Navbar
        breadcrumbs={[
          { label: "Console", href: "/dashboard" },
          { label: "Projects", href: "/dashboard" },
          { label: project.name },
        ]}
      />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Back link */}
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="mb-6 flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-900 dark:text-[#768597] dark:hover:text-slate-200"
        >
          <IconArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Projects</span>
        </button>

        {/* Project Header Banner */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors sm:p-8 dark:border-[#1c222b] dark:bg-[#080b0f]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-xs font-bold text-slate-400 dark:text-[#525e6e]">
                  #{project.id}
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                  {project.name}
                </h1>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[9px] font-bold text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400">
                  ACTIVE
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-mono text-[9px] text-slate-600 dark:border-[#1e2531] dark:bg-[#0e1217] dark:text-[#768597]">
                  AWS CLOUD
                </span>
              </div>

              <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-500 dark:text-[#8090a2]">
                {project.description || "No project description provided for this cloud infrastructure workspace."}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-slate-400 dark:text-[#525e6e]">
                <span>
                  Owner ID: <span className="font-mono text-slate-700 dark:text-slate-300">#{project.owner_id}</span>
                </span>
                <span>•</span>
                <span>
                  Created: <span className="text-slate-700 dark:text-slate-300">{new Date(project.created_at).toLocaleDateString()}</span>
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowInfrastructureForm(true)}
                className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-500 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
              >
                <IconInfrastructure className="h-3.5 w-3.5" />
                <span>Configure Infrastructure</span>
              </button>

              <button
                type="button"
                onClick={() => navigate(`/projects/${project.id}/ai`)}
                className="flex items-center gap-1.5 rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-2.5 text-xs font-semibold text-teal-600 transition hover:bg-teal-500/20 dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-300"
              >
                <IconAI className="h-3.5 w-3.5" />
                <span>AI Builder</span>
              </button>

              <button
                type="button"
                onClick={() => navigate(`/projects/${project.id}/terraform`)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-[#1e2531] dark:bg-[#0e1217] dark:text-slate-300 dark:hover:bg-[#151b22]"
              >
                <IconFileCode className="h-3.5 w-3.5" />
                <span>Terraform</span>
              </button>
            </div>
          </div>
        </div>

        {/* Infrastructure Form Drawer / Inline Area */}
        {showInfrastructureForm && (
          <div className="mt-8">
            <InfrastructureForm
              projectId={project.id}
              existingInfrastructure={infrastructure}
              onSaved={(data) => {
                setInfrastructure(data)
                setShowInfrastructureForm(false)
              }}
              onCancel={() => setShowInfrastructureForm(false)}
            />
          </div>
        )}

        {/* Workspace Modules Cards Grid */}
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {/* 1. Infrastructure Specification */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-[#1c222b] dark:bg-[#080b0f]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                Cloud Infrastructure
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:bg-teal-400/10 dark:text-teal-400">
                <IconInfrastructure className="h-3.5 w-3.5" />
              </div>
            </div>

            {loadingInfrastructure ? (
              <div className="mt-4 text-xs text-slate-400">Loading specification...</div>
            ) : infrastructure ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    {infrastructure.cloud_provider}
                  </h3>
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                    CONFIGURED
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400 dark:text-[#768597]">Region</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">
                      {infrastructure.region}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 dark:text-[#768597]">Tier</span>
                    <span className="capitalize text-slate-800 dark:text-slate-200">
                      {infrastructure.environment}
                    </span>
                  </div>
                </div>

                {infrastructure.architecture && (
                  <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 text-[11px] text-slate-600 dark:border-[#171e27] dark:bg-[#0c1015] dark:text-[#768597] line-clamp-2">
                    {infrastructure.architecture}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowInfrastructureForm(true)}
                  className="mt-3 flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-500 dark:text-teal-400 dark:hover:text-teal-300"
                >
                  <span>Edit Specification</span>
                  <IconChevronRight className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Not Configured
                </h3>
                <p className="mt-1 text-xs text-slate-400 dark:text-[#768597]">
                  {infrastructureError || "Define target cloud provider, region, and network architecture."}
                </p>
                <button
                  type="button"
                  onClick={() => setShowInfrastructureForm(true)}
                  className="mt-4 flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400"
                >
                  <span>Configure Now</span>
                  <IconChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {/* 2. Terraform Code */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-[#1c222b] dark:bg-[#080b0f]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                IaC Engine
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:bg-teal-400/10 dark:text-teal-400">
                <IconFileCode className="h-3.5 w-3.5" />
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Terraform Files
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-[#768597]">
                Generate main.tf, variables.tf, and outputs.tf from architecture specification.
              </p>

              <button
                type="button"
                onClick={() => navigate(`/projects/${project.id}/terraform`)}
                className="mt-5 flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-500 dark:text-teal-400 dark:hover:text-teal-300"
              >
                <span>Open Terraform Workspace</span>
                <IconChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* 3. AI Cloud Assistant */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-[#1c222b] dark:bg-[#080b0f]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                Autonomous AI
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:bg-teal-400/10 dark:text-teal-400">
                <IconAI className="h-3.5 w-3.5" />
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                AI Infrastructure Builder
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-[#768597]">
                Prompt the local LLM model to build compliant AWS infrastructure configurations.
              </p>

              <button
                type="button"
                onClick={() => navigate(`/projects/${project.id}/ai`)}
                className="mt-5 flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-500 dark:text-teal-400 dark:hover:text-teal-300"
              >
                <span>Launch AI Builder</span>
                <IconChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* 4. Deployments */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-[#1c222b] dark:bg-[#080b0f]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                Deployments
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-[#12161c] dark:text-slate-400">
                <IconDeployments className="h-3.5 w-3.5" />
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                0 Deployments
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-[#768597]">
                Live cloud deployments are controlled through staged and approved artifacts.
              </p>

              <button
                type="button"
                onClick={() => navigate(`/projects/${project.id}/terraform`)}
                className="mt-5 flex items-center gap-1 text-xs font-semibold text-slate-600 transition hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-400"
              >
                <span>View Staged Artifacts</span>
                <IconChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* 5. Monitoring */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-[#1c222b] dark:bg-[#080b0f]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                Telemetry
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-[#12161c] dark:text-slate-400">
                <IconMonitoring className="h-3.5 w-3.5" />
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Pre-Deployment State
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-[#768597]">
                Live CloudWatch and Prometheus telemetry will link after active apply.
              </p>

              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="mt-5 flex items-center gap-1 text-xs font-semibold text-slate-600 transition hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-400"
              >
                <span>Console Telemetry</span>
                <IconChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Project Information Specs Table */}
        <section className="mt-10">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-[#525e6e]">
            Workspace Specifications
          </h2>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-[#1c222b] dark:bg-[#080b0f]">
            <div className="grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                  Project ID
                </span>
                <p className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-white">
                  #{project.id}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                  Owner ID
                </span>
                <p className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-white">
                  #{project.owner_id}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                  Created Timestamp
                </span>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                  {new Date(project.created_at).toLocaleDateString()}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                  Control Plane Status
                </span>
                <p className="mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  Ready
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default ProjectDetails