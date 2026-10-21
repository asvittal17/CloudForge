import { useState, useEffect } from "react"
import { createProject } from "../services/api"
import {
  IconClose,
  IconAlertCircle,
  IconProjects,
  IconTerminal,
  IconPlus,
} from "./Icons"

interface Project {
  id: number
  name: string
  description: string | null
  owner_id: number
  created_at: string
}

interface NewProjectModalProps {
  onClose: () => void
  onProjectCreated: (project: Project) => void
}

const MAX_DESCRIPTION_LENGTH = 500

function NewProjectModal({ onClose, onProjectCreated }: NewProjectModalProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!name.trim()) {
      setError("Project name is required")
      return
    }

    try {
      setLoading(true)
      setError("")

      const project = await createProject(name.trim(), description.trim())
      onProjectCreated(project)
      onClose()
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Failed to create project")
      }
    } finally {
      setLoading(false)
    }
  }

  const descriptionLength = description.length
  const descriptionRemaining = MAX_DESCRIPTION_LENGTH - descriptionLength
  const counterTone =
    descriptionRemaining < 50
      ? "text-amber-500 dark:text-amber-400"
      : "text-slate-400 dark:text-[#525e6e]"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="animate-fade-in fixed inset-0 bg-slate-950/60 backdrop-blur-md"
        onClick={onClose}
      />

      <div className="animate-fade-in relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-[#1e2531] dark:bg-[#090c10]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-500/50 to-transparent dark:via-teal-400/50" />

        <div className="flex items-center justify-between border-b border-slate-200/90 px-6 py-4 dark:border-[#181f29]">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:bg-teal-400/10 dark:text-teal-300">
                <IconPlus className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Create New Project
              </h2>
            </div>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-[#768597]">
              Set up a dedicated workspace for infrastructure and deployments.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-all duration-200 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-600 active:scale-95 dark:border-[#1e2531] dark:text-[#525e6e] dark:hover:border-[#2a3441] dark:hover:bg-[#131922] dark:hover:text-slate-200"
            aria-label="Close dialog"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div>
            <label
              htmlFor="project-name"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
            >
              Project Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#424e5e]">
                <IconProjects className="h-4 w-4" />
              </span>
              <input
                id="project-name"
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. production-core-infra"
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-[#222a36] dark:bg-[#06080b] dark:text-slate-100 dark:placeholder:text-[#424e5e] dark:focus:border-teal-400 dark:focus:ring-teal-400/20"
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="project-description"
                className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
              >
                Description{" "}
                <span className="text-[10px] font-normal lowercase text-slate-400 dark:text-[#525e6e]">
                  (optional)
                </span>
              </label>
              <span
                className={`font-mono text-[10px] transition-colors ${counterTone}`}
              >
                {descriptionLength}/{MAX_DESCRIPTION_LENGTH}
              </span>
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-3 text-slate-400 dark:text-[#424e5e]">
                <IconTerminal className="h-4 w-4" />
              </span>
              <textarea
                id="project-description"
                rows={3}
                maxLength={MAX_DESCRIPTION_LENGTH}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the application workload and target cloud environment..."
                className="w-full resize-none rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-[#222a36] dark:bg-[#06080b] dark:text-slate-100 dark:placeholder:text-[#424e5e] dark:focus:border-teal-400 dark:focus:ring-teal-400/20"
              />
            </div>
            <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-[#151b22]">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  descriptionRemaining < 50
                    ? "bg-amber-400"
                    : "bg-teal-400"
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    (descriptionLength / MAX_DESCRIPTION_LENGTH) * 100
                  )}%`,
                }}
              />
            </div>
          </div>

          {error && (
            <div className="animate-fade-in flex items-start gap-2.5 rounded-lg border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-600 dark:border-red-400/20 dark:text-red-400">
              <IconAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1 leading-relaxed">{error}</span>
              <button
                type="button"
                onClick={() => setError("")}
                className="shrink-0 rounded p-0.5 text-red-400/70 transition hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-300"
                aria-label="Dismiss error"
              >
                <IconClose className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-200/90 pt-4 dark:border-[#181f29]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#222a36] dark:bg-[#0e1217] dark:text-slate-300 dark:hover:bg-[#151b22]"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-b from-teal-500 to-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-teal-500/20 transition-all duration-200 hover:from-teal-400 hover:to-teal-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none dark:from-teal-500 dark:to-teal-600 dark:text-slate-950 dark:hover:from-teal-400 dark:hover:to-teal-500"
            >
              {loading ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span>Creating workspace...</span>
                </>
              ) : (
                <>
                  <IconPlus className="h-3.5 w-3.5" />
                  <span>Create Workspace</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default NewProjectModal
