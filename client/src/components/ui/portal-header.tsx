import type * as React from "react";
import { cn } from "@/lib/utils";

interface PortalHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  "data-testid"?: string;
}

export function PortalHeader({
  label,
  title,
  subtitle,
  action,
  className,
  "data-testid": testId,
  ...props
}: PortalHeaderProps) {
  return (
    <div
      {...props}
      data-testid={testId ?? "portal-header"}
      className={cn("rounded-lg px-6 py-5 text-white", className)}
      style={{ background: "var(--portal-gradient)" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {label && (
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">
              {label}
            </p>
          )}
          <h1 className="text-xl font-semibold text-white leading-tight" data-testid="portal-header-title">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-white/70 mt-0.5" data-testid="portal-header-subtitle">
              {subtitle}
            </p>
          )}
        </div>
        {action && (
          <div className="shrink-0" data-testid="portal-header-action">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
