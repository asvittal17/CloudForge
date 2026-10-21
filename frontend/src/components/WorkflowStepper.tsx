import { IconCheck } from "./Icons"

export type WorkflowStepId =
  | "generate"
  | "validate"
  | "stage"
  | "plan"
  | "approve"
  | "deploy"

interface WorkflowStepperProps {
  currentStep: WorkflowStepId
  completedSteps: WorkflowStepId[]
  onStepClick?: (step: WorkflowStepId) => void
}

const STEPS: { id: WorkflowStepId; label: string; desc: string }[] = [
  { id: "generate", label: "Generate", desc: "AI / Code Spec" },
  { id: "validate", label: "Validate", desc: "Syntax & Rules" },
  { id: "stage", label: "Stage", desc: "Artifact Version" },
  { id: "plan", label: "Plan", desc: "Execution Preview" },
  { id: "approve", label: "Approve", desc: "Security Gate" },
  { id: "deploy", label: "Deploy", desc: "Cloud Apply" },
]

const PULSE_STYLE = `
@keyframes cf-step-pulse {
  0% { box-shadow: 0 0 0 0 rgba(45, 212, 191, 0.45); }
  70% { box-shadow: 0 0 0 8px rgba(45, 212, 191, 0); }
  100% { box-shadow: 0 0 0 0 rgba(45, 212, 191, 0); }
}
.cf-step-pulse {
  animation: cf-step-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
`

export function WorkflowStepper({
  currentStep,
  completedSteps,
  onStepClick,
}: WorkflowStepperProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep)

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#1e242c] dark:bg-[#090b0e]">
      <style>{PULSE_STYLE}</style>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-500/40 to-transparent dark:via-teal-400/40" />

      <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1 sm:pb-0">
        {STEPS.map((step, idx) => {
          const isCompleted = completedSteps.includes(step.id)
          const isCurrent = step.id === currentStep
          const isPast = idx < currentIndex || isCompleted
          const isClickable = !!onStepClick && (isCompleted || isCurrent)

          return (
            <div
              key={step.id}
              className="flex min-w-[110px] flex-1 items-center"
            >
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => onStepClick && onStepClick(step.id)}
                className={`group flex items-center gap-2.5 rounded-lg p-1.5 text-left transition-all duration-300 ${
                  isClickable ? "cursor-pointer" : "cursor-default"
                }`}
              >
                <span className="relative flex h-7 w-7 shrink-0 items-center justify-center">
                  {isCurrent && (
                    <span className="cf-step-pulse absolute inset-0 rounded-full" />
                  )}
                  <span
                    className={`relative flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${
                      isClickable ? "group-hover:scale-110" : ""
                    } ${
                      isCompleted
                        ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30 ring-1 ring-emerald-500/30 dark:bg-emerald-500 dark:text-slate-950"
                        : isCurrent
                          ? "bg-gradient-to-b from-teal-400 to-teal-500 font-bold text-slate-950 shadow-sm shadow-teal-500/30 ring-2 ring-teal-500/40 dark:from-teal-400 dark:to-teal-500"
                          : "bg-slate-100 text-slate-400 ring-1 ring-slate-200 transition-colors group-hover:bg-slate-200/70 dark:bg-[#12161c] dark:text-slate-500 dark:ring-[#1f2631] dark:group-hover:bg-[#171e27]"
                    }`}
                  >
                    {isCompleted ? (
                      <IconCheck className="h-3.5 w-3.5 stroke-[2.5]" />
                    ) : (
                      <span>{0 + (idx + 1)}</span>
                    )}
                  </span>
                </span>

                <div className="min-w-0">
                  <p
                    className={`text-xs font-semibold leading-tight transition-colors duration-300 ${
                      isCurrent
                        ? "text-teal-600 dark:text-teal-400"
                        : isPast
                          ? "text-slate-800 dark:text-slate-200"
                          : "text-slate-400 dark:text-slate-500"
                    } ${
                      isClickable
                        ? "group-hover:text-teal-600 dark:group-hover:text-teal-300"
                        : ""
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="hidden truncate text-[10px] text-slate-400 transition-colors sm:block dark:text-[#525e6e]">
                    {step.desc}
                  </p>
                </div>
              </button>

              {idx < STEPS.length - 1 && (
                <div
                  className={`mx-1 hidden h-[2px] flex-1 rounded-full transition-all duration-500 sm:block ${
                    idx < currentIndex || isCompleted
                      ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                      : "bg-slate-200 dark:bg-[#1a212a]"
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
