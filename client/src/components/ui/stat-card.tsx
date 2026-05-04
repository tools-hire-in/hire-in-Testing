import * as React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string | number;
  subvalue?: string;
  trend?: { value: number; label?: string };
  icon?: React.ReactNode;
  accentColour?: string;
  className?: string;
  "data-testid"?: string;
}

export function StatCard({
  label,
  value,
  subvalue,
  trend,
  icon,
  accentColour = "text-primary",
  className,
  "data-testid": testId,
}: StatCardProps) {
  const isPositiveTrend = trend && trend.value > 0;
  const isNegativeTrend = trend && trend.value < 0;

  return (
    <Card className={cn("shadow-sm", className)} data-testid={testId}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              {label}
            </p>
            <p className={cn("text-2xl font-mono font-semibold text-foreground leading-none", accentColour)}>
              {value}
            </p>
            {subvalue && (
              <p className="text-xs font-medium text-muted-foreground mt-1">{subvalue}</p>
            )}
            {trend && (
              <div
                className={cn(
                  "inline-flex items-center gap-1 mt-2 text-xs font-medium",
                  isPositiveTrend && "text-green-600 dark:text-green-400",
                  isNegativeTrend && "text-red-600 dark:text-red-400",
                  !isPositiveTrend && !isNegativeTrend && "text-muted-foreground"
                )}
                data-testid={testId ? `${testId}-trend` : undefined}
              >
                {isPositiveTrend && <TrendingUp className="h-3 w-3" />}
                {isNegativeTrend && <TrendingDown className="h-3 w-3" />}
                <span>
                  {trend.value > 0 ? "+" : ""}{trend.value}
                  {trend.label ? ` ${trend.label}` : ""}
                </span>
              </div>
            )}
          </div>
          {icon && (
            <div className={cn("shrink-0 mt-0.5", accentColour)}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
