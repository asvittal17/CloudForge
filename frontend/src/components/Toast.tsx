import { useEffect } from "react"
import { IconCheckCircle } from "./Icons"

/** Lightweight bottom toast notification. */
export function Toast({ message, onDone }: { message: string; onDone?: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDone?.(), 3000)
    return () => clearTimeout(timer)
  }, [message, onDone])

  return (
    <div className="animate-fade-in fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-white px-4 py-3 shadow-2xl dark:bg-[#0b0f14] dark:border-emerald-500/20">
      <IconCheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
        {message}
      </span>
    </div>
  )
}
