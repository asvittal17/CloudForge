import { useState, useMemo } from "react"
import { IconCopy, IconCheck, IconFileCode } from "./Icons"

interface CodeViewerProps {
  files: Record<string, string>
  activeFile: string
  onSelectFile?: (file: string) => void
  readOnly?: boolean
  maxHeight?: string
  title?: string
}

const BLOCK_KEYWORDS = new Set([
  "resource",
  "variable",
  "output",
  "provider",
  "terraform",
  "data",
  "locals",
  "module",
  "import",
  "moved",
  "check",
])

const META_KEYWORDS = new Set([
  "provisioner",
  "lifecycle",
  "count",
  "for_each",
  "dynamic",
  "run",
  "removed",
])

const TYPE_KEYWORDS = new Set([
  "string",
  "number",
  "bool",
  "list",
  "map",
  "set",
  "object",
  "tuple",
  "any",
])

const LITERAL_KEYWORDS = new Set(["true", "false", "null"])

const TOKEN_PATTERN =
  /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*)|("(?:[^"\\\n]|\\.)*")|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_-]*)|(\s+)|(.)/g

function classifyToken(
  token: string,
  tokens: string[],
  idx: number
): string {
  if (/^(\/\/|#)/.test(token) || /^\/\*/.test(token)) {
    return "italic text-[#64748b] dark:text-[#5b6a7d]"
  }
  if (token.startsWith('"')) {
    return "text-[#10b981] dark:text-[#5eead4]"
  }
  if (/^\d/.test(token)) {
    return "text-[#0284c7] dark:text-[#7dd3fc]"
  }
  if (/^[A-Za-z_]/.test(token)) {
    if (BLOCK_KEYWORDS.has(token)) {
      return "font-semibold text-[#7c3aed] dark:text-[#c4b5fd]"
    }
    if (META_KEYWORDS.has(token)) {
      return "font-medium text-[#0891b2] dark:text-[#67e8f9]"
    }
    if (TYPE_KEYWORDS.has(token)) {
      return "text-[#d97706] dark:text-[#fcd34d]"
    }
    if (LITERAL_KEYWORDS.has(token)) {
      return "font-medium text-[#db2777] dark:text-[#f9a8d4]"
    }
    for (let i = idx + 1; i < tokens.length; i += 1) {
      const next = tokens[i]
      if (/^\s+$/.test(next)) continue
      if (next === "=") {
        return "text-[#0d9488] dark:text-[#2dd4bf]"
      }
      break
    }
    return "text-slate-700 dark:text-slate-300"
  }
  return "text-slate-500 dark:text-[#7c8a9c]"
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  )
}

export function CodeViewer({
  files,
  activeFile,
  onSelectFile,
  maxHeight = "520px",
  title = "Terraform Configuration",
}: CodeViewerProps) {
  const [copied, setCopied] = useState(false)

  const currentCode = files[activeFile] ?? ""

  const lines = useMemo(() => {
    return currentCode.split("\n")
  }, [currentCode])

  const handleCopy = async () => {
    if (!currentCode) return
    try {
      await navigator.clipboard.writeText(currentCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  const handleDownload = () => {
    if (!currentCode) return
    const blob = new Blob([currentCode], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = activeFile || "main.tf"
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  const renderSyntaxLine = (line: string) => {
    if (!line) return <span>&nbsp;</span>

    const tokens = line.match(TOKEN_PATTERN) ?? []
    if (tokens.length === 0) return <span>&nbsp;</span>

    return tokens.map((token, idx) => {
      const className = classifyToken(token, tokens, idx)
      return (
        <span key={idx} className={className}>
          {token}
        </span>
      )
    })
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-[#1e242c] dark:bg-[#06080a]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-2.5 dark:border-[#1a2027] dark:bg-[#0b0e13]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/80 dark:bg-red-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80 dark:bg-amber-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80 dark:bg-emerald-500/60" />
          </div>
          <span className="text-slate-300 dark:text-[#232a35]">|</span>
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {title}
          </span>
          <span className="rounded-md border border-teal-500/20 bg-teal-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-teal-600 dark:border-teal-400/20 dark:bg-teal-400/10 dark:text-teal-300">
            HCL
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-[11px] text-slate-500 sm:inline dark:text-[#606e7e]">
            {lines.length} lines • {currentCode.length} chars
          </span>

          <button
            type="button"
            onClick={handleDownload}
            title="Download file"
            className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 active:scale-95 dark:border-[#222a36] dark:bg-[#11161d] dark:text-slate-300 dark:hover:border-teal-500/40 dark:hover:text-teal-400"
          >
            <DownloadIcon className="h-3.5 w-3.5" />
            <span>Download</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            title="Copy to clipboard"
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium shadow-sm transition-all duration-200 active:scale-95 ${
              copied
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:border-emerald-400/40 dark:text-emerald-400"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-[#222a36] dark:bg-[#11161d] dark:text-slate-300 dark:hover:border-teal-500/40 dark:hover:text-teal-400"
            }`}
          >
            <span
              className={`flex h-3.5 w-3.5 items-center justify-center transition-transform duration-200 ${
                copied ? "scale-110" : "scale-100"
              }`}
            >
              {copied ? (
                <IconCheck className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <IconCopy className="h-3.5 w-3.5" />
              )}
            </span>
            <span className="transition-colors duration-200">
              {copied ? "Copied!" : "Copy"}
            </span>
          </button>
        </div>
      </div>

      <div className="flex items-end overflow-x-auto border-b border-slate-200 bg-slate-100/60 px-2 pt-2 dark:border-[#1a2027] dark:bg-[#080b0f]">
        {Object.keys(files).map((file) => {
          const isActive = file === activeFile
          return (
            <button
              key={file}
              type="button"
              onClick={() => onSelectFile && onSelectFile(file)}
              className={`relative flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-xs font-medium transition-all duration-200 active:scale-[0.97] ${
                isActive
                  ? "border-teal-500 bg-white text-teal-700 shadow-sm dark:border-teal-400 dark:bg-[#0c1015] dark:text-teal-300"
                  : "border-transparent text-slate-500 hover:bg-white/70 hover:text-slate-900 dark:text-[#8a94a3] dark:hover:bg-[#0d1117] dark:hover:text-slate-200"
              }`}
            >
              <IconFileCode
                className={`h-3.5 w-3.5 transition-colors ${
                  isActive
                    ? "text-teal-500 dark:text-teal-400"
                    : "text-slate-400 dark:text-[#5b6a7d]"
                }`}
              />
              <span className="font-mono">{file}</span>
              {isActive && (
                <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-teal-400/60" />
              )}
            </button>
          )
        })}
      </div>

      <div
        className="overflow-auto font-mono text-xs leading-[1.65]"
        style={{ maxHeight }}
      >
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, index) => {
              const lineNum = index + 1
              return (
                <tr
                  key={lineNum}
                  className="transition-colors hover:bg-slate-50/80 dark:hover:bg-[#0e1319]/80"
                >
                  <td className="w-12 select-none border-r border-slate-200/80 bg-slate-50/60 px-3 py-0.5 text-right font-mono text-[11px] tabular-nums text-slate-400 dark:border-[#171e27] dark:bg-[#080b0e] dark:text-[#434e5c]">
                    {lineNum}
                  </td>
                  <td className="whitespace-pre px-4 py-0.5 text-slate-800 dark:text-slate-200">
                    {renderSyntaxLine(line)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
