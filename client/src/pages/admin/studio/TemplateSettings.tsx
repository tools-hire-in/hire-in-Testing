import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, ImageIcon, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
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
import type { StudioProject } from "@shared/schema";

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
