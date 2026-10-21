import { useCallback, useEffect, useState } from "react"
import { Navbar } from "../components/Navbar"
import { Sidebar } from "../components/Sidebar"
import type { DashboardSection } from "../components/Sidebar"
import { useUser } from "../context/UserContext"
import { useHealth } from "../context/HealthContext"
import {
  getErrorEvents,
  getErrorEventDetail,
  getMonitoringSummary,
  updateErrorResolution,
  ApiError,
  type ErrorEventRow,
  type MonitoringSummary,
} from "../services/api"
import {
  IconRefresh,
  IconAlertTriangle,
  IconAlertCircle,
  IconCheckCircle,
  IconClose,
  IconShield,
} from "../components/Icons"

type SeverityFilter = "" | "critical" | "error" | "warning" | "info"
type SourceFilter = "" | "frontend" | "backend"
type StatusFilter = "" | "open" | "acknowledged" | "resolved"

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25",
  error: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/25",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25",
  info: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25",
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 dark:border-[#1c222b] dark:bg-[#0a0d12]">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-[#5c6878]">
        {label}
      </p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${tone ?? "text-slate-900 dark:text-white"}`}>
        {value}
      </p>
    </div>
  )
}

function ComponentRow({ name, status, message }: { name: string; status: string; message: string }) {
  const tone =
    status === "healthy"
      ? { dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" }
      : status === "unhealthy"
        ? { dot: "bg-red-500", text: "text-red-700 dark:text-red-400" }
        : { dot: "bg-slate-400", text: "text-slate-500 dark:text-slate-400" }

  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200/70 px-3.5 py-3 dark:border-[#171e27]">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-200">{name}</p>
        <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-[#5c6878]">{message}</p>
      </div>
      <div className="ml-3 flex shrink-0 items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
        <span className={`font-mono text-[11px] font-semibold capitalize ${tone.text}`}>
          {status}
        </span>
      </div>
    </div>
  )
}

export default function Monitoring() {
  const { isAdmin, loading: userLoading } = useUser()
  const { state: healthState, refresh: refreshHealth } = useHealth()

  const [activeSection, setActiveSection] = useState<DashboardSection>("monitoring")
  const [summary, setSummary] = useState<MonitoringSummary | null>(null)
  const [summaryError, setSummaryError] = useState("")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Errors table state (admin only)
  const [errors, setErrors] = useState<ErrorEventRow[] | null>(null)
  const [errorsTotal, setErrorsTotal] = useState(0)
  const [errorsPage, setErrorsPage] = useState(1)
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("")
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("")
  const [hoursFilter, setHoursFilter] = useState(168)
  const [expandedErrorId, setExpandedErrorId] = useState<number | null>(null)
  const [errorDetail, setErrorDetail] = useState<(ErrorEventRow & { stack_trace: string | null }) | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const loadSummary = useCallback(async () => {
    // The aggregate summary endpoint is admin-only; non-admins still get
    // live health via the shared HealthContext provider.
    if (!isAdmin) return
    try {
      const data = await getMonitoringSummary()
      setSummary(data)
      setSummaryError("")
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : "Monitoring data unavailable")
    }
  }, [isAdmin])

  const loadErrors = useCallback(async () => {
    if (!isAdmin) return
    try {
      const data = await getErrorEvents({
        severity: severityFilter || undefined,
        source: sourceFilter || undefined,
        resolution_status: statusFilter || undefined,
        hours: hoursFilter,
        page: errorsPage,
        page_size: 20,
      })
      setErrors(data.items)
      setErrorsTotal(data.total)
    } catch (error) {
      // 403 = non-admin; keep table hidden.
      if (!(error instanceof ApiError && error.status === 403)) {
        setErrors([])
      }
    }
  }, [isAdmin, severityFilter, sourceFilter, statusFilter, hoursFilter, errorsPage])

  /* eslint-disable react-hooks/set-state-in-effect -- mount-time fetches; setState fires after await */
  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  useEffect(() => {
    if (!userLoading) void loadErrors()
  }, [userLoading, loadErrors])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- page reset to keep filters consistent
    setErrorsPage(1)
  }, [severityFilter, sourceFilter, statusFilter, hoursFilter])

  async function toggleExpand(id: number) {
    if (expandedErrorId === id) {
      setExpandedErrorId(null)
      setErrorDetail(null)
      return
    }
    setExpandedErrorId(id)
    setErrorDetail(null)
    try {
      const detail = await getErrorEventDetail(id)
      setErrorDetail(detail)
    } catch {
      setErrorDetail(null)
    }
  }

  async function setResolution(id: number, status: "acknowledged" | "resolved") {
    setBusyId(id)
    try {
      await updateErrorResolution(id, status)
      await loadErrors()
    } catch {
      // surfaced by refresh state
    } finally {
      setBusyId(null)
    }
  }

  const cards = summary?.errors_24h

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030507]">
      <Navbar
        breadcrumbs={[
          { label: "CloudForge", href: "/dashboard" },
          { label: "System Monitoring" },
        ]}
        onMenuToggle={() => setMobileMenuOpen((open) => !open)}
      />

      <div className="flex">
        <Sidebar
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((collapsed) => !collapsed)}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          projectCount={summary?.projects_total}
        />

        <main className="min-w-0 flex-1 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  System Monitoring
                </h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-[#6b7a8d]">
                  Application health and error monitoring — driven by real checks.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void refreshHealth()
                  void loadSummary()
                  void loadErrors()
                }}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-teal-500/40 hover:text-teal-600 dark:border-[#1e2530] dark:bg-[#0a0d12] dark:text-slate-400 dark:hover:border-teal-500/40 dark:hover:text-teal-400"
              >
                <IconRefresh className="h-3.5 w-3.5" />
                Refresh
              </button>
            </div>

            {/* Health status */}
            <section className="mt-6">
              {healthState.status === "ok" ? (
                <div
                  className={`rounded-xl border p-4 ${
                    healthState.snapshot.status === "healthy"
                      ? "border-emerald-500/30 bg-emerald-500/5 dark:border-emerald-500/20 dark:bg-emerald-500/5"
                      : healthState.snapshot.status === "unhealthy"
                        ? "border-red-500/30 bg-red-500/5"
                        : "border-amber-500/30 bg-amber-500/5"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {healthState.snapshot.status === "healthy" ? (
                      <IconCheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <IconAlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {healthState.snapshot.status === "healthy"
                          ? "All systems operational — no active errors detected."
                          : healthState.snapshot.status === "unhealthy"
                            ? "Service unhealthy — a required component is failing."
                            : "Partial degradation — an auxiliary service is down."}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-[#5c6878]">
                        Last check {new Date(healthState.snapshot.checked_at).toLocaleTimeString()}
                        {healthState.snapshot.database.latency_ms != null
                          ? ` · database ${healthState.snapshot.database.latency_ms}ms`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <ComponentRow
                      name="FastAPI backend"
                      status={healthState.snapshot.api.status}
                      message={healthState.snapshot.api.message}
                    />
                    <ComponentRow
                      name="PostgreSQL database"
                      status={healthState.snapshot.database.status}
                      message={healthState.snapshot.database.message}
                    />
                    <ComponentRow
                      name="Ollama runtime"
                      status={healthState.snapshot.ollama.status}
                      message={healthState.snapshot.ollama.message}
                    />
                  </div>
                </div>
              ) : healthState.status === "unreachable" ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                  <div className="flex items-center gap-3">
                    <IconAlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        Monitoring unavailable — health checks cannot run
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-[#5c6878]">
                        {healthState.error}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-[#0d1117]" />
              )}
            </section>

            {/* Error stats (24h) */}
            {cards && (
              <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Events (24h)" value={cards.total} />
                <Metric label="Critical" value={cards.critical} tone={cards.critical > 0 ? "text-red-600 dark:text-red-400" : undefined} />
                <Metric label="Errors" value={cards.error} tone={cards.error > 0 ? "text-orange-600 dark:text-orange-400" : undefined} />
                <Metric label="Open" value={cards.open} tone={cards.open > 0 ? "text-amber-600 dark:text-amber-400" : undefined} />
              </section>
            )}

            {summaryError && (
              <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
                {summaryError}
              </p>
            )}

            {/* Error table — admin only. Non-admins see nothing here. */}
            {isAdmin && !userLoading && (
              <section className="mt-8">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IconShield className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Error events
                    </h2>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-[#151c24] dark:text-[#768597]">
                      admin
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 dark:text-[#5c6878]">
                    {errorsTotal} event{errorsTotal === 1 ? "" : "s"} in the last {hoursFilter >= 24 ? `${hoursFilter / 24} day${hoursFilter === 24 ? "" : "s"}` : `${hoursFilter} h`}
                  </span>
                </div>

                {/* Filters */}
                <div className="mb-3 flex flex-wrap gap-2">
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:border-[#1e2530] dark:bg-[#0b0f14] dark:text-slate-300"
                  >
                    <option value="">All severities</option>
                    <option value="critical">Critical</option>
                    <option value="error">Error</option>
                    <option value="warning">Warning</option>
                    <option value="info">Info</option>
                  </select>
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:border-[#1e2530] dark:bg-[#0b0f14] dark:text-slate-300"
                  >
                    <option value="">All sources</option>
                    <option value="frontend">Frontend</option>
                    <option value="backend">Backend</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:border-[#1e2530] dark:bg-[#0b0f14] dark:text-slate-300"
                  >
                    <option value="">All statuses</option>
                    <option value="open">Open</option>
                    <option value="acknowledged">Acknowledged</option>
                    <option value="resolved">Resolved</option>
                  </select>
                  <select
                    value={hoursFilter}
                    onChange={(e) => setHoursFilter(Number(e.target.value))}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:border-[#1e2530] dark:bg-[#0b0f14] dark:text-slate-300"
                  >
                    <option value={24}>Last 24 hours</option>
                    <option value={72}>Last 3 days</option>
                    <option value={168}>Last 7 days</option>
                    <option value={720}>Last 30 days</option>
                  </select>
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-[#1c222b] dark:bg-[#0a0d12]">
                  {errors === null ? (
                    <div className="space-y-2 p-4">
                      <div className="skeleton h-8 w-full" />
                      <div className="skeleton h-8 w-full" />
                      <div className="skeleton h-8 w-full" />
                    </div>
                  ) : errors.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                      <IconCheckCircle className="h-8 w-8 text-emerald-500" />
                      <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                        No error events recorded
                      </p>
                      <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-[#5c6878]">
                        Nothing has been captured for this period with the selected filters.
                        This does not hide active problems elsewhere — check the health summary above.
                      </p>
                    </div>
                  ) : (
                    <>
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200/80 text-[10px] uppercase tracking-wider text-slate-400 dark:border-[#171d24] dark:text-[#4a5568]">
                            <th className="px-4 py-2.5 font-semibold">Time</th>
                            <th className="px-4 py-2.5 font-semibold">Source</th>
                            <th className="px-4 py-2.5 font-semibold">Severity</th>
                            <th className="px-4 py-2.5 font-semibold">Message</th>
                            <th className="px-4 py-2.5 text-right font-semibold">Count</th>
                            <th className="px-4 py-2.5 text-right font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {errors.map((event) => (
                            <tr
                              key={event.id}
                              className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 dark:border-[#12161c] dark:hover:bg-[#0d1117]"
                              onClick={() => void toggleExpand(event.id)}
                            >
                              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] text-slate-500 dark:text-[#6b7a8d]">
                                {new Date(event.last_seen_at).toLocaleString([], {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-[#151c24] dark:text-[#8b9aae]">
                                  {event.source}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${SEVERITY_STYLES[event.severity] ?? ""}`}>
                                  {event.severity}
                                </span>
                              </td>
                              <td className="max-w-[280px] px-4 py-2.5">
                                <p className="truncate text-slate-700 dark:text-slate-300" title={event.message}>
                                  {event.message}
                                </p>
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-500 dark:text-[#6b7a8d]">
                                {event.occurrences > 1 ? `×${event.occurrences}` : "×1"}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <span
                                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                                    event.resolution_status === "resolved"
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                      : event.resolution_status === "acknowledged"
                                        ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                  }`}
                                >
                                  {event.resolution_status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Expanded detail */}
                      {expandedErrorId !== null && (
                        <div className="border-t border-slate-200/80 bg-slate-50/60 p-4 dark:border-[#171d24] dark:bg-[#080b0f]">
                          {(() => {
                            const event = errors.find((e) => e.id === expandedErrorId)
                            if (!event) return null
                            return (
                              <div className="space-y-3">
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {[
                                    ["Category", event.category],
                                    ["Route / endpoint", event.route ?? "—"],
                                    ["HTTP", event.http_status ? `${event.http_method ?? ""} ${event.http_status}` : "—"],
                                    ["Request ID", event.request_id ?? "—"],
                                    ["User ID", event.user_id ?? "—"],
                                    ["First seen", new Date(event.created_at).toLocaleString()],
                                  ].map(([label, value]) => (
                                    <div key={label as string} className="flex min-w-0 gap-2 text-[11px]">
                                      <span className="shrink-0 font-semibold text-slate-500 dark:text-[#6b7a8d]">{label}:</span>
                                      <span className="truncate font-mono text-slate-700 dark:text-slate-300">{value}</span>
                                    </div>
                                  ))}
                                </div>

                                {(errorDetail?.stack_trace || event.id === errorDetail?.id) && (
                                  <pre className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-3 font-mono text-[10px] leading-relaxed text-slate-300 dark:border-[#1e2530]">
                                    {errorDetail?.stack_trace ?? "No stack trace recorded for this event."}
                                  </pre>
                                )}

                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    disabled={busyId === event.id || event.resolution_status !== "open"}
                                    onClick={(e) => { e.stopPropagation(); void setResolution(event.id, "acknowledged") }}
                                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition enabled:hover:border-sky-500/40 enabled:hover:text-sky-600 disabled:opacity-40 dark:border-[#1e2530] dark:bg-[#0b0f14] dark:text-slate-400"
                                  >
                                    Acknowledge
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busyId === event.id || event.resolution_status === "resolved"}
                                    onClick={(e) => { e.stopPropagation(); void setResolution(event.id, "resolved") }}
                                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition enabled:hover:border-emerald-500/40 enabled:hover:text-emerald-600 disabled:opacity-40 dark:border-[#1e2530] dark:bg-[#0b0f14] dark:text-slate-400"
                                  >
                                    Mark resolved
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedErrorId(null)}
                                    className="ml-auto flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                  >
                                    <IconClose className="h-3 w-3" />
                                    Close
                                  </button>
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                      )}

                      {/* Pagination */}
                      {errorsTotal > 20 && (
                        <div className="flex items-center justify-between border-t border-slate-200/80 px-4 py-2.5 text-[11px] text-slate-500 dark:border-[#171d24] dark:text-[#6b7a8d]">
                          <span>
                            Page {errorsPage} of {Math.ceil(errorsTotal / 20)}
                          </span>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              disabled={errorsPage <= 1}
                              onClick={() => setErrorsPage((p) => p - 1)}
                              className="rounded-md border border-slate-200 px-2 py-1 transition enabled:hover:text-slate-900 disabled:opacity-40 dark:border-[#1e2530]"
                            >
                              Prev
                            </button>
                            <button
                              type="button"
                              disabled={errorsPage >= Math.ceil(errorsTotal / 20)}
                              onClick={() => setErrorsPage((p) => p + 1)}
                              className="rounded-md border border-slate-200 px-2 py-1 transition enabled:hover:text-slate-900 disabled:opacity-40 dark:border-[#1e2530]"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>
            )}

            {/* Non-admin note */}
            {!isAdmin && !userLoading && (
              <section className="mt-8 rounded-xl border border-slate-200/80 bg-white p-5 dark:border-[#1c222b] dark:bg-[#0a0d12]">
                <div className="flex items-center gap-3">
                  <IconShield className="h-5 w-5 text-slate-300 dark:text-[#232b36]" />
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Detailed error events are restricted
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-[#5c6878]">
                      The error event table and stack traces are available to administrators only.
                      Service health above reflects real checks and is available to everyone.
                    </p>
                  </div>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
