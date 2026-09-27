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
} from "./Icons"

export type DashboardSection =
  | "overview"
  | "projects"
  | "infrastructure"
  | "ai"
  | "deployments"
  | "monitoring"
  | "settings"

interface NavItem {
  id: DashboardSection
  label: string
  icon: React.ComponentType<{ className?: string; size?: number }>
  badge?: string
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
  const renderNavGroup = (title: string, items: NavItem[]) => {
    return (
      <div className="mb-5">
        {!isCollapsed && (
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#525e6e]">
            {title}
          </p>
        )}
        <nav className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon
            const isActive = activeSection === item.id

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectSection(item.id)
                  if (onCloseMobile) onCloseMobile()
                }}
                title={isCollapsed ? item.label : undefined}
                className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                  isActive
                    ? "bg-teal-500/10 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#12161d] dark:hover:text-slate-200"
                } ${isCollapsed ? "justify-center px-2" : ""}`}
              >
                {/* Active Left Indicator Bar */}
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-teal-500 dark:bg-teal-400" />
                )}

                <Icon
                  className={`h-4 w-4 shrink-0 transition ${
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
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 dark:bg-[#151c24] dark:text-[#768597]">
                    {projectCount}
                  </span>
                )}

                {!isCollapsed && item.badge && (
                  <span className="rounded border border-teal-500/20 bg-teal-500/10 px-1.5 py-0.2 font-mono text-[9px] font-bold text-teal-600 dark:border-teal-400/20 dark:bg-teal-400/10 dark:text-teal-300">
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
      <div className="space-y-1">
        {renderNavGroup("Workspace", WORKSPACE_ITEMS)}
        {renderNavGroup("Operations", OPERATIONS_ITEMS)}
        {renderNavGroup("System", SYSTEM_ITEMS)}
      </div>

      <div className="space-y-3 pt-3 border-t border-slate-200/80 dark:border-[#171d24]">
        {/* Workspace status badge */}
        {!isCollapsed && (
          <div className="rounded-lg border border-slate-200/70 bg-slate-50/70 p-3 text-xs dark:border-[#171e27] dark:bg-[#0a0d11]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                Environment
              </span>
              <span className="flex items-center gap-1 font-mono text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            </div>
            <p className="mt-1 text-[10px] text-slate-400 dark:text-[#525e6e]">
              Local control-plane connected
            </p>
          </div>
        )}

        {/* Bottom Actions: Collapse Toggle & Logout */}
        <div className="flex items-center justify-between gap-1">
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:border-[#1e2530] dark:text-slate-400 dark:hover:bg-[#12161d] dark:hover:text-slate-200"
            >
              <IconCollapse className="h-4 w-4" />
            </button>
          )}

          {onLogout && !isCollapsed && (
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1 text-[11px] font-medium text-slate-500 transition hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400"
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
      {/* Desktop Fixed Sidebar */}
      <aside
        className={`hidden shrink-0 border-r border-slate-200/90 bg-white transition-all duration-200 lg:block dark:border-[#171d24] dark:bg-[#06080a] ${
          isCollapsed ? "w-16" : "w-60"
        } sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto`}
      >
        {content}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          {/* Drawer content */}
          <div className="relative z-10 flex h-full w-72 flex-col border-r border-slate-200 bg-white shadow-2xl dark:border-[#1e2530] dark:bg-[#07090c]">
            <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4 dark:border-[#1e2530]">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Navigation
              </span>
              <button
                type="button"
                onClick={onCloseMobile}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-[#1e2530] dark:text-slate-400 dark:hover:bg-[#12161d]"
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
