import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { useStudioProject } from "@/pages/admin/studio/useStudioProject";
import type { StudioOutreachStep } from "@shared/studioContent";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Copy, Loader2, MailPlus, Plus, Save, Send, Sparkles, Trash2 } from "lucide-react";
import { FieldHelp } from "@/components/studio/FieldHelp";

interface OutreachRow {
  id: string;
  projectId: string;
  campaignId: string | null;
  name: string;
  sequenceType: string;
  audienceType: string | null;
  stepsJsonb: StudioOutreachStep[] | null;
  status: string;
}

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  archived: "bg-muted text-muted-foreground line-through",
};

/** Editable step list — every field is a text block the human can rewrite. */
function StepsEditor({
  sequence, canEdit, onCopy,
}: {
  sequence: OutreachRow;
  canEdit: boolean;
  onCopy: (step: StudioOutreachStep) => void;
}) {
  const { toast } = useToast();
  const [steps, setSteps] = useState<StudioOutreachStep[]>(
    () => (sequence.stepsJsonb ?? []).map((s) => ({ ...s })),
  );
  const [dirty, setDirty] = useState(false);

  const update = (i: number, patch: Partial<StudioOutreachStep>) => {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
    setDirty(true);
  };
  const removeStep = (i: number) => {
    setSteps((prev) => prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, order: idx + 1 })));
    setDirty(true);
  };
  const addStep = () => {
    setSteps((prev) => [...prev, { order: prev.length + 1, subjectOrHook: "", body: "", notes: "" }]);
    setDirty(true);
  };

  const save = useMutation({
    mutationFn: async () =>
      apiRequest("PATCH", `/api/studio/outreach/${sequence.id}`, {
        stepsJsonb: steps.map((s, idx) => ({
          order: idx + 1,
          subjectOrHook: s.subjectOrHook ?? "",
          body: s.body ?? "",
          ...(s.notes?.trim() ? { notes: s.notes.trim() } : {}),
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studio/outreach"] });
      setDirty(false);
      toast({ title: "Steps saved" });
    },
    onError: (e: any) => toast({ title: "Failed to save steps", description: e?.message, variant: "destructive" }),
  });

  if (!steps.length) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          No steps yet. Use "AI-draft copy" to generate a first version{canEdit ? ", or add a step by hand" : ""}.
        </p>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={addStep} data-testid="button-add-step">
            <Plus className="mr-1 h-4 w-4" /> Add step
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div key={i} className="rounded-md border p-3" data-testid={`card-step-${i}`}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Step {i + 1}</p>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => onCopy(step)} data-testid={`button-copy-step-${i}`}>
                <Copy className="h-4 w-4" />
              </Button>
              {canEdit && (
                <Button size="sm" variant="ghost" onClick={() => removeStep(i)} data-testid={`button-remove-step-${i}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          {canEdit ? (
            <div className="space-y-2">
              <div>
                <Label className="flex items-center gap-1.5 text-xs">Subject / hook <FieldHelp id="outreach-subject-hook" /></Label>
                <Input
                  className="mt-1"
                  value={step.subjectOrHook ?? ""}
                  onChange={(e) => update(i, { subjectOrHook: e.target.value })}
                  data-testid={`input-step-subject-${i}`}
                />
              </div>
              <div>
                <Label className="text-xs">Body</Label>
                <Textarea
                  rows={4}
                  className="mt-1"
                  value={step.body ?? ""}
                  onChange={(e) => update(i, { body: e.target.value })}
                  data-testid={`input-step-body-${i}`}
                />
              </div>
              <div>
                <Label className="text-xs">Notes (timing, context — optional)</Label>
                <Input
                  className="mt-1"
                  value={step.notes ?? ""}
                  onChange={(e) => update(i, { notes: e.target.value })}
                  data-testid={`input-step-notes-${i}`}
                />
              </div>
            </div>
          ) : (
            <>
              {step.subjectOrHook && <p className="text-sm font-medium">{step.subjectOrHook}</p>}
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{step.body}</p>
              {step.notes && <p className="mt-1 text-xs italic text-muted-foreground">Note: {step.notes}</p>}
            </>
          )}
        </div>
      ))}
      {canEdit && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={addStep} data-testid="button-add-step">
            <Plus className="mr-1 h-4 w-4" /> Add step
          </Button>
          <Button
            size="sm"
            onClick={() => save.mutate()}
            disabled={!dirty || save.isPending}
            data-testid="button-save-steps"
          >
            {save.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Save steps
          </Button>
          {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
        </div>
      )}
    </div>
  );
}

export default function OutreachView() {
  const { toast } = useToast();
  const { can } = usePermissions();
  const canCreate = can("studio.create_article");
  const canEdit = can("studio.edit_article");
  const { selectedProjectId } = useStudioProject();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", sequenceType: "linkedin", audienceType: "", campaignId: "" });

  const { data: sequences, isLoading } = useQuery<OutreachRow[]>({
    queryKey: ["/api/studio/outreach", { projectId: selectedProjectId }],
    queryFn: async () => {
      const res = await fetch(`/api/studio/outreach?projectId=${encodeURIComponent(selectedProjectId)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sequences");
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  const { data: campaigns } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/studio/campaigns", { projectId: selectedProjectId }],
    queryFn: async () => {
      const res = await fetch(`/api/studio/campaigns?projectId=${encodeURIComponent(selectedProjectId)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  const selected = sequences?.find((s) => s.id === selectedId) ?? null;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/studio/outreach"] });

  const create = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/studio/outreach", {
        projectId: selectedProjectId,
        name: form.name,
        sequenceType: form.sequenceType,
        audienceType: form.audienceType || null,
        campaignId: form.campaignId || null,
      }),
    onSuccess: async (res: any) => {
      const created = await res.json();
      invalidate();
      setCreateOpen(false);
      setForm({ name: "", sequenceType: "linkedin", audienceType: "", campaignId: "" });
      setSelectedId(created.id);
      toast({ title: "Sequence created", description: "Now generate the copy with AI or write it by hand." });
    },
    onError: (e: any) => toast({ title: "Failed to create sequence", description: e?.message, variant: "destructive" }),
  });

  const generate = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/studio/outreach/${id}/generate`, { stepCount: 4 }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Copy drafted", description: "Review each step, edit as needed, then approve." });
    },
    onError: (e: any) => toast({ title: "Generation failed", description: e?.message, variant: "destructive" }),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/studio/outreach/${id}`, { status }),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast({ title: "Failed to update", description: e?.message, variant: "destructive" }),
  });

  const copyStep = (step: StudioOutreachStep) => {
    const text = step.subjectOrHook ? `${step.subjectOrHook}\n\n${step.body}` : step.body;
    navigator.clipboard.writeText(text).then(
      () => toast({ title: "Copied to clipboard" }),
      () => toast({ title: "Copy failed", variant: "destructive" }),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Send className="h-5 w-5 text-primary" /> Outreach
          </h1>
          <p className="text-sm text-muted-foreground">
            Copy-only outreach sequences for LinkedIn and email. Nothing is sent from here —
            copy each step and send it yourself.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)} data-testid="button-new-sequence">
            <Plus className="mr-1 h-4 w-4" /> New sequence
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          {isLoading ? (
            [1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)
          ) : !sequences?.length ? (
            <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No sequences yet.</CardContent></Card>
          ) : (
            sequences.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`w-full rounded-md border p-3 text-left transition-colors ${
                  selectedId === s.id ? "border-primary bg-primary/5" : "hover:bg-muted"
                }`}
                data-testid={`button-sequence-${s.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{s.name}</span>
                  <Badge className={STATUS_BADGE[s.status] ?? ""}>{s.status}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {s.sequenceType} · {(s.stepsJsonb?.length ?? 0)} step(s)
                  {s.audienceType ? ` · ${s.audienceType}` : ""}
                </p>
              </button>
            ))
          )}
        </div>

        <div>
          {!selected ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Select a sequence to view its steps.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base" data-testid="text-sequence-name">{selected.name}</CardTitle>
                  <div className="flex gap-2">
                    {canCreate && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generate.mutate(selected.id)}
                        disabled={generate.isPending}
                        data-testid="button-generate-sequence"
                      >
                        {generate.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
                        {selected.stepsJsonb?.length ? "Regenerate copy" : "AI-draft copy"}
                      </Button>
                    )}
                    {canEdit && selected.status === "draft" && !!selected.stepsJsonb?.length && (
                      <Button
                        size="sm"
                        onClick={() => setStatus.mutate({ id: selected.id, status: "approved" })}
                        disabled={setStatus.isPending}
                        data-testid="button-approve-sequence"
                      >
                        Approve
                      </Button>
                    )}
                    {canEdit && selected.status !== "archived" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setStatus.mutate({ id: selected.id, status: "archived" })}
                        disabled={setStatus.isPending}
                        data-testid="button-archive-sequence"
                      >
                        Archive
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <StepsEditor
                  key={`${selected.id}-${JSON.stringify(selected.stepsJsonb ?? []).length}`}
                  sequence={selected}
                  canEdit={canEdit && selected.status !== "archived"}
                  onCopy={copyStep}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MailPlus className="h-4 w-4" /> New outreach sequence</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-sequence-name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="flex items-center gap-1.5">Type <FieldHelp id="outreach-sequence-type" /></Label>
                <Select value={form.sequenceType} onValueChange={(v) => setForm({ ...form, sequenceType: v })}>
                  <SelectTrigger data-testid="select-sequence-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="flex items-center gap-1.5">Audience <FieldHelp id="outreach-audience-type" /></Label>
                <Input placeholder="e.g. IT hiring managers" value={form.audienceType} onChange={(e) => setForm({ ...form, audienceType: e.target.value })} data-testid="input-sequence-audience" />
              </div>
            </div>
            <div>
              <Label>Campaign (optional)</Label>
              <Select value={form.campaignId || "none"} onValueChange={(v) => setForm({ ...form, campaignId: v === "none" ? "" : v })}>
                <SelectTrigger data-testid="select-sequence-campaign"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No campaign</SelectItem>
                  {campaigns?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={!form.name.trim() || create.isPending} data-testid="button-create-sequence">
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
