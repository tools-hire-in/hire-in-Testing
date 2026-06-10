import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileBarChart, Download, Send, Eye, Users, Clock, DollarSign, Loader2, Mail, Plus, X, ChevronDown, ChevronUp, Save, RefreshCw, AlertTriangle, ArrowRight } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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

function RegenerateMonthModal({
  month,
  year,
  onClose,
}: {
  month: string;
  year: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<"warn" | "diff" | "done">("warn");
  const [diff, setDiff] = useState<RegenerateDiffRow[]>([]);
  const [changedCount, setChangedCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);

  const monthLabel = MONTHS.find(m => m.value === month)?.label || month;

  const formatCurrencyLocal = (val: number | null) => {
    if (val === null) return "—";
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);
  };

  const previewMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/hr/salary-slips/regenerate", {
        month: parseInt(month),
        year: parseInt(year),
        dryRun: true,
      }),
    onSuccess: async (res) => {
      const data = await res.json();
      setDiff(data.diff || []);
      setChangedCount(data.changedCount || 0);
      setStep("diff");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to preview", variant: "destructive" });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/hr/salary-slips/regenerate", {
        month: parseInt(month),
        year: parseInt(year),
        dryRun: false,
      }),
    onSuccess: async (res) => {
      const data = await res.json();
      setSavedCount(data.upsertedCount || 0);
      queryClient.invalidateQueries({ queryKey: ["/api/hr/salary-slips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/admin/salary-slips"] });
      toast({ title: "Salary Slips Regenerated", description: `${data.upsertedCount} slips updated for ${monthLabel} ${year}` });
      setStep("done");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to regenerate", variant: "destructive" });
    },
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
                    This action is logged in the audit trail and cannot be undone automatically.
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Use this when attendance corrections (e.g. bulk regularizations after portal downtime) have been applied and the salary
                slips for the affected month need to reflect the corrected data.
              </p>
              <p className="text-sm text-muted-foreground">
                Clicking <strong>Preview Changes</strong> will calculate the new values and show you a before/after comparison
                before anything is saved.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                onClick={() => previewMutation.mutate()}
                disabled={previewMutation.isPending}
                data-testid="button-preview-regenerate"
              >
                {previewMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Calculating...</>
                ) : (
                  <><Eye className="h-4 w-4 mr-2" />Preview Changes</>
                )}
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
                <span className={changedCount > 0 ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"}>
                  {changedCount} will change
                </span>
                {changedCount === 0 && (
                  <span className="text-green-600 dark:text-green-400">· No changes detected</span>
                )}
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
                        <tr
                          key={row.userId}
                          className={`border-t ${row.changed ? "bg-amber-50/50 dark:bg-amber-900/10" : ""}`}
                          data-testid={`regenerate-diff-row-${idx}`}
                        >
                          <td className="py-2 px-3">
                            <p className="font-medium">{row.name}</p>
                            <p className="text-xs text-muted-foreground">{row.email}</p>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-xs">
                            <span className="text-muted-foreground">{row.oldLopLeaves ?? "—"}</span>
                            {row.newLopLeaves !== (row.oldLopLeaves ?? row.newLopLeaves) && (
                              <span className="ml-1 text-amber-600">→ {row.newLopLeaves}</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-xs text-muted-foreground">
                            {formatCurrencyLocal(row.oldNetPayable)}
                          </td>
                          <td className="py-2 px-3 text-center text-muted-foreground">
                            <ArrowRight className="h-3 w-3 inline" />
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-xs font-medium">
                            {formatCurrencyLocal(row.newNetPayable)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {row.changed ? (
                              <span className="inline-flex items-center text-xs font-medium text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="h-3 w-3 mr-1" />Changed
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
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
              <Button
                variant="secondary"
                onClick={() => setStep("warn")}
              >
                Back
              </Button>
              <Button
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending}
                data-testid="button-confirm-regenerate"
              >
                {confirmMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                ) : (
                  <><RefreshCw className="h-4 w-4 mr-2" />Confirm & Save</>
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "done" && (
          <>
            <div className="space-y-4 py-4 text-center">
              <div className="flex justify-center">
                <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/20">
                  <RefreshCw className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div>
                <p className="text-lg font-semibold">{savedCount} Salary Slips Regenerated</p>
                <p className="text-sm text-muted-foreground mt-1">
                  All slips for {monthLabel} {year} have been recalculated with corrected attendance data.
                  Employees can now download their updated slips.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={onClose}>Done</Button>
            </DialogFooter>
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

  const { data: recipients } = useQuery<{ to: string[]; cc: string[] }>({
    queryKey: ["/api/hr/reports/salary/recipients"],
  });

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
    if (!emailRegex.test(value)) {
      toast({ title: "Invalid email format", variant: "destructive" });
      return;
    }
    if (type === "to") {
      if (toEmails.includes(value)) return;
      setToEmails(prev => [...prev, value]);
      setNewTo("");
    } else {
      if (ccEmails.includes(value)) return;
      setCcEmails(prev => [...prev, value]);
      setNewCc("");
    }
  };

  const removeEmail = (type: "to" | "cc", email: string) => {
    if (type === "to") {
      setToEmails(prev => prev.filter(e => e !== email));
    } else {
      setCcEmails(prev => prev.filter(e => e !== email));
    }
  };

  const handleSave = async () => {
    if (toEmails.length === 0) {
      toast({ title: "At least one 'To' recipient is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await apiRequest("PUT", "/api/hr/reports/salary/recipients", {
        to: toEmails,
        cc: ccEmails,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/hr/reports/salary/recipients"] });
      toast({ title: "Report recipients updated" });
    } catch (err: any) {
      toast({ title: err.message || "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
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
                  <button onClick={() => removeEmail("to", email)} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input
                data-testid="input-add-to"
                type="email"
                placeholder="Add To recipient..."
                value={newTo}
                onChange={e => setNewTo(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addEmail("to"))}
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={() => addEmail("to")} data-testid="button-add-to">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">CC (Copy Recipients)</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {ccEmails.map(email => (
                <Badge key={email} variant="outline" className="gap-1 pr-1" data-testid={`badge-cc-${email}`}>
                  {email}
                  <button onClick={() => removeEmail("cc", email)} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {ccEmails.length === 0 && (
                <span className="text-sm text-muted-foreground">No CC recipients</span>
              )}
            </div>
            <div className="flex gap-2 mt-2">
              <Input
                data-testid="input-add-cc"
                type="email"
                placeholder="Add CC recipient..."
                value={newCc}
                onChange={e => setNewCc(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addEmail("cc"))}
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={() => addEmail("cc")} data-testid="button-add-cc">
                <Plus className="h-4 w-4" />
              </Button>
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

export function SalaryReportsContent() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { toast } = useToast();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [previewData, setPreviewData] = useState<SalaryReportResult | null>(null);
  const [showRegenerate, setShowRegenerate] = useState(false);

  const canRegenerate = user?.role && ["super_admin", "admin", "hr"].includes(user.role);

  const currentYear = now.getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  const { refetch: fetchPreview, isLoading: previewLoading, isFetching: previewFetching } = useQuery<SalaryReportResult>({
    queryKey: ["/api/hr/reports/salary/preview", { year: selectedYear, month: selectedMonth }],
    enabled: false,
  });

  const handlePreview = async () => {
    const result = await fetchPreview();
    if (result.data) {
      setPreviewData(result.data);
    }
  };

  const sendReportMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/hr/reports/salary", {
        year: parseInt(selectedYear),
        month: parseInt(selectedMonth),
      }),
    onSuccess: () => {
      toast({
        title: "Report Sent",
        description: "Salary report has been generated and emailed successfully.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Failed to generate and send report",
        variant: "destructive",
      });
    },
  });

  const handleDownload = async () => {
    try {
      const response = await fetch(
        `/api/hr/reports/salary/download?year=${selectedYear}&month=${selectedMonth}`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `salary_report_${selectedYear}_${selectedMonth.padStart(2, "0")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({
        title: "Error",
        description: "Failed to download report",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/admin/login");
    }
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
  const monthLabel = MONTHS.find(m => m.value === selectedMonth)?.label || "";

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

  return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-salary-reports-title">Salary Reports</h1>
          <p className="text-muted-foreground">Generate and review monthly salary processing reports</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Month</label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[160px]" data-testid="select-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Year</label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-[120px]" data-testid="select-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(y => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handlePreview}
                disabled={isLoadingPreview}
                data-testid="button-preview-report"
              >
                {isLoadingPreview ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4 mr-2" />
                )}
                Preview Report
              </Button>
              <Button
                variant="outline"
                onClick={handleDownload}
                data-testid="button-download-csv"
              >
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </Button>
              <Button
                variant="default"
                onClick={() => sendReportMutation.mutate()}
                disabled={sendReportMutation.isPending}
                data-testid="button-send-report"
              >
                {sendReportMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Generate & Send Report
              </Button>
              {canRegenerate && (
                <Button
                  variant="secondary"
                  onClick={() => setShowRegenerate(true)}
                  data-testid="button-regenerate-month"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate Month
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <ReportRecipientsCard />

        {previewData && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Employees</CardTitle>
                  <Users className="h-5 w-5 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-mono font-bold" data-testid="text-total-employees">
                    {previewData.summary.totalEmployees}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {monthLabel} {selectedYear}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Hours Worked</CardTitle>
                  <Clock className="h-5 w-5 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-mono font-bold" data-testid="text-total-hours">
                    {previewData.summary.totalHoursWorked.toLocaleString()}
                  </div>
                  <p className="text-sm text-muted-foreground">Hours across all employees</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Payable Amount</CardTitle>
                  <DollarSign className="h-5 w-5 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-mono font-bold" data-testid="text-total-payable">
                    {formatCurrency(previewData.summary.totalPayable)}
                  </div>
                  <p className="text-sm text-muted-foreground">Net payable for the month</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Deductions</CardTitle>
                  <DollarSign className="h-5 w-5 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-mono font-bold text-red-600 dark:text-red-400" data-testid="text-total-deductions">
                    {formatCurrency(previewData.summary.totalDeductions)}
                  </div>
                  <p className="text-sm text-muted-foreground">Absences + LOP deductions</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-base">
                  <FileBarChart className="h-5 w-5 inline mr-2" />
                  Salary Report — {monthLabel} {selectedYear}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {previewData.rows.length} employee(s)
                </p>
              </CardHeader>
              <CardContent>
                {previewData.rows.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No salary data available for this period.
                  </p>
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
                          <tr
                            key={idx}
                            className="border-b last:border-0"
                            data-testid={`row-salary-${idx}`}
                          >
                            <td className="py-2 px-2 font-medium whitespace-nowrap" data-testid={`text-employee-name-${idx}`}>
                              {row.employeeName}
                            </td>
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

        {!previewData && !isLoadingPreview && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <FileBarChart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-1">No Report Loaded</h3>
                <p className="text-sm text-muted-foreground">
                  Select a month and year, then click "Preview Report" to view salary data.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoadingPreview && !previewData && (
          <Card>
            <CardContent className="py-8 space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
            </CardContent>
          </Card>
        )}

        {showRegenerate && (
          <RegenerateMonthModal
            month={selectedMonth}
            year={selectedYear}
            onClose={() => setShowRegenerate(false)}
          />
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
