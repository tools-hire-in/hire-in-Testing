import { useState } from "react";
import { Link } from "wouter";
import { X, Lightbulb, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

/**
 * Studio CMO Playbook (Task #914) — Layer 2: contextual tips.
 * Inline dismissible callout (never a modal). Each tip fires once per user;
 * dismissed state is remembered in localStorage keyed `studioTip_${userId}_${id}`.
 */
export function StudioTip({
  id,
  title,
  body,
  action,
  variant = "info",
  className = "",
}: {
  id: string;
  title: string;
  body: string;
  action?: { label: string; href: string };
  variant?: "info" | "warning";
  className?: string;
}) {
  const { user } = useAuth();
  const storageKey = `studioTip_${user?.id ?? "anon"}_${id}`;

  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
  };

  const isWarning = variant === "warning";

  return (
    <div
      className={`relative flex items-start gap-3 rounded-md border p-3 text-sm ${
        isWarning
          ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30"
          : "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30"
      } ${className}`}
      data-testid={`tip-${id}`}
    >
      {isWarning ? (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      ) : (
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
      )}
      <div className="min-w-0 flex-1 pr-6">
        <p className={`font-medium ${isWarning ? "text-amber-900 dark:text-amber-200" : "text-blue-900 dark:text-blue-200"}`}>
          {title}
        </p>
        <p className={`mt-0.5 ${isWarning ? "text-amber-800 dark:text-amber-300" : "text-blue-800 dark:text-blue-300"}`}>
          {body}
        </p>
        {action && (
          <Link href={action.href}>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 h-7 bg-background text-xs"
              data-testid={`tip-action-${id}`}
            >
              {action.label}
            </Button>
          </Link>
        )}
      </div>
      <button
        onClick={dismiss}
        className={`absolute right-2 top-2 rounded p-0.5 opacity-60 hover:opacity-100 ${
          isWarning ? "text-amber-700 dark:text-amber-300" : "text-blue-700 dark:text-blue-300"
        }`}
        aria-label="Dismiss tip"
        data-testid={`tip-dismiss-${id}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
