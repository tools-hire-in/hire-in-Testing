import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, X } from "lucide-react";

/**
 * Friendly AI failure surface (Task #906 defect fix #1/#2): AI errors are
 * never silent and never raw. Shows a plain-language message with a retry
 * and a "continue manually" escape hatch.
 */
export function AIErrorBanner({
  message,
  onRetry,
  onDismiss,
  retrying,
}: {
  message: string;
  onRetry?: () => void;
  onDismiss: () => void;
  retrying?: boolean;
}) {
  return (
    <div
      className="flex flex-wrap items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950/30"
      role="alert"
      data-testid="banner-ai-error"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-amber-900 dark:text-amber-200">AI generation didn't work</p>
        <p className="mt-0.5 text-amber-800 dark:text-amber-300" data-testid="text-ai-error-message">
          {message}
        </p>
        <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
          You can retry, or keep writing manually — nothing was changed.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry} disabled={retrying} data-testid="button-ai-error-retry">
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
            Retry
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onDismiss} data-testid="button-ai-error-dismiss">
          <X className="mr-1.5 h-3.5 w-3.5" />
          Continue manually
        </Button>
      </div>
    </div>
  );
}
