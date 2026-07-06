import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Receipt, Download, Calendar, Loader2, CheckCircle2, FileText, Eye, Mail, Clock3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { generateSalarySlipHtml, SLIP_MONTH_NAMES, type SalarySlipData } from "@shared/salarySlipHtml";

interface ApprovedRun {
  id: string;
  year: number;
  month: number;
  status: string;
  approvedAt: string | null;
  approverName?: string | null;
}

export default function SalarySlips() {
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-based
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [loadingMonthAction, setLoadingMonthAction] = useState<{ month: number; action: "view" | "pdf" | "email" } | null>(null);

  const { data: runs = [], isLoading } = useQuery<ApprovedRun[]>({
    queryKey: ["/api/hr/salary-slips/my-runs"],
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return null;

  const years: string[] = [];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    years.push(String(y));
  }

  // Build a map of month → approved run for quick lookup
  const approvedRunByMonth = new Map<number, ApprovedRun>();
  for (const run of runs) {
    if (run.status === "approved" && String(run.year) === selectedYear) {
      // Keep the most recently approved run (latest approvedAt) per month
      const existing = approvedRunByMonth.get(run.month);
      if (!existing || (run.approvedAt && (!existing.approvedAt || run.approvedAt > existing.approvedAt))) {
        approvedRunByMonth.set(run.month, run);
      }
    }
  }

  // All 12 months shown — available ones have actions, unavailable show a clear state
  const allMonths = Array.from({ length: 12 }, (_, i) => i + 1);

  // Only show months up to current month for current year (future months never have runs)
  const visibleMonths = Number(selectedYear) === currentYear
    ? allMonths.filter(m => m <= currentMonth)
    : allMonths;

  // Sort descending (most recent first)
  const months = [...visibleMonths].reverse();

  const fetchSlipData = async (run: ApprovedRun): Promise<SalarySlipData | null> => {
    if (!user?.id) return null;
    const res = await fetch(
      `/api/hr/salary-slips/render/${user.id}/${run.month}/${run.year}`,
      { credentials: "include" }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Could not load salary slip for this period.");
    }
    const data: { slip: SalarySlipData } = await res.json();
    return data.slip;
  };

  const handleViewInTab = async (run: ApprovedRun) => {
    setLoadingMonthAction({ month: run.month, action: "view" });
    try {
      const slip = await fetchSlipData(run);
      if (!slip) return;
      const html = generateSalarySlipHtml(slip);
      const newTab = window.open("", "_blank");
      if (newTab) {
        newTab.document.write(html);
        newTab.document.close();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to load salary slip.", variant: "destructive" });
    } finally {
      setLoadingMonthAction(null);
    }
  };

  const handleDownloadPDF = async (run: ApprovedRun) => {
    if (!user?.id) return;
    setLoadingMonthAction({ month: run.month, action: "pdf" });
    try {
      const res = await fetch(
        `/api/hr/salary-slips/pdf/${user.id}/${run.month}/${run.year}`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not generate PDF for this period.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Salary_Slip_${SLIP_MONTH_NAMES[run.month - 1]}_${run.year}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to download PDF.", variant: "destructive" });
    } finally {
      setLoadingMonthAction(null);
    }
  };

  const handleEmailSlip = async (run: ApprovedRun) => {
    if (!user?.id) return;
    setLoadingMonthAction({ month: run.month, action: "email" });
    try {
      const res = await fetch(
        `/api/hr/salary-slips/email-me/${run.month}/${run.year}`,
        { method: "POST", credentials: "include" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not send email.");
      }
      toast({
        title: "Email sent!",
        description: `Your salary slip for ${SLIP_MONTH_NAMES[run.month - 1]} ${run.year} has been sent to your registered email.`,
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to send email.", variant: "destructive" });
    } finally {
      setLoadingMonthAction(null);
    }
  };

  const isActing = (month: number, action: "view" | "pdf" | "email") =>
    loadingMonthAction?.month === month && loadingMonthAction?.action === action;
  const anyActing = (month: number) => loadingMonthAction?.month === month;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4" data-testid="text-salary-slips-title">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-tight">My Payslips</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            View, download, or email your salary slips — available once HR approves each month's payroll run
          </p>
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
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-48 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : months.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-1" data-testid="text-no-slips">No Payroll Data</h3>
            <p className="text-sm text-muted-foreground">
              No payroll months available for {selectedYear}.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {months.map((month) => {
            const run = approvedRunByMonth.get(month);
            const monthName = SLIP_MONTH_NAMES[month - 1];

            if (!run) {
              // Unavailable month — show clearly with explanatory copy
              return (
                <Card
                  key={month}
                  className="opacity-60"
                  data-testid={`card-month-unavailable-${month}`}
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-base text-muted-foreground">{monthName}</CardTitle>
                    <Badge variant="secondary" className="text-xs" data-testid={`badge-pending-${month}`}>
                      <Clock3 className="h-3 w-3 mr-1" />
                      Pending
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>Slip will appear here once HR approves this month's payroll run.</span>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            // Available month — show actions
            return (
              <Card key={month} data-testid={`card-run-${run.id}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-base">{monthName}</CardTitle>
                  <Badge variant="outline" className="border-green-500 text-green-600 dark:text-green-400 text-xs" data-testid={`badge-approved-${run.id}`}>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Approved
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{monthName} {run.year}</span>
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
                  </div>

                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleViewInTab(run)}
                      disabled={!!loadingMonthAction}
                      data-testid={`button-view-slip-${run.id}`}
                    >
                      {isActing(month, "view") ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Eye className="h-4 w-4 mr-2" />
                      )}
                      {isActing(month, "view") ? "Loading…" : "View in New Tab"}
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleDownloadPDF(run)}
                      disabled={!!loadingMonthAction}
                      data-testid={`button-download-pdf-${run.id}`}
                    >
                      {isActing(month, "pdf") ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      {isActing(month, "pdf") ? "Generating PDF…" : "Download PDF"}
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleEmailSlip(run)}
                      disabled={!!loadingMonthAction}
                      data-testid={`button-email-slip-${run.id}`}
                    >
                      {isActing(month, "email") ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4 mr-2" />
                      )}
                      {isActing(month, "email") ? "Sending…" : "Email to Me"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
