import { RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ExceptionCategory {
  controlType: string;
  open: number;
  overdue: number;
  escalated: number;
  disputed?: number;
}

interface PulseData {
  scopeType: string;
  plansByType: Record<string, { active: number; overdue: number; escalated: number }>;
  overdueCheckIns: number;
  governanceSummary: {
    totalOpen: number;
    totalOverdue: number;
    totalEscalated: number;
    totalDisputed?: number;
    confirmedNonCompliance?: number;
  } | null;
  exceptionCategories: ExceptionCategory[];
}

function chipColor(open: number) {
  if (open === 0) return "bg-muted text-muted-foreground border-border";
  if (open <= 5) return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800";
  return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800";
}

function formatControlType(ct: string) {
  return ct
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface PulseHeaderProps {
  lastRefreshed: Date;
  onRefreshAll: () => void;
  queryRef?: React.MutableRefObject<(() => void) | null>;
  scope?: "org" | "team";
}

export function PulseHeader({ lastRefreshed, onRefreshAll, queryRef, scope = "org" }: PulseHeaderProps) {
  const { data, isLoading, refetch } = useQuery<PulseData>({
    queryKey: ["/api/observation/pulse", scope],
    queryFn: async () => {
      const res = await fetch(`/api/observation/pulse?scope=${scope}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch pulse");
      return res.json();
    },
    staleTime: 60000,
  });

  if (queryRef) queryRef.current = refetch;

  const categories = data?.exceptionCategories ?? [];
  const totalOpen = data?.governanceSummary?.totalOpen ?? 0;

  return (
    <div className="bg-card border border-border rounded-xl p-4" data-testid="pulse-header">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Org Health</h2>
          {data && (
            <span className="text-xs text-muted-foreground">
              ({totalOpen} open {totalOpen === 1 ? "exception" : "exceptions"})
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:block" data-testid="text-last-refreshed">
            Refreshed {lastRefreshed.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefreshAll}
            className="h-7 gap-1.5 text-xs"
            data-testid="button-refresh-all"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh all
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-6 w-28 rounded-full" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            All clear — no governance exceptions
          </span>
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap" data-testid="exception-chips">
          {categories.map((cat) => (
            <span
              key={cat.controlType}
              className={cn(
                "inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border",
                chipColor(cat.open),
              )}
              data-testid={`chip-exception-${cat.controlType}`}
            >
              <span className="font-semibold">{cat.open}</span>
              {formatControlType(cat.controlType)}
              {cat.escalated > 0 && (
                <span className="text-[10px] opacity-75">(↑{cat.escalated})</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
