import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { getInfrastructure } from "../services/api"
import InfrastructureForm from "../components/InfrastructureForm"


interface Project {
  id: number
  name: string
  description: string | null
  owner_id: number
  created_at: string
}


interface Infrastructure {
  id: number
  project_id: number
  cloud_provider: string
  region: string
  environment: string
  architecture: string | null
  created_at: string
}


function ProjectDetails() {
  const { projectId } = useParams()
  const navigate = useNavigate()


  // ================================
  // Theme
  // ================================

  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("cloudforge_theme")
    return savedTheme !== "light"
  })


  // ================================
  // Project State
  // ================================

  const [project, setProject] =
    useState<Project | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState("")


  // ================================
  // Infrastructure State
  // ================================

  const [infrastructure, setInfrastructure] =
    useState<Infrastructure | null>(null)

  const [loadingInfrastructure, setLoadingInfrastructure] =
    useState(true)

  const [infrastructureError, setInfrastructureError] =
    useState("")

  const [showInfrastructureForm, setShowInfrastructureForm] =
    useState(false)


  // ================================
  // Load Project
  // ================================

  useEffect(() => {
    async function loadProject() {
      try {
        setLoading(true)
        setError("")

        const token =
          localStorage.getItem("access_token")

        const response = await fetch(
          `http://localhost:8000/projects/${projectId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        const data = await response.json()

        if (!response.ok) {
          throw new Error(
            data.detail ||
            "Failed to load project"
          )
        }

        setProject(data)

      } catch (error) {

        if (error instanceof Error) {
          setError(error.message)
        } else {
          setError(
            "Failed to load project"
          )
        }

      } finally {
        setLoading(false)
      }
    }

    loadProject()

  }, [projectId])


  // ================================
  // Load Infrastructure
  // ================================

  useEffect(() => {

    if (!projectId) {
      return
    }

    async function loadInfrastructure() {

      try {

        setLoadingInfrastructure(true)
        setInfrastructureError("")

        const data =
          await getInfrastructure(
            Number(projectId)
          )

        setInfrastructure(data)

      } catch (error) {

        if (error instanceof Error) {
          setInfrastructureError(
            error.message
          )
        } else {
          setInfrastructureError(
            "Failed to load infrastructure"
          )
        }

      } finally {

        setLoadingInfrastructure(false)

      }
    }

    loadInfrastructure()

  }, [projectId])


  // ================================
  // Theme Configuration
  // ================================

  const theme = darkMode
    ? {
        page:
          "bg-[#0b0d0f] text-[#f3f7f6]",

        header:
          "bg-[#0f1214] border-[#263035]",

        sidebar:
          "bg-[#0f1214] border-[#263035]",

        card:
          "bg-[#121619] border-[#263035]",

        muted:
          "text-[#8a9997]",

        subtle:
          "text-[#53605f]",

        hover:
          "hover:bg-[#181d20]",
      }
    : {
        page:
          "bg-[#f4f7f6] text-[#17201f]",

        header:
          "bg-white border-[#d9e1df]",

        sidebar:
          "bg-white border-[#d9e1df]",

        card:
          "bg-white border-[#d9e1df]",

        muted:
          "text-[#60706d]",

        subtle:
          "text-[#82908d]",

        hover:
          "hover:bg-[#eef3f1]",
      }


  // ================================
  // Loading Screen
  // ================================

  if (loading) {

    return (
      <div
        className={`flex min-h-screen items-center justify-center ${theme.page}`}
      >

        <p className={theme.muted}>
          Loading project...
        </p>

      </div>
    )
  }


  // ================================
  // Error Screen
  // ================================

  if (error || !project) {

    return (
      <div
        className={`flex min-h-screen flex-col items-center justify-center ${theme.page}`}
      >

        <p className="mb-4 text-red-400">
          {error || "Project not found"}
        </p>


        <button
          type="button"
          onClick={() =>
            navigate("/dashboard")
          }
          className="rounded-lg bg-[#28d7c5] px-4 py-2 text-sm font-semibold text-[#0b0d0f]"
        >
          Back to Dashboard
        </button>

      </div>
    )
  }


  // ================================
  // Main UI
  // ================================

  return (
    <div
      className={`min-h-screen ${theme.page}`}
    >

      {/* ================================
          Header
      ================================= */}

      <header
        className={`border-b ${theme.header}`}
      >

        <div className="flex h-16 items-center justify-between px-8">

          {/* Logo */}

          <div className="flex items-center gap-3">

            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#28d7c5]/30 bg-[#121619]">

              <div className="h-3 w-3 rounded-full bg-[#28d7c5]" />

            </div>


            <div>

              <h1 className="text-sm font-semibold">
                CloudForge
              </h1>

              <p
                className={`text-[11px] ${theme.subtle}`}
              >
                PROJECT WORKSPACE
              </p>

            </div>

          </div>


          {/* Header Actions */}

          <div className="flex items-center gap-4">

            {/* Theme Toggle */}

            <button
              type="button"
              onClick={() => {

                const newDarkMode =
                  !darkMode

                setDarkMode(
                  newDarkMode
                )

                localStorage.setItem(
                  "cloudforge_theme",
                  newDarkMode
                    ? "dark"
                    : "light"
                )

              }}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border ${theme.header} transition hover:border-[#28d7c5]/50`}
              title={
                darkMode
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
            >
              {darkMode ? "☀" : "☾"}
            </button>


            {/* Dashboard */}

            <button
              type="button"
              onClick={() =>
                navigate("/dashboard")
              }
              className={`border px-4 py-2 text-sm ${theme.muted} transition hover:border-[#28d7c5]/40 hover:text-[#28d7c5]`}
            >
              ← Dashboard
            </button>

          </div>

        </div>

      </header>


      {/* ================================
          Main Layout
      ================================= */}

      <div className="flex">

        {/* Sidebar */}

        <aside
          className={`hidden min-h-[calc(100vh-4rem)] w-64 border-r lg:block ${theme.sidebar}`}
        >

          <nav className="space-y-1 p-4">

            <p
              className={`mb-6 px-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.15em] ${theme.subtle}`}
            >
              Project
            </p>


            {/* Overview */}

            <button
              className="flex w-full items-center gap-3 rounded-lg border border-[#28d7c5]/20 bg-[#28d7c5]/5 px-3 py-2.5 text-sm font-medium text-[#28d7c5]"
            >
              Overview
            </button>


            {/* Infrastructure */}

            <button
              type="button"
              onClick={() =>
                setShowInfrastructureForm(
                  true
                )
              }
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${theme.muted} ${theme.hover}`}
            >
              Infrastructure
            </button>


            {/* Terraform */}

            <button
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${theme.muted} ${theme.hover}`}
            >
              Terraform
            </button>


            {/* Deployments */}

            <button
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${theme.muted} ${theme.hover}`}
            >
              Deployments
            </button>


            {/* Monitoring */}

            <button
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${theme.muted} ${theme.hover}`}
            >
              Monitoring
            </button>


            {/* AI */}

            <div className="mb-2 mt-8 px-3">

              <p
                className={`text-[10px] font-semibold uppercase tracking-[0.15em] ${theme.subtle}`}
              >
                AI
              </p>

            </div>


            <button
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${theme.muted} ${theme.hover}`}
            >
              AI Cloud Assistant
            </button>

          </nav>

        </aside>


        {/* Main Content */}

        <main className="flex-1">

          <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">

            {/* ================================
                Breadcrumb
            ================================= */}

            <button
              type="button"
              onClick={() =>
                navigate("/dashboard")
              }
              className={`mb-6 text-sm ${theme.muted} transition hover:text-[#28d7c5]`}
            >
              ← Back to Projects
            </button>


            {/* ================================
                Project Header
            ================================= */}

            <div
              className={`border p-7 ${theme.card}`}
            >

              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">

                <div>

                  <div className="mb-3 flex items-center gap-3">

                    <h2 className="text-3xl font-semibold">
                      {project.name}
                    </h2>


                    <span className="rounded-full border border-[#63e6be]/20 bg-[#63e6be]/5 px-2 py-0.5 text-[10px] font-medium text-[#63e6be]">
                      ACTIVE
                    </span>

                  </div>


                  <p
                    className={`max-w-2xl text-sm ${theme.muted}`}
                  >
                    {project.description ||
                      "No project description provided."}
                  </p>

                </div>


                <button
                  type="button"
                  onClick={() =>
                    setShowInfrastructureForm(
                      true
                    )
                  }
                  className="rounded-lg bg-[#28d7c5] px-5 py-2.5 text-sm font-semibold text-[#0b0d0f] transition hover:bg-[#63e6be]"
                >
                  Deploy Infrastructure
                </button>

              </div>

            </div>


            {/* ================================
                Infrastructure Form
            ================================= */}

            {showInfrastructureForm && (

              <div className="mb-8 mt-8">

                <InfrastructureForm
  projectId={project.id}
  existingInfrastructure={infrastructure}
  onSaved={(data) => {
    setInfrastructure(data)
    setShowInfrastructureForm(false)
  }}
  onCancel={() => {
    setShowInfrastructureForm(false)
  }}
/>
              </div>

            )}


            {/* ================================
                Workspace Cards
            ================================= */}

            <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">


              {/* Infrastructure */}

              <div
                className={`border p-6 ${theme.card}`}
              >

                <p
                  className={`text-xs uppercase tracking-wider ${theme.subtle}`}
                >
                  Infrastructure
                </p>


                {loadingInfrastructure ? (

                  <>
                    <h3 className="mt-3 text-xl font-semibold">
                      Loading...
                    </h3>

                    <p
                      className={`mt-2 text-sm ${theme.muted}`}
                    >
                      Loading infrastructure configuration.
                    </p>
                  </>

                ) : infrastructure ? (

                  <>

                    <h3 className="mt-3 text-xl font-semibold">
                      {infrastructure.cloud_provider}
                    </h3>


                    <div className="mt-4 space-y-2 text-sm">

                      <div className="flex justify-between gap-4">

                        <span className={theme.muted}>
                          Region
                        </span>

                        <span className="font-mono">
                          {infrastructure.region}
                        </span>

                      </div>


                      <div className="flex justify-between gap-4">

                        <span className={theme.muted}>
                          Environment
                        </span>

                        <span>
                          {infrastructure.environment}
                        </span>

                      </div>


                      <div className="flex justify-between gap-4">

                        <span className={theme.muted}>
                          Resources
                        </span>

                        <span className="text-[#63e6be]">
                          Configured
                        </span>

                      </div>

                    </div>


                    {infrastructure.architecture && (

                      <div className="mt-4 rounded-lg border border-[#263035] bg-black/5 p-3">

                        <p
                          className={`text-[10px] uppercase tracking-wider ${theme.subtle}`}
                        >
                          Architecture
                        </p>


                        <p
                          className={`mt-1 text-sm ${theme.muted}`}
                        >
                          {infrastructure.architecture}
                        </p>

                      </div>

                    )}


                    <button
                      type="button"
                      onClick={() =>
                        setShowInfrastructureForm(
                          true
                        )
                      }
                      className="mt-5 text-sm font-medium text-[#28d7c5] transition hover:text-[#63e6be]"
                    >
                      Manage Infrastructure →
                    </button>

                  </>

                ) : (

                  <>

                    <h3 className="mt-3 text-xl font-semibold">
                      Not Configured
                    </h3>


                    <p
                      className={`mt-2 text-sm ${theme.muted}`}
                    >
                      {infrastructureError ||
                        "No infrastructure configuration exists for this project."}
                    </p>


                    <button
                      type="button"
                      onClick={() =>
                        setShowInfrastructureForm(
                          true
                        )
                      }
                      className="mt-5 text-sm font-medium text-[#28d7c5]"
                    >
                      Configure Infrastructure →
                    </button>

                  </>

                )}

              </div>


              {/* Terraform */}

              <div
                className={`border p-6 ${theme.card}`}
              >

                <p
                  className={`text-xs uppercase tracking-wider ${theme.subtle}`}
                >
                  Terraform
                </p>


                <h3 className="mt-3 text-xl font-semibold">
                  Not Generated
                </h3>


                <p
                  className={`mt-2 text-sm ${theme.muted}`}
                >
                  Generate infrastructure code from your architecture.
                </p>


                <button
  type="button"
  onClick={() =>
    navigate(
      `/projects/${project.id}/terraform`
    )
  }
  className="mt-5 text-sm font-medium text-[#28d7c5] transition hover:text-[#63e6be]"
>
  Open Terraform →
</button>

              </div>


              {/* Deployments */}

              <div
                className={`border p-6 ${theme.card}`}
              >

                <p
                  className={`text-xs uppercase tracking-wider ${theme.subtle}`}
                >
                  Deployments
                </p>


                <h3 className="mt-3 text-xl font-semibold">
                  0 Deployments
                </h3>


                <p
                  className={`mt-2 text-sm ${theme.muted}`}
                >
                  Deployment history for this project.
                </p>


                <button
                  className="mt-5 text-sm font-medium text-[#28d7c5]"
                >
                  View Deployments →
                </button>

              </div>


              {/* Monitoring */}

              <div
                className={`border p-6 ${theme.card}`}
              >

                <p
                  className={`text-xs uppercase tracking-wider ${theme.subtle}`}
                >
                  Monitoring
                </p>


                <h3 className="mt-3 text-xl font-semibold">
                  No Metrics
                </h3>


                <p
                  className={`mt-2 text-sm ${theme.muted}`}
                >
                  Infrastructure monitoring will appear here.
                </p>


                <button
                  className="mt-5 text-sm font-medium text-[#28d7c5]"
                >
                  Open Monitoring →
                </button>

              </div>


              {/* AI CloudOps */}

              <div
                className={`border p-6 ${theme.card}`}
              >

                <p
                  className={`text-xs uppercase tracking-wider ${theme.subtle}`}
                >
                  AI CloudOps
                </p>


                <h3 className="mt-3 text-xl font-semibold">
                  AI Assistant
                </h3>


                <p
                  className={`mt-2 text-sm ${theme.muted}`}
                >
                  Analyze infrastructure and get AI-powered recommendations.
                </p>


                <button
                  className="mt-5 text-sm font-medium text-[#28d7c5]"
                >
                  Open AI Assistant →
                </button>

              </div>

            </div>


            {/* ================================
                Project Information
            ================================= */}

            <section className="mt-10">

              <h3 className="text-lg font-semibold">
                Project Information
              </h3>


              <div
                className={`mt-4 border ${theme.card}`}
              >

                <div className="grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-4">

                  {/* Project ID */}

                  <div>

                    <p
                      className={`text-xs uppercase tracking-wider ${theme.subtle}`}
                    >
                      Project ID
                    </p>


                    <p className="mt-2 font-mono text-sm">
                      #{project.id}
                    </p>

                  </div>


                  {/* Owner ID */}

                  <div>

                    <p
                      className={`text-xs uppercase tracking-wider ${theme.subtle}`}
                    >
                      Owner ID
                    </p>


                    <p className="mt-2 font-mono text-sm">
                      #{project.owner_id}
                    </p>

                  </div>


                  {/* Created */}

                  <div>

                    <p
                      className={`text-xs uppercase tracking-wider ${theme.subtle}`}
                    >
                      Created
                    </p>


                    <p className="mt-2 text-sm">

                      {new Date(
                        project.created_at
                      ).toLocaleDateString()}

                    </p>

                  </div>


                  {/* Status */}

                  <div>

                    <p
                      className={`text-xs uppercase tracking-wider ${theme.subtle}`}
                    >
                      Status
                    </p>


                    <p className="mt-2 text-sm text-[#63e6be]">
                      Active
                    </p>

                  </div>

                </div>

              </div>

            </section>

          </div>

        </main>

      </div>

    </div>
  )
}


export default ProjectDetails