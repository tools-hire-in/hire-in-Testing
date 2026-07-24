import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Phone, MessageSquare, TrendingUp, RefreshCw, ChevronRight, AlertTriangle, Target, Clock, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ALLOWED_ROLES = ["super_admin", "admin", "hr", "manager"];

interface TeamRow {
  email: string;
  totalCalls: number;
  missedCalls: number;
  totalMinutes: number;
  smsThreads: number;
}

interface TeamOverview {
  date: string;
  rows: TeamRow[];
  teamDigest: string | null;
}

interface RecruiterDetail {
  date: string;
  email: string;
  callStats: {
    total: number;
    outbound: number;
    inbound: number;
    missed: number;
    answered: number;
    totalMinutes: number;
  };
  smsDigests: Array<{
    sessionId: string;
    sanitizedDigest: string;
    messageCount: number;
    sanitizedAt: string;
  }>;
  aiInsight: {
    content: {
      responsivenessScore: number;
      coldCandidates: Array<{ label: string; daysSinceContact: number; stage: string }>;
      conversationPatterns: string[];
      actionableGoals: Array<{ goal: string; rationale: string; urgency: "high" | "medium" }>;
    };
    generatedAt: string;
  } | null;
}

interface SyncStatus {
  status: string;
  last_synced_at: string | null;
  last_synced_date: string | null;
  synced_user_count: number | null;
  error_message: string | null;
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "text-green-600" : score >= 60 ? "text-amber-500" : "text-red-500";
  return (
    <div className={cn("flex flex-col items-center", color)}>
      <span className="text-3xl font-bold" data-testid="text-responsiveness-score">{score}</span>
      <span className="text-xs text-muted-foreground font-normal">responsiveness</span>
    </div>
  );
}

export default function CommsAnalytics() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [date, setDate] = useState(todayStr());
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);

  const canAccess = ALLOWED_ROLES.includes(user?.role ?? "");

  const { data: teamData, isLoading: teamLoading } = useQuery<TeamOverview>({
    queryKey: ["/api/manager/comms/team", date],
    queryFn: async () => {
      const res = await fetch(`/api/manager/comms/team?date=${date}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch team overview");
      return res.json();
    },
    enabled: canAccess,
  });

  const { data: recruiterData, isLoading: recruiterLoading } = useQuery<RecruiterDetail>({
    queryKey: ["/api/manager/comms/recruiter", date, selectedEmail],
    queryFn: async () => {
      const res = await fetch(`/api/manager/comms/recruiter?date=${date}&email=${encodeURIComponent(selectedEmail!)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch recruiter detail");
      return res.json();
    },
    enabled: canAccess && !!selectedEmail,
  });

  const { data: syncStatus } = useQuery<SyncStatus>({
    queryKey: ["/api/admin/comms/sync/status"],
    enabled: canAccess && ["super_admin", "admin", "hr"].includes(user?.role ?? ""),
    refetchInterval: 30_000,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/comms/sync", { date });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sync started", description: "Zoom data sync is running in the background." });
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["/api/admin/comms/sync/status"] }), 5000);
    },
    onError: (err: any) => {
      toast({ title: "Sync failed", description: err.message ?? "Could not start sync", variant: "destructive" });
    },
  });

  if (!canAccess) {
    return (
      <AdminLayout>
        <div className="p-8 text-center text-muted-foreground">You do not have access to this page.</div>
      </AdminLayout>
    );
  }

  const isAdmin = ["super_admin", "admin", "hr"].includes(user?.role ?? "");

  return (
    <AdminLayout>
      <div className="px-6 py-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Comms Analytics</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Zoom call &amp; SMS activity with AI coaching insights — privacy-safe, anonymised
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="date"
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={date}
              max={todayStr()}
              onChange={(e) => { setDate(e.target.value); setSelectedEmail(null); }}
              data-testid="input-date-picker"
            />
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                data-testid="button-trigger-sync"
              >
                <RefreshCw className={cn("h-4 w-4 mr-1.5", syncMutation.isPending && "animate-spin")} />
                {syncMutation.isPending ? "Syncing..." : "Sync now"}
              </Button>
            )}
          </div>
        </div>

        {/* Sync status banner */}
        {isAdmin && syncStatus && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm",
              syncStatus.status === "error"
                ? "border-destructive/30 bg-destructive/5 text-destructive"
                : syncStatus.status === "running"
                ? "border-amber-300/50 bg-amber-50 text-amber-700"
                : "border-muted bg-muted/30 text-muted-foreground",
            )}
            data-testid="status-sync-meta"
          >
            <div className={cn("w-2 h-2 rounded-full flex-shrink-0",
              syncStatus.status === "running" ? "bg-amber-400 animate-pulse" :
              syncStatus.status === "error" ? "bg-destructive" : "bg-green-500"
            )} />
            {syncStatus.status === "never_run" ? (
              <span>Sync has never run — click <em>Sync now</em> to pull Zoom data.</span>
            ) : (
              <span>
                Last sync:{" "}
                {syncStatus.last_synced_at
                  ? formatDate(syncStatus.last_synced_at)
                  : "unknown"}{" "}
                &middot; {syncStatus.synced_user_count ?? 0} users
                {syncStatus.status === "running" && " · Running…"}
                {syncStatus.status === "error" && ` · Error: ${syncStatus.error_message}`}
              </span>
            )}
          </div>
        )}

        {/* Team AI Digest */}
        {teamData?.teamDigest && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Team AI Digest · {formatDate(date)}</p>
              <p className="text-sm" data-testid="text-team-digest">{teamData.teamDigest}</p>
            </CardContent>
          </Card>
        )}

        {/* Team overview table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team Overview · {formatDate(date)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {teamLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : !teamData?.rows?.length ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No Zoom activity data for {formatDate(date)}.
                {isAdmin && <span> Run a sync to pull data from Zoom.</span>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs uppercase tracking-wider">
                      <th className="text-left py-2 pr-4 font-medium">Recruiter</th>
                      <th className="text-right py-2 px-3 font-medium">Calls</th>
                      <th className="text-right py-2 px-3 font-medium">Missed</th>
                      <th className="text-right py-2 px-3 font-medium">Talk time</th>
                      <th className="text-right py-2 px-3 font-medium">SMS threads</th>
                      <th className="py-2 pl-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {teamData.rows.map((row) => (
                      <tr
                        key={row.email}
                        className={cn(
                          "border-b last:border-0 hover:bg-muted/40 cursor-pointer transition-colors",
                          selectedEmail === row.email && "bg-primary/5",
                        )}
                        onClick={() => setSelectedEmail(row.email)}
                        data-testid={`row-recruiter-${row.email}`}
                      >
                        <td className="py-3 pr-4 font-medium">{row.email}</td>
                        <td className="py-3 px-3 text-right">{row.totalCalls}</td>
                        <td className="py-3 px-3 text-right">
                          {row.missedCalls > 0 ? (
                            <span className="text-amber-600 font-medium">{row.missedCalls}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">{row.totalMinutes}m</td>
                        <td className="py-3 px-3 text-right">{row.smsThreads}</td>
                        <td className="py-3 pl-3">
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recruiter detail */}
        {selectedEmail && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Call stats */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Call Activity
                </CardTitle>
                <p className="text-xs text-muted-foreground">{selectedEmail} · {formatDate(date)}</p>
              </CardHeader>
              <CardContent>
                {recruiterLoading ? (
                  <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                ) : recruiterData ? (
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Total calls", value: recruiterData.callStats.total, testid: "stat-total-calls" },
                      { label: "Outbound", value: recruiterData.callStats.outbound, testid: "stat-outbound-calls" },
                      { label: "Inbound", value: recruiterData.callStats.inbound, testid: "stat-inbound-calls" },
                      { label: "Missed", value: recruiterData.callStats.missed, testid: "stat-missed-calls", warn: recruiterData.callStats.missed > 0 },
                      { label: "Answered", value: recruiterData.callStats.answered, testid: "stat-answered-calls" },
                      { label: "Talk time", value: `${recruiterData.callStats.totalMinutes}m`, testid: "stat-talk-time" },
                    ].map(({ label, value, testid, warn }) => (
                      <div key={label} className="bg-muted/40 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className={cn("text-xl font-semibold mt-0.5", warn && "text-amber-600")} data-testid={testid}>{value}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* AI Insights */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  AI Coaching Insight
                </CardTitle>
                {recruiterData?.aiInsight?.generatedAt && (
                  <p className="text-xs text-muted-foreground">Generated {formatDate(recruiterData.aiInsight.generatedAt)}</p>
                )}
              </CardHeader>
              <CardContent>
                {recruiterLoading ? (
                  <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                ) : !recruiterData?.aiInsight ? (
                  <div className="text-sm text-muted-foreground text-center py-6">
                    No AI insight available for this date.
                    {isAdmin && <span> Enable <em>Zoom Comms AI</em> in Settings to generate insights.</span>}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 border rounded-lg p-3 bg-muted/30">
                      <ScoreRing score={recruiterData.aiInsight.content.responsivenessScore} />
                      <div className="flex-1 space-y-1">
                        {recruiterData.aiInsight.content.conversationPatterns.slice(0, 2).map((p, i) => (
                          <p key={i} className="text-xs text-muted-foreground" data-testid={`text-pattern-${i}`}>· {p}</p>
                        ))}
                      </div>
                    </div>

                    {recruiterData.aiInsight.content.actionableGoals.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actionable Goals</p>
                        {recruiterData.aiInsight.content.actionableGoals.map((g, i) => (
                          <div key={i} className="flex gap-2.5 items-start border rounded-md p-2.5" data-testid={`card-goal-${i}`}>
                            <Target className={cn("h-3.5 w-3.5 mt-0.5 flex-shrink-0", g.urgency === "high" ? "text-red-500" : "text-amber-500")} />
                            <div>
                              <p className="text-sm font-medium leading-tight">{g.goal}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{g.rationale}</p>
                            </div>
                            <Badge
                              variant={g.urgency === "high" ? "destructive" : "secondary"}
                              className="ml-auto flex-shrink-0 text-xs"
                            >
                              {g.urgency}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}

                    {recruiterData.aiInsight.content.coldCandidates.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cold Candidates</p>
                        {recruiterData.aiInsight.content.coldCandidates.map((c, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground" data-testid={`item-cold-candidate-${i}`}>
                            <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
                            <span>{c.label} · {c.stage} · {c.daysSinceContact}d no contact</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* SMS Digests */}
            {recruiterData && recruiterData.smsDigests.length > 0 && (
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    SMS Thread Digests
                    <Badge variant="secondary" className="ml-1">{recruiterData.smsDigests.length}</Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Anonymised summaries only — raw content is never stored or displayed</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recruiterData.smsDigests.map((d) => (
                      <div key={d.sessionId} className="border rounded-md p-3 bg-muted/20" data-testid={`card-digest-${d.sessionId}`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{d.messageCount} messages · {formatDate(d.sanitizedAt)}</span>
                        </div>
                        <p className="text-sm">{d.sanitizedDigest || "Digest unavailable."}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
