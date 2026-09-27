import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { useNavigate } from "react-router-dom"

import { getProjects } from "../services/api"
import NewProjectModal from "../components/NewProjectModal"

interface Project {
  id: number
  name: string
  description: string | null
  owner_id: number
  created_at: string
}

type Section =
  | "overview"
  | "projects"
  | "infrastructure"
  | "ai"
  | "deployments"
  | "monitoring"
  | "settings"

interface HealthState {
  status: "idle" | "checking" | "online" | "offline"
  message: string
  checkedAt: string | null
}

const API_BASE_URL = "http://localhost:8000"

function Dashboard() {
  const navigate = useNavigate()

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("cloudforge_theme") !== "light"
  })

  const [activeSection, setActiveSection] =
    useState<Section>("overview")

  const [projects, setProjects] = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [projectError, setProjectError] = useState("")
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const [health, setHealth] = useState<HealthState>({
    status: "idle",
    message: "Not checked yet",
    checkedAt: null,
  })

  const theme = darkMode
    ? {
        page: "bg-[#080b0d] text-[#eef5f3]",
        header: "bg-[#0c1012]/95 border-[#202a2d]",
        sidebar: "bg-[#0b0f11] border-[#202a2d]",
        card: "bg-[#101517] border-[#202a2d]",
        cardStrong: "bg-[#12191b] border-[#273437]",
        muted: "text-[#8a9997]",
        subtle: "text-[#536261]",
        hover: "hover:bg-[#151d20]",
        input: "bg-[#0b0f11] border-[#293437]",
      }
    : {
        page: "bg-[#f4f8f7] text-[#14201e]",
        header: "bg-white/95 border-[#dbe5e2]",
        sidebar: "bg-white border-[#dbe5e2]",
        card: "bg-white border-[#dbe5e2]",
        cardStrong: "bg-[#f9fcfb] border-[#d2dfdc]",
        muted: "text-[#63726f]",
        subtle: "text-[#84928f]",
        hover: "hover:bg-[#eef4f2]",
        input: "bg-[#f8fbfa] border-[#d5e1de]",
      }

  useEffect(() => {
    async function loadProjects() {
      try {
        setLoadingProjects(true)
        setProjectError("")
        const data = await getProjects()
        setProjects(data)
      } catch (error) {
        setProjectError(
          error instanceof Error
            ? error.message
            : "Failed to load projects"
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
        message: data.status === "healthy"
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

  function openSection(section: Section) {
    setActiveSection(section)
    setMobileMenuOpen(false)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function openAIInfrastructure() {
    if (!selectedProject) {
      setProjectError(
        "Create a project before using AI Infrastructure."
      )
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

  const navigation: {
    id: Section
    label: string
    icon: string
    description: string
  }[] = [
    {
      id: "overview",
      label: "Overview",
      icon: "⌂",
      description: "Workspace overview",
    },
    {
      id: "projects",
      label: "Projects",
      icon: "◇",
      description: "Manage workspaces",
    },
    {
      id: "infrastructure",
      label: "Infrastructure",
      icon: "△",
      description: "Cloud architecture",
    },
    {
      id: "ai",
      label: "AI Infrastructure",
      icon: "✦",
      description: "Generate infrastructure",
    },
    {
      id: "deployments",
      label: "Deployments",
      icon: "↗",
      description: "Terraform workflow",
    },
    {
      id: "monitoring",
      label: "Monitoring",
      icon: "◉",
      description: "System health",
    },
    {
      id: "settings",
      label: "Settings",
      icon: "⚙",
      description: "Workspace preferences",
    },
  ]

  function renderHeader() {
    return (
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-xl ${theme.header}`}
      >
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border lg:hidden ${theme.card}`}
              aria-label="Open navigation"
            >
              ☰
            </button>

            <button
              type="button"
              onClick={() => openSection("overview")}
              className="flex items-center gap-3"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#28d7c5]/30 bg-[#11191a]">
                <div className="h-3 w-3 rounded-full bg-[#28d7c5] shadow-[0_0_16px_rgba(40,215,197,0.65)]" />
              </div>

              <div className="text-left">
                <p className="text-sm font-semibold tracking-wide">
                  CloudForge
                </p>
                <p className={`text-[10px] uppercase tracking-[0.16em] ${theme.subtle}`}>
                  Control Plane
                </p>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <button
              type="button"
              onClick={() => {
                const next = !darkMode
                setDarkMode(next)
                localStorage.setItem(
                  "cloudforge_theme",
                  next ? "dark" : "light"
                )
              }}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border ${theme.card} transition hover:border-[#28d7c5]/50`}
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? "☀" : "☾"}
            </button>

            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">CloudForge Admin</p>
              <p className={`text-xs ${theme.subtle}`}>
                Administrator
              </p>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#172324] text-xs font-semibold text-[#28d7c5] ring-1 ring-[#28d7c5]/20">
              CA
            </div>
          </div>
        </div>
      </header>
    )
  }

  function renderSidebar(mobile = false) {
    return (
      <aside
        className={
          mobile
            ? `fixed inset-y-0 left-0 z-50 w-72 border-r p-4 shadow-2xl ${theme.sidebar}`
            : `hidden min-h-[calc(100vh-4rem)] w-64 shrink-0 border-r lg:block ${theme.sidebar}`
        }
      >
        {mobile && (
          <div className="mb-6 flex items-center justify-between">
            <p className="text-sm font-semibold">Navigation</p>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className={`h-8 w-8 rounded-lg border ${theme.card}`}
            >
              ×
            </button>
          </div>
        )}

        <div className="mb-5 px-3 pt-2">
          <p
            className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${theme.subtle}`}
          >
            Workspace
          </p>
        </div>

        <nav className="space-y-1">
          {navigation.slice(0, 5).map((item) => {
            const active = activeSection === item.id

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === "ai") {
                    openAIInfrastructure()
                    return
                  }
                  openSection(item.id)
                }}
                className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition ${
                  active
                    ? "border-[#28d7c5]/20 bg-[#28d7c5]/7 text-[#28d7c5]"
                    : `border-transparent ${theme.muted} ${theme.hover}`
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm ${
                    active
                      ? "bg-[#28d7c5]/10 text-[#28d7c5]"
                      : `${theme.card} ${theme.muted}`
                  }`}
                >
                  {item.icon}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{item.label}</span>
                  <span className={`hidden text-[10px] xl:block ${theme.subtle}`}>
                    {item.description}
                  </span>
                </span>

                {active && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#28d7c5]" />
                )}
              </button>
            )
          })}
        </nav>

        <div className="mb-2 mt-8 px-3">
          <p
            className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${theme.subtle}`}
          >
            Operations
          </p>
        </div>

        <nav className="space-y-1">
          {navigation.slice(5).map((item) => {
            const active = activeSection === item.id

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => openSection(item.id)}
                className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition ${
                  active
                    ? "border-[#28d7c5]/20 bg-[#28d7c5]/7 text-[#28d7c5]"
                    : `border-transparent ${theme.muted} ${theme.hover}`
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    active
                      ? "bg-[#28d7c5]/10 text-[#28d7c5]"
                      : `${theme.card} ${theme.muted}`
                  }`}
                >
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{item.label}</span>
                  <span className={`hidden text-[10px] xl:block ${theme.subtle}`}>
                    {item.description}
                  </span>
                </span>
                {active && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#28d7c5]" />
                )}
              </button>
            )
          })}
        </nav>

        <div className={`mt-8 rounded-xl border p-4 ${theme.card}`}>
          <p className="text-xs font-semibold">Workspace status</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#63e6be] shadow-[0_0_9px_rgba(99,230,190,0.7)]" />
            <span className="text-xs text-[#63e6be]">
              API operational
            </span>
          </div>
          <p className={`mt-2 text-[10px] leading-5 ${theme.subtle}`}>
            Cloud resources are not deployed from this dashboard automatically.
          </p>
        </div>
      </aside>
    )
  }

  function renderOverview() {
    return (
      <>
        <section className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#28d7c5]">
              Workspace
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Overview
            </h1>
            <p className={`mt-2 max-w-2xl text-sm leading-6 ${theme.muted}`}>
              Design, validate, approve, and manage cloud infrastructure from one control plane.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowNewProjectModal(true)}
            className="rounded-xl bg-[#28d7c5] px-5 py-3 text-sm font-semibold text-[#07100f] shadow-[0_8px_30px_rgba(40,215,197,0.14)] transition hover:bg-[#63e6be]"
          >
            + New Project
          </button>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Projects"
            value={loadingProjects ? "—" : String(projects.length)}
            detail="Active workspaces"
            icon="◇"
            theme={theme}
          />

          <MetricCard
            label="Deployments"
            value="0"
            detail="No live deployments"
            icon="↗"
            theme={theme}
          />

          <MetricCard
            label="Infrastructure"
            value={String(infrastructureCount)}
            detail="Managed workspaces"
            icon="△"
            theme={theme}
          />

          <MetricCard
            label="System status"
            value="Online"
            detail="API operational"
            icon="●"
            success
            theme={theme}
          />
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
          <div className={`rounded-2xl border p-6 ${theme.card}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wider ${theme.subtle}`}>
                  Infrastructure workflow
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                  From intent to approved Terraform
                </h2>
                <p className={`mt-2 text-sm leading-6 ${theme.muted}`}>
                  CloudForge keeps infrastructure generation and approval separate from real AWS deployment.
                </p>
              </div>

              <span className="rounded-full border border-[#28d7c5]/20 bg-[#28d7c5]/5 px-3 py-1 text-[10px] font-semibold text-[#28d7c5]">
                CONTROLLED
              </span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-5">
              {[
                ["01", "Describe", "Natural language"],
                ["02", "Generate", "AI architecture"],
                ["03", "Validate", "Terraform checks"],
                ["04", "Plan", "Preview changes"],
                ["05", "Approve", "Human approval"],
              ].map(([number, title, detail]) => (
                <div
                  key={number}
                  className={`rounded-xl border p-4 ${theme.cardStrong}`}
                >
                  <p className="text-[10px] font-semibold text-[#28d7c5]">
                    {number}
                  </p>
                  <p className="mt-3 text-sm font-semibold">{title}</p>
                  <p className={`mt-1 text-[10px] leading-4 ${theme.subtle}`}>
                    {detail}
                  </p>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={openAIInfrastructure}
              disabled={!selectedProject}
              className="mt-6 rounded-xl border border-[#28d7c5]/30 bg-[#28d7c5]/5 px-4 py-2.5 text-sm font-semibold text-[#28d7c5] transition hover:bg-[#28d7c5]/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ✦ Open AI Infrastructure
            </button>
          </div>

          <div className={`rounded-2xl border p-6 ${theme.card}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wider ${theme.subtle}`}>
                  System
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                  Platform health
                </h2>
              </div>
              <span className="h-2.5 w-2.5 rounded-full bg-[#63e6be] shadow-[0_0_12px_rgba(99,230,190,0.6)]" />
            </div>

            <div className={`mt-6 rounded-xl border p-4 ${theme.cardStrong}`}>
              <div className="flex items-center justify-between gap-4">
                <span className={`text-sm ${theme.muted}`}>
                  FastAPI
                </span>
                <span className="text-xs font-semibold text-[#63e6be]">
                  Operational
                </span>
              </div>
              <div className={`mt-3 h-1.5 overflow-hidden rounded-full ${darkMode ? "bg-[#1c2829]" : "bg-[#e1ece9]"}`}>
                <div className="h-full w-full rounded-full bg-[#28d7c5]" />
              </div>
            </div>

            <div className={`mt-3 rounded-xl border p-4 ${theme.cardStrong}`}>
              <div className="flex items-center justify-between gap-4">
                <span className={`text-sm ${theme.muted}`}>
                  PostgreSQL
                </span>
                <span className="text-xs font-semibold text-[#63e6be]">
                  Connected
                </span>
              </div>
              <div className={`mt-3 h-1.5 overflow-hidden rounded-full ${darkMode ? "bg-[#1c2829]" : "bg-[#e1ece9]"}`}>
                <div className="h-full w-full rounded-full bg-[#63e6be]" />
              </div>
            </div>

            <button
              type="button"
              onClick={() => openSection("monitoring")}
              className={`mt-5 w-full rounded-xl border px-4 py-2.5 text-sm font-medium ${theme.muted} transition hover:border-[#28d7c5]/40 hover:text-[#28d7c5]`}
            >
              Open Monitoring →
            </button>
          </div>
        </section>

        {renderProjectList(true)}
      </>
    )
  }

  function renderProjectList(compact = false) {
    return (
      <section className={`${compact ? "mt-8" : ""}`}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wider ${theme.subtle}`}>
              {compact ? "Recent workspaces" : "Projects"}
            </p>
            <h2 className="mt-1 text-xl font-semibold">
              Your CloudForge projects
            </h2>
          </div>

          <button
            type="button"
            onClick={() => openSection("projects")}
            className="text-xs font-semibold text-[#28d7c5] hover:text-[#63e6be]"
          >
            View all →
          </button>
        </div>

        <div className={`overflow-hidden rounded-2xl border ${theme.card}`}>
          {loadingProjects ? (
            <div className="p-8 text-sm">
              <p className={theme.muted}>Loading projects...</p>
            </div>
          ) : projectError ? (
            <div className="p-8">
              <p className="text-sm text-red-400">{projectError}</p>
              <button
                type="button"
                onClick={refreshProjects}
                className="mt-4 rounded-lg border border-red-500/30 px-3 py-2 text-xs text-red-300"
              >
                Retry
              </button>
            </div>
          ) : projects.length === 0 ? (
            <div className="p-8">
              <p className="font-medium">No projects yet</p>
              <p className={`mt-1 text-sm ${theme.muted}`}>
                Create your first CloudForge workspace.
              </p>
              <button
                type="button"
                onClick={() => setShowNewProjectModal(true)}
                className="mt-4 rounded-lg bg-[#28d7c5] px-4 py-2 text-sm font-semibold text-[#07100f]"
              >
                + Create project
              </button>
            </div>
          ) : (
            projects.slice(0, compact ? 4 : projects.length).map((project) => (
              <div
                key={project.id}
                className={`flex flex-col gap-5 border-b p-6 last:border-b-0 ${darkMode ? "border-[#202a2d]" : "border-[#dbe5e2]"} lg:flex-row lg:items-center lg:justify-between`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="truncate font-semibold">
                      {project.name}
                    </h3>
                    <span className="rounded-full border border-[#63e6be]/20 bg-[#63e6be]/5 px-2 py-0.5 text-[10px] font-semibold text-[#63e6be]">
                      ACTIVE
                    </span>
                  </div>

                  <p className={`mt-2 max-w-2xl text-sm ${theme.muted}`}>
                    {project.description || "No project description provided."}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {["AWS", "TERRAFORM", "DOCKER"].map((tag) => (
                      <span
                        key={tag}
                        className={`rounded-md border px-2 py-1 font-mono text-[9px] ${theme.header} ${theme.muted}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/projects/${project.id}/ai`)}
                    className="rounded-lg border border-[#28d7c5]/30 bg-[#28d7c5]/5 px-3 py-2 text-xs font-semibold text-[#28d7c5] transition hover:bg-[#28d7c5]/10"
                  >
                    ✦ AI Architecture
                  </button>

                  <button
                    type="button"
                    onClick={() => openProject(project.id)}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold ${theme.muted} transition hover:border-[#28d7c5]/40 hover:text-[#28d7c5]`}
                  >
                    Open Project →
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    )
  }

  function renderProjects() {
    return (
      <>
        <PageHeading
          eyebrow="Workspace"
          title="Projects"
          description="Manage your CloudForge infrastructure workspaces and open the tools attached to each project."
          theme={theme}
          action={
            <button
              type="button"
              onClick={() => setShowNewProjectModal(true)}
              className="rounded-xl bg-[#28d7c5] px-5 py-3 text-sm font-semibold text-[#07100f]"
            >
              + New Project
            </button>
          }
        />

        {renderProjectList(false)}
      </>
    )
  }

  function renderInfrastructure() {
    return (
      <>
        <PageHeading
          eyebrow="Cloud resources"
          title="Infrastructure"
          description="Open a project to inspect its configured cloud provider, region, environment, and infrastructure architecture."
          theme={theme}
        />

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {projects.map((project) => (
            <div key={project.id} className={`rounded-2xl border p-6 ${theme.card}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={`text-[10px] uppercase tracking-wider ${theme.subtle}`}>
                    Project
                  </p>
                  <h2 className="mt-2 text-lg font-semibold">
                    {project.name}
                  </h2>
                </div>
                <span className="rounded-full border border-[#63e6be]/20 bg-[#63e6be]/5 px-2.5 py-1 text-[10px] font-semibold text-[#63e6be]">
                  ACTIVE
                </span>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <InfoBox label="Provider" value="AWS" theme={theme} />
                <InfoBox label="IaC" value="Terraform" theme={theme} />
                <InfoBox label="Environment" value="Project managed" theme={theme} />
                <InfoBox label="Status" value="Ready" theme={theme} />
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => openProject(project.id)}
                  className="flex-1 rounded-lg bg-[#28d7c5] px-4 py-2.5 text-xs font-semibold text-[#07100f]"
                >
                  Manage infrastructure
                </button>
                <button
                  type="button"
                  onClick={() => openTerraform(project.id)}
                  className={`rounded-lg border px-4 py-2.5 text-xs font-semibold ${theme.muted} hover:border-[#28d7c5]/40 hover:text-[#28d7c5]`}
                >
                  Terraform
                </button>
              </div>
            </div>
          ))}

          {projects.length === 0 && (
            <EmptyState
              title="No infrastructure workspaces"
              description="Create a project first, then configure its cloud infrastructure."
              action="Create project"
              onAction={() => setShowNewProjectModal(true)}
              theme={theme}
            />
          )}
        </div>
      </>
    )
  }

  function renderAI() {
    return (
      <>
        <PageHeading
          eyebrow="AI-powered control plane"
          title="AI Infrastructure"
          description="Turn natural-language infrastructure requirements into architecture and Terraform through the CloudForge approval workflow."
          theme={theme}
        />

        <div className={`mt-8 rounded-2xl border p-6 ${theme.card}`}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#28d7c5]/10 text-xl text-[#28d7c5]">
                ✦
              </div>
              <h2 className="mt-5 text-2xl font-semibold">
                Infrastructure Generator
              </h2>
              <p className={`mt-2 text-sm leading-6 ${theme.muted}`}>
                Describe a target architecture. CloudForge AI generates a structured plan, Terraform, validation results, staging artifact, plan, and approval workflow.
              </p>
            </div>

            <div className={`rounded-xl border p-5 lg:w-80 ${theme.cardStrong}`}>
              <p className={`text-[10px] uppercase tracking-wider ${theme.subtle}`}>
                Active project
              </p>
              <p className="mt-2 font-semibold">
                {selectedProject?.name || "No project selected"}
              </p>
              <button
                type="button"
                disabled={!selectedProject}
                onClick={openAIInfrastructure}
                className="mt-5 w-full rounded-lg bg-[#28d7c5] px-4 py-2.5 text-sm font-semibold text-[#07100f] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Open AI Generator →
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            ["AI Architecture", "Natural language → structured cloud architecture"],
            ["Terraform Automation", "Architecture → validated infrastructure code"],
            ["Approval Control", "Plan → human approval before deployment"],
          ].map(([title, detail]) => (
            <div key={title} className={`rounded-2xl border p-5 ${theme.card}`}>
              <p className="text-sm font-semibold">{title}</p>
              <p className={`mt-2 text-xs leading-5 ${theme.muted}`}>
                {detail}
              </p>
            </div>
          ))}
        </div>
      </>
    )
  }

  function renderDeployments() {
    return (
      <>
        <PageHeading
          eyebrow="Infrastructure lifecycle"
          title="Deployments"
          description="Use the project Terraform workflow to validate, stage, plan, approve, and eventually deploy infrastructure."
          theme={theme}
        />

        <div className={`mt-8 rounded-2xl border p-6 ${theme.card}`}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className={`text-xs uppercase tracking-wider ${theme.subtle}`}>
                Controlled deployment pipeline
              </p>
              <h2 className="mt-2 text-xl font-semibold">
                No live deployment executed from this dashboard
              </h2>
              <p className={`mt-2 max-w-2xl text-sm leading-6 ${theme.muted}`}>
                Real AWS deployment remains a deliberate final step. You can still fully test the local validation, staging, planning, and approval workflow.
              </p>
            </div>

            <span className="rounded-full border border-amber-400/20 bg-amber-400/5 px-3 py-1.5 text-xs font-semibold text-amber-300">
              DEPLOYMENT CONTROLLED
            </span>
          </div>

          <div className="mt-7 grid gap-3 md:grid-cols-5">
            {[
              ["1", "Generate"],
              ["2", "Validate"],
              ["3", "Stage"],
              ["4", "Plan"],
              ["5", "Approve"],
            ].map(([number, title]) => (
              <div
                key={number}
                className={`rounded-xl border p-4 ${theme.cardStrong}`}
              >
                <span className="text-xs font-bold text-[#28d7c5]">
                  {number}
                </span>
                <p className="mt-2 text-sm font-semibold">{title}</p>
              </div>
            ))}
          </div>
        </div>

        <section className="mt-8">
          <div className="mb-4">
            <p className={`text-xs uppercase tracking-wider ${theme.subtle}`}>
              Project pipelines
            </p>
            <h2 className="mt-1 text-xl font-semibold">
              Open a Terraform workflow
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((project) => (
              <div key={project.id} className={`rounded-2xl border p-5 ${theme.card}`}>
                <p className={`text-xs ${theme.subtle}`}>PROJECT</p>
                <h3 className="mt-2 font-semibold">{project.name}</h3>
                <p className={`mt-2 text-xs leading-5 ${theme.muted}`}>
                  Open the Terraform workspace to continue the controlled lifecycle.
                </p>
                <button
                  type="button"
                  onClick={() => openTerraform(project.id)}
                  className="mt-5 rounded-lg bg-[#28d7c5] px-4 py-2.5 text-xs font-semibold text-[#07100f]"
                >
                  Open Terraform workflow →
                </button>
              </div>
            ))}

            {projects.length === 0 && (
              <EmptyState
                title="No deployment pipelines"
                description="Create a project to begin an infrastructure lifecycle."
                action="Create project"
                onAction={() => setShowNewProjectModal(true)}
                theme={theme}
              />
            )}
          </div>
        </section>
      </>
    )
  }

  function renderMonitoring() {
    const healthColor =
      health.status === "online"
        ? "text-[#63e6be]"
        : health.status === "offline"
          ? "text-red-400"
          : health.status === "checking"
            ? "text-amber-300"
            : theme.muted

    return (
      <>
        <PageHeading
          eyebrow="Operations"
          title="Monitoring"
          description="Monitor the local CloudForge control plane before connecting live cloud telemetry."
          theme={theme}
          action={
            <button
              type="button"
              onClick={checkSystemHealth}
              disabled={health.status === "checking"}
              className={`rounded-xl border px-5 py-3 text-sm font-semibold ${theme.muted} hover:border-[#28d7c5]/40 hover:text-[#28d7c5] disabled:opacity-50`}
            >
              {health.status === "checking" ? "Checking..." : "↻ Refresh health"}
            </button>
          }
        />

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <div className={`rounded-2xl border p-6 ${theme.card}`}>
            <p className={`text-xs uppercase tracking-wider ${theme.subtle}`}>
              API
            </p>
            <div className="mt-4 flex items-center gap-3">
              <span
                className={`h-3 w-3 rounded-full ${
                  health.status === "online"
                    ? "bg-[#63e6be] shadow-[0_0_12px_rgba(99,230,190,0.7)]"
                    : health.status === "offline"
                      ? "bg-red-400"
                      : "bg-amber-300"
                }`}
              />
              <span className={`text-lg font-semibold ${healthColor}`}>
                {health.status === "online"
                  ? "Operational"
                  : health.status === "checking"
                    ? "Checking"
                    : health.status === "offline"
                      ? "Offline"
                      : "Not checked"}
              </span>
            </div>
            <p className={`mt-3 text-xs leading-5 ${theme.muted}`}>
              {health.message}
            </p>
            {health.checkedAt && (
              <p className={`mt-2 text-[10px] ${theme.subtle}`}>
                Last checked: {health.checkedAt}
              </p>
            )}
          </div>

          <div className={`rounded-2xl border p-6 ${theme.card}`}>
            <p className={`text-xs uppercase tracking-wider ${theme.subtle}`}>
              Projects
            </p>
            <p className="mt-4 text-3xl font-semibold">
              {projects.length}
            </p>
            <p className={`mt-2 text-xs ${theme.muted}`}>
              Active CloudForge workspaces
            </p>
          </div>

          <div className={`rounded-2xl border p-6 ${theme.card}`}>
            <p className={`text-xs uppercase tracking-wider ${theme.subtle}`}>
              AWS state
            </p>
            <p className="mt-4 text-lg font-semibold text-amber-300">
              Deployment paused
            </p>
            <p className={`mt-2 text-xs leading-5 ${theme.muted}`}>
              Live infrastructure monitoring will be connected after safe AWS deployment is enabled.
            </p>
          </div>
        </div>

        <div className={`mt-5 rounded-2xl border p-6 ${theme.card}`}>
          <p className={`text-xs uppercase tracking-wider ${theme.subtle}`}>
            Monitoring roadmap
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["API Health", "ACTIVE"],
              ["Database", "ACTIVE"],
              ["Prometheus", "NEXT"],
              ["Grafana", "NEXT"],
            ].map(([title, status]) => (
              <div
                key={title}
                className={`rounded-xl border p-4 ${theme.cardStrong}`}
              >
                <p className="text-sm font-semibold">{title}</p>
                <p
                  className={`mt-2 text-[10px] font-bold ${
                    status === "ACTIVE"
                      ? "text-[#63e6be]"
                      : "text-[#28d7c5]"
                  }`}
                >
                  {status}
                </p>
              </div>
            ))}
          </div>
        </div>
      </>
    )
  }

  function renderSettings() {
    return (
      <>
        <PageHeading
          eyebrow="Workspace"
          title="Settings"
          description="Manage CloudForge appearance, session, and local control-plane preferences."
          theme={theme}
        />

        <div className="mt-8 max-w-3xl space-y-5">
          <div className={`rounded-2xl border p-6 ${theme.card}`}>
            <p className={`text-xs uppercase tracking-wider ${theme.subtle}`}>
              Appearance
            </p>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">
                  {darkMode ? "Dark mode" : "Light mode"}
                </p>
                <p className={`mt-1 text-xs ${theme.muted}`}>
                  Choose the control-plane appearance.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const next = !darkMode
                  setDarkMode(next)
                  localStorage.setItem(
                    "cloudforge_theme",
                    next ? "dark" : "light"
                  )
                }}
                className="rounded-lg border border-[#28d7c5]/30 bg-[#28d7c5]/5 px-4 py-2.5 text-xs font-semibold text-[#28d7c5]"
              >
                Switch to {darkMode ? "light" : "dark"}
              </button>
            </div>
          </div>

          <div className={`rounded-2xl border p-6 ${theme.card}`}>
            <p className={`text-xs uppercase tracking-wider ${theme.subtle}`}>
              Session
            </p>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">CloudForge Admin</p>
                <p className={`mt-1 text-xs ${theme.muted}`}>
                  Authenticated control-plane session
                </p>
              </div>

              <button
                type="button"
                onClick={logout}
                className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/10"
              >
                Sign out
              </button>
            </div>
          </div>

          <div className={`rounded-2xl border p-6 ${theme.card}`}>
            <p className={`text-xs uppercase tracking-wider ${theme.subtle}`}>
              Environment
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoBox label="Frontend" value="Vite :5173" theme={theme} />
              <InfoBox label="Backend" value="FastAPI :8000" theme={theme} />
              <InfoBox label="Database" value="PostgreSQL" theme={theme} />
              <InfoBox label="AI Runtime" value="Ollama" theme={theme} />
            </div>
          </div>
        </div>
      </>
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
    <div className={`min-h-screen ${theme.page}`}>
      {renderHeader()}

      {mobileMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          />
          <div className="lg:hidden">
            {renderSidebar(true)}
          </div>
        </>
      )}

      <div className="flex">
        {renderSidebar()}

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
            {renderActiveSection()}
          </div>
        </main>
      </div>

      {showNewProjectModal && (
        <NewProjectModal
          onClose={() => setShowNewProjectModal(false)}
          onProjectCreated={(newProject) => {
            setProjects((currentProjects) => [
              newProject,
              ...currentProjects,
            ])
            setShowNewProjectModal(false)
          }}
        />
      )}
    </div>
  )
}

interface Theme {
  page: string
  header: string
  sidebar: string
  card: string
  cardStrong: string
  muted: string
  subtle: string
  hover: string
  input: string
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  success = false,
  theme,
}: {
  label: string
  value: string
  detail: string
  icon: string
  success?: boolean
  theme: Theme
}) {
  return (
    <div className={`rounded-2xl border p-5 ${theme.card}`}>
      <div className="flex items-start justify-between gap-4">
        <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${theme.subtle}`}>
          {label}
        </p>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            success
              ? "bg-[#63e6be]/10 text-[#63e6be]"
              : "bg-[#28d7c5]/8 text-[#28d7c5]"
          }`}
        >
          {icon}
        </span>
      </div>
      <p className={`mt-5 text-3xl font-semibold ${success ? "text-[#63e6be]" : ""}`}>
        {value}
      </p>
      <p className={`mt-2 text-xs ${theme.muted}`}>{detail}</p>
    </div>
  )
}

function PageHeading({
  eyebrow,
  title,
  description,
  theme,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  theme: Theme
  action?: ReactNode
}) {
  return (
    <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#28d7c5]">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className={`mt-2 max-w-3xl text-sm leading-6 ${theme.muted}`}>
          {description}
        </p>
      </div>
      {action}
    </section>
  )
}

function InfoBox({
  label,
  value,
  theme,
}: {
  label: string
  value: string
  theme: Theme
}) {
  return (
    <div className={`rounded-xl border p-4 ${theme.cardStrong}`}>
      <p className={`text-[10px] uppercase tracking-wider ${theme.subtle}`}>
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  )
}

function EmptyState({
  title,
  description,
  action,
  onAction,
  theme,
}: {
  title: string
  description: string
  action: string
  onAction: () => void
  theme: Theme
}) {
  return (
    <div className={`rounded-2xl border p-8 ${theme.card}`}>
      <p className="font-semibold">{title}</p>
      <p className={`mt-2 text-sm ${theme.muted}`}>{description}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-5 rounded-lg bg-[#28d7c5] px-4 py-2.5 text-xs font-semibold text-[#07100f]"
      >
        {action}
      </button>
    </div>
  )
}

export default Dashboard
