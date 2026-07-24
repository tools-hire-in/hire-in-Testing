import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle, XCircle, CornerDownLeft, Award, Eye, Download,
  Shield, Loader2, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MANAGER_ROLES = ["super_admin", "admin", "hr", "manager"];

interface RecognitionPost {
  id: string;
  giverId: string;
  recipientId: string;
  badgeTypeId: string;
  message: string;
  createdAt: string;
  giverName: string;
  recipientName: string;
  badgeType: { id: string; name: string; emoji: string; color: string } | null;
  certificate_status: string | null;
  certificate_requested: boolean;
  recognition_description: string | null;
  contribution_summary: string | null;
  public_citation_draft: string | null;
  public_citation_approved: string | null;
  recognition_context: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_verification: { label: "Pending Review", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  approved: { label: "Approved", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  issued: { label: "Issued", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  returned: { label: "Returned", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  revoked: { label: "Revoked", color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200" },
};

function StatusBadge({ status }: { status: string | null }) {
  const s = status ? STATUS_LABELS[status] : null;
  if (!s) return <Badge variant="outline">{status ?? "Unknown"}</Badge>;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s.color}`}>{s.label}</span>;
}

function RecognitionCard({
  post,
  onApprove,
  onReturn,
  onReject,
  actionPending,
}: {
  post: RecognitionPost;
  onApprove: (post: RecognitionPost) => void;
  onReturn: (post: RecognitionPost) => void;
  onReject: (post: RecognitionPost) => void;
  actionPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card data-testid={`recognition-card-${post.id}`} className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {post.badgeType && (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0"
                style={{ backgroundColor: `${post.badgeType.color}20` }}
              >
                {post.badgeType.emoji}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-sm">
                {post.giverName} <span className="text-muted-foreground font-normal">→</span> {post.recipientName}
              </p>
              <p className="text-xs text-muted-foreground">
                {post.badgeType?.name} Badge · {new Date(post.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                {post.recognition_context && <> · <span className="italic">{post.recognition_context}</span></>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={post.certificate_status} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded((v) => !v)}
              data-testid={`btn-expand-${post.id}`}
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              {expanded ? "Hide" : "View"}
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 space-y-3 text-sm border-t pt-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Praise Message</p>
              <p className="italic text-slate-600 dark:text-slate-400">&ldquo;{post.message}&rdquo;</p>
            </div>
            {post.recognition_description && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Recognition Description</p>
                <p>{post.recognition_description}</p>
              </div>
            )}
            {post.contribution_summary && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Contribution Summary</p>
                <p>{post.contribution_summary}</p>
              </div>
            )}
            {post.public_citation_draft && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Citation Draft</p>
                <p className="italic">&ldquo;{post.public_citation_draft}&rdquo;</p>
              </div>
            )}

            {post.certificate_status === "pending_verification" && (
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => onApprove(post)}
                  disabled={actionPending}
                  data-testid={`btn-approve-${post.id}`}
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                  Approve & Issue
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onReturn(post)}
                  disabled={actionPending}
                  data-testid={`btn-return-${post.id}`}
                >
                  <CornerDownLeft className="h-3.5 w-3.5 mr-1" />
                  Return
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => onReject(post)}
                  disabled={actionPending}
                  data-testid={`btn-reject-${post.id}`}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Reject
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function RecognitionApprovals() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [approvePost, setApprovePost] = useState<RecognitionPost | null>(null);
  const [approvedCitation, setApprovedCitation] = useState("");
  const [returnPost, setReturnPost] = useState<RecognitionPost | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [rejectPost, setRejectPost] = useState<RecognitionPost | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const isManager = MANAGER_ROLES.includes(user?.role ?? "");

  const { data: queueData, isLoading } = useQuery<{ posts: RecognitionPost[] }>({
    queryKey: ["/api/manager/recognition/queue"],
    enabled: isManager,
  });

  const allPosts = queueData?.posts ?? [];
  const pending = allPosts.filter((p) => p.certificate_status === "pending_verification");
  const returned = allPosts.filter((p) => p.certificate_status === "returned");
  const approved = allPosts.filter((p) => p.certificate_status === "approved");
  const issued = allPosts.filter((p) => p.certificate_status === "issued");
  const rejected = allPosts.filter((p) => p.certificate_status === "rejected");

  const approveMutation = useMutation({
    mutationFn: async ({ postId, citation }: { postId: string; citation: string }) => {
      const res = await apiRequest("POST", `/api/manager/recognition/${postId}/approve`, { approvedCitation: citation });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/manager/recognition/queue"] });
      toast({
        title: "Certificate issued! 🎉",
        description: `Certificate ID: ${data.certificate?.certificateId}`,
      });
      setApprovePost(null);
      setApprovedCitation("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message || "Failed to issue certificate", variant: "destructive" }),
  });

  const returnMutation = useMutation({
    mutationFn: async ({ postId, reason }: { postId: string; reason: string }) => {
      const res = await apiRequest("POST", `/api/manager/recognition/${postId}/return`, { reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manager/recognition/queue"] });
      toast({ title: "Recognition returned for clarification" });
      setReturnPost(null);
      setReturnReason("");
    },
    onError: () => toast({ title: "Error", description: "Failed to return", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ postId, reason }: { postId: string; reason: string }) => {
      const res = await apiRequest("POST", `/api/manager/recognition/${postId}/reject`, { reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manager/recognition/queue"] });
      toast({ title: "Recognition request rejected" });
      setRejectPost(null);
      setRejectReason("");
    },
    onError: () => toast({ title: "Error", description: "Failed to reject", variant: "destructive" }),
  });

  if (!isManager) {
    return (
      <AdminLayout>
        <div className="flex items-center gap-2 p-8 text-muted-foreground">
          <AlertTriangle className="h-5 w-5" />
          <span>You don&apos;t have access to this page.</span>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="v2-surface space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" data-testid="text-recognition-approvals-title">
            <Shield className="h-5 w-5 text-[#1F3A6E]" />
            Recognition Approvals
          </h1>
          <p className="text-sm text-muted-foreground">Review and approve recognition certificate requests from your team</p>
        </div>

        <Tabs defaultValue="pending">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="pending" data-testid="tab-pending">
              Pending
              {pending.length > 0 && (
                <span className="ml-1.5 bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                  {pending.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="returned" data-testid="tab-returned">
              Returned
              {returned.length > 0 && (
                <span className="ml-1.5 bg-yellow-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                  {returned.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved" data-testid="tab-approved">
              Approved
              {approved.length > 0 && (
                <span className="ml-1.5 bg-blue-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                  {approved.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="issued" data-testid="tab-issued">Issued</TabsTrigger>
            <TabsTrigger value="rejected" data-testid="tab-rejected">Rejected</TabsTrigger>
          </TabsList>

          {/* Helper to render a list of posts in each tab */}
          {(["pending", "returned", "approved", "issued", "rejected"] as const).map((tabKey) => {
            const tabPosts = { pending, returned, approved, issued, rejected }[tabKey];
            const isActionable = tabKey === "pending" || tabKey === "returned";
            const emptyMsg = tabKey === "pending" ? "No recognition requests pending review." : `No ${tabKey} recognitions.`;
            const emptyIcon = tabKey === "pending"
              ? <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
              : <Award className="h-10 w-10 text-muted-foreground mx-auto mb-3" />;
            return (
              <TabsContent key={tabKey} value={tabKey} className="mt-4">
                {isLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </div>
                ) : tabPosts.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      {emptyIcon}
                      <p className={tabKey === "pending" ? "font-medium" : "text-muted-foreground"}>
                        {tabKey === "pending" ? "All caught up!" : emptyMsg}
                      </p>
                      {tabKey === "pending" && (
                        <p className="text-sm text-muted-foreground">{emptyMsg}</p>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {tabPosts.map((post) => (
                      <RecognitionCard
                        key={post.id}
                        post={post}
                        onApprove={(p) => { setApprovePost(p); setApprovedCitation(p.public_citation_draft ?? ""); }}
                        onReturn={(p) => setReturnPost(p)}
                        onReject={(p) => setRejectPost(p)}
                        actionPending={isActionable && (approveMutation.isPending || returnMutation.isPending || rejectMutation.isPending)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>

      {/* Approve Modal */}
      {approvePost && (
        <Dialog open onOpenChange={() => { setApprovePost(null); setApprovedCitation(""); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Approve & Issue Certificate
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You are approving recognition for <strong>{approvePost.recipientName}</strong>.
                Review and finalize the citation that will appear on the certificate.
              </p>
              <div className="space-y-1">
                <Label>Final Approved Citation</Label>
                <Textarea
                  value={approvedCitation}
                  onChange={(e) => setApprovedCitation(e.target.value)}
                  rows={4}
                  maxLength={500}
                  placeholder="Edit the citation as needed..."
                  data-testid="input-approved-citation"
                />
                <p className="text-xs text-muted-foreground">This will appear verbatim on the certificate.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setApprovePost(null); setApprovedCitation(""); }}>Cancel</Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={!approvedCitation.trim() || approveMutation.isPending}
                onClick={() => approveMutation.mutate({ postId: approvePost.id, citation: approvedCitation })}
                data-testid="btn-confirm-approve"
              >
                {approveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                Issue Certificate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Return Modal */}
      {returnPost && (
        <Dialog open onOpenChange={() => { setReturnPost(null); setReturnReason(""); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CornerDownLeft className="h-5 w-5 text-orange-500" />
                Return for Clarification
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Return this recognition request to <strong>{returnPost.giverName}</strong> for more information.
              </p>
              <div className="space-y-1">
                <Label>Reason (optional)</Label>
                <Textarea
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  rows={3}
                  placeholder="What needs to be clarified or improved?"
                  data-testid="input-return-reason"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setReturnPost(null); setReturnReason(""); }}>Cancel</Button>
              <Button
                variant="outline"
                className="text-orange-600 border-orange-200"
                disabled={returnMutation.isPending}
                onClick={() => returnMutation.mutate({ postId: returnPost.id, reason: returnReason })}
                data-testid="btn-confirm-return"
              >
                {returnMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Return
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Reject Modal */}
      {rejectPost && (
        <Dialog open onOpenChange={() => { setRejectPost(null); setRejectReason(""); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                Reject Recognition Request
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This will reject the certificate request for <strong>{rejectPost.recipientName}</strong>.
              </p>
              <div className="space-y-1">
                <Label>Reason (optional)</Label>
                <Textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Explain why this request is being rejected..."
                  data-testid="input-reject-reason"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setRejectPost(null); setRejectReason(""); }}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={rejectMutation.isPending}
                onClick={() => rejectMutation.mutate({ postId: rejectPost.id, reason: rejectReason })}
                data-testid="btn-confirm-reject"
              >
                {rejectMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AdminLayout>
  );
}
