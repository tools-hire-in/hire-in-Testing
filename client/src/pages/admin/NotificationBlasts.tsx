import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import {
  Mail,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  Eye,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import DOMPurify from "dompurify";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";

interface BlastRecipient {
  userId: string;
  name: string;
  email: string;
}

interface PendingBlast {
  id: string;
  triggerSource: string;
  recipientCount: number;
  subject: string;
  bodyHtml: string;
  recipients?: BlastRecipient[];
  status: string;
  reviewedBy?: string;
  reviewedAt?: string;
  editedBy?: string;
  editedAt?: string;
  cancelReason?: string;
  alertSent?: boolean;
  createdAt: string;
}

interface DeliveryRecord {
  id: string;
  blastId: string;
  userId?: string;
  email: string;
  status: string;
  errorMessage?: string;
  sentAt?: string;
}

interface BlastsResponse {
  blasts: PendingBlast[];
  pending_count: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-blue-100 text-blue-800 border-blue-200",
  delivering: "bg-blue-100 text-blue-800 border-blue-200",
  sent: "bg-green-100 text-green-800 border-green-200",
  partially_failed: "bg-orange-100 text-orange-800 border-orange-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  cancelled: "bg-gray-100 text-gray-700 border-gray-200",
};

function statusIcon(status: string) {
  if (status === "sent") return <CheckCircle className="h-3.5 w-3.5" />;
  if (status === "failed") return <XCircle className="h-3.5 w-3.5" />;
  if (status === "cancelled") return <XCircle className="h-3.5 w-3.5" />;
  if (status === "delivering") return <RefreshCw className="h-3.5 w-3.5 animate-spin" />;
  if (status === "pending") return <Clock className="h-3.5 w-3.5" />;
  if (status === "partially_failed") return <AlertTriangle className="h-3.5 w-3.5" />;
  return <Mail className="h-3.5 w-3.5" />;
}

function BlastStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700"}`} data-testid={`badge-blast-status-${status}`}>
      {statusIcon(status)}
      {status.replace("_", " ")}
    </span>
  );
}

function BlastDetailModal({
  blastId,
  open,
  onClose,
}: {
  blastId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = ["super_admin", "admin"].includes(user?.role || "");
  const isSuperAdmin = user?.role === "super_admin";

  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);

  const { data, isLoading } = useQuery<{ blast: PendingBlast; deliveryRecords: DeliveryRecord[] }>({
    queryKey: ["/api/admin/blasts", blastId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/blasts/${blastId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load blast");
      return res.json();
    },
    enabled: !!blastId && open,
  });

  const blast = data?.blast;
  const deliveryRecords = data?.deliveryRecords ?? [];

  const approveMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = {};
      if (showEdit && editSubject) body.overrideSubject = editSubject;
      if (showEdit && editBody) body.overrideBodyHtml = editBody;
      return apiRequest("POST", `/api/admin/blasts/${blastId}/approve`, body);
    },
    onSuccess: () => {
      toast({ title: "Blast approved — delivery queued" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blasts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blasts/pending-count"] });
      onClose();
    },
    onError: (err: any) => toast({ title: err.message ?? "Approval failed", variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", `/api/admin/blasts/${blastId}/cancel`, { reason: cancelReason || "Cancelled by admin" }),
    onSuccess: () => {
      toast({ title: "Blast cancelled" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blasts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blasts/pending-count"] });
      onClose();
    },
    onError: (err: any) => toast({ title: err.message ?? "Cancel failed", variant: "destructive" }),
  });

  const retryMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/admin/blasts/${blastId}/retry`, {}),
    onSuccess: () => {
      toast({ title: "Blast re-queued for delivery" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blasts"] });
      onClose();
    },
    onError: (err: any) => toast({ title: err.message ?? "Retry failed", variant: "destructive" }),
  });

  if (!open) return null;

  const canApprove = blast?.status === "pending" && isAdmin;
  const canCancel = blast && ["pending", "delivering"].includes(blast.status) && (blast.status === "pending" ? isAdmin : isSuperAdmin);
  const canRetry = blast && ["partially_failed", "failed"].includes(blast.status) && isAdmin;

  const sentCount = deliveryRecords.filter(r => r.status === "sent").length;
  const failedCount = deliveryRecords.filter(r => r.status === "failed").length;
  const pendingCount = deliveryRecords.filter(r => r.status === "pending").length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Email Blast Review
            {blast && <BlastStatusBadge status={blast.status} />}
          </DialogTitle>
        </DialogHeader>

        {isLoading && <div className="py-8 text-center text-muted-foreground">Loading…</div>}

        {blast && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="font-medium text-muted-foreground">Trigger source</span>
                <p className="mt-0.5 font-mono text-xs">{blast.triggerSource}</p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Recipients</span>
                <p className="mt-0.5">{blast.recipientCount} addresses</p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Queued</span>
                <p className="mt-0.5">{format(new Date(blast.createdAt), "MMM d, yyyy h:mm a")}</p>
              </div>
              {blast.reviewedAt && (
                <div>
                  <span className="font-medium text-muted-foreground">Reviewed</span>
                  <p className="mt-0.5">{format(new Date(blast.reviewedAt), "MMM d, yyyy h:mm a")}</p>
                </div>
              )}
              {blast.cancelReason && (
                <div className="col-span-2">
                  <span className="font-medium text-muted-foreground">Cancellation reason</span>
                  <p className="mt-0.5 text-red-700">{blast.cancelReason}</p>
                </div>
              )}
            </div>

            <Separator />

            <div>
              <p className="text-sm font-medium mb-1">Subject</p>
              <p className="text-sm border rounded px-3 py-2 bg-muted/30 font-mono">{blast.subject}</p>
            </div>

            <div>
              <p className="text-sm font-medium mb-1">Body preview</p>
              <div
                className="text-sm border rounded px-3 py-2 bg-muted/30 max-h-48 overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(blast.bodyHtml, { USE_PROFILES: { html: true } }) }}
              />
            </div>

            {blast.editedAt && (
              <div>
                <p className="text-sm font-medium mb-1 text-amber-700">Edited before send</p>
                <p className="text-xs text-muted-foreground">
                  Subject/body overridden at {format(new Date(blast.editedAt), "MMM d, h:mm a")}
                </p>
              </div>
            )}

            {deliveryRecords.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <p className="text-sm font-medium">Delivery records</p>
                    <span className="text-xs text-green-700 font-medium">{sentCount} sent</span>
                    {failedCount > 0 && <span className="text-xs text-red-700 font-medium">{failedCount} failed</span>}
                    {pendingCount > 0 && <span className="text-xs text-amber-700 font-medium">{pendingCount} pending</span>}
                  </div>
                  <div className="max-h-40 overflow-y-auto border rounded">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Recipient</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Sent at</TableHead>
                          <TableHead className="text-xs">Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deliveryRecords.map(r => {
                          const recipientMeta = blast.recipients?.find(
                            p => p.email.toLowerCase() === r.email.toLowerCase()
                          );
                          return (
                            <TableRow key={r.id}>
                              <TableCell className="text-xs">
                                {recipientMeta?.name && recipientMeta.name !== r.email && (
                                  <p className="font-medium truncate max-w-36">{recipientMeta.name}</p>
                                )}
                                <p className="font-mono text-muted-foreground truncate max-w-36">{r.email}</p>
                              </TableCell>
                              <TableCell className="text-xs">
                                <BlastStatusBadge status={r.status} />
                              </TableCell>
                              <TableCell className="text-xs">{r.sentAt ? format(new Date(r.sentAt), "h:mm a") : "—"}</TableCell>
                              <TableCell className="text-xs text-red-600 max-w-48 truncate">{r.errorMessage ?? "—"}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}

            {canApprove && showEdit && (
              <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800 dark:text-amber-200 text-sm">Edit before approving (optional)</AlertTitle>
                <AlertDescription className="space-y-3 mt-2">
                  <div>
                    <Label className="text-xs">Override subject (leave blank to keep original)</Label>
                    <Input
                      value={editSubject}
                      onChange={e => setEditSubject(e.target.value)}
                      placeholder={blast.subject}
                      className="mt-1 text-sm"
                      data-testid="input-blast-override-subject"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Override body HTML (leave blank to keep original)</Label>
                    <Textarea
                      value={editBody}
                      onChange={e => setEditBody(e.target.value)}
                      placeholder="Enter HTML or leave blank to keep original body…"
                      rows={5}
                      className="mt-1 text-sm font-mono"
                      data-testid="input-blast-override-body"
                    />
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {showCancel && (
              <Alert variant="destructive" data-testid="alert-cancel-reason">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="text-sm">Cancel reason (optional)</AlertTitle>
                <AlertDescription className="mt-2">
                  <Input
                    value={cancelReason}
                    onChange={e => setCancelReason(e.target.value)}
                    placeholder="Reason for cancellation…"
                    className="text-sm bg-background"
                    data-testid="input-blast-cancel-reason"
                  />
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter className="flex flex-wrap gap-2 justify-between">
          <div className="flex gap-2">
            {canCancel && !showCancel && (
              <Button variant="outline" size="sm" onClick={() => setShowCancel(true)} data-testid="button-blast-cancel-init">
                <XCircle className="h-4 w-4 mr-1" /> Cancel blast
              </Button>
            )}
            {showCancel && (
              <Button variant="destructive" size="sm" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending} data-testid="button-blast-cancel-confirm">
                Confirm cancel
              </Button>
            )}
            {canRetry && (
              <Button variant="outline" size="sm" onClick={() => retryMutation.mutate()} disabled={retryMutation.isPending} data-testid="button-blast-retry">
                <RefreshCw className="h-4 w-4 mr-1" /> Retry failed
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-blast-close">Close</Button>
            {canApprove && !showEdit && (
              <Button variant="outline" size="sm" onClick={() => setShowEdit(true)} data-testid="button-blast-edit">
                <Eye className="h-4 w-4 mr-1" /> Edit & Approve
              </Button>
            )}
            {canApprove && (
              <Button size="sm" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending} data-testid="button-blast-approve">
                <Send className="h-4 w-4 mr-1" /> {approveMutation.isPending ? "Approving…" : "Approve & Send"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function NotificationBlasts() {
  const { user } = useAuth();
  const { enabled: newLook } = useNewLook();
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedBlastId, setSelectedBlastId] = useState<string | null>(null);

  const isAdmin = ["super_admin", "admin"].includes(user?.role || "");

  const { data, isLoading } = useQuery<BlastsResponse>({
    queryKey: ["/api/admin/blasts", activeTab === "all" ? undefined : activeTab],
    queryFn: async () => {
      const url = activeTab === "all" ? "/api/admin/blasts" : `/api/admin/blasts?status=${activeTab}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load blasts");
      return res.json();
    },
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  const blasts = data?.blasts ?? [];
  const pendingCount = (data?.blasts ?? []).filter(b => b.status === "pending").length;

  if (!isAdmin) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          You do not have access to this page.
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5 v2-surface">
        {newLook ? (
          <V2PageHeader
            icon={Mail}
            eyebrow="Admin"
            title="Email Blast Review Queue"
            subtitle="Automated bulk emails above the recipient threshold are held here for review before delivery."
            testId="text-blast-queue-title"
            actions={pendingCount > 0 ? (
              <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-medium text-white" data-testid="text-blast-pending-count">
                {pendingCount} pending
              </span>
            ) : undefined}
          />
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Email Blast Review Queue
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Automated bulk emails above the recipient threshold are held here for review before delivery.
                {pendingCount > 0 && (
                  <span className="ml-2 font-medium text-amber-700" data-testid="text-blast-pending-count">
                    {pendingCount} pending review
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        <Card>
          <CardHeader className="pb-0">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="pending" data-testid="tab-blasts-pending">
                  Pending
                  {pendingCount > 0 && (
                    <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingCount}</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="sent" data-testid="tab-blasts-sent">Sent</TabsTrigger>
                <TabsTrigger value="failed" data-testid="tab-blasts-failed">Failed</TabsTrigger>
                <TabsTrigger value="cancelled" data-testid="tab-blasts-cancelled">Cancelled</TabsTrigger>
                <TabsTrigger value="all" data-testid="tab-blasts-all">All</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading && (
              <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>
            )}
            {!isLoading && blasts.length === 0 && (
              <div className="py-10 text-center text-muted-foreground">
                <Mail className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No blasts in this view</p>
              </div>
            )}
            {!isLoading && blasts.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Context</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead className="text-right">Recipients</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Queued</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blasts.map(blast => (
                    <TableRow key={blast.id} data-testid={`row-blast-${blast.id}`}>
                      <TableCell className="text-xs font-mono text-muted-foreground max-w-32 truncate">{blast.triggerSource}</TableCell>
                      <TableCell className="text-sm max-w-48 truncate">{blast.subject}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{blast.recipientCount}</TableCell>
                      <TableCell><BlastStatusBadge status={blast.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(blast.createdAt), "MMM d, h:mm a")}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedBlastId(blast.id)}
                          data-testid={`button-blast-view-${blast.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <BlastDetailModal
        blastId={selectedBlastId}
        open={!!selectedBlastId}
        onClose={() => setSelectedBlastId(null)}
      />
    </AdminLayout>
  );
}
