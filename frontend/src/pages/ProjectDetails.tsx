import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { API_BASE_URL, getInfrastructure } from "../services/api"
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
  IconChevronDown,
  IconServer,
  IconNetwork,
  IconShield,
  IconCheckCircle,
  IconAlertCircle,
  IconTerminal,
  IconCpu,
  IconDatabase,
  IconPlus,
  IconClose,
  IconRefresh,
  IconPlay,
  IconCopy,
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
          `${API_BASE_URL}/projects/${projectId}`,
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
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900 dark:bg-[#0a0d12] dark:text-white">
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-[#768597]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
          <span>Loading project workspace...</span>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 text-slate-900 dark:bg-[#0a0d12] dark:text-white">
        <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-white p-8 text-center shadow-xl dark:border-red-500/20 dark:bg-[#0a0d12]">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <IconAlertCircle className="h-6 w-6 text-red-500" />
          </div>
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
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-[#0a0d12] dark:text-slate-100">
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
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-[#1c222b] dark:bg-[#0d1117]">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-500 via-cyan-400 to-teal-500" />
          <div className="p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 font-mono text-[10px] font-bold text-slate-500 dark:bg-[#161b22] dark:text-[#768597]">
                    <IconServer className="h-3 w-3" />
                    #{project.id}
                  </span>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                    {project.name}
                  </h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                    ACTIVE
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 dark:border-[#1e2531] dark:bg-[#161b22] dark:text-[#768597]">
                    <IconServer className="h-3 w-3" />
                    AWS CLOUD
                  </span>
                </div>

                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-[#8090a2]">
                  {project.description || "No project description provided for this cloud infrastructure workspace."}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400 dark:text-[#525e6e]">
                  <span className="inline-flex items-center gap-1.5">
                    <IconShield className="h-3.5 w-3.5" />
                    Owner: <span className="font-mono font-medium text-slate-700 dark:text-slate-300">#{project.owner_id}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <IconTerminal className="h-3.5 w-3.5" />
                    Created: <span className="font-medium text-slate-700 dark:text-slate-300">{new Date(project.created_at).toLocaleDateString()}</span>
                  </span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowInfrastructureForm(!showInfrastructureForm)}
                  className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-500 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
                >
                  <IconInfrastructure className="h-3.5 w-3.5" />
                  <span>{showInfrastructureForm ? "Close Configuration" : "Configure Infrastructure"}</span>
                  <IconChevronDown className={`h-3 w-3 transition-transform ${showInfrastructureForm ? "rotate-180" : ""}`} />
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
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-[#1e2531] dark:bg-[#161b22] dark:text-slate-300 dark:hover:bg-[#1c222b]"
                >
                  <IconFileCode className="h-3.5 w-3.5" />
                  <span>Terraform</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Infrastructure Form Drawer */}
        {showInfrastructureForm && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-teal-500/20 bg-white shadow-lg transition-colors dark:border-teal-400/20 dark:bg-[#0d1117]">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-[#1c222b]">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-500/10">
                  <IconInfrastructure className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                </div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {infrastructure ? "Edit Infrastructure Specification" : "New Infrastructure Specification"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowInfrastructureForm(false)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#161b22] dark:hover:text-slate-300"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6">
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
          </div>
        )}

        {/* Workspace Modules Cards Grid */}
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {/* 1. Infrastructure Specification */}
          <div className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-teal-500/30 hover:shadow-md dark:border-[#1c222b] dark:bg-[#0d1117] dark:hover:border-teal-400/30">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                <IconCpu className="h-3 w-3" />
                Cloud Infrastructure
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 transition group-hover:bg-teal-500/20 dark:bg-teal-400/10 dark:text-teal-400">
                <IconInfrastructure className="h-4 w-4" />
              </div>
            </div>

            {loadingInfrastructure ? (
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
                Loading specification...
              </div>
            ) : infrastructure ? (
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    {infrastructure.cloud_provider}
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <IconCheckCircle className="h-3 w-3" />
                    CONFIGURED
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-[#161b22]">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">Region</span>
                    <p className="mt-0.5 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {infrastructure.region}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-[#161b22]">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">Tier</span>
                    <p className="mt-0.5 text-xs font-semibold capitalize text-slate-800 dark:text-slate-200">
                      {infrastructure.environment}
                    </p>
                  </div>
                </div>

                {infrastructure.architecture && (
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 dark:border-[#171e27] dark:bg-[#0a0d12]">
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <IconNetwork className="h-3 w-3 text-slate-400" />
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">Architecture</span>
                    </div>
                    <p className="font-mono text-[11px] leading-relaxed text-slate-600 dark:text-[#768597] line-clamp-3">
                      {infrastructure.architecture}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowInfrastructureForm(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-teal-600 transition hover:text-teal-500 dark:text-teal-400 dark:hover:text-teal-300"
                >
                  <span>Edit Specification</span>
                  <IconChevronRight className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="mt-4">
                <div className="flex items-center gap-2">
                  <IconAlertCircle className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Not Configured
                  </h3>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400 dark:text-[#768597]">
                  {infrastructureError || "Define target cloud provider, region, and network architecture."}
                </p>
                <button
                  type="button"
                  onClick={() => setShowInfrastructureForm(true)}
                  className="mt-4 flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400"
                >
                  <IconPlus className="h-3 w-3" />
                  <span>Configure Now</span>
                </button>
              </div>
            )}
          </div>

          {/* 2. Terraform Code */}
          <div className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-teal-500/30 hover:shadow-md dark:border-[#1c222b] dark:bg-[#0d1117] dark:hover:border-teal-400/30">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                <IconFileCode className="h-3 w-3" />
                IaC Engine
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 transition group-hover:bg-teal-500/20 dark:bg-teal-400/10 dark:text-teal-400">
                <IconFileCode className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Terraform Files
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-[#768597]">
                Generate main.tf, variables.tf, and outputs.tf from architecture specification.
              </p>

              <div className="mt-4 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-[#161b22] dark:text-[#768597]">
                  <IconCopy className="h-2.5 w-2.5" />
                  HCL
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-[#161b22] dark:text-[#768597]">
                  <IconRefresh className="h-2.5 w-2.5" />
                  State
                </span>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/projects/${project.id}/terraform`)}
                className="mt-5 flex items-center gap-1 text-xs font-semibold text-teal-600 transition hover:text-teal-500 dark:text-teal-400 dark:hover:text-teal-300"
              >
                <span>Open Terraform Workspace</span>
                <IconChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* 3. AI Cloud Assistant */}
          <div className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-teal-500/30 hover:shadow-md dark:border-[#1c222b] dark:bg-[#0d1117] dark:hover:border-teal-400/30">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                <IconAI className="h-3 w-3" />
                Autonomous AI
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 transition group-hover:bg-teal-500/20 dark:bg-teal-400/10 dark:text-teal-400">
                <IconAI className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                AI Infrastructure Builder
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-[#768597]">
                Prompt the local LLM model to build compliant AWS infrastructure configurations.
              </p>

              <div className="mt-4 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-[#161b22] dark:text-[#768597]">
                  <IconPlay className="h-2.5 w-2.5" />
                  Local LLM
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-[#161b22] dark:text-[#768597]">
                  <IconCpu className="h-2.5 w-2.5" />
                  Ollama
                </span>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/projects/${project.id}/ai`)}
                className="mt-5 flex items-center gap-1 text-xs font-semibold text-teal-600 transition hover:text-teal-500 dark:text-teal-400 dark:hover:text-teal-300"
              >
                <span>Launch AI Builder</span>
                <IconChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* 4. Deployments */}
          <div className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-teal-500/30 hover:shadow-md dark:border-[#1c222b] dark:bg-[#0d1117] dark:hover:border-teal-400/30">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                <IconDeployments className="h-3 w-3" />
                Deployments
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition group-hover:bg-teal-500/10 group-hover:text-teal-600 dark:bg-[#161b22] dark:text-slate-400 dark:group-hover:text-teal-400">
                <IconDeployments className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">0</h3>
                <span className="text-xs text-slate-400 dark:text-[#768597]">Deployments</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-[#768597]">
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
          <div className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-teal-500/30 hover:shadow-md dark:border-[#1c222b] dark:bg-[#0d1117] dark:hover:border-teal-400/30">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                <IconMonitoring className="h-3 w-3" />
                Telemetry
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition group-hover:bg-teal-500/10 group-hover:text-teal-600 dark:bg-[#161b22] dark:text-slate-400 dark:group-hover:text-teal-400">
                <IconMonitoring className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Pre-Deployment State
                </h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-[#768597]">
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
          <div className="flex items-center gap-2">
            <IconDatabase className="h-3.5 w-3.5 text-slate-400 dark:text-[#525e6e]" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-[#525e6e]">
              Workspace Specifications
            </h2>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-[#1c222b] dark:bg-[#0d1117]">
            <div className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x lg:divide-y-0 dark:divide-[#1c222b]">
              <div className="p-5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                  Project ID
                </span>
                <p className="mt-1.5 font-mono text-sm font-semibold text-slate-900 dark:text-white">
                  #{project.id}
                </p>
              </div>

              <div className="p-5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                  Owner ID
                </span>
                <p className="mt-1.5 font-mono text-sm font-semibold text-slate-900 dark:text-white">
                  #{project.owner_id}
                </p>
              </div>

              <div className="p-5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                  Created Timestamp
                </span>
                <p className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                  {new Date(project.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="p-5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                  Control Plane Status
                </span>
                <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
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
