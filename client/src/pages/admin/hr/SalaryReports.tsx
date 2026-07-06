import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileBarChart, Download, Send, Eye, Users, Clock, DollarSign, Loader2, Mail, Plus, X, ChevronDown, ChevronUp, Save, RefreshCw, AlertTriangle, ArrowRight, CheckCircle2, Clock3, History, Pencil, MessageSquare, ShieldCheck, CalendarDays, XCircle, BellRing, Receipt, Layers, Trash2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import AttendanceOversight from "@/components/admin/hr/AttendanceOversight";

interface EmployeeReportRow {
  employeeName: string;
  email: string;
  designation: string;
  department: string;
  salary: number;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  paidLeaves: number;
  lopLeaves: number;
  holidays: number;
  totalHours: number;
  attendancePercentage: number;
  grossSalary: number;
  deductions: number;
  advanceRecovery: number;
  netPayable: number;
}

interface SalaryReportSummary {
  year: number;
  month: number;
  monthName: string;
  totalEmployees: number;
  totalPayable: number;
  totalDeductions: number;
  totalHoursWorked: number;
  generatedAt: string;
}

interface SalaryReportResult {
  rows: EmployeeReportRow[];
  summary: SalaryReportSummary;
  csv: string;
}

interface AdjustmentField {
  oldValue: number;
  newValue: number;
}

interface Adjustment {
  employeeName: string;
  email: string;
  comment: string;
  fields: Record<string, AdjustmentField>;
}

interface RunOverrideMeta {
  reason: string;
  actorId: string;
  at: string;
  count?: number;
}

interface SalaryRun {
  id: string;
  year: number;
  month: number;
  status: "pending_approval" | "approved" | "sent";
  generatedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  approverName: string | null;
  emailSentAt: string | null;
  createdAt: string | null;
  adjustedCount: number;
  reportData?: EmployeeReportRow[];
  adjustments?: Record<string, Adjustment> & {
    _overrides?: {
      attendanceApprovalOverride?: RunOverrideMeta;
      pendingRegularizationsOverride?: RunOverrideMeta;
    };
  };
}

const MONTHS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const monthName = (m: number) => MONTHS.find(x => x.value === String(m))?.label || String(m);

interface BreakdownVals {
  baseSalary: number;
  salaryCredit: number;
  grossSalary: number;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  paidLeaves: number;
  lopLeaves: number;
  deductions: number;
  dailyRate: number;
  advanceRecovery: number;
  netPayable: number;
}

interface RegenerateDiffRow {
  userId: string;
  name: string;
  email: string;
  oldNetPayable: number | null;
  newNetPayable: number;
  oldLopLeaves: number | null;
  newLopLeaves: number;
  isNew: boolean;
  changed: boolean;
  changeReason?: string;
  newVals: BreakdownVals;
  oldVals: BreakdownVals | null;
}

const SALARY_EDIT_ROLES = ["super_admin", "admin", "hr"];
const inr = (val: number | null) => val === null
  ? "—"
  : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);
const fmtDays = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ""));

// ── One line of the pay-math breakdown. Shows the new value and, when an old
// slip exists and the value moved, a struck old → new delta.
function BreakdownLine({
  label, oldV, newV, format, sign, emphasize,
}: {
  label: string;
  oldV: number | null;
  newV: number;
  format: (n: number) => string;
  sign?: "+" | "−";
  emphasize?: boolean;
}) {
  const changed = oldV !== null && Math.abs(newV - oldV) > 0.009;
  return (
    <div className={`flex items-center justify-between gap-3 py-1 ${emphasize ? "font-semibold" : ""}`} data-testid={`breakdown-line-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
      <span className={`text-xs ${emphasize ? "text-foreground" : "text-muted-foreground"}`}>
        {sign && <span className="mr-1 text-muted-foreground">{sign}</span>}{label}
      </span>
      <span className="font-mono text-xs tabular-nums">
        {changed && <span className="text-muted-foreground line-through mr-1.5">{format(oldV as number)}</span>}
        <span className={changed ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>{format(newV)}</span>
      </span>
    </div>
  );
}

// ── Inline base-salary correction. Writes to the salary ledger via the
// governed endpoint (super-admin applies immediately; admin/HR create a
// maker-checker pending change). Reason is mandatory.
function BaseSalaryEditor({ row, month, year, onDone }: { row: RegenerateDiffRow; month: string; year: string; onDone: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(Math.round(row.newVals.baseSalary)));
  const [reason, setReason] = useState("");

  const save = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hr/salary-slips/correct-salary", {
      userId: row.userId, month: parseInt(month), year: parseInt(year), newSalary: parseFloat(value), reason: reason.trim(),
    }),
    onSuccess: async (res) => {
      const data = await res.json();
      setOpen(false); setReason("");
      if (data.status === "pending_approval") {
        toast({ title: "Sent for approval", description: `Salary change for ${row.name} awaits Super-Admin approval before it applies.` });
      } else {
        toast({ title: "Salary corrected", description: `${row.name}'s base salary updated and applied.` });
      }
      onDone();
    },
    onError: (err: any) => toast({ title: "Could not correct salary", description: err.message || "Failed", variant: "destructive" }),
  });

  const num = parseFloat(value);
  const valid = Number.isFinite(num) && num > 0 && reason.trim().length >= 5;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" data-testid={`button-edit-salary-${row.userId}`}>
          <Pencil className="h-3 w-3" /> Correct base salary
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Correct base monthly salary</p>
            <p className="text-xs text-muted-foreground">Writes to the salary ledger, effective {MONTHS.find(m => m.value === month)?.label} {year}.</p>
          </div>
          <div>
            <Label className="text-xs">New monthly salary (₹)</Label>
            <Input type="number" min="0" value={value} onChange={e => setValue(e.target.value)} className="h-8 mt-1" data-testid={`input-new-salary-${row.userId}`} />
          </div>
          <div>
            <Label className="text-xs">Reason (required)</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Why is this correction needed?" className="mt-1 text-sm" data-testid={`input-salary-reason-${row.userId}`} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={!valid || save.isPending} onClick={() => save.mutate()} data-testid={`button-save-salary-${row.userId}`}>
              {save.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface MemberAttendanceRec { id: string; date: string; status: string; punchIn: string | null; punchOut: string | null; correctionNote?: string | null; }

// ── Per-day attendance correction (best-practice day picker). Reuses the
// existing audited admin-correction engine, which marks a working day as
// "present". Correcting attendance re-derives LOP/deductions on the next
// preview refresh.
function AttendanceCorrector({ row, month, year, onDone }: { row: RegenerateDiffRow; month: string; year: string; onDone: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editDate, setEditDate] = useState<string | null>(null);
  const [punchIn, setPunchIn] = useState("09:00");
  const [punchOut, setPunchOut] = useState("18:00");
  const [note, setNote] = useState("");

  const m = parseInt(month), y = parseInt(year);
  const daysInMonth = new Date(y, m, 0).getDate();
  const startDate = `${y}-${String(m).padStart(2, "0")}-01`;
  const endDate = `${y}-${String(m).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const { data, isLoading, refetch } = useQuery<{ attendance: MemberAttendanceRec[] }>({
    queryKey: [`/api/hr/attendance/member/${row.userId}/range`, { startDate, endDate }],
    enabled: open,
  });

  const byDate = new Map((data?.attendance || []).map(r => [r.date, r]));
  const todayStr = new Date().toISOString().slice(0, 10);
  const workingDays: { date: string; weekday: string; status: string }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(y, m - 1, d);
    const dow = dt.getDay();
    if (dow === 0 || dow === 6) continue;
    const ds = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (ds > todayStr) continue;
    workingDays.push({ date: ds, weekday: dt.toLocaleDateString("en-US", { weekday: "short" }), status: byDate.get(ds)?.status || "absent" });
  }

  const save = useMutation({
    mutationFn: (date: string) => apiRequest("POST", "/api/hr/attendance/admin-correction", {
      userId: row.userId, date, punchIn, punchOut, correctionNote: note.trim(),
    }),
    onSuccess: async () => {
      toast({ title: "Attendance corrected", description: `Marked present — net pay will refresh.` });
      setEditDate(null); setNote("");
      await refetch();
      onDone();
    },
    onError: (err: any) => toast({ title: "Could not correct day", description: err.message || "Failed", variant: "destructive" }),
  });

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      present: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      absent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      on_leave: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      holiday: "bg-muted text-muted-foreground",
    };
    return <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${map[s] || "bg-muted text-muted-foreground"}`}>{s.replace("_", " ")}</span>;
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditDate(null); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" data-testid={`button-edit-attendance-${row.userId}`}>
          <CalendarDays className="h-3 w-3" /> Correct attendance
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="start">
        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium">Correct attendance days</p>
            <p className="text-xs text-muted-foreground">Mark a working day as present. LOP &amp; deductions recompute on refresh.</p>
          </div>
          {isLoading ? (
            <div className="py-6 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
              {workingDays.map(day => (
                <div key={day.date} className="p-2" data-testid={`attendance-day-${row.userId}-${day.date}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono">{day.weekday} {day.date.slice(8)}/{day.date.slice(5, 7)}</span>
                    <div className="flex items-center gap-2">
                      {statusBadge(day.status)}
                      {day.status !== "present" && day.status !== "on_leave" && day.status !== "holiday" && (
                        <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={() => { setEditDate(editDate === day.date ? null : day.date); setNote(""); }} data-testid={`button-mark-present-${row.userId}-${day.date}`}>
                          Mark present
                        </Button>
                      )}
                    </div>
                  </div>
                  {editDate === day.date && (
                    <div className="mt-2 space-y-2 bg-muted/40 rounded p-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1"><Label className="text-[10px]">In</Label><Input type="time" value={punchIn} onChange={e => setPunchIn(e.target.value)} className="h-7 text-xs" /></div>
                        <div className="flex-1"><Label className="text-[10px]">Out</Label><Input type="time" value={punchOut} onChange={e => setPunchOut(e.target.value)} className="h-7 text-xs" /></div>
                      </div>
                      <Textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Correction note (required)" className="text-xs" data-testid={`input-attendance-note-${row.userId}-${day.date}`} />
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" className="h-7" onClick={() => setEditDate(null)}>Cancel</Button>
                        <Button size="sm" className="h-7" disabled={note.trim().length < 1 || save.isPending} onClick={() => save.mutate(day.date)} data-testid={`button-save-attendance-${row.userId}-${day.date}`}>
                          {save.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {workingDays.length === 0 && <p className="text-xs text-muted-foreground p-3 text-center">No correctable working days.</p>}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── One employee: collapsed summary row that expands to the full pay math and
// inline correction controls.
function EmployeeBreakdownRow({ row, canEdit, month, year, onCorrected, expanded, onToggle }: {
  row: RegenerateDiffRow; canEdit: boolean; month: string; year: string; onCorrected: () => void; expanded: boolean; onToggle: () => void;
}) {
  const { newVals: nv, oldVals: ov } = row;
  return (
    <div className={`border rounded-lg ${row.isNew ? "border-blue-200 dark:border-blue-900" : row.changed ? "border-amber-200 dark:border-amber-900" : ""}`} data-testid={`employee-row-${row.userId}`}>
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between gap-3 p-3 text-left hover-elevate rounded-lg" data-testid={`button-expand-${row.userId}`}>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{row.name}</p>
          <p className="text-xs text-muted-foreground truncate">{row.email}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {row.isNew ? (
            <Badge variant="secondary" className="text-[10px]">New</Badge>
          ) : row.changed ? (
            <span className="hidden sm:inline text-[11px] text-amber-700 dark:text-amber-400 max-w-[180px] truncate">{row.changeReason || "Changed"}</span>
          ) : null}
          <div className="text-right font-mono text-xs">
            {ov && Math.abs(nv.netPayable - (ov.netPayable)) > 0.5 && <span className="text-muted-foreground line-through mr-1.5">{inr(row.oldNetPayable)}</span>}
            <span className="font-semibold">{inr(nv.netPayable)}</span>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>
      {expanded && (
        <div className="border-t p-3 space-y-3">
          <div className="grid sm:grid-cols-2 gap-x-6">
            <div>
              <BreakdownLine label="Base Salary" oldV={ov?.baseSalary ?? null} newV={nv.baseSalary} format={inr} />
              <BreakdownLine label="Salary Credits" oldV={ov?.salaryCredit ?? null} newV={nv.salaryCredit} format={inr} sign="+" />
              <BreakdownLine label="Gross Salary" oldV={ov?.grossSalary ?? null} newV={nv.grossSalary} format={inr} emphasize />
              <div className="border-t my-1" />
              <BreakdownLine label="Daily Rate" oldV={ov?.dailyRate ?? null} newV={nv.dailyRate} format={inr} />
              <BreakdownLine label="Deductions (LOP)" oldV={ov?.deductions ?? null} newV={nv.deductions} format={inr} sign="−" />
              <BreakdownLine label="Advance Recovery" oldV={ov?.advanceRecovery ?? null} newV={nv.advanceRecovery} format={inr} sign="−" />
              <div className="border-t my-1" />
              <BreakdownLine label="Net Payable" oldV={ov?.netPayable ?? null} newV={nv.netPayable} format={inr} emphasize />
            </div>
            <div>
              <BreakdownLine label="Working Days" oldV={ov?.workingDays ?? null} newV={nv.workingDays} format={fmtDays} />
              <BreakdownLine label="Present Days" oldV={ov?.presentDays ?? null} newV={nv.presentDays} format={fmtDays} />
              <BreakdownLine label="Paid Leaves" oldV={ov?.paidLeaves ?? null} newV={nv.paidLeaves} format={fmtDays} />
              <BreakdownLine label="LOP Days" oldV={ov?.lopLeaves ?? null} newV={nv.lopLeaves} format={fmtDays} />
              <BreakdownLine label="Absent Days" oldV={ov?.absentDays ?? null} newV={nv.absentDays} format={fmtDays} />
            </div>
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2 pt-1">
              <BaseSalaryEditor row={row} month={month} year={year} onDone={onCorrected} />
              <AttendanceCorrector row={row} month={month} year={year} onDone={onCorrected} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RegenerateMonthModal({ month, year, onClose }: { month: string; year: string; onClose: () => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const role = (user as any)?.role || "";
  const [step, setStep] = useState<"warn" | "diff" | "done">("warn");
  const [diff, setDiff] = useState<RegenerateDiffRow[]>([]);
  const [changedCount, setChangedCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [periodLocked, setPeriodLocked] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const canEdit = SALARY_EDIT_ROLES.includes(role) && !periodLocked;
  const monthLabel = MONTHS.find(m => m.value === month)?.label || month;
  const fmt = inr;

  const previewMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hr/salary-slips/regenerate", { month: parseInt(month), year: parseInt(year), dryRun: true }),
    onSuccess: async (res) => {
      const data = await res.json();
      const rows: RegenerateDiffRow[] = data.diff || [];
      setDiff(rows);
      setChangedCount(data.changedCount || 0);
      setNewCount(rows.filter(r => r.isNew).length);
      setPeriodLocked(!!data.periodLocked);
      setStep("diff");
    },
    onError: (err: any) => { toast({ title: "Error", description: err.message || "Failed to preview", variant: "destructive" }); },
  });

  const confirmMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hr/salary-slips/regenerate", { month: parseInt(month), year: parseInt(year), dryRun: false }),
    onSuccess: async (res) => {
      const data = await res.json();
      setSavedCount(data.upsertedCount || 0);
      queryClient.invalidateQueries({ queryKey: ["/api/hr/salary-slips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/admin/salary-slips"] });
      toast({ title: "Salary Slips Regenerated", description: `${data.upsertedCount} slips updated for ${monthLabel} ${year}` });
      setStep("done");
    },
    onError: (err: any) => { toast({ title: "Error", description: err.message || "Failed to regenerate", variant: "destructive" }); },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-regenerate-month">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Regenerate Salary Slips — {monthLabel} {year}
          </DialogTitle>
        </DialogHeader>

        {step === "warn" && (
          <>
            <div className="space-y-4 py-2">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">Existing slips will be overwritten</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    All salary slip records for <strong>{monthLabel} {year}</strong> will be recalculated and replaced with corrected values.
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending} data-testid="button-preview-regenerate">
                {previewMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Calculating...</> : <><Eye className="h-4 w-4 mr-2" />Preview Changes</>}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "diff" && (
          <>
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 text-sm flex-wrap">
                <span className="font-medium">{diff.length} employees</span>
                {changedCount > 0 && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-amber-600 dark:text-amber-400 font-medium">{changedCount} will change</span>
                  </>
                )}
                {newCount > 0 && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-blue-600 dark:text-blue-400 font-medium">{newCount} new</span>
                  </>
                )}
                {changedCount === 0 && newCount === 0 && <span className="text-green-600 dark:text-green-400">· No changes detected</span>}
              </div>

              {periodLocked && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted border text-xs">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">This month's salary run is <strong>approved &amp; locked</strong>. You can review the pay math but inline corrections are disabled — use an off-cycle adjustment instead.</span>
                </div>
              )}
              {!periodLocked && canEdit && (
                <p className="text-xs text-muted-foreground">Expand an employee to see the full pay math. Corrections write back to the source (salary ledger &amp; attendance) and are audited — the preview refreshes automatically.</p>
              )}

              {diff.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">No employees found for this period</p>
              ) : (
                <div className="space-y-2 max-h-[52vh] overflow-y-auto pr-1">
                  {diff.map((row) => (
                    <EmployeeBreakdownRow
                      key={row.userId}
                      row={row}
                      canEdit={canEdit}
                      month={month}
                      year={year}
                      expanded={expandedUser === row.userId}
                      onToggle={() => setExpandedUser(expandedUser === row.userId ? null : row.userId)}
                      onCorrected={() => previewMutation.mutate()}
                    />
                  ))}
                </div>
              )}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button variant="secondary" onClick={() => setStep("warn")}>Back</Button>
              <Button onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending || periodLocked} title={periodLocked ? "This month's run is approved and locked" : undefined} data-testid="button-confirm-regenerate">
                {confirmMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : <><RefreshCw className="h-4 w-4 mr-2" />Confirm & Save</>}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "done" && (
          <>
            <div className="space-y-4 py-4 text-center">
              <div className="flex justify-center"><div className="p-4 rounded-full bg-green-100 dark:bg-green-900/20"><RefreshCw className="h-8 w-8 text-green-600 dark:text-green-400" /></div></div>
              <div>
                <p className="text-lg font-semibold">{savedCount} Salary Slips Regenerated</p>
                <p className="text-sm text-muted-foreground mt-1">All slips for {monthLabel} {year} have been recalculated.</p>
              </div>
            </div>
            <DialogFooter><Button onClick={onClose}>Done</Button></DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReportRecipientsCard() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [toEmails, setToEmails] = useState<string[]>([]);
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [newTo, setNewTo] = useState("");
  const [newCc, setNewCc] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const { data: recipients } = useQuery<{ to: string[]; cc: string[] }>({ queryKey: ["/api/hr/reports/salary/recipients"] });

  useEffect(() => {
    if (recipients && !loaded) {
      setToEmails(recipients.to || []);
      setCcEmails(recipients.cc || []);
      setLoaded(true);
    }
  }, [recipients, loaded]);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const addEmail = (type: "to" | "cc") => {
    const value = type === "to" ? newTo.trim() : newCc.trim();
    if (!value) return;
    if (!emailRegex.test(value)) { toast({ title: "Invalid email format", variant: "destructive" }); return; }
    if (type === "to") { if (toEmails.includes(value)) return; setToEmails(prev => [...prev, value]); setNewTo(""); }
    else { if (ccEmails.includes(value)) return; setCcEmails(prev => [...prev, value]); setNewCc(""); }
  };

  const removeEmail = (type: "to" | "cc", email: string) => {
    if (type === "to") setToEmails(prev => prev.filter(e => e !== email));
    else setCcEmails(prev => prev.filter(e => e !== email));
  };

  const handleSave = async () => {
    if (toEmails.length === 0) { toast({ title: "At least one 'To' recipient is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await apiRequest("PUT", "/api/hr/reports/salary/recipients", { to: toEmails, cc: ccEmails });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      queryClient.invalidateQueries({ queryKey: ["/api/hr/reports/salary/recipients"] });
      toast({ title: "Report recipients updated" });
    } catch (err: any) {
      toast({ title: err.message || "Failed to save", variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Card>
      <CardHeader className="cursor-pointer select-none" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Report Recipients
            {!expanded && recipients && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                To: {recipients.to.join(", ")}{recipients.cc.length > 0 ? ` | CC: ${recipients.cc.join(", ")}` : ""}
              </span>
            )}
          </CardTitle>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium">To (Primary Recipients)</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {toEmails.map(email => (
                <Badge key={email} variant="secondary" className="gap-1 pr-1" data-testid={`badge-to-${email}`}>
                  {email}
                  <button onClick={() => removeEmail("to", email)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input data-testid="input-add-to" type="email" placeholder="Add To recipient..." value={newTo} onChange={e => setNewTo(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addEmail("to"))} className="flex-1" />
              <Button variant="outline" size="sm" onClick={() => addEmail("to")} data-testid="button-add-to"><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">CC (Copy Recipients)</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {ccEmails.map(email => (
                <Badge key={email} variant="outline" className="gap-1 pr-1" data-testid={`badge-cc-${email}`}>
                  {email}
                  <button onClick={() => removeEmail("cc", email)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
                </Badge>
              ))}
              {ccEmails.length === 0 && <span className="text-sm text-muted-foreground">No CC recipients</span>}
            </div>
            <div className="flex gap-2 mt-2">
              <Input data-testid="input-add-cc" type="email" placeholder="Add CC recipient..." value={newCc} onChange={e => setNewCc(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addEmail("cc"))} className="flex-1" />
              <Button variant="outline" size="sm" onClick={() => addEmail("cc")} data-testid="button-add-cc"><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving || toEmails.length === 0} data-testid="button-save-recipients">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Recipients
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// Inline edit panel for a single row
function RowEditPanel({
  row,
  onSave,
  onCancel,
  saving,
}: {
  row: EmployeeReportRow;
  onSave: (fields: Record<string, number>, comment: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [presentDays, setPresentDays] = useState(String(row.presentDays));
  const [lopLeaves, setLopLeaves] = useState(String(row.lopLeaves));
  const [paidLeaves, setPaidLeaves] = useState(String(row.paidLeaves));
  const [grossSalary, setGrossSalary] = useState(String(row.grossSalary));
  // deductionsAuto=true means deductions are derived from attendance formula (default)
  // deductionsAuto=false means user has manually overridden the deductions field
  const [deductions, setDeductions] = useState(String(row.deductions));
  const [deductionsAuto, setDeductionsAuto] = useState(true);
  const [comment, setComment] = useState("");

  const fmt = (v: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

  const wDays = row.workingDays || 1;
  const regionalHolidayDays = (row as any).regionalHolidayDays ?? 0;

  const parsedPresent = parseFloat(presentDays) || 0;
  const parsedPaid = parseFloat(paidLeaves) || 0;
  const gross = parseFloat(grossSalary) || 0;

  // Mirror server-side formula exactly: effectivePresentDays + paidLeaves + regionalHolidayDays
  const effectivePresentDays = parsedPresent + parsedPaid + regionalHolidayDays;
  const derivedAbsentDays = Math.max(0, wDays - effectivePresentDays);
  const derivedDeductions = Math.round(derivedAbsentDays * (gross / wDays) * 100) / 100;
  const derivedAttendancePct = wDays > 0 ? Math.round((effectivePresentDays / wDays) * 100) : 0;

  // When attendance fields or gross change, auto-refresh deductions display
  useEffect(() => {
    if (deductionsAuto) {
      setDeductions(String(derivedDeductions));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentDays, paidLeaves, grossSalary, deductionsAuto]);

  const handleAttendanceChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    setDeductionsAuto(true); // attendance edit → go back to auto-derived deductions
  };

  const handleDeductionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDeductions(e.target.value);
    setDeductionsAuto(false); // user typing in deductions field → manual override
  };

  const effectiveDeductions = deductionsAuto ? derivedDeductions : (parseFloat(deductions) || 0);
  const liveAdvanceRecovery = Number(row.advanceRecovery) || 0;
  const liveNet = Math.max(0, Math.round((gross - effectiveDeductions - liveAdvanceRecovery) * 100) / 100);
  const liveAbsentDays = deductionsAuto ? derivedAbsentDays : Math.max(0, wDays - effectivePresentDays);
  const liveAttendancePct = deductionsAuto ? derivedAttendancePct : (wDays > 0 ? Math.round((effectivePresentDays / wDays) * 100) : 0);

  const handleSave = () => {
    if (!comment.trim()) return;
    const fields: Record<string, number> = {};
    if (parseFloat(presentDays) !== row.presentDays) fields.presentDays = parseFloat(presentDays) || 0;
    if (parseFloat(lopLeaves) !== row.lopLeaves) fields.lopLeaves = parseFloat(lopLeaves) || 0;
    if (parseFloat(paidLeaves) !== row.paidLeaves) fields.paidLeaves = parseFloat(paidLeaves) || 0;
    if (gross !== row.grossSalary) fields.grossSalary = gross;
    if (effectiveDeductions !== row.deductions) fields.deductions = effectiveDeductions;
    if (liveNet !== row.netPayable) fields.netPayable = liveNet;
    if (liveAbsentDays !== row.absentDays) fields.absentDays = liveAbsentDays;
    if (liveAttendancePct !== row.attendancePercentage) fields.attendancePercentage = liveAttendancePct;
    onSave(fields, comment.trim());
  };

  return (
    <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-4">
      <div className="font-medium text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
        <Pencil className="h-4 w-4" />
        Editing: {row.employeeName}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Present Days</Label>
          <Input type="number" min={0} value={presentDays} onChange={handleAttendanceChange(setPresentDays)} className="mt-1 h-8 text-sm" data-testid="input-edit-present-days" />
        </div>
        <div>
          <Label className="text-xs">LOP Leaves</Label>
          <Input type="number" min={0} step={0.5} value={lopLeaves} onChange={handleAttendanceChange(setLopLeaves)} className="mt-1 h-8 text-sm" data-testid="input-edit-lop-leaves" />
        </div>
        <div>
          <Label className="text-xs">Paid Leaves</Label>
          <Input type="number" min={0} step={0.5} value={paidLeaves} onChange={handleAttendanceChange(setPaidLeaves)} className="mt-1 h-8 text-sm" data-testid="input-edit-paid-leaves" />
        </div>
        <div>
          <Label className="text-xs">Gross Salary (₹)</Label>
          <Input type="number" min={0} value={grossSalary} onChange={handleAttendanceChange(setGrossSalary)} className="mt-1 h-8 text-sm" data-testid="input-edit-gross-salary" />
        </div>
        <div>
          <Label className="text-xs flex items-center gap-1">
            Deductions (₹)
            {deductionsAuto && <span className="text-[10px] font-normal text-blue-500">(auto)</span>}
          </Label>
          <Input
            type="number"
            min={0}
            value={deductionsAuto ? String(derivedDeductions) : deductions}
            onChange={handleDeductionsChange}
            className="mt-1 h-8 text-sm"
            data-testid="input-edit-deductions"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Advance Recovery (₹)</Label>
          <div className="mt-1 h-8 flex items-center px-3 rounded-md border bg-muted/50 text-sm font-medium text-purple-600 dark:text-purple-400" data-testid="text-live-advance-recovery">
            {fmt(liveAdvanceRecovery)}
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Net Payable (auto)</Label>
          <div className="mt-1 h-8 flex items-center px-3 rounded-md border bg-muted/50 text-sm font-medium text-blue-700 dark:text-blue-400" data-testid="text-live-net-payable">
            {fmt(liveNet)}
          </div>
        </div>
      </div>
      {deductionsAuto && (parseFloat(presentDays) !== row.presentDays || parseFloat(paidLeaves) !== row.paidLeaves) && (
        <p className="text-[11px] text-blue-600 dark:text-blue-400">
          Deductions &amp; net pay auto-recalculated from attendance ({liveAbsentDays} absent day{liveAbsentDays !== 1 ? "s" : ""}, {liveAttendancePct}% attendance).
        </p>
      )}
      <div>
        <Label className="text-xs">Reason for Adjustment <span className="text-destructive">*</span></Label>
        <Textarea
          placeholder="Required: explain the reason for this adjustment..."
          value={comment}
          onChange={e => setComment(e.target.value)}
          className="mt-1 text-sm min-h-[60px]"
          data-testid="input-edit-comment"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} data-testid="button-edit-cancel">Cancel</Button>
        <Button size="sm" onClick={handleSave} disabled={saving || !comment.trim()} data-testid="button-edit-save">
          {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
          Save Adjustment
        </Button>
      </div>
    </div>
  );
}

// Small recipients preview used inside the confirm approval dialog
function RecipientsPreviewInline() {
  const { data: recipients } = useQuery<{ to: string[]; cc: string[] }>({ queryKey: ["/api/hr/reports/salary/recipients"] });
  const toList = recipients?.to?.length ? recipients.to : ["accounts@hire-in.com"];
  const ccList = recipients?.cc?.length ? recipients.cc : ["simranjeet@hire-in.com"];
  const hasConfigured = recipients?.to?.length;
  return (
    <div className={`p-3 rounded-lg border text-xs space-y-1 ${hasConfigured ? "bg-muted/40" : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"}`} data-testid="recipients-preview-inline">
      {!hasConfigured && (
        <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-medium mb-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          No recipients configured — defaults will be used
        </div>
      )}
      <div><span className="text-muted-foreground">To: </span><span className="font-medium">{toList.join(", ")}</span></div>
      {ccList.length > 0 && <div><span className="text-muted-foreground">CC: </span><span className="font-medium">{ccList.join(", ")}</span></div>}
    </div>
  );
}

// ── Inline advance / adjustment manager for one employee on a pending run ──────
// Lists this month's scheduled advance/overpayment recoveries (source of truth)
// and lets super_admin/admin/hr edit an installment amount, remove (defer) one, or
// add a new advance/overpayment/salary credit — all via the existing advance
// endpoints. After any change the parent refreshes the run preview from source.
interface AdvanceRepayment {
  id: string;
  advanceId: string;
  year: number;
  month: number;
  scheduledAmount: string;
  status: string;
  installmentNo: number;
}
interface EmployeeAdvance {
  id: string;
  kind: "advance" | "overpayment" | "salary_credit";
  status: string;
  outstandingBalance: string | null;
  approvedAmount: string | null;
  requestedAmount: string;
  repayments?: AdvanceRepayment[];
}

function AdvanceManagerPanel({
  userId,
  employeeName,
  year,
  month,
  onChanged,
  onClose,
}: {
  userId: string;
  employeeName: string;
  year: number;
  month: number;
  onChanged: () => Promise<void>;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { data: advances, isLoading, refetch } = useQuery<EmployeeAdvance[]>({
    queryKey: ["/api/salary-advances/employee", userId],
    queryFn: async () => {
      const res = await fetch(`/api/salary-advances/employee/${userId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load advances");
      return res.json();
    },
  });

  const [editing, setEditing] = useState<{ advanceId: string; amount: string; reason: string } | null>(null);
  const [removing, setRemoving] = useState<{ advanceId: string; reason: string } | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const inr = (v: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

  const afterMutate = async () => {
    await refetch();
    await onChanged();
  };

  const editMut = useMutation({
    mutationFn: ({ advanceId, newAmount, reason }: { advanceId: string; newAmount: number; reason: string }) =>
      apiRequest("PATCH", `/api/salary-advances/${advanceId}/installment`, { year, month, newAmount, reason }),
    onSuccess: async () => {
      toast({ title: "Recovery amount updated", description: "Outstanding balance preserved. Run refreshed." });
      setEditing(null);
      await afterMutate();
    },
    onError: (err: any) => toast({ title: "Failed to update", description: err.message, variant: "destructive" }),
  });

  const removeMut = useMutation({
    mutationFn: ({ advanceId, reason }: { advanceId: string; reason: string }) =>
      apiRequest("POST", `/api/salary-advances/${advanceId}/installment/remove`, { year, month, reason }),
    onSuccess: async () => {
      toast({ title: "Recovery removed for this month", description: "Deferred to a later month. Run refreshed." });
      setRemoving(null);
      await afterMutate();
    },
    onError: (err: any) => toast({ title: "Failed to remove", description: err.message, variant: "destructive" }),
  });

  const addMut = useMutation({
    mutationFn: (body: any) => apiRequest("POST", `/api/salary-advances/backfill`, body),
    onSuccess: async (res) => {
      const data = await res.json().catch(() => ({}));
      toast({
        title: "Record created",
        description: data?.startMonthWarning
          ? "Created — chosen recovery month is locked; refreshed anyway."
          : "Advance/adjustment recorded. Run refreshed.",
      });
      setShowAdd(false);
      await afterMutate();
    },
    onError: (err: any) => toast({ title: "Failed to record", description: err.message, variant: "destructive" }),
  });

  const monthRecoveries = (advances || []).flatMap((a) =>
    (a.repayments || [])
      .filter((r) => r.year === year && r.month === month && r.status === "scheduled")
      .filter(() => ["advance", "overpayment"].includes(a.kind) && ["disbursed", "repaying"].includes(a.status))
      .map((r) => ({ advance: a, rep: r })),
  );

  const busy = editMut.isPending || removeMut.isPending || addMut.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl" data-testid="dialog-advance-manager">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-purple-600" />
            Advances &amp; Adjustments — {employeeName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Recoveries scheduled for <strong>{monthName(month)} {year}</strong>. Edits write to the advance
            schedule (outstanding balance preserved) and refresh the run automatically.
          </p>

          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : monthRecoveries.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground" data-testid="text-no-recoveries">
              No scheduled recoveries for this month.
            </div>
          ) : (
            <div className="space-y-2">
              {monthRecoveries.map(({ advance, rep }) => {
                const isEditing = editing?.advanceId === advance.id;
                const isRemoving = removing?.advanceId === advance.id;
                return (
                  <div key={rep.id} className="rounded-lg border p-3" data-testid={`recovery-${advance.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] capitalize">{advance.kind}</Badge>
                        </div>
                        <p className="text-sm mt-1">
                          This month: <span className="font-semibold">{inr(Number(rep.scheduledAmount))}</span>
                          <span className="text-xs text-muted-foreground"> · outstanding {inr(Number(advance.outstandingBalance || 0))}</span>
                        </p>
                      </div>
                      {!isEditing && !isRemoving && (
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="sm" onClick={() => setEditing({ advanceId: advance.id, amount: String(Number(rep.scheduledAmount)), reason: "" })} data-testid={`btn-edit-recovery-${advance.id}`}>
                            <Pencil className="h-3 w-3 mr-1" />Edit
                          </Button>
                          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setRemoving({ advanceId: advance.id, reason: "" })} data-testid={`btn-remove-recovery-${advance.id}`}>
                            <XCircle className="h-3 w-3 mr-1" />Remove
                          </Button>
                        </div>
                      )}
                    </div>

                    {isEditing && (
                      <div className="mt-3 space-y-2 border-t pt-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">New amount for {monthName(month)}</Label>
                            <Input type="number" min={0} value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} data-testid={`input-recovery-amount-${advance.id}`} />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Reason <span className="text-destructive">*</span></Label>
                          <Textarea value={editing.reason} onChange={(e) => setEditing({ ...editing, reason: e.target.value })} className="min-h-[52px] text-sm" placeholder="Why is this month's recovery changing?" data-testid={`input-recovery-reason-${advance.id}`} />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                          <Button size="sm" disabled={busy || !editing.reason.trim() || editing.amount === ""} onClick={() => editMut.mutate({ advanceId: advance.id, newAmount: Number(editing.amount), reason: editing.reason.trim() })} data-testid={`btn-save-recovery-${advance.id}`}>
                            {editMut.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}Save
                          </Button>
                        </div>
                      </div>
                    )}

                    {isRemoving && (
                      <div className="mt-3 space-y-2 border-t pt-3">
                        <p className="text-xs text-muted-foreground">This defers <strong>{inr(Number(rep.scheduledAmount))}</strong> to a later month so it won't be recovered this run. Outstanding balance is unchanged.</p>
                        <div>
                          <Label className="text-xs">Reason <span className="text-destructive">*</span></Label>
                          <Textarea value={removing.reason} onChange={(e) => setRemoving({ ...removing, reason: e.target.value })} className="min-h-[52px] text-sm" placeholder="Why skip this month's recovery?" data-testid={`input-remove-reason-${advance.id}`} />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setRemoving(null)}>Cancel</Button>
                          <Button size="sm" variant="destructive" disabled={busy || !removing.reason.trim()} onClick={() => removeMut.mutate({ advanceId: advance.id, reason: removing.reason.trim() })} data-testid={`btn-confirm-remove-${advance.id}`}>
                            {removeMut.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <XCircle className="h-3 w-3 mr-1" />}Remove
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!showAdd ? (
            <Button variant="outline" size="sm" onClick={() => setShowAdd(true)} data-testid="btn-add-advance">
              <Plus className="h-3.5 w-3.5 mr-1" />Add advance / overpayment / credit
            </Button>
          ) : (
            <AddAdvanceForm
              userId={userId}
              year={year}
              month={month}
              pending={addMut.isPending}
              onCancel={() => setShowAdd(false)}
              onSubmit={(body) => addMut.mutate(body)}
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="btn-close-advance-manager">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Compact backfill form (kind picker) reused inside the run's advance manager.
function AddAdvanceForm({
  userId,
  year,
  month,
  pending,
  onCancel,
  onSubmit,
}: {
  userId: string;
  year: number;
  month: number;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (body: any) => void;
}) {
  const [kind, setKind] = useState<"advance" | "overpayment" | "salary_credit">("advance");
  const [amount, setAmount] = useState("");
  const [months, setMonths] = useState("1");
  const [startMonth, setStartMonth] = useState(String(month));
  const [startYear, setStartYear] = useState(String(year));
  const [reason, setReason] = useState("");

  const amt = Number(amount) || 0;
  const canSubmit = amt > 0 && (kind === "salary_credit" || (Number(startMonth) >= 1 && Number(startYear) >= 2000));

  const submit = () => {
    const body: any = { employeeId: userId, kind, amount: amt, reason: reason.trim() || undefined };
    if (kind === "advance" || kind === "overpayment") {
      body.repaymentMonths = Number(months) || 1;
      body.startMonth = Number(startMonth);
      body.startYear = Number(startYear);
    }
    if (kind === "salary_credit") {
      body.targetMonth = month;
      body.targetYear = year;
    }
    onSubmit(body);
  };

  return (
    <div className="rounded-lg border p-3 space-y-3" data-testid="form-add-advance">
      <div className="space-y-1">
        <Label className="text-xs">Type</Label>
        <Select value={kind} onValueChange={(v) => setKind(v as any)}>
          <SelectTrigger className="h-8 text-sm" data-testid="select-add-kind"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="advance">Advance</SelectItem>
            <SelectItem value="overpayment">Overpayment</SelectItem>
            <SelectItem value="salary_credit">Salary Credit</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          {kind === "advance"
            ? "Created active immediately; recovers over the chosen months."
            : kind === "overpayment"
              ? "Recovers in installments — needs super-admin approval before payroll deducts it."
              : "One-time credit for a payroll month — needs super-admin approval before payroll applies it."}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Amount (₹)</Label>
          <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="input-add-amount" />
        </div>
        {(kind === "advance" || kind === "overpayment") && (
          <div>
            <Label className="text-xs">{kind === "advance" ? "Repayment" : "Recovery"} months</Label>
            <Input type="number" min={1} max={36} value={months} onChange={(e) => setMonths(e.target.value)} data-testid="input-add-months" />
          </div>
        )}
      </div>
      {(kind === "advance" || kind === "overpayment") && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">First recovery month</Label>
            <Select value={startMonth} onValueChange={setStartMonth}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-add-start-month"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Year</Label>
            <Input type="number" min={2000} max={2100} value={startYear} onChange={(e) => setStartYear(e.target.value)} data-testid="input-add-start-year" />
          </div>
        </div>
      )}
      <div>
        <Label className="text-xs">Reason / note</Label>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-[44px] text-sm" data-testid="input-add-reason" />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" disabled={pending || !canSubmit} onClick={submit} data-testid="btn-submit-add-advance">
          {pending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
          {kind === "advance" ? "Record Advance" : kind === "salary_credit" ? "Submit Credit" : "Submit Overpayment"}
        </Button>
      </div>
    </div>
  );
}

// Approval table for a pending run
function ApprovalTable({
  run,
  onApproved,
}: {
  run: SalaryRun;
  onApproved: () => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const role = (user as any)?.role || "";
  const canManageAdvances = SALARY_EDIT_ROLES.includes(role) && run.status === "pending_approval";
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [advanceEmail, setAdvanceEmail] = useState<string | null>(null);
  const [confirmApprove, setConfirmApprove] = useState(false);

  const { data: allUsers } = useQuery<any[]>({
    queryKey: ["/api/hr/admin/users"],
    enabled: canManageAdvances,
  });
  const userIdByEmail = new Map<string, string>((allUsers || []).map((u: any) => [u.email, u.id]));

  const { data: snapshotGap } = useQuery<{ count: number }>({
    queryKey: ["/api/salary-advances/snapshot-gap", run.year, run.month],
    queryFn: async () => {
      const res = await fetch(`/api/salary-advances/snapshot-gap?year=${run.year}&month=${run.month}`, { credentials: "include" });
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    staleTime: 30_000,
  });

  const { data: fullRun, isLoading, refetch } = useQuery<SalaryRun>({
    queryKey: ["/api/hr/reports/salary/runs", run.id],
    queryFn: async () => {
      const res = await fetch(`/api/hr/reports/salary/runs/${run.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load run");
      return res.json();
    },
  });

  const adjustMutation = useMutation({
    mutationFn: ({ fields, comment }: { fields: Record<string, number>; comment: string }) =>
      apiRequest("PATCH", `/api/hr/reports/salary/runs/${run.id}/adjust`, {
        email: editingEmail,
        fields,
        comment,
      }),
    onSuccess: async () => {
      toast({ title: "Adjustment saved" });
      setEditingEmail(null);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/hr/reports/salary/runs"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save adjustment", description: err.message, variant: "destructive" });
    },
  });

  const removeAdjMutation = useMutation({
    mutationFn: (email: string) =>
      apiRequest("DELETE", `/api/hr/reports/salary/runs/${run.id}/adjust/${encodeURIComponent(email)}`),
    onSuccess: async (res) => {
      const data = await res.json().catch(() => ({}));
      toast({ title: "Adjustment removed", description: data.restoredRow ? "Row values restored to original." : undefined });
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/hr/reports/salary/runs"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to remove adjustment", description: err.message, variant: "destructive" });
    },
  });

  const refreshRunFromSource = async () => {
    try {
      await apiRequest("POST", `/api/hr/reports/salary/runs/${run.id}/refresh`, {});
    } catch (err: any) {
      toast({ title: "Preview refresh failed", description: err.message, variant: "destructive" });
    }
    await refetch();
    queryClient.invalidateQueries({ queryKey: ["/api/hr/reports/salary/runs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/salary-advances/snapshot-gap", run.year, run.month] });
  };

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/hr/reports/salary/runs/${run.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(body.message || body.error || "Approval failed") as any;
        err.status = res.status;
        err.data = body;
        throw err;
      }
      return body;
    },
    onSuccess: async () => {
      toast({ title: "Report approved & sent", description: "The salary report has been dispatched to recipients. Salary slips are now available on demand." });
      setConfirmApprove(false);
      queryClient.invalidateQueries({ queryKey: ["/api/hr/reports/salary/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/reports/salary/runs/pending-count"] });
      onApproved();
    },
    onError: (err: any) => {
      const data = err.data || {};
      if (err.status === 400 && data.attendanceStatus != null) {
        toast({
          title: "Attendance approval required",
          description: data.message || "The attendance report for this period must be approved before the salary run can be approved.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Approval failed", description: err.message, variant: "destructive" });
      }
      setConfirmApprove(false);
    },
  });

  const rows = fullRun?.reportData || run.reportData || [];
  const adjustments = fullRun?.adjustments || run.adjustments || {};
  const adjustedCount = Object.keys(adjustments).filter(k => k !== "_overrides").length;
  const runOverrides = adjustments._overrides;

  const fmt = (v: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
  const totalPayable = rows.reduce((s, r) => s + Number(r.netPayable), 0);
  const totalDeductions = rows.reduce((s, r) => s + Number(r.deductions), 0);
  const totalAdvanceRecovery = rows.reduce((s, r) => s + Number(r.advanceRecovery || 0), 0);

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Override warning banner */}
      {runOverrides && (runOverrides.attendanceApprovalOverride || runOverrides.pendingRegularizationsOverride) && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800" data-testid="banner-run-override-warning">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-800 dark:text-amber-200">Gate Override(s) Applied</p>
            <ul className="mt-1 space-y-1">
              {runOverrides.attendanceApprovalOverride && (
                <li className="text-amber-700 dark:text-amber-300 text-xs">
                  <span className="font-medium">Attendance approval gate bypassed</span> — {runOverrides.attendanceApprovalOverride.reason}
                </li>
              )}
              {runOverrides.pendingRegularizationsOverride && (
                <li className="text-amber-700 dark:text-amber-300 text-xs">
                  <span className="font-medium">Pending regularizations gate bypassed</span>
                  {runOverrides.pendingRegularizationsOverride.count != null && ` (${runOverrides.pendingRegularizationsOverride.count} unresolved)`}
                  {" — "}{runOverrides.pendingRegularizationsOverride.reason}
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-muted/40 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Employees</p>
          <p className="text-xl font-bold mt-0.5">{rows.length}</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Total Payable</p>
          <p className="text-xl font-bold mt-0.5 text-blue-700 dark:text-blue-400">{fmt(totalPayable)}</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Total Deductions</p>
          <p className="text-xl font-bold mt-0.5 text-red-600 dark:text-red-400">{fmt(totalDeductions)}</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-3" data-testid="card-total-advance-recovery">
          <p className="text-xs text-muted-foreground">Advance Recovery</p>
          <p className="text-xl font-bold mt-0.5 text-purple-600 dark:text-purple-400">{fmt(totalAdvanceRecovery)}</p>
        </div>
        <div className={`rounded-lg p-3 ${adjustedCount > 0 ? "bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800" : "bg-muted/40"}`}>
          <p className="text-xs text-muted-foreground">Adjusted Rows</p>
          <p className={`text-xl font-bold mt-0.5 ${adjustedCount > 0 ? "text-orange-600 dark:text-orange-400" : ""}`}>{adjustedCount}</p>
        </div>
      </div>

      {/* Data table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground whitespace-nowrap text-xs">Employee</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground whitespace-nowrap text-xs">Present</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground whitespace-nowrap text-xs">LOP</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground whitespace-nowrap text-xs">Paid Leaves</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground whitespace-nowrap text-xs">Gross</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground whitespace-nowrap text-xs">Deductions</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground whitespace-nowrap text-xs">Advance Recovery</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground whitespace-nowrap text-xs">Net Payable</th>
                <th className="text-center py-2.5 px-3 font-medium text-muted-foreground whitespace-nowrap text-xs">Edit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const isAdj = !!adjustments[row.email];
                const adj = adjustments[row.email];
                const isEditing = editingEmail === row.email;
                return (
                  <>
                    <tr
                      key={row.email}
                      className={`border-t transition-colors ${isAdj ? "bg-orange-50/60 dark:bg-orange-950/20" : "hover:bg-muted/30"}`}
                      data-testid={`run-row-${idx}`}
                    >
                      <td className="py-2 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{row.employeeName}</span>
                          {isAdj && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button className="text-orange-500 hover:text-orange-700" data-testid={`btn-adj-comment-${idx}`}>
                                        <MessageSquare className="h-3.5 w-3.5" />
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-72 text-sm" side="right">
                                      <p className="font-medium text-orange-700 dark:text-orange-400 mb-1">Adjustment note</p>
                                      <p className="text-muted-foreground">{adj.comment}</p>
                                    </PopoverContent>
                                  </Popover>
                                </TooltipTrigger>
                                <TooltipContent>Click for adjustment reason</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {isAdj && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 border-orange-300 text-orange-600 dark:text-orange-400">ADJUSTED</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{row.designation} · {row.department}</p>
                      </td>
                      <td className="py-2 px-3 text-right">{row.presentDays}</td>
                      <td className={`py-2 px-3 text-right font-medium ${row.lopLeaves > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>{row.lopLeaves}</td>
                      <td className="py-2 px-3 text-right">{row.paidLeaves}</td>
                      <td className="py-2 px-3 text-right">{fmt(row.grossSalary)}</td>
                      <td className="py-2 px-3 text-right text-red-600 dark:text-red-400">{fmt(row.deductions)}</td>
                      <td className={`py-2 px-3 text-right ${Number(row.advanceRecovery) > 0 ? "text-purple-600 dark:text-purple-400" : "text-muted-foreground"}`} data-testid={`text-advance-recovery-${idx}`}>
                        <div className="flex items-center justify-end gap-1">
                          <span>{fmt(Number(row.advanceRecovery) || 0)}</span>
                          {canManageAdvances && userIdByEmail.get(row.email) && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-purple-600 dark:text-purple-400" onClick={() => setAdvanceEmail(row.email)} data-testid={`btn-manage-advance-${idx}`}>
                                    <Layers className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Manage advances &amp; adjustments</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right font-semibold">{fmt(row.netPayable)}</td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setEditingEmail(isEditing ? null : row.email)}
                            data-testid={`btn-edit-row-${idx}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          {isAdj && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => removeAdjMutation.mutate(row.email)}
                              disabled={removeAdjMutation.isPending}
                              data-testid={`btn-remove-adj-${idx}`}
                            >
                              <XCircle className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isEditing && (
                      <tr key={`${row.email}-edit`} className="border-t">
                        <td colSpan={9} className="px-3 py-3">
                          <RowEditPanel
                            row={row}
                            saving={adjustMutation.isPending}
                            onSave={(fields, comment) => adjustMutation.mutate({ fields, comment })}
                            onCancel={() => setEditingEmail(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Snapshot-gap warning: advance recovery entries added after report was generated */}
      {snapshotGap && snapshotGap.count > 0 && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800" data-testid="banner-snapshot-gap">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-800 dark:text-amber-200">
              {snapshotGap.count} advance recovery {snapshotGap.count === 1 ? "entry was" : "entries were"} added after this report was generated.
            </p>
            <p className="text-amber-700 dark:text-amber-300 text-xs mt-0.5">
              Regenerate the salary report to include these deductions before approving.
            </p>
          </div>
        </div>
      )}

      {/* Approve CTA */}
      <div className="flex justify-end">
        <Button
          onClick={() => setConfirmApprove(true)}
          className="bg-green-600 hover:bg-green-700 text-white"
          data-testid="button-approve-send"
        >
          <ShieldCheck className="h-4 w-4 mr-2" />
          Approve & Send Report
        </Button>
      </div>

      {/* Confirmation dialog */}
      <Dialog open={confirmApprove} onOpenChange={setConfirmApprove}>
        <DialogContent data-testid="dialog-confirm-approve">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              Confirm Approval
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm text-muted-foreground">
            <p>You are about to approve and dispatch the <strong className="text-foreground">{monthName(run.month)} {run.year}</strong> salary report.</p>
            {adjustedCount > 0 && (
              <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                <p className="text-orange-700 dark:text-orange-300"><strong>{adjustedCount} row(s)</strong> have been manually adjusted. These will appear highlighted in the email and flagged in the CSV.</p>
              </div>
            )}
            <RecipientsPreviewInline />
            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <Receipt className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-blue-700 dark:text-blue-300">Salary slips are generated <strong>on demand</strong> — no bulk PDF is created at this step. Employees can view and download their slip from the portal after approval.</p>
            </div>
            <p className="text-foreground font-medium">This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmApprove(false)}>Cancel</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              data-testid="button-confirm-approve"
            >
              {approveMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</> : <><Send className="h-4 w-4 mr-2" />Confirm & Send</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {advanceEmail && userIdByEmail.get(advanceEmail) && (
        <AdvanceManagerPanel
          userId={userIdByEmail.get(advanceEmail)!}
          employeeName={rows.find(r => r.email === advanceEmail)?.employeeName || advanceEmail}
          year={run.year}
          month={run.month}
          onChanged={refreshRunFromSource}
          onClose={() => setAdvanceEmail(null)}
        />
      )}
    </div>
  );
}

interface GateCheck {
  name: string;
  pass: boolean;
  detail: string;
}

interface GateStatus {
  checks: GateCheck[];
  allPassed: boolean;
}

interface RawGateStatus {
  year: number;
  month: number;
  attendanceRunApproved: boolean;
  attendanceRunStatus: string;
  pendingRegularizations: number;
  canGenerate: boolean;
  blockingReasons: string[];
}

function SalaryGateStatusPanel({ month, year }: { month: string; year: string }) {
  const { data: raw, isLoading } = useQuery<RawGateStatus>({
    queryKey: ["/api/hr/attendance-report/salary-gate-status", { month, year }],
    queryFn: async () => {
      const res = await fetch(`/api/hr/attendance-report/salary-gate-status?month=${month}&year=${year}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load gate status");
      return res.json();
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking pre-flight requirements…
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!raw) return null;

  const checks: Array<{ name: string; pass: boolean; detail: string }> = [
    {
      name: "Attendance Report Approved",
      pass: raw.attendanceRunApproved,
      detail: raw.attendanceRunApproved
        ? "All managers have approved the attendance report for this month."
        : `Current status: ${raw.attendanceRunStatus === "none" ? "No run created yet" : raw.attendanceRunStatus.replace(/_/g, " ")}. Go to the Attendance Approvals panel to resolve.`,
    },
    {
      name: "Pending Regularizations Cleared",
      pass: raw.pendingRegularizations === 0,
      detail: raw.pendingRegularizations === 0
        ? "No pending regularization requests for this month."
        : `${raw.pendingRegularizations} request${raw.pendingRegularizations === 1 ? "" : "s"} still awaiting review. Go to Attendance Regularizations to approve or reject them.`,
    },
  ];
  const allPassed = raw.canGenerate;

  return (
    <Card className={allPassed ? "border-green-200 dark:border-green-800" : "border-amber-200 dark:border-amber-800"} data-testid="card-salary-gate-status">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {allPassed ? (
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
          Salary Run Pre-flight Check
          {!allPassed && (
            <span className="ml-2 text-xs font-normal text-amber-700 dark:text-amber-400">
              — Resolve the items below before generating the salary run
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {checks.map((check, i) => (
            <div key={i} className="flex items-start gap-3 text-sm" data-testid={`gate-check-${i}`}>
              {check.pass ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              )}
              <div>
                <p className={`font-medium ${check.pass ? "text-foreground" : "text-amber-800 dark:text-amber-300"}`}>
                  {check.name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{check.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SlipCountChip({ runId }: { runId: string }) {
  const { data } = useQuery<{ generated: number; total: number }>({
    queryKey: ["/api/hr/salary-slips/run-count", runId],
    queryFn: async () => {
      const res = await fetch(`/api/hr/salary-slips/run-count/${runId}`, { credentials: "include" });
      if (!res.ok) return { generated: 0, total: 0 };
      return res.json();
    },
    refetchInterval: 30000,
  });
  if (!data) return null;
  const { generated, total } = data;
  return (
    <span className="text-xs text-muted-foreground flex items-center gap-1" data-testid={`slip-count-chip-${runId}`}>
      <Receipt className="h-3 w-3" />
      {generated}/{total} slips viewed
    </span>
  );
}

function GenerateSlipButton({ runId, employeeId, month, year, label }: { runId: string; employeeId: string; month: number; year: number; label: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const handle = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hr/salary-slips/render/${employeeId}/${month}/${year}`, { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({ title: "Failed", description: body.error || "Could not generate slip", variant: "destructive" });
        return;
      }
      setDone(true);
      queryClient.invalidateQueries({ queryKey: ["/api/hr/salary-slips/run-count", runId] });
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={handle} disabled={loading} data-testid={`btn-gen-slip-${employeeId}`}>
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : done ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <Receipt className="h-3 w-3" />}
      {label}
    </Button>
  );
}

function RunSlipPanel({ run }: { run: SalaryRun }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const { data: allUsers } = useQuery<any[]>({ queryKey: ["/api/hr/admin/users"], enabled: expanded });

  const rows: EmployeeReportRow[] = (run.reportData as any) || [];

  const handleGenerateAll = async () => {
    if (!allUsers) return;
    setGeneratingAll(true);
    let ok = 0;
    for (const row of rows) {
      const emp = allUsers.find((u: any) => u.email === row.email);
      if (!emp) continue;
      try {
        await fetch(`/api/hr/salary-slips/render/${emp.id}/${run.month}/${run.year}`, { credentials: "include" });
        ok++;
      } catch { /* skip */ }
    }
    setGeneratingAll(false);
    toast({ title: `${ok} slips generated`, description: "Ledger rows written for all employees in this run." });
    queryClient.invalidateQueries({ queryKey: ["/api/hr/salary-slips/run-count", run.id] });
  };

  if (!expanded) {
    return (
      <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-blue-600 dark:text-blue-400" onClick={() => setExpanded(true)} data-testid={`btn-expand-slips-${run.id}`}>
        <Layers className="h-3 w-3" />
        Slip Controls
      </Button>
    );
  }

  return (
    <div className="w-full mt-2 border rounded-lg p-3 space-y-2 bg-muted/30" data-testid={`slip-panel-${run.id}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs font-medium flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" />Slip Controls — {monthName(run.month)} {run.year}</p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={handleGenerateAll}
            disabled={generatingAll || !allUsers}
            data-testid={`btn-generate-all-slips-${run.id}`}
          >
            {generatingAll ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Receipt className="h-3 w-3 mr-1" />}
            Generate All Slips
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setExpanded(false)}>Close</Button>
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto space-y-1">
        {rows.map((row, idx) => {
          const emp = allUsers?.find((u: any) => u.email === row.email);
          return (
            <div key={idx} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
              <span className="font-medium truncate max-w-[180px]">{row.employeeName}</span>
              {emp ? (
                <GenerateSlipButton runId={run.id} employeeId={emp.id} month={run.month} year={run.year} label="Generate" />
              ) : (
                <span className="text-muted-foreground text-xs">not found</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RunHistoryList({ runs }: { runs: SalaryRun[] }) {
  const { user } = useAuth();
  const isAdminLevel = user?.role && ["super_admin", "admin", "hr", "finance"].includes(user.role);

  const statusBadge = (status: SalaryRun["status"]) => {
    if (status === "pending_approval") return <Badge variant="outline" className="border-amber-400 text-amber-600 dark:text-amber-400 text-xs"><Clock3 className="h-3 w-3 mr-1" />Pending Approval</Badge>;
    if (status === "approved") return <Badge variant="outline" className="border-green-500 text-green-600 dark:text-green-400 text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Approved & Sent</Badge>;
    return <Badge variant="secondary" className="text-xs"><Send className="h-3 w-3 mr-1" />Sent</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" />
          Report Run History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No report runs yet. The system will generate a run on the last day of each month.</p>
        ) : (
          <div className="space-y-2">
            {runs.map((run, idx) => (
              <div key={run.id} className="p-3 border rounded-lg text-sm" data-testid={`run-history-row-${idx}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">{monthName(run.month)} {run.year}</span>
                  {statusBadge(run.status)}
                  {run.adjustedCount > 0 && (
                    <span className="text-orange-600 dark:text-orange-400 text-xs font-medium">{run.adjustedCount} adjusted</span>
                  )}
                  {run.approverName && (
                    <span className="text-muted-foreground text-xs">Approved by {run.approverName}</span>
                  )}
                  {run.approvedAt && (
                    <span className="text-muted-foreground text-xs">{new Date(run.approvedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  )}
                  {run.emailSentAt && !run.approvedAt && (
                    <span className="text-muted-foreground text-xs">Sent {new Date(run.emailSentAt).toLocaleDateString()}</span>
                  )}
                  {run.status === "approved" && isAdminLevel && (
                    <>
                      <SlipCountChip runId={run.id} />
                      <RunSlipPanel run={run} />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SalaryReportsContent({ readOnly }: { readOnly?: boolean } = {}) {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { toast } = useToast();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [previewData, setPreviewData] = useState<SalaryReportResult | null>(null);
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [showApprovalTable, setShowApprovalTable] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [showAttApprovalPanel, setShowAttApprovalPanel] = useState(false);
  const [attOverrideManagerId, setAttOverrideManagerId] = useState<string | null>(null);
  const [attOverrideNote, setAttOverrideNote] = useState("");
  const [attOverrideDialogOpen, setAttOverrideDialogOpen] = useState(false);
  const [pendingRegOverrideOpen, setPendingRegOverrideOpen] = useState(false);
  const [pendingRegOverrideReason, setPendingRegOverrideReason] = useState("");
  const [pendingRegCount, setPendingRegCount] = useState(0);
  const [attApprovalOverrideOpen, setAttApprovalOverrideOpen] = useState(false);
  const [attApprovalOverrideReason, setAttApprovalOverrideReason] = useState("");
  const [attDiscardDialogOpen, setAttDiscardDialogOpen] = useState(false);
  const [attDiscardReason, setAttDiscardReason] = useState("");
  const [attSendDialogOpen, setAttSendDialogOpen] = useState(false);

  const canRegenerate = user?.role && ["super_admin", "admin", "hr"].includes(user.role);
  const isAdminLevel = user?.role && ["super_admin", "admin", "hr"].includes(user.role);

  const currentYear = now.getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  // Fetch all runs
  const { data: runs = [], refetch: refetchRuns } = useQuery<SalaryRun[]>({
    queryKey: ["/api/hr/reports/salary/runs"],
    refetchInterval: 30000,
  });

  // Pending runs for the banner
  const pendingRuns = runs.filter(r => r.status === "pending_approval");

  // Attendance approval status for the selected month/year
  const { data: attStatus, refetch: refetchAttStatus } = useQuery<any>({
    queryKey: ["/api/hr/attendance-report/status", selectedMonth, selectedYear],
    queryFn: () => fetch(`/api/hr/attendance-report/status?month=${selectedMonth}&year=${selectedYear}`, { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });

  // Salary gate status — drives Generate button pre-flight tooltip for non-overridable users
  const { data: salaryGateRaw } = useQuery<any>({
    queryKey: ["/api/hr/attendance-report/salary-gate-status", selectedMonth, selectedYear],
    queryFn: () => fetch(`/api/hr/attendance-report/salary-gate-status?month=${selectedMonth}&year=${selectedYear}`, { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });
  const salaryCanGenerate: boolean = salaryGateRaw?.canGenerate ?? true;
  const salaryPendingReg: number = salaryGateRaw?.pendingRegularizations ?? 0;

  // Pending attendance edits (for HR review)
  const { data: pendingEdits = [], refetch: refetchEdits } = useQuery<any[]>({
    queryKey: ["/api/hr/attendance-report/edits/pending"],
    enabled: showAttApprovalPanel,
  });

  const attRunMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hr/attendance-report/generate", {
      month: parseInt(selectedMonth),
      year: parseInt(selectedYear),
    }),
    onSuccess: async (res) => {
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed to generate attendance report", variant: "destructive" });
        return;
      }
      toast({ title: "Draft attendance report created", description: "Review the month below, then click \"Send for Approval\" to notify managers. Nothing has been emailed yet." });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance-report/status"] });
      refetchAttStatus();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Governed regeneration of the active attendance report (versioned, comment-required)
  const [regenDialogOpen, setRegenDialogOpen] = useState(false);
  const [regenComment, setRegenComment] = useState("");
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  const attRegenerateMutation = useMutation({
    mutationFn: (comment: string) => apiRequest("POST", "/api/hr/attendance-report/generate", {
      month: parseInt(selectedMonth),
      year: parseInt(selectedYear),
      regenerate: true,
      comment,
    }),
    onSuccess: async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.code === "PAYROLL_LOCKED" ? "Regeneration Locked" : "Error", description: data.error || "Failed to regenerate attendance report", variant: "destructive" });
        return;
      }
      toast({
        title: `Attendance report regenerated (v${data.version ?? "?"})`,
        description: data.supersededSalaryRuns > 0
          ? `${data.supersededSalaryRuns} pending salary run(s) flagged as superseded — regenerate them before approving. Review, then "Send for Approval" to notify managers.`
          : "Draft created — managers have NOT been emailed yet. Review the month, then click \"Send for Approval\".",
      });
      setRegenDialogOpen(false);
      setRegenComment("");
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance-report/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance-report/versions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance-report/salary-gate-status"] });
      refetchAttStatus();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const attDiscardMutation = useMutation({
    mutationFn: ({ runId, reason }: { runId: string; reason: string }) =>
      apiRequest("POST", `/api/hr/attendance-report/runs/${runId}/discard`, { reason }),
    onSuccess: async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Error", description: data.error || "Failed to discard attendance report", variant: "destructive" });
        return;
      }
      toast({ title: "Attendance report discarded", description: "Managers will no longer see this run, and it no longer gates the salary run." });
      setAttDiscardDialogOpen(false);
      setAttDiscardReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance-report/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance-report/versions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance-report/salary-gate-status"] });
      refetchAttStatus();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const { data: attVersions = [] } = useQuery<any[]>({
    queryKey: ["/api/hr/attendance-report/versions", selectedMonth, selectedYear],
    queryFn: () => fetch(`/api/hr/attendance-report/versions?month=${selectedMonth}&year=${selectedYear}`, { credentials: "include" }).then(r => r.json()),
    enabled: showVersionHistory && !!attStatus?.exists,
  });

  const attOverrideMutation = useMutation({
    mutationFn: ({ runId, managerId, note }: { runId: string; managerId: string | null; note: string }) =>
      apiRequest("POST", `/api/hr/attendance-report/runs/${runId}/override`, { managerId, overrideNote: note }),
    onSuccess: async () => {
      toast({ title: "Override applied" });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance-report/status"] });
      refetchAttStatus();
      setAttOverrideDialogOpen(false);
      setAttOverrideNote("");
      setAttOverrideManagerId(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const attNotifyMissedMutation = useMutation({
    mutationFn: (runId: string) =>
      apiRequest("POST", `/api/hr/attendance-report/runs/${runId}/notify-missed`, {}),
    onSuccess: async (res: any) => {
      const data = await res.json().catch(() => ({ notified: 0 }));
      toast({
        title: data.notified > 0 ? `Notified ${data.notified} manager(s)` : "All managers already notified",
        description: data.notified > 0 ? (data.managers || []).map((m: any) => m.name).join(", ") : "No missing reporting managers were found for this run.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance-report/status"] });
      refetchAttStatus();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const attResendApprovalMutation = useMutation({
    mutationFn: (runId: string) =>
      apiRequest("POST", `/api/hr/attendance-report/runs/${runId}/resend-approval`, {}),
    onSuccess: async (res: any) => {
      const data = await res.json().catch(() => ({ notified: 0 }));
      toast({
        title: data.notified > 0 ? `Resent to ${data.notified} manager(s)` : "No managers to notify",
        description: data.notified > 0 ? (data.managers || []).map((m: any) => m.name).join(", ") : "All managers have already approved or been overridden for this run.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance-report/status"] });
      refetchAttStatus();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const attSendForApprovalMutation = useMutation({
    mutationFn: (runId: string) =>
      apiRequest("POST", `/api/hr/attendance-report/runs/${runId}/send-for-approval`, {}),
    onSuccess: async (res: any) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Error", description: data.error || "Failed to send for approval", variant: "destructive" });
        return;
      }
      setAttSendDialogOpen(false);
      toast({
        title: data.notified > 0 ? `Sent to ${data.notified} manager(s)` : "Report sent",
        description: data.notified > 0
          ? `Approval requests emailed to: ${(data.managers || []).map((m: any) => m.name).join(", ")}`
          : "No managers were pending — the report is now marked as sent.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance-report/status"] });
      refetchAttStatus();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const editReviewMutation = useMutation({
    mutationFn: ({ editId, action, rejectionNote }: { editId: string; action: string; rejectionNote?: string }) =>
      apiRequest("PATCH", `/api/hr/attendance-report/edits/${editId}/review`, { action, rejectionNote }),
    onSuccess: async () => {
      toast({ title: "Edit reviewed" });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance-report/edits/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance-report/status"] });
      refetchEdits();
      refetchAttStatus();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const { refetch: fetchPreview, isLoading: previewLoading, isFetching: previewFetching } = useQuery<SalaryReportResult>({
    queryKey: ["/api/hr/reports/salary/preview", { year: selectedYear, month: selectedMonth }],
    enabled: false,
  });

  const handlePreview = async () => {
    const result = await fetchPreview();
    if (result.data) setPreviewData(result.data);
  };

  const generateRunMutation = useMutation({
    mutationFn: async (opts?: { overridePendingRegularizations?: boolean; overrideReason?: string; overrideAttendanceApproval?: boolean; overrideAttendanceReason?: string }) => {
      // Use raw fetch so we can inspect 409 payloads before deciding to throw
      const res = await fetch("/api/hr/reports/salary/runs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ year: parseInt(selectedYear), month: parseInt(selectedMonth), ...(opts || {}) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Attach structured error data to the thrown error for onError handling
        const err = new Error(body.error || "Failed to generate run") as any;
        err.status = res.status;
        err.data = body;
        throw err;
      }
      return body as SalaryRun;
    },
    onSuccess: (run: SalaryRun) => {
      toast({ title: "Report generated", description: `${monthName(run.month)} ${run.year} is ready for review.` });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/reports/salary/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/reports/salary/runs/pending-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance-report/salary-gate-status"] });
      setSelectedRunId(run.id);
      setShowApprovalTable(true);
      setPendingRegOverrideOpen(false);
      setPendingRegOverrideReason("");
    },
    onError: (err: any) => {
      const status = err.status;
      const data = err.data || {};
      // Gate 1: attendance approval incomplete — open override dialog for HR/Admin
      if (status === 409 && data.attendanceStatus != null && data.canOverride) {
        setAttApprovalOverrideOpen(true);
        return;
      }
      // Gate 2: pending regularizations — open override dialog for HR/Admin
      if (status === 409 && data.pendingRegularizations != null && data.canOverride) {
        setPendingRegCount(data.pendingRegularizations);
        setPendingRegOverrideOpen(true);
        return;
      }
      toast({ title: data.error || "Error", description: data.message || err.message, variant: "destructive" });
    },
  });

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/hr/reports/salary/download?year=${selectedYear}&month=${selectedMonth}`, { credentials: "include" });
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `salary_report_${selectedYear}_${selectedMonth.padStart(2, "0")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Error", description: "Failed to download report", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const allowedRoles = ["super_admin", "admin", "hr", "finance", "executive"];
  if (user?.role && !allowedRoles.includes(user.role)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">You do not have permission to access this page.</p>
      </div>
    );
  }

  const isLoadingPreview = previewLoading || previewFetching;
  const mLabel = MONTHS.find(m => m.value === selectedMonth)?.label || "";

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

  const selectedRun = runs.find(r => r.id === selectedRunId) || null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-salary-reports-title">Salary Reports</h1>
        <p className="text-muted-foreground">Review, adjust, and approve monthly salary processing reports before dispatch</p>
      </div>

      {/* Pending approval banner */}
      {pendingRuns.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700" data-testid="banner-pending-approval">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-800 dark:text-amber-200">
              {pendingRuns.length} report{pendingRuns.length > 1 ? "s" : ""} pending approval
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {pendingRuns.map(r => `${monthName(r.month)} ${r.year}`).join(", ")} — review and approve before dispatching to finance.
            </p>
          </div>
          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              {pendingRuns.map(r => (
                <Button
                  key={r.id}
                  size="sm"
                  variant="outline"
                  className="border-amber-400 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
                  onClick={() => { setSelectedRunId(r.id); setShowApprovalTable(true); }}
                  data-testid={`button-review-run-${r.id}`}
                >
                  Review {monthName(r.month)} {r.year}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Attendance Approval Gate Banner */}
      {isAdminLevel && attStatus && (
        <div
          className={`flex flex-wrap items-start gap-3 p-4 rounded-lg border ${
            attStatus.approved
              ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700"
              : attStatus.exists && attStatus.isDraft
              ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700"
              : attStatus.exists
              ? "bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700"
              : "bg-slate-50 dark:bg-slate-900/20 border-slate-300 dark:border-slate-700"
          }`}
          data-testid="banner-attendance-gate"
        >
          {attStatus.approved
            ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            : attStatus.exists && attStatus.isDraft
            ? <Send className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            : <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0">
            <p className={`font-semibold ${attStatus.approved ? "text-green-800 dark:text-green-200" : attStatus.exists && attStatus.isDraft ? "text-blue-800 dark:text-blue-200" : "text-amber-800 dark:text-amber-200"}`}>
              {attStatus.approved
                ? `Attendance Approved — ${mLabel} ${selectedYear} ✓`
                : attStatus.exists && attStatus.isDraft
                ? `Attendance Draft — ${mLabel} ${selectedYear} (not sent yet)`
                : attStatus.exists
                ? `Attendance Approval Pending — ${mLabel} ${selectedYear}`
                : `No Attendance Report Run — ${mLabel} ${selectedYear}`}
            </p>
            <p className={`text-sm mt-0.5 ${attStatus.approved ? "text-green-700 dark:text-green-300" : attStatus.exists && attStatus.isDraft ? "text-blue-700 dark:text-blue-300" : "text-amber-700 dark:text-amber-300"}`}>
              {attStatus.approved
                ? `Salary run generation is unlocked.${attStatus.overridden ? " (HR override applied)" : ""}`
                : attStatus.exists && attStatus.isDraft
                ? `Draft ready — confirm this is the right month, then click "Send for Approval" to email managers. Nothing has been sent yet.`
                : attStatus.exists
                ? `${(attStatus.managerApprovals || []).filter((a: any) => a.status === "pending" || a.status === "edits_submitted").length} manager(s) pending. Salary run is gated until all managers approve.`
                : "Generate an attendance report run first. Managers will have 24 hours to approve their team's data."}
            </p>
            {attStatus.exists && (
              <div className="flex flex-wrap items-center gap-2 mt-1.5" data-testid="row-att-version-meta">
                {(attStatus.version ?? 1) > 1 && (
                  <Badge variant="outline" className="text-xs" data-testid="badge-att-version">Version {attStatus.version}</Badge>
                )}
                {typeof attStatus.entryCount === "number" && (
                  <span className="text-xs text-muted-foreground" data-testid="text-att-entry-count">{attStatus.entryCount} employee(s)</span>
                )}
                {(attStatus.autoAddedTotal ?? 0) > 0 && (
                  <Badge className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" data-testid="badge-att-auto-added">
                    {attStatus.autoAddedTotal} auto-synced
                  </Badge>
                )}
                {attStatus.regenerationComment && (
                  <span className="text-xs italic text-muted-foreground truncate max-w-[240px]" title={attStatus.regenerationComment} data-testid="text-att-regen-comment">
                    “{attStatus.regenerationComment}”
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {!attStatus.exists && (
              <Button
                size="sm"
                onClick={() => attRunMutation.mutate()}
                disabled={attRunMutation.isPending}
                data-testid="button-generate-att-run"
              >
                {attRunMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Generate Attendance Run
              </Button>
            )}
            {attStatus.exists && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAttApprovalPanel(!showAttApprovalPanel)}
                data-testid="button-toggle-att-panel"
              >
                {showAttApprovalPanel ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                Manage Approvals
              </Button>
            )}
            {attStatus.exists && attStatus.isDraft && !attStatus.approved && (
              <Button
                size="sm"
                onClick={() => setAttSendDialogOpen(true)}
                disabled={attSendForApprovalMutation.isPending || !attStatus.runId}
                data-testid="button-send-for-approval"
              >
                {attSendForApprovalMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                Send for Approval
              </Button>
            )}
            {attStatus.exists && !attStatus.isDraft && !attStatus.approved && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => attStatus.runId && attNotifyMissedMutation.mutate(attStatus.runId)}
                disabled={attNotifyMissedMutation.isPending || !attStatus.runId}
                data-testid="button-notify-missed-managers"
              >
                {attNotifyMissedMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <BellRing className="h-4 w-4 mr-1" />}
                Notify Missed Managers
              </Button>
            )}
            {attStatus.exists && !attStatus.isDraft && !attStatus.approved && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => attStatus.runId && attResendApprovalMutation.mutate(attStatus.runId)}
                disabled={attResendApprovalMutation.isPending || !attStatus.runId}
                data-testid="button-resend-approval-all"
              >
                {attResendApprovalMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                Resend Approval to All Managers
              </Button>
            )}
            {attStatus.exists && !attStatus.approved && (
              <Button
                size="sm"
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50 dark:text-red-400"
                onClick={() => { setAttOverrideManagerId(null); setAttOverrideDialogOpen(true); }}
                data-testid="button-override-att-all"
              >
                <ShieldCheck className="h-4 w-4 mr-1" />
                Override All & Approve
              </Button>
            )}
            {!attStatus.approved && canRegenerate && (
              <Button
                size="sm"
                variant="outline"
                className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:text-amber-400"
                onClick={() => setAttApprovalOverrideOpen(true)}
                data-testid="button-generate-override-att"
              >
                <AlertTriangle className="h-4 w-4 mr-1" />
                Generate Anyway (Override)
              </Button>
            )}
            {attStatus.exists && canRegenerate && (
              <Button
                size="sm"
                variant="outline"
                className="border-purple-300 text-purple-700 hover:bg-purple-50 dark:text-purple-400"
                onClick={() => { setRegenComment(""); setRegenDialogOpen(true); }}
                data-testid="button-regenerate-att-run"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Regenerate Report
              </Button>
            )}
            {attStatus.exists && canRegenerate && (
              <Button
                size="sm"
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50 dark:text-red-400"
                onClick={() => { setAttDiscardReason(""); setAttDiscardDialogOpen(true); }}
                data-testid="button-discard-att-run"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Discard Run
              </Button>
            )}
            {attStatus.exists && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowVersionHistory(!showVersionHistory)}
                data-testid="button-toggle-version-history"
              >
                <History className="h-4 w-4 mr-1" />
                Version History
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Discard attendance run dialog */}
      <Dialog open={attDiscardDialogOpen} onOpenChange={setAttDiscardDialogOpen}>
        <DialogContent data-testid="dialog-discard-att-run">
          <DialogHeader>
            <DialogTitle>Discard Attendance Report — {mLabel} {selectedYear}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This voids the current attendance report run. It will be marked cancelled (not approved),
              removed from managers' approval view, and will no longer gate the salary run. This cannot be undone —
              you would need to generate a fresh run for this month.
            </p>
            <div>
              <Label className="text-xs">Reason (required)</Label>
              <Textarea
                className="mt-1 text-sm"
                placeholder="e.g. Generated by mistake for an in-progress month."
                value={attDiscardReason}
                onChange={e => setAttDiscardReason(e.target.value)}
                data-testid="textarea-discard-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttDiscardDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={attDiscardMutation.isPending || !attDiscardReason.trim() || !attStatus?.runId}
              onClick={() => attStatus?.runId && attDiscardMutation.mutate({ runId: attStatus.runId, reason: attDiscardReason.trim() })}
              data-testid="button-confirm-discard"
            >
              {attDiscardMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Discard Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send-for-approval confirmation dialog */}
      <Dialog open={attSendDialogOpen} onOpenChange={setAttSendDialogOpen}>
        <DialogContent data-testid="dialog-send-att-approval">
          <DialogHeader>
            <DialogTitle>Send for Approval — {mLabel} {selectedYear}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Please confirm you are sending the <strong>correct month</strong>. This will email the reporting
              managers and start their 24-hour approval window. Managers review the per-person details on their own screen.
            </p>
            <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Month</span><span className="font-medium" data-testid="text-send-month">{mLabel} {selectedYear}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Employees in report</span><span className="font-medium" data-testid="text-send-entry-count">{attStatus?.entryCount ?? 0}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Managers to notify</span><span className="font-medium" data-testid="text-send-manager-count">{(attStatus?.managerApprovals || []).filter((a: any) => a.status !== "approved" && a.status !== "overridden").length}</span></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttSendDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={attSendForApprovalMutation.isPending || !attStatus?.runId}
              onClick={() => attStatus?.runId && attSendForApprovalMutation.mutate(attStatus.runId)}
              data-testid="button-confirm-send-approval"
            >
              {attSendForApprovalMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send for Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version history panel */}
      {showVersionHistory && attStatus?.exists && (
        <Card className="border-2 border-purple-200 dark:border-purple-800" data-testid="panel-version-history">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" />
                Attendance Report Versions — {mLabel} {selectedYear}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowVersionHistory(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {attVersions.length === 0 && (
              <p className="text-sm text-muted-foreground">No version history available.</p>
            )}
            {attVersions.map((v: any) => (
              <div key={v.id} className="flex items-start justify-between gap-3 p-3 border rounded-lg" data-testid={`row-version-${v.version}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Version {v.version}</span>
                    {v.is_active && <Badge className="bg-green-100 text-green-700 text-xs">Active</Badge>}
                    <Badge variant="outline" className="text-xs">{String(v.status).replace(/_/g, " ")}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {v.entry_count} employee(s){v.auto_added_total > 0 ? ` · ${v.auto_added_total} auto-synced` : ""}
                    {v.actor_name ? ` · by ${v.actor_name}` : ""}
                    {v.created_at ? ` · ${new Date(v.created_at).toLocaleString()}` : ""}
                  </p>
                  {v.regeneration_comment && (
                    <p className="text-xs italic text-muted-foreground mt-0.5">“{v.regeneration_comment}”</p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Regenerate attendance report dialog */}
      <Dialog open={regenDialogOpen} onOpenChange={(o) => { if (!o) { setRegenDialogOpen(false); setRegenComment(""); } }}>
        <DialogContent data-testid="dialog-regenerate-att">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-purple-600" />
              Regenerate Attendance Report — {mLabel} {selectedYear}
            </DialogTitle>
            <DialogDescription>
              This creates a new version (v{(attStatus?.version ?? 1) + 1}) from the latest attendance data and re-requests manager approvals. The current version is retained as history. A reason is required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="regen-comment">Reason for regeneration <span className="text-red-500">*</span></Label>
            <Textarea
              id="regen-comment"
              value={regenComment}
              onChange={(e) => setRegenComment(e.target.value)}
              placeholder="e.g. New joiners added mid-month; corrected shift assignments"
              rows={3}
              data-testid="input-regen-comment"
            />
            {attStatus?.approved && (
              <p className="text-xs text-amber-600">This month's attendance is already approved. Regenerating will reset approvals to pending. It is blocked if the salary run is already approved.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRegenDialogOpen(false); setRegenComment(""); }} data-testid="button-cancel-regen">Cancel</Button>
            <Button
              onClick={() => attRegenerateMutation.mutate(regenComment.trim())}
              disabled={!regenComment.trim() || attRegenerateMutation.isPending}
              data-testid="button-confirm-regen"
            >
              {attRegenerateMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Regenerating…</> : "Regenerate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attendance HR Approval Panel */}
      {showAttApprovalPanel && attStatus?.exists && (
        <Card className="border-2 border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Attendance Approval Status — {mLabel} {selectedYear}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowAttApprovalPanel(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Per-manager status */}
            <div className="space-y-2">
              {(attStatus.managerApprovals || []).map((mgr: any) => (
                <div key={mgr.manager_id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`row-manager-approval-${mgr.manager_id}`}>
                  <div>
                    <p className="text-sm font-medium">{mgr.first_name} {mgr.last_name}</p>
                    <p className="text-xs text-muted-foreground">{mgr.status}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {mgr.status === "approved" && <Badge className="bg-green-100 text-green-700">Approved</Badge>}
                    {mgr.status === "edits_submitted" && <Badge className="bg-orange-100 text-orange-700">Edits Submitted</Badge>}
                    {mgr.status === "overridden" && <Badge className="bg-blue-100 text-blue-700">Overridden</Badge>}
                    {mgr.status === "pending" && <Badge variant="secondary">Pending</Badge>}
                    {(mgr.status === "pending" || mgr.status === "edits_submitted") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => { setAttOverrideManagerId(mgr.manager_id); setAttOverrideDialogOpen(true); }}
                        data-testid={`button-override-manager-${mgr.manager_id}`}
                      >
                        Override
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {(attStatus.managerApprovals || []).length === 0 && (
                <p className="text-sm text-muted-foreground">No managers to approve for this period.</p>
              )}
            </div>

            {/* Full per-team rollup with drill-down into each manager's numbers */}
            <AttendanceOversight month={parseInt(selectedMonth)} year={parseInt(selectedYear)} variant="hr" />

            {/* Pending edits review */}
            {pendingEdits.filter((e: any) => String(e.month) === selectedMonth && String(e.year) === selectedYear).length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Pending Correction Reviews
                </p>
                <div className="space-y-2">
                  {pendingEdits
                    .filter((e: any) => String(e.month) === selectedMonth && String(e.year) === selectedYear)
                    .map((edit: any) => (
                      <div key={edit.id} className="border rounded-lg p-3 text-sm" data-testid={`card-edit-${edit.id}`}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">{edit.emp_first_name} {edit.emp_last_name} <span className="text-muted-foreground text-xs">({edit.emp_employee_id})</span></p>
                            <p className="text-xs text-muted-foreground">By {edit.mgr_first_name} {edit.mgr_last_name}</p>
                            <p className="text-xs mt-1">
                              <span className="font-medium">{edit.field}</span>: {Number(edit.original_value).toFixed(1)} → {Number(edit.proposed_value).toFixed(1)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 italic">{edit.reason}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-green-600 hover:bg-green-700"
                              onClick={() => editReviewMutation.mutate({ editId: edit.id, action: "approve" })}
                              disabled={editReviewMutation.isPending}
                              data-testid={`button-approve-edit-${edit.id}`}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-red-300 text-red-700"
                              onClick={() => editReviewMutation.mutate({ editId: edit.id, action: "reject", rejectionNote: "HR rejected" })}
                              disabled={editReviewMutation.isPending}
                              data-testid={`button-reject-edit-${edit.id}`}
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Attendance Override Dialog */}
      <Dialog open={attOverrideDialogOpen} onOpenChange={setAttOverrideDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {attOverrideManagerId ? "Override Manager Approval" : "Override All & Approve Attendance"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {attOverrideManagerId
              ? "This will mark this manager's attendance as approved by HR and bypass their pending action."
              : "This will mark the entire attendance report as approved by HR and unlock the salary run."}
          </p>
          <div className="mt-2">
            <Label className="text-sm">Reason for Override *</Label>
            <Textarea
              className="mt-1 h-24"
              placeholder="Explain why you are overriding the attendance approval…"
              value={attOverrideNote}
              onChange={e => setAttOverrideNote(e.target.value)}
              data-testid="textarea-override-note"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAttOverrideDialogOpen(false); setAttOverrideNote(""); }}>Cancel</Button>
            <Button
              disabled={!attOverrideNote.trim() || attOverrideMutation.isPending}
              onClick={() => attOverrideMutation.mutate({ runId: attStatus?.runId, managerId: attOverrideManagerId, note: attOverrideNote.trim() })}
              data-testid="button-confirm-override"
            >
              {attOverrideMutation.isPending ? "Applying…" : "Confirm Override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attendance Approval Override Dialog (HR/Super Admin only) */}
      <Dialog open={attApprovalOverrideOpen} onOpenChange={setAttApprovalOverrideOpen}>
        <DialogContent data-testid="dialog-att-approval-override">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Override Attendance Approval Gate
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-red-800 dark:text-red-300">
                The attendance report for this month has <strong>not been fully approved</strong> by all managers. Generating a salary run now may include unverified attendance data. This action is audited.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Reason for Override <span className="text-destructive">*</span></Label>
              <Textarea
                className="h-24"
                placeholder="Explain why the salary run is being generated without complete attendance approval…"
                value={attApprovalOverrideReason}
                onChange={e => setAttApprovalOverrideReason(e.target.value)}
                data-testid="textarea-att-approval-override-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAttApprovalOverrideOpen(false); setAttApprovalOverrideReason(""); }}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={!attApprovalOverrideReason.trim() || generateRunMutation.isPending}
              onClick={() => generateRunMutation.mutate({ overrideAttendanceApproval: true, overrideAttendanceReason: attApprovalOverrideReason.trim() })}
              data-testid="button-confirm-att-approval-override"
            >
              {generateRunMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</> : "Confirm & Generate Run"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pending Regularization Override Dialog (HR/Super Admin only) */}
      <Dialog open={pendingRegOverrideOpen} onOpenChange={setPendingRegOverrideOpen}>
        <DialogContent data-testid="dialog-pending-reg-override">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Override Pending Regularizations
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-amber-800 dark:text-amber-300">
                <strong>{pendingRegCount} regularization request{pendingRegCount === 1 ? "" : "s"}</strong> are still pending review for this month. As HR / Super Admin you can proceed, but a mandatory reason is required and this override will be permanently audited.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Reason for Override <span className="text-destructive">*</span></Label>
              <Textarea
                className="h-24"
                placeholder="Explain why the salary run is being generated with unresolved regularization requests…"
                value={pendingRegOverrideReason}
                onChange={e => setPendingRegOverrideReason(e.target.value)}
                data-testid="textarea-pending-reg-override-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPendingRegOverrideOpen(false); setPendingRegOverrideReason(""); }}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={!pendingRegOverrideReason.trim() || generateRunMutation.isPending}
              onClick={() => generateRunMutation.mutate({ overridePendingRegularizations: true, overrideReason: pendingRegOverrideReason.trim() })}
              data-testid="button-confirm-reg-override"
            >
              {generateRunMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</> : "Confirm & Generate Run"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval table (shown when a run is selected — hidden in read-only mode) */}
      {!readOnly && showApprovalTable && selectedRun && (
        <Card className="border-2 border-amber-300 dark:border-amber-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-amber-600" />
                Approval Review — {monthName(selectedRun.month)} {selectedRun.year}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowApprovalTable(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Review employee rows, make any corrections, then approve to dispatch the report to finance.
            </p>
          </CardHeader>
          <CardContent>
            <ApprovalTable
              run={selectedRun}
              onApproved={() => {
                setShowApprovalTable(false);
                refetchRuns();
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Month</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[160px]" data-testid="select-month"><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Year</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[120px]" data-testid="select-year"><SelectValue /></SelectTrigger>
                <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={handlePreview} disabled={isLoadingPreview} data-testid="button-preview-report">
              {isLoadingPreview ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
              Preview Report
            </Button>
            <Button variant="outline" onClick={handleDownload} data-testid="button-download-csv">
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </Button>
            {isAdminLevel && (
              <Button
                variant="default"
                onClick={() => generateRunMutation.mutate()}
                disabled={
                  generateRunMutation.isPending ||
                  // canOverride users can always click — 409 dialogs will guide them through gates
                  (!canRegenerate && (!attStatus?.approved || !salaryCanGenerate))
                }
                title={
                  !attStatus?.exists
                    ? "No attendance run exists for this month — generate one first from the Attendance Approvals panel"
                    : !attStatus?.approved && !canRegenerate
                    ? "Attendance approval is pending — salary run will unlock once all managers have approved"
                    : salaryPendingReg > 0 && !canRegenerate
                    ? `${salaryPendingReg} regularization request${salaryPendingReg === 1 ? "" : "s"} still pending — resolve them before generating the salary run`
                    : salaryPendingReg > 0
                    ? `${salaryPendingReg} pending regularization${salaryPendingReg === 1 ? "" : "s"} — click to review override options`
                    : "Generate salary run for this month"
                }
                data-testid="button-generate-run"
              >
                {generateRunMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                Generate Salary Run
              </Button>
            )}
            {canRegenerate && (
              <Button variant="secondary" onClick={() => setShowRegenerate(true)} data-testid="button-regenerate-month">
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate Month
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isAdminLevel && <SalaryGateStatusPanel month={selectedMonth} year={selectedYear} />}

      {!readOnly && <ReportRecipientsCard />}

      {/* Preview data */}
      {previewData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Employees</CardTitle>
                <Users className="h-5 w-5 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-mono font-bold" data-testid="text-total-employees">{previewData.summary.totalEmployees}</div>
                <p className="text-sm text-muted-foreground">{mLabel} {selectedYear}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Hours Worked</CardTitle>
                <Clock className="h-5 w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-mono font-bold" data-testid="text-total-hours">{previewData.summary.totalHoursWorked.toLocaleString()}</div>
                <p className="text-sm text-muted-foreground">Hours across all employees</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Payable Amount</CardTitle>
                <DollarSign className="h-5 w-5 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-mono font-bold" data-testid="text-total-payable">{formatCurrency(previewData.summary.totalPayable)}</div>
                <p className="text-sm text-muted-foreground">Net payable for the month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Deductions</CardTitle>
                <DollarSign className="h-5 w-5 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-mono font-bold text-red-600 dark:text-red-400" data-testid="text-total-deductions">{formatCurrency(previewData.summary.totalDeductions)}</div>
                <p className="text-sm text-muted-foreground">Absences + LOP deductions</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">
                <FileBarChart className="h-5 w-5 inline mr-2" />
                Salary Report — {mLabel} {selectedYear}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{previewData.rows.length} employee(s)</p>
            </CardHeader>
            <CardContent>
              {previewData.rows.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No salary data available for this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground whitespace-nowrap">Employee Name</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground whitespace-nowrap">Department</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground whitespace-nowrap">Designation</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground whitespace-nowrap">Salary</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground whitespace-nowrap">Working Days</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground whitespace-nowrap">Present</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground whitespace-nowrap">Paid Leaves</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground whitespace-nowrap">LOP</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground whitespace-nowrap">Hours</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground whitespace-nowrap">Attendance %</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground whitespace-nowrap">Advance Recovery</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground whitespace-nowrap">Net Payable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.rows.map((row, idx) => (
                        <tr key={idx} className="border-b last:border-0" data-testid={`row-salary-${idx}`}>
                          <td className="py-2 px-2 font-medium whitespace-nowrap" data-testid={`text-employee-name-${idx}`}>{row.employeeName}</td>
                          <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">{row.department}</td>
                          <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">{row.designation}</td>
                          <td className="py-2 px-2 text-right whitespace-nowrap">{formatCurrency(row.salary)}</td>
                          <td className="py-2 px-2 text-right">{row.workingDays}</td>
                          <td className="py-2 px-2 text-right">{row.presentDays}</td>
                          <td className="py-2 px-2 text-right">{row.paidLeaves}</td>
                          <td className={`py-2 px-2 text-right font-medium ${row.lopLeaves > 0 ? "text-amber-600 dark:text-amber-400" : ""}`} data-testid={`text-lop-leaves-${idx}`}>{row.lopLeaves}</td>
                          <td className="py-2 px-2 text-right">{row.totalHours}</td>
                          <td className="py-2 px-2 text-right">{row.attendancePercentage}%</td>
                          <td className={`py-2 px-2 text-right whitespace-nowrap ${Number(row.advanceRecovery) > 0 ? "text-purple-600 dark:text-purple-400" : "text-muted-foreground"}`} data-testid={`text-preview-advance-recovery-${idx}`}>{formatCurrency(Number(row.advanceRecovery) || 0)}</td>
                          <td className="py-2 px-2 text-right font-medium whitespace-nowrap">{formatCurrency(row.netPayable)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!previewData && !isLoadingPreview && !showApprovalTable && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FileBarChart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-1">No Report Loaded</h3>
              <p className="text-sm text-muted-foreground">Select a month and year, then click "Preview Report" to view salary data, or "Generate for Approval" to start the approval flow.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoadingPreview && !previewData && (
        <Card>
          <CardContent className="py-8 space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
          </CardContent>
        </Card>
      )}

      {/* Run history */}
      <RunHistoryList runs={runs} />

      {showRegenerate && (
        <RegenerateMonthModal month={selectedMonth} year={selectedYear} onClose={() => setShowRegenerate(false)} />
      )}
    </div>
  );
}

export default function SalaryReports() {
  return (
    <AdminLayout>
      <SalaryReportsContent />
    </AdminLayout>
  );
}
