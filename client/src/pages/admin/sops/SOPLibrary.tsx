import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ShieldCheck, History, Lock, Pencil, Plus, Search, FileText, Clock, AlertTriangle, MessageSquare, Users, CheckCircle2, Send, Link2, Archive, ThumbsUp, Layers, Zap, Play, Target } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useSopAccess } from "@/hooks/use-sop-access";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SopDocument, SopRoleAssignment, SopReviewAssignment, SopComment, SopAuditRecord, SopAuditFinding } from "@shared/schema";

const MANAGE_SUBMIT_STATUSES = ["draft", "changes_requested", "under_revision"];
const REVIEW_ACTIONS: { action: string; label: string }[] = [
  { action: "approve", label: "Approve" },
  { action: "approve_with_comments", label: "Approve w/ comments" },
  { action: "request_changes", label: "Request changes" },
  { action: "reject", label: "Reject" },
];

type ReviewRow = SopReviewAssignment & { reviewerName: string; overdue: boolean };
type ReviewGate = { strictApprove: boolean; noObjectionEligible: boolean; hasBlocking: boolean; pendingCount: number; overdueCount: number };
type CommentRow = SopComment & { authorName: string };
type ProgressRow = {
  userId: string;
  name: string;
  role: string | null;
  departmentId: string | null;
  trainingCompletedAt: string | null;
  acknowledgedAt: string | null;
  acknowledgedVersion: number | null;
};

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
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { enabled, canManage, isLoading: accessLoading } = useSopAccess();
  const { toast } = useToast();

  // Wave rollout management is restricted to super_admin/admin (matches the
  // sops.rollout permission gating the wave endpoints).
  const canManageRollout = ["super_admin", "admin"].includes(user?.role || "");
  const [view, setView] = useState<"library" | "rollout">("library");

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
          <div className="flex items-center gap-2">
            {canManageRollout && (
              <div className="inline-flex rounded-md border bg-muted/40 p-0.5" data-testid="sop-view-toggle">
                <Button
                  size="sm"
                  variant={view === "library" ? "default" : "ghost"}
                  className="h-8"
                  onClick={() => setView("library")}
                  data-testid="button-view-library"
                >
                  <FileText className="h-3.5 w-3.5 mr-1" /> Library
                </Button>
                <Button
                  size="sm"
                  variant={view === "rollout" ? "default" : "ghost"}
                  className="h-8"
                  onClick={() => setView("rollout")}
                  data-testid="button-view-rollout"
                >
                  <Layers className="h-3.5 w-3.5 mr-1" /> Rollout
                </Button>
              </div>
            )}
            {canManage && view === "library" && (
              <Button onClick={() => setEditDoc({} as SopDocument)} data-testid="button-new-sop">
                <Plus className="h-4 w-4 mr-1" /> New SOP
              </Button>
            )}
          </div>
        </div>

        {view === "rollout" && canManageRollout ? (
          <RolloutView />
        ) : (
        <>
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
        </>
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
  const { user } = useAuth();
  const { canManage } = useSopAccess();
  const { toast } = useToast();
  const [tab, setTab] = useState("overview");
  const [reviewerPickerOpen, setReviewerPickerOpen] = useState(false);
  const [ackOpen, setAckOpen] = useState(false);

  const { data, isLoading } = useQuery<SopDetail>({ queryKey: ["/api/sops", id] });
  const { data: reviewData } = useQuery<{ reviews: ReviewRow[]; gate: ReviewGate }>({ queryKey: ["/api/sops", id, "reviews"] });

  const isOverride = user?.role === "super_admin" || user?.role === "admin";
  const status = data?.lifecycleStatus ?? "";
  const reviews = reviewData?.reviews ?? [];
  const gate = reviewData?.gate;
  const myPendingReview = reviews.find((r) => r.reviewerId === user?.id && r.status === "pending");

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/sops"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sops", id] });
    queryClient.invalidateQueries({ queryKey: ["/api/sops", id, "reviews"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sops", id, "progress"] });
  };

  const publishMut = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/sops/${id}/publish`, {})).json(),
    onSuccess: (res: { training?: { assignedCount: number; skippedOutOfRollout: number } }) => {
      refresh();
      toast({ title: "SOP published", description: res?.training ? `${res.training.assignedCount} trainee(s) assigned, ${res.training.skippedOutOfRollout} outside rollout.` : undefined });
    },
    onError: (e: any) => toast({ title: "Publish failed", description: e?.message, variant: "destructive" }),
  });

  const retireMut = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/sops/${id}/retire`, {})).json(),
    onSuccess: () => { refresh(); toast({ title: "SOP retired" }); },
    onError: (e: any) => toast({ title: "Retire failed", description: e?.message, variant: "destructive" }),
  });

  const reviewActionMut = useMutation({
    mutationFn: async (vars: { action: string; comment?: string }) =>
      (await apiRequest("POST", `/api/sops/${id}/review-action`, vars)).json(),
    onSuccess: () => { refresh(); queryClient.invalidateQueries({ queryKey: ["/api/sops", id, "comments"] }); toast({ title: "Review recorded" }); },
    onError: (e: any) => toast({ title: "Action failed", description: e?.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-sop-detail">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {isLoading ? "Loading..." : `${data?.code} — ${data?.title}`}
            {data && (
              <Badge variant={lifecycleVariant(status)} data-testid="badge-detail-status">
                {LIFECYCLE_LABELS[status] ?? status}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        {isLoading || !data ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            {/* Action bar */}
            <div className="flex flex-wrap gap-2 border-b pb-3" data-testid="sop-action-bar">
              {canManage && MANAGE_SUBMIT_STATUSES.includes(status) && (
                <Button size="sm" onClick={() => setReviewerPickerOpen(true)} data-testid="button-submit-review">
                  <Send className="h-3.5 w-3.5 mr-1" /> Submit for Review
                </Button>
              )}
              {status === "in_review" && myPendingReview && (
                <ReviewActionButtons onAct={(action, comment) => reviewActionMut.mutate({ action, comment })} pending={reviewActionMut.isPending} />
              )}
              {canManage && status === "approved" && (
                <Button size="sm" onClick={() => publishMut.mutate()} disabled={publishMut.isPending} data-testid="button-publish-sop">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {publishMut.isPending ? "Publishing..." : "Publish"}
                </Button>
              )}
              {isOverride && status === "in_review" && (gate?.strictApprove || gate?.noObjectionEligible) && !gate?.hasBlocking && (
                <Button size="sm" variant="secondary" onClick={() => publishMut.mutate()} disabled={publishMut.isPending} data-testid="button-publish-no-objection">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Publish (no-objection)
                </Button>
              )}
              {["published", "training_assigned", "acknowledged", "active"].includes(status) && (
                <Button size="sm" variant="outline" onClick={() => setAckOpen(true)} data-testid="button-acknowledge-sop">
                  <ThumbsUp className="h-3.5 w-3.5 mr-1" /> Acknowledge
                </Button>
              )}
              {canManage && ["active", "under_revision"].includes(status) && (
                <Button size="sm" variant="outline" onClick={() => retireMut.mutate()} disabled={retireMut.isPending} data-testid="button-retire-sop">
                  <Archive className="h-3.5 w-3.5 mr-1" /> Retire
                </Button>
              )}
            </div>

            <Tabs value={tab} onValueChange={setTab} className="mt-2">
              <TabsList className="grid grid-cols-5 w-full">
                <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                <TabsTrigger value="reviewers" data-testid="tab-reviewers">Reviewers</TabsTrigger>
                <TabsTrigger value="comments" data-testid="tab-comments">Comments</TabsTrigger>
                <TabsTrigger value="progress" data-testid="tab-progress">Team Progress</TabsTrigger>
                <TabsTrigger value="audit" data-testid="tab-audit">Audit &amp; Findings</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 text-sm mt-3">
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
                <LinkedGoalsPanel sopId={id} />
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
                <LinkTrackPanel sop={data} canManage={canManage} onSaved={refresh} />
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
              </TabsContent>

              <TabsContent value="reviewers" className="mt-3">
                <ReviewersTab reviews={reviews} gate={gate} />
              </TabsContent>

              <TabsContent value="comments" className="mt-3">
                <CommentsTab sopId={id} />
              </TabsContent>

              <TabsContent value="progress" className="mt-3">
                <ProgressTab sopId={id} version={data.version} />
              </TabsContent>

              <TabsContent value="audit" className="mt-3">
                <AuditFindingsTab sopId={id} canManage={canManage} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>

      {reviewerPickerOpen && (
        <ReviewerPickerDialog sopId={id} onClose={() => setReviewerPickerOpen(false)} onSubmitted={() => { setReviewerPickerOpen(false); refresh(); }} />
      )}
      {ackOpen && data && (
        <AcknowledgeDialog sopId={id} sop={data} onClose={() => setAckOpen(false)} onDone={() => { setAckOpen(false); refresh(); }} />
      )}
    </Dialog>
  );
}

function ReviewActionButtons({ onAct, pending }: { onAct: (action: string, comment?: string) => void; pending: boolean }) {
  const [comment, setComment] = useState("");
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex flex-wrap gap-2">
        {REVIEW_ACTIONS.map((a) => (
          <Button
            key={a.action}
            size="sm"
            variant={a.action === "reject" || a.action === "request_changes" ? "destructive" : "default"}
            disabled={pending}
            onClick={() => onAct(a.action, comment.trim() || undefined)}
            data-testid={`button-review-${a.action}`}
          >
            {a.label}
          </Button>
        ))}
      </div>
      <Input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Comment (required for changes/reject/approve-with-comments)"
        className="text-xs"
        data-testid="input-review-comment"
      />
    </div>
  );
}

function ReviewersTab({ reviews, gate }: { reviews: ReviewRow[]; gate?: ReviewGate }) {
  if (reviews.length === 0) {
    return <p className="text-sm text-muted-foreground" data-testid="text-no-reviewers">No reviewers assigned for this version yet.</p>;
  }
  return (
    <div className="space-y-3 text-sm">
      {gate && (
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant={gate.strictApprove ? "default" : "outline"}>{gate.strictApprove ? "Approval gate: clear" : gate.noObjectionEligible ? "Approval gate: no-objection (override)" : "Approval gate: pending"}</Badge>
          {gate.hasBlocking && <Badge variant="destructive">Changes requested</Badge>}
          {gate.overdueCount > 0 && <Badge variant="secondary">{gate.overdueCount} overdue</Badge>}
        </div>
      )}
      <div className="space-y-2">
        {reviews.map((r) => {
          const due = r.dueAt ? new Date(r.dueAt) : null;
          const daysLeft = due ? Math.ceil((due.getTime() - Date.now()) / 86400000) : null;
          return (
            <div key={r.id} className="rounded border p-2.5" data-testid={`row-reviewer-${r.reviewerId}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{r.reviewerName}</span>
                <Badge variant={r.status === "pending" ? (r.overdue ? "destructive" : "outline") : r.status === "changes_requested" || r.status === "rejected" ? "destructive" : "default"}>
                  {r.status.replace(/_/g, " ")}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                {r.status === "pending" && due && (
                  r.overdue ? (
                    <span className="flex items-center gap-1 text-destructive" data-testid={`text-overdue-${r.reviewerId}`}>
                      <AlertTriangle className="h-3 w-3" /> Overdue (due {due.toLocaleDateString()})
                    </span>
                  ) : (
                    <span className="flex items-center gap-1" data-testid={`text-sla-${r.reviewerId}`}>
                      <Clock className="h-3 w-3" /> {daysLeft} day{daysLeft === 1 ? "" : "s"} left (due {due.toLocaleDateString()})
                    </span>
                  )
                )}
                {r.decisionAt && <span>Decided {new Date(r.decisionAt).toLocaleDateString()}</span>}
              </div>
              {r.comment && <p className="text-xs mt-1.5 border-l-2 pl-2 italic">{r.comment}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CommentsTab({ sopId }: { sopId: string }) {
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const { data: comments, isLoading } = useQuery<CommentRow[]>({ queryKey: ["/api/sops", sopId, "comments"] });

  const addMut = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/sops/${sopId}/comments`, { body })).json(),
    onSuccess: () => { setBody(""); queryClient.invalidateQueries({ queryKey: ["/api/sops", sopId, "comments"] }); },
    onError: (e: any) => toast({ title: "Failed to add comment", description: e?.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-3 text-sm">
      <div className="flex gap-2">
        <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a comment" data-testid="input-comment-body" />
        <Button size="sm" disabled={!body.trim() || addMut.isPending} onClick={() => addMut.mutate()} data-testid="button-add-comment">
          <MessageSquare className="h-3.5 w-3.5 mr-1" /> Post
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : (comments ?? []).length === 0 ? (
        <p className="text-muted-foreground text-xs" data-testid="text-no-comments">No comments yet.</p>
      ) : (
        <div className="space-y-2">
          {(comments ?? []).map((c) => (
            <div key={c.id} className="rounded border p-2 text-xs" data-testid={`row-comment-${c.id}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium">{c.authorName}</span>
                <span className="text-muted-foreground">{c.createdAt ? new Date(c.createdAt).toLocaleString() : ""}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProgressTab({ sopId, version }: { sopId: string; version: number }) {
  const [roleFilter, setRoleFilter] = useState("all");
  const { data: rows, isLoading } = useQuery<ProgressRow[]>({ queryKey: ["/api/sops", sopId, "progress"] });
  const { toast } = useToast();

  const syncMut = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/sops/assignments/sync`, {})).json(),
    onSuccess: (res: { created: number }) => { queryClient.invalidateQueries({ queryKey: ["/api/sops", sopId, "progress"] }); toast({ title: "Synced", description: `${res?.created ?? 0} new assignment(s).` }); },
    onError: (e: any) => toast({ title: "Sync failed", description: e?.message, variant: "destructive" }),
  });

  const roles = useMemo(() => Array.from(new Set((rows ?? []).map((r) => r.role).filter(Boolean) as string[])).sort(), [rows]);
  const filtered = (rows ?? []).filter((r) => roleFilter === "all" || r.role === roleFilter);

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-48" data-testid="select-progress-role"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {roles.map((r) => <SelectItem key={r} value={r} className="capitalize">{r.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => syncMut.mutate()} disabled={syncMut.isPending} data-testid="button-sync-assignments">
          <Users className="h-3.5 w-3.5 mr-1" /> Sync
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-xs" data-testid="text-no-progress">No impacted employees yet. Link a track and publish, or run Sync.</p>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((r) => (
            <div key={r.userId} className="flex items-center justify-between rounded border px-2.5 py-1.5 text-xs" data-testid={`row-progress-${r.userId}`}>
              <div>
                <span className="font-medium">{r.name}</span>
                {r.role && <span className="text-muted-foreground capitalize ml-2">{r.role.replace(/_/g, " ")}</span>}
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant={r.trainingCompletedAt ? "default" : "outline"} className="text-[10px]">
                  {r.trainingCompletedAt ? "Trained" : "Training pending"}
                </Badge>
                {r.acknowledgedAt ? (
                  <Badge variant="default" className="text-[10px]" data-testid={`badge-ack-${r.userId}`}>Ack v{r.acknowledgedVersion} · {new Date(r.acknowledgedAt).toLocaleDateString()}</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">Not acknowledged</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type AuditRecordRow = SopAuditRecord & { auditorName: string | null };
type FindingRow = SopAuditFinding & { raisedByName: string | null; ownerName: string | null };
type AuditTabData = { canAudit: boolean; records: AuditRecordRow[]; findings: FindingRow[] };

const FINDING_STATUS_OPTIONS = ["open", "in_progress", "resolved", "closed"];
function findingStatusVariant(s: string): "default" | "secondary" | "outline" | "destructive" {
  if (s === "resolved" || s === "closed") return "default";
  if (s === "open") return "destructive";
  if (s === "in_progress") return "secondary";
  return "outline";
}

function AuditFindingsTab({ sopId, canManage }: { sopId: string; canManage: boolean }) {
  const { toast } = useToast();
  const { user } = useAuth();
  // Managers raise findings, but resolving corrective actions is HR/Ops (+ admin) only.
  const canResolveFindings = ["super_admin", "admin", "hr", "operations"].includes((user as any)?.role ?? "");
  const [findingDesc, setFindingDesc] = useState("");
  const [findingAction, setFindingAction] = useState("");
  const [findingDue, setFindingDue] = useState("");
  const [findingOwner, setFindingOwner] = useState("none");
  const { data, isLoading } = useQuery<AuditTabData>({ queryKey: ["/api/sops", sopId, "audits"] });
  const { data: usersResp } = useQuery<{ users: { id: string; firstName: string | null; lastName: string | null; email: string }[] }>({ queryKey: ["/api/admin/users"], enabled: canManage });
  const owners = usersResp?.users ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/sops", sopId, "audits"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sops/audits/pending"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sops/compliance/summary"] });
  };

  const raiseFinding = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", `/api/sops/${sopId}/findings`, {
        description: findingDesc.trim(),
        correctiveAction: findingAction.trim() || null,
        dueDate: findingDue || null,
        ownerId: findingOwner === "none" ? null : findingOwner,
      })).json(),
    onSuccess: () => { invalidate(); setFindingDesc(""); setFindingAction(""); setFindingDue(""); setFindingOwner("none"); toast({ title: "Finding raised" }); },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const updateFinding = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      (await apiRequest("PATCH", `/api/sops/findings/${id}`, { status })).json(),
    onSuccess: () => { invalidate(); toast({ title: "Finding updated" }); },
    onError: (e: any) => toast({ title: "Update failed", description: e?.message, variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  const records = data?.records ?? [];
  const findings = data?.findings ?? [];

  return (
    <div className="space-y-5 text-sm">
      <div>
        <p className="font-medium mb-1.5 flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Audit history</p>
        {records.length === 0 ? (
          <p className="text-muted-foreground text-xs" data-testid="text-no-audits">No audits recorded yet.</p>
        ) : (
          <div className="space-y-1.5">
            {records.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded border px-2.5 py-1.5 text-xs" data-testid={`row-audit-record-${r.id}`}>
                <div>
                  <span className="font-medium">{r.weekDate ?? new Date(r.createdAt as any).toLocaleDateString()}</span>
                  {r.auditorName && <span className="text-muted-foreground ml-2">by {r.auditorName}</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant={r.evidenceCollected ? "default" : "outline"} className="text-[10px]">{r.evidenceCollected ? "Evidence ✓" : "No evidence"}</Badge>
                  {r.missesCount > 0 && <Badge variant="destructive" className="text-[10px]">{r.missesCount} miss</Badge>}
                  {r.auditScore != null && <Badge variant="secondary" className="text-[10px]">Score {r.auditScore}</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t pt-4">
        <p className="font-medium mb-1.5 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Findings</p>
        {findings.length === 0 ? (
          <p className="text-muted-foreground text-xs" data-testid="text-no-findings">No findings raised.</p>
        ) : (
          <div className="space-y-2">
            {findings.map((f) => (
              <div key={f.id} className="rounded border p-2.5 text-xs space-y-1" data-testid={`row-finding-${f.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{f.description}</p>
                  <Badge variant={findingStatusVariant(f.status)} className="text-[10px] shrink-0 capitalize">{f.status.replace("_", " ")}</Badge>
                </div>
                {f.correctiveAction && <p className="text-muted-foreground">Action: {f.correctiveAction}</p>}
                <div className="flex items-center gap-3 text-muted-foreground">
                  {f.raisedByName && <span>Raised by {f.raisedByName}</span>}
                  {f.dueDate && <span>Due {f.dueDate}</span>}
                  {f.ownerName && <span>Owner {f.ownerName}</span>}
                </div>
                {canResolveFindings && f.status !== "resolved" && f.status !== "closed" && (
                  <div className="flex items-center gap-2 pt-1">
                    <Select value={f.status} onValueChange={(v) => updateFinding.mutate({ id: f.id, status: v })}>
                      <SelectTrigger className="h-7 w-36 text-xs" data-testid={`select-finding-status-${f.id}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FINDING_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace("_", " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {canManage && (
        <div className="border-t pt-4 space-y-2">
          <p className="font-medium text-xs">Raise a new finding</p>
          <Textarea value={findingDesc} onChange={(e) => setFindingDesc(e.target.value)} rows={2} placeholder="Describe the gap or issue" data-testid="input-detail-finding-description" />
          <Textarea value={findingAction} onChange={(e) => setFindingAction(e.target.value)} rows={2} placeholder="Corrective action (optional)" data-testid="input-detail-finding-action" />
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={findingOwner} onValueChange={setFindingOwner}>
              <SelectTrigger className="w-52" data-testid="select-detail-finding-owner"><SelectValue placeholder="Owner (optional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {owners.map((u) => <SelectItem key={u.id} value={u.id}>{`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={findingDue} onChange={(e) => setFindingDue(e.target.value)} className="w-44" data-testid="input-detail-finding-due" />
            <Button size="sm" variant="outline" disabled={!findingDesc.trim() || raiseFinding.isPending} onClick={() => raiseFinding.mutate()} data-testid="button-detail-raise-finding">
              {raiseFinding.isPending ? "Saving..." : "Raise Finding"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function LinkTrackPanel({ sop, canManage, onSaved }: { sop: SopDetail; canManage: boolean; onSaved: () => void }) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<string>(sop.learningTrackId ?? "none");
  const { data: tracks } = useQuery<any[]>({ queryKey: ["/api/onboarding/tracks"], enabled: canManage });

  const linkMut = useMutation({
    mutationFn: async () => (await apiRequest("PATCH", `/api/sops/${sop.id}/learning-track`, { learningTrackId: selected === "none" ? null : selected })).json(),
    onSuccess: () => { onSaved(); toast({ title: "Training track updated" }); },
    onError: (e: any) => toast({ title: "Failed to link track", description: e?.message, variant: "destructive" }),
  });

  if (!canManage) {
    const t = (tracks ?? []).find((x) => x.id === sop.learningTrackId);
    return sop.learningTrackId ? <Field label="Linked training track" value={t?.title ?? sop.learningTrackId} /> : null;
  }

  return (
    <div className="rounded border p-2.5 space-y-2" data-testid="panel-link-track">
      <p className="font-medium text-xs flex items-center gap-1"><Link2 className="h-3.5 w-3.5" /> Linked training track</p>
      <div className="flex gap-2">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="flex-1" data-testid="select-link-track"><SelectValue placeholder="Select a track" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {(tracks ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" disabled={linkMut.isPending || selected === (sop.learningTrackId ?? "none")} onClick={() => linkMut.mutate()} data-testid="button-save-track">
          Save
        </Button>
      </div>
    </div>
  );
}

function ReviewerPickerDialog({ sopId, onClose, onSubmitted }: { sopId: string; onClose: () => void; onSubmitted: () => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const { data: usersResp, isLoading } = useQuery<{ users: { id: string; firstName: string; lastName: string; email: string; role: string }[] }>({
    queryKey: ["/api/admin/users", "active"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/users?status=active")).json(),
  });

  const eligible = (usersResp?.users ?? []).filter((u) => u.id !== user?.id && ["super_admin", "admin", "hr", "operations", "manager"].includes(u.role));

  const submitMut = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/sops/${sopId}/submit-review`, { reviewerIds: selected })).json(),
    onSuccess: () => { toast({ title: "Submitted for review" }); onSubmitted(); },
    onError: (e: any) => toast({ title: "Failed to submit", description: e?.message, variant: "destructive" }),
  });

  const toggle = (id: string) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="dialog-reviewer-picker">
        <DialogHeader>
          <DialogTitle>Assign reviewers</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">Reviewers get a 5 business-day SLA to respond.</p>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="max-h-72 overflow-y-auto space-y-1.5">
            {eligible.map((u) => (
              <label key={u.id} className="flex items-center gap-2 rounded border p-2 text-sm cursor-pointer" data-testid={`option-reviewer-${u.id}`}>
                <Checkbox checked={selected.includes(u.id)} onCheckedChange={() => toggle(u.id)} />
                <span className="flex-1">{u.firstName} {u.lastName} <span className="text-muted-foreground capitalize">· {u.role.replace(/_/g, " ")}</span></span>
              </label>
            ))}
            {eligible.length === 0 && <p className="text-xs text-muted-foreground">No eligible reviewers found.</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-reviewers">Cancel</Button>
          <Button disabled={selected.length === 0 || submitMut.isPending} onClick={() => submitMut.mutate()} data-testid="button-confirm-reviewers">
            {submitMut.isPending ? "Submitting..." : `Submit (${selected.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AcknowledgeDialog({ sopId, sop, onClose, onDone }: { sopId: string; sop: SopDetail; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [typedName, setTypedName] = useState("");
  const ackMut = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/sops/${sopId}/acknowledge`, { typedName })).json(),
    onSuccess: (res: { refNumber: string }) => { toast({ title: "SOP acknowledged", description: `Reference: ${res?.refNumber ?? ""}` }); onDone(); },
    onError: (e: any) => toast({ title: "Cannot acknowledge", description: e?.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="dialog-acknowledge">
        <DialogHeader>
          <DialogTitle>Acknowledge {sop.code} v{sop.version}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          By typing your name you confirm you have read, understood, and will follow this SOP version. This is recorded in the signature ledger.
        </p>
        <div className="space-y-1.5">
          <Label className="text-xs">Type your full name</Label>
          <Input value={typedName} onChange={(e) => setTypedName(e.target.value)} placeholder="Your full name" data-testid="input-ack-name" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-ack">Cancel</Button>
          <Button disabled={!typedName.trim() || ackMut.isPending} onClick={() => ackMut.mutate()} data-testid="button-confirm-ack">
            {ackMut.isPending ? "Recording..." : "Acknowledge"}
          </Button>
        </DialogFooter>
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

interface LinkedGoal {
  id: string;
  title: string;
  assigneeName: string;
  assigneeRole: string | null;
  progress: number;
  status: string;
  targetDate: string | null;
  category: string;
}

function LinkedGoalsPanel({ sopId }: { sopId: string }) {
  const { data: goals, isLoading } = useQuery<LinkedGoal[]>({ queryKey: ["/api/sops", sopId, "goals"] });

  if (isLoading) return null;
  if (!goals || goals.length === 0) return null;

  const avg = Math.round(goals.reduce((sum, g) => sum + (g.progress ?? 0), 0) / goals.length);

  return (
    <div data-testid="panel-linked-goals">
      <p className="font-medium mb-1 flex items-center gap-1">
        <Target className="h-3.5 w-3.5" /> KPIs Tracked
        <Badge variant="secondary" className="ml-1 text-[10px]">{goals.length} goal{goals.length === 1 ? "" : "s"} · {avg}% avg</Badge>
      </p>
      <div className="space-y-1.5">
        {goals.map((g) => (
          <div key={g.id} className="rounded border px-2 py-1.5 text-xs" data-testid={`row-linked-goal-${g.id}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium truncate">{g.title}</span>
              <span className="text-muted-foreground shrink-0">{g.progress}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded bg-muted overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, g.progress))}%` }} />
            </div>
            <div className="mt-1 flex items-center justify-between text-muted-foreground">
              <span className="truncate">{g.assigneeName}{g.assigneeRole ? ` · ${g.assigneeRole.replace(/_/g, " ")}` : ""}</span>
              <Badge variant="outline" className="text-[10px] capitalize shrink-0">{g.status.replace(/_/g, " ")}</Badge>
            </div>
          </div>
        ))}
      </div>
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

// ── Wave Rollout management (Task #662) ──────────────────────────────────────

interface WaveSopRow {
  sopMasterId: string;
  code: string;
  title: string | null;
  category: string | null;
  lifecycleStatus: string | null;
  operational: boolean;
  operationalAt: string | null;
}
interface WaveView {
  waveNumber: number;
  name: string;
  description: string | null;
  audience: string | null;
  status: "planned" | "active" | "completed";
  enforcement: "soft" | "measured" | "full";
  activatedAt: string | null;
  sops: WaveSopRow[];
  operationalCount: number;
  totalCount: number;
}

const ENFORCEMENT_LABELS: Record<WaveView["enforcement"], string> = {
  soft: "Soft (coaching)",
  measured: "Measured (audit)",
  full: "Full (lock)",
};
interface WavesResponse {
  waves: WaveView[];
  cadence: { windowCount: number; max: number };
}

function RolloutView() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<WavesResponse>({
    queryKey: ["/api/sops/waves"],
    staleTime: 15000,
  });

  const refresh = (res?: WavesResponse) => {
    if (res?.waves) queryClient.setQueryData(["/api/sops/waves"], { waves: res.waves, cadence: res.cadence });
    queryClient.invalidateQueries({ queryKey: ["/api/sops/waves"] });
  };

  const activateWaveMut = useMutation({
    mutationFn: async (waveNumber: number) =>
      (await apiRequest("POST", `/api/sops/waves/${waveNumber}/activate`, {})).json(),
    onSuccess: (res: WavesResponse) => { refresh(res); toast({ title: "Wave activated" }); },
    onError: (e: any) => toast({ title: "Could not activate wave", description: e?.message, variant: "destructive" }),
  });

  const updateWaveMut = useMutation({
    mutationFn: async (vars: { waveNumber: number; status?: string; enforcement?: string }) =>
      (await apiRequest("PATCH", `/api/sops/waves/${vars.waveNumber}`, vars)).json(),
    onSuccess: (res: WavesResponse) => { refresh(res); toast({ title: "Wave updated" }); },
    onError: (e: any) => toast({ title: "Could not update wave", description: e?.message, variant: "destructive" }),
  });

  const activateSopMut = useMutation({
    mutationFn: async (vars: { waveNumber: number; code: string; force?: boolean }) => {
      const res = await apiRequest("POST", `/api/sops/waves/${vars.waveNumber}/sops/${vars.code}/activate`, { force: vars.force });
      return res.json();
    },
    onSuccess: (res: WavesResponse & { overridden?: boolean }) => {
      refresh(res);
      toast({ title: res.overridden ? "SOP made operational (cadence overridden)" : "SOP made operational" });
    },
    onError: (e: any) => toast({ title: "Could not make SOP operational", description: e?.message, variant: "destructive" }),
  });

  const handleActivateSop = (waveNumber: number, code: string, cadenceFull: boolean) => {
    if (cadenceFull) {
      const ok = window.confirm(
        "The cadence guardrail (max 2 operational SOPs per calendar week) is already reached. Override and make this SOP operational anyway? This will be recorded in the audit trail.",
      );
      if (!ok) return;
      activateSopMut.mutate({ waveNumber, code, force: true });
    } else {
      activateSopMut.mutate({ waveNumber, code });
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }

  const waves = data?.waves ?? [];
  const cadence = data?.cadence ?? { windowCount: 0, max: 2 };
  const cadenceFull = cadence.windowCount >= cadence.max;

  return (
    <div className="space-y-4" data-testid="rollout-view">
      <Card>
        <CardContent className="py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Zap className={`h-5 w-5 ${cadenceFull ? "text-red-500" : "text-amber-500"}`} />
            <div>
              <p className="text-sm font-medium">Cadence guardrail</p>
              <p className="text-xs text-muted-foreground">
                {cadence.windowCount} of {cadence.max} SOPs made operational this calendar week
                {cadenceFull && " — limit reached (override required)"}
              </p>
            </div>
          </div>
          <Badge variant={cadenceFull ? "destructive" : "secondary"} data-testid="badge-cadence">
            {cadence.windowCount}/{cadence.max} this week
          </Badge>
        </CardContent>
      </Card>

      {waves.map((wave) => (
        <Card key={wave.waveNumber} data-testid={`card-wave-${wave.waveNumber}`}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  Wave {wave.waveNumber}: {wave.name}
                  <Badge
                    variant={wave.status === "active" ? "default" : wave.status === "completed" ? "secondary" : "outline"}
                    data-testid={`badge-wave-status-${wave.waveNumber}`}
                  >
                    {wave.status}
                  </Badge>
                  <Badge
                    variant={wave.enforcement === "full" ? "destructive" : wave.enforcement === "measured" ? "secondary" : "outline"}
                    data-testid={`badge-wave-enforcement-${wave.waveNumber}`}
                  >
                    {ENFORCEMENT_LABELS[wave.enforcement]}
                  </Badge>
                </CardTitle>
                {wave.description && <p className="text-xs text-muted-foreground mt-1">{wave.description}</p>}
                {wave.audience && <p className="text-xs text-muted-foreground mt-1">Audience: {wave.audience}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  {wave.operationalCount}/{wave.totalCount} SOPs operational
                </p>
              </div>
              <div className="flex items-center gap-2">
                {wave.status === "planned" && (
                  <Button
                    size="sm"
                    onClick={() => activateWaveMut.mutate(wave.waveNumber)}
                    disabled={activateWaveMut.isPending}
                    data-testid={`button-activate-wave-${wave.waveNumber}`}
                  >
                    <Play className="h-3.5 w-3.5 mr-1" /> Activate wave
                  </Button>
                )}
                <Select
                  value={wave.enforcement}
                  onValueChange={(v) => updateWaveMut.mutate({ waveNumber: wave.waveNumber, enforcement: v })}
                >
                  <SelectTrigger className="h-8 w-[150px]" data-testid={`select-enforcement-${wave.waveNumber}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="soft">Soft (coaching)</SelectItem>
                    <SelectItem value="measured">Measured (audit)</SelectItem>
                    <SelectItem value="full">Full (lock)</SelectItem>
                  </SelectContent>
                </Select>
                {wave.status === "active" && (
                  <Select
                    value={wave.status}
                    onValueChange={(v) => updateWaveMut.mutate({ waveNumber: wave.waveNumber, status: v })}
                  >
                    <SelectTrigger className="h-8 w-[130px]" data-testid={`select-status-${wave.waveNumber}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1.5">
              {wave.sops.map((sop) => (
                <div
                  key={sop.sopMasterId}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                  data-testid={`row-wave-sop-${sop.code}`}
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{sop.code}</span>
                    <span className="text-sm truncate">{sop.title ?? "(not seeded)"}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {sop.operational ? (
                      <Badge variant="secondary" className="gap-1" data-testid={`badge-sop-operational-${sop.code}`}>
                        <CheckCircle2 className="h-3 w-3" /> Operational
                      </Badge>
                    ) : wave.status === "active" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() => handleActivateSop(wave.waveNumber, sop.code, wave.waveNumber >= 1 && cadenceFull)}
                        disabled={activateSopMut.isPending}
                        data-testid={`button-activate-sop-${sop.code}`}
                      >
                        <Zap className="h-3.5 w-3.5 mr-1" /> Make operational
                      </Button>
                    ) : (
                      <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Queued</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
