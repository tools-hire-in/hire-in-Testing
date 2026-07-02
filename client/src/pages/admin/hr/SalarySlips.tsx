import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Receipt, Download, Calendar, IndianRupee, TrendingDown, Loader2, CheckCircle2, Clock3, FileText } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";

interface ApprovedRun {
  id: string;
  year: number;
  month: number;
  status: string;
  approvedAt: string | null;
  approverName?: string | null;
}

interface SlipData {
  userId: string;
  employeeName: string;
  email: string;
  designation: string;
  department: string;
  year: number;
  month: number;
  salary: number;
  grossSalary: number;
  deductions: number;
  advanceRecovery: number;
  advanceRecoveryBreakdown?: { advance: number; overpayment: number } | null;
  salaryCredit?: number | null;
  netPayable: number;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  paidLeaves: number;
  lopLeaves: number;
  totalHours: number;
  attendancePercentage: number;
  adjusted: boolean;
  adjustmentComment: string | null;
  salaryRunId: string;
  approvedAt: string | null;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatCurrency(value: string | number) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0.00";
  return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function generateSlipHTML(slip: SlipData): string {
  const monthName = MONTH_NAMES[slip.month - 1];
  const approvedDate = slip.approvedAt
    ? new Date(slip.approvedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : "—";

  return `<!DOCTYPE html>
<html>
<head>
<title>Salary Slip - ${monthName} ${slip.year}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; background: #fff; padding: 40px; }
  .slip { max-width: 800px; margin: 0 auto; border: 2px solid #1a365d; }
  .header { background: #1a365d; color: #fff; padding: 24px 32px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 22px; font-weight: 700; }
  .header .period { font-size: 14px; opacity: 0.9; }
  .sub-header { background: #edf2f7; padding: 16px 32px; font-size: 13px; color: #4a5568; text-align: center; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
  .employee-info { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 20px 32px; border-bottom: 1px solid #e2e8f0; }
  .info-item { display: flex; gap: 8px; font-size: 13px; }
  .info-label { color: #718096; min-width: 100px; }
  .info-value { font-weight: 600; color: #1a202c; }
  .section { padding: 20px 32px; }
  .section-title { font-size: 14px; font-weight: 700; color: #1a365d; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 10px 16px; text-align: left; font-size: 13px; }
  th { background: #f7fafc; color: #4a5568; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
  td { border-bottom: 1px solid #edf2f7; }
  .amount { text-align: right; font-family: 'Courier New', monospace; }
  .total-row { background: #f7fafc; font-weight: 700; }
  .total-row td { border-top: 2px solid #1a365d; border-bottom: none; }
  .net-pay { background: #1a365d; color: #fff; padding: 16px 32px; display: flex; justify-content: space-between; align-items: center; }
  .net-pay .label { font-size: 16px; font-weight: 600; }
  .net-pay .value { font-size: 24px; font-weight: 700; }
  .footer { padding: 16px 32px; font-size: 11px; color: #a0aec0; text-align: center; border-top: 1px solid #e2e8f0; }
  .adj-note { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; padding: 10px 16px; margin: 0 32px 12px; font-size: 12px; color: #c2410c; }
  @media print {
    body { padding: 0; }
    .slip { border: none; }
  }
</style>
</head>
<body>
<div class="slip">
  <div class="header">
    <div>
      <h1>Hire-In Solutions</h1>
      <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">Professional Staffing Services</div>
    </div>
    <div style="text-align: right;">
      <div class="period">${monthName} ${slip.year}</div>
      <div style="font-size: 11px; opacity: 0.7; margin-top: 2px;">Pay Slip</div>
    </div>
  </div>
  <div class="sub-header">Salary Slip for the month of ${monthName} ${slip.year}</div>
  <div class="employee-info">
    <div class="info-item"><span class="info-label">Employee Name:</span><span class="info-value">${slip.employeeName}</span></div>
    <div class="info-item"><span class="info-label">Email:</span><span class="info-value">${slip.email}</span></div>
    <div class="info-item"><span class="info-label">Designation:</span><span class="info-value">${slip.designation || "N/A"}</span></div>
    <div class="info-item"><span class="info-label">Department:</span><span class="info-value">${slip.department || "N/A"}</span></div>
    <div class="info-item"><span class="info-label">Pay Period:</span><span class="info-value">${monthName} ${slip.year}</span></div>
    <div class="info-item"><span class="info-label">Approved On:</span><span class="info-value">${approvedDate}</span></div>
  </div>
  ${slip.adjusted && slip.adjustmentComment ? `<div class="adj-note">⚠ This slip contains a manual adjustment: ${slip.adjustmentComment}</div>` : ""}
  <div class="section">
    <div class="section-title">Attendance Summary</div>
    <table>
      <tr><th>Description</th><th class="amount">Value</th></tr>
      <tr><td>Total Working Days</td><td class="amount">${slip.workingDays}</td></tr>
      <tr><td>Days Present</td><td class="amount">${slip.presentDays}</td></tr>
      <tr><td>Days Absent</td><td class="amount">${slip.absentDays}</td></tr>
      <tr><td>Approved Leaves</td><td class="amount">${slip.paidLeaves}</td></tr>
      <tr><td>LOP (Unpaid) Leaves</td><td class="amount">${slip.lopLeaves}</td></tr>
      <tr><td>Total Hours Worked</td><td class="amount">${Number(slip.totalHours).toFixed(1)}</td></tr>
      <tr><td>Attendance Percentage</td><td class="amount">${Number(slip.attendancePercentage).toFixed(1)}%</td></tr>
    </table>
  </div>
  <div class="section">
    <div class="section-title">Earnings & Deductions</div>
    <table>
      <tr><th>Description</th><th class="amount">Amount (INR)</th></tr>
      <tr><td>Basic Salary</td><td class="amount">${formatCurrency(slip.salary)}</td></tr>
      <tr><td>Gross Salary</td><td class="amount">${formatCurrency(slip.grossSalary)}</td></tr>
      <tr><td>Deductions (Unauthorized Absences)</td><td class="amount">- ${formatCurrency(slip.deductions)}</td></tr>
      ${(slip.salaryCredit ?? 0) > 0 ? `<tr><td>Salary Adjustment Credit</td><td class="amount">+ ${formatCurrency(slip.salaryCredit!)}</td></tr>` : ""}
      ${slip.advanceRecoveryBreakdown
        ? [
            slip.advanceRecoveryBreakdown.advance > 0 ? `<tr><td>Salary Advance Recovery</td><td class="amount">- ${formatCurrency(slip.advanceRecoveryBreakdown.advance)}</td></tr>` : "",
            slip.advanceRecoveryBreakdown.overpayment > 0 ? `<tr><td>Overpayment Recovery</td><td class="amount">- ${formatCurrency(slip.advanceRecoveryBreakdown.overpayment)}</td></tr>` : "",
          ].join("")
        : slip.advanceRecovery > 0 ? `<tr><td>Salary Advance Recovery</td><td class="amount">- ${formatCurrency(slip.advanceRecovery)}</td></tr>` : ""}
      <tr class="total-row"><td>Net Payable</td><td class="amount">${formatCurrency(slip.netPayable)}</td></tr>
    </table>
  </div>
  <div class="net-pay">
    <span class="label">Net Pay</span>
    <span class="value">INR ${formatCurrency(slip.netPayable)}</span>
  </div>
  <div class="footer">
    This is a system-generated salary slip based on approved payroll run. Generated on ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}.
  </div>
</div>
</body>
</html>`;
}

export default function SalarySlips() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [loadingMonth, setLoadingMonth] = useState<number | null>(null);

  const { data: runs = [], isLoading } = useQuery<ApprovedRun[]>({
    queryKey: ["/api/hr/salary-slips/my-runs"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/admin/login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const years: string[] = [];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    years.push(String(y));
  }

  const approvedRuns = runs
    .filter(r => r.status === "approved" && String(r.year) === selectedYear)
    .sort((a, b) => b.month - a.month);

  const handleViewDownload = async (run: ApprovedRun) => {
    if (!user?.id) return;
    setLoadingMonth(run.month);
    try {
      const res = await fetch(
        `/api/hr/salary-slips/render/${user.id}/${run.month}/${run.year}`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error || "Could not load salary slip for this period.");
        return;
      }
      const data: { slip: SlipData } = await res.json();
      const html = generateSlipHTML(data.slip);
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
    } catch (err) {
      console.error("Slip download error:", err);
      alert("Failed to load salary slip. Please try again.");
    } finally {
      setLoadingMonth(null);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4" data-testid="text-salary-slips-title">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-tight">My Salary Slips</h1>
            <p className="text-sm text-muted-foreground mt-0.5">View and download your monthly salary slips from approved payroll runs</p>
          </div>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32 shrink-0" data-testid="select-year">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-32 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : approvedRuns.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-1" data-testid="text-no-slips">No Approved Salary Runs</h3>
              <p className="text-sm text-muted-foreground">
                No approved payroll runs found for {selectedYear}. Salary slips are available after HR approves the monthly salary run.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {approvedRuns.map((run) => (
              <Card key={run.id} data-testid={`card-run-${run.id}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-base">
                    {MONTH_NAMES[run.month - 1]}
                  </CardTitle>
                  <Badge variant="outline" className="border-green-500 text-green-600 dark:text-green-400 text-xs" data-testid={`badge-approved-${run.id}`}>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Approved
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{MONTH_NAMES[run.month - 1]} {run.year}</span>
                    </div>
                    {run.approvedAt && (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        <span>
                          Approved{" "}
                          {new Date(run.approvedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5" />
                      <span>Slip generated on demand</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleViewDownload(run)}
                    disabled={loadingMonth === run.month}
                    data-testid={`button-view-slip-${run.id}`}
                  >
                    {loadingMonth === run.month ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    {loadingMonth === run.month ? "Loading..." : "View / Download Slip"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
