import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileBarChart, Download, Send, Eye, Users, Clock, DollarSign, Loader2, Mail, Plus, X, ChevronDown, ChevronUp, Save, RefreshCw, AlertTriangle, ArrowRight, CheckCircle2, Clock3, History, Pencil, MessageSquare, ShieldCheck, CalendarDays, XCircle } from "lucide-react";
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
  adjustments?: Record<string, Adjustment>;
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

interface RegenerateDiffRow {
  userId: string;
  name: string;
  email: string;
  oldNetPayable: number | null;
  newNetPayable: number;
  oldLopLeaves: number | null;
  newLopLeaves: number;
  changed: boolean;
}

function RegenerateMonthModal({ month, year, onClose }: { month: string; year: string; onClose: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState<"warn" | "diff" | "done">("warn");
  const [diff, setDiff] = useState<RegenerateDiffRow[]>([]);
  const [changedCount, setChangedCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);

  const monthLabel = MONTHS.find(m => m.value === month)?.label || month;
  const fmt = (val: number | null) => {
    if (val === null) return "—";
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);
  };

  const previewMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hr/salary-slips/regenerate", { month: parseInt(month), year: parseInt(year), dryRun: true }),
    onSuccess: async (res) => {
      const data = await res.json();
      setDiff(data.diff || []);
      setChangedCount(data.changedCount || 0);
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-regenerate-month">
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
              <div className="flex items-center gap-3 text-sm">
                <span className="font-medium">{diff.length} employees</span>
                <span className="text-muted-foreground">·</span>
                <span className={changedCount > 0 ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"}>{changedCount} will change</span>
                {changedCount === 0 && <span className="text-green-600 dark:text-green-400">· No changes detected</span>}
              </div>
              {diff.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">No employees found for this period</p>
              ) : (
                <div className="border rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/60 z-10">
                      <tr>
                        <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Employee</th>
                        <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">LOP Days</th>
                        <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Old Net Pay</th>
                        <th className="py-2 px-3 text-center text-xs font-medium text-muted-foreground"></th>
                        <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">New Net Pay</th>
                        <th className="py-2 px-3 text-center text-xs font-medium text-muted-foreground">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diff.map((row, idx) => (
                        <tr key={row.userId} className={`border-t ${row.changed ? "bg-amber-50/50 dark:bg-amber-900/10" : ""}`} data-testid={`regenerate-diff-row-${idx}`}>
                          <td className="py-2 px-3"><p className="font-medium">{row.name}</p><p className="text-xs text-muted-foreground">{row.email}</p></td>
                          <td className="py-2 px-3 text-right font-mono text-xs">
                            <span className="text-muted-foreground">{row.oldLopLeaves ?? "—"}</span>
                            {row.newLopLeaves !== (row.oldLopLeaves ?? row.newLopLeaves) && <span className="ml-1 text-amber-600">→ {row.newLopLeaves}</span>}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-xs text-muted-foreground">{fmt(row.oldNetPayable)}</td>
                          <td className="py-2 px-3 text-center text-muted-foreground"><ArrowRight className="h-3 w-3 inline" /></td>
                          <td className="py-2 px-3 text-right font-mono text-xs font-medium">{fmt(row.newNetPayable)}</td>
                          <td className="py-2 px-3 text-center">
                            {row.changed ? <span className="inline-flex items-center text-xs font-medium text-amber-600 dark:text-amber-400"><AlertTriangle className="h-3 w-3 mr-1" />Changed</span> : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button variant="secondary" onClick={() => setStep("warn")}>Back</Button>
              <Button onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending} data-testid="button-confirm-regenerate">
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
  const liveNet = Math.max(0, Math.round((gross - effectiveDeductions) * 100) / 100);
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

// Approval table for a pending run
function ApprovalTable({
  run,
  onApproved,
}: {
  run: SalaryRun;
  onApproved: () => void;
}) {
  const { toast } = useToast();
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [confirmApprove, setConfirmApprove] = useState(false);

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

  const approveMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/hr/reports/salary/runs/${run.id}/approve`, {}),
    onSuccess: async () => {
      toast({ title: "Report approved & sent", description: "The salary report has been dispatched to recipients." });
      setConfirmApprove(false);
      queryClient.invalidateQueries({ queryKey: ["/api/hr/reports/salary/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/reports/salary/runs/pending-count"] });
      onApproved();
    },
    onError: (err: any) => {
      toast({ title: "Approval failed", description: err.message, variant: "destructive" });
    },
  });

  const rows = fullRun?.reportData || run.reportData || [];
  const adjustments = fullRun?.adjustments || run.adjustments || {};
  const adjustedCount = Object.keys(adjustments).length;

  const fmt = (v: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
  const totalPayable = rows.reduce((s, r) => s + Number(r.netPayable), 0);
  const totalDeductions = rows.reduce((s, r) => s + Number(r.deductions), 0);

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                        <td colSpan={8} className="px-3 py-3">
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
            <p>The report will be emailed to all configured recipients. Adjusted rows will also update the corresponding salary slips.</p>
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
    </div>
  );
}

function RunHistoryList({ runs }: { runs: SalaryRun[] }) {
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
              <div key={run.id} className="flex flex-wrap items-center gap-3 p-3 border rounded-lg text-sm" data-testid={`run-history-row-${idx}`}>
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
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SalaryReportsContent() {
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

  const canRegenerate = user?.role && ["super_admin", "admin", "hr"].includes(user.role);
  const isAdminLevel = user?.role && ["super_admin", "admin"].includes(user.role);

  const currentYear = now.getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  // Fetch all runs
  const { data: runs = [], refetch: refetchRuns } = useQuery<SalaryRun[]>({
    queryKey: ["/api/hr/reports/salary/runs"],
    refetchInterval: 30000,
  });

  // Pending runs for the banner
  const pendingRuns = runs.filter(r => r.status === "pending_approval");

  const { refetch: fetchPreview, isLoading: previewLoading, isFetching: previewFetching } = useQuery<SalaryReportResult>({
    queryKey: ["/api/hr/reports/salary/preview", { year: selectedYear, month: selectedMonth }],
    enabled: false,
  });

  const handlePreview = async () => {
    const result = await fetchPreview();
    if (result.data) setPreviewData(result.data);
  };

  const generateRunMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hr/reports/salary/runs/generate", {
      year: parseInt(selectedYear),
      month: parseInt(selectedMonth),
    }),
    onSuccess: async (res) => {
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
        return;
      }
      const run: SalaryRun = await res.json();
      toast({ title: "Report generated", description: `${monthName(run.month)} ${run.year} is ready for review.` });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/reports/salary/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/reports/salary/runs/pending-count"] });
      setSelectedRunId(run.id);
      setShowApprovalTable(true);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to generate run", variant: "destructive" });
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

  const allowedRoles = ["super_admin", "admin", "hr", "finance"];
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
        </div>
      )}

      {/* Approval table (shown when a run is selected) */}
      {showApprovalTable && selectedRun && (
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
                disabled={generateRunMutation.isPending}
                data-testid="button-generate-run"
              >
                {generateRunMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                Generate for Approval
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

      <ReportRecipientsCard />

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
