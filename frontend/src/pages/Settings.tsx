import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Navbar } from "../components/Navbar"
import { Sidebar } from "../components/Sidebar"
import type { DashboardSection } from "../components/Sidebar"
import { getMe, type Me } from "../services/api"
import { useTheme } from "../context/ThemeContext"
import { useHealth } from "../context/HealthContext"
import { IconShield, IconSun, IconMoon, IconRefresh } from "../components/Icons"
import { Toast } from "../components/Toast"

export default function Settings() {
  const navigate = useNavigate()
  const { isDark, toggleTheme } = useTheme()
  const { state: healthState, refresh: refreshHealth } = useHealth()
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<DashboardSection>("settings")
  const [saved, setSaved] = useState<string>("")

  useEffect(() => {
    getMe()
      .then((data) => setMe(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const email = me?.email ?? "—"
  const name = me?.name ?? (loading ? "…" : "Not available")

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030507]">
      <Navbar
        breadcrumbs={[
          { label: "CloudForge", href: "/dashboard" },
          { label: "Settings" },
        ]}
      />

      <div className="flex">
        <Sidebar activeSection={activeSection} onSelectSection={setActiveSection} />

        <main className="min-w-0 flex-1 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl space-y-6">
            {/* Account info card */}
            <section>
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 dark:border-[#1c222b] dark:bg-[#0a0d12]">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Account
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-[#6b7a8d]">
                  Your CloudForge identity and workspace.
                </p>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-slate-200/70 px-3.5 py-3 dark:border-[#171e27]">
                    <span className="text-xs font-medium text-slate-500 dark:text-[#8b9aae]">
                      Full name
                    </span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-200/70 px-3.5 py-3 dark:border-[#171e27]">
                    <span className="text-xs font-medium text-slate-500 dark:text-[#8b9aae]">
                      Email
                    </span>
                    <span className="font-mono text-sm text-slate-800 dark:text-slate-200">
                      {email}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-200/70 px-3.5 py-3 dark:border-[#171e27]">
                    <span className="text-xs font-medium text-slate-500 dark:text-[#8b9aae]">
                      Role
                    </span>
                    <span
                      className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
                        me?.role === "admin"
                          ? "bg-purple-500/10 text-purple-600 dark:text-purple-300"
                          : "bg-slate-100 text-slate-500 dark:bg-[#151c24] dark:text-[#768597]"
                      }`}
                    >
                      {me?.role === "admin" && <IconShield className="h-3 w-3" />}
                      {me?.role ?? "…"}
                    </span>
                  </div>
                  <p className="text-[10px] leading-relaxed text-slate-400 dark:text-[#4a5568]">
                    Profile fields are managed by the backend account store. To change your
                    credentials, contact an administrator.
                  </p>
                </div>
              </div>
            </section>

            {/* Appearance */}
            <section>
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 dark:border-[#1c222b] dark:bg-[#0a0d12]">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Appearance
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-[#6b7a8d]">
                  Choose how CloudForge looks on this device.
                </p>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="mt-4 flex w-full items-center justify-between rounded-lg border border-slate-200/70 px-3.5 py-3 transition hover:border-teal-500/40 dark:border-[#171e27]"
                >
                  <div className="flex items-center gap-3">
                    {isDark ? <IconMoon className="h-4 w-4 text-slate-500" /> : <IconSun className="h-4 w-4 text-amber-500" />}
                    <div className="text-left">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {isDark ? "Dark theme" : "Light theme"}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-[#5c6878]">
                        Click to switch
                      </p>
                    </div>
                  </div>
                  <span
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                      isDark ? "bg-teal-500" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                        isDark ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </span>
                </button>
              </div>
            </section>

            {/* System status */}
            <section>
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 dark:border-[#1c222b] dark:bg-[#0a0d12]">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      System status
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-[#6b7a8d]">
                      Current backend component health.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void refreshHealth()}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-teal-500/40 hover:text-teal-600 dark:border-[#1e2530] dark:text-slate-400"
                  >
                    <IconRefresh className="h-3 w-3" />
                    Recheck
                  </button>
                </div>
                {healthState.status === "ok" ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {[
                      ["API", healthState.snapshot.api],
                      ["Database", healthState.snapshot.database],
                      ["Ollama", healthState.snapshot.ollama],
                    ].map(([label, component]) => (
                      <div
                        key={label as string}
                        className="rounded-lg border border-slate-200/70 px-3.5 py-3 dark:border-[#171e27]"
                      >
                        <p className="text-[11px] font-medium text-slate-500 dark:text-[#8b9aae]">
                          {label as string}
                        </p>
                        <p
                          className={`mt-1 font-mono text-xs font-semibold capitalize ${
                            (component as { status: string }).status === "healthy"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : (component as { status: string }).status === "unhealthy"
                                ? "text-red-600 dark:text-red-400"
                                : "text-slate-500"
                          }`}
                        >
                          {(component as { status: string }).status}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3.5 py-3 text-xs text-amber-700 dark:text-amber-300">
                    {healthState.status === "unreachable"
                      ? "Health checks cannot reach the backend."
                      : "Waiting for the first health check…"}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => navigate("/monitoring")}
                  className="mt-3 text-xs font-medium text-teal-600 transition hover:text-teal-700 dark:text-teal-400"
                >
                  Open full system monitoring →
                </button>
              </div>
            </section>
          </div>
        </main>
      </div>
      {saved && <Toast message={saved} onDone={() => setSaved("")} />}
    </div>
  )
}
