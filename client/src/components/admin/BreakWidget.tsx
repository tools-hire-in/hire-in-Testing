import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Coffee, UtensilsCrossed, Timer, Info, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface BreakStatus {
  breaks: BreakRecord[];
  totalMinutes: number;
  lunchMinutes: number;
  teaMinutes: number;
  activeBreak: BreakRecord | null;
  entitlement: { lunch: number; tea: number; teaCount: number; total: number };
  lunchCount: number;
  teaCount: number;
}

interface BreakRecord {
  id: string;
  breakType: "lunch" | "tea";
  startedAt: string;
  endedAt: string | null;
  durationMinutes: string | null;
}

function formatDuration(startedAt: string): string {
  const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatMinutes(minutes: number): string {
  if (minutes < 1) return "0 min";
  return `${Math.round(minutes)} min`;
}

export function BreakWidget({ punchedIn }: { punchedIn: boolean }) {
  const { toast } = useToast();
  const [breakType, setBreakType] = useState<"lunch" | "tea">("lunch");
  const [elapsed, setElapsed] = useState("0:00");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: breakStatus, isLoading } = useQuery<BreakStatus>({
    queryKey: ["/api/hr/attendance/breaks/today"],
    enabled: punchedIn,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (breakStatus?.activeBreak?.startedAt) {
      setElapsed(formatDuration(breakStatus.activeBreak.startedAt));
      intervalRef.current = setInterval(() => {
        setElapsed(formatDuration(breakStatus.activeBreak!.startedAt));
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setElapsed("0:00");
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [breakStatus?.activeBreak?.id]);

  const startMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hr/attendance/breaks/start", { breakType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance/breaks/today"] });
      toast({ title: "Break started", description: `Your ${breakType} break has started.` });
    },
    onError: (err: any) => {
      toast({ title: "Can't start break", description: err.message || "Something went wrong", variant: "destructive" });
    },
  });

  const endMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hr/attendance/breaks/end"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance/breaks/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/dashboard-stats"] });
      if (data?.exceeded) {
        toast({
          title: "Break ended — slightly over",
          description: `You took ${data.durationMinutes} min (policy: ${data.allocated} min). Noted in your record.`,
          variant: "default",
        });
      } else {
        toast({ title: "Break ended", description: "Welcome back!" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Error ending break", description: err.message || "Something went wrong", variant: "destructive" });
    },
  });

  if (!punchedIn) return null;

  const active = breakStatus?.activeBreak;
  const lunchCount = breakStatus?.lunchCount ?? 0;
  const teaCount = breakStatus?.teaCount ?? 0;
  const lunchDone = lunchCount >= 1;
  const teaDone = teaCount >= 2;
  const allDone = lunchDone && teaDone;
  const canLunch = !lunchDone && !active;
  const canTea = teaCount < 2 && !active;

  // Elapsed minutes for current break to show warning
  const elapsedMs = active ? Date.now() - new Date(active.startedAt).getTime() : 0;
  const elapsedMin = elapsedMs / 60000;
  const allocated = active?.breakType === "lunch" ? 30 : 15;
  const isNearLimit = active && elapsedMin > allocated * 0.8;
  const isOverLimit = active && elapsedMin > allocated;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Breaks</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground transition-colors" data-testid="button-break-policy-info">
              <Info className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-56 text-xs" side="left">
            <p className="font-semibold mb-1">Break Policy</p>
            <ul className="space-y-0.5 list-disc list-inside text-muted-foreground">
              <li>Lunch: 1× up to 30 min</li>
              <li>Tea: 2× up to 15 min each</li>
              <li>Total: up to 60 min/day</li>
            </ul>
            <p className="mt-1 text-muted-foreground">Going over is noted — not blocked.</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Usage summary */}
      <div className="flex gap-2 flex-wrap">
        <Badge
          variant={lunchDone ? "default" : "outline"}
          className="text-xs gap-1"
          data-testid="badge-lunch-status"
        >
          <UtensilsCrossed className="h-3 w-3" />
          Lunch {lunchDone ? `${formatMinutes(breakStatus?.lunchMinutes ?? 0)}` : "not taken"}
        </Badge>
        <Badge
          variant={teaCount > 0 ? "default" : "outline"}
          className="text-xs gap-1"
          data-testid="badge-tea-status"
        >
          <Coffee className="h-3 w-3" />
          Tea {teaCount}/2 {teaCount > 0 ? `· ${formatMinutes(breakStatus?.teaMinutes ?? 0)}` : ""}
        </Badge>
      </div>

      {/* Active break timer */}
      {active && (
        <div
          className={`flex items-center justify-between rounded-lg px-3 py-2 border ${isOverLimit ? "bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-800" : isNearLimit ? "bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-800" : "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"}`}
          data-testid="panel-active-break"
        >
          <div className="flex items-center gap-2">
            {active.breakType === "lunch" ? <UtensilsCrossed className="h-4 w-4 text-blue-600" /> : <Coffee className="h-4 w-4 text-blue-600" />}
            <div>
              <p className="text-xs font-semibold capitalize">{active.breakType} Break</p>
              <div className="flex items-center gap-1">
                <Timer className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-mono text-muted-foreground" data-testid="text-break-timer">{elapsed}</span>
                {isOverLimit && <AlertTriangle className="h-3 w-3 text-red-500" />}
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant={isOverLimit ? "destructive" : "default"}
            onClick={() => endMutation.mutate()}
            disabled={endMutation.isPending}
            className="text-xs h-7 px-2"
            data-testid="button-end-break"
          >
            {endMutation.isPending ? "Ending..." : "End Break"}
          </Button>
        </div>
      )}

      {/* Start break controls */}
      {!active && !allDone && (
        <div className="flex items-center gap-2">
          <Select
            value={breakType}
            onValueChange={(v) => setBreakType(v as "lunch" | "tea")}
          >
            <SelectTrigger className="h-8 text-xs flex-1" data-testid="select-break-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lunch" disabled={lunchDone} data-testid="select-item-lunch">
                <span className="flex items-center gap-1.5">
                  <UtensilsCrossed className="h-3.5 w-3.5" />
                  Lunch {lunchDone ? "(used)" : "(30 min)"}
                </span>
              </SelectItem>
              <SelectItem value="tea" disabled={teaDone} data-testid="select-item-tea">
                <span className="flex items-center gap-1.5">
                  <Coffee className="h-3.5 w-3.5" />
                  Tea {teaDone ? "(used)" : `(${teaCount}/2 · 15 min)`}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending || (!canLunch && breakType === "lunch") || (!canTea && breakType === "tea")}
            className="h-8 text-xs whitespace-nowrap"
            data-testid="button-start-break"
          >
            {startMutation.isPending ? "Starting..." : "Start"}
          </Button>
        </div>
      )}

      {allDone && !active && (
        <p className="text-xs text-muted-foreground" data-testid="text-breaks-complete">
          All breaks taken today. Total: {formatMinutes(breakStatus?.totalMinutes ?? 0)}
        </p>
      )}
    </div>
  );
}
