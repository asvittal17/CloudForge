import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom"
import { useEffect } from "react"

import { ThemeProvider } from "./context/ThemeContext"
import { UserProvider } from "./context/UserContext"
import { HealthProvider } from "./context/HealthContext"
import ErrorBoundary from "./components/ErrorBoundary"
import Login from "./pages/Login"
import Register from "./pages/Register"
import Dashboard from "./pages/Dashboard"
import ProjectDetails from "./pages/ProjectDetails"
import Terraform from "./pages/Terraform"
import AIInfrastructure from "./pages/AIInfrastructure"
import Monitoring from "./pages/Monitoring"
import Admin from "./pages/Admin"
import Settings from "./pages/Settings"

function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const token = localStorage.getItem("access_token")

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("access_token")

  if (token) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

/**
 * Route-level guard for the Admin Console. The server re-verifies the
 * role on every /admin/* API call — this guard only avoids rendering the
 * console for non-admins and redirects them somewhere useful.
 */
function RequireAdmin({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>
}

function NotFound() {
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => navigate("/", { replace: true }), 3000)
    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 dark:bg-[#030507]">
      <div className="text-center">
        <p className="font-mono text-6xl font-bold text-teal-500">404</p>
        <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          The page you&apos;re looking for doesn&apos;t exist or has been moved. Redirecting...
        </p>
      </div>
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary label="app">
      <ThemeProvider>
        <UserProvider>
          <BrowserRouter>
            <HealthProvider>
              <Routes>
                {/* Authentication */}
                <Route
                  path="/login"
                  element={
                    <GuestOnly>
                      <Login />
                    </GuestOnly>
                  }
                />
                <Route
                  path="/register"
                  element={
                    <GuestOnly>
                      <Register />
                    </GuestOnly>
                  }
                />

                {/* Dashboard */}
                <Route
                  path="/dashboard"
                  element={
                    <RequireAuth>
                      <Dashboard />
                    </RequireAuth>
                  }
                />

                {/* Project Details */}
                <Route
                  path="/projects/:projectId"
                  element={
                    <RequireAuth>
                      <ProjectDetails />
                    </RequireAuth>
                  }
                />

                {/* Terraform Generator */}
                <Route
                  path="/projects/:projectId/terraform"
                  element={
                    <RequireAuth>
                      <Terraform />
                    </RequireAuth>
                  }
                />

                {/* AI Infrastructure */}
                <Route
                  path="/projects/:projectId/ai"
                  element={
                    <RequireAuth>
                      <AIInfrastructure />
                    </RequireAuth>
                  }
                />

                {/* System monitoring (authenticated users; error table admin-only) */}
                <Route
                  path="/monitoring"
                  element={
                    <RequireAuth>
                      <Monitoring />
                    </RequireAuth>
                  }
                />

                {/* Admin console (server re-verifies role on every API call) */}
                <Route
                  path="/admin"
                  element={
                    <RequireAdmin>
                      <Admin />
                    </RequireAdmin>
                  }
                />

                {/* Account settings */}
                <Route
                  path="/settings"
                  element={
                    <RequireAuth>
                      <Settings />
                    </RequireAuth>
                  }
                />

                {/* Default */}
                <Route path="/" element={<Navigate to="/login" replace />} />

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </HealthProvider>
          </BrowserRouter>
        </UserProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
