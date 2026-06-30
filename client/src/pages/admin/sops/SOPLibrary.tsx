import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ShieldCheck, History, Lock, Pencil, Plus, Search, FileText } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useSopAccess } from "@/hooks/use-sop-access";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SopDocument, SopRoleAssignment } from "@shared/schema";

const LIFECYCLE_LABELS: Record<string, string> = {
  draft: "Draft",
  in_review: "In Review",
  changes_requested: "Changes Requested",
  approved: "Approved",
  published: "Published",
  training_assigned: "Training Assigned",
  acknowledged: "Acknowledged",
  active: "Active",
  under_revision: "Under Revision",
  retired: "Retired",
};

const LOCKED_STATUSES = ["published", "active"];

function lifecycleVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "published" || status === "active") return "default";
  if (status === "retired" || status === "under_revision") return "secondary";
  if (status === "changes_requested") return "destructive";
  return "outline";
}

type SopDetail = SopDocument & { versions: SopDocument[]; roleAssignments: SopRoleAssignment[] };

export default function SOPLibrary() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { enabled, canManage, isLoading: accessLoading } = useSopAccess();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [waveFilter, setWaveFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editDoc, setEditDoc] = useState<SopDocument | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  const { data: sops, isLoading } = useQuery<SopDocument[]>({
    queryKey: ["/api/sops"],
    enabled: enabled,
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    (sops ?? []).forEach((s) => set.add(s.category));
    return Array.from(set).sort();
  }, [sops]);

  const waves = useMemo(() => {
    const set = new Set<number>();
    (sops ?? []).forEach((s) => set.add(s.launchWave));
    return Array.from(set).sort((a, b) => a - b);
  }, [sops]);

  const filtered = useMemo(() => {
    return (sops ?? []).filter((s) => {
      if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
      if (waveFilter !== "all" && String(s.launchWave) !== waveFilter) return false;
      if (statusFilter !== "all" && s.lifecycleStatus !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!s.title.toLowerCase().includes(q) && !s.code.toLowerCase().includes(q) && !s.owner.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [sops, categoryFilter, waveFilter, statusFilter, search]);

  if (authLoading || !isAuthenticated || accessLoading) {
    return (
      <AdminLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AdminLayout>
    );
  }

  if (!enabled) {
    return (
      <AdminLayout>
        <div className="p-10 text-center" data-testid="sop-no-access">
          <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h2 className="text-lg font-semibold">Process Governance Center</h2>
          <p className="text-muted-foreground text-sm mt-1 max-w-md mx-auto">
            This feature is not enabled for your account yet. Contact an administrator if you believe you should have access.
          </p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-sop-title">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Process Governance Center
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              The Standard Operating Procedure library. Published SOPs are version-locked; edits create a new draft version.
            </p>
          </div>
          {canManage && (
            <Button onClick={() => setEditDoc({} as SopDocument)} data-testid="button-new-sop">
              <Plus className="h-4 w-4 mr-1" /> New SOP
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="relative md:col-span-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search code, title, owner"
                  className="pl-8"
                  data-testid="input-sop-search"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger data-testid="select-sop-category"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={waveFilter} onValueChange={setWaveFilter}>
                <SelectTrigger data-testid="select-sop-wave"><SelectValue placeholder="Launch wave" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All waves</SelectItem>
                  {waves.map((w) => <SelectItem key={w} value={String(w)}>Wave {w}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-sop-status"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {Object.entries(LIFECYCLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground" data-testid="sop-empty">
            <FileText className="h-8 w-8 mx-auto mb-2" />
            No SOPs match your filters.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((sop) => {
              const locked = LOCKED_STATUSES.includes(sop.lifecycleStatus);
              return (
                <Card key={sop.id} className="flex flex-col" data-testid={`card-sop-${sop.code}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" data-testid={`text-sop-code-${sop.code}`}>{sop.code}</Badge>
                      <Badge variant={lifecycleVariant(sop.lifecycleStatus)} data-testid={`badge-sop-status-${sop.code}`}>
                        {locked && <Lock className="h-3 w-3 mr-1" />}
                        {LIFECYCLE_LABELS[sop.lifecycleStatus] ?? sop.lifecycleStatus}
                      </Badge>
                    </div>
                    <CardTitle className="text-sm leading-snug mt-1">{sop.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col gap-2 text-xs text-muted-foreground">
                    <p className="line-clamp-2">{sop.summary}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-auto pt-2">
                      <span><span className="font-medium text-foreground">Owner:</span> {sop.owner}</span>
                      <span><span className="font-medium text-foreground">Category:</span> {sop.category}</span>
                      <span><span className="font-medium text-foreground">Wave:</span> {sop.launchWave}</span>
                      <span><span className="font-medium text-foreground">v{sop.version}</span></span>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => setDetailId(sop.id)} data-testid={`button-view-sop-${sop.code}`}>
                        <History className="h-3.5 w-3.5 mr-1" /> Details
                      </Button>
                      {canManage && (
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditDoc(sop)} data-testid={`button-edit-sop-${sop.code}`}>
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {detailId && <SopDetailDialog id={detailId} onClose={() => setDetailId(null)} />}
      {editDoc && (
        <SopEditDialog
          doc={editDoc.id ? editDoc : null}
          onClose={() => setEditDoc(null)}
          onSaved={(clonedNewVersion) => {
            setEditDoc(null);
            queryClient.invalidateQueries({ queryKey: ["/api/sops"] });
            toast({
              title: clonedNewVersion ? "New draft version created" : "SOP saved",
              description: clonedNewVersion
                ? "The published version was locked; your edits started a new draft version."
                : undefined,
            });
          }}
        />
      )}
    </AdminLayout>
  );
}

function SopDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading } = useQuery<SopDetail>({
    queryKey: ["/api/sops", id],
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-sop-detail">
        <DialogHeader>
          <DialogTitle>{isLoading ? "Loading..." : `${data?.code} — ${data?.title}`}</DialogTitle>
        </DialogHeader>
        {isLoading || !data ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">{data.summary}</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <Field label="Owner" value={data.owner} />
              <Field label="Approver" value={data.approver} />
              <Field label="Category" value={data.category} />
              <Field label="Launch wave" value={String(data.launchWave)} />
              <Field label="Review cycle" value={data.reviewCycle} />
              <Field label="Confidentiality" value={data.confidentiality} />
              <Field label="Frequency" value={data.frequency} />
              <Field label="Target" value={data.target} />
              <Field label="AI assist allowed" value={data.aiAssistAllowed ? "Yes" : "No"} />
              <Field label="Human sign-off required" value={data.humanSignoffRequired ? "Yes" : "No"} />
            </div>
            {data.kpiDescription && <Field label="KPI" value={data.kpiDescription} />}
            {data.evidenceDescription && <Field label="Evidence" value={data.evidenceDescription} />}
            {data.audienceRoles && data.audienceRoles.length > 0 && (
              <div>
                <p className="font-medium mb-1">Audience roles</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.audienceRoles.map((r) => <Badge key={r} variant="secondary" className="capitalize">{r.replace("_", " ")}</Badge>)}
                </div>
              </div>
            )}

            {data.roleAssignments.length > 0 && (
              <div>
                <p className="font-medium mb-1">Role assignments</p>
                <div className="space-y-2">
                  {data.roleAssignments.map((ra) => (
                    <div key={ra.id} className="rounded border p-2 text-xs" data-testid={`row-role-assignment-${ra.role}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">{ra.role.replace("_", " ")}</span>
                        {ra.quizRequired && <Badge variant="outline" className="text-[10px]">Quiz required</Badge>}
                      </div>
                      {ra.trainingType && <p className="text-muted-foreground mt-0.5">Training: {ra.trainingType}</p>}
                      {ra.target && <p className="text-muted-foreground">Target: {ra.target}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="font-medium mb-1 flex items-center gap-1"><History className="h-3.5 w-3.5" /> Version history</p>
              <div className="space-y-1">
                {data.versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between rounded border px-2 py-1 text-xs" data-testid={`row-version-${v.version}`}>
                    <span>v{v.version}{v.isCurrent && <Badge variant="default" className="ml-2 text-[10px]">Current</Badge>}</span>
                    <Badge variant={lifecycleVariant(v.lifecycleStatus)} className="text-[10px]">
                      {LIFECYCLE_LABELS[v.lifecycleStatus] ?? v.lifecycleStatus}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p>{value}</p>
    </div>
  );
}

function SopEditDialog({ doc, onClose, onSaved }: { doc: SopDocument | null; onClose: () => void; onSaved: (clonedNewVersion: boolean) => void }) {
  const { toast } = useToast();
  const isNew = !doc;
  const locked = doc ? LOCKED_STATUSES.includes(doc.lifecycleStatus) : false;

  const [form, setForm] = useState({
    code: doc?.code ?? "",
    title: doc?.title ?? "",
    category: doc?.category ?? "",
    owner: doc?.owner ?? "",
    approver: doc?.approver ?? "",
    summary: doc?.summary ?? "",
    launchWave: doc?.launchWave ?? 0,
    aiAssistAllowed: doc?.aiAssistAllowed ?? false,
    humanSignoffRequired: doc?.humanSignoffRequired ?? true,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (isNew) {
        const res = await apiRequest("POST", "/api/sops", {
          ...form,
          sopMasterId: form.code,
          launchWave: Number(form.launchWave),
        });
        return res.json();
      }
      const res = await apiRequest("PATCH", `/api/sops/${doc!.id}`, {
        title: form.title,
        category: form.category,
        owner: form.owner,
        approver: form.approver,
        summary: form.summary,
        launchWave: Number(form.launchWave),
        aiAssistAllowed: form.aiAssistAllowed,
        humanSignoffRequired: form.humanSignoffRequired,
      });
      return res.json();
    },
    onSuccess: (data: { clonedNewVersion?: boolean }) => {
      onSaved(Boolean(data?.clonedNewVersion));
    },
    onError: () => toast({ title: "Failed to save SOP", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" data-testid="dialog-sop-edit">
        <DialogHeader>
          <DialogTitle>{isNew ? "New SOP" : `Edit ${doc?.code}`}</DialogTitle>
        </DialogHeader>

        {locked && (
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs flex items-start gap-2" data-testid="notice-version-lock">
            <Lock className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
            <span>This version is <strong>published and locked</strong>. Saving will create a new draft version (v{(doc!.version) + 1}); the current version stays intact until the new one is published.</span>
          </div>
        )}

        <div className="space-y-3">
          {isNew && (
            <div className="space-y-1.5">
              <Label className="text-xs">Code</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. OPS-002" data-testid="input-sop-code" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="input-sop-title-field" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} data-testid="input-sop-category-field" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Launch wave</Label>
              <Input type="number" value={form.launchWave} onChange={(e) => setForm({ ...form, launchWave: Number(e.target.value) })} data-testid="input-sop-wave-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Owner</Label>
              <Input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} data-testid="input-sop-owner-field" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Approver</Label>
              <Input value={form.approver} onChange={(e) => setForm({ ...form, approver: e.target.value })} data-testid="input-sop-approver-field" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Summary</Label>
            <Textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} rows={3} data-testid="textarea-sop-summary" />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">AI assist allowed</Label>
            <Switch checked={form.aiAssistAllowed} onCheckedChange={(v) => setForm({ ...form, aiAssistAllowed: v })} data-testid="switch-sop-ai-assist" />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Human sign-off required</Label>
            <Switch checked={form.humanSignoffRequired} onCheckedChange={(v) => setForm({ ...form, humanSignoffRequired: v })} data-testid="switch-sop-human-signoff" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-sop">Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.title || (isNew && !form.code) || !form.category || !form.owner}
            data-testid="button-save-sop"
          >
            {mutation.isPending ? "Saving..." : locked ? "Save as new version" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
