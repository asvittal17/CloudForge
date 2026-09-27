import { useNavigate } from "react-router-dom"
import { useTheme } from "../context/ThemeContext"
import {
  CloudForgeLogo,
  IconSun,
  IconMoon,
  IconMenu,
} from "./Icons"

interface BreadcrumbItem {
  label: string
  href?: string
  onClick?: () => void
}

interface NavbarProps {
  breadcrumbs?: BreadcrumbItem[]
  onMenuToggle?: () => void
  healthStatus?: "online" | "offline" | "checking" | "idle"
}

export function Navbar({
  breadcrumbs,
  onMenuToggle,
  healthStatus = "online",
}: NavbarProps) {
  const navigate = useNavigate()
  const { isDark, toggleTheme } = useTheme()

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-slate-200/90 bg-white/95 px-4 backdrop-blur-md transition-colors sm:px-6 dark:border-[#171d24] dark:bg-[#06080a]/95">
      {/* Left: Mobile Menu + Brand + Breadcrumbs */}
      <div className="flex items-center gap-3 sm:gap-4">
        {onMenuToggle && (
          <button
            type="button"
            onClick={onMenuToggle}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 lg:hidden dark:border-[#1e2530] dark:text-slate-400 dark:hover:bg-[#121720]"
            aria-label="Toggle navigation menu"
          >
            <IconMenu className="h-4 w-4" />
          </button>
        )}

        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="group flex items-center gap-2.5 text-left transition focus:outline-none"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 ring-1 ring-teal-500/30 transition group-hover:scale-105 group-hover:ring-teal-500/50 dark:bg-teal-400/10 dark:text-teal-400 dark:ring-teal-400/30">
            <CloudForgeLogo className="h-4 w-4" />
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                CloudForge
              </span>
              <span className="rounded bg-slate-100 px-1.5 py-0.2 font-mono text-[9px] font-semibold text-slate-500 dark:bg-[#151c24] dark:text-teal-400">
                PROD
              </span>
            </div>
          </div>
        </button>

        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="hidden items-center gap-1.5 text-xs text-slate-400 md:flex dark:text-[#525e6e]">
            <span className="mx-1 text-slate-300 dark:text-[#232b36]">/</span>
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1
              return (
                <div key={idx} className="flex items-center gap-1.5">
                  {crumb.onClick || crumb.href ? (
                    <button
                      type="button"
                      onClick={
                        crumb.onClick
                          ? crumb.onClick
                          : crumb.href
                            ? () => navigate(crumb.href!)
                            : undefined
                      }
                      className="font-medium text-slate-600 transition hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-400"
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span
                      className={
                        isLast
                          ? "font-semibold text-slate-900 dark:text-slate-100"
                          : "font-medium text-slate-600 dark:text-slate-400"
                      }
                    >
                      {crumb.label}
                    </span>
                  )}
                  {!isLast && (
                    <span className="text-slate-300 dark:text-[#232b36]">
                      /
                    </span>
                  )}
                </div>
              )
            })}
          </nav>
        )}
      </div>

      {/* Right: Health pill + Theme Toggle + User Chip */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* System Health indicator pill */}
        <div className="hidden items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 sm:flex dark:border-[#1e2530] dark:bg-[#0c1015] dark:text-slate-400">
          <span
            className={`h-2 w-2 rounded-full ${
              healthStatus === "online"
                ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                : healthStatus === "checking"
                  ? "bg-amber-400 animate-pulse"
                  : "bg-red-400"
            }`}
          />
          <span className="text-[11px] font-medium tracking-tight">
            {healthStatus === "online"
              ? "Console Online"
              : healthStatus === "checking"
                ? "Connecting..."
                : "Offline"}
          </span>
        </div>

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-[#1e2530] dark:bg-[#0e1217] dark:text-slate-400 dark:hover:border-teal-500/40 dark:hover:text-teal-400"
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? (
            <IconSun className="h-4 w-4 text-amber-400" />
          ) : (
            <IconMoon className="h-4 w-4 text-slate-600" />
          )}
        </button>

        {/* User Session Profile chip */}
        <div className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50/50 p-1 pl-2 text-xs dark:border-[#1e2530] dark:bg-[#0c1015]">
          <div className="hidden text-right leading-none sm:block">
            <span className="block font-semibold text-slate-800 dark:text-slate-200">
              Admin
            </span>
            <span className="block font-mono text-[9px] text-slate-400 dark:text-[#525e6e]">
              cloudforge
            </span>
          </div>
          <div className="flex h-6 w-6 items-center justify-center rounded bg-teal-500/10 font-mono text-[10px] font-bold text-teal-600 ring-1 ring-teal-500/30 dark:bg-teal-400/15 dark:text-teal-300 dark:ring-teal-400/30">
            CF
          </div>
        </div>
      </div>
    </header>
  )
}
