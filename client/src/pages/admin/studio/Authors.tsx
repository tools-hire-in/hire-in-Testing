import { useLocation } from "wouter";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import { Users } from "lucide-react";
import { useStudioProject } from "./useStudioProject";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { AuthorsPanel } from "./AuthorsPanel";

export default function Authors() {
  const { enabled: newLook } = useNewLook();
  const [, setLocation] = useLocation();
  const { projects, projectsLoading, selectedProjectId, setSelectedProjectId } =
    useStudioProject();

  return (
    <AdminLayout>
      <div className="space-y-6 v2-surface">
        {newLook ? (
          <V2PageHeader
            icon={Users}
            eyebrow="Studio"
            title="Authors"
            testId="text-authors-title"
          />
        ) : (
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
        )}

        {selectedProjectId && <AuthorsPanel projectId={selectedProjectId} />}
      </div>
    </AdminLayout>
  );
}
