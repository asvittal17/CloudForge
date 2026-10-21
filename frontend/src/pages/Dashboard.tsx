import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { useLocation, useNavigate } from "react-router-dom"

import {
  getProjects,
  getProjectsSummary,
  type ProjectsSummary,
} from "../services/api"
import { useTheme } from "../context/ThemeContext"
import { useHealth } from "../context/HealthContext"
import { useUser } from "../context/UserContext"
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
  IconSun,
  IconMoon,
  IconShield,
  IconNetwork,
  IconTerminal,
  IconFileCode,
} from "../components/Icons"

interface Project {
  id: number
  name: string
  description: string | null
  owner_id: number
  created_at: string
}

function Dashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isDark, toggleTheme } = useTheme()
  const { state: healthState, refresh: refreshHealth } = useHealth()
  const { user, signOut } = useUser()

  const [activeSection, setActiveSection] = useState<DashboardSection>(
    (location.state as { section?: DashboardSection } | null)?.section ??
      "overview",
  )
  const [projects, setProjects] = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [projectError, setProjectError] = useState("")
  const [summary, setSummary] = useState<ProjectsSummary | null>(null)
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  async function loadProjects() {
    try {
      setLoadingProjects(true)
      setProjectError("")
      const [projectsData, summaryData] = await Promise.all([
        getProjects(),
        getProjectsSummary().catch(() => null),
      ])
      setProjects(projectsData)
      setSummary(summaryData)
    } catch (error) {
      setProjectError(
        error instanceof Error ? error.message : "Failed to load projects"
      )
    } finally {
      setLoadingProjects(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time fetch; setState fires after await
    loadProjects()
  }, [])

  const selectedProject = projects[0] ?? null

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
    signOut()
    navigate("/login")
  }

  function refreshProjects() {
    void loadProjects()
  }

  function renderOverview() {
    return (
      <div className="space-y-8">
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
              onClick={openAIInfrastructure}
              disabled={!selectedProject}
              className="flex items-center gap-2 rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-2.5 text-xs font-semibold text-teal-700 shadow-sm transition hover:bg-teal-500/20 disabled:opacity-40 dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-300 dark:hover:bg-teal-400/20"
            >
              <IconAI className="h-4 w-4" />
              <span>AI Builder</span>
            </button>
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Workspaces"
            value={loadingProjects ? "..." : String(projects.length)}
            detail="Active project workspaces"
            icon={<IconProjects className="h-4 w-4" />}
            sparkColor="teal"
          />
          <MetricCard
            label="Deployments"
            value={
              summary ? String(summary.artifacts_deployed) : "..."
            }
            detail={
              summary && summary.artifacts_deployed > 0
                ? "Applied infrastructure stacks"
                : "No live deployment runs yet"
            }
            icon={<IconDeployments className="h-4 w-4" />}
            sparkColor="slate"
          />
          <MetricCard
            label="Infrastructure"
            value={summary ? String(summary.infrastructure) : "..."}
            detail={
              summary && summary.infrastructure > 0
                ? "Configured cloud targets"
                : "No infrastructure configured"
            }
            icon={<IconInfrastructure className="h-4 w-4" />}
            sparkColor="teal"
          />
          <MetricCard
            label="Control Plane"
            value={
              healthState.status === "ok"
                ? healthState.snapshot.status === "healthy"
                  ? "Online"
                  : healthState.snapshot.status === "unhealthy"
                    ? "Unhealthy"
                    : "Degraded"
                : healthState.status === "unreachable"
                  ? "Offline"
                  : "Checking"
            }
            detail={
              healthState.status === "ok"
                ? healthState.snapshot.database.message
                : "Real health check pending"
            }
            statusSuccess={healthState.status === "ok" && healthState.snapshot.status === "healthy"}
            failed={healthState.status === "unreachable" || (healthState.status === "ok" && healthState.snapshot.status === "unhealthy")}
            icon={<IconCheckCircle className="h-4 w-4" />}
            sparkColor={
              healthState.status === "ok" && healthState.snapshot.status === "healthy"
                ? "emerald"
                : "slate"
            }
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-[#1c222b] dark:bg-[#080b0f]">
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

            <div className="mt-6 relative">
              <div className="absolute top-5 left-[10%] right-[10%] hidden h-px bg-gradient-to-r from-teal-500/0 via-teal-500/30 to-teal-500/0 sm:block" />
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                {[
                  ["01", "Describe", "Prompt"],
                  ["02", "Generate", "Terraform"],
                  ["03", "Validate", "Syntax"],
                  ["04", "Plan", "Dry run"],
                  ["05", "Approve", "Gate"],
                ].map(([num, title, sub]) => (
                  <div
                    key={num}
                    className="relative rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 transition-all hover:border-teal-500/30 hover:bg-teal-500/5 dark:border-[#171e27] dark:bg-[#0c1015] dark:hover:border-teal-400/30 dark:hover:bg-teal-400/5"
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

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-[#1c222b] dark:bg-[#080b0f]">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                  Status
                </span>
                <h2 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                  Platform Services
                </h2>
              </div>
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {[
                { icon: <IconServer className="h-4 w-4 text-slate-400" />, name: "FastAPI Engine", status: "HEALTHY", color: "emerald" },
                { icon: <IconDatabase className="h-4 w-4 text-slate-400" />, name: "PostgreSQL DB", status: "CONNECTED", color: "emerald" },
                { icon: <IconCpu className="h-4 w-4 text-slate-400" />, name: "AI Runtime", status: "OLLAMA", color: "teal" },
              ].map((svc) => (
                <div key={svc.name} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-xs transition hover:border-slate-200 dark:border-[#171e27] dark:bg-[#0c1015] dark:hover:border-[#1e2531]">
                  <div className="flex items-center gap-2.5">
                    {svc.icon}
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {svc.name}
                    </span>
                  </div>
                  <span className={`font-mono text-[10px] font-semibold ${svc.color === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-teal-600 dark:text-teal-400"}`}>
                    {svc.status}
                  </span>
                </div>
              ))}
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

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1c222b] dark:bg-[#080b0f]">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                  Recent Activity
                </span>
                <h2 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                  Project Events
                </h2>
              </div>
              <button
                type="button"
                onClick={() => openSection("projects")}
                className="flex items-center gap-1 text-xs font-semibold text-teal-600 transition hover:text-teal-500 dark:text-teal-400 dark:hover:text-teal-300"
              >
                <span>View all</span>
                <IconChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {loadingProjects ? (
              <div className="mt-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 dark:border-[#171e27]">
                    <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-100 dark:bg-[#12161f]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100 dark:bg-[#12161f]" />
                      <div className="h-2.5 w-1/3 animate-pulse rounded bg-slate-100 dark:bg-[#12161f]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className="mt-4 rounded-lg border border-slate-100 p-6 text-center dark:border-[#171e27]">
                <p className="text-xs text-slate-400 dark:text-[#525e6e]">No recent activity to display.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {projects.slice(0, 5).map((project) => (
                  <div
                    key={project.id}
                    className="group flex items-center gap-3 rounded-lg border border-slate-100 p-3 transition hover:border-teal-500/20 hover:bg-teal-500/5 dark:border-[#171e27] dark:hover:border-teal-400/20 dark:hover:bg-teal-400/5"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 ring-1 ring-teal-500/20 dark:bg-teal-400/10 dark:text-teal-400 dark:ring-teal-400/20">
                      <IconProjects className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                        Project <span className="font-semibold text-slate-900 dark:text-white">"{project.name}"</span> created
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-[#525e6e]">
                        {new Date(project.created_at).toLocaleDateString()} at {new Date(project.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <IconChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:text-teal-500 dark:text-[#3a4553] dark:group-hover:text-teal-400" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1c222b] dark:bg-[#080b0f]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
              Quick Actions
            </span>
            <h2 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
              Common Tasks
            </h2>
            <div className="mt-5 space-y-2.5">
              <button
                type="button"
                onClick={() => setShowNewProjectModal(true)}
                className="flex w-full items-center gap-3 rounded-lg border border-slate-100 p-3 text-left transition hover:border-teal-500/20 hover:bg-teal-500/5 dark:border-[#171e27] dark:hover:border-teal-400/20 dark:hover:bg-teal-400/5"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:bg-teal-400/10 dark:text-teal-400">
                  <IconPlus className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Create Workspace</p>
                  <p className="text-[10px] text-slate-400 dark:text-[#525e6e]">Provision a new project environment</p>
                </div>
                <IconChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-[#3a4553]" />
              </button>

              <button
                type="button"
                onClick={openAIInfrastructure}
                disabled={!selectedProject}
                className="flex w-full items-center gap-3 rounded-lg border border-slate-100 p-3 text-left transition hover:border-teal-500/20 hover:bg-teal-500/5 disabled:opacity-40 dark:border-[#171e27] dark:hover:border-teal-400/20 dark:hover:bg-teal-400/5"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:bg-teal-400/10 dark:text-teal-400">
                  <IconAI className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">AI Builder</p>
                  <p className="text-[10px] text-slate-400 dark:text-[#525e6e]">Generate infrastructure with AI</p>
                </div>
                <IconChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-[#3a4553]" />
              </button>

              <button
                type="button"
                onClick={() => openSection("infrastructure")}
                className="flex w-full items-center gap-3 rounded-lg border border-slate-100 p-3 text-left transition hover:border-teal-500/20 hover:bg-teal-500/5 dark:border-[#171e27] dark:hover:border-teal-400/20 dark:hover:bg-teal-400/5"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:bg-teal-400/10 dark:text-teal-400">
                  <IconNetwork className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">View Infrastructure</p>
                  <p className="text-[10px] text-slate-400 dark:text-[#525e6e]">Inspect cloud resources</p>
                </div>
                <IconChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-[#3a4553]" />
              </button>
            </div>
          </div>
        </div>

        {renderProjectList(true)}
      </div>
    )
  }

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
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500/10 to-teal-500/5 text-teal-600 ring-1 ring-teal-500/20 dark:from-teal-400/10 dark:to-teal-400/5 dark:text-teal-400 dark:ring-teal-400/20">
              <IconProjects className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">
              No projects created yet
            </h3>
            <p className="mt-1 max-w-xs mx-auto text-xs text-slate-500 dark:text-[#768597]">
              Get started by provisioning your first CloudForge workspace and unlock AI-powered infrastructure generation.
            </p>
            <button
              type="button"
              onClick={() => setShowNewProjectModal(true)}
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-500 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
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
                  className="group flex flex-col gap-4 p-5 transition hover:bg-slate-50/60 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-[#0b0f14]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-slate-400 dark:text-[#525e6e]">
                        #{project.id}
                      </span>
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {project.name}
                      </h3>
                      <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.2 font-mono text-[9px] font-bold text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400">
                        <span className="h-1 w-1 rounded-full bg-emerald-500" />
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
                      <IconChevronRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
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

        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-[#222a36] dark:bg-[#080b0f]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500/10 to-teal-500/5 text-teal-600 ring-1 ring-teal-500/20 dark:from-teal-400/10 dark:to-teal-400/5 dark:text-teal-400 dark:ring-teal-400/20">
              <IconInfrastructure className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">
              No infrastructure workspaces
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-[#768597]">
              Create a project to begin configuring cloud resources.
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
          <div className="grid gap-5 md:grid-cols-2">
            {projects.map((project) => (
              <div
                key={project.id}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-teal-500/20 hover:shadow-md dark:border-[#1c222b] dark:bg-[#080b0f] dark:hover:border-teal-400/20"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 ring-1 ring-teal-500/20 dark:bg-teal-400/10 dark:text-teal-400 dark:ring-teal-400/20">
                      <IconServer className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="font-mono text-[10px] text-slate-400 dark:text-[#525e6e]">
                        PROJECT #{project.id}
                      </span>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                        {project.name}
                      </h3>
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[9px] font-bold text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400">
                    <span className="h-1 w-1 rounded-full bg-emerald-500" />
                    CONFIGURED
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  {[
                    { label: "Cloud Provider", value: "AWS" },
                    { label: "IaC Engine", value: "Terraform" },
                    { label: "Target Tier", value: "Development" },
                    { label: "Approval State", value: "Ready", accent: true },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 transition group-hover:border-slate-200 dark:border-[#171e27] dark:bg-[#0c1015] dark:group-hover:border-[#1e2531]">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                        {item.label}
                      </p>
                      <p className={`mt-1 text-xs font-semibold ${item.accent ? "text-teal-600 dark:text-teal-400" : "text-slate-800 dark:text-slate-200"}`}>
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex gap-2.5 border-t border-slate-100 pt-4 dark:border-[#141a22]">
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
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-[#1e2531] dark:bg-[#0e1217] dark:text-slate-300 dark:hover:bg-[#151b22]"
                  >
                    <IconTerminal className="h-3.5 w-3.5" />
                    <span>Terraform</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

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

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-7 shadow-sm dark:border-[#1c222b] dark:bg-[#080b0f]">
          <div className="absolute top-0 right-0 h-64 w-64 translate-x-1/3 -translate-y-1/3 rounded-full bg-teal-500/5 blur-3xl dark:bg-teal-400/5" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500/15 to-teal-500/5 text-teal-600 ring-1 ring-teal-500/30 dark:from-teal-400/15 dark:to-teal-400/5 dark:text-teal-400 dark:ring-teal-400/30">
                <IconAI className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
                From Prompt to Production-Ready Infrastructure
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-[#768597]">
                Describe your target environment in plain English. CloudForge AI synthesizes a verified architecture, deterministic Terraform configs, validation results, and an execution plan — all before any cloud resource is touched.
              </p>
              <div className="mt-5 flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <IconShield className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Safe by default</span>
                </div>
                <div className="flex items-center gap-2">
                  <IconTerminal className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Deterministic output</span>
                </div>
                <div className="flex items-center gap-2">
                  <IconNetwork className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Modular HCL</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-5 lg:w-72 dark:border-[#171e27] dark:bg-[#0c1015]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                Active Target Project
              </span>
              <p className="mt-1 truncate font-semibold text-slate-900 dark:text-white">
                {selectedProject?.name || "No workspace selected"}
              </p>
              {selectedProject && (
                <p className="mt-0.5 text-[10px] text-slate-400 dark:text-[#525e6e]">
                  ID: #{selectedProject.id}
                </p>
              )}
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

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: <IconTerminal className="h-4 w-4" />,
              title: "Natural Language Prompt",
              desc: "Convert text specs into structured cloud topology without writing HCL from scratch.",
            },
            {
              icon: <IconFileCode className="h-4 w-4" />,
              title: "Deterministic Terraform",
              desc: "Modular files generated for main.tf, variables.tf, and outputs.tf ready for validation.",
            },
            {
              icon: <IconShield className="h-4 w-4" />,
              title: "Human Approval Gate",
              desc: "Review dry-run execution plan and approve artifacts prior to any deployment action.",
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-teal-500/20 hover:shadow-md dark:border-[#1c222b] dark:bg-[#080b0f] dark:hover:border-teal-400/20"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 ring-1 ring-teal-500/20 transition group-hover:bg-teal-500/15 dark:bg-teal-400/10 dark:text-teal-400 dark:ring-teal-400/20">
                {item.icon}
              </div>
              <h3 className="mt-3 text-xs font-semibold text-slate-900 dark:text-white">
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

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 dark:border-amber-400/20 dark:bg-amber-400/5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20 dark:bg-amber-400/10 dark:text-amber-400 dark:ring-amber-400/20">
                <IconShield className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Safe Mode Policy
                </span>
                <h2 className="mt-0.5 text-base font-semibold text-slate-900 dark:text-white">
                  Zero Unauthorized Deployments
                </h2>
                <p className="mt-1 max-w-xl text-xs text-slate-500 dark:text-[#768597]">
                  Live cloud deployments require an explicitly validated and approved Terraform artifact. All staging and planning can be performed locally without risk.
                </p>
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 self-start rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 font-mono text-[10px] font-semibold text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              POLICY ENFORCED
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Project Deployment Pipelines
          </h2>

          {projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-[#222a36] dark:bg-[#080b0f]">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500/10 to-teal-500/5 text-teal-600 ring-1 ring-teal-500/20 dark:from-teal-400/10 dark:to-teal-400/5 dark:text-teal-400 dark:ring-teal-400/20">
                <IconDeployments className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">
                No deployment pipelines
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-[#768597]">
                Create a project to begin setting up deployment pipelines.
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
            <div className="grid gap-4 md:grid-cols-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-teal-500/20 hover:shadow-md dark:border-[#1c222b] dark:bg-[#080b0f] dark:hover:border-teal-400/20"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-400 dark:text-[#525e6e]">
                      PIPELINE #{project.id}
                    </span>
                    <span className="flex items-center gap-1.5 font-mono text-[10px] text-slate-500 dark:text-[#657385]">
                      <span className="h-1 w-1 rounded-full bg-slate-400" />
                      0 Active runs
                    </span>
                  </div>
                  <h3 className="mt-1 font-semibold text-slate-900 dark:text-white">
                    {project.name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-[#768597]">
                    Open Terraform workspace to generate plans and review approval state.
                  </p>

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openTerraform(project.id)}
                      className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-500 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
                    >
                      <span>Open Pipeline Workflow</span>
                      <IconChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  function renderMonitoring() {
    const healthOk = healthState.status === "ok"
    const overall =
      healthOk
        ? healthState.snapshot.status
        : healthState.status === "unreachable"
          ? "unreachable"
          : "unknown"

    const serviceRows = [
      {
        name: "FastAPI backend",
        status: healthOk ? healthState.snapshot.api.status : overall === "unreachable" ? "unhealthy" : "unknown",
        message: healthOk ? healthState.snapshot.api.message : "Backend not reachable",
      },
      {
        name: "PostgreSQL database",
        status: healthOk ? healthState.snapshot.database.status : "unknown",
        message: healthOk
          ? `${healthState.snapshot.database.message}${
              healthState.snapshot.database.latency_ms != null
                ? ` (${healthState.snapshot.database.latency_ms}ms)`
                : ""
            }`
          : "Database health unknown",
      },
      {
        name: "Ollama runtime",
        status: healthOk ? healthState.snapshot.ollama.status : "unknown",
        message: healthOk ? healthState.snapshot.ollama.message : "Ollama health unknown",
      },
    ]

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
              Real health checks against the control plane and backend services.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => void refreshHealth()}
              disabled={healthState.status === "unknown"}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-[#1e2531] dark:bg-[#0e1217] dark:text-slate-300 dark:hover:bg-[#151b22]"
            >
              <IconRefresh className="h-3.5 w-3.5" />
              <span>Recheck services</span>
            </button>
            <button
              type="button"
              onClick={() => navigate("/monitoring")}
              className="flex items-center gap-2 rounded-lg border border-teal-500/30 bg-teal-500/10 px-3.5 py-2 text-xs font-semibold text-teal-700 transition hover:bg-teal-500/20 dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-300"
            >
              <span>Full monitoring</span>
              <IconChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Overall banner */}
        <div
          className={`rounded-2xl border p-5 ${
            overall === "healthy"
              ? "border-emerald-500/25 bg-emerald-500/5"
              : overall === "unhealthy" || overall === "unreachable"
                ? "border-red-500/25 bg-red-500/5"
                : "border-amber-500/25 bg-amber-500/5"
          }`}
        >
          <div className="flex items-center gap-3">
            <IconCheckCircle
              className={`h-5 w-5 ${
                overall === "healthy"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : overall === "unknown"
                    ? "text-amber-500"
                    : "text-red-500"
              }`}
            />
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {overall === "healthy"
                  ? "All systems operational"
                  : overall === "unhealthy" || overall === "unreachable"
                    ? "Service problems detected"
                    : "Health unknown — waiting for the first check"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-[#768597]">
                {healthOk
                  ? `Last verified ${new Date(healthState.snapshot.checked_at).toLocaleTimeString()} (auto-checks every 30s)`
                  : "Checks run automatically every 30 seconds."}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {serviceRows.map((service) => (
            <div
              key={service.name}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-[#1c222b] dark:bg-[#080b0f]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
                  {service.name}
                </span>
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    service.status === "healthy"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : service.status === "unhealthy"
                        ? "bg-red-500/10 text-red-600 dark:text-red-400"
                        : "bg-slate-500/10 text-slate-500"
                  }`}
                >
                  <IconCheckCircle className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2.5">
                <span
                  className={`relative inline-flex h-3 w-3 rounded-full ${
                    service.status === "healthy"
                      ? "bg-emerald-500"
                      : service.status === "unhealthy"
                        ? "bg-red-500"
                        : "bg-slate-400"
                  }`}
                />
                <span className="text-base font-bold text-slate-900 capitalize dark:text-white">
                  {service.status}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-slate-500 dark:text-[#768597]">
                {service.message}
              </p>
            </div>
          ))}
        </div>
      </div>
    )
  }

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

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-[#1c222b] dark:bg-[#080b0f]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 ring-1 ring-teal-500/20 dark:bg-teal-400/10 dark:text-teal-400 dark:ring-teal-400/20">
                {isDark ? <IconMoon className="h-5 w-5" /> : <IconSun className="h-5 w-5" />}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Theme Appearance
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-[#768597]">
                  Active: <span className="font-semibold">{isDark ? "Dark Mode" : "Light Mode"}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="relative flex h-7 w-12 items-center rounded-full border border-slate-200 bg-slate-100 px-0.5 transition dark:border-[#1e2531] dark:bg-[#12161f]"
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm transition-transform dark:bg-[#1c222b] ${
                  isDark ? "translate-x-5" : "translate-x-0"
                }`}
              >
                {isDark ? (
                  <IconMoon className="h-3 w-3 text-teal-400" />
                ) : (
                  <IconSun className="h-3 w-3 text-amber-500" />
                )}
              </span>
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-[#1c222b] dark:bg-[#080b0f]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 ring-1 ring-teal-500/20 dark:bg-teal-400/10 dark:text-teal-400 dark:ring-teal-400/20">
                <IconShield className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Signed-in session
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-[#768597]">
                  Signed in as{" "}
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {user ? user.email : "…"}
                  </span>
                  {user?.role === "admin" && (
                    <span className="ml-2 rounded bg-purple-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-purple-600 dark:text-purple-300">
                      admin
                    </span>
                  )}
                </p>
              </div>
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

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-[#1c222b] dark:bg-[#080b0f]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 ring-1 ring-teal-500/20 dark:bg-teal-400/10 dark:text-teal-400 dark:ring-teal-400/20">
              <IconServer className="h-5 w-5" />
            </div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
              Environment Specifications
            </h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              { label: "Frontend Client", value: "React 19 • Vite • Tailwind v4" },
              { label: "Control Plane API", value: "FastAPI :8000" },
              { label: "Persistence Engine", value: "PostgreSQL" },
              { label: "AI Runtime", value: "Ollama Local LLM" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-xs transition hover:border-slate-200 dark:border-[#171e27] dark:bg-[#0c1015] dark:hover:border-[#1e2531]">
                <span className="text-slate-400 dark:text-[#525e6e]">{item.label}</span>
                <p className="mt-0.5 font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {item.value}
                </p>
              </div>
            ))}
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
  failed = false,
  sparkColor = "teal",
}: {
  label: string
  value: string
  detail: string
  icon: ReactNode
  statusSuccess?: boolean
  failed?: boolean
  sparkColor?: "teal" | "slate" | "emerald"
}) {
  const sparkColors: Record<string, string> = {
    teal: "M0 28 L4 26 L8 27 L12 24 L16 25 L20 22 L24 23 L28 20 L32 21 L36 18 L40 19 L44 16 L48 17",
    slate: "M0 28 L4 27 L8 28 L12 26 L16 27 L20 25 L24 26 L28 24 L32 25 L36 23 L40 24 L44 22 L48 23",
    emerald: "M0 28 L4 25 L8 26 L12 22 L16 23 L20 19 L24 20 L28 16 L32 17 L36 13 L40 14 L44 10 L48 11",
  }

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-teal-500/20 hover:shadow-md dark:border-[#1c222b] dark:bg-[#080b0f] dark:hover:border-teal-400/20">
      <div className="absolute bottom-0 right-0 opacity-[0.03] transition-opacity group-hover:opacity-[0.06] dark:opacity-[0.04] dark:group-hover:opacity-[0.08]">
        <svg width="80" height="32" viewBox="0 0 48 32" fill="none">
          <path
            d={sparkColors[sparkColor]}
            stroke="currentColor"
            strokeWidth="1.5"
            className={sparkColor === "emerald" ? "text-emerald-500" : sparkColor === "slate" ? "text-slate-400" : "text-teal-500"}
          />
        </svg>
      </div>
      <div className="relative flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
          {label}
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 ring-1 ring-slate-100 transition group-hover:ring-teal-500/20 dark:bg-[#0e1217] dark:ring-[#171e27]">
          {icon}
        </div>
      </div>
      <p
        className={`relative mt-4 text-2xl font-bold tracking-tight ${
          failed
            ? "text-red-600 dark:text-red-400"
            : statusSuccess
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-slate-900 dark:text-white"
        }`}
      >
        {value}
      </p>
      <p className="relative mt-1 truncate text-xs text-slate-400 dark:text-[#6c7b8d]">{detail}</p>
    </div>
  )
}

export default Dashboard
