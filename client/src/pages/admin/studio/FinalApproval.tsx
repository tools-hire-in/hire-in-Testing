import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, Clock3 } from "lucide-react";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { useStudioProject } from "./useStudioProject";
import { WorkflowReviewPanel } from "./WorkflowReviewPanel";
import type { StudioArticle } from "@shared/schema";

type QueueItem = StudioArticle & {
  authorName: string | null;
  projectName: string | null;
  reviewerName: string | null;
};

export default function FinalApproval() {
  const { projects, projectsLoading, selectedProjectId, setSelectedProjectId } = useStudioProject();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: items, isLoading } = useQuery<QueueItem[]>({
    queryKey: ["/api/admin/studio/final-approval", selectedProjectId],
    queryFn: async () => {
      const url = selectedProjectId
        ? `/api/admin/studio/final-approval?projectId=${selectedProjectId}`
        : "/api/admin/studio/final-approval";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load final-approval queue");
      return res.json();
    },
  });

  const list = items ?? [];
  const active = selectedId && list.some((a) => a.id === selectedId) ? selectedId : null;

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-final-approval-title">
              Final Sign-Off
            </h1>
            <p className="text-sm text-muted-foreground">
              Super Admin only. Publish, schedule, or send articles back to draft.
            </p>
          </div>
          <ProjectSwitcher
            projects={projects}
            projectsLoading={projectsLoading}
            selectedProjectId={selectedProjectId}
            onChange={setSelectedProjectId}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : list.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
                  <ShieldCheck className="h-8 w-8" />
                  <span data-testid="text-empty-final">Nothing awaiting final sign-off.</span>
                </CardContent>
              </Card>
            ) : (
              list.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className={`w-full rounded-lg border p-3 text-left transition hover-elevate ${
                    active === a.id ? "border-primary bg-muted/40" : ""
                  }`}
                  data-testid={`card-final-${a.id}`}
                >
                  <span className="line-clamp-2 text-sm font-medium">{a.title}</span>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {a.projectName && <Badge variant="outline">{a.projectName}</Badge>}
                    <span>{a.contentType}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 className="h-3 w-3" />
                    recommended {new Date(a.updatedAt).toLocaleDateString()}
                  </div>
                </button>
              ))
            )}
          </div>

          <div>
            {active ? (
              <WorkflowReviewPanel articleId={active} mode="final" onDone={() => setSelectedId(null)} />
            ) : (
              <Card>
                <CardContent className="py-24 text-center text-sm text-muted-foreground">
                  Select an article to sign off.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
