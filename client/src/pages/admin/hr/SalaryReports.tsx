import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FileBarChart, Download, Send, Eye, Users, Clock, DollarSign, Loader2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface EmployeeReportRow {
  employeeName: string;
  email: string;
  designation: string;
  department: string;
  salary: number;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  approvedLeaves: number;
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

export default function SalaryReports() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { toast } = useToast();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [previewData, setPreviewData] = useState<SalaryReportResult | null>(null);

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

  const allowedRoles = ["super_admin", "admin", "hr"];
  if (user?.role && !allowedRoles.includes(user.role)) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">You do not have permission to access this page.</p>
        </div>
      </AdminLayout>
    );
  }

  const isLoadingPreview = previewLoading || previewFetching;
  const monthLabel = MONTHS.find(m => m.value === selectedMonth)?.label || "";

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

  return (
    <AdminLayout>
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
            </div>
          </CardContent>
        </Card>

        {previewData && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Employees</CardTitle>
                  <Users className="h-5 w-5 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold" data-testid="text-total-employees">
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
                  <div className="text-3xl font-bold" data-testid="text-total-hours">
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
                  <div className="text-3xl font-bold" data-testid="text-total-payable">
                    {formatCurrency(previewData.summary.totalPayable)}
                  </div>
                  <p className="text-sm text-muted-foreground">Net payable for the month</p>
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
                          <th className="text-right py-3 px-2 font-medium text-muted-foreground whitespace-nowrap">Leaves</th>
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
                            <td className="py-2 px-2 text-right">{row.approvedLeaves}</td>
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
      </div>
    </AdminLayout>
  );
}
