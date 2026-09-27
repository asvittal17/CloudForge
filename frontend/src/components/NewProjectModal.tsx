import { useState, useEffect } from "react"
import { createProject } from "../services/api"
import { IconClose, IconAlertCircle } from "./Icons"

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

function NewProjectModal({ onClose, onProjectCreated }: NewProjectModalProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Close on Escape key
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-[#1e2531] dark:bg-[#090c10]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200/90 px-6 py-4 dark:border-[#181f29]">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Create New Project
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-[#768597]">
              Set up a dedicated workspace for infrastructure and deployments.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:border-[#1e2531] dark:text-[#525e6e] dark:hover:bg-[#131922] dark:hover:text-slate-200"
            aria-label="Close dialog"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Project Name */}
          <div>
            <label
              htmlFor="project-name"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
            >
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              id="project-name"
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. production-core-infra"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:border-[#222a36] dark:bg-[#06080b] dark:text-slate-100 dark:placeholder:text-[#424e5e] dark:focus:border-teal-400 dark:focus:ring-teal-400/30"
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="project-description"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
            >
              Description <span className="text-slate-400 text-[10px] font-normal lowercase">(optional)</span>
            </label>
            <textarea
              id="project-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the application workload and target cloud environment..."
              className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:border-[#222a36] dark:bg-[#06080b] dark:text-slate-100 dark:placeholder:text-[#424e5e] dark:focus:border-teal-400 dark:focus:ring-teal-400/30"
            />
          </div>

          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-2.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-600 dark:text-red-400">
              <IconAlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200/90 dark:border-[#181f29]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-[#222a36] dark:bg-[#0e1217] dark:text-slate-300 dark:hover:bg-[#151b22]"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-50 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
            >
              {loading ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span>Creating workspace...</span>
                </>
              ) : (
                <span>Create Workspace</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default NewProjectModal