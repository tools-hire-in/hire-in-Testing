import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  BarChart3, Download, CheckCircle, Clock, AlertCircle, Loader2,
  ChevronRight, User, GraduationCap, CalendarPlus, WifiOff, ExternalLink,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";

const STATUS_CONFIG: Record<string, { label: string; class: string; icon?: any }> = {
  not_assigned: { label: "Not Assigned", class: "bg-gray-100 text-gray-500" },
  not_started: { label: "Not Started", class: "bg-slate-100 text-slate-600" },
  in_progress: { label: "In Progress", class: "bg-amber-100 text-amber-700" },
  completed: { label: "Completed", class: "bg-green-100 text-green-700" },
  overdue: { label: "Overdue", class: "bg-red-100 text-red-700" },
};

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function StatusCell({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.not_assigned;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.class}`}>
      {cfg.label}
    </span>
  );
}

export default function TrainingProgress() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [endorseComment, setEndorseComment] = useState<Record<string, string>>({});

  const endorserRoles = ["manager", "hr", "admin"];
  const isEndorser = endorserRoles.includes(user?.role || "");

  const { data: rayoStatus } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/rayo-academy/status"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/rayo-academy/status", { credentials: "include" });
        if (!res.ok) return { enabled: false };
        return res.json();
      } catch { return { enabled: false }; }
    },
    staleTime: 60000,
  });
  const isRayoEnabled = rayoStatus?.enabled === true;

  const { data, isLoading } = useQuery<any>({
    queryKey: isRayoEnabled ? ["/api/rayo-academy/team-progress"] : ["/api/onboarding/team-progress"],
    queryFn: async () => {
      const url = isRayoEnabled ? "/api/rayo-academy/team-progress" : "/api/onboarding/team-progress";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const { data: toEndorse = [], isLoading: loadingEndorse } = useQuery<any[]>({
    queryKey: ["/api/onboarding/extension-requests/to-endorse"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/onboarding/extension-requests/to-endorse", { credentials: "include" });
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    },
    enabled: isEndorser,
  });

  const endorseExtension = useMutation({
    mutationFn: ({ id, comment, action }: { id: string; comment?: string; action?: string }) =>
      apiRequest("PATCH", `/api/onboarding/extension-requests/${id}/endorse`, { comment, action }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/extension-requests/to-endorse"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/team-progress"] });
      const msg = variables.action === "approve" ? "Extension request approved"
        : variables.action === "reject" ? "Extension request rejected"
        : "Extension request endorsed and forwarded for approval";
      toast({ title: msg });
    },
    onError: () => toast({ title: "Failed to process request", variant: "destructive" }),
  });

  const { data: userDetail, isLoading: detailLoading } = useQuery<any[]>({
    queryKey: [isRayoEnabled ? "/api/rayo-academy/team-progress" : "/api/onboarding/team-progress", "detail", selectedUserId],
    queryFn: async () => {
      if (isRayoEnabled && data?.fromApi) {
        const userRow = data?.matrix?.find((row: any) => row.user.id === selectedUserId);
        if (userRow) {
          return userRow.trackProgress.map((tp: any) => ({
            track: { title: tp.trackTitle, id: tp.trackId },
            assignment: { id: tp.assignmentId || tp.trackId, status: tp.status, dueDate: tp.dueDate, completedAt: tp.completedAt },
            sections: [],
          }));
        }
      }
      const res = await fetch(`/api/onboarding/team-progress/${selectedUserId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!selectedUserId && showDetail,
  });

  const handleExport = () => {
    window.open("/api/onboarding/team-progress/export/csv", "_blank");
  };

  const tracks = data?.tracks || [];
  const matrix = data?.matrix || [];

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-blue-600" />
              Training Progress
            </h1>
            <p className="text-muted-foreground mt-1">Monitor your team's training completion across all tracks</p>
          </div>
          <div className="flex gap-2">
            {isRayoEnabled && (
              <Button
                onClick={() => window.open("https://rayo.academy", "_blank")}
                className="bg-indigo-600 hover:bg-indigo-700"
                data-testid="button-open-rayo-academy"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Rayo Academy
              </Button>
            )}
            <Button variant="outline" onClick={handleExport} data-testid="button-export-csv">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {isRayoEnabled && data && data.fromApi === false && (
          <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30" data-testid="banner-rayo-fallback">
            <WifiOff className="h-5 w-5 mt-0.5 shrink-0 text-amber-600" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">Training data may be delayed</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                Unable to reach Rayo Academy. Showing locally cached training data.
              </p>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading progress data...
          </div>
        )}

        {!isLoading && matrix.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center text-muted-foreground">
              <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No data available</p>
              <p className="text-sm mt-1">No employees or published tracks found.</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && matrix.length > 0 && tracks.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>No published tracks yet. Publish tracks in Training Management to see progress here.</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && matrix.length > 0 && tracks.length > 0 && (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 text-sm font-semibold text-muted-foreground sticky left-0 bg-muted/50 min-w-48">
                      Employee
                    </th>
                    {tracks.map((track: any) => (
                      <th key={track.id} className="text-left p-3 text-sm font-semibold text-muted-foreground min-w-36">
                        {track.title}
                      </th>
                    ))}
                    <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {matrix.map((row: any) => (
                    <tr key={row.user.id} className="hover:bg-muted/20" data-testid={`row-user-${row.user.id}`}>
                      <td className="p-3 sticky left-0 bg-white">
                        <div>
                          <p className="font-medium text-sm">{row.user.firstName} {row.user.lastName}</p>
                          <p className="text-xs text-muted-foreground">{row.user.employeeId || row.user.email}</p>
                        </div>
                      </td>
                      {tracks.map((track: any) => {
                        const progress = row.trackProgress.find((p: any) => p.trackId === track.id);
                        return (
                          <td key={track.id} className="p-3">
                            <StatusCell status={progress?.status || "not_assigned"} />
                          </td>
                        );
                      })}
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setSelectedUserId(row.user.id); setShowDetail(true); }}
                          data-testid={`button-view-detail-${row.user.id}`}
                        >
                          <ChevronRight className="h-4 w-4 mr-1" />
                          Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Summary cards */}
        {!isLoading && matrix.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {["not_started", "in_progress", "completed", "overdue"].map(status => {
              const count = matrix.reduce((sum: number, row: any) => {
                return sum + row.trackProgress.filter((p: any) => p.status === status).length;
              }, 0);
              const cfg = STATUS_CONFIG[status];
              return (
                <Card key={status}>
                  <CardContent className="pt-4 pb-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{cfg.label}</p>
                    <p className="text-3xl font-bold mt-1">{count}</p>
                    <p className="text-xs text-muted-foreground">assignments</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {isEndorser && (
          <Card data-testid="panel-extension-requests">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarPlus className="h-5 w-5 text-amber-600" />
                Extension Requests
                {toEndorse.length > 0 && (
                  <span className="ml-1.5 bg-amber-500 text-white text-xs font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center" data-testid="badge-extension-count">
                    {toEndorse.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingEndorse && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading extension requests...
                </div>
              )}
              {!loadingEndorse && toEndorse.length === 0 && (
                <p className="text-sm text-muted-foreground py-4" data-testid="text-no-extensions">No pending extension requests from your reports.</p>
              )}
              {!loadingEndorse && toEndorse.length > 0 && (
                <div className="space-y-3">
                  {toEndorse.map((ext: any) => (
                    <div key={ext.id} className="border rounded-lg p-4 space-y-3" data-testid={`extension-request-${ext.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1 min-w-0">
                          <p className="font-semibold text-sm">{ext.requesterName} <span className="text-muted-foreground font-normal">({ext.requesterRole})</span></p>
                          <p className="text-sm">
                            <span className="font-medium">Track:</span> {ext.trackTitle}
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">Current due:</span> {ext.currentDueDate ? new Date(ext.currentDueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "None"}
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">Requested new date:</span> {new Date(ext.newDueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-amber-700 border-amber-300">
                          {ext.isDirectReport && user?.role === "manager" ? "Pending Your Approval" : "Pending Endorsement"}
                        </Badge>
                      </div>
                      <div className="bg-muted/50 rounded-md p-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Reason</p>
                        <p className="text-sm whitespace-pre-wrap">{ext.reason}</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Comment (optional)</Label>
                        <Input
                          value={endorseComment[ext.id] || ""}
                          onChange={e => setEndorseComment(prev => ({ ...prev, [ext.id]: e.target.value }))}
                          placeholder="Add a comment..."
                          className="h-8 text-sm"
                          data-testid={`input-extension-comment-${ext.id}`}
                        />
                      </div>
                      {ext.isDirectReport && user?.role === "manager" ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-700 hover:bg-green-800"
                            onClick={() => endorseExtension.mutate({ id: ext.id, comment: endorseComment[ext.id] || "", action: "approve" })}
                            disabled={endorseExtension.isPending}
                            data-testid={`button-approve-extension-${ext.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => endorseExtension.mutate({ id: ext.id, comment: endorseComment[ext.id] || "", action: "reject" })}
                            disabled={endorseExtension.isPending}
                            data-testid={`button-reject-extension-${ext.id}`}
                          >
                            <AlertCircle className="h-4 w-4 mr-1" /> Reject
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          className="bg-blue-700 hover:bg-blue-800"
                          onClick={() => endorseExtension.mutate({ id: ext.id, comment: endorseComment[ext.id] || "" })}
                          disabled={endorseExtension.isPending}
                          data-testid={`button-endorse-extension-${ext.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" /> Endorse & Forward to Super Admin
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Employee Detail Modal */}
      <Dialog open={showDetail} onOpenChange={v => { setShowDetail(v); if (!v) setSelectedUserId(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Training Detail
            </DialogTitle>
          </DialogHeader>

          {detailLoading && (
            <div className="flex items-center gap-2 text-muted-foreground py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          )}

          {!detailLoading && userDetail && userDetail.length === 0 && (
            <p className="text-muted-foreground text-sm py-4 text-center">No assigned tracks for this employee.</p>
          )}

          {!detailLoading && userDetail && userDetail.map((item: any) => (
            <div key={item.assignment.id} className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{item.track.title}</p>
                  <div className="flex gap-2 mt-1">
                    <StatusCell status={item.assignment.status} />
                    {item.assignment.dueDate && (
                      <span className="text-xs text-muted-foreground">Due: {formatDate(item.assignment.dueDate)}</span>
                    )}
                    {item.assignment.completedAt && (
                      <span className="text-xs text-green-600">Completed: {formatDate(item.assignment.completedAt)}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {item.sections.map((section: any, idx: number) => (
                  <div key={section.id} className="flex items-start gap-3 p-3 rounded-md border bg-muted/20">
                    <div className="shrink-0 mt-0.5">
                      {section.progress?.status === "completed"
                        ? <CheckCircle className="h-4 w-4 text-green-600" />
                        : section.progress?.status === "in_progress"
                          ? <Clock className="h-4 w-4 text-amber-600" />
                          : <AlertCircle className="h-4 w-4 text-gray-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{idx + 1}. {section.title}</p>
                      <div className="flex gap-3 mt-0.5 flex-wrap text-xs text-muted-foreground">
                        {section.progress && (
                          <span>Read: {section.progress.dwellSeconds}s</span>
                        )}
                        {section.progress?.quizAttempts > 0 && (
                          <span>Quiz: {section.progress.quizPassed ? "Passed" : "Failed"} ({section.progress.quizAttempts} attempt{section.progress.quizAttempts !== 1 ? "s" : ""})</span>
                        )}
                        {section.acknowledgement && (
                          <span className="text-green-600">
                            Signed as "{section.acknowledgement.typedName}" — {formatDate(section.acknowledgement.acknowledgedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                    <StatusCell status={section.progress?.status || "not_started"} />
                  </div>
                ))}
              </div>
              <Separator />
            </div>
          ))}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
