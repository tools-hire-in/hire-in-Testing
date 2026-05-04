import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Calendar, AlertTriangle, Info } from "lucide-react";

type LeaveType = "el" | "sl" | "co" | "default";

interface LeaveBalanceCardProps {
  type?: LeaveType;
  label: string;
  balance: number;
  total: number;
  used: number;
  accrued?: number;
  subtitle?: string;
  expiry?: string;
  carryForwardCap?: number;
  nextAccrualDate?: string;
  nextAccrualDays?: number;
  isNextBonusMonth?: boolean;
  isCurrentBonusMonth?: boolean;
  showCarryForwardWarning?: boolean;
  showLapseWarning?: boolean;
  className?: string;
  "data-testid"?: string;
}

const typeConfig: Record<LeaveType, {
  borderColor: string;
  textColor: string;
  trackColor: string;
  fillColor: string;
  mutedBg: string;
}> = {
  el: {
    borderColor: "border-t-el",
    textColor: "text-el",
    trackColor: "bg-el/10",
    fillColor: "bg-el",
    mutedBg: "bg-el/5 dark:bg-el/10",
  },
  sl: {
    borderColor: "border-t-sl",
    textColor: "text-sl",
    trackColor: "bg-sl/10",
    fillColor: "bg-sl",
    mutedBg: "bg-sl/5 dark:bg-sl/10",
  },
  co: {
    borderColor: "border-t-co",
    textColor: "text-co",
    trackColor: "bg-co/10",
    fillColor: "bg-co",
    mutedBg: "bg-co/5 dark:bg-co/10",
  },
  default: {
    borderColor: "border-t-primary",
    textColor: "text-primary",
    trackColor: "bg-primary/10",
    fillColor: "bg-primary",
    mutedBg: "bg-primary/5 dark:bg-primary/10",
  },
};

export function LeaveBalanceCard({
  type = "default",
  label,
  balance,
  total,
  used,
  accrued,
  subtitle,
  expiry,
  carryForwardCap,
  nextAccrualDate,
  nextAccrualDays,
  isNextBonusMonth,
  isCurrentBonusMonth,
  showCarryForwardWarning,
  showLapseWarning,
  className,
  "data-testid": testId,
}: LeaveBalanceCardProps) {
  const config = typeConfig[type];
  const progressPct = total > 0 ? Math.min(100, (used / total) * 100) : 0;

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-t-[3px] shadow-sm",
        config.borderColor,
        className
      )}
      data-testid={testId}
    >
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{label}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className="text-right shrink-0 ml-3">
            <p
              className={cn("text-2xl font-mono font-bold leading-none", config.textColor)}
              data-testid={testId ? `${testId}-balance` : undefined}
            >
              {balance.toFixed(1)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">available</p>
          </div>
        </div>

        {isCurrentBonusMonth && (
          <div className="mb-3 flex items-center gap-1.5 px-2 py-1.5 bg-purple-50 dark:bg-purple-950/30 rounded-md border border-purple-200 dark:border-purple-800">
            <TrendingUp className="h-3.5 w-3.5 text-purple-600 shrink-0" />
            <p className="text-xs text-purple-700 dark:text-purple-400 font-medium">
              Bonus month — +2 EL credited this month!
            </p>
          </div>
        )}

        {total > 0 && (
          <>
            <div className={cn("h-1.5 rounded-full mb-2 overflow-hidden", config.trackColor)}>
              <div
                className={cn("h-full rounded-full transition-all", config.fillColor)}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span className="font-mono">{used.toFixed(1)} used</span>
              <span className="font-mono">{total.toFixed(1)} total</span>
            </div>
          </>
        )}

        {(accrued !== undefined) && (
          <div className="flex justify-between text-xs mb-2">
            <span className="text-green-600 dark:text-green-400 font-medium">
              +{accrued.toFixed(1)} accrued
            </span>
            <span className="text-red-600 dark:text-red-400 font-medium">
              -{used.toFixed(1)} used
            </span>
          </div>
        )}

        {showCarryForwardWarning && carryForwardCap && (
          <div className="mt-2 flex items-start gap-1.5 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Balance exceeds {carryForwardCap}-day carry-forward cap. Excess will lapse Dec 31.
            </p>
          </div>
        )}

        {showLapseWarning && balance > 0 && (
          <div className="mt-2 flex items-start gap-1.5 p-2 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-200 dark:border-blue-800">
            <Info className="h-3.5 w-3.5 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-400">
              {expiry || "Unused balance lapses on Dec 31 — no carry-forward."}
            </p>
          </div>
        )}

        {nextAccrualDate && (
          <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Next accrual {nextAccrualDate}
            </span>
            {nextAccrualDays !== undefined && (
              <span className={isNextBonusMonth ? "text-purple-600 dark:text-purple-400 font-medium" : ""}>
                +{nextAccrualDays}{isNextBonusMonth ? " (bonus)" : ""}/month
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
