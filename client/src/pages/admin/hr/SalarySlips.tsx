import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Receipt, Download, Calendar, IndianRupee, TrendingDown, Loader2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";

interface SalarySlip {
  id: string;
  userId: string;
  year: number;
  month: number;
  basicSalary: string;
  grossSalary: string;
  deductions: string;
  salaryAdvanceRecovery?: string | null;
  netPayable: string;
  totalWorkingDays: number;
  daysPresent: number;
  daysAbsent: number;
  approvedLeaves: string;
  totalHours: string;
  attendancePercentage: string;
  generatedAt: string;
  generatedBy: string | null;
}

interface SlipDetail extends SalarySlip {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    designation: string | null;
    salary: string | null;
  };
  department?: {
    id: string;
    name: string;
  };
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

function generateSlipHTML(slip: SlipDetail): string {
  const monthName = MONTH_NAMES[slip.month - 1];
  const employeeName = slip.user ? `${slip.user.firstName} ${slip.user.lastName}` : "Employee";
  const employeeEmail = slip.user?.email || "";
  const designation = slip.user?.designation || "N/A";
  const department = slip.department?.name || "N/A";

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
    <div class="info-item"><span class="info-label">Employee Name:</span><span class="info-value">${employeeName}</span></div>
    <div class="info-item"><span class="info-label">Email:</span><span class="info-value">${employeeEmail}</span></div>
    <div class="info-item"><span class="info-label">Designation:</span><span class="info-value">${designation}</span></div>
    <div class="info-item"><span class="info-label">Department:</span><span class="info-value">${department}</span></div>
  </div>
  <div class="section">
    <div class="section-title">Attendance Summary</div>
    <table>
      <tr><th>Description</th><th class="amount">Value</th></tr>
      <tr><td>Total Working Days</td><td class="amount">${slip.totalWorkingDays}</td></tr>
      <tr><td>Days Present</td><td class="amount">${slip.daysPresent}</td></tr>
      <tr><td>Days Absent</td><td class="amount">${slip.daysAbsent}</td></tr>
      <tr><td>Approved Leaves</td><td class="amount">${parseFloat(slip.approvedLeaves)}</td></tr>
      <tr><td>Total Hours Worked</td><td class="amount">${parseFloat(slip.totalHours).toFixed(1)}</td></tr>
      <tr><td>Attendance Percentage</td><td class="amount">${parseFloat(slip.attendancePercentage).toFixed(1)}%</td></tr>
    </table>
  </div>
  <div class="section">
    <div class="section-title">Earnings & Deductions</div>
    <table>
      <tr><th>Description</th><th class="amount">Amount (INR)</th></tr>
      <tr><td>Basic Salary</td><td class="amount">${formatCurrency(slip.basicSalary)}</td></tr>
      <tr><td>Gross Salary</td><td class="amount">${formatCurrency(slip.grossSalary)}</td></tr>
      <tr><td>Deductions (Unauthorized Absences)</td><td class="amount">- ${formatCurrency(slip.deductions)}</td></tr>
      ${parseFloat(slip.salaryAdvanceRecovery || "0") > 0 ? `<tr><td>Salary Advance Recovery</td><td class="amount">- ${formatCurrency(slip.salaryAdvanceRecovery || "0")}</td></tr>` : ""}
      <tr class="total-row"><td>Net Payable</td><td class="amount">${formatCurrency(slip.netPayable)}</td></tr>
    </table>
  </div>
  <div class="net-pay">
    <span class="label">Net Pay</span>
    <span class="value">INR ${formatCurrency(slip.netPayable)}</span>
  </div>
  <div class="footer">
    This is a system-generated salary slip. Generated on ${new Date(slip.generatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}.
  </div>
</div>
</body>
</html>`;
}

function downloadSlipAsPDF(slip: SlipDetail) {
  const html = generateSlipHTML(slip);
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
}

export default function SalarySlips() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: slips, isLoading } = useQuery<SalarySlip[]>({
    queryKey: ["/api/hr/salary-slips/my", { year: selectedYear }],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/admin/login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const years = [];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    years.push(String(y));
  }

  const handleDownload = async (slipId: string) => {
    setDownloadingId(slipId);
    try {
      const res = await fetch(`/api/hr/salary-slips/my/${slipId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch slip details");
      const detail: SlipDetail = await res.json();
      downloadSlipAsPDF(detail);
    } catch (err) {
      console.error("Download error:", err);
    } finally {
      setDownloadingId(null);
    }
  };

  const sortedSlips = slips ? [...slips].sort((a, b) => b.month - a.month) : [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4" data-testid="text-salary-slips-title">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-tight">My Salary Slips</h1>
            <p className="text-sm text-muted-foreground mt-0.5">View and download your monthly salary slips</p>
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
        ) : sortedSlips.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-1" data-testid="text-no-slips">No Salary Slips</h3>
              <p className="text-sm text-muted-foreground">
                No salary slips have been generated for {selectedYear} yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedSlips.map((slip) => (
              <Card key={slip.id} data-testid={`card-slip-${slip.id}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-base">
                    {MONTH_NAMES[slip.month - 1]}
                  </CardTitle>
                  <Badge variant="secondary" data-testid={`badge-month-${slip.id}`}>
                    {MONTH_NAMES[slip.month - 1].substring(0, 3)} {slip.year}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <IndianRupee className="h-3.5 w-3.5" />
                        Gross Salary
                      </span>
                      <span className="text-sm font-medium font-mono" data-testid={`text-gross-${slip.id}`}>
                        {formatCurrency(slip.grossSalary)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <TrendingDown className="h-3.5 w-3.5" />
                        Deductions
                      </span>
                      <span className="text-sm font-medium font-mono text-red-600 dark:text-red-400" data-testid={`text-deductions-${slip.id}`}>
                        - {formatCurrency(slip.deductions)}
                      </span>
                    </div>
                    {parseFloat(slip.salaryAdvanceRecovery || "0") > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <TrendingDown className="h-3.5 w-3.5" />
                          Salary Advance Recovery
                        </span>
                        <span className="text-sm font-medium font-mono text-amber-600 dark:text-amber-400" data-testid={`text-advance-recovery-${slip.id}`}>
                          - {formatCurrency(slip.salaryAdvanceRecovery || "0")}
                        </span>
                      </div>
                    )}
                    <div className="border-t pt-2 flex items-center justify-between">
                      <span className="text-sm font-semibold">Net Payable</span>
                      <span className="text-base font-bold font-mono" data-testid={`text-net-${slip.id}`}>
                        {formatCurrency(slip.netPayable)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Present: {slip.daysPresent}/{slip.totalWorkingDays} days</span>
                    <span>{parseFloat(slip.attendancePercentage).toFixed(0)}% attendance</span>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleDownload(slip.id)}
                    disabled={downloadingId === slip.id}
                    data-testid={`button-download-${slip.id}`}
                  >
                    {downloadingId === slip.id ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    {downloadingId === slip.id ? "Loading..." : "Download Slip"}
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
