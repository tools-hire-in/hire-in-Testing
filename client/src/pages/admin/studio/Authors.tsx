import { useLocation } from "wouter";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Users } from "lucide-react";
import { useStudioProject } from "./useStudioProject";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { AuthorsPanel } from "./AuthorsPanel";

export default function Authors() {
  const [, setLocation] = useLocation();
  const { projects, projectsLoading, selectedProjectId, setSelectedProjectId } =
    useStudioProject();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-authors-title">
                Authors
              </h1>
              <button
                onClick={() => setLocation("/admin/studio")}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                ← Back to Content Studio
              </button>
            </div>
          </div>
          <ProjectSwitcher
            projects={projects}
            projectsLoading={projectsLoading}
            selectedProjectId={selectedProjectId}
            onChange={setSelectedProjectId}
          />
        </div>

        {selectedProjectId && <AuthorsPanel projectId={selectedProjectId} />}
      </div>
    </AdminLayout>
  );
}
