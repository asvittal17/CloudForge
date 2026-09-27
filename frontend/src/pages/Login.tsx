import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { login } from "../services/api"


function Login() {
  const navigate = useNavigate()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)


  async function handleLogin(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    setError("")
    setLoading(true)

    try {
      const data = await login(email, password)

      localStorage.setItem(
        "access_token",
        data.access_token
      )

      navigate("/dashboard")
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError("Login failed")
      }
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b0d0f] px-4">

      {/* Background grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(#28d7c5 1px, transparent 1px), linear-gradient(90deg, #28d7c5 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#28d7c5]/5 blur-3xl" />


      <div className="relative w-full max-w-md">

        {/* Brand */}
        <div className="mb-8 text-center">

          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-[#28d7c5]/30 bg-[#121619]">
            <div className="h-4 w-4 rounded-full bg-[#28d7c5] shadow-[0_0_20px_rgba(40,215,197,0.5)]" />
          </div>

          <h1 className="text-4xl font-semibold tracking-tight text-[#f3f7f6]">
            CloudForge
          </h1>

          <p className="mt-3 text-sm text-[#8a9997]">
            Cloud infrastructure. Automated.
          </p>

        </div>


        {/* Login card */}
        <div className="rounded-2xl border border-[#263035] bg-[#121619]/95 p-8 shadow-2xl backdrop-blur">

          <div className="mb-7">
            <h2 className="text-xl font-semibold text-[#f3f7f6]">
              Sign in
            </h2>

            <p className="mt-1.5 text-sm text-[#8a9997]">
              Access your infrastructure workspace
            </p>
          </div>


          <form
            onSubmit={handleLogin}
            className="space-y-5"
          >

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[#8a9997]">
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="admin@cloudforge.com"
                required
                className="w-full rounded-lg border border-[#263035] bg-[#0b0d0f] px-4 py-3 text-sm text-[#f3f7f6] outline-none transition placeholder:text-[#53605f] focus:border-[#28d7c5] focus:ring-1 focus:ring-[#28d7c5]/30"
              />
            </div>


            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[#8a9997]">
                Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="••••••••"
                required
                className="w-full rounded-lg border border-[#263035] bg-[#0b0d0f] px-4 py-3 text-sm text-[#f3f7f6] outline-none transition placeholder:text-[#53605f] focus:border-[#28d7c5] focus:ring-1 focus:ring-[#28d7c5]/30"
              />
            </div>


            {error && (
              <div className="rounded-lg border border-[#ff7b7b]/30 bg-[#ff7b7b]/5 px-4 py-3 text-sm text-[#ff7b7b]">
                {error}
              </div>
            )}


            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#28d7c5] px-4 py-3 text-sm font-semibold text-[#0b0d0f] transition hover:bg-[#63e6be] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Authenticating..." : "Sign in"}
            </button>

          </form>

        </div>


        <p className="mt-6 text-center text-xs text-[#53605f]">
          CloudForge • Infrastructure Control Plane
        </p>

      </div>
    </div>
  )
}


export default Login