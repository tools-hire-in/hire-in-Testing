import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Loader2, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { useStudioProject } from "./useStudioProject";
import { SocialKitPreview } from "./SocialKitPreview";
import { STATUS_BADGE_CLASS } from "./studioConstants";
import type { StudioArticle } from "@shared/schema";
import type { CanonicalSocialKit } from "@shared/studioAi";

type CalendarItem = StudioArticle & {
  authorName: string | null;
  projectName: string | null;
  publishesToInsights: boolean;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Calendar() {
  const { projects, projectsLoading, selectedProjectId, setSelectedProjectId } = useStudioProject();
  const [scope, setScope] = useState<"hireins" | "all">("all");
  const [exportItem, setExportItem] = useState<CalendarItem | null>(null);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);

  const { data: items, isLoading } = useQuery<CalendarItem[]>({
    queryKey: ["/api/admin/studio/calendar", selectedProjectId, ymd(monthStart)],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: monthStart.toISOString(),
        to: monthEnd.toISOString(),
      });
      if (selectedProjectId) params.set("projectId", selectedProjectId);
      const res = await fetch(`/api/admin/studio/calendar?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load calendar");
      return res.json();
    },
  });

  const visible = (items ?? []).filter((a) => (scope === "hireins" ? a.publishesToInsights : true));

  const byDay: Record<string, CalendarItem[]> = {};
  for (const a of visible) {
    const when = a.status === "scheduled" ? a.scheduledAt : a.publishedAt;
    if (!when) continue;
    const key = ymd(new Date(when));
    (byDay[key] ??= []).push(a);
  }

  const firstWeekday = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = ymd(new Date());
  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const downloadSocialKit = (item: CalendarItem) => {
    const kit = (item.socialKitJsonb as CanonicalSocialKit | null) ?? {};
    const payload = {
      title: item.title,
      project: item.projectName,
      author: item.authorName,
      seoTitle: item.seoTitle,
      seoDescription: item.seoDescription,
      coverImageUrl: item.coverImageUrl,
      socialKit: kit,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(item.slug || item.title || "social-kit").replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}-social-kit.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportKit = exportItem
    ? ((exportItem.socialKitJsonb as CanonicalSocialKit | null) ?? null)
    : null;

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-calendar-title">
              Publishing Calendar
            </h1>
            <p className="text-sm text-muted-foreground">Scheduled and published articles by date.</p>
          </div>
          <div className="flex items-center gap-3">
            <ToggleGroup
              type="single"
              value={scope}
              onValueChange={(v) => v && setScope(v as "hireins" | "all")}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="hireins" data-testid="toggle-hireins">
                Hire'in
              </ToggleGroupItem>
              <ToggleGroupItem value="all" data-testid="toggle-all-projects">
                All Projects
              </ToggleGroupItem>
            </ToggleGroup>
            <ProjectSwitcher
              projects={projects}
              projectsLoading={projectsLoading}
              selectedProjectId={selectedProjectId}
              onChange={setSelectedProjectId}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              data-testid="button-prev-month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[160px] text-center text-sm font-semibold" data-testid="text-month-label">
              {monthLabel}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              data-testid="button-next-month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const n = new Date();
              setCursor(new Date(n.getFullYear(), n.getMonth(), 1));
            }}
            data-testid="button-today"
          >
            Today
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card>
            <CardContent className="p-3">
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="px-2 py-1 text-center text-xs font-semibold text-muted-foreground">
                    {w}
                  </div>
                ))}
                {cells.map((cell, i) => {
                  if (!cell) return <div key={i} className="min-h-[96px] rounded-md bg-muted/20" />;
                  const key = ymd(cell);
                  const dayItems = byDay[key] ?? [];
                  return (
                    <div
                      key={i}
                      className={`min-h-[96px] rounded-md border p-1.5 ${
                        key === todayKey ? "border-primary" : ""
                      }`}
                      data-testid={`calendar-day-${key}`}
                    >
                      <div className="mb-1 text-right text-xs text-muted-foreground">{cell.getDate()}</div>
                      <div className="space-y-1">
                        {dayItems.map((a) => {
                          const readyToExport = !a.publishesToInsights;
                          return (
                            <button
                              key={a.id}
                              onClick={() => readyToExport && setExportItem(a)}
                              className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] ${
                                readyToExport
                                  ? "border border-dashed bg-amber-50 text-amber-800 hover-elevate dark:bg-amber-950/30 dark:text-amber-300"
                                  : STATUS_BADGE_CLASS[a.status] ?? ""
                              }`}
                              title={readyToExport ? `${a.title} — Ready to Export` : `${a.title} — ${a.status}`}
                              data-testid={`calendar-item-${a.id}`}
                            >
                              {readyToExport ? `⇩ ${a.title}` : a.title}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <Badge variant="secondary" className={STATUS_BADGE_CLASS.scheduled}>Scheduled</Badge>
          <Badge variant="secondary" className={STATUS_BADGE_CLASS.published}>Published</Badge>
          <span className="inline-flex items-center gap-1 rounded border border-dashed bg-amber-50 px-1.5 py-0.5 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            ⇩ Ready to Export (other projects)
          </span>
        </div>
      </div>

      <Sheet open={!!exportItem} onOpenChange={(open) => !open && setExportItem(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg" data-testid="sheet-social-kit">
          <SheetHeader>
            <SheetTitle>Ready to Export</SheetTitle>
            <SheetDescription>
              {exportItem?.title}
              {exportItem?.projectName ? ` — ${exportItem.projectName}` : ""}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <Button
              onClick={() => exportItem && downloadSocialKit(exportItem)}
              data-testid="button-download-social-kit"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Social Kit (JSON)
            </Button>
            <SocialKitPreview kit={exportKit} />
          </div>
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}
