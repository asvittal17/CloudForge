import { useLocation, useNavigate } from "react-router-dom"
import {
  IconOverview,
  IconProjects,
  IconInfrastructure,
  IconAI,
  IconDeployments,
  IconMonitoring,
  IconSettings,
  IconChevronRight,
  IconClose,
  IconCollapse,
  IconShield,
  CloudForgeLogo,
} from "./Icons"
import { useUser } from "../context/UserContext"
import { useHealth } from "../context/HealthContext"

export type DashboardSection =
  | "overview"
  | "projects"
  | "infrastructure"
  | "ai"
  | "deployments"
  | "monitoring"
  | "settings"
  | "admin"

interface NavItem {
  id: DashboardSection
  label: string
  icon: React.ComponentType<{ className?: string; size?: number }>
  badge?: string
  adminOnly?: boolean
}

const WORKSPACE_ITEMS: NavItem[] = [
  { id: "overview", label: "Overview", icon: IconOverview },
  { id: "projects", label: "Projects", icon: IconProjects },
  { id: "infrastructure", label: "Infrastructure", icon: IconInfrastructure },
  { id: "ai", label: "AI Infrastructure", icon: IconAI, badge: "AI" },
]

const OPERATIONS_ITEMS: NavItem[] = [
  { id: "deployments", label: "Deployments", icon: IconDeployments },
  { id: "monitoring", label: "Monitoring", icon: IconMonitoring },
]

const SYSTEM_ITEMS: NavItem[] = [
  { id: "admin", label: "Admin Console", icon: IconShield, adminOnly: true },
  { id: "settings", label: "Settings", icon: IconSettings },
]

interface SidebarProps {
  activeSection: DashboardSection
  onSelectSection: (section: DashboardSection) => void
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  mobileOpen?: boolean
  onCloseMobile?: () => void
  onLogout?: () => void
  projectCount?: number
}

export function Sidebar({
  activeSection,
  onSelectSection,
  isCollapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onCloseMobile,
  onLogout,
  projectCount,
}: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAdmin } = useUser()
  const { state: healthState } = useHealth()

  // Environment status reflects the real /health snapshot.
  const dbStatus =
    healthState.status === "ok" ? healthState.snapshot.database.status : "unknown"
  const envLabel =
    healthState.status === "ok" && healthState.snapshot.database.status === "healthy"
      ? "Connected"
      : healthState.status === "unreachable"
        ? "Offline"
        : dbStatus === "unhealthy"
          ? "Failed"
          : "Checking"

  const renderNavGroup = (title: string, items: NavItem[]) => {
    const visibleItems = items.filter((item) => !item.adminOnly || isAdmin)
    if (visibleItems.length === 0) return null

    return (
      <div className="mb-6">
        {!isCollapsed && (
          <p className="mb-2.5 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-[#4a5568]">
            {title}
          </p>
        )}
        {isCollapsed && (
          <div className="mx-auto mb-2.5 h-px w-6 bg-slate-200 dark:bg-[#1c222b]" />
        )}
        <nav className="space-y-0.5">
          {visibleItems.map((item) => {
            const Icon = item.icon
            const isActive = activeSection === item.id

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  const closeIfMobile = () => {
                    if (onCloseMobile) onCloseMobile()
                  }

                  // Page-level destinations always navigate to their route.
                  if (item.adminOnly) {
                    navigate("/admin")
                    closeIfMobile()
                    return
                  }
                  if (item.id === "monitoring") {
                    navigate("/monitoring")
                    closeIfMobile()
                    return
                  }
                  if (item.id === "settings") {
                    navigate("/settings")
                    closeIfMobile()
                    return
                  }

                  // Dashboard-internal sections: if we are on the dashboard,
                  // update state; otherwise route to the dashboard first,
                  // carrying the requested section in location.state.
                  if (location.pathname === "/dashboard") {
                    onSelectSection(item.id)
                  } else {
                    navigate("/dashboard", { state: { section: item.id } })
                  }
                  closeIfMobile()
                }}
                title={isCollapsed ? item.label : undefined}
                className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-r from-teal-500/12 to-teal-500/4 text-teal-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_3px_rgba(0,0,0,0.08)] dark:from-teal-400/15 dark:to-teal-400/5 dark:text-teal-300 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_1px_3px_rgba(0,0,0,0.3)]"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#11161e] dark:hover:text-slate-200"
                } ${isCollapsed ? "justify-center px-0" : ""}`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-teal-400 to-teal-600 shadow-[0_0_8px_rgba(45,212,191,0.4)] dark:from-teal-400 dark:to-teal-500 dark:shadow-[0_0_10px_rgba(45,212,191,0.5)]" />
                )}

                <Icon
                  className={`h-[18px] w-[18px] shrink-0 transition-all duration-200 ${
                    isActive
                      ? "text-teal-600 dark:text-teal-400"
                      : "text-slate-400 group-hover:text-slate-600 dark:text-[#5c6878] dark:group-hover:text-slate-300"
                  }`}
                />

                {!isCollapsed && (
                  <span className="min-w-0 flex-1 truncate text-left">
                    {item.label}
                  </span>
                )}

                {!isCollapsed && item.id === "projects" && projectCount !== undefined && (
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500 dark:bg-[#151c24] dark:text-[#768597]">
                    {projectCount}
                  </span>
                )}

                {!isCollapsed && item.badge && (
                  <span className="rounded-md border border-teal-500/20 bg-teal-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wide text-teal-600 dark:border-teal-400/20 dark:bg-teal-400/10 dark:text-teal-300">
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>
    )
  }

  const content = (
    <div className="flex h-full flex-col justify-between p-3">
      <div>
        {renderNavGroup("Workspace", WORKSPACE_ITEMS)}
        {renderNavGroup("Operations", OPERATIONS_ITEMS)}
        {renderNavGroup("System", SYSTEM_ITEMS)}
      </div>

      <div className="space-y-3 border-t border-slate-200/80 pt-4 dark:border-[#171d24]">
        {!isCollapsed && (
          <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-[#171e27] dark:bg-[#0a0d11]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                Environment
              </span>
              <span
                className={`flex items-center gap-1.5 font-mono text-[10px] font-semibold ${
                  envLabel === "Connected"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : envLabel === "Checking"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-red-600 dark:text-red-400"
                }`}
              >
                <span
                  className={`relative flex h-1.5 w-1.5 ${
                    envLabel === "Connected" ? "animate-ping" : ""
                  }`}
                >
                  <span
                    className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                      envLabel === "Connected"
                        ? "bg-emerald-500"
                        : envLabel === "Checking"
                          ? "bg-amber-400"
                          : "bg-red-500"
                    }`}
                  />
                </span>
                {envLabel}
              </span>
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400 dark:text-[#525e6e]">
              {envLabel === "Connected"
                ? "Local control-plane connected"
                : envLabel === "Checking"
                  ? "Checking control-plane…"
                  : "Control-plane unreachable"}
            </p>
          </div>
        )}

        {isCollapsed && (
          <div className="flex justify-center">
            <span className="relative flex h-2 w-2">
              <span
                className={`absolute inline-flex h-full w-full rounded-full opacity-60 ${
                  envLabel === "Connected"
                    ? "animate-ping bg-emerald-400"
                    : envLabel === "Checking"
                      ? "bg-amber-400"
                      : "bg-red-400"
                }`}
              />
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  envLabel === "Connected"
                    ? "bg-emerald-500"
                    : envLabel === "Checking"
                      ? "bg-amber-400"
                      : "bg-red-500"
                }`}
              />
            </span>
          </div>
        )}

        <div className="flex items-center justify-between gap-1">
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-all duration-200 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:border-[#1e2530] dark:text-slate-400 dark:hover:border-[#2a3442] dark:hover:bg-[#12161d] dark:hover:text-slate-200"
            >
              <IconCollapse className={`h-4 w-4 transition-transform duration-300 ${isCollapsed ? "rotate-180" : ""}`} />
            </button>
          )}

          {onLogout && !isCollapsed && (
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-500 transition-all duration-200 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            >
              <span>Sign out</span>
              <IconChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <>
      <aside
        className={`hidden shrink-0 border-r border-slate-200/90 bg-white transition-all duration-300 ease-in-out lg:block dark:border-[#171d24] dark:bg-[#0a0d12] ${
          isCollapsed ? "w-[68px]" : "w-60"
        } sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto`}
      >
        {content}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 flex h-full w-72 flex-col border-r border-slate-200 bg-white shadow-2xl dark:border-[#1e2530] dark:bg-[#0a0d12]">
            <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4 dark:border-[#1e2530]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 ring-1 ring-teal-500/20 dark:bg-teal-400/10 dark:text-teal-400 dark:ring-teal-400/20">
                  <CloudForgeLogo className="h-4 w-4" />
                </div>
                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                  CloudForge
                </span>
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 dark:border-[#1e2530] dark:text-slate-400 dark:hover:bg-[#12161d]"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{content}</div>
          </div>
        </div>
      )}
    </>
  )
}
