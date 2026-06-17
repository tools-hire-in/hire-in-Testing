import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Newspaper,
  FileEdit,
  Clock3,
  CheckCircle2,
  CalendarClock,
  Send,
  Globe,
  Star,
} from "lucide-react";
import type { StudioProject } from "@shared/schema";
import { ArticlesPanel } from "./ArticlesPanel";
import { AuthorsPanel } from "./AuthorsPanel";

const STORAGE_KEY = "studio.selectedProjectId";

interface StudioStats {
  totalArticles: number;
  byStatus: Record<string, number>;
  pendingReviews: number;
  scheduled: number;
  published: number;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  in_review: "In Review",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  ready_to_export: "Ready to Export",
};

const STATUS_META: { key: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { key: "draft", icon: FileEdit, color: "text-slate-500" },
  { key: "in_review", icon: Clock3, color: "text-amber-500" },
  { key: "approved", icon: CheckCircle2, color: "text-emerald-500" },
  { key: "scheduled", icon: CalendarClock, color: "text-blue-500" },
  { key: "published", icon: Send, color: "text-violet-500" },
  { key: "ready_to_export", icon: Newspaper, color: "text-orange-500" },
];

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  testId,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`shrink-0 ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <div className="text-2xl font-bold tabular-nums" data-testid={`${testId}-value`}>
            {value}
          </div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        <Badge variant="outline" className="mt-2">
          Coming soon
        </Badge>
      </CardContent>
    </Card>
  );
}

export default function Studio() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const { data: projects, isLoading: projectsLoading } = useQuery<StudioProject[]>({
    queryKey: ["/api/admin/studio/projects"],
  });

  // Restore / default the selected project once projects are loaded.
  useEffect(() => {
    if (!projects || projects.length === 0) return;
    const stored = localStorage.getItem(STORAGE_KEY);
    const valid = stored && projects.some((p) => p.id === stored) ? stored : null;
    const fallback = projects.find((p) => p.isPrimary)?.id ?? projects[0].id;
    setSelectedProjectId(valid ?? fallback);
  }, [projects]);

  const handleProjectChange = (id: string) => {
    setSelectedProjectId(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const { data: stats, isLoading: statsLoading } = useQuery<StudioStats>({
    queryKey: ["/api/admin/studio/stats", selectedProjectId],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/studio/stats${selectedProjectId ? `?projectId=${selectedProjectId}` : ""}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  const selectedProject = useMemo(
    () => projects?.find((p) => p.id === selectedProjectId),
    [projects, selectedProjectId],
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Newspaper className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-studio-title">
                Content Studio
              </h1>
              <p className="text-sm text-muted-foreground">
                Plan, write, review, and publish marketing content.
              </p>
            </div>
          </div>

          {/* Project switcher */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Project</span>
            <Select
              value={selectedProjectId}
              onValueChange={handleProjectChange}
              disabled={projectsLoading || !projects?.length}
            >
              <SelectTrigger className="w-[220px]" data-testid="select-studio-project">
                <SelectValue placeholder={projectsLoading ? "Loading…" : "Select a project"} />
              </SelectTrigger>
              <SelectContent>
                {projects?.map((p) => (
                  <SelectItem key={p.id} value={p.id} data-testid={`option-project-${p.id}`}>
                    <span className="flex items-center gap-2">
                      {p.isPrimary && <Star className="h-3 w-3 text-amber-500" />}
                      {p.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Sub-navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="dashboard" data-testid="tab-studio-dashboard">
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="articles" data-testid="tab-studio-articles">
              Articles
            </TabsTrigger>
            <TabsTrigger value="authors" data-testid="tab-studio-authors">
              Authors
            </TabsTrigger>
            <TabsTrigger value="projects" data-testid="tab-studio-projects">
              Projects
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-studio-analytics">
              Analytics
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-studio-settings">
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Dashboard */}
          <TabsContent value="dashboard" className="mt-6 space-y-6">
            {statsLoading || !stats ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  <StatCard
                    label="Total Articles"
                    value={stats.totalArticles}
                    icon={Newspaper}
                    color="text-primary"
                    testId="stat-total"
                  />
                  <StatCard
                    label="Pending Reviews"
                    value={stats.pendingReviews}
                    icon={Clock3}
                    color="text-amber-500"
                    testId="stat-pending-reviews"
                  />
                  <StatCard
                    label="Scheduled"
                    value={stats.scheduled}
                    icon={CalendarClock}
                    color="text-blue-500"
                    testId="stat-scheduled"
                  />
                  <StatCard
                    label="Published"
                    value={stats.published}
                    icon={Send}
                    color="text-violet-500"
                    testId="stat-published"
                  />
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Pipeline by status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                      {STATUS_META.map(({ key, icon: Icon, color }) => (
                        <div
                          key={key}
                          className="flex flex-col items-center gap-1 rounded-lg border p-3 text-center"
                          data-testid={`pipeline-${key}`}
                        >
                          <Icon className={`h-5 w-5 ${color}`} />
                          <span className="text-xl font-bold tabular-nums">
                            {stats.byStatus[key] ?? 0}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {STATUS_LABELS[key]}
                          </span>
                        </div>
                      ))}
                    </div>
                    {stats.totalArticles === 0 && (
                      <p className="mt-4 text-center text-sm text-muted-foreground">
                        No articles yet for {selectedProject?.name ?? "this project"}. Content
                        creation tools arrive in upcoming releases.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Articles */}
          <TabsContent value="articles" className="mt-6">
            {selectedProjectId ? (
              <ArticlesPanel projectId={selectedProjectId} />
            ) : (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </TabsContent>

          {/* Authors */}
          <TabsContent value="authors" className="mt-6">
            {selectedProjectId ? (
              <AuthorsPanel projectId={selectedProjectId} />
            ) : (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </TabsContent>

          {/* Projects */}
          <TabsContent value="projects" className="mt-6">
            {projectsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {projects?.map((p) => (
                  <Card key={p.id} data-testid={`card-project-${p.id}`}>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-8 w-8 shrink-0 rounded-md"
                            style={{ backgroundColor: p.brandColor ?? "#1F3A6E" }}
                          />
                          <div>
                            <div className="flex items-center gap-1.5 font-semibold">
                              {p.name}
                              {p.isPrimary && <Star className="h-3.5 w-3.5 text-amber-500" />}
                            </div>
                            <div className="text-xs text-muted-foreground">/{p.slug}</div>
                          </div>
                        </div>
                        <Badge variant={p.isActive ? "default" : "secondary"}>
                          {p.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      {p.description && (
                        <p className="text-sm text-muted-foreground">{p.description}</p>
                      )}
                      {p.publishesToInsights && (
                        <Badge variant="outline" className="gap-1">
                          <Globe className="h-3 w-3" />
                          Publishes to Insights
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Analytics */}
          <TabsContent value="analytics" className="mt-6">
            <ComingSoon
              title="Content Analytics"
              description="Track reactions, reach, and newsletter growth across projects. Analytics dashboards arrive in a later release."
            />
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings" className="mt-6">
            <ComingSoon
              title="Studio Settings"
              description="Configure projects, publishing targets, and team permissions. Settings management arrives in a later release."
            />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
