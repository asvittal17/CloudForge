import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { register } from "../services/api"
import { useTheme } from "../context/ThemeContext"
import {
  CloudForgeLogo,
  IconSun,
  IconMoon,
  IconAlertCircle,
  IconShield,
  IconAI,
  IconTerminal,
  IconCheckCircle,
} from "../components/Icons"

const FEATURES = [
  {
    icon: IconAI,
    title: "AI-powered planning",
    description: "Generate optimal infrastructure blueprints from plain-language requirements.",
  },
  {
    icon: IconTerminal,
    title: "Terraform automation",
    description: "Plan, preview, and apply changes across every cloud provider in one pipeline.",
  },
  {
    icon: IconShield,
    title: "Security scanning",
    description: "Continuous policy checks flag misconfigurations before they ever ship.",
  },
  {
    icon: IconCheckCircle,
    title: "Approval gates",
    description: "Enforce review workflows so every production change is signed off.",
  },
]

function Register() {
  const navigate = useNavigate()
  const { isDark, toggleTheme } = useTheme()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string
    email?: string
    password?: string
    confirmPassword?: string
  }>({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  function validate(): boolean {
    const next: typeof fieldErrors = {}
    if (!name.trim()) {
      next.name = "Full name is required."
    } else if (name.trim().length < 2) {
      next.name = "Name must be at least 2 characters."
    }
    if (!email.trim()) {
      next.email = "Email is required."
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Enter a valid email address."
    }
    if (!password) {
      next.password = "Password is required."
    } else if (password.length < 8) {
      next.password = "Password must be at least 8 characters."
    }
    if (!confirmPassword) {
      next.confirmPassword = "Please confirm your password."
    } else if (password !== confirmPassword) {
      next.confirmPassword = "Passwords do not match."
    }
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    if (!validate()) return
    setLoading(true)

    try {
      await register(name.trim(), email.trim(), password)
      setSuccess(true)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Registration failed")
      }
    } finally {
      setLoading(false)
    }
  }

  const inputBase =
    "w-full rounded-lg border bg-white py-2.5 pl-10 pr-3.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition focus:ring-1 dark:bg-[#040608] dark:text-slate-100 dark:placeholder:text-[#424e5e]"
  const inputNormal =
    "border-slate-300 focus:border-teal-500 focus:ring-teal-500 dark:border-[#222a36] dark:focus:border-teal-400 dark:focus:ring-teal-400/30"
  const inputInvalid =
    "border-red-400 focus:border-red-500 focus:ring-red-500/40 dark:border-red-500/50 dark:focus:border-red-400 dark:focus:ring-red-400/30"

  return (
    <div className="flex min-h-screen bg-slate-50 transition-colors dark:bg-[#030507]">
      {/* Left branding panel */}
      <div className="relative hidden w-1/2 overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div className="absolute inset-0 bg-gradient-to-br from-[#04121f] via-[#071a2b] to-[#041019] dark:from-[#020a14] dark:via-[#071827] dark:to-[#02060c]" />
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-teal-500/15 blur-3xl dark:bg-teal-400/10" />
        <div className="absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-cyan-500/10 blur-3xl dark:bg-cyan-400/[0.07]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06] dark:opacity-[0.08]"
          style={{
            backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />

        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/15 text-teal-600 ring-1 ring-teal-500/30 dark:bg-teal-400/10 dark:text-teal-400 dark:ring-teal-400/25">
            <CloudForgeLogo className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            CloudForge
          </span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-900 xl:text-[2.75rem] dark:text-white">
            Build and manage cloud infrastructure{" "}
            <span className="bg-gradient-to-r from-teal-500 to-cyan-400 bg-clip-text text-transparent dark:from-teal-400 dark:to-cyan-300">
              intelligently.
            </span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            CloudForge is the AI-powered control plane for modern infrastructure. Describe what
            you need, and CloudForge plans, secures, and deploys it across AWS, Azure, and GCP —
            with full governance built in.
          </p>

          <ul className="mt-10 space-y-5">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex items-start gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 ring-1 ring-teal-500/20 dark:bg-teal-400/10 dark:text-teal-400 dark:ring-teal-400/20">
                  <feature.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {feature.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-500">
                    {feature.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-500">
          <IconShield className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
          <span>SOC 2 Type II · SSO/SAML · Audit logging on every plan</span>
        </div>
      </div>

      {/* Right form panel */}
      <div className="relative flex flex-1 flex-col items-center justify-center bg-white px-4 py-10 transition-colors dark:bg-[#080b0f] sm:px-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.05] lg:hidden"
          style={{
            backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

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

        <div className="relative w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 ring-1 ring-teal-500/25 dark:bg-teal-400/10 dark:text-teal-400 dark:ring-teal-400/30">
              <CloudForgeLogo className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                CloudForge
              </p>
              <p className="text-[11px] text-slate-500 dark:text-[#768597]">
                AI-Powered Cloud Infrastructure Control Plane
              </p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Create account
            </h2>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-[#768597]">
              Every new account gets its own private workspace.
            </p>
          </div>

          {success ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                <IconCheckCircle className="h-6 w-6 text-emerald-500" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                Account created successfully
              </h3>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Sign in to get started — your workspace is private and starts empty, with no
                projects or data from other accounts.
              </p>
              <div className="mt-5 space-y-2">
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="w-full rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-teal-500 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
                >
                  Sign in now
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSuccess(false)
                    setName("")
                    setEmail("")
                    setPassword("")
                    setConfirmPassword("")
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-[#1e2531] dark:bg-[#0e1217] dark:text-slate-300 dark:hover:bg-[#151b22]"
                >
                  Register Another Account
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRegister} noValidate className="space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Full Name
                </label>
                <div className="relative">
                  <svg
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: undefined }))
                    }}
                    placeholder="John Doe"
                    autoComplete="name"
                    className={`${inputBase} ${fieldErrors.name ? inputInvalid : inputNormal}`}
                  />
                </div>
                {fieldErrors.name && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400">
                    <IconAlertCircle className="h-3 w-3 shrink-0" />
                    {fieldErrors.name}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="reg-email"
                  className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Email Address
                </label>
                <div className="relative">
                  <svg
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  <input
                    id="reg-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }))
                    }}
                    placeholder="user@cloudforge.com"
                    autoComplete="email"
                    className={`${inputBase} ${fieldErrors.email ? inputInvalid : inputNormal}`}
                  />
                </div>
                {fieldErrors.email && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400">
                    <IconAlertCircle className="h-3 w-3 shrink-0" />
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="reg-password"
                  className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Password
                </label>
                <div className="relative">
                  <svg
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    id="reg-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }))
                    }}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    className={`${inputBase} pr-11 ${fieldErrors.password ? inputInvalid : inputNormal}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#12161f] dark:hover:text-slate-300"
                  >
                    {showPassword ? (
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                        <line x1="2" x2="22" y1="2" y2="22" />
                      </svg>
                    ) : (
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400">
                    <IconAlertCircle className="h-3 w-3 shrink-0" />
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <svg
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
                      if (fieldErrors.confirmPassword)
                        setFieldErrors((p) => ({ ...p, confirmPassword: undefined }))
                    }}
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                    className={`${inputBase} ${fieldErrors.confirmPassword ? inputInvalid : inputNormal}`}
                  />
                </div>
                {fieldErrors.confirmPassword && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400">
                    <IconAlertCircle className="h-3 w-3 shrink-0" />
                    {fieldErrors.confirmPassword}
                  </p>
                )}
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
                    <span>Creating account...</span>
                  </>
                ) : (
                  <span>Create account</span>
                )}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-xs text-slate-500 dark:text-[#768597]">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="font-semibold text-teal-600 transition hover:text-teal-500 dark:text-teal-400 dark:hover:text-teal-300"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Register
