import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import {
  Users,
  Clock,
  BookOpen,
  Target,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Calendar,
  ChevronRight,
} from "lucide-react";

interface PreviewEmployee {
  userId: string;
  name: string;
  department: string | null;
  role: string;
  sopsToReceive: string[];
  ackStatus: "acknowledged" | "pending" | "not_assigned";
}

interface PreviewTimeline {
  sopCode: string;
  sopTitle: string;
  activationDate: string | null;
  gracePeriodDays: number;
  graceEndDate: string | null;
  overdueNudgeBegins: string | null;
  hardLockThreshold: string | null;
  enforcement: string;
}

interface PreviewTrack {
  trackId: string;
  trackTitle: string;
  estimatedMinutes: number | null;
  dueDate: string | null;
  roles: string[];
  completedCount: number;
  totalCount: number;
}

interface PreviewGoal {
  title: string;
  category: string;
  targetMetric: string | null;
  roles: string[];
}

interface WavePreviewData {
  waveNumber: number;
  waveName: string;
  enforcement: string;
  employees: PreviewEmployee[];
  totalCount: number;
  departmentCount: number;
  timeline: PreviewTimeline[];
  training: PreviewTrack[];
  goals: PreviewGoal[];
  cadenceNote: string | null;
}

const ENFORCEMENT_BADGE: Record<string, string> = {
  soft: "bg-blue-100 text-blue-700",
  measured: "bg-amber-100 text-amber-700",
  full: "bg-red-100 text-red-700",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

export function WaveImpactDrawer({
  waveNumber,
  waveName,
  open,
  onClose,
  readonly,
  highlightSopCode,
}: {
  waveNumber: number;
  waveName: string;
  open: boolean;
  onClose: () => void;
  readonly?: boolean;
  highlightSopCode?: string;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isSuperAdmin = user?.role === "super_admin";
  const [deptFilter, setDeptFilter] = useState("all");

  const { data, isLoading, error } = useQuery<WavePreviewData>({
    queryKey: ["/api/sops/rollout/waves", waveNumber, "preview"],
    queryFn: async () => {
      const res = await fetch(`/api/sops/rollout/waves/${waveNumber}/preview`, { credentials: "include" });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          if (body?.error) msg = body.error;
        } catch {}
        throw new Error(msg);
      }
      return res.json();
    },
    enabled: open,
  });

  const activateMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/sops/waves/${waveNumber}/activate`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: `Wave ${waveNumber} activated`, description: `${waveName} is now active.` });
      queryClient.invalidateQueries({ queryKey: ["/api/sops/waves"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Activation failed", description: e?.message, variant: "destructive" }),
  });

  const departments = data
    ? Array.from(new Set(data.employees.map((e) => e.department).filter(Boolean) as string[])).sort()
    : [];

  const filteredEmployees = data?.employees.filter(
    (e) => deptFilter === "all" || e.department === deptFilter,
  ) ?? [];

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full max-w-2xl overflow-y-auto" data-testid="drawer-wave-impact">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            Wave {waveNumber} — Impact Preview
            {data && (
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${ENFORCEMENT_BADGE[data.enforcement] ?? "bg-muted text-muted-foreground"}`}
              >
                {data.enforcement} enforcement
              </span>
            )}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">{waveName}</p>
        </SheetHeader>

        {isLoading && (
          <div className="space-y-4 pt-6">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 p-4 mt-6 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Failed to load impact preview.</div>
              {(error as Error)?.message && (
                <div className="mt-1 text-xs opacity-80">{(error as Error).message}</div>
              )}
            </div>
          </div>
        )}

        {data && (
          <div className="space-y-8 pt-6 pb-20">
            {data.cadenceNote && (
              <div className="flex items-center gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300" data-testid="text-cadence-note">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {data.cadenceNote}
              </div>
            )}

            {/* Section 1: Who This Reaches */}
            <section data-testid="section-who-reaches">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Who This Reaches</h3>
                <Badge variant="secondary" data-testid="badge-employee-count">
                  {data.totalCount} employee{data.totalCount !== 1 ? "s" : ""} across {data.departmentCount} dept{data.departmentCount !== 1 ? "s" : ""}
                </Badge>
              </div>

              {departments.length > 1 && (
                <div className="mb-3">
                  <Select value={deptFilter} onValueChange={setDeptFilter}>
                    <SelectTrigger className="w-52 h-8 text-xs" data-testid="select-dept-filter">
                      <SelectValue placeholder="Filter by department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All departments</SelectItem>
                      {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {filteredEmployees.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No employees match this filter.</p>
              ) : (
                <div className="rounded border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/60">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Employee</th>
                        <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Dept</th>
                        <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Role</th>
                        <th className="text-left px-3 py-2 font-medium">SOPs</th>
                        <th className="text-left px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredEmployees.map((emp) => (
                        <tr key={emp.userId} className="hover:bg-muted/30" data-testid={`row-emp-${emp.userId}`}>
                          <td className="px-3 py-2 font-medium">{emp.name}</td>
                          <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{emp.department ?? "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell capitalize">{emp.role.replace("_", " ")}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {emp.sopsToReceive.map((code) => (
                                <span key={code} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{code}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {emp.ackStatus === "acknowledged" ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 text-[10px]">
                                <CheckCircle2 className="h-3 w-3" /> Ack'd
                              </span>
                            ) : emp.ackStatus === "pending" ? (
                              <span className="inline-flex items-center gap-1 text-amber-600 text-[10px]">
                                <Clock className="h-3 w-3" /> Pending
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-[10px]">Not assigned</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Section 2: Acknowledgment Timeline */}
            <section data-testid="section-timeline">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Acknowledgment Timeline</h3>
              </div>
              {data.timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">No SOPs with timeline data in this wave.</p>
              ) : (
                <div className="space-y-3">
                  {data.timeline.map((t) => (
                    <div
                      key={t.sopCode}
                      className={`rounded border p-3 text-xs ${highlightSopCode === t.sopCode ? "border-primary ring-1 ring-primary bg-primary/5" : ""}`}
                      data-testid={`timeline-${t.sopCode}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{t.sopCode} — {t.sopTitle}</span>
                        <span className={`rounded px-1.5 py-0.5 capitalize ${ENFORCEMENT_BADGE[t.enforcement] ?? "bg-muted text-foreground"}`}>
                          {t.enforcement}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                        <span className="rounded bg-muted px-2 py-1">
                          Activation: {formatDate(t.activationDate)}
                        </span>
                        <ChevronRight className="h-3 w-3" />
                        <span className="rounded bg-muted px-2 py-1">
                          Grace ends: {formatDate(t.graceEndDate)} ({t.gracePeriodDays}d)
                        </span>
                        <ChevronRight className="h-3 w-3" />
                        <span className="rounded bg-amber-100 text-amber-700 px-2 py-1 dark:bg-amber-900/30 dark:text-amber-300">
                          Nudges begin: {formatDate(t.overdueNudgeBegins)}
                        </span>
                        {t.enforcement === "full" && t.hardLockThreshold && (
                          <>
                            <ChevronRight className="h-3 w-3" />
                            <span className="rounded bg-red-100 text-red-700 px-2 py-1 dark:bg-red-900/30 dark:text-red-300">
                              Hard lock: {formatDate(t.hardLockThreshold)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Section 3: Follow-up Training */}
            <section data-testid="section-training">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Follow-up Training Assigned</h3>
              </div>
              {data.training.length === 0 ? (
                <p className="text-sm text-muted-foreground">No training tracks linked to this wave.</p>
              ) : (
                <div className="space-y-2">
                  {data.training.map((tr) => (
                    <div key={tr.trackId} className="rounded border p-3 text-xs" data-testid={`training-${tr.trackId}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{tr.trackTitle}</span>
                        {tr.completedCount === tr.totalCount && tr.totalCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" /> Already complete ✓
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                        {tr.estimatedMinutes && <span>{tr.estimatedMinutes} min est.</span>}
                        {tr.dueDate && <span>Due: {formatDate(tr.dueDate)}</span>}
                        <span>
                          Completion: {tr.completedCount}/{tr.totalCount} employees
                        </span>
                      </div>
                      {tr.roles.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {tr.roles.map((r) => (
                            <span key={r} className="rounded bg-muted px-1.5 py-0.5 capitalize">{r.replace("_", " ")}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Section 4: Goals Being Added */}
            <section data-testid="section-goals">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Goals Being Added</h3>
              </div>
              {data.goals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No goals will be seeded by this wave.</p>
              ) : (
                <div className="space-y-2">
                  {data.goals.map((g, i) => (
                    <div key={i} className="rounded border p-3 text-xs" data-testid={`goal-${i}`}>
                      <div className="font-medium">{g.title}</div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                        <span>Category: {g.category}</span>
                        {g.targetMetric && <span>Target: {g.targetMetric}</span>}
                      </div>
                      {g.roles.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {g.roles.map((r) => (
                            <span key={r} className="rounded bg-muted px-1.5 py-0.5 capitalize">{r.replace("_", " ")}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Footer */}
        {data && !readonly && isSuperAdmin && (
          <div className="fixed bottom-0 right-0 w-full max-w-2xl border-t bg-background px-6 py-4 flex justify-end gap-3" data-testid="drawer-footer">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => activateMut.mutate()}
              disabled={activateMut.isPending}
              data-testid="button-confirm-activate-wave"
            >
              {activateMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirm & Activate Wave {waveNumber}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
