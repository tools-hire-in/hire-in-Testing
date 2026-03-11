import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3, Download, CheckCircle, Clock, AlertCircle, Loader2,
  ChevronRight, User, GraduationCap,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

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
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/onboarding/team-progress"],
    queryFn: async () => {
      const res = await fetch("/api/onboarding/team-progress", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const { data: userDetail, isLoading: detailLoading } = useQuery<any[]>({
    queryKey: ["/api/onboarding/team-progress", selectedUserId],
    queryFn: async () => {
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
          <Button variant="outline" onClick={handleExport} data-testid="button-export-csv">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

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
