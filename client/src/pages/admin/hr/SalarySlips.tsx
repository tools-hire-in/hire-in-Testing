import { useState, useCallback, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Receipt, Download, Calendar, Loader2, CheckCircle2, FileText,
  Eye, Mail, Clock3, ChevronDown, ChevronUp, Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { generateSalarySlipHtml, SLIP_MONTH_NAMES, type SalarySlipData, type ComputationSnapshot } from "@shared/salarySlipHtml";
import { cn } from "@/lib/utils";

interface ApprovedRun {
  id: string;
  year: number;
  month: number;
  status: string;
  approvedAt: string | null;
  approverName?: string | null;
  /** Stored computation_snapshot from the salary_slips ledger row — present when the slip has already been rendered at least once */
  computationSnapshot?: ComputationSnapshot | null;
}

function fmtRs(paise: number) {
  return (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function deriveFormulaLabel(
  name: string,
  basisLabel: string | undefined,
  frozenRules?: Array<{ componentName: string; ruleType: string; valuePct?: number | null; valueFixed?: number | null; referenceComponent?: string | null }>,
  grossRupees?: number,
): string | undefined {
  if (basisLabel) return basisLabel;
  if (!frozenRules) return undefined;
  const r = frozenRules.find(r => r.componentName === name);
  if (!r) return undefined;
  if (r.ruleType === "percent_of_gross" && r.valuePct != null) {
    const pct = (r.valuePct / 100).toFixed(2);
    return grossRupees ? `${pct}% × ₹${grossRupees.toLocaleString("en-IN")} gross` : `${pct}% of Gross`;
  }
  if (r.ruleType === "percent_of_component" && r.valuePct != null && r.referenceComponent) {
    return `${(r.valuePct / 100).toFixed(2)}% of ${r.referenceComponent}`;
  }
  if (r.ruleType === "fixed" && r.valueFixed != null) {
    return `Fixed ₹${(r.valueFixed / 100).toLocaleString("en-IN")}/month`;
  }
  if (r.ruleType === "residual") return "Balance of Gross";
  return undefined;
}

function BreakdownPanel({ snap }: { snap: ComputationSnapshot }) {
  const components = snap.components ?? [];
  const statutory = snap.statutoryLines ?? [];
  const empLines = statutory.filter(l => !l.isEmployerContribution);
  const emplLines = statutory.filter(l => l.isEmployerContribution);
  const netPay = snap.waterfall?.netPayPaise ?? 0;
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = useCallback((key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  return (
    <div className="border-t pt-4 space-y-4 mt-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        <Info className="h-3.5 w-3.5" /> Show Your Work — click <span className="inline-flex items-center justify-center rounded-full border w-4 h-4 text-[10px] font-bold mx-0.5">?</span> per line to see the formula
      </p>

      {snap.lopDays != null && snap.workingDays != null && snap.lopDays > 0 && (
        <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          LOP applied: <strong>{snap.lopDays}</strong> day{snap.lopDays !== 1 ? "s" : ""} absent of {snap.workingDays} working days
          {snap.grossRupees != null && ` · Pre-LOP gross ₹${snap.grossRupees.toLocaleString("en-IN")}`}
        </div>
      )}

      {components.length > 0 ? (
        <div className="rounded-md border overflow-hidden text-xs">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Component</th>
                <th className="text-right py-2 px-3 font-medium text-muted-foreground">Amount</th>
                <th className="w-8 py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {components.map((c, i) => {
                const formula = deriveFormulaLabel(c.name, c.basisLabel, snap.frozenRules, snap.grossRupees);
                const rowKey = `comp-${i}`;
                const isExpanded = expandedRows.has(rowKey);
                return (
                  <Fragment key={rowKey}>
                    <tr className="border-b">
                      <td className="py-2 px-3">{c.name}</td>
                      <td className="py-2 px-3 text-right font-mono">₹ {fmtRs(c.postlopPaise)}</td>
                      <td className="py-2 px-2 text-center">
                        {(formula || c.prelopPaise !== c.postlopPaise) && (
                          <button
                            onClick={() => toggleRow(rowKey)}
                            className="inline-flex items-center justify-center rounded-full border border-muted-foreground/30 w-5 h-5 text-[10px] font-bold text-muted-foreground hover:bg-muted/50 transition-colors"
                            data-testid={`button-expand-comp-${i}`}
                            title="Show formula"
                          >?</button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b bg-muted/20">
                        <td colSpan={3} className="px-4 py-2 text-muted-foreground space-y-0.5">
                          {formula && (
                            <div>
                              <span className="font-medium text-foreground">Formula:</span>{" "}
                              {formula}{" "}
                              <span className="text-foreground font-semibold">= ₹ {fmtRs(c.prelopPaise)}</span>
                              {c.prelopPaise !== c.postlopPaise && <span className="text-amber-600 dark:text-amber-400"> (pre-LOP)</span>}
                            </div>
                          )}
                          {c.prelopPaise !== c.postlopPaise && (
                            <div><span className="font-medium text-foreground">After LOP:</span> ₹{fmtRs(c.prelopPaise)} → ₹{fmtRs(c.postlopPaise)}</div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              <tr className="bg-muted/30 font-semibold">
                <td className="py-2 px-3">Gross (after LOP)</td>
                <td className="py-2 px-3 text-right font-mono">₹ {fmtRs(snap.grossAfterLopPaise ?? 0)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No component breakdown available for this period.</p>
      )}

      {empLines.length > 0 && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deductions</p>
          <div className="rounded-md border overflow-hidden text-xs">
            <table className="w-full">
              <tbody>
                {empLines.map((l, i) => {
                  const rowKey = `ded-${i}`;
                  const isExpanded = expandedRows.has(rowKey);
                  return (
                    <Fragment key={rowKey}>
                      <tr className="border-b last:border-0">
                        <td className="py-2 px-3">{l.labelEn}</td>
                        <td className="py-2 px-3 text-right font-mono text-red-600 dark:text-red-400 whitespace-nowrap">− ₹ {fmtRs(l.amountPaise)}</td>
                        <td className="py-2 px-2 text-center">
                          {l.footnote && (
                            <button
                              onClick={() => toggleRow(rowKey)}
                              className="inline-flex items-center justify-center rounded-full border border-muted-foreground/30 w-5 h-5 text-[10px] font-bold text-muted-foreground hover:bg-muted/50 transition-colors"
                              data-testid={`button-expand-ded-${i}`}
                              title="Show detail"
                            >?</button>
                          )}
                        </td>
                      </tr>
                      {isExpanded && l.footnote && (
                        <tr className="border-b bg-muted/20">
                          <td colSpan={3} className="px-4 py-2 text-muted-foreground">
                            <span className="font-medium text-foreground">Basis:</span> {l.footnote}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                <tr className="bg-primary/5 font-semibold">
                  <td className="py-2 px-3">Net Payable</td>
                  <td className="py-2 px-3 text-right font-mono text-green-700 dark:text-green-400">₹ {fmtRs(netPay)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {emplLines.length > 0 && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Employer Contributions (Reference)</p>
          <div className="rounded-md border overflow-hidden text-xs">
            <table className="w-full">
              <tbody>
                {emplLines.map((l, i) => {
                  const rowKey = `empl-${i}`;
                  const isExpanded = expandedRows.has(rowKey);
                  return (
                    <Fragment key={rowKey}>
                      <tr className="border-b last:border-0">
                        <td className="py-2 px-3">{l.labelEn}</td>
                        <td className="py-2 px-3 text-right font-mono">₹ {fmtRs(l.amountPaise)}</td>
                        <td className="py-2 px-2 text-center">
                          {l.footnote && (
                            <button
                              onClick={() => toggleRow(rowKey)}
                              className="inline-flex items-center justify-center rounded-full border border-muted-foreground/30 w-5 h-5 text-[10px] font-bold text-muted-foreground hover:bg-muted/50 transition-colors"
                              data-testid={`button-expand-empl-${i}`}
                            >?</button>
                          )}
                        </td>
                      </tr>
                      {isExpanded && l.footnote && (
                        <tr className="border-b bg-muted/20">
                          <td colSpan={3} className="px-4 py-2 text-muted-foreground">
                            <span className="font-medium text-foreground">Basis:</span> {l.footnote}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {snap.lopDays == null && snap.grossRupees != null && (
        <p className="text-xs text-muted-foreground">
          Gross: ₹{snap.grossRupees.toLocaleString("en-IN")}
        </p>
      )}

      {snap.frozenRates && snap.frozenRates.length > 0 && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Statutory Rate Versions</p>
          <div className="rounded-md border overflow-hidden text-xs">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-1.5 px-3 font-medium text-muted-foreground">Levy</th>
                  <th className="text-right py-1.5 px-3 font-medium text-muted-foreground">Rate</th>
                  <th className="text-right py-1.5 px-3 font-medium text-muted-foreground">Effective from</th>
                </tr>
              </thead>
              <tbody>
                {snap.frozenRates.map((r, i) => (
                  <tr key={i} className="border-t" data-testid={`row-rate-${i}`}>
                    <td className="py-1.5 px-3">{r.levy} <span className="text-muted-foreground">({r.key})</span></td>
                    <td className="py-1.5 px-3 text-right font-mono">{(r.valueBps / 100).toFixed(2)}%</td>
                    <td className="py-1.5 px-3 text-right text-muted-foreground">eff. {r.effectiveFrom}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default function SalarySlips() {
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [loadingMonthAction, setLoadingMonthAction] = useState<{ month: number; action: "view" | "pdf" | "email" | "breakdown" } | null>(null);
  const [expandedBreakdowns, setExpandedBreakdowns] = useState<Set<string>>(new Set());
  const [breakdownData, setBreakdownData] = useState<Record<string, SalarySlipData | "error">>({});

  const { data: runs = [], isLoading } = useQuery<ApprovedRun[]>({
    queryKey: ["/api/hr/salary-slips/my-runs"],
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return null;

  const years: string[] = [];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    years.push(String(y));
  }

  const approvedRunByMonth = new Map<number, ApprovedRun>();
  for (const run of runs) {
    if (run.status === "approved" && String(run.year) === selectedYear) {
      const existing = approvedRunByMonth.get(run.month);
      if (!existing || (run.approvedAt && (!existing.approvedAt || run.approvedAt > existing.approvedAt))) {
        approvedRunByMonth.set(run.month, run);
      }
    }
  }

  const allMonths = Array.from({ length: 12 }, (_, i) => i + 1);
  const visibleMonths = Number(selectedYear) === currentYear
    ? allMonths.filter(m => m <= currentMonth)
    : allMonths;
  const months = [...visibleMonths].reverse();

  const fetchSlipData = async (run: ApprovedRun): Promise<SalarySlipData | null> => {
    if (!user?.id) return null;
    const res = await fetch(`/api/hr/salary-slips/render/${user.id}/${run.month}/${run.year}`, { credentials: "include" });
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
      const res = await fetch(`/api/hr/salary-slips/pdf/${user.id}/${run.month}/${run.year}`, { credentials: "include" });
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
      const res = await fetch(`/api/hr/salary-slips/email-me/${run.month}/${run.year}`, { method: "POST", credentials: "include" });
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

  const handleToggleBreakdown = async (run: ApprovedRun) => {
    const { month } = run;
    const key = `${run.year}-${month}`;
    if (expandedBreakdowns.has(key)) {
      setExpandedBreakdowns(prev => { const next = new Set(prev); next.delete(key); return next; });
      return;
    }
    // Already loaded in local state
    if (breakdownData[key]) {
      setExpandedBreakdowns(prev => new Set([...prev, key]));
      return;
    }
    // Use stored computation_snapshot from the run row (no extra API call needed)
    if (run.computationSnapshot) {
      setBreakdownData(prev => ({ ...prev, [key]: run.computationSnapshot as ComputationSnapshot }));
      setExpandedBreakdowns(prev => new Set([...prev, key]));
      return;
    }
    // Fallback: fetch via render endpoint (first access — slip not yet stored in ledger)
    setLoadingMonthAction({ month, action: "breakdown" });
    try {
      const slip = await fetchSlipData(run);
      if (slip) {
        setBreakdownData(prev => ({ ...prev, [key]: slip }));
        setExpandedBreakdowns(prev => new Set([...prev, key]));
      }
    } catch (err: any) {
      setBreakdownData(prev => ({ ...prev, [key]: "error" }));
      toast({ title: "Could not load breakdown", description: err.message, variant: "destructive" });
    } finally {
      setLoadingMonthAction(null);
    }
  };

  const isActing = (month: number, action: "view" | "pdf" | "email" | "breakdown") =>
    loadingMonthAction?.month === month && loadingMonthAction?.action === action;

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

            const bKey = `${run.year}-${month}`;
            const isExpanded = expandedBreakdowns.has(bKey);
            const slipData = breakdownData[bKey];
            // breakdownData[key] can be either:
            //   • a stored ComputationSnapshot directly (from run.computationSnapshot — has .components at top level)
            //   • a SalarySlipData object returned by the render endpoint (has .computationSnapshot nested)
            //   • "error"
            const snap: ComputationSnapshot | null = (() => {
              if (!slipData || slipData === "error") return null;
              const d = slipData as any;
              if (d.computationSnapshot) return d.computationSnapshot as ComputationSnapshot;
              if (Array.isArray(d.components)) return d as ComputationSnapshot;
              return null;
            })();

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
                            day: "numeric", month: "short", year: "numeric",
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

                    <Button
                      variant="ghost"
                      className="w-full text-xs text-muted-foreground"
                      onClick={() => handleToggleBreakdown(run)}
                      disabled={!!loadingMonthAction && !isActing(month, "breakdown")}
                      data-testid={`button-breakdown-${run.id}`}
                    >
                      {isActing(month, "breakdown") ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5 mr-1" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 mr-1" />
                      )}
                      {isActing(month, "breakdown") ? "Loading…" : isExpanded ? "Hide Breakdown" : "Show Breakdown"}
                    </Button>
                  </div>

                  {isExpanded && (
                    <div data-testid={`breakdown-panel-${run.id}`}>
                      {slipData === "error" ? (
                        <p className="text-xs text-destructive text-center py-2">Could not load breakdown.</p>
                      ) : snap ? (
                        <BreakdownPanel snap={snap} />
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-2 border-t mt-2 pt-3">
                          No itemized breakdown available for this period — it was processed before the payroll engine upgrade.
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
