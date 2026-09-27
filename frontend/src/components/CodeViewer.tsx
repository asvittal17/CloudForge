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

  // Tokenize a line of HCL / Terraform code for syntax styling
  const renderSyntaxLine = (line: string) => {
    if (!line) return <span>&nbsp;</span>

    // Handle comments
    const trimmed = line.trimStart()
    if (trimmed.startsWith("#") || trimmed.startsWith("//")) {
      return (
        <span className="text-[#6b7280] dark:text-[#525e6e] italic">
          {line}
        </span>
      )
    }

    // Split preserving strings
    const parts = line.split(/("[^"]*")/g)

    return parts.map((part, idx) => {
      if (part.startsWith('"') && part.endsWith('"')) {
        return (
          <span
            key={idx}
            className="text-[#059669] dark:text-[#34d399]"
          >
            {part}
          </span>
        )
      }

      // Check for keywords and attribute assignments
      const words = part.split(/\b/)
      return (
        <span key={idx}>
          {words.map((word, wIdx) => {
            const isBlockKeyword =
              /^(resource|variable|output|provider|terraform|data|locals|module)$/.test(
                word
              )
            const isTypeKeyword =
              /^(string|number|bool|list|map|any|true|false)$/.test(word)

            if (isBlockKeyword) {
              return (
                <span
                  key={wIdx}
                  className="font-semibold text-[#8b5cf6] dark:text-[#c084fc]"
                >
                  {word}
                </span>
              )
            }
            if (isTypeKeyword) {
              return (
                <span
                  key={wIdx}
                  className="text-[#d97706] dark:text-[#fbbf24]"
                >
                  {word}
                </span>
              )
            }
            if (/^[0-9]+$/.test(word)) {
              return (
                <span
                  key={wIdx}
                  className="text-[#3b82f6] dark:text-[#60a5fa]"
                >
                  {word}
                </span>
              )
            }
            return word
          })}
        </span>
      )
    })
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-[#1e242c] dark:bg-[#06080a]">
      {/* IDE Top Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-2 text-xs dark:border-[#1a2027] dark:bg-[#0b0e13]">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/80 dark:bg-red-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80 dark:bg-amber-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80 dark:bg-emerald-500/60" />
          </div>
          <span className="mx-2 text-slate-300 dark:text-[#232a35]">|</span>
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {title}
          </span>
          <span className="rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-[#182029] dark:text-slate-400">
            HCL
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="font-mono text-[11px] text-slate-500 dark:text-[#606e7e]">
            {lines.length} lines • {currentCode.length} chars
          </span>

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-[#222a36] dark:bg-[#11161d] dark:text-slate-300 dark:hover:border-teal-500/40 dark:hover:text-teal-400"
          >
            {copied ? (
              <>
                <IconCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">
                  Copied
                </span>
              </>
            ) : (
              <>
                <IconCopy className="h-3.5 w-3.5" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* File Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-100/60 px-2 dark:border-[#1a2027] dark:bg-[#080b0f]">
        {Object.keys(files).map((file) => {
          const isActive = file === activeFile
          return (
            <button
              key={file}
              type="button"
              onClick={() => onSelectFile && onSelectFile(file)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-medium transition ${
                isActive
                  ? "border-teal-500 bg-white text-teal-600 shadow-sm dark:border-teal-400 dark:bg-[#0c1015] dark:text-teal-300"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <IconFileCode className={`h-3.5 w-3.5 ${isActive ? "text-teal-500" : "text-slate-400"}`} />
              <span className="font-mono">{file}</span>
            </button>
          )
        })}
      </div>

      {/* Code Area with Line Numbers */}
      <div
        className="overflow-auto font-mono text-xs leading-relaxed"
        style={{ maxHeight }}
      >
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, index) => {
              const lineNum = index + 1
              return (
                <tr
                  key={lineNum}
                  className="hover:bg-slate-50/70 dark:hover:bg-[#0e1319]/80"
                >
                  <td className="w-12 select-none border-r border-slate-200/80 bg-slate-50/40 px-3 py-0.5 text-right font-mono text-[11px] text-slate-400 dark:border-[#171e27] dark:bg-[#080b0e] dark:text-[#434e5c]">
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
