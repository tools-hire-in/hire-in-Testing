import { cn } from "@/lib/utils"

interface StepIndicatorProps {
  steps: string[]
  current: number
  className?: string
}

/**
 * StepIndicator — visual-only horizontal progress indicator for multi-step forms.
 * `current` is 0-indexed.
 */
export function StepIndicator({ steps, current, className }: StepIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-0 w-full", className)} role="list" aria-label="Form steps">
      {steps.map((label, i) => {
        const isDone = i < current
        const isActive = i === current
        return (
          <div key={i} className="flex items-center flex-1 min-w-0" role="listitem">
            <div className="flex flex-col items-center shrink-0">
              <div
                className={cn(
                  "flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold border-2 transition-colors",
                  isDone && "bg-primary border-primary text-primary-foreground",
                  isActive && "bg-background border-primary text-primary",
                  !isDone && !isActive && "bg-background border-muted-foreground/30 text-muted-foreground",
                )}
                aria-current={isActive ? "step" : undefined}
              >
                {isDone ? (
                  <svg viewBox="0 0 12 12" className="w-3.5 h-3.5" fill="currentColor">
                    <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={cn(
                  "mt-1 text-[10px] font-medium text-center leading-tight max-w-[64px] truncate",
                  isActive ? "text-primary" : isDone ? "text-muted-foreground" : "text-muted-foreground/60",
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-1 mt-[-14px] rounded-full transition-colors",
                  isDone ? "bg-primary" : "bg-muted-foreground/20",
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
