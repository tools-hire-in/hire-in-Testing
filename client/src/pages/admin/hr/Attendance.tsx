import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  LogIn,
  LogOut as LogOutIcon,
  CheckCircle2,
  Coffee,
  ShieldOff,
  Clock4,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Plus,
  X,
  Check,
  Info,
  Lock,
  Paperclip,
  Eye,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BreakWidget } from "@/components/admin/BreakWidget";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useUpload } from "@/hooks/use-upload";
import { PillTabs, PillTabsContent, PillTabsList, PillTabsTrigger } from "@/components/ui/pill-tabs";

interface DashboardStats {
  todayStatus: "not_punched" | "punched_in" | "completed" | "exempt";
  punchInTime: string | null;
  punchOutTime: string | null;
  presentDaysThisMonth: number;
  totalHoursThisMonth: string;
  pendingLeaveRequests: number;
  productiveHoursToday: string | null;
  correctionsThisMonth: number;
  deficitMinutes?: number;
  deficitPoolEnabled?: boolean;
}

interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  punchIn: string | null;
  punchOut: string | null;
  totalHours: string | null;
  status: string;
  notes: string | null;
  isCorrect?: boolean;
}

interface GraceUsageRow {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  shift: string;
  lateCount: number;
}

interface RegularizationRequest {
  id: string;
  employeeId: string;
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

interface PolicyConfig {
  policyVersion: string;
  monthEndBlackoutDays: number;
}

const TARGET_HOURS = 9;

function formatElapsed(ms: number): string {
  if (ms <= 0) return "0h 00m";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function formatTime(ts: string | null): string {
  if (!ts) return "--:--";
  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function formatShiftTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  present:   { label: "Present",   cls: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  absent:    { label: "Absent",    cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  half_day:  { label: "Half Day",  cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" },
  short_day: { label: "Short Day", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  late:      { label: "Late",      cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  on_leave:  { label: "On Leave",  cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  holiday:   { label: "Holiday",   cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  weekend:   { label: "Weekend",   cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  corrected: { label: "Corrected", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
};

const REG_STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  pending:  { label: "Pending",  cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" },
  returned: { label: "Needs Clarification", cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  approved: { label: "Approved", cls: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  rejected: { label: "Rejected", cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
};

const NEEDS_PUNCH_TYPES = ["missed_punch_in", "missed_punch_out", "correction", "wrong_absent"];

// Extract a HH:mm value (browser-local) from a stored ISO timestamp for time inputs.
function toTimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Whether the chosen issue type requires the corresponding punch time(s).
function punchValid(requestType: string, punchIn: string, punchOut: string): boolean {
  if (requestType === "missed_punch_in") return !!punchIn;
  if (requestType === "missed_punch_out") return !!punchOut;
  if (requestType === "correction" || requestType === "wrong_absent") return !!punchIn && !!punchOut;
  return true;
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  missed_punch_in:  "Missed Punch In",
  missed_punch_out: "Missed Punch Out",
  wrong_absent:     "Wrong Absent Mark",
  correction:       "Time Correction",
};

function StatusBadge({ status, isCorrect }: { status: string; isCorrect?: boolean }) {
  const key = isCorrect && status === "present" ? "corrected" : (status || "absent");
  const cfg = STATUS_STYLE[key] || { label: status, cls: "" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function getWorkingDaysBack(date: string, today: string, holidaySet: Set<string> = new Set()): number {
  if (date > today) return -1;
  if (date === today) return 0;
  const start = new Date(date + "T00:00:00");
  const end = new Date(today + "T00:00:00");
  let wd = 0;
  const cur = new Date(start);
  while (cur < end) {
    const dow = cur.getDay();
    const ds = cur.toISOString().slice(0, 10);
    if (dow !== 0 && dow !== 6 && !holidaySet.has(ds)) wd++;
    cur.setDate(cur.getDate() + 1);
  }
  return wd;
}

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

const WINDOW_CLOSED_MESSAGES: Record<string, string> = {
  month_end_blackout: "This date falls in the month-end payroll lock period. Self-service filing is closed. Please contact HR directly.",
  next_punch_in_exists: "Your filing window has closed — you have already punched in for a subsequent day, which locks the prior record.",
  "24_hours_exceeded": "The 24-hour filing window for this date has expired. Please contact HR for assistance.",
  month_attendance_run_locked: "The attendance report for this month has been approved and locked. Self-service filing is no longer available. Please contact HR to request a correction directly.",
};

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

function ReportIssueModal({
  date,
  currentPunchIn,
  currentPunchOut,
  pendingDates,
  onClose,
}: {
  date?: string;
  currentPunchIn?: string | null;
  currentPunchOut?: string | null;
  pendingDates?: Set<string>;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const isStandalone = !date;
  const [selectedDate, setSelectedDate] = useState(date ?? "");
  const [requestType, setRequestType] = useState("");
  const [requestedPunchIn, setRequestedPunchIn] = useState(toTimeInput(currentPunchIn ?? null));
  const [requestedPunchOut, setRequestedPunchOut] = useState(toTimeInput(currentPunchOut ?? null));
  const [reason, setReason] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [windowClosedMsg, setWindowClosedMsg] = useState<string | null>(null);

  const effectiveDate = date ?? selectedDate;

  // Standalone flow: offer the last 7 calendar days, excluding any with a pending request.
  const dateOptions = getLast7Days().filter((d) => !(pendingDates?.has(d)));

  // Standalone mode: fetch the employee's recent records so we can show the
  // recorded punch times for whichever date they pick (parity with the row flow).
  const { data: standaloneRecords } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/hr/attendance/my", { startDate: getLast7Days()[getLast7Days().length - 1], endDate: getLast7Days()[0] }],
    enabled: isStandalone,
  });
  const standaloneRecord = isStandalone
    ? (standaloneRecords || []).find((r) => r.date === selectedDate)
    : undefined;
  const resolvedPunchIn = isStandalone ? standaloneRecord?.punchIn ?? null : currentPunchIn ?? null;
  const resolvedPunchOut = isStandalone ? standaloneRecord?.punchOut ?? null : currentPunchOut ?? null;

  // When a date is chosen in standalone mode, prefill the editable time inputs
  // with whatever was recorded for that date.
  useEffect(() => {
    if (isStandalone && selectedDate) {
      setRequestedPunchIn(toTimeInput(standaloneRecord?.punchIn ?? null));
      setRequestedPunchOut(toTimeInput(standaloneRecord?.punchOut ?? null));
    }
  }, [isStandalone, selectedDate, standaloneRecord?.punchIn, standaloneRecord?.punchOut]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/hr/attendance/regularization", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceDate: effectiveDate,
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
          setWindowClosedMsg("A regularization request for this date is already pending review. You cannot raise another until it is resolved.");
          throw new Error("WINDOW_CLOSED");
        }
        throw new Error(body.error || "Failed to submit");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance/regularization/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance/my"] });
      toast({ title: "Request Submitted", description: "Your regularization request has been submitted." });
      onClose();
    },
    onError: (err: any) => {
      if (err.message === "WINDOW_CLOSED") return; // already handled inline
      toast({ title: "Error", description: err.message || "Failed to submit", variant: "destructive" });
    },
  });

  const needsPunchFields = NEEDS_PUNCH_TYPES.includes(requestType);
  const reasonLen = reason.trim().length;
  const reasonValid = reasonLen >= MIN_REASON_CHARS;
  const punchOk = punchValid(requestType, requestedPunchIn, requestedPunchOut);
  const hasCurrentTimes = !!effectiveDate && (resolvedPunchIn || resolvedPunchOut);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent data-testid="dialog-report-issue">
        <DialogHeader>
          <DialogTitle>{isStandalone ? "Raise Regularization" : "Report Attendance Issue"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Date</Label>
            {isStandalone ? (
              dateOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-eligible-dates">
                  All dates in the last 7 days already have a pending request.
                </p>
              ) : (
                <Select value={selectedDate} onValueChange={(v) => { setSelectedDate(v); setWindowClosedMsg(null); }}>
                  <SelectTrigger data-testid="select-reg-date">
                    <SelectValue placeholder="Select a date..." />
                  </SelectTrigger>
                  <SelectContent>
                    {dateOptions.map((d) => (
                      <SelectItem key={d} value={d}>{formatDateOption(d)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            ) : (
              <p className="text-sm font-medium text-foreground" data-testid="text-reg-date">{date}</p>
            )}
          </div>

          {windowClosedMsg ? (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800" data-testid="alert-window-closed">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-300">Filing Window Closed</p>
                <p className="text-xs text-red-700 dark:text-red-400 mt-1">{windowClosedMsg}</p>
              </div>
            </div>
          ) : null}

          {hasCurrentTimes && (
            <div className="flex items-center gap-6 p-3 rounded-lg bg-muted/40 border" data-testid="text-current-times">
              <div>
                <p className="text-xs text-muted-foreground">Recorded Punch In</p>
                <p className="text-sm font-mono font-medium">{formatTime(resolvedPunchIn)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Recorded Punch Out</p>
                <p className="text-sm font-mono font-medium">{formatTime(resolvedPunchOut)}</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Issue Type</Label>
            <Select value={requestType} onValueChange={setRequestType}>
              <SelectTrigger data-testid="select-issue-type">
                <SelectValue placeholder="Select issue type..." />
              </SelectTrigger>
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
                <Label>Correct Punch In Time {(requestType === "missed_punch_in" || requestType === "correction" || requestType === "wrong_absent") && <span className="text-destructive">*</span>}</Label>
                <Input
                  type="time"
                  value={requestedPunchIn}
                  onChange={(e) => setRequestedPunchIn(e.target.value)}
                  data-testid="input-reg-punch-in"
                />
              </div>
              <div className="space-y-2">
                <Label>Correct Punch Out Time {(requestType === "missed_punch_out" || requestType === "correction" || requestType === "wrong_absent") && <span className="text-destructive">*</span>}</Label>
                <Input
                  type="time"
                  value={requestedPunchOut}
                  onChange={(e) => setRequestedPunchOut(e.target.value)}
                  data-testid="input-reg-punch-out"
                />
              </div>
            </div>
          )}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>Reason</Label>
              <span className={`text-xs font-mono ${reasonValid ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`} data-testid="text-reason-char-count">
                {reasonLen}/{MIN_REASON_CHARS} min
              </span>
            </div>
            <Textarea
              value={reason}
              onChange={(e) => { setReason(e.target.value); setWindowClosedMsg(null); }}
              placeholder="Explain what happened (minimum 20 characters)..."
              data-testid="input-reg-reason"
              className={!reasonValid && reasonLen > 0 ? "border-amber-400 focus-visible:ring-amber-400" : ""}
            />
            {!reasonValid && reasonLen > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {MIN_REASON_CHARS - reasonLen} more character{MIN_REASON_CHARS - reasonLen === 1 ? "" : "s"} needed
              </p>
            )}
          </div>
          <AttachmentField value={attachmentUrl} onChange={setAttachmentUrl} />
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
            <span>
              Requests must be filed within <strong>24 hours</strong> of end-of-day and before your next punch-in.
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={!effectiveDate || !requestType || !reasonValid || !punchOk || submitMutation.isPending}
            data-testid="button-submit-regularization"
          >
            {submitMutation.isPending ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MyRegularizationsSection() {
  const { data: requests, isLoading } = useQuery<RegularizationRequest[]>({
    queryKey: ["/api/hr/attendance/regularization/my"],
  });

  if (isLoading) {
    return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="text-center py-6">
        <CheckCircle2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No regularization requests yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Date</th>
            <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Type</th>
            <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Reason</th>
            <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Status</th>
            <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Reviewer Note</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => <RegSectionRow key={r.id} req={r} />)}
        </tbody>
      </table>
    </div>
  );
}

function RegSectionRow({ req: r }: { req: RegularizationRequest }) {
  const [editing, setEditing] = useState(false);
  const cfg = REG_STATUS_STYLE[r.status] || { label: r.status, cls: "" };
  const isReturned = r.status === "returned";
  const note = isReturned ? r.returnComment : r.reviewerComment;

  return (
    <>
      <tr className="border-b last:border-0 hover:bg-muted/20" data-testid={`reg-row-${r.id}`}>
        <td className="py-2.5 px-4 font-mono whitespace-nowrap">{r.attendanceDate}</td>
        <td className="py-2.5 px-4 whitespace-nowrap">{REQUEST_TYPE_LABELS[r.requestType] || r.requestType}</td>
        <td className="py-2.5 px-4 text-muted-foreground max-w-[180px]">
          <span className="text-xs">{r.reason}</span>
        </td>
        <td className="py-2.5 px-4">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${cfg.cls}`}>
            {cfg.label}
          </span>
        </td>
        <td className="py-2.5 px-4 text-muted-foreground text-xs">
          <div className="flex items-center gap-2">
            <span>
              {note || "—"}
              {r.reviewerName && <span className="ml-1 text-xs opacity-70">({r.reviewerName})</span>}
            </span>
            {r.attachmentUrl && (
              <a href={r.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline shrink-0" data-testid={`link-attachment-${r.id}`} title="View attachment">
                <Eye className="h-3.5 w-3.5" />
              </a>
            )}
            {isReturned && !editing && (
              <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs shrink-0" onClick={() => setEditing(true)} data-testid={`button-edit-resubmit-${r.id}`}>
                Update & Resubmit
              </Button>
            )}
          </div>
        </td>
      </tr>
      {isReturned && editing && (
        <tr className="border-b last:border-0 bg-muted/20">
          <td colSpan={5} className="px-4 py-3">
            <ResubmitForm req={r} onDone={() => setEditing(false)} />
          </td>
        </tr>
      )}
    </>
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
    <div className="space-y-3" data-testid={`resubmit-form-${req.id}`}>
      {needsPunchFields && (
        <div className="grid grid-cols-2 gap-3 max-w-md">
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
        <div className="flex items-center justify-between max-w-md">
          <Label className="text-xs">Reason</Label>
          <span className={`text-xs font-mono ${reasonValid ? "text-green-600" : "text-muted-foreground"}`}>{reasonLen}/{MIN_REASON_CHARS} min</span>
        </div>
        <Textarea value={reason} onChange={e => setReason(e.target.value)} className="max-w-md" data-testid={`input-resubmit-reason-${req.id}`} />
      </div>
      <AttachmentField value={attachmentUrl} onChange={setAttachmentUrl} />
      <div className="flex gap-2">
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

function GracePeriodUsageTab({ userRole }: { userRole: string }) {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const { data: rows, isLoading } = useQuery<GraceUsageRow[]>({
    queryKey: ["/api/hr/attendance/grace-usage", { month }],
    queryFn: async () => {
      const res = await fetch(`/api/hr/attendance/grace-usage?month=${month}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: ["hr", "admin", "super_admin", "manager"].includes(userRole),
  });

  const sorted = [...(rows || [])].sort((a, b) =>
    sortDir === "desc" ? b.lateCount - a.lateCount : a.lateCount - b.lateCount
  );

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold">Grace Period Usage</h2>
          <p className="text-xs text-muted-foreground">Employees who punched in during the grace window (marked Late)</p>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          data-testid="input-grace-month"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-10">
              <Clock4 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No late punches recorded for this period.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Employee</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Department</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Shift</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">
                      <button
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                        onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}
                        data-testid="button-sort-late-count"
                      >
                        Late Punches
                        {sortDir === "desc" ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr
                      key={r.userId}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                      data-testid={`grace-row-${r.userId}`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium">{r.firstName} {r.lastName}</div>
                        <div className="text-xs text-muted-foreground">{r.email}</div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{r.department}</td>
                      <td className="py-3 px-4 text-muted-foreground">{r.shift}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            r.lateCount >= 5
                              ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                              : r.lateCount >= 3
                              ? "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300"
                              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300"
                          }`}
                          data-testid={`text-late-count-${r.userId}`}
                        >
                          {r.lateCount}×
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Attendance({ view }: { view?: "attendance" | "grace" } = {}) {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { toast } = useToast();
  const [liveMs, setLiveMs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [reportIssueRecord, setReportIssueRecord] = useState<{ date: string; punchIn: string | null; punchOut: string | null } | null>(null);
  const [showStandaloneRaise, setShowStandaloneRaise] = useState(false);

  const params = new URLSearchParams(window.location.search);
  // Use a dedicated param ("att") for this page's internal sub-tab so it does not
  // collide with the parent My Desk router's shared "tab" param (which would otherwise
  // bounce the user back to the Dashboard when switching to Grace Period Usage).
  const requestedTab = params.get("att");
  const canSeeGrace = ["hr", "admin", "super_admin", "manager"].includes(user?.role || "");
  const validTabs = ["attendance", ...(canSeeGrace ? ["grace"] : [])];
  const initialTab = requestedTab && validTabs.includes(requestedTab) ? requestedTab : "attendance";
  const [activeTab, setActiveTab] = useState(initialTab);

  // When embedded in My Desk, the parent provides a single-level `view` so this
  // page renders exactly one section without its own (nested) tab bar.
  const embedded = view !== undefined;
  const effectiveTab = embedded
    ? (view === "grace" && canSeeGrace ? "grace" : "attendance")
    : activeTab;

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/hr/dashboard-stats"],
    enabled: isAuthenticated,
    refetchInterval: 60000,
  });

  const { data: myShift } = useQuery<{
    id: string; name: string; displayLabel: string;
    istStart: string; istEnd: string; isDst: boolean;
    usCoverage: string; usCoverageDst: string | null; usCoverageStd: string | null;
    dstTransition: { date: string; newStart: string; newEnd: string } | null;
  } | null>({
    queryKey: ["/api/hr/my-shift"],
    enabled: isAuthenticated,
  });

  const { data: policyConfig } = useQuery<PolicyConfig>({
    queryKey: ["/api/hr/attendance/regularization/policy"],
    enabled: isAuthenticated,
  });

  const { data: myRegularizations } = useQuery<RegularizationRequest[]>({
    queryKey: ["/api/hr/attendance/regularization/my"],
    enabled: isAuthenticated,
  });

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const { data: records } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/hr/attendance/my", { startDate: monthStart, endDate: todayStr }],
    enabled: isAuthenticated,
  });


  useEffect(() => {
    if (stats?.punchInTime && stats.todayStatus === "punched_in") {
      const tick = () => setLiveMs(Date.now() - new Date(stats.punchInTime!).getTime());
      tick();
      timerRef.current = setInterval(tick, 30000);
    } else if (stats?.punchInTime && stats?.punchOutTime) {
      setLiveMs(new Date(stats.punchOutTime).getTime() - new Date(stats.punchInTime).getTime());
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      setLiveMs(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [stats?.punchInTime, stats?.punchOutTime, stats?.todayStatus]);

  const punchInMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hr/attendance/punch-in"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance/my"] });
      toast({ title: "Punched In", description: "Your attendance has been recorded." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to punch in", variant: "destructive" });
    },
  });

  const punchOutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hr/attendance/punch-out"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance/my"] });
      toast({ title: "Punched Out", description: "See you next shift!" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to punch out", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const url = new URL(window.location.href);
    if (value === "attendance") url.searchParams.delete("att");
    else url.searchParams.set("att", value);
    window.history.replaceState({}, "", url.toString());
  };

  const punchedIn = stats?.todayStatus === "punched_in";
  const dayComplete = stats?.todayStatus === "completed";
  const isExempt = stats?.todayStatus === "exempt";
  const progressPct = Math.min(100, (liveMs / (TARGET_HOURS * 3600000)) * 100);
  const todayDate = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const blackoutDays = policyConfig?.monthEndBlackoutDays ?? 3;
  const recentRecords = [...(records || [])].sort((a, b) => b.date.localeCompare(a.date));

  // Per-date blackout check: mirrors backend isBlackoutDate().
  // A date is blacked out if it falls in the last N calendar days of ITS OWN month,
  // regardless of what today's date is.
  // (distinct from the global banner which checks if TODAY is in the current month's blackout window)
  const isBlackoutDate = (dateStr: string): boolean => {
    if (blackoutDays <= 0) return false;
    const d = new Date(dateStr + "T12:00:00");
    const lastDayOfDateMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return d.getDate() > lastDayOfDateMonth - blackoutDays;
  };

  // Global banner: true when TODAY is in the current month's blackout window
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const isBlackoutNow = now.getDate() > lastDayOfMonth - blackoutDays;

  // Build a map of dates → whether the next-day has a punch-in (locks that date)
  const laterPunchedInDates = new Set<string>();
  const sortedRecords = [...(records || [])].sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 0; i < sortedRecords.length; i++) {
    if (sortedRecords[i].punchIn) {
      // All earlier dates in the same records list are locked by this punch-in
      for (let j = 0; j < i; j++) {
        laterPunchedInDates.add(sortedRecords[j].date);
      }
    }
  }

  // Per-date filing window check — mirrors server rules client-side for UX hints
  // Uses IST end-of-day (UTC+5:30) to match server-side isWithinFilingWindow
  const isWithin24h = (dateStr: string) => {
    const dayEndIST = new Date(`${dateStr}T23:59:59+05:30`);
    return (now.getTime() - dayEndIST.getTime()) < 24 * 60 * 60 * 1000;
  };

  // Build a set of dates with pending regularization requests
  const pendingDates = new Set(
    (myRegularizations || []).filter(r => r.status === "pending").map(r => r.attendanceDate)
  );

  return (
    <AdminLayout>
      <div className="space-y-5 v2-surface">
        <PillTabs value={effectiveTab} onValueChange={handleTabChange} data-testid="tabs-attendance">
          {!embedded && (
            <PillTabsList>
              <PillTabsTrigger value="attendance" data-testid="tab-attendance">My Attendance</PillTabsTrigger>
              {canSeeGrace && (
                <PillTabsTrigger value="grace" data-testid="tab-grace">Grace Period Usage</PillTabsTrigger>
              )}
            </PillTabsList>
          )}

          <PillTabsContent value="attendance">
            <div className="space-y-4 max-w-xl">

              {/* ── ATTENDANCE EXEMPT NOTICE ── */}
              {isExempt && (
                <Card className="border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30" data-testid="card-attendance-exempt">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <ShieldOff className="h-6 w-6 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                      <div>
                        <h3 className="font-semibold text-blue-800 dark:text-blue-300 text-base">Attendance Exempt</h3>
                        <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                          Your account is marked as attendance exempt. You are not required to punch in or out.
                          Leave balances and accruals continue to work normally for your account.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── TODAY'S TIME CARD (hidden for exempt users) ── */}
              {!isExempt && <Card className="overflow-hidden border-2 border-border">
                <CardContent className="p-0">

                  {/* Header */}
                  <div className="flex items-start justify-between px-5 pt-5 pb-3">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                        {todayDate}
                      </p>
                      <p className="text-sm font-semibold mt-0.5 text-foreground">Today's Time Card</p>
                      {myShift && myShift.istStart && myShift.istEnd && (
                        <div className="mt-1 space-y-0.5" data-testid="text-shift-info">
                          <p className="text-xs text-muted-foreground">
                            {myShift.displayLabel ?? myShift.name} · {formatShiftTime(myShift.istStart)} – {formatShiftTime(myShift.istEnd)} IST
                          </p>
                          {(myShift.usCoverageDst || myShift.usCoverageStd || myShift.usCoverage) && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <span>{myShift.isDst
                                ? (myShift.usCoverageDst ?? myShift.usCoverage)
                                : (myShift.usCoverageStd ?? myShift.usCoverage)
                              }</span>
                              <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                                {myShift.isDst ? "Summer schedule" : "Winter schedule"} · active
                              </span>
                            </p>
                          )}
                          {myShift.dstTransition && (
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                              Schedule changes on {myShift.dstTransition.date}: {formatShiftTime(myShift.dstTransition.newStart)} – {formatShiftTime(myShift.dstTransition.newEnd)} IST
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    {isLoading ? (
                      <Skeleton className="h-6 w-20" />
                    ) : (
                      <Badge
                        variant={dayComplete ? "default" : punchedIn ? "secondary" : "outline"}
                        className="text-xs"
                        data-testid="badge-attendance-status"
                      >
                        {dayComplete ? "Day Complete" : punchedIn ? "● Working" : "Not Started"}
                      </Badge>
                    )}
                  </div>

                  {/* Live hours + progress */}
                  <div className="px-5 pb-4 space-y-2">
                    {isLoading ? (
                      <Skeleton className="h-12 w-full" />
                    ) : (
                      <>
                        <div className="flex items-end justify-between">
                          <span
                            className={`text-4xl font-mono font-bold tracking-tight ${punchedIn ? "text-foreground" : "text-muted-foreground"}`}
                            data-testid="text-hours-worked"
                          >
                            {(punchedIn || dayComplete) ? formatElapsed(liveMs) : "—h ——m"}
                          </span>
                          <span className="text-sm text-muted-foreground mb-1">of {TARGET_HOURS}h target</span>
                        </div>
                        {(punchedIn || dayComplete) && (
                          <Progress value={progressPct} className="h-2.5" data-testid="progress-hours" />
                        )}
                      </>
                    )}
                  </div>

                  {/* In / Out times */}
                  <div className="grid grid-cols-2 gap-px bg-border mx-5 rounded-lg overflow-hidden">
                    <div className="bg-muted/40 p-3 text-center">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Punch In</p>
                      <p className="text-base font-semibold font-mono" data-testid="text-punch-in-time">
                        {formatTime(stats?.punchInTime || null)}
                      </p>
                    </div>
                    <div className="bg-muted/40 p-3 text-center">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Punch Out</p>
                      <p className="text-base font-semibold font-mono" data-testid="text-punch-out-time">
                        {formatTime(stats?.punchOutTime || null)}
                      </p>
                    </div>
                  </div>

                  {/* Main action button */}
                  <div className="px-5 py-4">
                    {isLoading ? (
                      <Skeleton className="h-12 w-full" />
                    ) : !stats || stats.todayStatus === "not_punched" ? (
                      <Button
                        className="w-full h-12 text-base font-semibold gap-2"
                        onClick={() => punchInMutation.mutate()}
                        disabled={punchInMutation.isPending}
                        data-testid="button-punch-in"
                      >
                        <LogIn className="h-5 w-5" />
                        {punchInMutation.isPending ? "Starting your day…" : "Punch In"}
                      </Button>
                    ) : stats?.todayStatus === "punched_in" ? (
                      <Button
                        className="w-full h-12 text-base font-semibold gap-2"
                        variant="secondary"
                        onClick={() => punchOutMutation.mutate()}
                        disabled={punchOutMutation.isPending}
                        data-testid="button-punch-out"
                      >
                        <LogOutIcon className="h-5 w-5" />
                        {punchOutMutation.isPending ? "Wrapping up…" : "Punch Out"}
                      </Button>
                    ) : (
                      <div className="flex items-center justify-center gap-2 py-2 text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="text-sm font-medium">
                          {stats?.productiveHoursToday
                            ? `${stats.productiveHoursToday} productive — great work!`
                            : "Attendance recorded for today"}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>}

              {/* ── BREAKS (only when punched in) ── */}
              {punchedIn && (
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-2 mb-3">
                      <Coffee className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Breaks</span>
                    </div>
                    <BreakWidget punchedIn={punchedIn} />
                  </CardContent>
                </Card>
              )}

              {/* ── MONTH SUMMARY ── */}
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-mono font-bold" data-testid="text-days-present">
                      {isLoading ? <Skeleton className="h-8 w-12 mx-auto" /> : (stats?.presentDaysThisMonth ?? 0)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Days Present</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-mono font-bold">
                      {isLoading ? <Skeleton className="h-8 w-12 mx-auto" /> : (stats?.totalHoursThisMonth ?? "0")}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Hours This Month</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-mono font-bold">
                      {isLoading ? <Skeleton className="h-8 w-12 mx-auto" /> : (
                        stats?.presentDaysThisMonth && stats.totalHoursThisMonth
                          ? (parseFloat(stats.totalHoursThisMonth) / stats.presentDaysThisMonth).toFixed(1)
                          : "0"
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Avg Hrs / Day</p>
                  </CardContent>
                </Card>
              </div>

              {/* ── DEFICIT POOL CARD (only when feature is ON and pool > 0) ── */}
              {stats?.deficitPoolEnabled && (stats?.deficitMinutes ?? 0) > 0 && (
                <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                          Short-Day Deficit Pool — {stats.deficitMinutes} min accumulated this month
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                          Each time you punch out short, the shortfall is added here. At month-end, the total is reviewed: small deficits are forgiven; larger ones are converted to fractional LWP (EL balance offset first, then SL, then raw LWP).
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── RECENT RECORDS ── */}
              <Card>
                <CardContent className="p-0">
                  <div className="px-5 py-3.5 border-b">
                    <h3 className="text-sm font-semibold">Recent Records</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      You have 24 hours from each attendance date to raise a correction. The lock icon indicates a closed filing window.
                      {isBlackoutNow && <span className="ml-1 text-amber-600 dark:text-amber-400 font-medium">Month-end payroll lock is active — self-service filing is suspended.</span>}
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Date</th>
                          <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">In</th>
                          <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Out</th>
                          <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Hours</th>
                          <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Status</th>
                          <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentRecords.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                              No records this month yet
                            </td>
                          </tr>
                        ) : recentRecords.map((r) => {
                          const d = new Date(r.date + "T12:00:00");
                          const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
                          const dateLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                          const isToday = r.date === todayStr;
                          const isEligibleType = r.status !== "weekend" && r.status !== "holiday";
                          const within24h = isWithin24h(r.date);
                          const lockedByNextPunchIn = laterPunchedInDates.has(r.date);
                          const isBlackoutForRow = isBlackoutDate(r.date);
                          const windowOpen = isEligibleType && within24h && !lockedByNextPunchIn && !isBlackoutForRow;
                          const windowClosed = isEligibleType && (!within24h || lockedByNextPunchIn || isBlackoutForRow);
                          const hasPending = pendingDates.has(r.date);
                          return (
                            <tr
                              key={r.date}
                              className={`border-b last:border-0 transition-colors ${isToday ? "bg-primary/5 font-medium" : "hover:bg-muted/30"}`}
                              data-testid={`attendance-row-${r.date}`}
                            >
                              <td className="py-3 px-4">
                                <span className="font-medium">{dateLabel}</span>
                                <span className="text-xs text-muted-foreground ml-1.5">{dayName}</span>
                              </td>
                              <td className="py-3 px-4 font-mono text-sm">{formatTime(r.punchIn)}</td>
                              <td className="py-3 px-4 font-mono text-sm">{formatTime(r.punchOut)}</td>
                              <td className="py-3 px-4 font-mono text-sm">
                                {r.totalHours ? `${parseFloat(r.totalHours).toFixed(1)}h` : "—"}
                              </td>
                              <td className="py-3 px-4">
                                <StatusBadge status={r.status} isCorrect={r.isCorrect} />
                              </td>
                              <td className="py-3 px-4">
                                {hasPending ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    Pending
                                  </span>
                                ) : windowOpen ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2.5 text-xs border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
                                    onClick={() => setReportIssueRecord({ date: r.date, punchIn: r.punchIn, punchOut: r.punchOut })}
                                    data-testid={`button-report-issue-${r.date}`}
                                  >
                                    <Plus className="h-3.5 w-3.5 mr-1" />
                                    Fix Record
                                  </Button>
                                ) : windowClosed ? (
                                  <span
                                    className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                                    title="Filing window closed — contact HR for corrections"
                                    data-testid={`lock-${r.date}`}
                                  >
                                    <Lock className="h-3.5 w-3.5" />
                                    Window closed
                                  </span>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* ── ATTENDANCE REGULARIZATION HISTORY ── */}
              <Card>
                <CardContent className="p-0">
                  <div className="px-5 py-3.5 border-b flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">Attendance Regularization</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Your correction requests and their status. Use "Fix" on a record above, or raise one for another date.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => setShowStandaloneRaise(true)}
                      data-testid="button-raise-correction"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Raise a Correction
                    </Button>
                  </div>
                  <MyRegularizationsSection />
                </CardContent>
              </Card>

            </div>
          </PillTabsContent>

          {canSeeGrace && (
            <PillTabsContent value="grace">
              <GracePeriodUsageTab userRole={user?.role || ""} />
            </PillTabsContent>
          )}
        </PillTabs>
      </div>

      {/* Report Issue Modal — opened by "Fix Record" in the time card */}
      {reportIssueRecord && (
        <ReportIssueModal
          date={reportIssueRecord.date}
          currentPunchIn={reportIssueRecord.punchIn}
          currentPunchOut={reportIssueRecord.punchOut}
          pendingDates={pendingDates}
          onClose={() => setReportIssueRecord(null)}
        />
      )}

      {/* Standalone "Raise a Correction" — fallback for dates not in the row list */}
      {showStandaloneRaise && (
        <ReportIssueModal
          pendingDates={pendingDates}
          onClose={() => setShowStandaloneRaise(false)}
        />
      )}
    </AdminLayout>
  );
}
