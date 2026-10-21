import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "../context/ThemeContext"
import { useUser } from "../context/UserContext"
import { useHealth } from "../context/HealthContext"
import {
  CloudForgeLogo,
  IconSun,
  IconMoon,
  IconMenu,
  IconSettings,
  IconChevronRight,
  IconShield,
} from "./Icons"
import { IconLogOut } from "./Icons"

interface BreadcrumbItem {
  label: string
  href?: string
  onClick?: () => void
}

interface NavbarProps {
  breadcrumbs?: BreadcrumbItem[]
  onMenuToggle?: () => void
}

export function Navbar({ breadcrumbs, onMenuToggle }: NavbarProps) {
  const navigate = useNavigate()
  const { isDark, toggleTheme } = useTheme()
  const { user, isAdmin, signOut } = useUser()
  const { state: healthState } = useHealth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", onDocClick)
      return () => document.removeEventListener("mousedown", onDocClick)
    }
  }, [menuOpen])

  // Health indicator reflects ONLY real check results.
  let healthConfig: { label: string; dot: string; text: string }
  if (healthState.status === "ok") {
    const snap = healthState.snapshot
    if (snap.status === "healthy") {
      healthConfig = {
        label: "All systems operational",
        dot: "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]",
        text: "text-emerald-700 dark:text-emerald-400",
      }
    } else if (snap.status === "unhealthy") {
      healthConfig = {
        label: "Service degraded",
        dot: "bg-red-500",
        text: "text-red-700 dark:text-red-400",
      }
    } else {
      // degraded / unknown from backend
      healthConfig = {
        label: "Partial degradation",
        dot: "bg-amber-400 animate-pulse",
        text: "text-amber-700 dark:text-amber-400",
      }
    }
  } else if (healthState.status === "unreachable") {
    healthConfig = {
      label: "Connection lost",
      dot: "bg-red-400",
      text: "text-red-700 dark:text-red-400",
    }
  } else {
    healthConfig = {
      label: "Health unknown",
      dot: "bg-slate-400",
      text: "text-slate-600 dark:text-slate-400",
    }
  }
  const health = healthConfig

  const initials = user
    ? user.name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?"

  function handleSignOut() {
    signOut()
    setMenuOpen(false)
    navigate("/login", { replace: true })
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-slate-200/90 bg-white/80 px-4 backdrop-blur-lg transition-colors sm:px-6 dark:border-[#1c222b] dark:bg-[#0a0d12]/80">
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
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500/15 to-teal-500/5 text-teal-600 ring-1 ring-teal-500/25 transition group-hover:from-teal-500/20 group-hover:to-teal-500/10 group-hover:ring-teal-500/40 dark:from-teal-400/15 dark:to-teal-400/5 dark:text-teal-400 dark:ring-teal-400/25">
            <CloudForgeLogo className="h-4 w-4" />
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                CloudForge
              </span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-wide text-slate-500 dark:bg-[#151c24] dark:text-teal-400">
                v0.2
              </span>
            </div>
          </div>
        </button>

        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="hidden items-center gap-1 text-xs text-slate-400 md:flex dark:text-[#4a5568]">
            <span className="mx-1.5 text-slate-300 dark:text-[#232b36]">/</span>
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1
              return (
                <div key={idx} className="flex items-center gap-1">
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
                      className="rounded px-1 py-0.5 font-medium text-slate-600 transition hover:bg-slate-100 hover:text-teal-600 dark:text-slate-400 dark:hover:bg-[#11161e] dark:hover:text-teal-400"
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span
                      className={
                        isLast
                          ? "rounded bg-slate-100/80 px-2 py-0.5 font-semibold text-slate-900 dark:bg-[#11161e] dark:text-slate-100"
                          : "font-medium text-slate-600 dark:text-slate-400"
                      }
                    >
                      {crumb.label}
                    </span>
                  )}
                  {!isLast && (
                    <span className="text-slate-300 dark:text-[#232b36]">/</span>
                  )}
                </div>
              )
            })}
          </nav>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Health indicator — reflects real /health results only. Unknown
            before the first check completes; never fakes "healthy". */}
        <button
          type="button"
          onClick={() => navigate("/monitoring")}
          title="Open system monitoring"
          className={`hidden items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/80 px-2.5 py-1 transition-colors hover:border-teal-500/40 sm:flex dark:border-[#1e2530] dark:bg-[#0c1015]/80 ${healthState.status === "unknown" ? "opacity-70" : ""}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${health.dot}`} />
          <span className={`text-[11px] font-medium tracking-tight ${health.text}`}>
            {health.label}
          </span>
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? "Switch to light mode" : "Switch to light mode"}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-[#1e2530] dark:bg-[#0e1217] dark:text-slate-400 dark:hover:border-teal-500/40 dark:hover:text-teal-400"
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <IconSun className="h-4 w-4 text-amber-400" /> : <IconMoon className="h-4 w-4 text-slate-600" />}
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50/50 p-1 pl-2.5 text-xs transition hover:border-teal-500/40 dark:border-[#1e2530] dark:bg-[#0c1015]/80"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <div className="hidden text-right leading-tight sm:block">
              <span className="block text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                {user ? user.name : "…"}
              </span>
              <span className="block font-mono text-[9px] text-slate-400 dark:text-[#525e6e]">
                {user ? user.email : "loading"}
              </span>
            </div>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-teal-500/15 to-teal-500/5 font-mono text-[10px] font-bold text-teal-600 ring-1 ring-teal-500/25 dark:from-teal-400/20 dark:to-teal-400/10 dark:text-teal-300 dark:ring-teal-400/25">
              {initials}
            </div>
            <IconChevronRight
              className={`h-3 w-3 text-slate-400 transition-transform ${menuOpen ? "rotate-90" : ""}`}
            />
          </button>

          {menuOpen && user && (
            <div className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-[#1e2530] dark:bg-[#0b0f14]">
              <div className="border-b border-slate-100 px-4 py-3 dark:border-[#171d24]">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {user.name}
                </p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500 dark:text-[#6b7a8d]">
                  {user.email}
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${
                      isAdmin
                        ? "bg-purple-500/10 text-purple-600 dark:bg-purple-400/10 dark:text-purple-300"
                        : "bg-slate-100 text-slate-500 dark:bg-[#151c24] dark:text-[#768597]"
                    }`}
                  >
                    {user.role}
                  </span>
                </div>
              </div>
              <div className="p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    navigate("/settings")
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#11161e] dark:hover:text-slate-200"
                >
                  <IconSettings className="h-4 w-4" />
                  Account settings
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      navigate("/admin")
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-purple-600 dark:text-slate-400 dark:hover:bg-[#11161e] dark:hover:text-purple-300"
                  >
                    <IconShield className="h-4 w-4" />
                    Admin console
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                >
                  <IconLogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
