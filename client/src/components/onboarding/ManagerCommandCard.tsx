import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Printer,
  Shield,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

interface CommandCardData {
  probationCadence: {
    title: string;
    description: string;
    days: number[];
    formalMilestoneDays: number[];
    note: string;
  };
  pipRule: {
    title: string;
    description: string;
  };
  threeStrikeEscalation: {
    title: string;
    description: string;
    trigger: string;
    consequence: string;
  };
  correctionWindow: {
    title: string;
    description: string;
    windowDays: number;
    beyondWindow: string;
  };
  leaveLwpWarning: {
    title: string;
    description: string;
    checkBefore: string;
    undoPath: string;
  };
  planOutcomes: {
    title: string;
    description: string;
    options: Array<{ value: string; label: string; description: string }>;
  };
  sopEnforcementLevels: {
    title: string;
    description: string;
    levels: Array<{ value: string; label: string; description: string }>;
  };
  trainingComplianceLock: {
    title: string;
    description: string;
    conditions: string[];
    resolution: string;
    managerNote: string;
  };
}

interface ManagerCommandCardProps {
  compact?: boolean;
}

export function ManagerCommandCard({ compact = false }: ManagerCommandCardProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError } = useQuery<CommandCardData>({
    queryKey: ["/api/onboarding/command-card"],
    staleTime: 5 * 60 * 1000,
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground" data-testid="command-card-loading">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading command card…</span>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center py-12 text-destructive" data-testid="command-card-error">
        <span className="text-sm">Failed to load command card. Please refresh.</span>
      </div>
    );
  }

  return (
    <div data-testid="manager-command-card">
      {/* Print button — hidden in print */}
      {!compact && (
        <div className="flex items-center justify-between mb-4 print:hidden">
          <div>
            <h2 className="text-xl font-bold">Manager Check-in Reference Card</h2>
            <p className="text-sm text-muted-foreground">
              Quick reference for probation cadence, escalation rules, and team management essentials.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2" data-testid="button-print-command-card">
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      )}

      {/* Card content */}
      <div
        ref={printRef}
        className={`grid gap-4 ${compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"} print:grid-cols-2 print:gap-3`}
        data-testid="command-card-content"
      >
        {/* Probation Cadence */}
        <div className="rounded-lg border bg-card p-4 space-y-3" data-testid="card-probation-cadence">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary shrink-0" />
            <h3 className="font-semibold text-sm">{data.probationCadence.title}</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{data.probationCadence.description}</p>
          <div className="flex flex-wrap gap-1.5">
            {data.probationCadence.days.map((day) => {
              const isFormal = data.probationCadence.formalMilestoneDays.includes(day);
              return (
                <span
                  key={day}
                  className={`inline-flex items-center justify-center text-[10px] font-bold rounded px-2 py-0.5 ${
                    isFormal
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                  title={isFormal ? "Formal milestone review" : "Standard check-in"}
                  data-testid={`probation-day-${day}`}
                >
                  Day {day}
                  {isFormal && " ★"}
                </span>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground italic">{data.probationCadence.note}</p>
        </div>

        {/* 3-Strike Escalation */}
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3" data-testid="card-three-strike">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <h3 className="font-semibold text-sm">{data.threeStrikeEscalation.title}</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{data.threeStrikeEscalation.description}</p>
          <div className="space-y-1">
            <div className="flex items-start gap-2 text-xs">
              <span className="font-medium text-destructive shrink-0">Trigger:</span>
              <span>{data.threeStrikeEscalation.trigger}</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <span className="font-medium text-destructive shrink-0">Result:</span>
              <span>{data.threeStrikeEscalation.consequence}</span>
            </div>
          </div>
        </div>

        {/* PIP Rule */}
        <div className="rounded-lg border bg-card p-4 space-y-2" data-testid="card-pip-rule">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-amber-600 shrink-0" />
            <h3 className="font-semibold text-sm">{data.pipRule.title}</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{data.pipRule.description}</p>
        </div>

        {/* Attendance Correction Window */}
        <div className="rounded-lg border bg-card p-4 space-y-3" data-testid="card-correction-window">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600 shrink-0" />
            <h3 className="font-semibold text-sm">{data.correctionWindow.title}</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{data.correctionWindow.description}</p>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              {data.correctionWindow.windowDays}-day window
            </Badge>
            <span className="text-[11px] text-muted-foreground">→ {data.correctionWindow.beyondWindow}</span>
          </div>
        </div>

        {/* Leave LWP Warning */}
        <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-3" data-testid="card-lwp-warning">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <h3 className="font-semibold text-sm">{data.leaveLwpWarning.title}</h3>
          </div>
          <p className="text-xs leading-relaxed">{data.leaveLwpWarning.description}</p>
          <div className="space-y-1 text-xs">
            <div className="flex items-start gap-2">
              <span className="font-medium text-amber-700 dark:text-amber-400 shrink-0">Before:</span>
              <span className="text-muted-foreground">{data.leaveLwpWarning.checkBefore}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-medium text-amber-700 dark:text-amber-400 shrink-0">If wrong:</span>
              <span className="text-muted-foreground">{data.leaveLwpWarning.undoPath}</span>
            </div>
          </div>
        </div>

        {/* Plan Outcomes */}
        <div className="rounded-lg border bg-card p-4 space-y-3" data-testid="card-plan-outcomes">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-green-600 shrink-0" />
            <h3 className="font-semibold text-sm">{data.planOutcomes.title}</h3>
          </div>
          <p className="text-xs text-muted-foreground">{data.planOutcomes.description}</p>
          <div className="flex flex-wrap gap-1.5">
            {data.planOutcomes.options.map((opt) => {
              const colorMap: Record<string, string> = {
                passed: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700",
                extended: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700",
                failed: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700",
                converted: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-700",
                terminated: "bg-zinc-100 dark:bg-zinc-900/30 text-zinc-800 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700",
              };
              return (
                <span
                  key={opt.value}
                  className={`inline-flex text-[10px] font-semibold border rounded px-2 py-0.5 ${colorMap[opt.value] ?? ""}`}
                  title={opt.description}
                  data-testid={`outcome-${opt.value}`}
                >
                  {opt.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* SOP Enforcement Levels */}
        <div className="rounded-lg border bg-card p-4 space-y-3" data-testid="card-sop-enforcement">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-indigo-600 shrink-0" />
            <h3 className="font-semibold text-sm">{data.sopEnforcementLevels.title}</h3>
          </div>
          <p className="text-xs text-muted-foreground">{data.sopEnforcementLevels.description}</p>
          <div className="space-y-1.5">
            {data.sopEnforcementLevels.levels.map((level) => {
              const labelColors: Record<string, string> = {
                soft: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
                measured: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300",
                full: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
              };
              return (
                <div key={level.value} className="flex items-start gap-2" data-testid={`sop-level-${level.value}`}>
                  <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 shrink-0 mt-0.5 ${labelColors[level.value] ?? ""}`}>
                    {level.label.toUpperCase()}
                  </span>
                  <span className="text-xs text-muted-foreground leading-relaxed">{level.description}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Training Compliance Lock */}
        <div className="rounded-lg border bg-card p-4 space-y-3" data-testid="card-compliance-lock">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-orange-500 shrink-0" />
            <h3 className="font-semibold text-sm">{data.trainingComplianceLock.title}</h3>
          </div>
          <p className="text-xs text-muted-foreground">{data.trainingComplianceLock.description}</p>
          <ul className="space-y-1">
            {data.trainingComplianceLock.conditions.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <CheckCircle2 className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
          <div className="text-xs space-y-1">
            <div className="flex items-start gap-2">
              <span className="font-medium text-primary shrink-0">Resolution:</span>
              <span className="text-muted-foreground">{data.trainingComplianceLock.resolution}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-medium text-primary shrink-0">Note:</span>
              <span className="text-muted-foreground">{data.trainingComplianceLock.managerNote}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .print\\:gap-3 { gap: 0.75rem; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          [data-testid="manager-command-card"] {
            padding: 1rem;
            font-size: 11px;
          }
        }
      `}</style>
    </div>
  );
}
