import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ShieldCheck, History, Lock, Pencil, Plus, Search, FileText, Clock, AlertTriangle, MessageSquare, Users, CheckCircle2, Send, Link2, Archive, ThumbsUp, Layers, Zap, Play, Target, UserCheck, X, Loader2, ExternalLink, BookOpen, Brain, Award, Trash2, GripVertical, CalendarDays, Sparkles, ChevronDown, ChevronUp, TrendingUp } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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

type SopDetail = SopDocument & { versions: SopDocument[]; roleAssignments: SopRoleAssignment[]; questionCount?: number };

export default function SOPLibrary() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { enabled, canManage, isLoading: accessLoading } = useSopAccess();
  const { toast } = useToast();

  // Wave rollout management is restricted to super_admin/admin (matches the
  // sops.rollout permission gating the wave endpoints).
  const canManageRollout = ["super_admin", "admin"].includes(user?.role || "");
  const canManageReviewers = ["super_admin", "admin"].includes(user?.role || "");
  const canViewAttestations = ["super_admin", "admin", "hr", "operations"].includes(user?.role || "");
  const [view, setView] = useState<"library" | "rollout" | "reviewer" | "attestations">("library");

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
            {(canManageRollout || canManageReviewers) && (
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
                {canManageRollout && (
                  <Button
                    size="sm"
                    variant={view === "rollout" ? "default" : "ghost"}
                    className="h-8"
                    onClick={() => setView("rollout")}
                    data-testid="button-view-rollout"
                  >
                    <Layers className="h-3.5 w-3.5 mr-1" /> Rollout
                  </Button>
                )}
                {canManageReviewers && (
                  <Button
                    size="sm"
                    variant={view === "reviewer" ? "default" : "ghost"}
                    className="h-8"
                    onClick={() => setView("reviewer")}
                    data-testid="button-view-reviewer"
                  >
                    <UserCheck className="h-3.5 w-3.5 mr-1" /> Reviewers
                  </Button>
                )}
                {canViewAttestations && (
                  <Button
                    size="sm"
                    variant={view === "attestations" ? "default" : "ghost"}
                    className="h-8"
                    onClick={() => setView("attestations")}
                    data-testid="button-view-attestations"
                  >
                    <Award className="h-3.5 w-3.5 mr-1" /> Attestations
                  </Button>
                )}
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
          <RolloutView onViewDetails={setDetailId} />
        ) : view === "reviewer" && canManageReviewers ? (
          <ReviewerAssignmentView />
        ) : view === "attestations" && canViewAttestations ? (
          <AttestationsView />
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
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" data-testid={`text-sop-code-${sop.code}`}>{sop.code}</Badge>
                        {(sop as any).questionCount > 0 ? (
                          <Badge variant="secondary" className="gap-1 text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200" data-testid={`badge-quiz-${sop.code}`}>
                            <Brain className="h-2.5 w-2.5" /> {(sop as any).questionCount}Q
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1 text-[10px] text-amber-700 bg-amber-50 dark:bg-amber-900/30 border-amber-200" data-testid={`badge-quiz-empty-${sop.code}`}>
                            <Brain className="h-2.5 w-2.5" /> No quiz
                          </Badge>
                        )}
                      </div>
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
              <TabsList className={`grid ${data.code === "OPS-001" ? (canManage ? "grid-cols-8" : "grid-cols-7") : (canManage ? "grid-cols-7" : "grid-cols-6")} w-full`}>
                <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                <TabsTrigger value="reviewers" data-testid="tab-reviewers">Reviewers</TabsTrigger>
                <TabsTrigger value="comments" data-testid="tab-comments">Comments</TabsTrigger>
                <TabsTrigger value="progress" data-testid="tab-progress">Team Progress</TabsTrigger>
                <TabsTrigger value="training" data-testid="tab-training" className="flex items-center gap-1">
                  Training
                  {data && (
                    <span className={`text-[10px] px-1 rounded font-semibold leading-none ${
                      (data.questionCount ?? 0) === 0
                        ? "bg-amber-100 text-amber-700"
                        : (data.questionCount ?? 0) >= 3
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`} data-testid="badge-question-count">
                      {data.questionCount ?? 0}Q
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="audit" data-testid="tab-audit">Audit &amp; Findings</TabsTrigger>
                {canManage && (
                  <TabsTrigger value="knowledge-check" data-testid="tab-knowledge-check">
                    <Brain className="h-3.5 w-3.5 mr-1" />Knowledge Check
                  </TabsTrigger>
                )}
                {data.code === "OPS-001" && (
                  <TabsTrigger value="access" data-testid="tab-access-requests">Access Requests</TabsTrigger>
                )}
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

              <TabsContent value="training" className="mt-3">
                <SopTrainingTab sopCode={data.code} sopId={id} canManage={canManage} />
              </TabsContent>

              <TabsContent value="audit" className="mt-3">
                <AuditFindingsTab sopId={id} canManage={canManage} />
              </TabsContent>

              {canManage && (
                <TabsContent value="knowledge-check" className="mt-3">
                  <KnowledgeCheckSection sopId={id} canManage={canManage} />
                </TabsContent>
              )}
              {data.code === "OPS-001" && (
                <TabsContent value="access" className="mt-3">
                  <AccessRequestsTab sopId={id} />
                </TabsContent>
              )}
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

type QuestionRow = {
  id: string;
  questionText: string;
  correctOptionIndex: number;
  explanation: string | null;
  position: number;
  options: { id: string; optionText: string; position: number }[];
};

function SopTrainingTab({ sopCode, sopId, canManage }: { sopCode: string; sopId: string; canManage: boolean }) {
  const { data: tracks = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/training/by-sop", sopCode],
    queryFn: async () => {
      const res = await fetch(`/api/training/by-sop/${encodeURIComponent(sopCode)}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading training modules...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tracks.length === 0 ? (
        <div className="py-6 text-center text-muted-foreground">
          <p className="font-medium text-sm">No training modules linked to this SOP</p>
          <p className="text-xs mt-1">Import the SOP training catalog from Training Management to link modules.</p>
        </div>
      ) : (
        tracks.map((track: any) => {
          const statusColors: Record<string, string> = {
            not_assigned: "bg-gray-100 text-gray-600",
            not_started: "bg-amber-100 text-amber-700",
            in_progress: "bg-blue-100 text-blue-700",
            completed: "bg-green-100 text-green-700",
          };
          return (
            <div key={track.id} className="border rounded-lg p-3 space-y-1.5" data-testid={`card-sop-training-${track.id}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-sm leading-tight">{track.title}</p>
                <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[track.myStatus] || statusColors.not_assigned}`}>
                  {track.myStatus.replace("_", " ")}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {track.sopCategory && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">{track.sopCategory}</span>
                )}
                {track.launchWave && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium">{track.launchWave}</span>
                )}
                {track.trainingId && (
                  <span className="text-[10px] text-muted-foreground font-mono">{track.trainingId}</span>
                )}
              </div>
              {track.audience && (
                <p className="text-xs text-muted-foreground">Audience: {track.audience}</p>
              )}
              <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                <span>{track.sectionCount} section{track.sectionCount !== 1 ? "s" : ""}</span>
                <span>{track.totalAssignments} assigned · {track.completedAssignments} completed ({track.totalAssignments > 0 ? Math.round((track.completedAssignments / track.totalAssignments) * 100) : 0}%)</span>
                {track.isGlobal && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold uppercase tracking-wide">
                    Prerequisite
                  </span>
                )}
              </div>
              {track.myAssignment?.id ? (
                <a
                  href={`/admin/growth?tab=training&track=${track.myAssignment.id}`}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
                  data-testid={`link-start-training-${track.id}`}
                >
                  <Play className="h-3 w-3" />
                  {track.myStatus === "completed" ? "View certificate →" : track.myStatus === "in_progress" ? "Resume →" : "Start →"}
                </a>
              ) : (
                <a
                  href="/admin/growth?tab=training"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                  data-testid={`link-view-training-${track.id}`}
                >
                  <Play className="h-3 w-3" /> View in My Training →
                </a>
              )}
            </div>
          );
        })
      )}

      <KnowledgeCheckSection sopId={sopId} canManage={canManage} />
    </div>
  );
}

function KnowledgeCheckSection({ sopId, canManage }: { sopId: string; canManage: boolean }) {
  const { toast } = useToast();
  const [addingNew, setAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: questions = [], isLoading: qLoading } = useQuery<QuestionRow[]>({
    queryKey: ["/api/sops", sopId, "questions"],
    queryFn: async () => {
      const res = await fetch(`/api/sops/${sopId}/questions`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/sops", sopId, "questions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sops", sopId] });
    queryClient.invalidateQueries({ queryKey: ["/api/sops"] });
  };

  const deleteMut = useMutation({
    mutationFn: async (qid: string) =>
      (await apiRequest("DELETE", `/api/sops/${sopId}/questions/${qid}`, {})).json(),
    onSuccess: () => {
      invalidate();
      setDeleteConfirmId(null);
      toast({ title: "Question deleted" });
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e?.message, variant: "destructive" }),
  });

  const maxReached = questions.length >= 5;

  return (
    <div className="space-y-3 pt-4 border-t mt-2">
      {/* Section header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary shrink-0" />
          <span className="font-medium text-sm">Knowledge Check</span>
          {questions.length > 0 && (
            <span className="text-xs text-muted-foreground">· {questions.length} question{questions.length !== 1 ? "s" : ""}</span>
          )}
        </div>
        {canManage && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setAddingNew(true); setEditingId(null); }}
                    disabled={addingNew || editingId !== null || maxReached}
                    data-testid="button-add-question"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Question
                  </Button>
                </span>
              </TooltipTrigger>
              {maxReached && <TooltipContent>Maximum 5 questions reached</TooltipContent>}
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Employees must answer these questions and score ≥70% before they can acknowledge this SOP. Max 5 questions.
      </p>

      {/* Loading */}
      {qLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-xs py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading questions…
        </div>
      )}

      {/* Empty state */}
      {!qLoading && questions.length === 0 && !addingNew && (
        <p className="text-xs text-muted-foreground italic py-1" data-testid="text-no-questions">
          No questions yet — employees can acknowledge without a quiz.
        </p>
      )}

      {/* Amber warning: fewer than 3 questions */}
      {!qLoading && questions.length > 0 && questions.length < 3 && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Add at least 3 questions for a meaningful check.
        </div>
      )}

      {/* Question list */}
      {!qLoading && questions.map((q, idx) => (
        <div key={q.id}>
          {editingId === q.id ? (
            <QuestionForm
              sopId={sopId}
              initial={q}
              onSaved={() => { setEditingId(null); invalidate(); toast({ title: "Question saved" }); }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div className="rounded border p-3 space-y-2 text-sm" data-testid={`card-question-${q.id}`}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Q{idx + 1}</span>
                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    {deleteConfirmId === q.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Delete? Responses kept.</span>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setDeleteConfirmId(null)} data-testid={`button-cancel-delete-${q.id}`}>Cancel</Button>
                        <Button size="sm" variant="destructive" className="h-6 px-2 text-xs" onClick={() => deleteMut.mutate(q.id)} disabled={deleteMut.isPending} data-testid={`button-confirm-delete-${q.id}`}>Delete</Button>
                      </div>
                    ) : (
                      <>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => { setEditingId(q.id); setAddingNew(false); setDeleteConfirmId(null); }} data-testid={`button-edit-question-${q.id}`}>
                          <Pencil className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-destructive hover:text-destructive" onClick={() => setDeleteConfirmId(q.id)} data-testid={`button-delete-question-${q.id}`}>
                          <Trash2 className="h-3 w-3 mr-1" /> Delete
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
              <p className="text-sm leading-snug">{q.questionText}</p>
              <div className="space-y-0.5">
                {q.options.map((opt, i) => (
                  <div
                    key={opt.id}
                    className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${i === q.correctOptionIndex ? "bg-emerald-50 border border-emerald-200" : ""}`}
                    data-testid={`option-${q.id}-${i}`}
                  >
                    <span className="font-semibold w-4 shrink-0">{String.fromCharCode(65 + i)}</span>
                    <span className="flex-1">{opt.optionText}</span>
                    {i === q.correctOptionIndex && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                  </div>
                ))}
              </div>
              {q.explanation && (
                <p className="text-xs text-muted-foreground italic border-t pt-2">
                  Explanation: "{q.explanation}"
                </p>
              )}
            </div>
          )}
        </div>
      ))}

      {/* New question form */}
      {addingNew && (
        <QuestionForm
          sopId={sopId}
          initial={null}
          onSaved={() => { setAddingNew(false); invalidate(); toast({ title: "Question saved" }); }}
          onCancel={() => setAddingNew(false)}
        />
      )}
    </div>
  );
}

function QuestionForm({
  sopId,
  initial,
  onSaved,
  onCancel,
}: {
  sopId: string;
  initial: QuestionRow | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [questionText, setQuestionText] = useState(initial?.questionText ?? "");
  const [options, setOptions] = useState<string[]>(
    initial ? initial.options.map((o) => o.optionText) : ["", ""]
  );
  const [correctOptionIndex, setCorrectOptionIndex] = useState<number | null>(
    initial != null ? initial.correctOptionIndex : null
  );
  const [explanation, setExplanation] = useState(initial?.explanation ?? "");
  const [touched, setTouched] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const qtrimmed = questionText.trim();
  const validOptions = options.map((o) => o.trim());
  const hasEmptyOption = validOptions.some((o) => o === "");
  const tooFewOptions = options.length < 2;
  const missingCorrect = correctOptionIndex === null;
  const isValid = qtrimmed !== "" && !hasEmptyOption && !tooFewOptions && !missingCorrect;

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        questionText: qtrimmed,
        options: validOptions,
        correctOptionIndex: correctOptionIndex!,
        explanation: explanation.trim() || null,
      };
      if (initial) {
        return (await apiRequest("PATCH", `/api/sops/${sopId}/questions/${initial.id}`, payload)).json();
      }
      return (await apiRequest("POST", `/api/sops/${sopId}/questions`, payload)).json();
    },
    onSuccess: () => onSaved(),
    onError: (e: any) => toast({ title: "Save failed", description: e?.message, variant: "destructive" }),
  });

  const handleCancel = () => {
    if (isDirty) setCancelConfirm(true);
    else onCancel();
  };

  const addOption = () => {
    if (options.length < 4) {
      setOptions([...options, ""]);
      setIsDirty(true);
    }
  };

  const removeOption = (i: number) => {
    const next = options.filter((_, idx) => idx !== i);
    setOptions(next);
    if (correctOptionIndex === i) setCorrectOptionIndex(null);
    else if (correctOptionIndex !== null && correctOptionIndex > i) setCorrectOptionIndex(correctOptionIndex - 1);
    setIsDirty(true);
  };

  const updateOption = (i: number, val: string) => {
    const next = [...options];
    next[i] = val;
    setOptions(next);
    setIsDirty(true);
  };

  if (cancelConfirm) {
    return (
      <div className="rounded border border-primary p-3 space-y-2">
        <p className="text-sm font-medium">Discard changes?</p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setCancelConfirm(false)}>Keep editing</Button>
          <Button size="sm" variant="destructive" onClick={onCancel}>Discard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded border border-primary p-3 space-y-3 text-sm" data-testid="form-question">
      {/* Question text */}
      <div className="space-y-1">
        <Label className="text-xs font-medium">Question text *</Label>
        <div className="relative">
          <Textarea
            value={questionText}
            onChange={(e) => { setQuestionText(e.target.value); setIsDirty(true); }}
            onBlur={() => setTouched(true)}
            placeholder="What must you do before requesting access to any system?"
            className={`resize-none text-sm ${touched && !qtrimmed ? "border-destructive" : ""}`}
            rows={2}
            maxLength={500}
            data-testid="input-question-text"
          />
          {questionText.length > 400 && (
            <span className="absolute bottom-1 right-2 text-[10px] text-muted-foreground">{questionText.length}/500</span>
          )}
        </div>
      </div>

      {/* Answer options */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Answer options * <span className="font-normal text-muted-foreground">(mark one correct →)</span></Label>
        </div>
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              placeholder={`Option ${String.fromCharCode(65 + i)}`}
              className={`flex-1 h-8 text-xs ${touched && !opt.trim() ? "border-destructive" : ""}`}
              data-testid={`input-option-${i}`}
            />
            <input
              type="radio"
              name={`correct-${sopId}-${initial?.id ?? "new"}`}
              checked={correctOptionIndex === i}
              onChange={() => { setCorrectOptionIndex(i); setIsDirty(true); }}
              className="h-4 w-4 cursor-pointer accent-emerald-600"
              title="Mark as correct"
              data-testid={`radio-correct-${i}`}
            />
            {options.length > 2 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground"
                onClick={() => removeOption(i)}
                data-testid={`button-remove-option-${i}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
        {touched && tooFewOptions && <p className="text-xs text-destructive">Add at least 2 options</p>}
        {touched && !tooFewOptions && missingCorrect && <p className="text-xs text-destructive">Mark one correct answer</p>}
        {touched && hasEmptyOption && !tooFewOptions && <p className="text-xs text-destructive">All options must have text</p>}
        {options.length < 4 && (
          <Button size="sm" variant="ghost" className="h-7 text-xs mt-1" onClick={addOption} data-testid="button-add-option">
            <Plus className="h-3 w-3 mr-1" /> Add option
          </Button>
        )}
      </div>

      {/* Explanation */}
      <div className="space-y-1">
        <Label className="text-xs font-medium">Explanation <span className="font-normal text-muted-foreground">(shown to employee on review — optional)</span></Label>
        <Textarea
          value={explanation}
          onChange={(e) => { setExplanation(e.target.value); setIsDirty(true); }}
          placeholder="Per §3.1, the least-privilege policy must be checked first…"
          className="resize-none text-sm"
          rows={2}
          data-testid="input-explanation"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <Button size="sm" variant="ghost" onClick={handleCancel} data-testid="button-cancel-question">Cancel</Button>
        <Button
          size="sm"
          onClick={() => { setTouched(true); if (isValid) saveMut.mutate(); }}
          disabled={saveMut.isPending || (touched && !isValid)}
          data-testid="button-save-question"
        >
          {saveMut.isPending ? (
            <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Saving…</>
          ) : (
            "Save Question"
          )}
        </Button>
      </div>
    </div>
  );
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

interface AccessRequestRow {
  id: string;
  requestNumber: string;
  title: string;
  status: string;
  requesterName: string;
  requesterRole: string | null;
  system: string | null;
  accessLevel: string | null;
  createdAt: string;
  managerDecision: "approved" | "rejected" | "pending";
  taggedOps001: boolean;
}

function AccessRequestsTab({ sopId }: { sopId: string }) {
  const { data, isLoading } = useQuery<{ requests: AccessRequestRow[]; taggedCount: number; total: number }>({
    queryKey: ["/api/sops", sopId, "access-requests"],
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  const requests = data?.requests ?? [];

  const decisionBadge = (d: AccessRequestRow["managerDecision"]) =>
    d === "approved"
      ? <Badge variant="outline" className="text-[10px] border-green-300 text-green-600">Approved</Badge>
      : d === "rejected"
      ? <Badge variant="outline" className="text-[10px] border-red-300 text-red-600">Rejected</Badge>
      : <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600">Pending</Badge>;

  return (
    <div className="space-y-3" data-testid="tab-content-access-requests">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Tool access requests raised through the Service Desk. {data?.taggedCount ?? 0} tagged to OPS-001.
        </p>
      </div>
      {requests.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center" data-testid="text-no-access-requests">
          No access requests recorded yet.
        </p>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <div key={r.id} className="rounded border px-3 py-2 text-xs" data-testid={`row-access-request-${r.id}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-muted-foreground">{r.requestNumber}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {r.taggedOps001 && <Badge variant="secondary" className="text-[10px]">OPS-001</Badge>}
                  {decisionBadge(r.managerDecision)}
                </div>
              </div>
              <p className="font-medium mt-1 truncate">{r.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-muted-foreground">
                <span>{r.requesterName}{r.requesterRole ? ` · ${r.requesterRole.replace(/_/g, " ")}` : ""}</span>
                {r.system && <span>System: {r.system}</span>}
                {r.accessLevel && <span className="capitalize">Level: {r.accessLevel.replace(/_/g, " ")}</span>}
                {r.createdAt && <span data-testid={`text-access-date-${r.id}`}>Requested: {new Date(r.createdAt).toLocaleDateString()}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Knowledge Check Tab — HR/Admin MCQ question management (Task #1419) ──────
interface KnowledgeCheckQuestion {
  id: string;
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string | null;
  position: number;
}

function KnowledgeCheckTab({ sopId }: { sopId: string }) {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editQ, setEditQ] = useState<KnowledgeCheckQuestion | null>(null);

  const { data: questions, isLoading, refetch } = useQuery<KnowledgeCheckQuestion[]>({
    queryKey: ["/api/sops", sopId, "questions"],
    staleTime: 15000,
  });

  const deleteMut = useMutation({
    mutationFn: async (qid: string) => {
      await apiRequest("DELETE", `/api/sops/${sopId}/questions/${qid}`, {});
    },
    onSuccess: () => { refetch(); toast({ title: "Question deleted" }); },
    onError: (e: any) => toast({ title: "Delete failed", description: e?.message, variant: "destructive" }),
  });

  const qs = questions ?? [];

  return (
    <div className="space-y-4" data-testid="tab-content-knowledge-check">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium flex items-center gap-1.5"><Brain className="h-4 w-4 text-primary" /> Knowledge Check Questions</p>
          <p className="text-xs text-muted-foreground mt-0.5">Employees must score ≥70% before they can acknowledge this SOP. Max 3 attempts, 10-min cooldown between fails.</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)} data-testid="button-add-question">
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Question
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : qs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center" data-testid="no-questions">
          <Brain className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No questions yet. Add at least one MCQ to activate the knowledge check gate.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {qs.map((q, qi) => (
            <div key={q.id} className="rounded-md border p-3 space-y-2" data-testid={`row-question-${q.id}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{qi + 1}. {q.questionText}</p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditQ(q)} data-testid={`button-edit-question-${q.id}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => { if (window.confirm("Delete this question?")) deleteMut.mutate(q.id); }}
                    data-testid={`button-delete-question-${q.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {q.options.map((opt, oi) => (
                  <div
                    key={oi}
                    className={`text-xs rounded px-2 py-1 border ${oi === q.correctIndex ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" : "border-border text-muted-foreground"}`}
                    data-testid={`option-${q.id}-${oi}`}
                  >
                    {oi === q.correctIndex && <CheckCircle2 className="h-3 w-3 inline mr-1" />}
                    {opt}
                  </div>
                ))}
              </div>
              {q.explanation && (
                <p className="text-xs text-muted-foreground border-l-2 pl-2 italic">{q.explanation}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {(addOpen || editQ) && (
        <QuestionFormDialog
          sopId={sopId}
          question={editQ}
          onClose={() => { setAddOpen(false); setEditQ(null); }}
          onSaved={() => { setAddOpen(false); setEditQ(null); refetch(); }}
        />
      )}
    </div>
  );
}

function QuestionFormDialog({
  sopId, question, onClose, onSaved,
}: { sopId: string; question: KnowledgeCheckQuestion | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const isEdit = !!question;
  const [qText, setQText] = useState(question?.questionText ?? "");
  const [options, setOptions] = useState<string[]>(question?.options ?? ["", ""]);
  const [correctIdx, setCorrectIdx] = useState(question?.correctIndex ?? 0);
  const [explanation, setExplanation] = useState(question?.explanation ?? "");

  const saveMut = useMutation({
    mutationFn: async () => {
      const body = { questionText: qText.trim(), options: options.map((o) => o.trim()), correctIndex: correctIdx, explanation: explanation.trim() || null };
      if (isEdit) {
        await apiRequest("PATCH", `/api/sops/${sopId}/questions/${question!.id}`, body);
      } else {
        await apiRequest("POST", `/api/sops/${sopId}/questions`, body);
      }
    },
    onSuccess: () => { toast({ title: isEdit ? "Question updated" : "Question added" }); onSaved(); },
    onError: (e: any) => toast({ title: "Save failed", description: e?.message, variant: "destructive" }),
  });

  const updateOption = (i: number, val: string) => {
    const next = [...options];
    next[i] = val;
    setOptions(next);
  };
  const addOption = () => { if (options.length < 4) setOptions([...options, ""]); };
  const removeOption = (i: number) => {
    if (options.length <= 2) return;
    const next = options.filter((_, idx) => idx !== i);
    setOptions(next);
    if (correctIdx >= next.length) setCorrectIdx(next.length - 1);
  };

  const canSave = qText.trim().length > 0 && options.every((o) => o.trim().length > 0) && options.length >= 2;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" data-testid="dialog-question-form">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Question" : "Add Question"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Question</Label>
            <Textarea
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              rows={2}
              placeholder="Enter the question text…"
              className="text-sm resize-none"
              data-testid="input-question-text"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Answer Options (select the correct one)</Label>
            {options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCorrectIdx(oi)}
                  className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${oi === correctIdx ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground"}`}
                  data-testid={`select-correct-${oi}`}
                  title="Mark as correct"
                >
                  {oi === correctIdx && <div className="w-2 h-2 bg-white rounded-full" />}
                </button>
                <Input
                  value={opt}
                  onChange={(e) => updateOption(oi, e.target.value)}
                  placeholder={`Option ${oi + 1}`}
                  className="text-sm"
                  data-testid={`input-option-${oi}`}
                />
                {options.length > 2 && (
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => removeOption(oi)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            {options.length < 4 && (
              <Button size="sm" variant="outline" className="gap-1" onClick={addOption} data-testid="button-add-option">
                <Plus className="h-3 w-3" /> Add option
              </Button>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Explanation (optional — shown on pass or after all attempts)</Label>
            <Textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={2}
              placeholder="Explain why the correct answer is right…"
              className="text-sm resize-none"
              data-testid="input-explanation"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-question">Cancel</Button>
          <Button disabled={!canSave || saveMut.isPending} onClick={() => saveMut.mutate()} data-testid="button-save-question">
            {saveMut.isPending ? "Saving…" : isEdit ? "Update" : "Add Question"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Attestations View — HR wave completion tracking (Task #1419) ──────────────
interface AttestationRow {
  id: string;
  userId: string;
  name: string;
  email: string;
  attestedAt: string;
  refNumber: string;
  quizStats: { sops_passed: number; total_passes: number; total_fails: number } | null;
}
interface NotAttestedRow {
  userId: string;
  name: string;
  email: string;
  role: string;
}
interface SopQuizStat {
  sopId: string;
  code: string;
  title: string;
  passRatePct: number;
  avgAttempts: string;
  totalAttempts: number;
  passedEmployees: number;
  totalEmployees: number;
}
interface WaveAttestationsData {
  waveNumber: number;
  totalImpacted: number;
  attestedCount: number;
  pendingCount: number;
  attestations: AttestationRow[];
  notAttested: NotAttestedRow[];
  sopQuizStats: SopQuizStat[];
}

function AttestationsView() {
  const [selectedWave, setSelectedWave] = useState<string>("all");

  // Fetch available waves
  const { data: wavesData } = useQuery<{ waves: { waveNumber: number; name: string; status: string }[] }>({
    queryKey: ["/api/sops/waves"],
    staleTime: 30000,
  });

  const activeWaves = (wavesData?.waves ?? []).filter((w) => w.status === "active" || w.status === "completed");

  const { data: attData, isLoading } = useQuery<WaveAttestationsData>({
    queryKey: ["/api/sops/waves", selectedWave, "attestations"],
    enabled: selectedWave !== "all",
    staleTime: 15000,
  });

  return (
    <div className="space-y-5" data-testid="attestations-view">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" /> Wave Attestations
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Track which employees have completed all SOPs in each wave, with quiz performance stats.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Label className="text-sm shrink-0">Select Wave:</Label>
        <div className="flex flex-wrap gap-2">
          {activeWaves.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active or completed waves yet.</p>
          ) : (
            activeWaves.map((w) => (
              <Button
                key={w.waveNumber}
                size="sm"
                variant={selectedWave === String(w.waveNumber) ? "default" : "outline"}
                onClick={() => setSelectedWave(String(w.waveNumber))}
                data-testid={`button-wave-select-${w.waveNumber}`}
              >
                Wave {w.waveNumber}
              </Button>
            ))
          )}
        </div>
      </div>

      {selectedWave === "all" && (
        <div className="flex flex-col items-center gap-3 py-12 text-center" data-testid="attestations-select-wave">
          <Award className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Select a wave above to view attestation status.</p>
        </div>
      )}

      {selectedWave !== "all" && isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      )}

      {attData && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold text-foreground" data-testid="stat-total-impacted">{attData.totalImpacted}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Total impacted</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold text-emerald-600" data-testid="stat-attested">{attData.attestedCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Attested</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold text-amber-600" data-testid="stat-pending">{attData.pendingCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Pending</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="attested">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="attested" data-testid="tab-att-attested">
                Attested ({attData.attestedCount})
              </TabsTrigger>
              <TabsTrigger value="pending" data-testid="tab-att-pending">
                Pending ({attData.pendingCount})
              </TabsTrigger>
              <TabsTrigger value="quiz-stats" data-testid="tab-att-quiz-stats">
                Quiz Stats
              </TabsTrigger>
            </TabsList>

            <TabsContent value="attested" className="mt-3">
              {attData.attestations.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center" data-testid="no-attestations">
                  <Award className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No attestations recorded for Wave {attData.waveNumber} yet.</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Employee</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Attested</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Reference</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Quiz</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {attData.attestations.map((a) => (
                        <tr key={a.id} data-testid={`row-attestation-${a.userId}`}>
                          <td className="px-3 py-2">
                            <p className="font-medium text-sm">{a.name}</p>
                            <p className="text-xs text-muted-foreground">{a.email}</p>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {new Date(a.attestedAt).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2 text-xs font-mono">{a.refNumber}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {a.quizStats ? (
                              <span>{a.quizStats.sops_passed} passed / {a.quizStats.total_fails} fails</span>
                            ) : (
                              <span className="text-muted-foreground/60">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="pending" className="mt-3">
              {attData.notAttested.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center" data-testid="no-pending">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  <p className="text-sm text-muted-foreground">All employees have attested Wave {attData.waveNumber}!</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Employee</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {attData.notAttested.map((n) => (
                        <tr key={n.userId} data-testid={`row-pending-${n.userId}`}>
                          <td className="px-3 py-2">
                            <p className="font-medium text-sm">{n.name}</p>
                            <p className="text-xs text-muted-foreground">{n.email}</p>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground capitalize">{n.role?.replace(/_/g, " ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="quiz-stats" className="mt-3">
              {attData.sopQuizStats.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center" data-testid="no-quiz-stats">
                  <Brain className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No quiz data yet for Wave {attData.waveNumber}.</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">SOP</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Pass Rate</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Avg Attempts</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Coverage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {attData.sopQuizStats.map((s) => (
                        <tr key={s.sopId} data-testid={`row-quiz-stat-${s.code}`}>
                          <td className="px-3 py-2">
                            <p className="font-mono text-xs text-muted-foreground">{s.code}</p>
                            <p className="text-sm font-medium truncate max-w-[180px]">{s.title}</p>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-muted rounded-full h-1.5">
                                <div
                                  className="h-1.5 rounded-full bg-emerald-500"
                                  style={{ width: `${Math.min(100, s.passRatePct)}%` }}
                                />
                              </div>
                              <span className={`text-xs font-medium ${s.passRatePct >= 70 ? "text-emerald-600" : "text-amber-600"}`}>
                                {s.passRatePct}%
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{s.avgAttempts}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{s.passedEmployees}/{s.totalEmployees}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
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

// ── Reviewer Assignment Panel (Task #744) ────────────────────────────────────

interface ReviewerDetail {
  id: string;
  sopMasterId: string;
  sopVersion: number;
  round: number;
  reviewerId: string;
  reviewerName: string;
  status: string;
  dueAt: string | null;
  decisionAt: string | null;
  comment: string | null;
  overdue: boolean;
}

interface AssignmentRow {
  id: string;
  sopMasterId: string;
  code: string;
  title: string;
  category: string;
  lifecycleStatus: string;
  version: number;
  round: number;
  noReviewer: boolean;
  slaStatus: "none" | "on_track" | "overdue";
  reviewers: ReviewerDetail[];
  gate: { strictApprove: boolean; noObjectionEligible: boolean; hasBlocking: boolean; pendingCount: number; overdueCount: number };
}

interface AssignmentOverview {
  rows: AssignmentRow[];
  summary: { total: number; unassigned: number; inReview: number; overdue: number };
}

const BULK_VALID_STATUSES = ["draft", "changes_requested", "under_revision"];
// Statuses where reviewers can be added (new round for bulk/submit; same round for in_review via add-reviewers)
const ADD_REVIEWER_STATUSES = ["draft", "changes_requested", "under_revision", "in_review"];

function maxDaysOverdue(row: AssignmentRow): number {
  const now = Date.now();
  return row.reviewers
    .filter((r) => r.overdue && r.dueAt)
    .reduce((max, r) => {
      const days = Math.ceil((now - new Date(r.dueAt!).getTime()) / 86400000);
      return Math.max(max, days);
    }, 0);
}

function slaBadge(row: AssignmentRow) {
  if (row.slaStatus === "overdue") {
    const days = maxDaysOverdue(row);
    return (
      <Badge variant="destructive" className="text-[10px]" data-testid={`badge-sla-overdue-${row.code}`}>
        <AlertTriangle className="h-3 w-3 mr-0.5" /> {days > 0 ? `${days}d overdue` : "Overdue"}
      </Badge>
    );
  }
  if (row.slaStatus === "on_track") {
    return <Badge variant="outline" className="text-[10px] border-green-400 text-green-600" data-testid={`badge-sla-ontrack-${row.code}`}><Clock className="h-3 w-3 mr-0.5" /> On track</Badge>;
  }
  return <Badge variant="outline" className="text-[10px] text-muted-foreground" data-testid={`badge-sla-none-${row.code}`}>None</Badge>;
}

function ReviewerAssignmentView() {
  const { toast } = useToast();
  const { user } = useAuth();

  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [noReviewerOnly, setNoReviewerOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [drawerRow, setDrawerRow] = useState<AssignmentRow | null>(null);
  const [addReviewerOpen, setAddReviewerOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery<AssignmentOverview>({
    queryKey: ["/api/sops/reviewer-assignments"],
  });

  const rows = data?.rows ?? [];
  const summary = data?.summary ?? { total: 0, unassigned: 0, inReview: 0, overdue: 0 };

  const categories = useMemo(() => Array.from(new Set(rows.map((r) => r.category).filter(Boolean))).sort(), [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.lifecycleStatus !== statusFilter) return false;
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      if (noReviewerOnly && !r.noReviewer) return false;
      return true;
    });
  }, [rows, statusFilter, categoryFilter, noReviewerOnly]);

  const allFilteredIds = filtered.map((r) => r.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedRows = filtered.filter((r) => selectedIds.has(r.id));
  const bulkEligible = selectedRows.filter((r) => BULK_VALID_STATUSES.includes(r.lifecycleStatus));

  const bulkMut = useMutation({
    mutationFn: async (reviewerIds: string[]) => {
      const res = await apiRequest("POST", "/api/sops/bulk-submit-review", {
        sopIds: bulkEligible.map((r) => r.id),
        reviewerIds,
      });
      return res.json() as Promise<{ submitted: number; skipped: number }>;
    },
    onSuccess: (res) => {
      toast({ title: `${res.submitted} SOP${res.submitted !== 1 ? "s" : ""} submitted${res.skipped > 0 ? `, ${res.skipped} skipped` : ""}` });
      setSelectedIds(new Set());
      setBulkDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/sops/reviewer-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sops"] });
    },
    onError: (e: any) => toast({ title: "Bulk submit failed", description: e?.message, variant: "destructive" }),
  });

  const addToRoundMut = useMutation({
    mutationFn: async ({ sopId, sopStatus, reviewerIds }: { sopId: string; sopStatus: string; reviewerIds: string[] }) => {
      // in_review SOPs: append to current round (preserves existing decisions)
      // other valid statuses: open a new round via submit-review
      const endpoint = sopStatus === "in_review"
        ? `/api/sops/${sopId}/add-reviewers`
        : `/api/sops/${sopId}/submit-review`;
      const res = await apiRequest("POST", endpoint, { reviewerIds });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Reviewers added" });
      setAddReviewerOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/sops/reviewer-assignments"] });
      if (drawerRow) {
        refetch().then((res) => {
          const fresh = res.data?.rows.find((r) => r.id === drawerRow.id);
          if (fresh) setDrawerRow(fresh);
        });
      }
    },
    onError: (e: any) => toast({ title: "Failed to add reviewers", description: e?.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-5" data-testid="reviewer-assignment-view">
      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="summary-strip">
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Total SOPs</p>
            <p className="text-2xl font-bold" data-testid="text-summary-total">{summary.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Awaiting Assignment</p>
            <p className="text-2xl font-bold text-amber-600" data-testid="text-summary-unassigned">{summary.unassigned}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">In Review</p>
            <p className="text-2xl font-bold text-blue-600" data-testid="text-summary-in-review">{summary.inReview}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className="text-2xl font-bold text-destructive" data-testid="text-summary-overdue">{summary.overdue}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44" data-testid="select-ra-status"><SelectValue placeholder="Lifecycle status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.entries(LIFECYCLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-44" data-testid="select-ra-category"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm cursor-pointer" data-testid="filter-no-reviewer">
              <Checkbox checked={noReviewerOnly} onCheckedChange={(v) => setNoReviewerOnly(Boolean(v))} />
              No reviewer assigned
            </label>

            <div className="ml-auto flex items-center gap-2">
              {selectedIds.size > 0 && (
                <>
                  <span className="text-xs text-muted-foreground">{selectedIds.size} selected · {bulkEligible.length} eligible</span>
                  <Button
                    size="sm"
                    disabled={bulkEligible.length === 0}
                    onClick={() => setBulkDialogOpen(true)}
                    data-testid="button-bulk-assign"
                  >
                    <Users className="h-3.5 w-3.5 mr-1" /> Assign Reviewers
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} data-testid="button-clear-selection">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center text-muted-foreground" data-testid="ra-empty">
          <UserCheck className="h-8 w-8 mx-auto mb-2" />
          No SOPs match your filters.
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-reviewer-assignments">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="w-10 px-3 py-2 text-left">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      data-testid="checkbox-select-all"
                    />
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-xs text-muted-foreground">Code</th>
                  <th className="px-3 py-2 text-left font-medium text-xs text-muted-foreground">SOP Name</th>
                  <th className="px-3 py-2 text-left font-medium text-xs text-muted-foreground">Version</th>
                  <th className="px-3 py-2 text-left font-medium text-xs text-muted-foreground">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-xs text-muted-foreground">Reviewers</th>
                  <th className="px-3 py-2 text-left font-medium text-xs text-muted-foreground">SLA</th>
                  <th className="px-3 py-2 text-left font-medium text-xs text-muted-foreground">Round</th>
                  <th className="px-3 py-2 text-left font-medium text-xs text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b last:border-0 hover:bg-muted/30"
                    data-testid={`row-ra-${row.code}`}
                  >
                    <td className="px-3 py-2">
                      <Checkbox
                        checked={selectedIds.has(row.id)}
                        onCheckedChange={() => toggleOne(row.id)}
                        data-testid={`checkbox-ra-${row.code}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="font-mono text-[11px]" data-testid={`text-ra-code-${row.code}`}>{row.code}</Badge>
                    </td>
                    <td className="px-3 py-2 max-w-[220px]">
                      <p className="truncate font-medium" data-testid={`text-ra-title-${row.code}`}>{row.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{row.category}</p>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">v{row.version}</td>
                    <td className="px-3 py-2">
                      <Badge variant={lifecycleVariant(row.lifecycleStatus)} className="text-[10px]" data-testid={`badge-ra-status-${row.code}`}>
                        {LIFECYCLE_LABELS[row.lifecycleStatus] ?? row.lifecycleStatus}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {row.noReviewer ? (
                        <span className="text-xs text-muted-foreground italic" data-testid={`text-ra-no-reviewer-${row.code}`}>None</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {row.reviewers.map((r) => {
                            const daysOverdue = r.overdue && r.dueAt
                              ? Math.ceil((Date.now() - new Date(r.dueAt).getTime()) / 86400000)
                              : 0;
                            return (
                              <span
                                key={r.reviewerId}
                                title={r.overdue ? `${r.reviewerName} — ${daysOverdue}d overdue` : r.reviewerName}
                                className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${r.overdue ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-muted text-muted-foreground"}`}
                                data-testid={`chip-reviewer-${row.code}-${r.reviewerId}`}
                              >
                                {r.reviewerName.split(" ")[0]}
                                {r.overdue && (
                                  <span className="ml-0.5 flex items-center gap-0.5">
                                    <AlertTriangle className="h-2.5 w-2.5" />
                                    {daysOverdue > 0 && <span>{daysOverdue}d</span>}
                                  </span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">{slaBadge(row)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {row.round > 0 ? `R${row.round}` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setDrawerRow(row)}
                        data-testid={`button-manage-reviewers-${row.code}`}
                      >
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Bulk assign dialog */}
      {bulkDialogOpen && (
        <BulkAssignDialog
          eligibleCount={bulkEligible.length}
          selectedCount={selectedIds.size}
          currentUserId={user?.id}
          onClose={() => setBulkDialogOpen(false)}
          onConfirm={(reviewerIds) => bulkMut.mutate(reviewerIds)}
          isPending={bulkMut.isPending}
        />
      )}

      {/* Per-row manage reviewers drawer */}
      <Sheet open={!!drawerRow} onOpenChange={(o) => { if (!o) { setDrawerRow(null); setAddReviewerOpen(false); } }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="sheet-manage-reviewers">
          {drawerRow && (
            <ManageReviewersDrawer
              row={drawerRow}
              currentUserId={user?.id}
              addReviewerOpen={addReviewerOpen}
              onAddReviewerOpen={() => setAddReviewerOpen(true)}
              onAddReviewerClose={() => setAddReviewerOpen(false)}
              onAddReviewers={(reviewerIds) => addToRoundMut.mutate({ sopId: drawerRow.id, sopStatus: drawerRow.lifecycleStatus, reviewerIds })}
              isPending={addToRoundMut.isPending}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function BulkAssignDialog({
  eligibleCount,
  selectedCount,
  currentUserId,
  onClose,
  onConfirm,
  isPending,
}: {
  eligibleCount: number;
  selectedCount: number;
  currentUserId?: string;
  onClose: () => void;
  onConfirm: (reviewerIds: string[]) => void;
  isPending: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const { data: usersResp, isLoading } = useQuery<{ users: { id: string; firstName: string; lastName: string; email: string; role: string }[] }>({
    queryKey: ["/api/admin/users", "active"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/users?status=active")).json(),
  });

  const eligible = (usersResp?.users ?? []).filter((u) => u.id !== currentUserId && ["super_admin", "admin", "hr", "operations", "manager"].includes(u.role));
  const toggle = (id: string) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="dialog-bulk-assign">
        <DialogHeader>
          <DialogTitle>Assign Reviewers to {eligibleCount} SOP{eligibleCount !== 1 ? "s" : ""}</DialogTitle>
        </DialogHeader>
        {selectedCount > eligibleCount && (
          <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-md p-2">
            {selectedCount - eligibleCount} of your selected SOP{selectedCount !== 1 ? "s" : ""} will be skipped (already in review or retired).
          </div>
        )}
        <p className="text-xs text-muted-foreground">Reviewers get a 5 business-day SLA. Each SOP opens a new review round.</p>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="max-h-72 overflow-y-auto space-y-1.5">
            {eligible.map((u) => (
              <label key={u.id} className="flex items-center gap-2 rounded border p-2 text-sm cursor-pointer hover:bg-muted/40" data-testid={`option-bulk-reviewer-${u.id}`}>
                <Checkbox checked={selected.includes(u.id)} onCheckedChange={() => toggle(u.id)} />
                <span className="flex-1">{u.firstName} {u.lastName} <span className="text-muted-foreground capitalize">· {u.role.replace(/_/g, " ")}</span></span>
              </label>
            ))}
            {eligible.length === 0 && <p className="text-xs text-muted-foreground">No eligible reviewers found.</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-bulk-cancel">Cancel</Button>
          <Button
            disabled={selected.length === 0 || isPending}
            onClick={() => onConfirm(selected)}
            data-testid="button-bulk-confirm"
          >
            {isPending ? "Submitting..." : `Submit (${selected.length} reviewer${selected.length !== 1 ? "s" : ""})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageReviewersDrawer({
  row,
  currentUserId,
  addReviewerOpen,
  onAddReviewerOpen,
  onAddReviewerClose,
  onAddReviewers,
  isPending,
}: {
  row: AssignmentRow;
  currentUserId?: string;
  addReviewerOpen: boolean;
  onAddReviewerOpen: () => void;
  onAddReviewerClose: () => void;
  onAddReviewers: (ids: string[]) => void;
  isPending: boolean;
}) {
  const [newReviewers, setNewReviewers] = useState<string[]>([]);
  const { data: usersResp, isLoading } = useQuery<{ users: { id: string; firstName: string; lastName: string; email: string; role: string }[] }>({
    queryKey: ["/api/admin/users", "active"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/users?status=active")).json(),
  });
  const eligible = (usersResp?.users ?? []).filter((u) => u.id !== currentUserId && ["super_admin", "admin", "hr", "operations", "manager"].includes(u.role));
  const toggle = (id: string) => setNewReviewers((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const now = Date.now();

  return (
    <div className="space-y-4">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="font-mono">{row.code}</Badge>
          <span className="text-base font-semibold truncate">{row.title}</span>
        </SheetTitle>
      </SheetHeader>

      <div className="flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
        <Badge variant={lifecycleVariant(row.lifecycleStatus)}>{LIFECYCLE_LABELS[row.lifecycleStatus] ?? row.lifecycleStatus}</Badge>
        <span>v{row.version}</span>
        {row.round > 0 && <span>Round {row.round}</span>}
        {slaBadge(row)}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">Current Reviewers</p>
          {ADD_REVIEWER_STATUSES.includes(row.lifecycleStatus) && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onAddReviewerOpen} data-testid="button-add-reviewers-drawer">
              <Plus className="h-3.5 w-3.5 mr-1" />
              {row.lifecycleStatus === "in_review" ? "Add to Round" : "Add Reviewers"}
            </Button>
          )}
        </div>

        {row.noReviewer ? (
          <p className="text-sm text-muted-foreground" data-testid="text-drawer-no-reviewers">No reviewers assigned for this round.</p>
        ) : (
          <div className="space-y-2">
            {row.reviewers.map((r) => {
              const due = r.dueAt ? new Date(r.dueAt) : null;
              const daysLeft = due ? Math.ceil((due.getTime() - now) / 86400000) : null;
              return (
                <div key={r.reviewerId} className="rounded border p-2.5 text-sm" data-testid={`row-drawer-reviewer-${r.reviewerId}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{r.reviewerName}</span>
                    <Badge
                      variant={r.status === "pending" ? (r.overdue ? "destructive" : "outline") : r.status === "changes_requested" || r.status === "rejected" ? "destructive" : "default"}
                      className="text-[10px]"
                    >
                      {r.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-3">
                    {r.status === "pending" && due && (
                      r.overdue ? (
                        <span className="flex items-center gap-1 text-destructive">
                          <AlertTriangle className="h-3 w-3" />
                          Overdue (due {due.toLocaleDateString()})
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {daysLeft} day{daysLeft === 1 ? "" : "s"} left (due {due.toLocaleDateString()})
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
        )}
      </div>

      {/* Gate summary */}
      {!row.noReviewer && (
        <div className="rounded-md border p-2.5 space-y-1 text-xs" data-testid="panel-drawer-gate">
          <p className="font-medium text-sm">Approval Gate</p>
          <div className="flex flex-wrap gap-1.5">
            {row.gate.strictApprove && <Badge variant="default" className="text-[10px]">Clear — all approved</Badge>}
            {row.gate.noObjectionEligible && <Badge variant="secondary" className="text-[10px]">No-objection eligible</Badge>}
            {row.gate.hasBlocking && <Badge variant="destructive" className="text-[10px]">Changes requested</Badge>}
            {row.gate.pendingCount > 0 && (
              <Badge variant="outline" className="text-[10px]">{row.gate.pendingCount} pending{row.gate.overdueCount > 0 ? ` (${row.gate.overdueCount} overdue)` : ""}</Badge>
            )}
            {!row.gate.strictApprove && !row.gate.noObjectionEligible && !row.gate.hasBlocking && row.gate.pendingCount === 0 && row.reviewers.length === 0 && (
              <span className="text-muted-foreground">No reviewers</span>
            )}
          </div>
        </div>
      )}

      {/* Add reviewers inline */}
      {addReviewerOpen && (
        <div className="border rounded-md p-3 space-y-2 bg-muted/20" data-testid="panel-add-reviewers-inline">
          <div>
            <p className="text-sm font-medium">
              {row.lifecycleStatus === "in_review" ? "Add to current round" : "Submit for review"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {row.lifecycleStatus === "in_review"
                ? "Appends reviewers to the active round — existing decisions are preserved."
                : "Opens a new review round with a 5 business-day SLA."}
            </p>
          </div>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {eligible.map((u) => (
                <label key={u.id} className="flex items-center gap-2 rounded border p-2 text-sm cursor-pointer hover:bg-muted/40" data-testid={`option-add-reviewer-${u.id}`}>
                  <Checkbox checked={newReviewers.includes(u.id)} onCheckedChange={() => toggle(u.id)} />
                  <span className="flex-1">{u.firstName} {u.lastName} <span className="text-muted-foreground capitalize">· {u.role.replace(/_/g, " ")}</span></span>
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onAddReviewerClose} data-testid="button-add-reviewers-cancel">Cancel</Button>
            <Button
              size="sm"
              disabled={newReviewers.length === 0 || isPending}
              onClick={() => onAddReviewers(newReviewers)}
              data-testid="button-add-reviewers-confirm"
            >
              {isPending ? "Adding..." : `Add (${newReviewers.length})`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Wave Scheduling (Task #1408) ─────────────────────────────────────────────

interface ScheduledLaunch {
  id: string;
  waveNumber: number;
  waveName: string;
  scheduledDate: string;
  gracePeriodDays: number;
  status: "pending_approval" | "approved" | "rejected" | "cancelled" | "activated";
  submittedBy: string;
  submittedByName: string;
  submittedAt: string;
  approvedBy: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  enforcement: string;
  affectedEmployeeCount: number;
  requiresApproval: boolean;
}

interface LaunchWindowSuggestion {
  startDate: string;
  endDate: string;
  reason: string;
  historicalAckRate: number;
  rank: number;
}

interface AckPrediction {
  predictedAckRate: number;
  confidence: "high" | "medium" | "low";
  rationale: string;
}

function ScheduleRolloutDrawer({
  waveNumber,
  waveName,
  waveEnforcement,
  open,
  onClose,
  onScheduled,
  cadenceWindowCount,
  cadenceMax,
}: {
  waveNumber: number;
  waveName: string;
  waveEnforcement: string;
  open: boolean;
  onClose: () => void;
  onScheduled: () => void;
  cadenceWindowCount?: number;
  cadenceMax?: number;
}) {
  const { toast } = useToast();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  const [scheduledDate, setScheduledDate] = useState(minDate);
  const [gracePeriodDays, setGracePeriodDays] = useState<string>("14");

  // AI Suggested Windows state
  const [aiSuggestionsOpen, setAiSuggestionsOpen] = useState(true);
  const [suggestions, setSuggestions] = useState<LaunchWindowSuggestion[] | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  // AI Ack-rate prediction state (debounced)
  const [prediction, setPrediction] = useState<AckPrediction | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const predictionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch suggestions once when drawer opens
  useEffect(() => {
    if (!open) {
      setSuggestions(null);
      setPrediction(null);
      return;
    }
    let cancelled = false;
    setSuggestionsLoading(true);
    apiRequest("GET", `/api/sops/waves/${waveNumber}/ai/suggestions`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.available && Array.isArray(data.suggestions)) {
          setSuggestions(data.suggestions as LaunchWindowSuggestion[]);
        } else {
          setSuggestions([]);
        }
      })
      .catch(() => { if (!cancelled) setSuggestions([]); })
      .finally(() => { if (!cancelled) setSuggestionsLoading(false); });
    return () => { cancelled = true; };
  }, [open, waveNumber]);

  // Debounced prediction when date or grace period changes
  const fetchPrediction = useCallback(() => {
    if (!scheduledDate) return;
    setPredictionLoading(true);
    setPrediction(null);
    apiRequest("POST", `/api/sops/waves/${waveNumber}/ai/predict`, {
      goLiveDate: scheduledDate,
      graceDays: Number(gracePeriodDays),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.available && data.prediction) {
          setPrediction(data.prediction as AckPrediction);
        } else {
          setPrediction(null);
        }
      })
      .catch(() => setPrediction(null))
      .finally(() => setPredictionLoading(false));
  }, [scheduledDate, gracePeriodDays, waveNumber]);

  useEffect(() => {
    if (!open || !scheduledDate) return;
    if (predictionTimerRef.current) clearTimeout(predictionTimerRef.current);
    predictionTimerRef.current = setTimeout(fetchPrediction, 300);
    return () => {
      if (predictionTimerRef.current) clearTimeout(predictionTimerRef.current);
    };
  }, [open, scheduledDate, gracePeriodDays, fetchPrediction]);

  const isCurrentWeek = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return d >= startOfWeek && d <= endOfWeek;
  };

  const showCadenceWarning =
    !!scheduledDate &&
    isCurrentWeek(scheduledDate) &&
    typeof cadenceWindowCount === "number" &&
    typeof cadenceMax === "number" &&
    cadenceWindowCount >= cadenceMax;

  const requiresApproval = waveNumber >= 3;

  const scheduleMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/sops/waves/${waveNumber}/schedule`, {
        scheduledDate,
        gracePeriodDays: Number(gracePeriodDays),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Wave rollout scheduled",
        description: requiresApproval
          ? "Submitted for Admin approval before going live."
          : `Scheduled for ${new Date(scheduledDate).toLocaleDateString()}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sops/waves/scheduled"] });
      onScheduled();
      onClose();
    },
    onError: (e: any) =>
      toast({ title: "Failed to schedule rollout", description: e?.message, variant: "destructive" }),
  });

  function applyWindow(w: LaunchWindowSuggestion) {
    setScheduledDate(w.startDate);
  }

  function predictionBadgeClass(rate: number): string {
    if (rate >= 85) return "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700";
    if (rate >= 60) return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700";
    return "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700";
  }

  function confidenceLabel(c: AckPrediction["confidence"]) {
    return c === "high" ? "High confidence" : c === "medium" ? "Medium confidence" : "Low confidence";
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto" data-testid="drawer-schedule-rollout">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Schedule Rollout
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            Wave {waveNumber}: {waveName}
          </p>
        </SheetHeader>

        <div className="space-y-5 pt-5">
          {/* ── AI Suggested Windows ─────────────────────────────── */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 dark:border-primary/30 dark:bg-primary/10" data-testid="ai-suggestions-panel">
            <button
              className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium text-primary"
              onClick={() => setAiSuggestionsOpen((v) => !v)}
              data-testid="button-toggle-ai-suggestions"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                AI Suggested Windows
              </span>
              {aiSuggestionsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {aiSuggestionsOpen && (
              <div className="px-3 pb-3 space-y-2 border-t border-primary/15">
                {suggestionsLoading ? (
                  <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Analysing holidays, payroll dates &amp; past ack rates…
                  </div>
                ) : suggestions === null || suggestions.length === 0 ? (
                  <p className="py-2 text-xs text-muted-foreground">
                    {suggestions === null ? "Unable to generate suggestions right now." : "No conflict-free windows found in the next 60 days."}
                  </p>
                ) : (
                  suggestions.map((s) => (
                    <div
                      key={s.rank}
                      className="mt-2 flex items-start justify-between gap-2 rounded border border-primary/15 bg-background px-2.5 py-2"
                      data-testid={`ai-suggestion-${s.rank}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground">
                          {new Date(s.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          {" — "}
                          {new Date(s.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          {s.rank === 1 && (
                            <Badge className="ml-1.5 text-[10px] h-4 px-1 bg-primary/15 text-primary border-0">
                              Best
                            </Badge>
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{s.reason}</p>
                        <div className="mt-1 flex items-center gap-1">
                          <TrendingUp className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[11px] text-muted-foreground">Est. {s.historicalAckRate}% ack rate</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs shrink-0"
                        onClick={() => applyWindow(s)}
                        data-testid={`button-apply-suggestion-${s.rank}`}
                      >
                        Use
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {showCadenceWarning && (
            <div
              className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/30 px-3 py-2 text-sm text-amber-700 dark:text-amber-300"
              data-testid="banner-cadence-warning"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                The selected week is at the cadence limit ({cadenceWindowCount}/{cadenceMax} operational SOPs this
                week). Scheduling here may require an override when the wave goes live.
              </span>
            </div>
          )}

          {requiresApproval && (
            <div
              className="flex items-start gap-2 rounded border border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/30 px-3 py-2 text-sm text-blue-700 dark:text-blue-300"
              data-testid="notice-approval-required"
            >
              <Clock className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                <strong>Wave {waveNumber} requires Admin approval</strong> before going live. Submitting will queue
                it for review in the Governance Hub.
              </span>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium">Go-live date</Label>
            <Input
              type="date"
              value={scheduledDate}
              min={minDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              data-testid="input-schedule-date"
            />
            <p className="text-xs text-muted-foreground">Earliest: tomorrow</p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Grace period</Label>
            <Select value={gracePeriodDays} onValueChange={setGracePeriodDays}>
              <SelectTrigger data-testid="select-grace-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="21">21 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Employees get this many days after go-live before nudges begin.
            </p>
          </div>

          {/* ── AI Ack-Rate Prediction Badge ─────────────────────── */}
          {scheduledDate && (predictionLoading || prediction) && (
            <div
              className="flex items-center gap-2 rounded border px-3 py-2"
              data-testid="ai-prediction-badge"
            >
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {predictionLoading ? (
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> Predicting ack rate…
                </span>
              ) : prediction ? (
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <Badge
                    className={`text-xs border ${predictionBadgeClass(prediction.predictedAckRate)}`}
                    data-testid="badge-predicted-ack-rate"
                  >
                    ~{prediction.predictedAckRate}% predicted ack rate
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">{confidenceLabel(prediction.confidence)}</span>
                  {prediction.rationale && (
                    <p className="w-full text-[11px] text-muted-foreground">{prediction.rationale}</p>
                  )}
                </div>
              ) : null}
            </div>
          )}

          <div className="pt-2 flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              data-testid="button-cancel-schedule"
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => scheduleMut.mutate()}
              disabled={!scheduledDate || scheduleMut.isPending}
              data-testid="button-confirm-schedule"
            >
              {scheduleMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {requiresApproval ? "Submit for Approval" : "Schedule Launch"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Wave Rollout management (Task #662) ──────────────────────────────────────

interface WaveSopRow {
  sopMasterId: string;
  sopId: string | null;
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

function RolloutView({ onViewDetails }: { onViewDetails?: (id: string) => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const canSchedule = ["super_admin", "admin", "director"].includes(user?.role || "");

  const { data, isLoading } = useQuery<WavesResponse>({
    queryKey: ["/api/sops/waves"],
    staleTime: 15000,
  });

  const { data: scheduledData } = useQuery<{ launches: ScheduledLaunch[] }>({
    queryKey: ["/api/sops/waves/scheduled"],
    staleTime: 30000,
    enabled: canSchedule,
  });

  const [scheduleDrawerWave, setScheduleDrawerWave] = useState<{
    waveNumber: number;
    name: string;
    enforcement: string;
  } | null>(null);

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

  const cancelScheduleMut = useMutation({
    mutationFn: async (scheduleId: string) =>
      (await apiRequest("DELETE", `/api/sops/waves/schedule/${scheduleId}`, {})).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sops/waves/scheduled"] });
      toast({ title: "Schedule cancelled" });
    },
    onError: (e: any) =>
      toast({ title: "Failed to cancel schedule", description: e?.message, variant: "destructive" }),
  });

  const getScheduledLaunch = (waveNumber: number) =>
    (scheduledData?.launches ?? []).find(
      (l) => l.waveNumber === waveNumber && ["pending_approval", "approved"].includes(l.status),
    );

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

      {waves.map((wave) => {
        const scheduledLaunch = getScheduledLaunch(wave.waveNumber);
        return (
          <Card key={wave.waveNumber} data-testid={`card-wave-${wave.waveNumber}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
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
                    {scheduledLaunch && (
                      <span className="inline-flex items-center gap-1" data-testid={`scheduled-chip-${wave.waveNumber}`}>
                        <Badge
                          variant="secondary"
                          className="gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200"
                        >
                          <CalendarDays className="h-3 w-3" />
                          Scheduled —{" "}
                          {new Date(scheduledLaunch.scheduledDate).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                          {scheduledLaunch.status === "pending_approval" && " (pending approval)"}
                        </Badge>
                        <button
                          className="ml-0.5 rounded p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Cancel scheduled rollout"
                          onClick={() => {
                            if (window.confirm("Cancel this scheduled rollout?")) {
                              cancelScheduleMut.mutate(scheduledLaunch.id);
                            }
                          }}
                          data-testid={`button-cancel-schedule-${wave.waveNumber}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    )}
                  </CardTitle>
                  {wave.description && <p className="text-xs text-muted-foreground mt-1">{wave.description}</p>}
                  {wave.audience && <p className="text-xs text-muted-foreground mt-1">Audience: {wave.audience}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    {wave.operationalCount}/{wave.totalCount} SOPs operational
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {canSchedule && !scheduledLaunch && ["planned", "active"].includes(wave.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setScheduleDrawerWave({
                          waveNumber: wave.waveNumber,
                          name: wave.name,
                          enforcement: wave.enforcement,
                        })
                      }
                      data-testid={`button-schedule-wave-${wave.waveNumber}`}
                    >
                      <CalendarDays className="h-3.5 w-3.5 mr-1" /> Schedule Rollout
                    </Button>
                  )}
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
                      {onViewDetails && sop.sopId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => onViewDetails(sop.sopId!)}
                          data-testid={`button-view-sop-detail-${sop.code}`}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span className="sr-only">Details</span>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {scheduleDrawerWave && (
        <ScheduleRolloutDrawer
          waveNumber={scheduleDrawerWave.waveNumber}
          waveName={scheduleDrawerWave.name}
          waveEnforcement={scheduleDrawerWave.enforcement}
          open={!!scheduleDrawerWave}
          onClose={() => setScheduleDrawerWave(null)}
          onScheduled={() => setScheduleDrawerWave(null)}
          cadenceWindowCount={cadence.windowCount}
          cadenceMax={cadence.max}
        />
      )}
    </div>
  );
}
