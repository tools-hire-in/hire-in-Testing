import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  Play,
  ChevronDown,
  ChevronUp,
  FileText,
  Users,
  ClipboardCheck,
  TrendingDown,
  Download,
  DollarSign,
  Building2,
} from "lucide-react";
import { SalaryReportsContent } from "@/pages/admin/hr/SalaryReports";

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

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const YEARS = Array.from({ length: 3 }, (_, i) => currentYear - i);

interface ValidationResult {
  year: number;
  month: number;
  checks: {
    attendanceReady: boolean;
    attendanceStatus: string;
    pendingRegularizations: number;
    pendingLeaveRequests: number;
    activeAdvances: number;
    missingStructure: { id: string; name: string; email: string }[];
    missingStructureCount: number;
    existingRun: { id: string; status: string; generatedAt: string } | null;
    existingSlipsCount: number;
  };
  estimates: {
    headcount: number;
    estimatedGross: number;
    estimatedEmployerPf: number;
    estimatedEmployerEsi: number;
    estimatedEmployerTotal: number;
    lopAlertCount: number;
    lopAlertEmployees: { name: string; lopDays: number }[];
  };
  canProceed: boolean;
  warnings: string[];
}

interface GenerateResult {
  runId: string;
  runStatus: string;
  year: number;
  month: number;
  totalInRun: number;
  processed: number;
  skipped: number;
  errors: { email: string; reason: string }[];
}

const inr = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

function ValidationPanel({ result, onRefresh }: { result: ValidationResult; onRefresh: () => void }) {
  const [showMissing, setShowMissing] = useState(false);
  const [showLopAlert, setShowLopAlert] = useState(false);
  const { checks, estimates } = result;

  const CheckRow = ({
    ok, info, label, detail,
  }: { ok?: boolean; info?: boolean; label: string; detail?: string }) => (
    <div className="flex items-start gap-2.5 py-2">
      {info ? (
        <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
      ) : ok ? (
        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {detail && <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>}
      </div>
    </div>
  );

  return (
    <Card data-testid="card-validation-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Pre-Run Validation</CardTitle>
          <Button variant="ghost" size="sm" onClick={onRefresh} data-testid="button-refresh-validation">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <CheckRow
          ok={checks.attendanceReady}
          label="Attendance approved"
          detail={`Status: ${checks.attendanceStatus}`}
        />
        <Separator />
        <CheckRow
          ok={checks.pendingRegularizations === 0}
          label="No pending punch regularizations"
          detail={
            checks.pendingRegularizations > 0
              ? `${checks.pendingRegularizations} request(s) still pending`
              : undefined
          }
        />
        <Separator />
        <CheckRow
          ok={checks.pendingLeaveRequests === 0}
          label="No pending leave requests affecting LOP"
          detail={
            checks.pendingLeaveRequests > 0
              ? `${checks.pendingLeaveRequests} pending leave request(s) for this period may change LOP`
              : undefined
          }
        />
        <Separator />
        <CheckRow
          info={checks.activeAdvances > 0}
          ok={checks.activeAdvances === 0}
          label={
            checks.activeAdvances > 0
              ? "Active salary advances (recovery included)"
              : "No active salary advances"
          }
          detail={
            checks.activeAdvances > 0
              ? `${checks.activeAdvances} advance(s) in repayment — recovery amounts will be applied`
              : undefined
          }
        />
        <Separator />
        <div>
          <CheckRow
            ok={checks.missingStructureCount === 0}
            label="All employees have salary structure"
            detail={
              checks.missingStructureCount > 0
                ? `${checks.missingStructureCount} employee(s) missing structure (will be skipped)`
                : undefined
            }
          />
          {checks.missingStructureCount > 0 && (
            <div className="ml-6 mt-1">
              <button
                className="text-xs text-muted-foreground underline-offset-2 hover:underline flex items-center gap-1"
                onClick={() => setShowMissing(v => !v)}
                data-testid="button-toggle-missing"
              >
                {showMissing ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {showMissing ? "Hide" : "Show"} employees
              </button>
              {showMissing && (
                <ul className="mt-1.5 space-y-0.5">
                  {checks.missingStructure.map(e => (
                    <li key={e.id} className="text-xs text-muted-foreground">
                      {e.name} ({e.email})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <Separator />
        <CheckRow
          ok
          label="Existing run / slips"
          detail={
            checks.existingRun
              ? `Run exists (${checks.existingRun.status}) — re-generate to overwrite`
              : checks.existingSlipsCount > 0
              ? `${checks.existingSlipsCount} slips already generated`
              : "No existing run for this period"
          }
        />

        {/* LOP alert */}
        {estimates.lopAlertCount > 0 && (
          <>
            <Separator />
            <div>
              <div className="flex items-start gap-2.5 py-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {estimates.lopAlertCount} employee(s) with high LOP (&gt;3 days)
                  </p>
                  <button
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline flex items-center gap-1 mt-0.5"
                    onClick={() => setShowLopAlert(v => !v)}
                    data-testid="button-toggle-lop-alert"
                  >
                    {showLopAlert ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {showLopAlert ? "Hide" : "Show"} list
                  </button>
                  {showLopAlert && (
                    <ul className="mt-1.5 space-y-0.5">
                      {estimates.lopAlertEmployees.map((e, i) => (
                        <li key={i} className="text-xs text-muted-foreground">
                          {e.name} — {e.lopDays} LOP day(s)
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Estimated aggregates */}
        {estimates.headcount > 0 && (
          <>
            <Separator />
            <div className="pt-2 pb-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Pre-Run Estimates
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Headcount</p>
                  <p className="text-sm font-semibold" data-testid="text-estimate-headcount">
                    {estimates.headcount}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Est. Gross Payroll</p>
                  <p className="text-sm font-semibold" data-testid="text-estimate-gross">
                    {inr(estimates.estimatedGross)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Est. Employer PF</p>
                  <p className="text-sm font-semibold" data-testid="text-estimate-employer-pf">
                    {inr(estimates.estimatedEmployerPf)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Est. Employer ESI</p>
                  <p className="text-sm font-semibold" data-testid="text-estimate-employer-esi">
                    {inr(estimates.estimatedEmployerEsi)}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Est. Total Employer Liability</p>
                  <p className="text-sm font-semibold text-primary" data-testid="text-estimate-employer-total">
                    {inr(estimates.estimatedEmployerTotal)}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {!result.canProceed && (
          <Alert className="mt-3" variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Resolve the above issues before generating. HR or Super Admin can override attendance and
              regularization gates via the salary run section below.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function RunSummaryCard({ run }: { run: any }) {
  const rows: any[] = run.reportData ?? [];
  const totalGross = rows.reduce((s: number, r: any) => s + (parseFloat(r.grossSalary) || 0), 0);
  const totalNet = rows.reduce((s: number, r: any) => s + (parseFloat(r.netPayable) || 0), 0);
  const totalLop = rows.reduce((s: number, r: any) => s + (parseFloat(r.lopLeaves) || 0), 0);

  const statusBadge = (s: string) => {
    if (s === "approved") return <Badge className="bg-green-500 text-white">Approved</Badge>;
    if (s === "sent") return <Badge className="bg-blue-500 text-white">Sent</Badge>;
    if (s === "rejected") return <Badge variant="destructive">Rejected</Badge>;
    return <Badge variant="outline" className="text-amber-600 border-amber-300">Pending Approval</Badge>;
  };

  return (
    <Card data-testid="card-run-summary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Current Run Summary</CardTitle>
          {statusBadge(run.status)}
        </div>
        <p className="text-xs text-muted-foreground">
          Generated {new Date(run.generatedAt).toLocaleString()}
          {run.approvedBy && ` · Approved by ${run.approverName ?? run.approvedBy}`}
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Employees</p>
            <p className="text-xl font-bold" data-testid="text-run-employee-count">{rows.length}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Total Gross</p>
            <p className="text-xl font-bold" data-testid="text-run-total-gross">{inr(totalGross)}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Total Net</p>
            <p className="text-xl font-bold" data-testid="text-run-total-net">{inr(totalNet)}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Total LOP Days</p>
            <p className="text-xl font-bold" data-testid="text-run-total-lop">{totalLop.toFixed(1)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GenerateSummaryAlert({ result }: { result: GenerateResult }) {
  return (
    <Alert className="border-green-200 bg-green-50">
      <CheckCircle2 className="h-4 w-4 text-green-600" />
      <AlertDescription className="text-green-800">
        <strong>Bulk generation complete.</strong> {result.processed} slip(s) created with statutory
        computation, {result.skipped} skipped (already existed or no structure).
        {result.errors.length > 0 && (
          <span className="text-destructive ml-1">
            {result.errors.length} error(s) — check server logs.
          </span>
        )}
      </AlertDescription>
    </Alert>
  );
}

function handleStatutoryDownload(year: string, month: string) {
  const url = `/api/hr/payroll-runs/${year}/${month}/statutory-export`;
  const a = document.createElement("a");
  a.href = url;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function BulkPayrollRun() {
  const { toast } = useToast();
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState(String(currentMonth));
  const [generateResult, setGenerateResult] = useState<GenerateResult | null>(null);

  const validationQuery = useQuery<ValidationResult>({
    queryKey: ["/api/hr/payroll-runs/validate", year, month],
    queryFn: async () => {
      const res = await fetch(`/api/hr/payroll-runs/validate?year=${year}&month=${month}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load validation");
      return res.json();
    },
    staleTime: 30_000,
  });

  const runsQuery = useQuery<any[]>({
    queryKey: ["/api/hr/reports/salary/runs"],
    staleTime: 30_000,
  });

  const currentRun = runsQuery.data?.find(
    r => r.year === parseInt(year) && r.month === parseInt(month)
  );

  const runDetailQuery = useQuery<any>({
    queryKey: ["/api/hr/reports/salary/runs", currentRun?.id],
    queryFn: async () => {
      if (!currentRun?.id) return null;
      const res = await fetch(`/api/hr/reports/salary/runs/${currentRun.id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load run");
      return res.json();
    },
    enabled: !!currentRun?.id,
    staleTime: 30_000,
  });

  // ── Step 1: Generate the salary report run (existing endpoint). ──────────
  // This creates a pending_approval run from attendance data.
  // Does NOT auto-trigger bulk slip generation — the user reviews the run
  // first, then clicks "Bulk Generate Slips" as a separate deliberate step.
  const generateRunMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/hr/reports/salary/runs/generate", {
        year: parseInt(year),
        month: parseInt(month),
      }),
    onSuccess: async (res) => {
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "Report generation failed",
          description: data.message ?? data.error ?? "Could not generate run",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Salary report run generated",
        description: "Review the run below, then click 'Bulk Generate Slips' to create individual slips.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/reports/salary/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/payroll-runs/validate"] });
      // Do NOT auto-trigger generateAllMutation here.
      // The user must review the run and deliberately trigger slip generation.
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate payroll run", variant: "destructive" });
    },
  });

  // ── Step 2: Bulk-generate salary slips for all employees in the run. ─────
  // Runs the statutory engine per employee, producing frozen computation
  // snapshots immediately (not deferred to individual slip render).
  const generateAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/hr/payroll-runs/${year}/${month}/generate-all`,
        {}
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Bulk generation failed");
      }
      return res.json() as Promise<GenerateResult>;
    },
    onSuccess: (data) => {
      setGenerateResult(data);
      toast({
        title: "Bulk generation complete",
        description: `${data.processed} slip(s) created with statutory computation, ${data.skipped} skipped.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/payroll-runs/validate"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/reports/salary/runs"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message ?? "Bulk generation failed", variant: "destructive" });
    },
  });

  const monthLabel = MONTHS.find(m => m.value === month)?.label ?? month;
  // Bulk Generate Slips is available for any non-rejected run.
  const runExists = !!currentRun && currentRun.status !== "rejected";
  const hasApprovedRun = currentRun?.status === "approved" || currentRun?.status === "sent";

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Bulk Payroll Run</h1>
          <p className="text-muted-foreground mt-1">
            Validate gates, generate the monthly payroll run, and bulk-create salary slips with full
            statutory computation for all employees.
          </p>
        </div>

        {/* Period selector + action buttons */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Month</p>
                <Select value={month} onValueChange={v => { setMonth(v); setGenerateResult(null); }}>
                  <SelectTrigger className="w-36" data-testid="select-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Year</p>
                <Select value={year} onValueChange={v => { setYear(v); setGenerateResult(null); }}>
                  <SelectTrigger className="w-28" data-testid="select-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Step 1 */}
              <Button
                onClick={() => generateRunMutation.mutate()}
                disabled={generateRunMutation.isPending || generateAllMutation.isPending}
                data-testid="button-generate-run"
                className="gap-2"
              >
                {generateRunMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {currentRun ? "Regenerate Run" : "Generate Run"} — {monthLabel} {year}
              </Button>

              {/* Step 2 — visible for any non-rejected run */}
              {runExists && (
                <Button
                  variant="outline"
                  onClick={() => generateAllMutation.mutate()}
                  disabled={generateRunMutation.isPending || generateAllMutation.isPending}
                  data-testid="button-bulk-generate-slips"
                  className="gap-2"
                >
                  {generateAllMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Users className="h-4 w-4" />
                  )}
                  Bulk Generate Slips
                </Button>
              )}

              {/* Statutory CSV — only after approval */}
              {hasApprovedRun && (
                <Button
                  variant="outline"
                  onClick={() => handleStatutoryDownload(year, month)}
                  data-testid="button-statutory-export-run"
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Statutory CSV
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bulk generation result */}
        {generateResult && <GenerateSummaryAlert result={generateResult} />}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: validation + how-it-works */}
          <div className="lg:col-span-1 space-y-4">
            {validationQuery.isLoading ? (
              <Card>
                <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
                <CardContent className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-8 w-full" />)}
                </CardContent>
              </Card>
            ) : validationQuery.data ? (
              <ValidationPanel
                result={validationQuery.data}
                onRefresh={() => validationQuery.refetch()}
              />
            ) : null}

            {/* Workflow guide */}
            <Card data-testid="card-workflow-guide">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">
                  4-Step Workflow
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-start gap-2 text-muted-foreground">
                  <ClipboardCheck className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Step 1:</strong> "Generate Run" creates an attendance-based salary report
                    (status: Pending Approval).
                  </span>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <Users className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Step 2:</strong> Review the run below, then click "Bulk Generate Slips" to
                    bootstrap individual slip rows with full statutory computation.
                  </span>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <Building2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Step 3:</strong> Approve the run in the "Run Detail &amp; Approval" section
                    below. Only approved runs appear on the Executive Dashboard.
                  </span>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <DollarSign className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Step 4:</strong> Download the Statutory CSV (enabled after approval) for
                    EPF/ESI/PT filing.
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: run summary card */}
          <div className="lg:col-span-2 space-y-4">
            {runDetailQuery.isLoading && currentRun ? (
              <Card>
                <CardContent className="pt-6">
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ) : runDetailQuery.data ? (
              <RunSummaryCard run={runDetailQuery.data} />
            ) : (
              <Card>
                <CardContent className="pt-8 pb-8 text-center text-muted-foreground text-sm">
                  No payroll run exists for {monthLabel} {year}. Click &quot;Generate Run&quot; to create one.
                </CardContent>
              </Card>
            )}

            {/* LOP impact note */}
            {validationQuery.data?.estimates && validationQuery.data.estimates.lopAlertCount > 0 && (
              <Alert className="border-amber-200 bg-amber-50">
                <TrendingDown className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  <strong>{validationQuery.data.estimates.lopAlertCount} employee(s)</strong> have more
                  than 3 LOP days this period — verify these before approving the run to avoid payroll
                  disputes.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        {/* Full salary reports drill-down */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Run Detail &amp; Approval</h2>
          <SalaryReportsContent />
        </div>
      </div>
    </AdminLayout>
  );
}
