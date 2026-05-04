import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

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
  isCurrentBonusMonth?: boolean;
  showCarryForwardWarning?: boolean;
  className?: string;
  "data-testid"?: string;
}

const typeConfig: Record<LeaveType, {
  borderColor: string;
  textColor: string;
  trackColor: string;
  fillColor: string;
}> = {
  el: {
    borderColor: "border-t-el",
    textColor: "text-el",
    trackColor: "bg-el/10",
    fillColor: "bg-el",
  },
  sl: {
    borderColor: "border-t-sl",
    textColor: "text-sl",
    trackColor: "bg-sl/10",
    fillColor: "bg-sl",
  },
  co: {
    borderColor: "border-t-co",
    textColor: "text-co",
    trackColor: "bg-co/10",
    fillColor: "bg-co",
  },
  default: {
    borderColor: "border-t-primary",
    textColor: "text-primary",
    trackColor: "bg-primary/10",
    fillColor: "bg-primary",
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
  isCurrentBonusMonth,
  showCarryForwardWarning,
  carryForwardCap,
  className,
  "data-testid": testId,
}: LeaveBalanceCardProps) {
  const config = typeConfig[type];
  const progressPct = total > 0 ? Math.min(100, (used / total) * 100) : 0;

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-t-[3px] shadow-sm flex flex-col",
        config.borderColor,
        className
      )}
      data-testid={testId}
    >
      <CardContent className="pt-4 pb-0 flex flex-col flex-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          {label}
        </p>

        <p
          className={cn("text-4xl font-bold leading-none mb-1", config.textColor)}
          data-testid={testId ? `${testId}-balance` : undefined}
        >
          {balance % 1 === 0 ? balance : balance.toFixed(1)}
        </p>

        {subtitle && (
          <p className="text-xs text-muted-foreground mb-2">{subtitle}</p>
        )}

        {expiry && (
          <span className={cn(
            "inline-flex items-center self-start px-2 py-0.5 rounded text-xs font-medium mb-2",
            config.textColor,
            config.trackColor,
          )}>
            Expires: {expiry}
          </span>
        )}

        {isCurrentBonusMonth && (
          <div className="mb-2 flex items-center gap-1.5 px-2 py-1.5 bg-purple-50 dark:bg-purple-950/30 rounded-md border border-purple-200 dark:border-purple-800">
            <TrendingUp className="h-3.5 w-3.5 text-purple-600 shrink-0" />
            <p className="text-xs text-purple-700 dark:text-purple-400 font-medium">
              Bonus month — +2 EL this month!
            </p>
          </div>
        )}

        {showCarryForwardWarning && carryForwardCap && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
            ⚠ Exceeds {carryForwardCap}-day carry-fwd cap
          </p>
        )}

        <div className="flex-1" />

        {accrued !== undefined && (
          <p className="text-xs mb-2">
            <span className="text-green-600 dark:text-green-400 font-medium">+{accrued.toFixed(1)} accrued</span>
            <span className="mx-1.5 text-muted-foreground">·</span>
            <span className="text-red-600 dark:text-red-400 font-medium">−{used.toFixed(1)} used</span>
          </p>
        )}

        {total > 0 && (
          <div className={cn("h-1 rounded-full overflow-hidden -mx-6 mb-0", config.trackColor)}>
            <div
              className={cn("h-full rounded-full transition-all", config.fillColor)}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
