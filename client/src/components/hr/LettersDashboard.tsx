import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  FileText, Loader2, Search, Eye, Download, RotateCcw, XCircle, CheckCircle, Clock,
  Shield, Mail, Printer, RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Send,
  Undo2, Edit3, CornerUpLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LetterPreview } from "./LetterPreview";
import { LetterGenerator } from "./LetterGenerator";
import { TEMPLATE_LABELS } from "@shared/hrLetterConstants";
import type { HrLetter } from "@shared/schema";
import type { LucideIcon } from "lucide-react";

// ─── Status configuration ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  icon: LucideIcon;
  className?: string;
}> = {
  draft:            { label: "Draft",              variant: "secondary",    icon: Clock },
  pending_approval: { label: "Pending Approval",   variant: "outline",      icon: Clock },
  approved:         { label: "Approved",            variant: "default",      icon: CheckCircle },
  issued:           { label: "Issued",              variant: "default",      icon: Shield },
  reissued:         { label: "Reissued",            variant: "secondary",    icon: RotateCcw },
  revoked:          { label: "Revoked",             variant: "destructive",  icon: XCircle },
  needs_revision:   { label: "Needs Revision",      variant: "outline",      icon: AlertTriangle, className: "border-amber-500 text-amber-700 bg-amber-50" },
  resubmitted:      { label: "Resubmitted",         variant: "outline",      icon: Send,          className: "border-blue-500 text-blue-700 bg-blue-50" },
  withdrawn:        { label: "Withdrawn",           variant: "secondary",    icon: Undo2,         className: "text-slate-500" },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReviewCycle {
  id: string;
  letterId: string;
  round: number;
  action: "approved" | "needs_revision" | "withdrawn" | "resubmitted";
  reason: string | null;
  reviewedBy: string | null;
  reviewedAt: string;
  reviewerFirstName: string | null;
  reviewerLastName: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const APPROVER_ROLES = ["super_admin", "admin", "hr"];

function canApprove(role: string | undefined): boolean {
  return APPROVER_ROLES.includes(role ?? "");
}

function reviewActionLabel(action: ReviewCycle["action"]): { label: string; className: string } {
  switch (action) {
    case "approved":       return { label: "Approved",          className: "text-green-700 bg-green-50 border-green-200" };
    case "needs_revision": return { label: "Sent for Revision", className: "text-amber-700 bg-amber-50 border-amber-200" };
    case "resubmitted":    return { label: "Resubmitted",       className: "text-blue-700 bg-blue-50 border-blue-200" };
    case "withdrawn":      return { label: "Withdrawn",         className: "text-slate-700 bg-slate-50 border-slate-200" };
    default:               return { label: action,              className: "" };
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try { return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return dateStr; }
}

// ─── Review History Panel ────────────────────────────────────────────────────

function ReviewHistoryPanel({ letterId }: { letterId: string }) {
  const [open, setOpen] = useState(false);

  const { data: cycles = [], isLoading } = useQuery<ReviewCycle[]>({
    queryKey: ["/api/hr/letters", letterId, "review-cycles"],
    queryFn: async () => {
      const res = await fetch(`/api/hr/letters/${letterId}/review-cycles`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between px-0 text-sm font-medium" data-testid="btn-toggle-review-history">
          <span className="flex items-center gap-2">
            <CornerUpLeft className="h-4 w-4 text-muted-foreground" />
            Review History
          </span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : cycles.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No review history yet.</p>
        ) : (
          <div className="space-y-2" data-testid="review-history-list">
            {cycles.map((cycle) => {
              const { label, className: cls } = reviewActionLabel(cycle.action);
              const reviewerName = cycle.reviewerFirstName
                ? `${cycle.reviewerFirstName} ${cycle.reviewerLastName ?? ""}`.trim()
                : "System";
              return (
                <div key={cycle.id} className="rounded-md border p-3 text-sm space-y-1" data-testid={`review-cycle-${cycle.id}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Round {cycle.round}</span>
                      <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(cycle.reviewedAt)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">by {reviewerName}</div>
                  {cycle.reason && (
                    <div className="mt-1 text-xs rounded bg-muted px-2 py-1">{cycle.reason}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Approval Bar ─────────────────────────────────────────────────────────────

interface ApprovalBarProps {
  letter: HrLetter;
  onApproved: () => void;
  onRevisionRequested: () => void;
}

function ApprovalBar({ letter, onApproved, onRevisionRequested }: ApprovalBarProps) {
  const { toast } = useToast();
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionReason, setRevisionReason] = useState("");

  const approveOrReviseMutation = useMutation({
    mutationFn: async (params: { action: "approve" | "needs_revision"; revisionReason?: string }) => {
      const res = await apiRequest("POST", `/api/hr/letters/${letter.id}/approve-or-revise`, params);
      return res.json();
    },
    onSuccess: (_, vars) => {
      if (vars.action === "approve") {
        toast({ title: "Letter approved" });
        onApproved();
      } else {
        toast({ title: "Sent back for revision" });
        setShowRevisionModal(false);
        setRevisionReason("");
        onRevisionRequested();
      }
      queryClient.invalidateQueries({ queryKey: ["/api/hr/letters"] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <>
      <div className="rounded-md border bg-muted/30 p-3" data-testid="approval-bar">
        <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Approval decision</p>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={() => approveOrReviseMutation.mutate({ action: "approve" })}
            disabled={approveOrReviseMutation.isPending}
            data-testid="btn-approve-letter"
          >
            {approveOrReviseMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
            Approve
          </Button>
          <Button
            variant="outline"
            className="flex-1 border-amber-400 text-amber-700 hover:bg-amber-50"
            onClick={() => setShowRevisionModal(true)}
            disabled={approveOrReviseMutation.isPending}
            data-testid="btn-send-back-for-revision"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Send Back for Revision
          </Button>
        </div>
      </div>

      <Dialog open={showRevisionModal} onOpenChange={(open) => { setShowRevisionModal(open); if (!open) setRevisionReason(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Request Revision
            </DialogTitle>
            <DialogDescription>
              Explain what needs to be changed. The creator will see this message before editing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Revision Reason <span className="text-destructive">*</span></Label>
            <Textarea
              value={revisionReason}
              onChange={e => setRevisionReason(e.target.value)}
              placeholder="Describe what needs to be corrected or updated..."
              rows={4}
              data-testid="input-revision-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRevisionModal(false); setRevisionReason(""); }}>Cancel</Button>
            <Button
              variant="default"
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => approveOrReviseMutation.mutate({ action: "needs_revision", revisionReason })}
              disabled={!revisionReason.trim() || approveOrReviseMutation.isPending}
              data-testid="btn-confirm-revision-request"
            >
              {approveOrReviseMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Back for Revision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function LettersDashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedLetter, setSelectedLetter] = useState<HrLetter | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [revokeDialog, setRevokeDialog] = useState<HrLetter | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [reissueDialog, setReissueDialog] = useState<HrLetter | null>(null);
  const [reissueReason, setReissueReason] = useState("");
  const [emailCcDialog, setEmailCcDialog] = useState<HrLetter | null>(null);
  const [emailCcInput, setEmailCcInput] = useState("");
  const [withdrawDialog, setWithdrawDialog] = useState<HrLetter | null>(null);
  const [editSheet, setEditSheet] = useState<HrLetter | null>(null);

  const { data: letters = [], isLoading } = useQuery<HrLetter[]>({
    queryKey: ["/api/hr/letters", { templateType: templateFilter !== "all" ? templateFilter : undefined, status: statusFilter !== "all" ? statusFilter : undefined, search: search || undefined }],
  });

  const revokeMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await apiRequest("POST", `/api/hr/letters/${id}/revoke`, { revokeReason: reason });
    },
    onSuccess: () => {
      toast({ title: "Letter revoked" });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/letters"] });
      setRevokeDialog(null);
      setRevokeReason("");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const reissueMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await apiRequest("POST", `/api/hr/letters/${id}/reissue`, { reissueReason: reason });
    },
    onSuccess: () => {
      toast({ title: "Letter re-issued", description: "A corrected letter has been issued with the employee's current data." });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/letters"] });
      setReissueDialog(null);
      setReissueReason("");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const emailMutation = useMutation({
    mutationFn: async ({ id, ccEmails }: { id: string; ccEmails?: string }) => {
      const res = await apiRequest("POST", `/api/hr/letters/${id}/email`, ccEmails ? { ccEmails } : undefined);
      return res.json();
    },
    onSuccess: (data: { sentTo: string }) => {
      toast({ title: "Email sent", description: `Letter emailed to ${data.sentTo}` });
      setEmailCcDialog(null);
      setEmailCcInput("");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const withdrawMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/hr/letters/${id}/withdraw`, {});
    },
    onSuccess: () => {
      toast({ title: "Letter withdrawn" });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/letters"] });
      setWithdrawDialog(null);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const reopenMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/hr/letters/${id}/reopen`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Letter reopened", description: "The letter has been moved back to draft." });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/letters"] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });


  function viewLetter(letter: HrLetter) {
    setSelectedLetter(letter);
    setShowPreview(true);
  }

  const isApprover = canApprove(user?.role);
  const currentUserId = (user as any)?.id ?? (user as any)?.userId;

  function isOwner(letter: HrLetter): boolean {
    return letter.createdBy === currentUserId;
  }

  function canWithdraw(letter: HrLetter): boolean {
    return (letter.status === "draft" || letter.status === "pending_approval") && isOwner(letter);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2" data-testid="text-letters-dashboard-title">
          <FileText className="h-5 w-5" />
          Letters
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name, ID, or reference..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" data-testid="input-letters-search" />
          </div>
          <Select value={templateFilter} onValueChange={setTemplateFilter}>
            <SelectTrigger className="w-48" data-testid="select-template-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Templates</SelectItem>
              {Object.entries(TEMPLATE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="select-status-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : letters.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="text-no-letters">No letters found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 px-3 font-medium">Employee</th>
                  <th className="py-2 px-3 font-medium">Template</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 font-medium">Reference</th>
                  <th className="py-2 px-3 font-medium">Issue Date</th>
                  <th className="py-2 px-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {letters.map((letter) => {
                  const sc = STATUS_CONFIG[letter.status] || STATUS_CONFIG.draft;
                  const Icon = sc.icon;
                  const round = (letter as any).revisionRound ?? 0;
                  return (
                    <tr key={letter.id} className="border-b hover:bg-muted/50" data-testid={`row-letter-${letter.id}`}>
                      <td className="py-2 px-3">
                        <div className="font-medium">{letter.employeeName}</div>
                        <div className="text-xs text-muted-foreground">{letter.employeeCode || "—"} · {letter.designation}</div>
                      </td>
                      <td className="py-2 px-3">{TEMPLATE_LABELS[letter.templateType] || letter.templateType}</td>
                      <td className="py-2 px-3">
                        <div className="flex flex-col gap-1">
                          <Badge
                            variant={sc.variant}
                            className={`gap-1 w-fit ${sc.className ?? ""}`}
                            data-testid={`badge-status-${letter.id}`}
                          >
                            <Icon className="h-3 w-3" /> {sc.label}
                          </Badge>
                          {letter.status === "pending_approval" && round > 0 && (
                            <span className="text-xs text-muted-foreground" data-testid={`text-round-${letter.id}`}>
                              Awaiting Review — Round {round + 1}
                            </span>
                          )}
                          {letter.status === "pending_approval" && round === 0 && (
                            <span className="text-xs text-muted-foreground">Awaiting first review</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono text-xs">{letter.referenceNumber || "—"}</td>
                      <td className="py-2 px-3">{letter.issueDate || "—"}</td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-0.5 flex-wrap">
                          {/* View */}
                          <Button variant="ghost" size="sm" onClick={() => viewLetter(letter)} data-testid={`btn-view-letter-${letter.id}`}>
                            <Eye className="h-4 w-4" />
                          </Button>

                          {/* Download / Print — only for issued/reissued letters */}
                          {["issued", "reissued", "approved"].includes(letter.status) && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => window.open(`/api/hr/letters/${letter.id}/download`, "_blank")} data-testid={`btn-download-letter-${letter.id}`}>
                                <Download className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => window.open(`/api/hr/letters/${letter.id}/download?inline=1`, "_blank")} data-testid={`btn-print-letter-${letter.id}`}>
                                <Printer className="h-4 w-4 text-slate-600" />
                              </Button>
                            </>
                          )}

                          {/* Email */}
                          {["issued", "reissued"].includes(letter.status) && (
                            <Button variant="ghost" size="sm" onClick={() => { setEmailCcDialog(letter); setEmailCcInput(""); }} disabled={emailMutation.isPending} data-testid={`btn-email-letter-${letter.id}`}>
                              <Mail className="h-4 w-4 text-blue-600" />
                            </Button>
                          )}

                          {/* Reissue */}
                          {["issued", "reissued"].includes(letter.status) && isApprover && (
                            <Button variant="ghost" size="sm" onClick={() => setReissueDialog(letter)} data-testid={`btn-reissue-letter-${letter.id}`}>
                              <RotateCcw className="h-4 w-4 text-amber-600" />
                            </Button>
                          )}

                          {/* View Reason & Edit — for owner on needs_revision letters */}
                          {letter.status === "needs_revision" && isOwner(letter) && (
                            <Button variant="ghost" size="sm" className="text-amber-700" onClick={() => setEditSheet(letter)} data-testid={`btn-view-revision-${letter.id}`}>
                              <Edit3 className="h-4 w-4" />
                            </Button>
                          )}

                          {/* Withdraw — for draft/pending_approval owned by current user */}
                          {canWithdraw(letter) && (
                            <Button variant="ghost" size="sm" className="text-slate-500" onClick={() => setWithdrawDialog(letter)} data-testid={`btn-withdraw-letter-${letter.id}`}>
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          )}

                          {/* Reopen as Draft — for withdrawn letters owned by current user */}
                          {letter.status === "withdrawn" && isOwner(letter) && (
                            <Button variant="ghost" size="sm" className="text-blue-600" onClick={() => reopenMutation.mutate(letter.id)} disabled={reopenMutation.isPending} data-testid={`btn-reopen-letter-${letter.id}`}>
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}

                          {/* Revoke */}
                          {!["revoked", "withdrawn"].includes(letter.status) && isApprover && (
                            <Button variant="ghost" size="sm" onClick={() => setRevokeDialog(letter)} data-testid={`btn-revoke-letter-${letter.id}`}>
                              <XCircle className="h-4 w-4 text-red-600" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* ─── Letter Detail Sheet ──────────────────────────────────────────────── */}
      <Sheet open={showPreview} onOpenChange={setShowPreview}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <SheetTitle>Letter Details</SheetTitle>
                <SheetDescription>
                  {selectedLetter?.referenceNumber ? `Ref: ${selectedLetter.referenceNumber}` : "Draft"}
                  {selectedLetter?.authCode ? ` | Auth: ${selectedLetter.authCode}` : ""}
                  {selectedLetter && (selectedLetter as any).revisionRound > 0 && (
                    <span className="ml-2 inline-flex items-center rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">
                      Round {(selectedLetter as any).revisionRound + 1} review
                    </span>
                  )}
                </SheetDescription>
              </div>
              {selectedLetter && ["issued", "reissued", "approved"].includes(selectedLetter.status) && (
                <div className="flex gap-1 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => window.open(`/api/hr/letters/${selectedLetter.id}/download`, "_blank")} data-testid="btn-preview-download">
                    <Download className="h-4 w-4 mr-1" /> Download
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.open(`/api/hr/letters/${selectedLetter.id}/download?inline=1`, "_blank")} data-testid="btn-preview-print">
                    <Printer className="h-4 w-4 mr-1" /> Print
                  </Button>
                </div>
              )}
            </div>
          </SheetHeader>

          {selectedLetter && (
            <div className="mt-4 space-y-4">
              {/* Approval bar — shown to approvers when letter is pending */}
              {selectedLetter.status === "pending_approval" && isApprover && (
                <ApprovalBar
                  letter={selectedLetter}
                  onApproved={() => {
                    setShowPreview(false);
                    queryClient.invalidateQueries({ queryKey: ["/api/hr/letters"] });
                  }}
                  onRevisionRequested={() => {
                    setShowPreview(false);
                    queryClient.invalidateQueries({ queryKey: ["/api/hr/letters"] });
                  }}
                />
              )}

              {/* Revision reason banner — for creator viewing a returned letter */}
              {selectedLetter.status === "needs_revision" && (selectedLetter as any).revisionReason && (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800" data-testid="text-revision-reason-banner">
                  <p className="font-semibold mb-1">Returned for revision</p>
                  <p>{(selectedLetter as any).revisionReason}</p>
                </div>
              )}

              <LetterPreview letter={selectedLetter} />

              <Separator />

              <ReviewHistoryPanel letterId={selectedLetter.id} />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ─── Revoke Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={!!revokeDialog} onOpenChange={() => { setRevokeDialog(null); setRevokeReason(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Letter</DialogTitle>
            <DialogDescription>This action cannot be undone. The letter will be marked as revoked.</DialogDescription>
          </DialogHeader>
          <div>
            <Label>Reason for Revocation</Label>
            <Textarea value={revokeReason} onChange={e => setRevokeReason(e.target.value)} placeholder="Enter reason..." data-testid="input-revoke-reason" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => revokeDialog && revokeMutation.mutate({ id: revokeDialog.id, reason: revokeReason })} disabled={!revokeReason || revokeMutation.isPending} data-testid="btn-confirm-revoke">
              {revokeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Revoke Letter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Reissue Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={!!reissueDialog} onOpenChange={() => { setReissueDialog(null); setReissueReason(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-amber-600" />
              Re-issue with Updated Data
            </DialogTitle>
            <DialogDescription>
              A corrected letter will be issued using the employee's current name, designation, and department from their profile.
              The original letter will be marked as reissued.
            </DialogDescription>
          </DialogHeader>
          {reissueDialog && (
            <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 space-y-1" data-testid="text-reissue-info">
              <p className="font-medium">Letter being corrected:</p>
              <p><span className="font-semibold">{reissueDialog.employeeName}</span> — {reissueDialog.designation}{reissueDialog.department ? ` · ${reissueDialog.department}` : ""}</p>
              <p className="text-xs text-amber-700 mt-1">The new letter will pull the latest name, designation, and department directly from the employee record and be issued immediately.</p>
            </div>
          )}
          <div>
            <Label>Reason for Re-issue</Label>
            <Textarea value={reissueReason} onChange={e => setReissueReason(e.target.value)} placeholder="e.g. Employee name updated after marriage..." data-testid="input-reissue-reason" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReissueDialog(null)}>Cancel</Button>
            <Button onClick={() => reissueDialog && reissueMutation.mutate({ id: reissueDialog.id, reason: reissueReason })} disabled={!reissueReason || reissueMutation.isPending} data-testid="btn-confirm-reissue">
              {reissueMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Re-issue with Updated Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Email CC Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={!!emailCcDialog} onOpenChange={(open) => { if (!open) { setEmailCcDialog(null); setEmailCcInput(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-600" />
              Send Letter by Email
            </DialogTitle>
            <DialogDescription>
              The letter will be emailed to the employee. Optionally add CC recipients below.
            </DialogDescription>
          </DialogHeader>
          {emailCcDialog && (
            <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800 space-y-1">
              <p className="font-medium">{emailCcDialog.employeeName}</p>
              <p className="text-xs">{emailCcDialog.referenceNumber || "Draft"}</p>
            </div>
          )}
          <div className="space-y-2">
            <Label>CC Recipients <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              data-testid="input-hr-letter-cc"
              placeholder="manager@hire-in.com, ceo@hire-in.com"
              value={emailCcInput}
              onChange={e => setEmailCcInput(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Separate multiple emails with commas</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEmailCcDialog(null); setEmailCcInput(""); }}>Cancel</Button>
            <Button
              onClick={() => emailCcDialog && emailMutation.mutate({ id: emailCcDialog.id, ccEmails: emailCcInput.trim() || undefined })}
              disabled={emailMutation.isPending}
              data-testid="btn-confirm-email-letter"
            >
              {emailMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Withdraw Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={!!withdrawDialog} onOpenChange={() => setWithdrawDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="h-4 w-4 text-slate-600" />
              Withdraw Letter
            </DialogTitle>
            <DialogDescription>
              This letter will be withdrawn. You can reopen it as a draft later if needed.
            </DialogDescription>
          </DialogHeader>
          {withdrawDialog && (
            <div className="rounded-md bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <p className="font-medium">{withdrawDialog.employeeName}</p>
              <p className="text-xs text-slate-500">{TEMPLATE_LABELS[withdrawDialog.templateType] || withdrawDialog.templateType}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawDialog(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => withdrawDialog && withdrawMutation.mutate(withdrawDialog.id)}
              disabled={withdrawMutation.isPending}
              data-testid="btn-confirm-withdraw"
            >
              {withdrawMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Withdraw Letter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit & Resubmit Sheet (LetterGenerator in edit mode) ─────────────── */}
      <Sheet open={!!editSheet} onOpenChange={(open) => { if (!open) setEditSheet(null); }}>
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto" data-testid="sheet-edit-letter">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Edit3 className="h-4 w-4 text-amber-600" />
              Edit & Resubmit Letter
            </SheetTitle>
            <SheetDescription>
              Make your corrections below and resubmit for approval.
            </SheetDescription>
          </SheetHeader>
          {editSheet && (
            <div className="mt-4">
              <LetterGenerator
                editingLetter={editSheet}
                onResubmitted={() => {
                  setEditSheet(null);
                  queryClient.invalidateQueries({ queryKey: ["/api/hr/letters"] });
                }}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </Card>
  );
}
