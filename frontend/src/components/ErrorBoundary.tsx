import { Component, type ErrorInfo, type ReactNode } from "react"
import { reportErrorBoundary } from "../lib/errorReporter"
import { IconAlertTriangle } from "./Icons"

interface Props {
  children: ReactNode
  /** Fallback UI; defaults to a full-page card. */
  label?: string
}

interface State {
  error: Error | null
}

/**
 * React rendering error boundary.
 *
 * Rendering errors are caught, reported to the monitoring ingest, and
 * rendered as a recoverable fallback — instead of a blank page. Errors
 * inside event handlers are NOT caught here (by design of React), but the
 * global window handler in errorReporter covers those.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    try {
      reportErrorBoundary(
        error.message || String(error),
        info.componentStack ?? undefined,
        error.stack ?? undefined,
        this.props.label,
      )
    } catch {
      // never crash from reporting
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-[#030507]">
          <div className="w-full max-w-lg rounded-xl border border-amber-300/50 bg-amber-50 p-6 dark:border-amber-500/20 dark:bg-amber-500/5">
            <div className="flex items-center gap-3">
              <IconAlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <h1 className="text-base font-semibold text-amber-900 dark:text-amber-200">
                Something went wrong
              </h1>
            </div>
            <p className="mt-2 text-sm text-amber-800/80 dark:text-amber-200/70">
              {this.state.error.message
                ? String(this.state.error.message).slice(0, 240)
                : "An unexpected rendering error occurred."}
            </p>
            <p className="mt-1 text-xs text-amber-700/60 dark:text-amber-200/50">
              This issue has been reported to the operations team. Reloading usually fixes it.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-amber-700"
              >
                Reload page
              </button>
              <button
                onClick={() => this.setState({ error: null })}
                className="rounded-lg border border-amber-600/40 px-3 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-600/10 dark:text-amber-300"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
