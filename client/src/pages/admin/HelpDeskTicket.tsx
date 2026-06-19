import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Send, Loader2, Clock, CheckCircle2, XCircle, AlertCircle, User, Calendar, Tag, Paperclip, ThumbsUp, ThumbsDown, HelpCircle, Undo2 } from "lucide-react";
import { format } from "date-fns";

interface HirdUser { id: string; firstName: string; lastName: string; role: string; }
interface HirdComment { id: string; body: string; createdAt: string; author: HirdUser | null; }
interface HirdAuditEntry { id: string; action: string; oldStatus?: string; newStatus?: string; createdAt: string; actor: HirdUser | null; metadata?: any; }
interface HirdApproval { id: string; decision: string; reason?: string; decidedAt: string; approver: HirdUser | null; }
interface HirdTicket {
  id: string;
  requestNumber: string;
  type: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  createdAt: string;
  neededByDate?: string;
  attachmentUrl?: string;
  templateData?: Record<string, string>;
  requester: HirdUser | null;
  requestedFor?: HirdUser | null;
  manager: HirdUser | null;
  assignedTo: HirdUser | null;
  comments: HirdComment[];
  auditLog: HirdAuditEntry[];
  approvals: HirdApproval[];
}

const ACCESS_LEVEL_LABELS: Record<string, string> = {
  view_only: "View Only (Read-only)",
  contributor: "Contributor (Read + Write)",
  admin: "Admin",
  custom: "Custom (see description)",
};
const URGENCY_LABELS: Record<string, string> = {
  immediate: "Immediate (blocking work)",
  this_week: "This week",
  this_month: "This month",
  no_rush: "No rush — when possible",
};

function SummaryRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground shrink-0 w-36">{label}</span>
      <span className="font-medium break-words">{value}</span>
    </div>
  );
}

function TemplateSummaryCard({
  type,
  data,
  requestedFor,
}: {
  type: string;
  data: Record<string, string>;
  requestedFor?: HirdUser | null;
}) {
  return (
    <div className="mt-4 border rounded-lg overflow-hidden">
      <div className="bg-muted/60 px-4 py-2 border-b">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Request Details</p>
      </div>
      <div className="px-4 py-3 space-y-2">
        {requestedFor && (
          <div className="pb-2 mb-1 border-b">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Requested For</p>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
                {requestedFor.firstName?.[0]}{requestedFor.lastName?.[0]}
              </div>
              <div>
                <p className="text-sm font-semibold">{requestedFor.firstName} {requestedFor.lastName}</p>
                <p className="text-xs text-muted-foreground capitalize">{requestedFor.role}</p>
              </div>
            </div>
          </div>
        )}

        {type === "access" && (
          <>
            <SummaryRow label="System / Tool" value={data.system} />
            <SummaryRow label="Access Level" value={data.accessLevel ? ACCESS_LEVEL_LABELS[data.accessLevel] || data.accessLevel : undefined} />
            <SummaryRow label="Role / Designation" value={data.requestedRole} />
            <SummaryRow label="Project / Client" value={data.projectOrClient} />
            <SummaryRow label="Access Duration" value={data.accessType === "temporary" ? `Temporary — until ${data.accessEndDate || "N/A"}` : "Permanent"} />
            {data.justification && (
              <div className="pt-1">
                <p className="text-xs text-muted-foreground mb-1">Business Justification</p>
                <p className="text-sm bg-muted/40 rounded p-2 leading-relaxed">{data.justification}</p>
              </div>
            )}
          </>
        )}

        {type === "hr" && (
          <>
            <SummaryRow label="Sub-type" value={data.requestSubtype} />
            <SummaryRow label="Period / Reference" value={data.period} />
            <SummaryRow label="Additional Context" value={data.additionalContext} />
          </>
        )}

        {type === "ops" && (
          <>
            <SummaryRow label="Sub-type" value={data.requestSubtype} />
            <SummaryRow label="Item / Asset" value={data.asset} />
            <SummaryRow label="Quantity" value={data.quantity} />
            <SummaryRow label="Urgency" value={data.urgency ? URGENCY_LABELS[data.urgency] || data.urgency : undefined} />
            <SummaryRow label="Blocking Work?" value={data.isBlocking === "yes" ? "Yes — cannot work without this" : data.isBlocking === "no" ? "No — helpful but I can continue" : undefined} />
          </>
        )}

        {type === "general" && (
          <SummaryRow label="Category" value={data.category} />
        )}
      </div>
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = { access: "Access & IT", hr: "HR", ops: "Operations", general: "General" };
const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  p1: { label: "P1 Critical", color: "bg-red-100 text-red-700 border-red-200" },
  p2: { label: "P2 High", color: "bg-orange-100 text-orange-700 border-orange-200" },
  p3: { label: "P3 Medium", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  p4: { label: "P4 Low", color: "bg-slate-100 text-slate-600 border-slate-200" },
};
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending_approval: { label: "Pending Approval", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  assigned: { label: "Assigned", color: "bg-blue-100 text-blue-700 border-blue-200", icon: AlertCircle },
  in_progress: { label: "In Progress", color: "bg-purple-100 text-purple-700 border-purple-200", icon: Loader2 },
  needs_info: { label: "Needs Info", color: "bg-rose-100 text-rose-700 border-rose-200", icon: HelpCircle },
  resolved: { label: "Resolved", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
  closed: { label: "Closed", color: "bg-slate-100 text-slate-600 border-slate-200", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
};

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    created: "submitted this request",
    approved: "approved this request",
    rejected: "rejected this request",
    commented: "added a comment",
    assigned: "assigned this request",
    reopened: "reopened this request",
    status_changed_to_in_progress: "moved to In Progress",
    status_changed_to_resolved: "marked as Resolved",
    status_changed_to_closed: "closed this request",
    status_changed_to_assigned: "marked as Assigned",
    status_changed_to_rejected: "rejected this request",
    status_changed_to_needs_info: "returned this request for more information",
    returned_for_info: "returned this request for more information",
    responded_to_info: "responded with more information",
  };
  return map[action] || action.replace(/_/g, " ");
}

export default function HelpDeskTicket() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [comment, setComment] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [returnComment, setReturnComment] = useState("");
  const [showReturnInput, setShowReturnInput] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replyAttachment, setReplyAttachment] = useState("");

  const { data: ticket, isLoading } = useQuery<HirdTicket>({
    queryKey: ["/api/help-desk/requests", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/help-desk/requests/${params.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!params.id,
  });

  const { data: resolvers = [] } = useQuery<HirdUser[]>({
    queryKey: ["/api/help-desk/resolvers"],
    enabled: !!ticket,
  });

  const commentMutation = useMutation({
    mutationFn: (body: string) => apiRequest("POST", `/api/help-desk/requests/${params.id}/comments`, { body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/help-desk/requests", params.id] });
      setComment("");
      toast({ title: "Comment added" });
    },
    onError: () => toast({ title: "Failed to add comment", variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: (data: { status?: string; assignedToId?: string }) => apiRequest("PATCH", `/api/help-desk/requests/${params.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/help-desk/requests", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/help-desk/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/help-desk/requests/stats"] });
      setNewStatus("");
      toast({ title: "Request updated" });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: (data: { action: "approve" | "reject"; reason?: string }) =>
      apiRequest("POST", `/api/help-desk/requests/${params.id}/${data.action}`, { reason: data.reason }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/help-desk/requests", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/help-desk/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/help-desk/requests/stats"] });
      setShowRejectInput(false);
      setRejectReason("");
      toast({ title: vars.action === "approve" ? "Request approved" : "Request rejected" });
    },
    onError: () => toast({ title: "Action failed", variant: "destructive" }),
  });

  const returnMutation = useMutation({
    mutationFn: (comment: string) => apiRequest("POST", `/api/help-desk/requests/${params.id}/return-for-info`, { comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/help-desk/requests", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/help-desk/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/help-desk/requests/stats"] });
      setShowReturnInput(false);
      setReturnComment("");
      toast({ title: "Returned to requester", description: "They have been notified that more information is needed." });
    },
    onError: (err: any) => toast({ title: "Failed to return request", description: err?.message, variant: "destructive" }),
  });

  const respondMutation = useMutation({
    mutationFn: (data: { body: string; attachmentUrl?: string }) => apiRequest("POST", `/api/help-desk/requests/${params.id}/respond`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/help-desk/requests", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/help-desk/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/help-desk/requests/stats"] });
      setReplyBody("");
      setReplyAttachment("");
      toast({ title: "Response submitted", description: "Your request is back with the team." });
    },
    onError: (err: any) => toast({ title: "Failed to submit response", description: err?.message, variant: "destructive" }),
  });

  if (authLoading || isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />Loading…
        </div>
      </AdminLayout>
    );
  }

  if (!ticket) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground">
          <p className="text-lg font-medium">Request not found</p>
          <Button variant="ghost" className="mt-4" onClick={() => setLocation("/admin/hr?tab=requests")}>
            <ArrowLeft className="h-4 w-4 mr-2" />Go back
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const role = user?.role || "employee";
  const resolverRoles = ["super_admin", "admin", "hr", "operations"];
  const isResolver = resolverRoles.includes(role);
  // Approval card shown only to the designated manager or super_admin (mirrors server auth)
  const isApprover = role === "super_admin" || (role === "manager" && ticket.manager?.id === user?.id);
  const isOwner = ticket.requester?.id === user?.id;
  const isManager = ticket.manager?.id === user?.id;

  const statusInfo = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.assigned;
  const priorityInfo = PRIORITY_LABELS[ticket.priority] || PRIORITY_LABELS.p3;

  const resolverStatuses = ["assigned", "in_progress", "resolved"];

  const backHref = isResolver ? "/admin/help-desk" : "/admin/hr?tab=requests";

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-5" data-testid="ticket-detail-page">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation(backHref)} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" />Back
          </Button>
          <span className="text-sm text-muted-foreground font-mono">{ticket.requestNumber}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <Badge variant="outline" className="text-xs">{TYPE_LABELS[ticket.type] || ticket.type}</Badge>
                      <Badge variant="outline" className={`text-xs ${priorityInfo.color}`}>{priorityInfo.label}</Badge>
                      <Badge variant="outline" className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</Badge>
                    </div>
                    <CardTitle className="text-lg leading-tight">{ticket.title}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{ticket.description}</p>

                {ticket.templateData && Object.keys(ticket.templateData).length > 0 && (
                  <TemplateSummaryCard type={ticket.type} data={ticket.templateData} requestedFor={ticket.requestedFor} />
                )}

                {ticket.attachmentUrl && (
                  <div className="mt-4 flex items-center gap-2 p-2 bg-blue-50 border border-blue-100 rounded-lg text-sm">
                    <Paperclip className="h-4 w-4 text-blue-500 shrink-0" />
                    <a href={ticket.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline truncate">
                      {ticket.attachmentUrl}
                    </a>
                  </div>
                )}

                {ticket.approvals && ticket.approvals.length > 0 && (
                  <div className="mt-4 bg-muted/40 rounded-lg p-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Approval Decisions</p>
                    <div className="space-y-2">
                      {ticket.approvals.map((a) => (
                        <div key={a.id} className={`flex items-start gap-2 text-sm p-2 rounded-md border ${a.decision === "approved" ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"}`} data-testid={`approval-${a.id}`}>
                          {a.decision === "approved"
                            ? <ThumbsUp className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
                            : <ThumbsDown className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />}
                          <div>
                            <span className={`font-medium ${a.decision === "approved" ? "text-green-700" : "text-red-700"}`}>
                              {a.decision === "approved" ? "Approved" : "Rejected"} by {a.approver?.firstName} {a.approver?.lastName}
                            </span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {a.decidedAt ? format(new Date(a.decidedAt), "dd MMM yyyy, HH:mm") : ""}
                            </span>
                            {a.reason && <p className="text-xs mt-0.5 text-muted-foreground">Reason: {a.reason}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Comments & Updates</CardTitle>
              </CardHeader>
              <CardContent>
                {ticket.comments.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No comments yet.</p>
                )}
                <div className="space-y-3">
                  {ticket.comments.map((c) => (
                    <div key={c.id} className="flex gap-3" data-testid={`comment-${c.id}`}>
                      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
                        {c.author?.firstName?.[0]}{c.author?.lastName?.[0]}
                      </div>
                      <div className="flex-1 bg-muted/40 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium">{c.author?.firstName} {c.author?.lastName}</span>
                          <span className="text-xs text-muted-foreground">{c.createdAt ? format(new Date(c.createdAt), "dd MMM yyyy, HH:mm") : ""}</span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{c.body}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {(isOwner || isManager || isResolver) && !["closed", "rejected"].includes(ticket.status) && (
                  <div className="mt-4 space-y-2">
                    <Separator />
                    <Textarea
                      className="resize-none mt-3"
                      placeholder="Add a comment or update…"
                      rows={3}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      data-testid="input-comment"
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => comment.trim() && commentMutation.mutate(comment.trim())}
                        disabled={!comment.trim() || commentMutation.isPending}
                        data-testid="button-add-comment"
                      >
                        {commentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                        Post Comment
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Audit Trail</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {ticket.auditLog.map((a) => (
                    <div key={a.id} className="flex items-start gap-2 text-xs text-muted-foreground" data-testid={`audit-${a.id}`}>
                      <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 mt-1.5 shrink-0" />
                      <span>
                        <span className="font-medium text-foreground">{a.actor?.firstName} {a.actor?.lastName}</span>
                        {" "}{actionLabel(a.action)}
                        {" — "}{a.createdAt ? format(new Date(a.createdAt), "dd MMM yyyy, HH:mm") : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Requester</span>
                  <span className="ml-auto font-medium">{ticket.requester?.firstName} {ticket.requester?.lastName}</span>
                </div>
                {ticket.manager && (
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Manager</span>
                    <span className="ml-auto font-medium">{ticket.manager.firstName} {ticket.manager.lastName}</span>
                  </div>
                )}
                {ticket.assignedTo && (
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Assigned to</span>
                    <span className="ml-auto font-medium">{ticket.assignedTo.firstName} {ticket.assignedTo.lastName}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Submitted</span>
                  <span className="ml-auto">{ticket.createdAt ? format(new Date(ticket.createdAt), "dd MMM yyyy") : ""}</span>
                </div>
                {ticket.neededByDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-muted-foreground">Needed by</span>
                    <span className="ml-auto text-amber-600 font-medium">{format(new Date(ticket.neededByDate), "dd MMM yyyy")}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Type</span>
                  <span className="ml-auto">{TYPE_LABELS[ticket.type] || ticket.type}</span>
                </div>
              </CardContent>
            </Card>

            {isResolver && !["closed", "rejected"].includes(ticket.status) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Resolver Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Update Status</p>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger className="h-8 text-sm" data-testid="select-update-status">
                        <SelectValue placeholder="Change status…" />
                      </SelectTrigger>
                      <SelectContent>
                        {resolverStatuses.filter(s => s !== ticket.status).map(s => (
                          <SelectItem key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {newStatus && (
                      <Button className="w-full mt-2 h-8 text-sm" size="sm" onClick={() => statusMutation.mutate({ status: newStatus })} disabled={statusMutation.isPending} data-testid="button-update-status">
                        {statusMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
                        Confirm Update
                      </Button>
                    )}
                  </div>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Assign To</p>
                    <Select onValueChange={(v) => statusMutation.mutate({ assignedToId: v, status: "in_progress" })}>
                      <SelectTrigger className="h-8 text-sm" data-testid="select-assign-resolver">
                        <SelectValue placeholder="Assign resolver…" />
                      </SelectTrigger>
                      <SelectContent>
                        {resolvers.map(r => (
                          <SelectItem key={r.id} value={r.id}>{r.firstName} {r.lastName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {["assigned", "in_progress"].includes(ticket.status) && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Need more from the requester?</p>
                        {!showReturnInput ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-8 text-xs border-rose-200 text-rose-700 hover:bg-rose-50"
                            onClick={() => setShowReturnInput(true)}
                            data-testid="button-return-for-info"
                          >
                            <Undo2 className="h-3.5 w-3.5 mr-2" />Return for Info
                          </Button>
                        ) : (
                          <div className="space-y-2">
                            <Textarea
                              className="resize-none text-sm"
                              rows={3}
                              placeholder="Explain what information or change is needed before this can proceed…"
                              value={returnComment}
                              onChange={(e) => setReturnComment(e.target.value)}
                              data-testid="input-return-comment"
                            />
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 h-8 text-xs"
                                onClick={() => { setShowReturnInput(false); setReturnComment(""); }}
                                disabled={returnMutation.isPending}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                className="flex-1 h-8 text-xs"
                                onClick={() => returnMutation.mutate(returnComment.trim())}
                                disabled={returnMutation.isPending || returnComment.trim().length === 0}
                                data-testid="button-confirm-return"
                              >
                                {returnMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                                Return to Requester
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {isApprover && ticket.status === "pending_approval" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Approval Decision</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {!showRejectInput ? (
                    <>
                      <Button
                        className="w-full h-8 text-sm"
                        onClick={() => approveMutation.mutate({ action: "approve" })}
                        disabled={approveMutation.isPending}
                        data-testid="button-approve-ticket"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-2" />Approve Request
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full h-8 text-sm border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => setShowRejectInput(true)}
                        disabled={approveMutation.isPending}
                        data-testid="button-reject-ticket"
                      >
                        <XCircle className="h-3.5 w-3.5 mr-2" />Reject…
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full h-8 text-sm border-rose-200 text-rose-700 hover:bg-rose-50"
                        onClick={() => setShowReturnInput(true)}
                        disabled={approveMutation.isPending}
                        data-testid="button-return-for-info"
                      >
                        <Undo2 className="h-3.5 w-3.5 mr-2" />Return for Info…
                      </Button>
                    </>
                  ) : showReturnInput ? (
                    <>
                      <p className="text-xs text-muted-foreground">What information do you need before approving?</p>
                      <Textarea
                        className="resize-none text-sm"
                        rows={3}
                        placeholder="Explain what the requester must clarify or provide…"
                        value={returnComment}
                        onChange={(e) => setReturnComment(e.target.value)}
                        data-testid="input-return-comment"
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          onClick={() => { setShowReturnInput(false); setReturnComment(""); }}
                          disabled={returnMutation.isPending}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          onClick={() => returnMutation.mutate(returnComment.trim())}
                          disabled={returnMutation.isPending || returnComment.trim().length === 0}
                          data-testid="button-confirm-return"
                        >
                          {returnMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                          Return to Requester
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">Please provide a reason for rejection:</p>
                      <Textarea
                        className="resize-none text-sm"
                        rows={3}
                        placeholder="Explain why this request is being rejected…"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        data-testid="input-reject-reason"
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          onClick={() => { setShowRejectInput(false); setRejectReason(""); }}
                          disabled={approveMutation.isPending}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          onClick={() => approveMutation.mutate({ action: "reject", reason: rejectReason.trim() || undefined })}
                          disabled={approveMutation.isPending}
                          data-testid="button-confirm-reject"
                        >
                          {approveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                          Confirm Rejection
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {isOwner && ticket.status === "needs_info" && (() => {
              const lastReturn = [...(ticket.auditLog || [])].reverse().find(a => a.action === "returned_for_info");
              const returnedComment = lastReturn?.metadata?.commentId
                ? ticket.comments.find(c => c.id === lastReturn.metadata.commentId)
                : null;
              return (
                <Card className="border-rose-200 bg-rose-50/40">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-rose-700">
                      <HelpCircle className="h-4 w-4" />Action Needed
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      The team needs more information before they can continue. Please reply below to send it back to the queue.
                    </p>
                    {returnedComment && (
                      <div className="rounded-md border border-rose-200 bg-background p-3 text-sm">
                        <p className="text-xs text-muted-foreground mb-1">
                          What's needed{returnedComment.author ? ` — from ${returnedComment.author.firstName} ${returnedComment.author.lastName}` : ""}
                        </p>
                        <p className="whitespace-pre-wrap leading-relaxed" data-testid="text-needs-info-comment">{returnedComment.body}</p>
                      </div>
                    )}
                    <Textarea
                      className="resize-none text-sm"
                      rows={4}
                      placeholder="Provide the requested information…"
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      data-testid="input-respond-body"
                    />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Attachment URL (optional)</p>
                      <input
                        className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm"
                        placeholder="https://… link to a document or screenshot"
                        value={replyAttachment}
                        onChange={(e) => setReplyAttachment(e.target.value)}
                        data-testid="input-respond-attachment"
                      />
                    </div>
                    <Button
                      className="w-full h-8 text-sm"
                      onClick={() => respondMutation.mutate({ body: replyBody.trim(), attachmentUrl: replyAttachment.trim() || undefined })}
                      disabled={respondMutation.isPending || replyBody.trim().length === 0}
                      data-testid="button-submit-response"
                    >
                      {respondMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Send className="h-3.5 w-3.5 mr-2" />}
                      Send & Resubmit
                    </Button>
                  </CardContent>
                </Card>
              );
            })()}

            {isOwner && ticket.status === "resolved" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Confirm Resolution</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-muted-foreground">Was your issue resolved?</p>
                  <Button
                    className="w-full h-8 text-sm"
                    onClick={() => statusMutation.mutate({ status: "closed" })}
                    disabled={statusMutation.isPending}
                    data-testid="button-confirm-resolved"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-2" />Yes — Confirm & Close
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-8 text-sm border-amber-200 text-amber-700 hover:bg-amber-50"
                    onClick={() => statusMutation.mutate({ status: "in_progress" })}
                    disabled={statusMutation.isPending}
                    data-testid="button-reopen"
                  >
                    <AlertCircle className="h-3.5 w-3.5 mr-2" />No — Reopen Request
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
