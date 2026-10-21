/**
 * Global frontend error monitoring.
 *
 * Captures uncaught JavaScript errors, unhandled promise rejections, and
 * failed API responses, then reports sanitized events to the backend
 * monitoring ingest (/monitoring/frontend-errors).
 *
 * Safety rules:
 *   - Never transmit form contents, tokens, or credentials.
 *   - Deduplicate identical messages within a short window.
 *   - Hard rate limit to prevent reporting loops flooding the backend.
 *   - failures of the reporter itself are swallowed silently.
 */

import { reportFrontendError } from "../services/api"

const MAX_REPORTS_PER_MINUTE = 12
const DEDUPE_WINDOW_MS = 10_000
const MAX_MESSAGE_LENGTH = 1000
const MAX_STACK_LENGTH = 4000

let reportCount = 0
let windowStart = 0

const recentMessages = new Map<string, number>()

function sanitizeMessageInternal(message: string): string {
  return String(message)
    .replace(/eyJ[A-Za-z0-9\-_]{20,}[A-Za-z0-9\-_/=]*/g, "[REDACTED]") // JWTs
    .replace(/(bearer|token|password|secret|api[_-]?key)\s*[:=]\s*\S+/gi, "$1=[REDACTED]")
    .slice(0, MAX_MESSAGE_LENGTH)
}

function sanitizeStack(stack: string | undefined | null): string | undefined {
  if (!stack) return undefined
  return String(stack)
    .replace(/eyJ[A-Za-z0-9\-_]{20,}[A-Za-z0-9\-_/=]*/g, "[REDACTED]")
    .replace(/(bearer|token|password|secret|api[_-]?key)\s*[:=]\s*\S+/gi, "$1=[REDACTED]")
    .slice(0, MAX_STACK_LENGTH)
}

function canReport(message: string): boolean {
  const now = Date.now()

  // Rate limit
  if (now - windowStart > 60_000) {
    windowStart = now
    reportCount = 0
  }
  if (reportCount >= MAX_REPORTS_PER_MINUTE) return false

  // Dedupe identical messages
  const last = recentMessages.get(message)
  if (last !== undefined && now - last < DEDUPE_WINDOW_MS) return false
  recentMessages.set(message, now)
  if (recentMessages.size > 50) {
    // Trim oldest entries
    const entries = [...recentMessages.entries()].sort((a, b) => a[1] - b[1])
    for (let i = 0; i < 10; i++) recentMessages.delete(entries[i][0])
  }

  return true
}

function report(
  message: string,
  category: string,
  severity: string,
  stack?: string | null,
) {
  const safe = sanitizeMessage(message)
  if (!safe || !canReport(safe)) return

  try {
    reportCount += 1
    reportFrontendError({
      message: safe,
      category,
      severity,
      route: window.location.pathname,
      stack: sanitizeStack(stack),
    })
  } catch {
    // Never crash the app from the reporter.
  }
}

/** API/network failures surface through fetch wrappers that log here. */
export function reportApiFailure(error: unknown, endpoint: string) {
  const message =
    error instanceof Error ? error.message : String(error ?? "unknown")
  report(`API request failed (${endpoint}): ${message}`, "api_request_failed", "error")
}

/** React error boundary hook — includes the component stack. */
export function reportErrorBoundary(
  message: string,
  componentStack: string | undefined,
  stack: string | undefined,
  label?: string,
) {
  const prefix = label ? `[${label}] ` : ""
  report(`${prefix}${message}`, "react_render", "critical", `${stack ?? ""}\n${componentStack ?? ""}`)
}

export function sanitizeMessage(message: string): string {
  return sanitizeMessageInternal(message)
}

export function installErrorMonitoring() {
  if (typeof window === "undefined") return

  const handler = (event: ErrorEvent) => {
    // Cross-origin script errors carry no useful detail; still record.
    const message = event.message || "Uncaught script error (no detail)"
    report(message, "js_runtime", "error", event.error?.stack ?? undefined)
  }
  window.addEventListener("error", handler)

  const rejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason
    const message =
      reason instanceof Error ? reason.message : String(reason ?? "Unhandled promise rejection")
    if (typeof message === "string" && message.includes("ResizeObserver")) return
    report(`Unhandled promise rejection: ${message}`, "js_unhandled_rejection", "error",
      reason instanceof Error ? reason.stack : undefined)
  }
  window.addEventListener("unhandledrejection", rejection)

  // Central API failure channel (decouples api.ts from the reporter).
  window.addEventListener("cloudforge:api-error", (event) => {
    const detail = (event as CustomEvent).detail as { message?: string; status?: number }
    if (detail?.message) {
      report(detail.message, "api_request_failed", (detail.status ?? 0) >= 500 ? "error" : "error")
    }
  })
}
