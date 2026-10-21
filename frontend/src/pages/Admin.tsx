import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Navbar } from "../components/Navbar"
import { Sidebar } from "../components/Sidebar"
import type { DashboardSection } from "../components/Sidebar"
import { useUser } from "../context/UserContext"
import { useHealth } from "../context/HealthContext"
import {
  getAdminStats,
  getAdminUsers,
  updateUserRole,
  updateUserStatus,
  type AdminStats,
  type AdminUserRow,
  ApiError,
} from "../services/api"
import {
  IconRefresh,
  IconShield,
  IconAlertCircle,
  IconCheckCircle,
  IconSearch,
} from "../components/Icons"

type SortField = "id" | "name" | "email" | "created_at" | "project_count"

function StatCard({ label, value, warning }: { label: string; value: number; warning?: boolean }) {
  const tone = warning && value > 0
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 dark:border-[#1c222b] dark:bg-[#0a0d12]">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-[#5c6878]">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${
          tone
            ? "text-amber-600 dark:text-amber-400"
            : "text-slate-900 dark:text-white"
        }`}
      >
        {value}
      </p>
    </div>
  )
}

export default function Admin() {
  const navigate = useNavigate()
  const { user: currentUser, isAdmin, loading: userLoading } = useUser()
  const { state: healthState } = useHealth()

  const [activeSection, setActiveSection] = useState<DashboardSection>("admin")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [statsError, setStatsError] = useState("")

  const [users, setUsers] = useState<AdminUserRow[] | null>(null)
  const [usersTotal, setUsersTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [sortField, setSortField] = useState<SortField>("created_at")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  const [actionError, setActionError] = useState("")
  const [confirm, setConfirm] = useState<{
    kind: "role" | "disable" | "enable"
    user: AdminUserRow
    value?: string
  } | null>(null)
  const [busy, setBusy] = useState(false)

  const loadStats = useCallback(async () => {
    try {
      const data = await getAdminStats()
      setStats(data)
      setStatsError("")
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        navigate("/dashboard", { replace: true })
        return
      }
      setStatsError(error instanceof Error ? error.message : "Failed to load statistics")
    }
  }, [navigate])

  const loadUsers = useCallback(async () => {
    try {
      const data = await getAdminUsers({
        search: search || undefined,
        role: roleFilter || undefined,
        is_active: statusFilter === "" ? undefined : statusFilter === "active",
        sort_by: sortField,
        order: sortOrder,
        page,
        page_size: 15,
      })
      setUsers(data.items)
      setUsersTotal(data.total)
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        navigate("/dashboard", { replace: true })
        return
      }
      setUsers([])
    }
  }, [search, roleFilter, statusFilter, sortField, sortOrder, page, navigate])

  /* eslint-disable react-hooks/set-state-in-effect -- mount-time fetches; setState fires after await */
  useEffect(() => {
    if (!userLoading) void loadStats()
  }, [userLoading, loadStats])

  useEffect(() => {
    if (!userLoading) void loadUsers()
  }, [userLoading, loadUsers])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- page reset to keep filters consistent
    setPage(1)
  }, [search, roleFilter, statusFilter, sortField, sortOrder])

  async function runAction() {
    if (!confirm) return
    setBusy(true)
    setActionError("")
    try {
      if (confirm.kind === "role") {
        await updateUserRole(confirm.user.id, (confirm.value as "user" | "admin") ?? "user")
      } else if (confirm.kind === "disable") {
        await updateUserStatus(confirm.user.id, false)
      } else {
        await updateUserStatus(confirm.user.id, true)
      }
      setConfirm(null)
      await Promise.all([loadStats(), loadUsers()])
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Action failed")
    } finally {
      setBusy(false)
    }
  }

  function sortButton(field: SortField, label: string) {
    const active = sortField === field
    return (
      <button
        type="button"
        onClick={() => {
          if (active) setSortOrder((o) => (o === "asc" ? "desc" : "asc"))
          else {
            setSortField(field)
            setSortOrder("asc")
          }
        }}
        className={`inline-flex items-center gap-1 font-semibold transition ${
          active ? "text-teal-600 dark:text-teal-400" : "hover:text-slate-600 dark:hover:text-slate-300"
        }`}
      >
        {label}
        {active && <span className="font-mono text-[9px]">{sortOrder === "asc" ? "▲" : "▼"}</span>}
      </button>
    )
  }

  if (!userLoading && !isAdmin) {
    return null // RequireAdmin route + server 403 guard handle this
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030507]">
      <Navbar
        breadcrumbs={[
          { label: "CloudForge", href: "/dashboard" },
          { label: "Admin Console" },
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
        />

        <main className="min-w-0 flex-1 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <IconShield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    Admin Console
                  </h1>
                  <span className="rounded bg-purple-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-300">
                    {currentUser?.role}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-[#6b7a8d]">
                  Platform-wide statistics and user administration.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void loadStats()
                  void loadUsers()
                }}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-teal-500/40 hover:text-teal-600 dark:border-[#1e2530] dark:bg-[#0a0d12] dark:text-slate-400"
              >
                <IconRefresh className="h-3.5 w-3.5" />
                Refresh
              </button>
            </div>

            {/* Stats */}
            {statsError ? (
              <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs text-red-700 dark:text-red-300">
                {statsError}
              </p>
            ) : stats === null ? (
              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="skeleton h-20" />
                <div className="skeleton h-20" />
                <div className="skeleton h-20" />
                <div className="skeleton h-20" />
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard label="Total users" value={stats.users_total} />
                <StatCard label="Active users" value={stats.users_active} />
                <StatCard label="Projects" value={stats.projects_total} />
                <StatCard
                  label="Open errors"
                  value={stats.errors_open}
                  warning
                />
              </div>
            )}

            {/* Health strip */}
            {healthState.status === "ok" && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200/70 bg-white px-4 py-3 text-xs dark:border-[#171e27] dark:bg-[#0a0d12]">
                <span className="font-medium text-slate-600 dark:text-slate-400">Health:</span>
                {[
                  ["API", healthState.snapshot.api.status],
                  ["Database", healthState.snapshot.database.status],
                  ["Ollama", healthState.snapshot.ollama.status],
                ].map(([name, status]) => (
                  <span key={name as string} className="flex items-center gap-1.5">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        status === "healthy" ? "bg-emerald-500" : status === "unhealthy" ? "bg-red-500" : "bg-slate-400"
                      }`}
                    />
                    <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      {name}: <span className="capitalize">{String(status)}</span>
                    </span>
                  </span>
                ))}
              </div>
            )}

            {actionError && (
              <p className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-2.5 text-xs text-red-700 dark:text-red-300">
                <IconAlertCircle className="h-3.5 w-3.5 shrink-0" />
                {actionError}
              </p>
            )}

            {/* User management */}
            <section className="mt-8">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  User management
                  <span className="ml-2 font-normal text-slate-400 dark:text-[#5c6878]">
                    {usersTotal} user{usersTotal === 1 ? "" : "s"}
                  </span>
                </h2>
                <div className="flex gap-2">
                  <div className="relative">
                    <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search name or email…"
                      className="w-52 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-700 outline-none transition focus:border-teal-500/50 dark:border-[#1e2530] dark:bg-[#0b0f14] dark:text-slate-300"
                    />
                  </div>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 dark:border-[#1e2530] dark:bg-[#0b0f14] dark:text-slate-300"
                  >
                    <option value="">All roles</option>
                    <option value="admin">Admins</option>
                    <option value="user">Users</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 dark:border-[#1e2530] dark:bg-[#0b0f14] dark:text-slate-300"
                  >
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white dark:border-[#1c222b] dark:bg-[#0a0d12]">
                {users === null ? (
                  <div className="space-y-2 p-4">
                    <div className="skeleton h-10 w-full" />
                    <div className="skeleton h-10 w-full" />
                    <div className="skeleton h-10 w-full" />
                  </div>
                ) : users.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      No matching users
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-[#5c6878]">
                      Adjust the search or filters.
                    </p>
                  </div>
                ) : (
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/80 text-[10px] uppercase tracking-wider text-slate-400 dark:border-[#171d24] dark:text-[#4a5568]">
                        <th className="px-4 py-2.5">{sortButton("id", "ID")}</th>
                        <th className="px-4 py-2.5">{sortButton("name", "Name")}</th>
                        <th className="px-4 py-2.5">{sortButton("email", "Email")}</th>
                        <th className="px-4 py-2.5">Role</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5 text-right">{sortButton("project_count", "Projects")}</th>
                        <th className="px-4 py-2.5 text-right">{sortButton("created_at", "Registered")}</th>
                        <th className="px-4 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr
                          key={u.id}
                          className="border-b border-slate-100 transition last:border-0 hover:bg-slate-50/70 dark:border-[#12161c] dark:hover:bg-[#0d1117]"
                        >
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-400"># {u.id}</td>
                          <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                            {u.name}
                            {currentUser?.id === u.id && (
                              <span className="ml-1.5 rounded bg-teal-500/10 px-1 py-0.5 font-mono text-[9px] font-bold text-teal-600 dark:text-teal-400">
                                you
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-500 dark:text-[#8b9aae]">
                            {u.email}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
                                u.role === "admin"
                                  ? "bg-purple-500/10 text-purple-600 dark:text-purple-300"
                                  : "bg-slate-100 text-slate-500 dark:bg-[#151c24] dark:text-[#768597]"
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`flex w-fit items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                                u.is_active
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : "bg-red-500/10 text-red-600 dark:text-red-400"
                              }`}
                            >
                              {u.is_active ? (
                                <IconCheckCircle className="h-3 w-3" />
                              ) : (
                                <IconAlertCircle className="h-3 w-3" />
                              )}
                              {u.is_active ? "Active" : "Disabled"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                            {u.project_count}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-[11px] text-slate-400 dark:text-[#6b7a8d]">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirm({
                                    kind: "role",
                                    user: u,
                                    value: u.role === "admin" ? "user" : "admin",
                                  })
                                }
                                disabled={busy || currentUser?.id === u.id}
                                className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-500 transition enabled:hover:border-purple-500/40 enabled:hover:text-purple-600 disabled:opacity-30 dark:border-[#1e2530] dark:text-slate-400"
                              >
                                {u.role === "admin" ? "Demote" : "Promote"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirm({ kind: u.is_active ? "disable" : "enable", user: u })
                                }
                                disabled={busy || currentUser?.id === u.id}
                                className={`rounded-md border px-2 py-1 text-[10px] font-medium transition disabled:opacity-30 dark:border-[#1e2530] ${
                                  u.is_active
                                    ? "border-slate-200 text-slate-500 enabled:hover:border-red-500/40 enabled:hover:text-red-600 dark:text-slate-400"
                                    : "border-slate-200 text-slate-500 enabled:hover:border-emerald-500/40 enabled:hover:text-emerald-600 dark:text-slate-400"
                                }`}
                              >
                                {u.is_active ? "Disable" : "Enable"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {usersTotal > 15 && (
                  <div className="flex items-center justify-between border-t border-slate-200/80 px-4 py-2.5 text-[11px] text-slate-500 dark:border-[#171d24] dark:text-[#6b7a8d]">
                    <span>
                      Page {page} of {Math.ceil(usersTotal / 15)}
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                        className="rounded-md border border-slate-200 px-2 py-1 transition enabled:hover:text-slate-900 disabled:opacity-40 dark:border-[#1e2530]"
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        disabled={page >= Math.ceil(usersTotal / 15)}
                        onClick={() => setPage((p) => p + 1)}
                        className="rounded-md border border-slate-200 px-2 py-1 transition enabled:hover:text-slate-900 disabled:opacity-40 dark:border-[#1e2530]"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <p className="mt-2 text-[10px] text-slate-400 dark:text-[#4a5568]">
                Role and status changes are enforced server-side. An administrator cannot change
                their own role or disable their own account. Credentials are never displayed.
              </p>
            </section>
          </div>
        </main>
      </div>

      {/* Confirmation dialog */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => !busy && setConfirm(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-[#242c38] dark:bg-[#0b0f14]">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <IconAlertCircle className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {confirm.kind === "role"
                  ? `Change role to "${confirm.value}"`
                  : confirm.kind === "disable"
                    ? "Disable account"
                    : "Enable account"}
              </h3>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-[#8b9aae]">
              {confirm.kind === "role"
                ? `${confirm.user.name} (${confirm.user.email}) will ${
                    confirm.value === "admin" ? "gain full administrative access" : "lose administrative access"
                  } immediately.`
                : confirm.kind === "disable"
                  ? `${confirm.user.name} (${confirm.user.email}) will be prevented from signing in until re-enabled.`
                  : `${confirm.user.name} (${confirm.user.email}) will be able to sign in again.`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                disabled={busy}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-[#242c38] dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void runAction()}
                disabled={busy}
                className={`rounded-lg px-3 py-2 text-xs font-semibold text-white transition disabled:opacity-40 ${
                  confirm.kind === "disable"
                    ? "bg-red-600 hover:bg-red-700"
                    : confirm.kind === "enable"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-purple-600 hover:bg-purple-700"
                }`}
              >
                {busy ? "Working…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
