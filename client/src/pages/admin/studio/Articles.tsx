import { useLocation } from "wouter";
import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import { Newspaper, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStudioProject } from "./useStudioProject";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { ArticlesPanel } from "./ArticlesPanel";
import { AuthorsPanel } from "./AuthorsPanel";

export default function Articles() {
  const { enabled: newLook } = useNewLook();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("articles");
  const { projects, projectsLoading, selectedProjectId, setSelectedProjectId } =
    useStudioProject();

  return (
    <AdminLayout>
      <div className="space-y-6 v2-surface">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {newLook ? (
              <V2PageHeader
                icon={Newspaper}
                eyebrow="Studio"
                title="Articles"
                testId="text-articles-title"
              />
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Newspaper className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight" data-testid="text-articles-title">
                    Articles
                  </h1>
                </div>
              </div>
            )}
            <button
              onClick={() => setLocation("/admin/studio")}
              className="text-sm text-muted-foreground hover:text-foreground mt-1"
            >
              ← Back to Content Studio
            </button>
          </div>
          <ProjectSwitcher
            projects={projects}
            projectsLoading={projectsLoading}
            selectedProjectId={selectedProjectId}
            onChange={setSelectedProjectId}
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="articles" data-testid="tab-articles">
              <Newspaper className="mr-1.5 h-4 w-4" />
              Articles
            </TabsTrigger>
            <TabsTrigger value="authors" data-testid="tab-authors">
              <Users className="mr-1.5 h-4 w-4" />
              Authors
            </TabsTrigger>
          </TabsList>

          <TabsContent value="articles" className="mt-4">
            {selectedProjectId && <ArticlesPanel projectId={selectedProjectId} />}
          </TabsContent>

          <TabsContent value="authors" className="mt-4">
            {selectedProjectId && <AuthorsPanel projectId={selectedProjectId} />}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
