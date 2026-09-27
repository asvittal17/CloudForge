import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { useNavigate } from "react-router-dom"

import { getProjects } from "../services/api"
import { useTheme } from "../context/ThemeContext"
import { Navbar } from "../components/Navbar"
import { Sidebar } from "../components/Sidebar"
import type { DashboardSection } from "../components/Sidebar"
import NewProjectModal from "../components/NewProjectModal"
import {
  IconPlus,
  IconProjects,
  IconInfrastructure,
  IconDeployments,
  IconAI,
  IconCheckCircle,
  IconRefresh,
  IconChevronRight,
  IconServer,
  IconDatabase,
  IconCpu,
} from "../components/Icons"

interface Project {
  id: number
  name: string
  description: string | null
  owner_id: number
  created_at: string
}

interface HealthState {
  status: "idle" | "checking" | "online" | "offline"
  message: string
  checkedAt: string | null
}

const API_BASE_URL = "http://localhost:8000"

function Dashboard() {
  const navigate = useNavigate()
  const { isDark, toggleTheme } = useTheme()

  const [activeSection, setActiveSection] = useState<DashboardSection>("overview")
  const [projects, setProjects] = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [projectError, setProjectError] = useState("")
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const [health, setHealth] = useState<HealthState>({
    status: "idle",
    message: "Not checked yet",
    checkedAt: null,
  })

  useEffect(() => {
    async function loadProjects() {
      try {
        setLoadingProjects(true)
        setProjectError("")
        const data = await getProjects()
        setProjects(data)
      } catch (error) {
        setProjectError(
          error instanceof Error ? error.message : "Failed to load projects"
        )
      } finally {
        setLoadingProjects(false)
      }
    }

    loadProjects()
  }, [])

  useEffect(() => {
    if (activeSection === "monitoring") {
      void checkSystemHealth()
    }
  }, [activeSection])

  const selectedProject = projects[0] ?? null

  const infrastructureCount = useMemo(() => {
    return projects.length
  }, [projects])

  async function checkSystemHealth() {
    try {
      setHealth({
        status: "checking",
        message: "Checking CloudForge API...",
        checkedAt: null,
      })

      const response = await fetch(`${API_BASE_URL}/health`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || "CloudForge API is unavailable")
      }

      setHealth({
        status: "online",
        message:
          data.status === "healthy"
            ? "CloudForge API is healthy"
            : "CloudForge API responded",
        checkedAt: new Date().toLocaleTimeString(),
      })
    } catch (error) {
      setHealth({
        status: "offline",
        message:
          error instanceof Error
            ? error.message
            : "CloudForge API is unavailable",
        checkedAt: new Date().toLocaleTimeString(),
      })
    }
  }

  function openSection(section: DashboardSection) {
    setActiveSection(section)
    setMobileMenuOpen(false)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function openAIInfrastructure() {
    if (!selectedProject) {
      setProjectError("Create a project before using AI Infrastructure.")
      openSection("projects")
      return
    }
    navigate(`/projects/${selectedProject.id}/ai`)
  }

  function openProject(projectId: number) {
    navigate(`/projects/${projectId}`)
  }

  function openTerraform(projectId: number) {
    navigate(`/projects/${projectId}/terraform`)
  }

  function logout() {
    localStorage.removeItem("access_token")
    navigate("/login")
  }

  function refreshProjects() {
    window.location.reload()
  }

  // ----------------------------------------------------
  // SECTION: OVERVIEW
  // ----------------------------------------------------
  function renderOverview() {
    return (
      <div className="space-y-8">
        {/* Header Action Section */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">
                Workspace
              </span>
              <span className="text-slate-300 dark:text-[#232b36]">•</span>
              <span className="font-mono text-xs text-slate-500 dark:text-[#657385]">
                Control Plane
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              Overview
            </h1>
            <p className="mt-1 max-w-2xl text-xs text-slate-500 dark:text-[#8090a2]">
              Design, validate, approve, and manage cloud infrastructure from one unified control plane.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowNewProjectModal(true)}
              className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-500 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
            >
              <IconPlus className="h-4 w-4" />
              <span>New Project</span>
            </button>
          </div>
        </div>

        {/* Metric Cards Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Workspaces"
            value={loadingProjects ? "..." : String(projects.length)}
            detail="Active project workspaces"
            icon={<IconProjects className="h-4 w-4 text-teal-600 dark:text-teal-400" />}
          />
          <MetricCard
            label="Deployments"
            value="0"
            detail="No live deployment runs"
            icon={<IconDeployments className="h-4 w-4 text-slate-500 dark:text-slate-400" />}
          />
          <MetricCard
            label="Infrastructure"
            value={String(infrastructureCount)}
            detail="Configured cloud targets"
            icon={<IconInfrastructure className="h-4 w-4 text-teal-600 dark:text-teal-400" />}
          />
          <MetricCard
            label="Control Plane"
            value="Online"
            detail="API & Services operational"
            statusSuccess
            icon={<IconCheckCircle className="h-4 w-4 text-emerald-500" />}
          />
        </div>

        {/* Workflow & Quick Launch */}
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Main Workflow Card */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-[#1c222b] dark:bg-[#080b0f]">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                  Deployment Lifecycle
                </span>
                <h2 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                  Controlled Infrastructure Pipeline
                </h2>
              </div>
              <span className="rounded-full border border-teal-500/20 bg-teal-500/10 px-2.5 py-0.5 font-mono text-[9px] font-bold text-teal-600 dark:border-teal-400/20 dark:bg-teal-400/10 dark:text-teal-300">
                STAGE-GATE
              </span>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-[#768597]">
              CloudForge strictly separates AI architecture specification, Terraform code generation, validation, and execution planning from live cloud apply.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              {[
                ["01", "Describe", "Prompt"],
                ["02", "Generate", "Terraform"],
                ["03", "Validate", "Syntax"],
                ["04", "Plan", "Dry run"],
                ["05", "Approve", "Gate"],
              ].map(([num, title, sub]) => (
                <div
                  key={num}
                  className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 dark:border-[#171e27] dark:bg-[#0c1015]"
                >
                  <span className="font-mono text-[10px] font-bold text-teal-600 dark:text-teal-400">
                    {num}
                  </span>
                  <p className="mt-1 text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {title}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-[#525e6e]">
                    {sub}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={openAIInfrastructure}
                disabled={!selectedProject}
                className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-40 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
              >
                <IconAI className="h-3.5 w-3.5" />
                <span>Launch AI Infrastructure Builder</span>
              </button>
              {selectedProject && (
                <span className="text-[11px] text-slate-400 dark:text-[#525e6e]">
                  Active: <span className="font-medium text-slate-700 dark:text-slate-300">{selectedProject.name}</span>
                </span>
              )}
            </div>
          </div>

          {/* Quick System Telemetry */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-[#1c222b] dark:bg-[#080b0f]">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                  Status
                </span>
                <h2 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                  Platform Services
                </h2>
              </div>
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-xs dark:border-[#171e27] dark:bg-[#0c1015]">
                <div className="flex items-center gap-2.5">
                  <IconServer className="h-4 w-4 text-slate-400" />
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    FastAPI Engine
                  </span>
                </div>
                <span className="font-mono text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  HEALTHY
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-xs dark:border-[#171e27] dark:bg-[#0c1015]">
                <div className="flex items-center gap-2.5">
                  <IconDatabase className="h-4 w-4 text-slate-400" />
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    PostgreSQL DB
                  </span>
                </div>
                <span className="font-mono text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  CONNECTED
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-xs dark:border-[#171e27] dark:bg-[#0c1015]">
                <div className="flex items-center gap-2.5">
                  <IconCpu className="h-4 w-4 text-slate-400" />
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    AI Runtime
                  </span>
                </div>
                <span className="font-mono text-[10px] font-semibold text-teal-600 dark:text-teal-400">
                  OLLAMA
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => openSection("monitoring")}
              className="mt-5 flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-[#1e2531] dark:text-slate-400 dark:hover:bg-[#12161f] dark:hover:text-slate-200"
            >
              <span>View Full Monitoring</span>
              <IconChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Project List Subsection */}
        {renderProjectList(true)}
      </div>
    )
  }

  // ----------------------------------------------------
  // SECTION: PROJECTS LIST
  // ----------------------------------------------------
  function renderProjectList(compact = false) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {compact ? "Recent Projects" : "All Projects"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#768597]">
              {compact
                ? "Active infrastructure environments in your workspace."
                : "Manage all CloudForge project workspaces."}
            </p>
          </div>

          {compact && (
            <button
              type="button"
              onClick={() => openSection("projects")}
              className="flex items-center gap-1 text-xs font-semibold text-teal-600 transition hover:text-teal-500 dark:text-teal-400 dark:hover:text-teal-300"
            >
              <span>View all projects</span>
              <IconChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {loadingProjects ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 dark:border-[#1c222b] dark:bg-[#080b0f] dark:text-[#768597]">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
            <p className="mt-2 font-medium">Loading workspaces...</p>
          </div>
        ) : projectError ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-xs text-red-600 dark:text-red-400">
            <p className="font-semibold">{projectError}</p>
            <button
              type="button"
              onClick={refreshProjects}
              className="mt-3 rounded-md border border-red-500/30 px-3 py-1.5 font-medium hover:bg-red-500/20"
            >
              Retry
            </button>
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-[#222a36] dark:bg-[#080b0f]">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 ring-1 ring-teal-500/20 dark:bg-teal-400/10 dark:text-teal-400">
              <IconProjects className="h-5 w-5" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
              No projects created yet
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-[#768597]">
              Get started by provisioning your first CloudForge workspace.
            </p>
            <button
              type="button"
              onClick={() => setShowNewProjectModal(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-500 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
            >
              <IconPlus className="h-3.5 w-3.5" />
              <span>Create Project</span>
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-[#1c222b] dark:bg-[#080b0f]">
            <div className="divide-y divide-slate-100 dark:divide-[#141a22]">
              {projects.slice(0, compact ? 4 : projects.length).map((project) => (
                <div
                  key={project.id}
                  className="flex flex-col gap-4 p-5 transition hover:bg-slate-50/60 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-[#0b0f14]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-slate-400 dark:text-[#525e6e]">
                        #{project.id}
                      </span>
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {project.name}
                      </h3>
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.2 font-mono text-[9px] font-bold text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400">
                        ACTIVE
                      </span>
                    </div>

                    <p className="mt-1 truncate text-xs text-slate-500 dark:text-[#768597]">
                      {project.description || "No project description provided."}
                    </p>

                    <div className="mt-3 flex items-center gap-2">
                      {["AWS", "TERRAFORM", "INFRA"].map((tag) => (
                        <span
                          key={tag}
                          className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[9px] text-slate-500 dark:border-[#19202a] dark:bg-[#0e1217] dark:text-[#5c6b7e]"
                        >
                          {tag}
                        </span>
                      ))}
                      <span className="font-mono text-[10px] text-slate-400 dark:text-[#455263]">
                        Created {new Date(project.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <button
                      type="button"
                      onClick={() => navigate(`/projects/${project.id}/ai`)}
                      className="flex items-center gap-1.5 rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-1.5 text-xs font-semibold text-teal-600 transition hover:bg-teal-500/20 dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-300 dark:hover:bg-teal-400/20"
                    >
                      <IconAI className="h-3.5 w-3.5" />
                      <span>AI Builder</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openProject(project.id)}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-[#1e2531] dark:bg-[#0e1217] dark:text-slate-300 dark:hover:bg-[#151b22]"
                    >
                      <span>Workspace</span>
                      <IconChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ----------------------------------------------------
  // SECTION: PROJECTS FULL
  // ----------------------------------------------------
  function renderProjects() {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">
              Workspace
            </span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              Projects
            </h1>
            <p className="mt-1 max-w-2xl text-xs text-slate-500 dark:text-[#8090a2]">
              Manage all CloudForge infrastructure workspaces and launch attached tooling.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowNewProjectModal(true)}
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-500 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
          >
            <IconPlus className="h-4 w-4" />
            <span>New Project</span>
          </button>
        </div>

        {renderProjectList(false)}
      </div>
    )
  }

  // ----------------------------------------------------
  // SECTION: INFRASTRUCTURE
  // ----------------------------------------------------
  function renderInfrastructure() {
    return (
      <div className="space-y-6">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">
            Cloud Resources
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Infrastructure Workspaces
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-slate-500 dark:text-[#8090a2]">
            Inspect configured cloud providers, target regions, environment tiers, and Terraform files.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {projects.map((project) => (
            <div
              key={project.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-[#1c222b] dark:bg-[#080b0f]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-xs text-slate-400 dark:text-[#525e6e]">
                    PROJECT #{project.id}
                  </span>
                  <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                    {project.name}
                  </h3>
                </div>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[9px] font-bold text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400">
                  CONFIGURED
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-[#171e27] dark:bg-[#0c1015]">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                    Cloud Provider
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    AWS
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-[#171e27] dark:bg-[#0c1015]">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                    IaC Engine
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Terraform
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-[#171e27] dark:bg-[#0c1015]">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                    Target Tier
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Development
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-[#171e27] dark:bg-[#0c1015]">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                    Approval State
                  </p>
                  <p className="mt-1 text-xs font-semibold text-teal-600 dark:text-teal-400">
                    Ready
                  </p>
                </div>
              </div>

              <div className="mt-5 flex gap-2.5 pt-4 border-t border-slate-100 dark:border-[#141a22]">
                <button
                  type="button"
                  onClick={() => openProject(project.id)}
                  className="flex-1 rounded-lg bg-teal-600 py-2 text-center text-xs font-semibold text-white shadow-sm transition hover:bg-teal-500 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
                >
                  Manage Infrastructure
                </button>
                <button
                  type="button"
                  onClick={() => openTerraform(project.id)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-[#1e2531] dark:bg-[#0e1217] dark:text-slate-300 dark:hover:bg-[#151b22]"
                >
                  Terraform
                </button>
              </div>
            </div>
          ))}

          {projects.length === 0 && (
            <div className="col-span-2 rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-[#222a36]">
              <p className="text-xs text-slate-500 dark:text-[#768597]">
                No infrastructure workspaces available.
              </p>
              <button
                type="button"
                onClick={() => setShowNewProjectModal(true)}
                className="mt-3 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white dark:bg-teal-500 dark:text-slate-950"
              >
                Create Project
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ----------------------------------------------------
  // SECTION: AI INFRASTRUCTURE
  // ----------------------------------------------------
  function renderAI() {
    return (
      <div className="space-y-6">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">
            Intelligent Automation
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            AI Infrastructure Generator
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-slate-500 dark:text-[#8090a2]">
            Turn natural-language infrastructure requirements into structured cloud architecture and Terraform code.
          </p>
        </div>

        {/* Feature Hero Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-colors dark:border-[#1c222b] dark:bg-[#080b0f]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 ring-1 ring-teal-500/30 dark:bg-teal-400/10 dark:text-teal-400">
                <IconAI className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
                Autonomous Infrastructure Synthesis
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-[#768597]">
                Describe your target environment (e.g. 3-tier VPC with public/private subnets, EC2 microservices, and RDS PostgreSQL). CloudForge AI generates a verified architecture, deterministic Terraform configs, validation results, and execution plans.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-5 lg:w-72 dark:border-[#171e27] dark:bg-[#0c1015]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                Active Target Project
              </span>
              <p className="mt-1 font-semibold text-slate-900 dark:text-white truncate">
                {selectedProject?.name || "No workspace selected"}
              </p>
              <button
                type="button"
                disabled={!selectedProject}
                onClick={openAIInfrastructure}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-40 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
              >
                <IconAI className="h-4 w-4" />
                <span>Open AI Builder</span>
              </button>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Natural Language Prompt",
              desc: "Convert text specs into structured cloud topology without writing HCL from scratch.",
            },
            {
              title: "Deterministic Terraform",
              desc: "Modular files generated for main.tf, variables.tf, and outputs.tf ready for validation.",
            },
            {
              title: "Human Approval Gate",
              desc: "Review dry-run execution plan and approve artifacts prior to any deployment action.",
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#1c222b] dark:bg-[#080b0f]"
            >
              <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                {item.title}
              </h3>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-[#768597]">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ----------------------------------------------------
  // SECTION: DEPLOYMENTS
  // ----------------------------------------------------
  function renderDeployments() {
    return (
      <div className="space-y-6">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">
            Lifecycle Management
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Deployments
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-slate-500 dark:text-[#8090a2]">
            Audit deployment runs, inspect staged artifacts, and review approval history.
          </p>
        </div>

        {/* Deployment Policy Notice */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1c222b] dark:bg-[#080b0f]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Safe Mode Policy
              </span>
              <h2 className="mt-0.5 text-base font-semibold text-slate-900 dark:text-white">
                Zero Unauthorized Deployments
              </h2>
              <p className="mt-1 max-w-xl text-xs text-slate-500 dark:text-[#768597]">
                Live cloud deployments require an explicitly validated and approved Terraform artifact. All staging and planning can be performed locally.
              </p>
            </div>
            <span className="self-start rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 font-mono text-[10px] font-semibold text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300">
              POLICY ENFORCED
            </span>
          </div>
        </div>

        {/* Workspaces Pipeline list */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Project Deployment Pipelines
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((project) => (
              <div
                key={project.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#1c222b] dark:bg-[#080b0f]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-slate-400 dark:text-[#525e6e]">
                    PIPELINE #{project.id}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500 dark:text-[#657385]">
                    0 Active runs
                  </span>
                </div>
                <h3 className="mt-1 font-semibold text-slate-900 dark:text-white">
                  {project.name}
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-[#768597]">
                  Open Terraform workspace to generate plans and review approval state.
                </p>

                <button
                  type="button"
                  onClick={() => openTerraform(project.id)}
                  className="mt-4 flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-500 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
                >
                  <span>Open Pipeline Workflow</span>
                  <IconChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {projects.length === 0 && (
              <div className="col-span-2 rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500 dark:border-[#222a36] dark:text-[#768597]">
                No deployment pipelines configured yet. Create a project to begin.
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ----------------------------------------------------
  // SECTION: MONITORING
  // ----------------------------------------------------
  function renderMonitoring() {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">
              Operations & Telemetry
            </span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              Monitoring
            </h1>
            <p className="mt-1 max-w-2xl text-xs text-slate-500 dark:text-[#8090a2]">
              Real-time health telemetry of the CloudForge control plane and backend services.
            </p>
          </div>

          <button
            type="button"
            onClick={checkSystemHealth}
            disabled={health.status === "checking"}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-[#1e2531] dark:bg-[#0e1217] dark:text-slate-300 dark:hover:bg-[#151b22]"
          >
            <IconRefresh
              className={`h-3.5 w-3.5 ${health.status === "checking" ? "animate-spin text-teal-500" : ""}`}
            />
            <span>{health.status === "checking" ? "Checking API..." : "Check API Health"}</span>
          </button>
        </div>

        {/* Telemetry Cards Grid */}
        <div className="grid gap-5 md:grid-cols-3">
          {/* API Health Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1c222b] dark:bg-[#080b0f]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
              API Health
            </span>
            <div className="mt-3 flex items-center gap-2.5">
              <span
                className={`h-3 w-3 rounded-full ${
                  health.status === "online"
                    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                    : health.status === "offline"
                      ? "bg-red-500"
                      : "bg-amber-400 animate-pulse"
                }`}
              />
              <span className="text-base font-bold text-slate-900 dark:text-white">
                {health.status === "online"
                  ? "Operational"
                  : health.status === "checking"
                    ? "Checking..."
                    : health.status === "offline"
                      ? "Offline"
                      : "Ready"}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-[#768597]">
              {health.message}
            </p>
            {health.checkedAt && (
              <p className="mt-3 font-mono text-[10px] text-slate-400 dark:text-[#525e6e]">
                Last checked: {health.checkedAt}
              </p>
            )}
          </div>

          {/* Active Workspaces Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1c222b] dark:bg-[#080b0f]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
              Managed Projects
            </span>
            <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {projects.length}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-[#768597]">
              Active infrastructure workspaces registered.
            </p>
          </div>

          {/* AWS Live State Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1c222b] dark:bg-[#080b0f]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
              AWS Cloud Telemetry
            </span>
            <p className="mt-3 text-sm font-semibold text-amber-600 dark:text-amber-400">
              Safe-Mode Gate Active
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-[#768597]">
              Live cloud telemetry connects upon staging an approved Terraform deployment artifact.
            </p>
          </div>
        </div>

        {/* Roadmap section */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1c222b] dark:bg-[#080b0f]">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
            Monitoring Integration Grid
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {[
              ["API Health Telemetry", "ACTIVE", true],
              ["PostgreSQL Metrics", "ACTIVE", true],
              ["Prometheus Metrics", "PLANNED", false],
              ["Grafana Dashboards", "PLANNED", false],
            ].map(([title, st, isActive]) => (
              <div
                key={String(title)}
                className="rounded-lg border border-slate-100 bg-slate-50/50 p-3.5 dark:border-[#171e27] dark:bg-[#0c1015]"
              >
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {String(title)}
                </p>
                <span
                  className={`mt-2 inline-block font-mono text-[9px] font-bold ${
                    isActive
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-slate-400 dark:text-[#525e6e]"
                  }`}
                >
                  {String(st)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ----------------------------------------------------
  // SECTION: SETTINGS
  // ----------------------------------------------------
  function renderSettings() {
    return (
      <div className="max-w-3xl space-y-6">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">
            System
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Settings
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-[#8090a2]">
            Configure workspace preferences, theme appearance, and authentication session.
          </p>
        </div>

        {/* Theme Settings Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1c222b] dark:bg-[#080b0f]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Theme Appearance
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-[#768597]">
                Active: <span className="font-semibold">{isDark ? "Dark Mode" : "Light Mode"}</span>
              </p>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-[#1e2531] dark:bg-[#0e1217] dark:text-slate-300 dark:hover:bg-[#151b22]"
            >
              Switch to {isDark ? "Light" : "Dark"} Mode
            </button>
          </div>
        </div>

        {/* Authentication Session Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1c222b] dark:bg-[#080b0f]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Admin Session
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-[#768597]">
                Signed in as <span className="font-mono text-slate-700 dark:text-slate-300">admin@cloudforge.com</span>
              </p>
            </div>

            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-red-500/20 bg-red-500/10 px-3.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-500/20 dark:text-red-400"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Runtime specs */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1c222b] dark:bg-[#080b0f]">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
            Environment Specifications
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-xs dark:border-[#171e27] dark:bg-[#0c1015]">
              <span className="text-slate-400 dark:text-[#525e6e]">Frontend Client</span>
              <p className="mt-0.5 font-mono font-semibold text-slate-800 dark:text-slate-200">
                React 19 • Vite • Tailwind v4
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-xs dark:border-[#171e27] dark:bg-[#0c1015]">
              <span className="text-slate-400 dark:text-[#525e6e]">Control Plane API</span>
              <p className="mt-0.5 font-mono font-semibold text-slate-800 dark:text-slate-200">
                FastAPI :8000
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-xs dark:border-[#171e27] dark:bg-[#0c1015]">
              <span className="text-slate-400 dark:text-[#525e6e]">Persistence Engine</span>
              <p className="mt-0.5 font-mono font-semibold text-slate-800 dark:text-slate-200">
                PostgreSQL
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-xs dark:border-[#171e27] dark:bg-[#0c1015]">
              <span className="text-slate-400 dark:text-[#525e6e]">AI Runtime</span>
              <p className="mt-0.5 font-mono font-semibold text-slate-800 dark:text-slate-200">
                Ollama Local LLM
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  function renderActiveSection() {
    switch (activeSection) {
      case "projects":
        return renderProjects()
      case "infrastructure":
        return renderInfrastructure()
      case "ai":
        return renderAI()
      case "deployments":
        return renderDeployments()
      case "monitoring":
        return renderMonitoring()
      case "settings":
        return renderSettings()
      case "overview":
      default:
        return renderOverview()
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-[#030507] dark:text-slate-100">
      <Navbar
        onMenuToggle={() => setMobileMenuOpen(true)}
        healthStatus={health.status}
        breadcrumbs={[
          { label: "Console", onClick: () => openSection("overview") },
          { label: activeSection.charAt(0).toUpperCase() + activeSection.slice(1) },
        ]}
      />

      <div className="flex">
        <Sidebar
          activeSection={activeSection}
          onSelectSection={openSection}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          onLogout={logout}
          projectCount={projects.length}
        />

        <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">{renderActiveSection()}</div>
        </main>
      </div>

      {showNewProjectModal && (
        <NewProjectModal
          onClose={() => setShowNewProjectModal(false)}
          onProjectCreated={(newProject) => {
            setProjects((curr) => [newProject, ...curr])
            setShowNewProjectModal(false)
          }}
        />
      )}
    </div>
  )
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  statusSuccess = false,
}: {
  label: string
  value: string
  detail: string
  icon: ReactNode
  statusSuccess?: boolean
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-[#1c222b] dark:bg-[#080b0f]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
          {label}
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 ring-1 ring-slate-100 dark:bg-[#0e1217] dark:ring-[#171e27]">
          {icon}
        </div>
      </div>
      <p
        className={`mt-4 text-2xl font-bold tracking-tight ${
          statusSuccess ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-slate-400 dark:text-[#6c7b8d]">{detail}</p>
    </div>
  )
}

export default Dashboard
