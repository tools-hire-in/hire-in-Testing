import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, ImageIcon, Loader2, Plus, Star, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { StudioProject, StudioOccasion } from "@shared/schema";

const OCCASION_REGIONS = [
  { value: "us", label: "US" },
  { value: "india", label: "India" },
  { value: "global", label: "Global" },
];
const OCCASION_CATEGORIES = [
  { value: "national_holiday", label: "National holidays" },
  { value: "festival", label: "Festivals" },
  { value: "industry_awareness", label: "Industry awareness days" },
  { value: "fun_observance", label: "Fun observances" },
];

// Studio T4: per-project occasion relevance settings + custom occasions.
function OccasionsSettingsCard({ project }: { project: StudioProject }) {
  const { toast } = useToast();
  const prefs = (project.occasionPreferences as any) ?? null;
  const [regions, setRegions] = useState<string[]>(Array.isArray(prefs?.regions) ? prefs.regions : []);
  const [categories, setCategories] = useState<string[]>(Array.isArray(prefs?.categories) ? prefs.categories : []);
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newAngle, setNewAngle] = useState("");

  useEffect(() => {
    const p = (project.occasionPreferences as any) ?? null;
    setRegions(Array.isArray(p?.regions) ? p.regions : []);
    setCategories(Array.isArray(p?.categories) ? p.categories : []);
  }, [project.id]);

  const year = new Date().getFullYear();
  const { data: occasions } = useQuery<StudioOccasion[]>({
    queryKey: ["/api/admin/studio/occasions", "custom", project.id],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: `${year}-01-01`,
        to: `${year + 2}-12-31`,
        projectId: project.id,
      });
      const res = await fetch(`/api/admin/studio/occasions?${params.toString()}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const customOccasions = (occasions ?? []).filter((o) => o.projectId === project.id);

  const savePrefsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "PATCH",
        `/api/admin/studio/projects/${project.id}/occasion-preferences`,
        { regions, categories },
      );
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Failed to save preferences");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/occasions"] });
      toast({ title: "Occasion preferences saved" });
    },
    onError: (err: Error) =>
      toast({ title: "Could not save preferences", description: err.message, variant: "destructive" }),
  });

  const addOccasionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/studio/occasions", {
        name: newName.trim(),
        date: newDate,
        contentAngle: newAngle.trim() || null,
        projectId: project.id,
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Failed to add occasion");
      }
      return res.json();
    },
    onSuccess: () => {
      setNewName("");
      setNewDate("");
      setNewAngle("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/occasions"] });
      toast({ title: "Custom occasion added" });
    },
    onError: (err: Error) =>
      toast({ title: "Could not add occasion", description: err.message, variant: "destructive" }),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/admin/studio/occasions/${id}`, { isActive: false });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Failed to remove occasion");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/occasions"] });
      toast({ title: "Occasion removed" });
    },
    onError: (err: Error) =>
      toast({ title: "Could not remove occasion", description: err.message, variant: "destructive" }),
  });

  const toggle = (list: string[], set: (v: string[]) => void, value: string) => {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  return (
    <Card data-testid="card-occasions-settings">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="h-4 w-4 text-amber-500" />
          Occasions on the Calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Pick which curated occasions (holidays, festivals, awareness days) appear as badges on{" "}
          <span className="font-medium text-foreground">{project.name}</span>'s planning calendar.
          Leave everything unchecked to hide curated occasions entirely.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Regions</p>
            {OCCASION_REGIONS.map((r) => (
              <label key={r.value} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={regions.includes(r.value)}
                  onCheckedChange={() => toggle(regions, setRegions, r.value)}
                  data-testid={`checkbox-region-${r.value}`}
                />
                {r.label}
              </label>
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categories</p>
            {OCCASION_CATEGORIES.map((c) => (
              <label key={c.value} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={categories.includes(c.value)}
                  onCheckedChange={() => toggle(categories, setCategories, c.value)}
                  data-testid={`checkbox-category-${c.value}`}
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => savePrefsMutation.mutate()}
          disabled={savePrefsMutation.isPending}
          data-testid="button-save-occasion-prefs"
        >
          {savePrefsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save preferences
        </Button>

        <div className="space-y-2 border-t pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Custom occasions (always shown for this project)
          </p>
          {customOccasions.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="text-no-custom-occasions">
              None yet — add company anniversaries, launch dates, etc.
            </p>
          ) : (
            <div className="space-y-1.5">
              {customOccasions.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                  data-testid={`custom-occasion-${o.id}`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{o.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {o.date}
                      {o.contentAngle ? ` · ${o.contentAngle}` : ""}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deactivateMutation.mutate(o.id)}
                    disabled={deactivateMutation.isPending}
                    data-testid={`button-remove-occasion-${o.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr_auto]">
            <Input
              placeholder="Occasion name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              data-testid="input-new-occasion-name"
            />
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="sm:w-[150px]"
              data-testid="input-new-occasion-date"
            />
            <Input
              placeholder="Content angle (optional)"
              value={newAngle}
              onChange={(e) => setNewAngle(e.target.value)}
              data-testid="input-new-occasion-angle"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => addOccasionMutation.mutate()}
              disabled={addOccasionMutation.isPending || !newName.trim() || !newDate}
              data-testid="button-add-occasion"
            >
              {addOccasionMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface CardTemplateMeta {
  id: string;
  family: string;
  layout: string;
  platform: string;
  label: string | null;
  width: number;
  height: number;
  maxTips: number | null;
  isActive: boolean;
  projectId: string | null;
}

const LAYOUT_LABELS: Record<string, string> = {
  standard: "Standard",
  checklist: "Checklist",
  quote: "Quote",
};

const PROJECT_STORAGE_KEY = "studio.selectedProjectId";

export default function TemplateSettings() {
  const { toast } = useToast();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [pendingFamily, setPendingFamily] = useState<string | null>(null);

  const { data: templates, isLoading } = useQuery<CardTemplateMeta[]>({
    queryKey: ["/api/admin/studio/card-templates", { includeInactive: true }],
    queryFn: async () => {
      const res = await fetch("/api/admin/studio/card-templates?includeInactive=true", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load templates");
      return res.json();
    },
  });

  const { data: projects } = useQuery<StudioProject[]>({
    queryKey: ["/api/admin/studio/projects"],
  });

  const selectedProjectId =
    typeof window !== "undefined" ? localStorage.getItem(PROJECT_STORAGE_KEY) : null;
  const project =
    (projects ?? []).find((p) => p.id === selectedProjectId) ?? (projects ?? [])[0];
  const activeFamily = project?.activeTemplateFamily ?? "hirein-v1";

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/admin/studio/card-templates/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/card-templates"] });
    },
    onError: () => {
      toast({ title: "Could not update template", variant: "destructive" });
    },
  });

  const switchFamilyMutation = useMutation({
    mutationFn: async (family: string) => {
      if (!project) throw new Error("No project selected");
      return apiRequest("PATCH", `/api/admin/studio/projects/${project.id}/template-family`, {
        family,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/projects"] });
      toast({ title: "Active template family updated" });
      setPendingFamily(null);
    },
    onError: () => {
      toast({ title: "Could not switch template family", variant: "destructive" });
      setPendingFamily(null);
    },
  });

  const families = Array.from(new Set((templates ?? []).map((t) => t.family)));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/studio">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Social Card Templates
          </h1>
          <p className="text-sm text-muted-foreground">
            The branded card variants used when an article is approved. Toggle a variant off to skip it
            during generation.
          </p>
        </div>
      </div>

      {/* Active template family (multi-brand) */}
      <Card data-testid="card-active-family">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Active Brand / Template Family</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            New cards for{" "}
            <span className="font-medium text-foreground">{project?.name ?? "this project"}</span> are
            rendered using the selected family.
          </p>
          <Select
            value={activeFamily}
            onValueChange={(v) => {
              if (v !== activeFamily) setPendingFamily(v);
            }}
            disabled={!project || families.length === 0}
          >
            <SelectTrigger className="w-[200px]" data-testid="select-template-family">
              <SelectValue placeholder="Select a family" />
            </SelectTrigger>
            <SelectContent>
              {families.map((f) => (
                <SelectItem key={f} value={f} data-testid={`option-family-${f}`}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Occasion-aware calendar preferences (Studio T4) */}
      {project && <OccasionsSettingsCard project={project} />}

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading templates…
        </div>
      ) : (templates ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground" data-testid="text-no-templates">
            No card templates found. They are seeded from disk on server start.
          </CardContent>
        </Card>
      ) : (
        families.map((family) => {
          const familyTemplates = (templates ?? []).filter((t) => t.family === family);
          const byLayout = familyTemplates.reduce<Record<string, CardTemplateMeta[]>>((acc, t) => {
            (acc[t.layout] ??= []).push(t);
            return acc;
          }, {});
          return (
            <div key={family} className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-medium" data-testid={`text-family-${family}`}>
                  {family}
                </h2>
                <Badge variant="secondary">{familyTemplates.length} variants</Badge>
                {family === activeFamily && (
                  <Badge data-testid={`badge-active-family-${family}`}>Active</Badge>
                )}
              </div>
              {Object.entries(byLayout).map(([layout, items]) => (
                <Card key={layout} data-testid={`card-layout-${layout}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{LAYOUT_LABELS[layout] ?? layout}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-lg border p-3"
                        data-testid={`template-${t.layout}-${t.platform}`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium" title={t.platform}>
                              {t.platform}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {t.width}×{t.height}
                              {t.maxTips ? ` · ${t.maxTips} tips` : ""}
                            </p>
                          </div>
                          <Switch
                            checked={t.isActive}
                            onCheckedChange={(v) => toggleMutation.mutate({ id: t.id, isActive: v })}
                            data-testid={`switch-active-${t.layout}-${t.platform}`}
                          />
                        </div>
                        <div className="overflow-hidden rounded-md border bg-muted/30">
                          {previewId === t.id ? (
                            <img
                              src={`/api/admin/studio/card-templates/${t.id}/preview?t=${Date.now()}`}
                              alt={`${t.layout} ${t.platform} preview`}
                              className="w-full"
                              style={{ aspectRatio: `${t.width} / ${t.height}` }}
                              data-testid={`img-preview-${t.layout}-${t.platform}`}
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPreviewId(t.id)}
                              className="flex w-full flex-col items-center justify-center gap-1 py-8 text-xs text-muted-foreground hover:text-foreground"
                              style={{ aspectRatio: `${t.width} / ${t.height}` }}
                              data-testid={`button-load-preview-${t.layout}-${t.platform}`}
                            >
                              <ImageIcon className="h-5 w-5" />
                              Load preview
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          );
        })
      )}

      <AlertDialog open={pendingFamily !== null} onOpenChange={(o) => !o && setPendingFamily(null)}>
        <AlertDialogContent data-testid="dialog-switch-family">
          <AlertDialogHeader>
            <AlertDialogTitle>Switch template family?</AlertDialogTitle>
            <AlertDialogDescription>
              New and regenerated cards for {project?.name ?? "this project"} will use the{" "}
              <span className="font-medium">{pendingFamily}</span> family. Existing cards are not
              changed until articles are regenerated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-switch">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingFamily && switchFamilyMutation.mutate(pendingFamily)}
              disabled={switchFamilyMutation.isPending}
              data-testid="button-confirm-switch"
            >
              {switchFamilyMutation.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : null}
              Switch family
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
