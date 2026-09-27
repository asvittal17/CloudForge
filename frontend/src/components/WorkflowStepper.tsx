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

export function WorkflowStepper({
  currentStep,
  completedSteps,
  onStepClick,
}: WorkflowStepperProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep)

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#1e242c] dark:bg-[#090b0e]">
      <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1 sm:pb-0">
        {STEPS.map((step, idx) => {
          const isCompleted = completedSteps.includes(step.id)
          const isCurrent = step.id === currentStep
          const isPast = idx < currentIndex || isCompleted
          const isClickable = !!onStepClick && (isCompleted || isCurrent)

          return (
            <div key={step.id} className="flex flex-1 items-center min-w-[110px]">
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => onStepClick && onStepClick(step.id)}
                className={`group flex items-center gap-2.5 text-left transition ${
                  isClickable ? "cursor-pointer" : "cursor-default"
                }`}
              >
                {/* Step Circle */}
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition ${
                    isCompleted
                      ? "bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400"
                      : isCurrent
                        ? "bg-teal-500 text-slate-950 font-bold shadow-sm ring-2 ring-teal-500/30 dark:bg-teal-400 dark:text-slate-950"
                        : "bg-slate-100 text-slate-400 ring-1 ring-slate-200 dark:bg-[#12161c] dark:text-slate-500 dark:ring-[#1f2631]"
                  }`}
                >
                  {isCompleted ? (
                    <IconCheck className="h-3.5 w-3.5 stroke-[2.5]" />
                  ) : (
                    <span>0{idx + 1}</span>
                  )}
                </div>

                {/* Step Text */}
                <div className="min-w-0">
                  <p
                    className={`text-xs font-semibold leading-tight ${
                      isCurrent
                        ? "text-teal-600 dark:text-teal-400"
                        : isPast
                          ? "text-slate-800 dark:text-slate-200"
                          : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="hidden truncate text-[10px] text-slate-400 sm:block dark:text-[#525e6e]">
                    {step.desc}
                  </p>
                </div>
              </button>

              {/* Connecting Line */}
              {idx < STEPS.length - 1 && (
                <div
                  className={`mx-2 hidden h-[2px] flex-1 sm:block ${
                    idx < currentIndex
                      ? "bg-emerald-500/40 dark:bg-emerald-500/30"
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
