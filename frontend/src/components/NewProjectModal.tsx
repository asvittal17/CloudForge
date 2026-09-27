import { useState } from "react"
import { createProject } from "../services/api"

interface NewProjectModalProps {
  onClose: () => void
  onProjectCreated: (project: any) => void
}

function NewProjectModal({
  onClose,
  onProjectCreated,
}: NewProjectModalProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (!name.trim()) {
      setError("Project name is required")
      return
    }

    try {
      setLoading(true)
      setError("")

      const project = await createProject(
        name.trim(),
        description.trim()
      )

      onProjectCreated(project)

      onClose()
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError("Failed to create project")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">

      <div className="w-full max-w-md rounded-xl border border-[#263035] bg-[#121619] p-6 shadow-2xl">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between">

          <div>
            <h2 className="text-lg font-semibold text-[#f3f7f6]">
              Create New Project
            </h2>

            <p className="mt-1 text-sm text-[#8a9997]">
              Create a new CloudForge workspace.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-xl text-[#8a9997] transition hover:text-[#f3f7f6]"
          >
            ×
          </button>

        </div>


        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >

          {/* Project Name */}
          <div>

            <label
              htmlFor="project-name"
              className="mb-2 block text-sm font-medium text-[#f3f7f6]"
            >
              Project Name
            </label>

            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              placeholder="e.g. Production Infrastructure"
              className="w-full rounded-lg border border-[#263035] bg-[#0b0d0f] px-3 py-2.5 text-sm text-[#f3f7f6] outline-none placeholder:text-[#53605f] focus:border-[#28d7c5]"
            />

          </div>


          {/* Description */}
          <div>

            <label
              htmlFor="project-description"
              className="mb-2 block text-sm font-medium text-[#f3f7f6]"
            >
              Description
            </label>

            <textarea
              id="project-description"
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              placeholder="Describe your cloud infrastructure project..."
              rows={4}
              className="w-full resize-none rounded-lg border border-[#263035] bg-[#0b0d0f] px-3 py-2.5 text-sm text-[#f3f7f6] outline-none placeholder:text-[#53605f] focus:border-[#28d7c5]"
            />

          </div>


          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-sm text-red-400">
              {error}
            </div>
          )}


          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-2">

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-[#263035] px-4 py-2.5 text-sm font-medium text-[#8a9997] transition hover:border-[#3a474b] hover:text-[#f3f7f6] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[#28d7c5] px-4 py-2.5 text-sm font-semibold text-[#0b0d0f] transition hover:bg-[#63e6be] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Creating..."
                : "Create Project"}
            </button>

          </div>

        </form>

      </div>

    </div>
  )
}

export default NewProjectModal