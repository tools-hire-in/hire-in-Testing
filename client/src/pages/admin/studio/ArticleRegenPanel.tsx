import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Activity,
  Loader2,
  RefreshCw,
  MessageSquarePlus,
  AlertTriangle,
  Zap,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  XCircle,
  Cpu,
  Info,
} from "lucide-react";
import type { StudioRegenRequest } from "@shared/schema";

interface ModelStatus {
  current: boolean;
  articleModel: string | null;
  activeModel: string;
}

interface RegenResult {
  draft: { title?: string; body_markdown?: string; excerpt?: string };
  originalMarkdown: string;
  safetyPass: boolean;
  safetyFailures: Array<{ rule: string; message: string }>;
  tokenEstimate: number;
  model: string;
  mode: string;
}

interface BriefFields {
  hookPattern: string;
  desiredEmotion: string;
  contentStructure: string;
  engagementGoal: string;
}

interface ArticleRegenPanelProps {
  articleId: string;
  articleTitle: string;
  currentMarkdown: string;
  initialBrief?: Partial<BriefFields>;
  /** Resolved staffing domain from the article — passed as `industry` in the regen payload. */
  domainResolved?: string;
  onCommit: (newMarkdown: string, newTitle?: string, mode?: string) => void;
  /** When true, only renders the outdated-model badge (for article header); dialogs still work */
  badgeOnly?: boolean;
  /** Increment this value to programmatically open the rework-with-feedback flow */
  reworkKey?: number;
}

type RegenStep = "idle" | "feedback" | "preflight" | "generating" | "diff";

export function ArticleRegenPanel({
  articleId,
  articleTitle,
  currentMarkdown,
  initialBrief,
  domainResolved,
  onCommit,
  badgeOnly = false,
  reworkKey,
}: ArticleRegenPanelProps) {
  const { toast } = useToast();
  const { role } = usePermissions();
  const isSuperAdmin = role === "super_admin";

  const [step, setStep] = useState<RegenStep>("idle");
  const [regenMode, setRegenMode] = useState<"full" | "rework">("full");

  // Request flow (non-approved users)
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestReason, setRequestReason] = useState("");
  const [requestFeedback, setRequestFeedback] = useState("");

  // Feedback (rework) and brief (full) state
  const [feedbackNote, setFeedbackNote] = useState("");
  const [brief, setBrief] = useState<BriefFields>({
    hookPattern: initialBrief?.hookPattern ?? "",
    desiredEmotion: initialBrief?.desiredEmotion ?? "",
    contentStructure: initialBrief?.contentStructure ?? "",
    engagementGoal: initialBrief?.engagementGoal ?? "",
  });

  const [regenResult, setRegenResult] = useState<RegenResult | null>(null);

  const { data: modelStatus } = useQuery<ModelStatus>({
    queryKey: ["/api/admin/studio/articles", articleId, "model-status"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/studio/articles/${articleId}/model-status`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to check model status");
      return res.json();
    },
    enabled: !!articleId,
    staleTime: 60000,
  });

  const { data: myRequests = [] } = useQuery<StudioRegenRequest[]>({
    queryKey: ["/api/admin/studio/articles", articleId, "regen-requests"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/studio/articles/${articleId}/regen-requests`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!articleId,
    refetchInterval: 30000,
  });

  type PerfSummary = { id: string; platform: string; measuredAt: string; impressions: number|null; reactions: number|null; shares: number|null; reach: number|null; whatWorked: string|null; loggedByName: string };
  const { data: pastPerf = [] } = useQuery<PerfSummary[]>({
    queryKey: ["/api/admin/studio/articles", articleId, "performance"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/studio/articles/${articleId}/performance`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!articleId,
    staleTime: 60000,
  });

  const activeApproval = myRequests.find(
    (r) => r.status === "approved" && r.expiresAt && new Date(r.expiresAt) > new Date()
  );
  const pendingRequest = myRequests.find((r) => r.status === "pending");
  const canFireRegen = isSuperAdmin || !!activeApproval;

  const requestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/studio/articles/${articleId}/regen-request`, {
        reason: requestReason,
        feedbackNote: regenMode === "rework" ? requestFeedback : undefined,
        mode: regenMode,
      });
      return res.json();
    },
    onSuccess: () => {
      setRequestOpen(false);
      setRequestReason("");
      setRequestFeedback("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles", articleId, "regen-requests"] });
      toast({ title: "Request submitted", description: "Super admin will review your regeneration request." });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to submit request", description: err.message, variant: "destructive" });
    },
  });

  const regenMutation = useMutation({
    mutationFn: async ({ mode, feedbackNote, confirmedBrief }: { mode: string; feedbackNote?: string; confirmedBrief?: Partial<BriefFields> }) => {
      const res = await apiRequest("POST", `/api/admin/studio/articles/${articleId}/regenerate`, {
        mode,
        feedbackNote,
        confirmedBrief: mode === "full" ? confirmedBrief : undefined,
        industry: domainResolved || undefined,
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Regeneration failed");
      }
      return res.json() as Promise<RegenResult>;
    },
    onSuccess: (data) => {
      setRegenResult(data);
      setStep("diff");
    },
    onError: (err: Error) => {
      setStep("idle");
      toast({ title: "Regeneration failed", description: err.message, variant: "destructive" });
    },
  });

  const commitMutation = useMutation({
    mutationFn: async () => {
      if (!regenResult) throw new Error("No result to commit");
      const res = await apiRequest("POST", `/api/admin/studio/articles/${articleId}/regenerate/commit`, {
        bodyMarkdown: regenResult.draft.body_markdown,
        title: regenResult.draft.title,
        mode: regenResult.mode,
        feedbackNote: regenMode === "rework" ? feedbackNote : undefined,
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to save");
      }
      return res.json();
    },
    onSuccess: () => {
      onCommit(regenResult!.draft.body_markdown ?? "", regenResult?.draft.title, regenResult?.mode);
      setStep("idle");
      setRegenResult(null);
      setFeedbackNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles", articleId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles", articleId, "versions"] });
      toast({ title: "New version saved", description: "Article moved to In Review." });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save version", description: err.message, variant: "destructive" });
    },
  });

  // Rough token estimate for preflight display
  const estimatedWords = (currentMarkdown ?? "").split(/\s+/).filter(Boolean).length;
  const estimatedTokens = Math.ceil(estimatedWords * 1.4) + 800;

  const handleFullClick = () => {
    if (!canFireRegen) {
      setRegenMode("full");
      setRequestOpen(true);
      return;
    }
    // Reset brief to initialBrief values before opening preflight
    setBrief({
      hookPattern: initialBrief?.hookPattern ?? "",
      desiredEmotion: initialBrief?.desiredEmotion ?? "",
      contentStructure: initialBrief?.contentStructure ?? "",
      engagementGoal: initialBrief?.engagementGoal ?? "",
    });
    setRegenMode("full");
    setStep("preflight");
  };

  // Programmatic rework trigger — called from toolbar "Regenerate with Feedback" button.
  useEffect(() => {
    if (!reworkKey) return;
    if (!canFireRegen) {
      setRegenMode("rework");
      setRequestOpen(true);
      return;
    }
    setFeedbackNote(activeApproval?.feedbackNote ?? "");
    setRegenMode("rework");
    setStep("feedback");
  // reworkKey is the only dep that should trigger this; other values are stable per-render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reworkKey]);

  const handleReworkClick = () => {
    if (!canFireRegen) {
      setRegenMode("rework");
      setRequestOpen(true);
      return;
    }
    setFeedbackNote(activeApproval?.feedbackNote ?? "");
    setRegenMode("rework");
    setStep("feedback");
  };

  const handleFeedbackNext = () => {
    if (!feedbackNote.trim()) return;
    setStep("preflight");
  };

  const handleConfirmGenerate = () => {
    setStep("generating");
    regenMutation.mutate({
      mode: regenMode,
      feedbackNote: regenMode === "rework" ? feedbackNote : undefined,
      confirmedBrief: regenMode === "full" ? brief : undefined,
    });
  };

  const expiresIn = activeApproval?.expiresAt
    ? Math.max(0, Math.floor((new Date(activeApproval.expiresAt).getTime() - Date.now()) / (1000 * 60)))
    : null;

  const outdatedBadge = modelStatus && !modelStatus.current ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleFullClick}
            className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5 hover:bg-amber-100 transition-colors"
            data-testid="badge-outdated-model-header"
          >
            <Cpu className="h-3 w-3 flex-shrink-0" />
            <span>Outdated model</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-60">
          <p className="text-xs">Generated with <strong>{modelStatus.articleModel}</strong>. Click to regenerate with the current model ({modelStatus.activeModel}).</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : null;

  // ── Badge-only mode: render just the outdated model chip + dialogs ──
  if (badgeOnly) {
    return (
      <>
        {outdatedBadge}
        {renderDialogs()}
      </>
    );
  }

  // ── Full sidebar card mode ──
  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Regenerate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Outdated model badge */}
          {modelStatus && !modelStatus.current && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2 py-1" data-testid="badge-outdated-model">
              <Cpu className="h-3 w-3 flex-shrink-0" />
              <span>Outdated model ({modelStatus.articleModel})</span>
            </div>
          )}

          {/* Approval status */}
          {!isSuperAdmin && activeApproval && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1" data-testid="badge-regen-approved">
              <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
              <span>Approved — {expiresIn}m left</span>
            </div>
          )}
          {!isSuperAdmin && pendingRequest && !activeApproval && (
            <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-md px-2 py-1" data-testid="badge-regen-pending">
              <Clock className="h-3 w-3 flex-shrink-0" />
              <span>Request pending approval</span>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-xs"
            onClick={handleFullClick}
            disabled={!canFireRegen && !!pendingRequest}
            data-testid="button-regen-full"
          >
            <Zap className="mr-2 h-3 w-3" />
            {canFireRegen ? "Regenerate Article" : "Request Regeneration"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-xs"
            onClick={handleReworkClick}
            disabled={!canFireRegen && !!pendingRequest}
            data-testid="button-regen-rework"
          >
            <MessageSquarePlus className="mr-2 h-3 w-3" />
            {canFireRegen ? "Rework with Feedback" : "Request Rework"}
          </Button>
        </CardContent>
      </Card>

      {renderDialogs()}
    </>
  );

  function renderDialogs() {
    return (
      <>
        {/* ── Request dialog ── */}
        <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {regenMode === "rework" ? <MessageSquarePlus className="h-5 w-5" /> : <RefreshCw className="h-5 w-5" />}
                Request {regenMode === "rework" ? "Rework" : "Regeneration"}
              </DialogTitle>
              <DialogDescription>
                {regenMode === "rework"
                  ? "Describe what to improve. Super admin will review and approve this request."
                  : "Provide a reason for regenerating this article. Super admin will review and approve."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="req-reason">Reason *</Label>
                <Textarea
                  id="req-reason"
                  placeholder="Why does this article need regeneration?"
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  rows={3}
                  data-testid="input-regen-reason"
                />
              </div>
              {regenMode === "rework" && (
                <div className="space-y-2">
                  <Label htmlFor="req-feedback">Feedback / instructions *</Label>
                  <Textarea
                    id="req-feedback"
                    placeholder="e.g. Strengthen the hook, remove the placement rate claim, shorten the intro by half"
                    value={requestFeedback}
                    onChange={(e) => setRequestFeedback(e.target.value)}
                    rows={4}
                    data-testid="input-regen-feedback"
                  />
                  <p className="text-xs text-muted-foreground">These instructions will be passed to the AI when approved.</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRequestOpen(false)} data-testid="button-cancel-regen-request">Cancel</Button>
              <Button
                onClick={() => requestMutation.mutate()}
                disabled={!requestReason.trim() || (regenMode === "rework" && !requestFeedback.trim()) || requestMutation.isPending}
                data-testid="button-submit-regen-request"
              >
                {requestMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Feedback capture (rework, always required) ── */}
        <Dialog open={step === "feedback"} onOpenChange={(open) => { if (!open) setStep("idle"); }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquarePlus className="h-5 w-5" />
                Rework Instructions
              </DialogTitle>
              <DialogDescription>
                The current article body will be passed to the AI alongside these instructions so it can revise rather than start from scratch.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Label htmlFor="feedback-text">What should be improved? *</Label>
              <Textarea
                id="feedback-text"
                placeholder="e.g. Strengthen the hook, remove the placement rate claim, shorten the intro by half, add a CTA in the closing paragraph"
                value={feedbackNote}
                onChange={(e) => setFeedbackNote(e.target.value)}
                rows={5}
                data-testid="input-preflight-feedback"
              />
              <p className="text-xs text-muted-foreground">Be specific — the AI will incorporate these changes while keeping the article structure intact.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("idle")} data-testid="button-feedback-back">Cancel</Button>
              <Button onClick={handleFeedbackNext} disabled={!feedbackNote.trim()} data-testid="button-feedback-next">
                Continue to Preview
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Preflight / brief review + cost estimate ── */}
        <Dialog open={step === "preflight"} onOpenChange={(open) => { if (!open) setStep("idle"); }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Confirm Regeneration
              </DialogTitle>
              <DialogDescription>
                Review and edit the intelligence fields below before launching the AI generation job.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Cost estimate row */}
              <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Mode</span>
                  <Badge variant="outline" className="capitalize text-xs">{regenMode}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Est. tokens</span>
                  <span>~{estimatedTokens.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Model</span>
                  <span className="font-medium">{modelStatus?.activeModel ?? "gpt-5.4"}</span>
                </div>
              </div>

              {/* Past Performance context block */}
              {pastPerf.length > 0 && (() => {
                const top = pastPerf[0];
                return (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-950/20 p-3 space-y-1 text-xs" data-testid="past-performance-context">
                    <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                      <Activity className="h-3.5 w-3.5" />
                      AI will use past performance data
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                      <span className="capitalize font-medium text-foreground">{top.platform}</span>
                      {top.impressions != null && <span><strong className="text-foreground">{top.impressions.toLocaleString()}</strong> impr.</span>}
                      {top.reactions != null && <span><strong className="text-foreground">{top.reactions}</strong> react.</span>}
                      {top.shares != null && <span><strong className="text-foreground">{top.shares}</strong> shares</span>}
                      {top.reach != null && <span><strong className="text-foreground">{top.reach.toLocaleString()}</strong> reach</span>}
                    </div>
                    {top.whatWorked && <p className="italic text-muted-foreground">"{top.whatWorked}"</p>}
                    {pastPerf.length > 1 && <p className="text-[10px] text-muted-foreground">+{pastPerf.length - 1} more entr{pastPerf.length === 2 ? "y" : "ies"} included in context</p>}
                  </div>
                );
              })()}

              {/* Rework feedback summary */}
              {regenMode === "rework" && feedbackNote && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Feedback instructions</Label>
                  <p className="text-xs bg-muted rounded-md border p-2 leading-relaxed">{feedbackNote}</p>
                </div>
              )}

              {/* Editable intelligence brief fields (full mode only) */}
              {regenMode === "full" && (
                <div className="space-y-3 border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Intelligence fields (auto-resolved — edit to override)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="brief-hook" className="text-xs">Hook pattern</Label>
                      <Input
                        id="brief-hook"
                        value={brief.hookPattern}
                        onChange={(e) => setBrief((b) => ({ ...b, hookPattern: e.target.value }))}
                        placeholder="e.g. insider_contrast"
                        className="text-xs h-8"
                        data-testid="input-brief-hookpattern"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="brief-emotion" className="text-xs">Desired emotion</Label>
                      <Input
                        id="brief-emotion"
                        value={brief.desiredEmotion}
                        onChange={(e) => setBrief((b) => ({ ...b, desiredEmotion: e.target.value }))}
                        placeholder="e.g. Challenged"
                        className="text-xs h-8"
                        data-testid="input-brief-desiredemotion"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="brief-structure" className="text-xs">Content structure</Label>
                      <Input
                        id="brief-structure"
                        value={brief.contentStructure}
                        onChange={(e) => setBrief((b) => ({ ...b, contentStructure: e.target.value }))}
                        placeholder="e.g. the_framework"
                        className="text-xs h-8"
                        data-testid="input-brief-contentstructure"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="brief-engagement" className="text-xs">Engagement goal</Label>
                      <Input
                        id="brief-engagement"
                        value={brief.engagementGoal}
                        onChange={(e) => setBrief((b) => ({ ...b, engagementGoal: e.target.value }))}
                        placeholder="e.g. Follow for more"
                        className="text-xs h-8"
                        data-testid="input-brief-engagementgoal"
                      />
                    </div>
                  </div>
                </div>
              )}

              <Alert className="border-amber-200 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700 text-xs">
                  This will consume AI tokens. The new draft will be shown for review before anything is saved.
                </AlertDescription>
              </Alert>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStep(regenMode === "rework" ? "feedback" : "idle")}
                data-testid="button-preflight-back"
              >
                Back
              </Button>
              <Button onClick={handleConfirmGenerate} data-testid="button-preflight-confirm">
                Generate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Generating spinner ── */}
        <Dialog open={step === "generating"} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-xs text-center">
            <div className="py-6 flex flex-col items-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div>
                <p className="font-medium">Generating draft…</p>
                <p className="text-xs text-muted-foreground mt-1">This may take 20–60 seconds</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Diff view ── */}
        <Dialog
          open={step === "diff"}
          onOpenChange={(open) => { if (!open) { setStep("idle"); setRegenResult(null); } }}
        >
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Review Regenerated Draft
              </DialogTitle>
              <DialogDescription>
                Compare the new draft with the original. Save as a new version or discard.
              </DialogDescription>
            </DialogHeader>

            {regenResult && (
              <div className="flex-1 overflow-auto space-y-4">
                {!regenResult.safetyPass && (
                  <Alert className="border-amber-200 bg-amber-50">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-700 text-sm">
                      Safety gate flagged {regenResult.safetyFailures.length} issue(s). Review carefully before saving.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Model: <strong>{regenResult.model}</strong></span>
                  <span>~{regenResult.tokenEstimate.toLocaleString()} tokens</span>
                  <span className="capitalize">Mode: {regenResult.mode}</span>
                  <Badge variant="outline" className="text-xs h-5">
                    {regenResult.safetyPass ? "Safety PASS" : "Safety WARN"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Current</Label>
                    <div className="border rounded-md p-3 text-xs font-mono bg-muted/30 overflow-auto max-h-80 whitespace-pre-wrap leading-relaxed">
                      {regenResult.originalMarkdown || "(empty)"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2 block">New Draft</Label>
                    <div className="border-2 border-emerald-200 rounded-md p-3 text-xs font-mono bg-emerald-50/30 overflow-auto max-h-80 whitespace-pre-wrap leading-relaxed">
                      {regenResult.draft.body_markdown || "(empty)"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="mt-4 flex-shrink-0">
              <Button
                variant="outline"
                onClick={() => { setStep("idle"); setRegenResult(null); }}
                data-testid="button-discard-regen"
              >
                Discard
              </Button>
              <Button
                onClick={() => commitMutation.mutate()}
                disabled={commitMutation.isPending}
                data-testid="button-save-regen-version"
              >
                {commitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save as New Version
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }
}

// ─── Standalone outdated model badge ─────────────────────────────────────────

export function OutdatedModelBadge({ articleId, onRegenClick }: { articleId: string; onRegenClick?: () => void }) {
  const { data: modelStatus } = useQuery<ModelStatus>({
    queryKey: ["/api/admin/studio/articles", articleId, "model-status"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/studio/articles/${articleId}/model-status`, { credentials: "include" });
      if (!res.ok) return { current: true, articleModel: null, activeModel: "gpt-5.4" };
      return res.json();
    },
    enabled: !!articleId,
    staleTime: 300000,
  });

  if (!modelStatus || modelStatus.current) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRegenClick?.(); }}
            className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5 hover:bg-amber-100 transition-colors"
            data-testid={`badge-outdated-model-${articleId}`}
          >
            <Cpu className="h-2.5 w-2.5" />
            <span>Outdated model</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Generated with {modelStatus.articleModel} — click to upgrade</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Admin queue ──────────────────────────────────────────────────────────────

interface EnrichedRegenRequest extends StudioRegenRequest {
  articleTitle: string;
  requesterName: string;
  approverName: string | null;
}

export function RegenRequestsQueue() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [approveId, setApproveId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: requests = [], isLoading } = useQuery<EnrichedRegenRequest[]>({
    queryKey: ["/api/admin/studio/regen-requests", filter],
    queryFn: async () => {
      const params = filter === "pending" ? "?status=pending" : "";
      const res = await fetch(`/api/admin/studio/regen-requests${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30000,
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action, approvalNote }: { id: string; action: "approve" | "reject"; approvalNote?: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/studio/regen-requests/${id}`, { action, approvalNote });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Action failed");
      }
      return res.json();
    },
    onSuccess: (_data, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/regen-requests"] });
      toast({ title: `Request ${action === "approve" ? "approved" : "rejected"}` });
      setApproveId(null);
      setRejectId(null);
      setNote("");
    },
    onError: (err: Error) => {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    },
  });

  const statusColor = (status: string) => {
    if (status === "pending") return "bg-yellow-50 text-yellow-700 border-yellow-200";
    if (status === "approved") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (status === "rejected") return "bg-red-50 text-red-700 border-red-200";
    return "bg-gray-50 text-gray-600 border-gray-200";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant={filter === "pending" ? "default" : "outline"} size="sm" onClick={() => setFilter("pending")} data-testid="filter-regen-pending">Pending</Button>
        <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")} data-testid="filter-regen-all">All</Button>
      </div>

      {isLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
      {!isLoading && requests.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No {filter === "pending" ? "pending " : ""}requests.</p>}

      <div className="space-y-2">
        {requests.map((req) => (
          <div key={req.id} className="border rounded-lg p-4 space-y-2" data-testid={`regen-request-${req.id}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{req.articleTitle}</p>
                <p className="text-xs text-muted-foreground">{req.requesterName} · {new Date(req.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs border rounded px-1.5 py-0.5 capitalize ${statusColor(req.status)}`}>{req.status}</span>
                <Badge variant="outline" className="text-xs capitalize">{req.mode}</Badge>
                <button onClick={() => setExpandedId(expandedId === req.id ? null : req.id)} className="text-muted-foreground hover:text-foreground" data-testid={`toggle-regen-${req.id}`}>
                  {expandedId === req.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {expandedId === req.id && (
              <div className="space-y-2 pt-2 border-t">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Reason</p>
                  <p className="text-sm">{req.reason}</p>
                </div>
                {req.feedbackNote && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Feedback / instructions</p>
                    <p className="text-sm">{req.feedbackNote}</p>
                  </div>
                )}
                {req.approvalNote && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{req.status === "approved" ? "Approval note" : "Rejection reason"}</p>
                    <p className="text-sm">{req.approvalNote}</p>
                  </div>
                )}
                {req.status === "approved" && req.expiresAt && (
                  <p className="text-xs text-muted-foreground">Expires: {new Date(req.expiresAt).toLocaleString()}</p>
                )}
              </div>
            )}

            {req.status === "pending" && (
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" onClick={() => { setApproveId(req.id); setNote(""); }} disabled={actionMutation.isPending} data-testid={`button-approve-regen-${req.id}`}>
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setRejectId(req.id); setNote(""); }} disabled={actionMutation.isPending} data-testid={`button-reject-regen-${req.id}`}>
                  <XCircle className="mr-1 h-3 w-3" />
                  Reject
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={!!approveId} onOpenChange={(open) => { if (!open) setApproveId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Regeneration Request</DialogTitle>
            <DialogDescription>The requester will have 24 hours to trigger regeneration after approval.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="approve-note">Note (optional)</Label>
            <Textarea id="approve-note" placeholder="Any guidance for the requester..." value={note} onChange={(e) => setNote(e.target.value)} rows={3} data-testid="input-approve-note" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveId(null)}>Cancel</Button>
            <Button onClick={() => actionMutation.mutate({ id: approveId!, action: "approve", approvalNote: note || undefined })} disabled={actionMutation.isPending} data-testid="button-confirm-approve">
              {actionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectId} onOpenChange={(open) => { if (!open) setRejectId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Reject Regeneration Request</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-note">Reason (optional)</Label>
            <Textarea id="reject-note" placeholder="Why is this request being rejected?" value={note} onChange={(e) => setNote(e.target.value)} rows={3} data-testid="input-reject-note" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => actionMutation.mutate({ id: rejectId!, action: "reject", approvalNote: note || undefined })} disabled={actionMutation.isPending} data-testid="button-confirm-reject">
              {actionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
