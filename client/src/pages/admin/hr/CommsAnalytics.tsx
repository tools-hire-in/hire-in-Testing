/**
 * Comms Analytics — /admin/hr/my-team/comms
 * Manager/HR/Admin view of daily Zoom call & SMS activity plus AI coaching goals.
 * Roles: manager, hr, admin, super_admin only.
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Phone,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  History,
  ArrowLeft,
  Target,
  AlertCircle,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Clock,
  TrendingUp,
  Info,
  Zap,
  CircleDot,
  Users,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayPST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

function formatTime(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatRelativeTime(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1) {
    const diffM = Math.floor(diffMs / 60000);
    return diffM < 1 ? "just now" : `${diffM}m ago`;
  }
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ── Score badge ───────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground">—</span>;
  const cls =
    score >= 70
      ? "bg-green-100 text-green-700 border-green-200"
      : score >= 40
      ? "bg-amber-100 text-amber-700 border-amber-200"
      : "bg-red-100 text-red-700 border-red-200";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${cls}`}>
      {score}
    </span>
  );
}

// ── Responsiveness progress ring ──────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const offset = circ - (pct / 100) * circ;
  const color = score >= 70 ? "#16a34a" : score >= 40 ? "#d97706" : "#dc2626";
  return (
    <div className="relative w-16 h-16 flex items-center justify-center" data-testid="score-ring">
      <svg className="absolute inset-0 rotate-[-90deg]" viewBox="0 0 64 64" width={64} height={64}>
        <circle cx={32} cy={32} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} />
        <circle
          cx={32}
          cy={32}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="text-sm font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

// ── Urgency badge ─────────────────────────────────────────────────────────────

function UrgencyBadge({ urgency }: { urgency: string }) {
  if (urgency === "high") {
    return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] font-semibold uppercase tracking-wide border">High</Badge>;
  }
  return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] font-semibold uppercase tracking-wide border">Medium</Badge>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeamRow {
  userId: string;
  email: string;
  name: string;
  callCount: number;
  missedCount: number;
  smsThreadCount: number;
  aiDigestExcerpt: string | null;
  date: string;
}

interface TeamDigestContent {
  observation?: string;
  suggestedFocus?: string;
  teamObservations?: string[];
  suggestedTeamFocus?: string;
  topUrgentActions?: string[];
  avgResponsivenessScore?: number | null;
  recruiterCount?: number;
}

interface TeamDigestResponse {
  date: string;
  scope: string;
  digest: {
    id?: string;
    content: TeamDigestContent;
    generatedAt: string | null;
  } | null;
}

interface CallLogEntry {
  id: string;
  direction: string | null;
  duration: number | null;
  outcome: string | null;
  startTime: string | null;
  endTime: string | null;
}

interface SmsSession {
  id: string;
  sessionStart: string | null;
  sessionEnd: string | null;
  messageCount: number | null;
  sanitizedDigest: string | null;
}

interface ActionableGoal {
  goal: string;
  rationale: string;
  urgency: string;
}

interface ColdCandidate {
  label: string;
  daysSinceContact: number;
  funnelStage: string;
  applicationId?: string;
}

interface InsightContent {
  date?: string;
  responsivenessScore?: number;
  coldCandidates?: ColdCandidate[];
  conversationPatterns?: string[];
  actionableGoals?: ActionableGoal[];
}

interface RecruiterInsight {
  id: string;
  content: InsightContent;
  generatedAt: string | null;
}

interface RecruiterDetailResponse {
  recruiter: { userId: string; email: string; name: string };
  date: string;
  callLog: CallLogEntry[];
  smsSessions: SmsSession[];
  insight: RecruiterInsight | null;
}

interface HistoryResponse {
  recruiter: { userId: string; email: string; name: string };
  days: number;
  history: RecruiterInsight[];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CallDirectionIcon({ direction }: { direction: string | null }) {
  const d = (direction ?? "").toLowerCase();
  if (d === "inbound") return <PhoneIncoming className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
  if (d === "outbound") return <PhoneOutgoing className="h-3.5 w-3.5 text-green-500 shrink-0" />;
  return <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
}

function OutcomeBadge({ outcome }: { outcome: string | null }) {
  const o = (outcome ?? "").toLowerCase();
  const isMissed = o.includes("miss");
  const isVoicemail = o.includes("voicemail") || o.includes("vm");
  const isAnswered = o.includes("answer") || o.includes("connect") || (!isMissed && !isVoicemail && o.length > 0);
  if (isMissed) return <span className="text-[10px] font-medium text-red-600">Missed</span>;
  if (isVoicemail) return <span className="text-[10px] font-medium text-amber-600">Voicemail</span>;
  if (isAnswered) return <span className="text-[10px] font-medium text-green-600">Answered</span>;
  return <span className="text-[10px] text-muted-foreground">{outcome ?? "—"}</span>;
}

// ── AI Insight Card ───────────────────────────────────────────────────────────

function AIInsightCard({
  insight,
  email,
  date,
  canRegenerate,
}: {
  insight: RecruiterInsight | null;
  email: string;
  date: string;
  canRegenerate: boolean;
}) {
  const { toast } = useToast();

  const syncMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/comms/sync", { date });
    },
    onSuccess: () => {
      toast({ title: "Sync triggered", description: "AI insights are being regenerated." });
      queryClient.invalidateQueries({ queryKey: ["/api/manager/comms/recruiter"] });
      queryClient.invalidateQueries({ queryKey: ["/api/manager/comms/team"] });
      queryClient.invalidateQueries({ queryKey: ["/api/manager/comms/team-digest"] });
    },
    onError: () => {
      toast({ title: "Sync failed", description: "Could not trigger sync.", variant: "destructive" });
    },
  });

  if (!insight) {
    return (
      <Card className="border-dashed" data-testid="insight-card-empty">
        <CardContent className="py-10 text-center text-muted-foreground space-y-2">
          <Zap className="h-8 w-8 mx-auto opacity-30" />
          <p className="text-sm font-medium">No AI insight for this date</p>
          <p className="text-xs">Run a sync in HR Settings to generate coaching insights.</p>
          {canRegenerate && (
            <Button
              size="sm"
              variant="outline"
              className="mt-2 gap-1.5"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              data-testid="btn-regenerate"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              {syncMutation.isPending ? "Syncing…" : "Regenerate"}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const c = insight.content;
  const score = c.responsivenessScore ?? null;
  const goals = c.actionableGoals ?? [];
  const patterns = c.conversationPatterns ?? [];
  const coldCandidates = c.coldCandidates ?? [];

  return (
    <Card data-testid="insight-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            AI Coaching Insight
          </CardTitle>
          <div className="flex items-center gap-2">
            {insight.generatedAt && (
              <span className="text-[10px] text-muted-foreground">
                Generated {formatRelativeTime(insight.generatedAt)}
              </span>
            )}
            {canRegenerate && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                data-testid="btn-regenerate"
              >
                <RefreshCw className={`h-3 w-3 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                {syncMutation.isPending ? "Syncing…" : "Regenerate"}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Responsiveness Score */}
        {score !== null && score !== undefined && (
          <div className="flex items-center gap-4">
            <ScoreRing score={score} />
            <div>
              <p className="text-sm font-semibold">Responsiveness Score</p>
              <p className="text-xs text-muted-foreground">
                {score >= 70 ? "Strong follow-up cadence" : score >= 40 ? "Moderate — some gaps detected" : "Low — needs immediate coaching attention"}
              </p>
            </div>
          </div>
        )}

        {/* Actionable Goals — most prominent */}
        {goals.length > 0 && (
          <div data-testid="goals-section">
            <p className="text-sm font-semibold flex items-center gap-1.5 mb-3">
              <Target className="h-4 w-4 text-primary" />
              Actionable Coaching Goals
            </p>
            <div className="space-y-3">
              {goals.map((g, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-3 space-y-1.5 ${
                    g.urgency === "high" ? "border-red-200 bg-red-50/50 dark:bg-red-950/20" : "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20"
                  }`}
                  data-testid={`goal-item-${i}`}
                >
                  <div className="flex items-start gap-2">
                    <UrgencyBadge urgency={g.urgency} />
                    <p className="text-sm font-medium leading-snug flex-1">{g.goal}</p>
                  </div>
                  {g.rationale && (
                    <p className="text-xs text-muted-foreground pl-1 border-l-2 border-muted ml-1">{g.rationale}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cold Candidates */}
        {coldCandidates.length > 0 && (
          <div data-testid="cold-candidates-section">
            <p className="text-sm font-semibold flex items-center gap-1.5 mb-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              Cold Candidates
            </p>
            <div className="space-y-1.5">
              {coldCandidates.map((cc, i) => {
                const inner = (
                  <div className="flex items-center justify-between text-xs bg-muted/50 rounded px-3 py-2 w-full" data-testid={`cold-candidate-${i}`}>
                    <div className="flex items-center gap-2">
                      <CircleDot className="h-3 w-3 text-orange-400 shrink-0" />
                      <span className="font-medium">{cc.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>{cc.daysSinceContact}d silent</span>
                      <Badge variant="outline" className="text-[10px] py-0">{cc.funnelStage}</Badge>
                      {cc.applicationId && (
                        <span className="text-[10px] text-primary underline underline-offset-2">View →</span>
                      )}
                    </div>
                  </div>
                );
                return cc.applicationId ? (
                  <a
                    key={i}
                    href={`/admin/recruitment?tab=applications&applicationId=${encodeURIComponent(cc.applicationId)}`}
                    className="flex hover:opacity-80 transition-opacity rounded"
                    data-testid={`cold-candidate-link-${i}`}
                  >
                    {inner}
                  </a>
                ) : (
                  <div key={i}>{inner}</div>
                );
              })}
            </div>
          </div>
        )}

        {/* Conversation Patterns */}
        {patterns.length > 0 && (
          <div data-testid="patterns-section">
            <p className="text-sm font-semibold flex items-center gap-1.5 mb-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Conversation Patterns
            </p>
            <ul className="space-y-1.5">
              {patterns.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground" data-testid={`pattern-${i}`}>
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Recruiter Detail Panel ────────────────────────────────────────────────────

function RecruiterDetailPanel({
  email,
  name,
  date,
  canRegenerate,
  onClose,
}: {
  email: string;
  name: string;
  date: string;
  canRegenerate: boolean;
  onClose: () => void;
}) {
  const [view, setView] = useState<"detail" | "history">("detail");

  const { data: detail, isLoading: detailLoading } = useQuery<RecruiterDetailResponse>({
    queryKey: ["/api/manager/comms/recruiter", email, date],
    queryFn: async () => {
      const res = await fetch(`/api/manager/comms/recruiter?email=${encodeURIComponent(email)}&date=${date}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch recruiter detail");
      return res.json();
    },
    staleTime: 60000,
  });

  const { data: history, isLoading: historyLoading } = useQuery<HistoryResponse>({
    queryKey: ["/api/manager/comms/insights/history", email],
    queryFn: async () => {
      const res = await fetch(`/api/manager/comms/insights/history?email=${encodeURIComponent(email)}&days=30`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    },
    enabled: view === "history",
    staleTime: 120000,
  });

  // Compute max consecutive-day streak for each High-urgency goal in the 30-day history.
  // Only streaks of 3+ consecutive calendar days are stored; shorter ones are omitted.
  const streakMap = useMemo(() => {
    if (!history?.history) return new Map<string, number>();

    // goal text → Set of ISO date strings (YYYY-MM-DD) on which it appeared as High-urgency
    const goalDates = new Map<string, Set<string>>();
    for (const h of history.history) {
      const dateStr = h.content?.date ?? h.generatedAt?.slice(0, 10);
      if (!dateStr) continue;
      for (const g of (h.content?.actionableGoals ?? [])) {
        if (g.urgency === "high" && g.goal) {
          if (!goalDates.has(g.goal)) goalDates.set(g.goal, new Set());
          goalDates.get(g.goal)!.add(dateStr);
        }
      }
    }

    // For each goal, compute the longest run of consecutive calendar days
    const streaks = new Map<string, number>();
    for (const [goal, dates] of goalDates) {
      const sorted = [...dates].sort(); // ascending: oldest first
      if (sorted.length === 0) continue;

      let maxStreak = 1;
      let currentStreak = 1;

      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1] + "T00:00:00");
        const curr = new Date(sorted[i] + "T00:00:00");
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
        if (diffDays === 1) {
          currentStreak++;
          if (currentStreak > maxStreak) maxStreak = currentStreak;
        } else {
          currentStreak = 1;
        }
      }

      if (maxStreak >= 3) streaks.set(goal, maxStreak);
    }

    return streaks;
  }, [history]);

  return (
    <div className="space-y-4" data-testid="recruiter-detail-panel">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="gap-1 h-8 px-2" data-testid="btn-close-detail">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <p className="font-semibold text-sm">{name}</p>
            <p className="text-xs text-muted-foreground">{email}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={view === "detail" ? "default" : "outline"}
            className="h-8 text-xs gap-1.5"
            onClick={() => setView("detail")}
            data-testid="btn-view-detail"
          >
            <Zap className="h-3.5 w-3.5" />
            Today
          </Button>
          <Button
            size="sm"
            variant={view === "history" ? "default" : "outline"}
            className="h-8 text-xs gap-1.5"
            onClick={() => setView("history")}
            data-testid="btn-view-history"
          >
            <History className="h-3.5 w-3.5" />
            History
          </Button>
        </div>
      </div>

      {view === "detail" && (
        <>
          {detailLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : !detail ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Failed to load recruiter data</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* AI Insight Card */}
              <AIInsightCard
                insight={detail.insight}
                email={email}
                date={date}
                canRegenerate={canRegenerate}
              />

              {/* Call Log */}
              <Card data-testid="call-log-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Phone className="h-4 w-4 text-blue-500" />
                    Call Log
                    <Badge variant="outline" className="text-xs">{detail.callLog.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {detail.callLog.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No calls on this date</p>
                  ) : (
                    <div className="border rounded-md overflow-hidden">
                      <table className="w-full text-xs" data-testid="call-log-table">
                        <thead>
                          <tr className="bg-muted/50 border-b">
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground w-8"></th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Time</th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Duration</th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Outcome</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {detail.callLog.map((call) => (
                            <tr key={call.id} className="hover:bg-muted/20" data-testid={`call-row-${call.id}`}>
                              <td className="px-3 py-2">
                                <CallDirectionIcon direction={call.direction} />
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{formatTime(call.startTime)}</td>
                              <td className="px-3 py-2 font-mono">{formatDuration(call.duration)}</td>
                              <td className="px-3 py-2">
                                <OutcomeBadge outcome={call.outcome} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* SMS Threads */}
              <Card data-testid="sms-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-purple-500" />
                    SMS Threads
                    <Badge variant="outline" className="text-xs">{detail.smsSessions.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {detail.smsSessions.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No SMS threads on this date</p>
                  ) : (
                    <div className="space-y-2">
                      {detail.smsSessions.map((sms) => (
                        <div key={sms.id} className="rounded-md border p-3 space-y-1" data-testid={`sms-thread-${sms.id}`}>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTime(sms.sessionStart)}
                              {sms.sessionEnd && sms.sessionEnd !== sms.sessionStart && ` – ${formatTime(sms.sessionEnd)}`}
                            </span>
                            {sms.messageCount !== null && (
                              <span>{sms.messageCount} msg{sms.messageCount !== 1 ? "s" : ""}</span>
                            )}
                          </div>
                          {sms.sanitizedDigest ? (
                            <p className="text-xs text-foreground/80 leading-relaxed">{sms.sanitizedDigest}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">No digest available</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {view === "history" && (
        <div className="space-y-3" data-testid="history-panel">
          {historyLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
            </div>
          ) : !history || history.history.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No history in the last 30 days</p>
              <p className="text-xs mt-1">AI insights will appear here once syncs have run.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Last 30 days · {history.history.length} insight{history.history.length !== 1 ? "s" : ""}
              </p>
              {history.history.map((h) => {
                const c = h.content;
                const goals = c?.actionableGoals ?? [];
                const dateLabel = c?.date ? formatDate(c.date) : formatRelativeTime(h.generatedAt);
                const highGoals = goals.filter((g) => g.urgency === "high");
                return (
                  <Collapsible key={h.id} data-testid={`history-card-${h.id}`}>
                    <CollapsibleTrigger asChild>
                      <div className="border rounded-lg p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <History className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium">{dateLabel}</span>
                            {c?.responsivenessScore !== undefined && c.responsivenessScore !== null && (
                              <ScoreBadge score={c.responsivenessScore} />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {goals.length > 0 && (
                              <Badge variant="outline" className="text-[10px]">{goals.length} goal{goals.length !== 1 ? "s" : ""}</Badge>
                            )}
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        </div>
                        {/* Streak badges */}
                        {highGoals.map((g, i) => {
                          const streak = streakMap.get(g.goal) ?? 0;
                          if (streak < 3) return null;
                          return (
                            <div key={i} className="mt-2 flex items-center gap-1.5 rounded bg-red-50 border border-red-200 px-2 py-1" data-testid={`streak-badge-${i}`}>
                              <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />
                              <span className="text-[10px] text-red-700 font-medium">
                                Appeared {streak} day{streak !== 1 ? "s" : ""} in a row — unresolved coaching need
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-1 border rounded-lg border-t-0 rounded-t-none p-3 bg-muted/20 space-y-3">
                        {goals.length > 0 && (
                          <div className="space-y-2">
                            {goals.map((g, i) => (
                              <div
                                key={i}
                                className={`rounded border p-2.5 space-y-1 ${
                                  g.urgency === "high" ? "border-red-200 bg-red-50/50" : "border-amber-200 bg-amber-50/50"
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  <UrgencyBadge urgency={g.urgency} />
                                  <p className="text-xs font-medium leading-snug flex-1">{g.goal}</p>
                                </div>
                                {g.rationale && (
                                  <p className="text-[10px] text-muted-foreground pl-1">{g.rationale}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {(c?.conversationPatterns ?? []).length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Patterns</p>
                            <ul className="space-y-1">
                              {(c?.conversationPatterns ?? []).map((p, i) => (
                                <li key={i} className="text-[10px] text-muted-foreground flex items-start gap-1">
                                  <span className="mt-1 h-1 w-1 rounded-full bg-muted-foreground shrink-0" />
                                  {p}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Team Summary Card ─────────────────────────────────────────────────────────

function TeamDigestCard({ date }: { date: string }) {
  const { data, isLoading } = useQuery<TeamDigestResponse>({
    queryKey: ["/api/manager/comms/team-digest", date],
    queryFn: async () => {
      const res = await fetch(`/api/manager/comms/team-digest?date=${date}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch team digest");
      return res.json();
    },
    staleTime: 60000,
  });

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (!data?.digest) {
    return (
      <Card className="border-dashed" data-testid="team-digest-empty">
        <CardContent className="py-5 text-center text-muted-foreground">
          <p className="text-sm">No team AI digest for this date</p>
        </CardContent>
      </Card>
    );
  }

  const c = data.digest.content;
  const observation = c.observation ?? (c.teamObservations ?? []).join(" ");
  const focus = c.suggestedFocus ?? c.suggestedTeamFocus;

  return (
    <Card className="border-blue-200 bg-blue-50/30 dark:bg-blue-950/20" data-testid="team-digest-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Info className="h-4 w-4 text-blue-500" />
          Team AI Digest
          {c.recruiterCount !== undefined && (
            <span className="text-[10px] text-muted-foreground font-normal">({c.recruiterCount} recruiters)</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {observation && (
          <p className="text-sm text-foreground/80 leading-relaxed">{observation}</p>
        )}
        {focus && (
          <div className="flex items-start gap-2 rounded bg-blue-100/70 dark:bg-blue-900/30 border border-blue-200 px-3 py-2">
            <Target className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide mb-0.5">Suggested Team Focus</p>
              <p className="text-xs text-foreground/80">{focus}</p>
            </div>
          </div>
        )}
        {c.avgResponsivenessScore !== null && c.avgResponsivenessScore !== undefined && (
          <p className="text-[10px] text-muted-foreground">
            Avg responsiveness: <ScoreBadge score={c.avgResponsivenessScore} />
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CommsAnalytics() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(todayPST);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [expandedName, setExpandedName] = useState<string>("");

  const canRegenerate = user?.role === "super_admin" || user?.role === "admin" || user?.role === "hr";

  const { data: teamRows, isLoading: teamLoading } = useQuery<TeamRow[]>({
    queryKey: ["/api/manager/comms/team", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/manager/comms/team?date=${selectedDate}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch team comms");
      return res.json();
    },
    staleTime: 60000,
  });

  const rows = teamRows ?? [];
  const totalCalls = rows.reduce((s, r) => s + r.callCount, 0);
  const totalMissed = rows.reduce((s, r) => s + r.missedCount, 0);
  const totalSms = rows.reduce((s, r) => s + r.smsThreadCount, 0);
  const missedRate = totalCalls > 0 ? Math.round((totalMissed / totalCalls) * 100) : null;

  function handleExpand(email: string, name: string) {
    if (expandedEmail === email) {
      setExpandedEmail(null);
    } else {
      setExpandedEmail(email);
      setExpandedName(name);
    }
  }

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6 p-4 md:p-6 max-w-5xl mx-auto">
        <V2PageHeader
          title="Comms Analytics"
          subtitle="Team communication activity and AI coaching goals"
          icon={Phone}
        />

        {/* Date picker */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium shrink-0">Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setExpandedEmail(null);
            }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="date-picker"
            max={todayPST()}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-9 text-xs"
            onClick={() => { setSelectedDate(todayPST()); setExpandedEmail(null); }}
            data-testid="btn-today"
          >
            Today
          </Button>
        </div>

        {/* If a recruiter is expanded, show detail view */}
        {expandedEmail ? (
          <RecruiterDetailPanel
            email={expandedEmail}
            name={expandedName}
            date={selectedDate}
            canRegenerate={canRegenerate}
            onClose={() => setExpandedEmail(null)}
          />
        ) : (
          <>
            {/* Team summary stats */}
            {teamLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" data-testid="team-summary-stats">
                <Card className="shadow-none">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Phone className="h-8 w-8 text-blue-500 opacity-70 shrink-0" />
                    <div>
                      <p className="text-2xl font-bold font-mono">{totalCalls}</p>
                      <p className="text-xs text-muted-foreground">Total Calls</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-none">
                  <CardContent className="p-4 flex items-center gap-3">
                    <PhoneMissed className="h-8 w-8 text-red-400 opacity-70 shrink-0" />
                    <div>
                      <p className="text-2xl font-bold font-mono">
                        {missedRate !== null ? `${missedRate}%` : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">Missed Call Rate</p>
                      <p className="text-[10px] text-muted-foreground/60">{totalMissed} missed</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-none col-span-2 sm:col-span-1">
                  <CardContent className="p-4 flex items-center gap-3">
                    <MessageSquare className="h-8 w-8 text-purple-500 opacity-70 shrink-0" />
                    <div>
                      <p className="text-2xl font-bold font-mono">{totalSms}</p>
                      <p className="text-xs text-muted-foreground">SMS Threads</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Team AI Digest */}
            <TeamDigestCard date={selectedDate} />

            {/* Per-recruiter table */}
            <div data-testid="recruiter-table">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Recruiter Activity
                {!teamLoading && rows.length > 0 && (
                  <Badge variant="outline" className="text-xs font-normal">{rows.length} active</Badge>
                )}
              </h2>

              {teamLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : rows.length === 0 ? (
                <Card className="border-dashed" data-testid="empty-state">
                  <CardContent className="py-12 text-center text-muted-foreground space-y-2">
                    <Phone className="h-10 w-10 mx-auto opacity-20" />
                    <p className="text-sm font-medium">No sync data for this date</p>
                    <p className="text-xs">
                      {canRegenerate
                        ? "Run a sync from HR Settings → Integrations to populate activity data."
                        : "No communication activity has been synced for this date yet."}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="border rounded-lg overflow-hidden" data-testid="recruiter-rows">
                  {rows.map((row, idx) => {
                    const missedPct = row.callCount > 0 ? Math.round((row.missedCount / row.callCount) * 100) : null;
                    const responsiveness = missedPct !== null ? Math.max(0, 100 - missedPct) : null;
                    const isExpanded = expandedEmail === row.email;
                    return (
                      <div key={row.userId} data-testid={`recruiter-row-${row.userId}`}>
                        {idx > 0 && <Separator />}
                        <div className="p-4 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{row.name}</span>
                              <ScoreBadge score={responsiveness} />
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {row.callCount} calls
                                {row.missedCount > 0 && (
                                  <span className="text-red-500 ml-1">({row.missedCount} missed)</span>
                                )}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {row.smsThreadCount} SMS
                              </span>
                            </div>
                            {row.aiDigestExcerpt && (
                              <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1 italic">
                                AI: {row.aiDigestExcerpt}
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1 shrink-0"
                            onClick={() => handleExpand(row.email, row.name)}
                            data-testid={`btn-expand-${row.userId}`}
                          >
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            {isExpanded ? "Collapse" : "Details"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
