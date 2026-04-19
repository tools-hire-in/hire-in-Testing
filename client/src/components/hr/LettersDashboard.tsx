import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  FileText, Loader2, Search, Eye, Download, RotateCcw, XCircle, CheckCircle, Clock, Shield, Mail, Printer, RefreshCw,
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LetterPreview } from "./LetterPreview";
import { TEMPLATE_LABELS } from "@shared/hrLetterConstants";
import type { HrLetter } from "@shared/schema";
import type { LucideIcon } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: LucideIcon }> = {
  draft: { label: "Draft", variant: "secondary", icon: Clock },
  pending_approval: { label: "Pending Approval", variant: "outline", icon: Clock },
  approved: { label: "Approved", variant: "default", icon: CheckCircle },
  issued: { label: "Issued", variant: "default", icon: Shield },
  reissued: { label: "Reissued", variant: "secondary", icon: RotateCcw },
  revoked: { label: "Revoked", variant: "destructive", icon: XCircle },
};

export function LettersDashboard() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedLetter, setSelectedLetter] = useState<HrLetter | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [revokeDialog, setRevokeDialog] = useState<HrLetter | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [reissueDialog, setReissueDialog] = useState<HrLetter | null>(null);
  const [reissueReason, setReissueReason] = useState("");

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
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/hr/letters/${id}/email`);
      return res.json();
    },
    onSuccess: (data: { sentTo: string }) => {
      toast({ title: "Email sent", description: `Letter emailed to ${data.sentTo}` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function viewLetter(letter: HrLetter) {
    setSelectedLetter(letter);
    setShowPreview(true);
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
                  return (
                    <tr key={letter.id} className="border-b hover:bg-muted/50" data-testid={`row-letter-${letter.id}`}>
                      <td className="py-2 px-3">
                        <div className="font-medium">{letter.employeeName}</div>
                        <div className="text-xs text-muted-foreground">{letter.employeeCode || "—"} · {letter.designation}</div>
                      </td>
                      <td className="py-2 px-3">{TEMPLATE_LABELS[letter.templateType] || letter.templateType}</td>
                      <td className="py-2 px-3">
                        <Badge variant={sc.variant} className="gap-1" data-testid={`badge-status-${letter.id}`}>
                          <Icon className="h-3 w-3" /> {sc.label}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 font-mono text-xs">{letter.referenceNumber || "—"}</td>
                      <td className="py-2 px-3">{letter.issueDate || "—"}</td>
                      <td className="py-2 px-3 text-right space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => viewLetter(letter)} data-testid={`btn-view-letter-${letter.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => {
                          window.open(`/api/hr/letters/${letter.id}/download`, "_blank");
                        }} data-testid={`btn-download-letter-${letter.id}`}>
                          <Download className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => {
                          window.open(`/api/hr/letters/${letter.id}/download?inline=1`, "_blank");
                        }} data-testid={`btn-print-letter-${letter.id}`}>
                          <Printer className="h-4 w-4 text-slate-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => emailMutation.mutate(letter.id)} disabled={emailMutation.isPending} data-testid={`btn-email-letter-${letter.id}`}>
                          <Mail className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setReissueDialog(letter)} data-testid={`btn-reissue-letter-${letter.id}`}>
                          <RotateCcw className="h-4 w-4 text-amber-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setRevokeDialog(letter)} data-testid={`btn-revoke-letter-${letter.id}`}>
                          <XCircle className="h-4 w-4 text-red-600" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Sheet open={showPreview} onOpenChange={setShowPreview}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <SheetTitle>Letter Details</SheetTitle>
                <SheetDescription>
                  {selectedLetter?.referenceNumber ? `Ref: ${selectedLetter.referenceNumber}` : "Draft"}
                  {selectedLetter?.authCode ? ` | Auth: ${selectedLetter.authCode}` : ""}
                </SheetDescription>
              </div>
              {selectedLetter && (
                <div className="flex gap-1 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => {
                    window.open(`/api/hr/letters/${selectedLetter.id}/download`, "_blank");
                  }} data-testid="btn-preview-download">
                    <Download className="h-4 w-4 mr-1" /> Download
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    window.open(`/api/hr/letters/${selectedLetter.id}/download?inline=1`, "_blank");
                  }} data-testid="btn-preview-print">
                    <Printer className="h-4 w-4 mr-1" /> Print
                  </Button>
                </div>
              )}
            </div>
          </SheetHeader>
          {selectedLetter && (
            <div className="mt-4">
              <LetterPreview letter={selectedLetter} />
            </div>
          )}
        </SheetContent>
      </Sheet>

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
    </Card>
  );
}
