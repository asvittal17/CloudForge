import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { login } from "../services/api"
import { useTheme } from "../context/ThemeContext"
import {
  CloudForgeLogo,
  IconSun,
  IconMoon,
  IconAlertCircle,
  IconShield,
} from "../components/Icons"

function Login() {
  const navigate = useNavigate()
  const { isDark, toggleTheme } = useTheme()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setLoading(true)

    try {
      const data = await login(email, password)
      localStorage.setItem("access_token", data.access_token)
      navigate("/dashboard")
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Login failed")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 transition-colors dark:bg-[#030507]">
      {/* Top right theme toggle */}
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100 dark:border-[#1e2531] dark:bg-[#0c1015] dark:text-slate-400 dark:hover:bg-[#12161f]"
        >
          {isDark ? (
            <IconSun className="h-4 w-4 text-amber-400" />
          ) : (
            <IconMoon className="h-4 w-4 text-slate-600" />
          )}
        </button>
      </div>

      {/* Subtle architectural dot grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage:
            "radial-gradient(currentColor 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Brand header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 ring-1 ring-teal-500/25 dark:bg-teal-400/10 dark:text-teal-400 dark:ring-teal-400/30">
            <CloudForgeLogo className="h-6 w-6" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            CloudForge
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-[#768597]">
            AI-Powered Cloud Infrastructure Control Plane
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-7 shadow-xl transition-colors dark:border-[#1c222b] dark:bg-[#080b0f]">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Sign in to console
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-[#768597]">
              Enter your credentials to manage workspaces and cloud automation.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@cloudforge.com"
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:border-[#222a36] dark:bg-[#040608] dark:text-slate-100 dark:placeholder:text-[#424e5e] dark:focus:border-teal-400 dark:focus:ring-teal-400/30"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                >
                  Password
                </label>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:border-[#222a36] dark:bg-[#040608] dark:text-slate-100 dark:placeholder:text-[#424e5e] dark:focus:border-teal-400 dark:focus:ring-teal-400/30"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-600 dark:text-red-400">
                <IconAlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
            >
              {loading ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span>Authenticating session...</span>
                </>
              ) : (
                <span>Sign in</span>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div className="mt-6 flex items-center justify-center gap-2 text-center text-[11px] text-slate-400 dark:text-[#525e6e]">
          <IconShield className="h-3.5 w-3.5" />
          <span>CloudForge Enterprise Control Plane</span>
        </div>
      </div>
    </div>
  )
}

export default Login