import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Plus,
  Info,
  Paperclip,
  Eye,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface RegularizationRequest {
  id: string;
  attendanceDate: string;
  requestType: string;
  requestedPunchIn: string | null;
  requestedPunchOut: string | null;
  reason: string;
  status: string;
  reviewerComment: string | null;
  returnComment: string | null;
  attachmentUrl: string | null;
  reviewerName: string | null;
  createdAt: string;
}

const NEEDS_PUNCH_TYPES = ["missed_punch_in", "missed_punch_out", "correction", "wrong_absent"];

// Extract a HH:mm value (browser-local) from a stored ISO timestamp for time inputs.
function toTimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  missed_punch_in: "Missed Punch In",
  missed_punch_out: "Missed Punch Out",
  wrong_absent: "Wrong Absent Mark",
  correction: "Time Correction",
};

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pending:  { label: "Awaiting Review",    cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  returned: { label: "Needs Clarification", cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  approved: { label: "Approved",           cls: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  rejected: { label: "Rejected",           cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
};

const WINDOW_CLOSED_MESSAGES: Record<string, string> = {
  month_end_blackout: "This date falls in the month-end payroll lock period. Self-service filing is closed. Please contact HR directly.",
  next_punch_in_exists: "Your filing window has closed — you have already punched in for a subsequent day, which locks the prior record.",
  "24_hours_exceeded": "The 24-hour filing window for this date has expired. Please contact HR for assistance.",
  month_attendance_run_locked: "The attendance report for this month has been approved and locked. Please contact HR to request a correction.",
};

const MIN_REASON_CHARS = 20;

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getLast7Days(): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(toLocalDateStr(d));
  }
  return out;
}

function formatDateOption(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// Whether the chosen issue type requires the corresponding punch time(s).
function punchValid(requestType: string, punchIn: string, punchOut: string): boolean {
  if (requestType === "missed_punch_in") return !!punchIn;
  if (requestType === "missed_punch_out") return !!punchOut;
  if (requestType === "correction" || requestType === "wrong_absent") return !!punchIn && !!punchOut;
  return true;
}

function AttachmentField({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const { toast } = useToast();
  const { uploadFile, isUploading } = useUpload({
    onError: (e) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await uploadFile(file);
    if (res) onChange(res.objectPath);
    e.target.value = "";
  };
  return (
    <div className="space-y-2">
      <Label>Evidence (optional)</Label>
      {value ? (
        <div className="flex items-center gap-2 text-sm">
          <a href={value} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline" data-testid="link-attachment">
            <Eye className="h-3.5 w-3.5" /> View attached file
          </a>
          <button type="button" onClick={() => onChange(null)} className="text-muted-foreground hover:text-foreground" data-testid="button-remove-attachment">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <label className="flex items-center gap-2 text-sm cursor-pointer text-muted-foreground hover:text-foreground">
          <Paperclip className="h-3.5 w-3.5" />
          <span>{isUploading ? "Uploading..." : "Attach a screenshot or PDF"}</span>
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} disabled={isUploading} data-testid="input-attachment" />
        </label>
      )}
    </div>
  );
}

function RaiseModal({ pendingDates, onClose }: { pendingDates: Set<string>; onClose: () => void }) {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState("");
  const [requestType, setRequestType] = useState("");
  const [requestedPunchIn, setRequestedPunchIn] = useState("");
  const [requestedPunchOut, setRequestedPunchOut] = useState("");
  const [reason, setReason] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [windowClosedMsg, setWindowClosedMsg] = useState<string | null>(null);

  const dateOptions = getLast7Days().filter(d => !pendingDates.has(d));
  const needsPunchFields = NEEDS_PUNCH_TYPES.includes(requestType);
  const reasonLen = reason.trim().length;
  const reasonValid = reasonLen >= MIN_REASON_CHARS;
  const punchOk = punchValid(requestType, requestedPunchIn, requestedPunchOut);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/hr/attendance/regularization", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceDate: selectedDate,
          requestType,
          requestedPunchIn: requestedPunchIn || undefined,
          requestedPunchOut: requestedPunchOut || undefined,
          reason,
          attachmentUrl: attachmentUrl || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 409 && body.code === "REGULARIZATION_WINDOW_CLOSED") {
          const friendly = WINDOW_CLOSED_MESSAGES[body.reason] ?? body.message ?? "The filing window for this date is closed.";
          setWindowClosedMsg(friendly);
          throw new Error("WINDOW_CLOSED");
        }
        if (res.status === 400 && /already exists/i.test(body.error || "")) {
          setWindowClosedMsg("A regularization request for this date is already pending review.");
          throw new Error("WINDOW_CLOSED");
        }
        throw new Error(body.error || "Failed to submit");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance/regularization/my"] });
      toast({ title: "Request Submitted", description: "Your regularization request has been submitted." });
      onClose();
    },
    onError: (err: any) => {
      if (err.message === "WINDOW_CLOSED") return;
      toast({ title: "Error", description: err.message || "Failed to submit", variant: "destructive" });
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent data-testid="dialog-raise-regularization">
        <DialogHeader>
          <DialogTitle>Raise a Correction</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Date</Label>
            {dateOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="text-no-eligible-dates">
                All dates in the last 7 days already have a pending request.
              </p>
            ) : (
              <Select value={selectedDate} onValueChange={v => { setSelectedDate(v); setWindowClosedMsg(null); }}>
                <SelectTrigger data-testid="select-reg-date"><SelectValue placeholder="Select a date..." /></SelectTrigger>
                <SelectContent>
                  {dateOptions.map(d => (
                    <SelectItem key={d} value={d}>{formatDateOption(d)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {windowClosedMsg && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800" data-testid="alert-window-closed">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-300">Filing Window Closed</p>
                <p className="text-xs text-red-700 dark:text-red-400 mt-1">{windowClosedMsg}</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Issue Type</Label>
            <Select value={requestType} onValueChange={setRequestType}>
              <SelectTrigger data-testid="select-issue-type"><SelectValue placeholder="Select issue type..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="missed_punch_in">Missed Punch In</SelectItem>
                <SelectItem value="missed_punch_out">Missed Punch Out</SelectItem>
                <SelectItem value="wrong_absent">Wrong Absent Mark</SelectItem>
                <SelectItem value="correction">Time Correction</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {needsPunchFields && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Correct Punch In {(requestType === "missed_punch_in" || requestType === "correction" || requestType === "wrong_absent") && <span className="text-destructive">*</span>}</Label>
                <Input type="time" value={requestedPunchIn} onChange={e => setRequestedPunchIn(e.target.value)} data-testid="input-reg-punch-in" />
              </div>
              <div className="space-y-2">
                <Label>Correct Punch Out {(requestType === "missed_punch_out" || requestType === "correction" || requestType === "wrong_absent") && <span className="text-destructive">*</span>}</Label>
                <Input type="time" value={requestedPunchOut} onChange={e => setRequestedPunchOut(e.target.value)} data-testid="input-reg-punch-out" />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>Reason</Label>
              <span className={`text-xs font-mono ${reasonValid ? "text-green-600" : "text-muted-foreground"}`} data-testid="text-reason-char-count">
                {reasonLen}/{MIN_REASON_CHARS} min
              </span>
            </div>
            <Textarea
              value={reason}
              onChange={e => { setReason(e.target.value); setWindowClosedMsg(null); }}
              placeholder="Explain what happened (minimum 20 characters)..."
              data-testid="input-reg-reason"
            />
          </div>

          <AttachmentField value={attachmentUrl} onChange={setAttachmentUrl} />

          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
            <span>Requests must be filed within <strong>24 hours</strong> of end-of-day and before your next punch-in.</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={!selectedDate || !requestType || !reasonValid || !punchOk || submitMutation.isPending}
            data-testid="button-submit-regularization"
          >
            {submitMutation.isPending ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResubmitForm({ req, onDone }: { req: RegularizationRequest; onDone: () => void }) {
  const { toast } = useToast();
  const [reason, setReason] = useState(req.reason);
  const [requestedPunchIn, setRequestedPunchIn] = useState(toTimeInput(req.requestedPunchIn));
  const [requestedPunchOut, setRequestedPunchOut] = useState(toTimeInput(req.requestedPunchOut));
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(req.attachmentUrl);

  const needsPunchFields = NEEDS_PUNCH_TYPES.includes(req.requestType);
  const reasonLen = reason.trim().length;
  const reasonValid = reasonLen >= MIN_REASON_CHARS;
  const punchOk = punchValid(req.requestType, requestedPunchIn, requestedPunchOut);

  const resubmitMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/hr/attendance/regularization/${req.id}/resubmit`, {
        reason,
        requestedPunchIn: needsPunchFields ? (requestedPunchIn || null) : undefined,
        requestedPunchOut: needsPunchFields ? (requestedPunchOut || null) : undefined,
        attachmentUrl: attachmentUrl || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance/regularization/my"] });
      toast({ title: "Resubmitted", description: "Your request has been sent back for review." });
      onDone();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to resubmit", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-3 mt-2 p-3 rounded-md border bg-muted/30" data-testid={`resubmit-form-${req.id}`}>
      {needsPunchFields && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Correct Punch In</Label>
            <Input type="time" value={requestedPunchIn} onChange={e => setRequestedPunchIn(e.target.value)} data-testid={`input-resubmit-punch-in-${req.id}`} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Correct Punch Out</Label>
            <Input type="time" value={requestedPunchOut} onChange={e => setRequestedPunchOut(e.target.value)} data-testid={`input-resubmit-punch-out-${req.id}`} />
          </div>
        </div>
      )}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Reason</Label>
          <span className={`text-xs font-mono ${reasonValid ? "text-green-600" : "text-muted-foreground"}`}>{reasonLen}/{MIN_REASON_CHARS} min</span>
        </div>
        <Textarea value={reason} onChange={e => setReason(e.target.value)} data-testid={`input-resubmit-reason-${req.id}`} />
      </div>
      <AttachmentField value={attachmentUrl} onChange={setAttachmentUrl} />
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onDone}>Cancel</Button>
        <Button
          size="sm"
          onClick={() => resubmitMutation.mutate()}
          disabled={!reasonValid || !punchOk || resubmitMutation.isPending}
          data-testid={`button-resubmit-${req.id}`}
        >
          {resubmitMutation.isPending ? "Resubmitting..." : "Resubmit"}
        </Button>
      </div>
    </div>
  );
}

function RegRow({ req }: { req: RegularizationRequest }) {
  const [expanded, setExpanded] = useState(req.status === "returned");
  const [editing, setEditing] = useState(false);
  const cfg = STATUS_CFG[req.status] || { label: req.status, cls: "" };
  const isRejected = req.status === "rejected";
  const isReturned = req.status === "returned";
  const expandable = isRejected || isReturned;

  return (
    <div className="border-b last:border-0" data-testid={`reg-row-${req.id}`}>
      <div className="flex items-center gap-3 py-3 px-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium font-mono">{req.attendanceDate}</span>
            <span className="text-xs text-muted-foreground">{REQUEST_TYPE_LABELS[req.requestType] || req.requestType}</span>
          </div>
          {!expanded && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{req.reason}</p>
          )}
        </div>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 ${cfg.cls}`}>
          {cfg.label}
        </span>
        {expandable && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            data-testid={`button-expand-reg-${req.id}`}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
      </div>
      {expanded && isRejected && (
        <div className="px-4 pb-3 space-y-1">
          <p className="text-xs text-muted-foreground">Your reason: <span className="text-foreground">{req.reason}</span></p>
          {req.reviewerComment && (
            <div className="p-2 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <p className="text-xs text-red-800 dark:text-red-300 font-medium">Reviewer note:</p>
              <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">{req.reviewerComment}</p>
              {req.reviewerName && <p className="text-xs text-muted-foreground mt-1">— {req.reviewerName}</p>}
            </div>
          )}
        </div>
      )}
      {expanded && isReturned && (
        <div className="px-4 pb-3 space-y-2">
          {req.returnComment && (
            <div className="p-2 rounded-md bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
              <p className="text-xs text-orange-800 dark:text-orange-300 font-medium">Clarification requested:</p>
              <p className="text-xs text-orange-700 dark:text-orange-400 mt-0.5">{req.returnComment}</p>
              {req.reviewerName && <p className="text-xs text-muted-foreground mt-1">— {req.reviewerName}</p>}
            </div>
          )}
          {editing ? (
            <ResubmitForm req={req} onDone={() => setEditing(false)} />
          ) : (
            <Button size="sm" onClick={() => setEditing(true)} data-testid={`button-edit-resubmit-${req.id}`}>
              Update & Resubmit
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function MyRegularizations() {
  const [showModal, setShowModal] = useState(false);

  const { data: requests, isLoading } = useQuery<RegularizationRequest[]>({
    queryKey: ["/api/hr/attendance/regularization/my"],
  });

  const pendingDates = new Set(
    (requests || []).filter(r => r.status === "pending").map(r => r.attendanceDate)
  );

  const pending = (requests || []).filter(r => r.status === "pending");
  const history = (requests || []).filter(r => r.status !== "pending");

  return (
    <div className="space-y-4 max-w-2xl" data-testid="my-regularizations">
      {/* Primary CTA */}
      <Button
        className="w-full sm:w-auto"
        onClick={() => setShowModal(true)}
        data-testid="button-raise-correction"
      >
        <Plus className="h-4 w-4 mr-2" />
        Raise a Correction
      </Button>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : (
        <>
          {/* Pending */}
          {pending.length > 0 && (
            <Card data-testid="reg-pending-section">
              <div className="px-4 py-3 border-b">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  Pending
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-xs">
                    {pending.length}
                  </Badge>
                </h3>
              </div>
              <CardContent className="p-0">
                {pending.map(req => <RegRow key={req.id} req={req} />)}
              </CardContent>
            </Card>
          )}

          {/* History */}
          {history.length > 0 ? (
            <Card data-testid="reg-history-section">
              <div className="px-4 py-3 border-b">
                <h3 className="text-sm font-semibold text-muted-foreground">History</h3>
              </div>
              <CardContent className="p-0">
                {history.map(req => <RegRow key={req.id} req={req} />)}
              </CardContent>
            </Card>
          ) : pending.length === 0 && (
            <div className="text-center py-12" data-testid="reg-empty-state">
              <CheckCircle2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No regularization requests yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Use the button above if you need to correct your attendance record.</p>
            </div>
          )}
        </>
      )}

      {showModal && (
        <RaiseModal pendingDates={pendingDates} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
