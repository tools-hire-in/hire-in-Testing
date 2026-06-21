import type { LucideIcon } from "lucide-react";

/**
 * Branded page header for the "new look" (v2) rollout.
 *
 * Renders the navy → orange brand gradient hero used by the Command Center
 * pilot, so HR & Recruitment surfaces share a consistent brand frame while
 * their data-dense bodies (tables, forms, queues) stay in the clean light
 * content treatment. Only rendered when `useNewLook().enabled` is true — the
 * classic header is preserved byte-for-byte when the flag is off.
 */
const NAVY = "#1F3A6E";

interface V2PageHeaderProps {
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  testId?: string;
}

export function V2PageHeader({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  actions,
  testId,
}: V2PageHeaderProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl px-6 py-5 text-white shadow-sm"
      style={{ background: `linear-gradient(120deg, ${NAVY} 0%, #16294d 55%, #F47C20 165%)` }}
      data-testid={testId}
    >
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[11px] font-medium uppercase tracking-widest text-white/70">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold leading-tight">
            {Icon && <Icon className="h-6 w-6 shrink-0 text-white/90" />}
            <span className="truncate">{title}</span>
          </h1>
          {subtitle && <p className="mt-1 text-sm text-white/80">{subtitle}</p>}
        </div>
        {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
      </div>
      {Icon && <Icon className="absolute -right-5 -top-5 h-28 w-28 text-white/10" />}
    </div>
  );
}
