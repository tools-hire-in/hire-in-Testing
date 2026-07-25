import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export type PolicyKey =
  | "probation_cadence"
  | "pip_rule"
  | "three_strike_escalation"
  | "correction_window"
  | "leave_lwp_warning"
  | "plan_outcomes"
  | "sop_enforcement_levels"
  | "training_compliance_lock";

interface PolicyContent {
  title: string;
  snippet: string;
  anchor: string;
}

const POLICY_CONTENT: Record<PolicyKey, PolicyContent> = {
  probation_cadence: {
    title: "Probation Cadence",
    snippet:
      "8 milestones over 90 days. Day 30, 60, and 90 are formal reviews — these go on record and require a written summary. All other check-ins are coaching conversations.",
    anchor: "probation-cadence",
  },
  pip_rule: {
    title: "PIP Rule",
    snippet:
      "Weekly check-ins are mandatory during a PIP. Missing 2 consecutive check-ins without cause starts the escalation clock — HR is automatically notified after the second miss.",
    anchor: "pip-rule",
  },
  three_strike_escalation: {
    title: "3-Strike Escalation",
    snippet:
      "Trigger: 3 missed check-ins or 3 consecutive sub-30% goal progress updates. Result: plan auto-escalates to HR for review; manager must submit a written update within 48 hours.",
    anchor: "three-strike-escalation",
  },
  correction_window: {
    title: "Attendance Correction Window",
    snippet:
      "Corrections must be submitted within 3 calendar days of the attendance date. After that, only HR admin can make changes — escalate via a support ticket.",
    anchor: "correction-window",
  },
  leave_lwp_warning: {
    title: "Leave LWP Warning",
    snippet:
      "Before approving, confirm the employee has sufficient leave balance. Approving with zero balance triggers an automatic LWP (Loss of Pay) deduction in payroll. Undo by rejecting and resubmitting.",
    anchor: "leave-lwp-warning",
  },
  plan_outcomes: {
    title: "Plan Outcomes",
    snippet:
      "Passed: goals met, move to confirmation. Extended: more time needed, triggers addendum. Failed: goals not met, escalates to HR. Converted: PIP → growth plan. Terminated: immediate exit.",
    anchor: "plan-outcomes",
  },
  sop_enforcement_levels: {
    title: "SOP Enforcement Levels",
    snippet:
      "Soft: coaching banner only, no access block. Measured: manager is notified, 7-day grace period. Full: portal access restricted until compliance is achieved.",
    anchor: "sop-enforcement-levels",
  },
  training_compliance_lock: {
    title: "Training Compliance Lock",
    snippet:
      "Lock triggers when a mandatory training track is 7+ days overdue. Punch-in and punch-out are also blocked. Resolution: complete the overdue track or request a due-date extension from your manager.",
    anchor: "training-compliance-lock",
  },
};

interface PolicyHintProps {
  policyKey: PolicyKey;
  className?: string;
}

export function PolicyHint({ policyKey, className }: PolicyHintProps) {
  const content = POLICY_CONTENT[policyKey];
  if (!content) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Policy reference"
          data-testid={`policy-hint-${policyKey}`}
          className={[
            "inline-flex items-center justify-center rounded-full p-0.5",
            "text-muted-foreground hover:text-foreground focus-visible:text-foreground",
            "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "print:hidden",
            className ?? "",
          ]
            .join(" ")
            .trim()}
        >
          <Info className="h-3.5 w-3.5 hover:scale-110 transition-transform" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="max-w-[320px] p-3 space-y-2 text-sm"
        align="start"
        data-testid={`policy-hint-popover-${policyKey}`}
      >
        <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">
          {content.title}
        </p>
        <p className="text-xs leading-relaxed text-foreground">{content.snippet}</p>
        <Link
          href={`/admin/command-card#${content.anchor}`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
          data-testid={`policy-hint-link-${policyKey}`}
        >
          See full guide →
        </Link>
      </PopoverContent>
    </Popover>
  );
}
