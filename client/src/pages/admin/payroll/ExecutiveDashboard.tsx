import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Users,
  TrendingUp,
  TrendingDown,
  Download,
  IndianRupee,
  CalendarOff,
  ShieldCheck,
  Building2,
} from "lucide-react";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";

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

function inr(v: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);
}

function inrCompact(v: number) {
  if (v >= 10_00_000) return `₹${(v / 10_00_000).toFixed(1)}L`;
  if (v >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`;
  if (v >= 1_000) return `₹${(v / 1_000).toFixed(0)}K`;
  return `₹${v}`;
}

interface ExecSummary {
  year: number;
  month: number;
  employeeCount: number;
  totalGross: number;
  totalNet: number;
  totalDeductions: number;
  totalLopDays: number;
  totalAdvanceRecovery: number;
  statutory: {
    employeePf: number;
    employerPf: number;
    employeeEsi: number;
    employerEsi: number;
    professionalTax: number;
    totalEmployeeContributions: number;
    totalEmployerContributions: number;
  };
  departmentBreakdown: Array<{ deptName: string; gross: number; net: number; count: number }>;
}

interface TrendPoint {
  year: number;
  month: number;
  monthLabel: string;
  employeeCount: number;
  totalGross: number;
  totalNet: number;
  totalLopDays: number;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  testId,
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="pt-5">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-md bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold mt-0.5 truncate" data-testid={`${testId}-value`}>
              {value}
            </p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DeptTable({ rows }: { rows: ExecSummary["departmentBreakdown"] }) {
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No department data for this period.</p>;
  }
  const maxGross = Math.max(...rows.map(r => r.gross), 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground uppercase tracking-wide border-b">
            <th className="text-left py-2 pr-3 font-medium">Department</th>
            <th className="text-right py-2 px-3 font-medium">Employees</th>
            <th className="text-right py-2 px-3 font-medium">Gross</th>
            <th className="text-right py-2 pl-3 font-medium">Net</th>
            <th className="py-2 pl-3 w-24 hidden sm:table-cell"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.deptName + i} className="border-b last:border-0">
              <td className="py-2.5 pr-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium">{r.deptName}</span>
                </div>
              </td>
              <td className="py-2.5 px-3 text-right text-muted-foreground">{r.count}</td>
              <td className="py-2.5 px-3 text-right font-mono">{inr(r.gross)}</td>
              <td className="py-2.5 pl-3 text-right font-mono">{inr(r.net)}</td>
              <td className="py-2.5 pl-3 hidden sm:table-cell">
                <div className="h-2 bg-muted rounded-full overflow-hidden w-20">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.round((r.gross / maxGross) * 100)}%` }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrendChart({ data }: { data: TrendPoint[] }) {
  if (!data.length) {
    return <p className="text-sm text-muted-foreground text-center py-8">No trend data yet.</p>;
  }

  const chartData = data.map(d => ({
    name: d.monthLabel,
    Gross: Math.round(d.totalGross),
    Net: Math.round(d.totalNet),
    Employees: d.employeeCount,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis
          yAxisId="amount"
          tickFormatter={inrCompact}
          tick={{ fontSize: 11 }}
          width={52}
        />
        <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 11 }} width={30} />
        <RechartTooltip
          formatter={(value: any, name: string) =>
            name === "Employees" ? [value, name] : [inr(value as number), name]
          }
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="amount" dataKey="Gross" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} opacity={0.7} />
        <Bar yAxisId="amount" dataKey="Net" fill="hsl(216 85% 50%)" radius={[3, 3, 0, 0]} />
        <Bar yAxisId="count" dataKey="Employees" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} opacity={0.4} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function StatutoryRow({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-2 gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm">{label}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <p className="font-mono text-sm font-medium shrink-0">{inr(value)}</p>
    </div>
  );
}

function handleDownload(year: string, month: string) {
  const url = `/api/hr/payroll-runs/${year}/${month}/statutory-export`;
  const a = document.createElement("a");
  a.href = url;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function ExecutiveDashboard() {
  const { enabled: newLook } = useNewLook();
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState(String(currentMonth));

  const summaryQuery = useQuery<ExecSummary>({
    queryKey: ["/api/hr/payroll-runs/executive-summary", year, month],
    queryFn: async () => {
      const res = await fetch(
        `/api/hr/payroll-runs/executive-summary?year=${year}&month=${month}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to load summary");
      return res.json();
    },
    staleTime: 60_000,
  });

  const trendQuery = useQuery<TrendPoint[]>({
    queryKey: ["/api/hr/payroll-runs/trend"],
    queryFn: async () => {
      const res = await fetch("/api/hr/payroll-runs/trend", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load trend");
      return res.json();
    },
    staleTime: 60_000,
  });

  const s = summaryQuery.data;
  const monthLabel = MONTHS.find(m => m.value === month)?.label ?? month;
  const hasData = s && s.employeeCount > 0;

  const LopImpact = s
    ? (() => {
        const dailyRate = s.totalGross / s.employeeCount / 26 || 0;
        return s.totalLopDays * dailyRate;
      })()
    : 0;

  return (
    <AdminLayout>
      <div className="space-y-6 v2-surface">
        {newLook ? (
          <V2PageHeader
            icon={TrendingUp}
            eyebrow="Payroll"
            title="Payroll Executive Dashboard"
            subtitle="Month-level payroll analytics, statutory totals, and cost breakdown."
            testId="text-exec-dashboard-title"
            actions={
              <Button
                variant="outline"
                onClick={() => handleDownload(year, month)}
                disabled={!hasData}
                data-testid="button-statutory-export"
                className="gap-2 shrink-0 bg-white/10 border-white/30 text-white hover:bg-white/20"
              >
                <Download className="h-4 w-4" />
                Export Statutory CSV
              </Button>
            }
          />
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-exec-dashboard-title">
                Payroll Executive Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">
                Month-level payroll analytics, statutory totals, and cost breakdown.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => handleDownload(year, month)}
              disabled={!hasData}
              data-testid="button-statutory-export"
              className="gap-2 shrink-0"
            >
              <Download className="h-4 w-4" />
              Export Statutory CSV
            </Button>
          </div>
        )}

        {/* Period selector */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Month</p>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-36" data-testid="select-exec-month">
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
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-28" data-testid="select-exec-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {s && (
            <Badge variant="outline" className="mb-0.5 text-muted-foreground" data-testid="badge-period">
              {monthLabel} {year} — {s.employeeCount} employee{s.employeeCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        {summaryQuery.isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i}>
                <CardContent className="pt-5">
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !hasData ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No salary slips found for {monthLabel} {year}. Generate a payroll run first.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KpiCard
                icon={Users}
                label="Employees Paid"
                value={String(s.employeeCount)}
                testId="card-kpi-employees"
              />
              <KpiCard
                icon={IndianRupee}
                label="Total Gross"
                value={inr(s.totalGross)}
                sub={`Net: ${inr(s.totalNet)}`}
                testId="card-kpi-gross"
              />
              <KpiCard
                icon={CalendarOff}
                label="LOP Days"
                value={s.totalLopDays.toFixed(1)}
                sub={`Impact: ~${inr(LopImpact)}`}
                testId="card-kpi-lop"
              />
              <KpiCard
                icon={TrendingDown}
                label="Total Deductions"
                value={inr(s.totalDeductions)}
                sub={`Advance recovery: ${inr(s.totalAdvanceRecovery)}`}
                testId="card-kpi-deductions"
              />
            </div>

            {/* Charts + Department breakdown */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Trend chart */}
              <Card data-testid="card-trend-chart">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    6-Month Payroll Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {trendQuery.isLoading ? (
                    <Skeleton className="h-60 w-full" />
                  ) : (
                    <TrendChart data={trendQuery.data ?? []} />
                  )}
                </CardContent>
              </Card>

              {/* Department cost split */}
              <Card data-testid="card-dept-breakdown">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Department Cost Split
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DeptTable rows={s.departmentBreakdown} />
                </CardContent>
              </Card>
            </div>

            {/* LOP Impact breakdown */}
            <Card data-testid="card-lop-impact">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarOff className="h-4 w-4" />
                  LOP Impact Summary — {monthLabel} {year}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Total LOP Days</p>
                    <p className="text-2xl font-bold" data-testid="text-lop-days">{s.totalLopDays.toFixed(1)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Estimated Salary Lost</p>
                    <p className="text-2xl font-bold text-destructive" data-testid="text-lop-impact">{inr(LopImpact)}</p>
                    <p className="text-xs text-muted-foreground">Based on avg daily rate = Gross ÷ 26</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Advance Recovery</p>
                    <p className="text-2xl font-bold" data-testid="text-advance-recovery">{inr(s.totalAdvanceRecovery)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Statutory totals */}
            <Card data-testid="card-statutory-totals">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Statutory Totals — {monthLabel} {year}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-x-12">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Employee Contributions</p>
                    <StatutoryRow label="EPF (12%)" value={s.statutory.employeePf} sub="Employee provident fund" />
                    <Separator />
                    <StatutoryRow label="ESI (0.75%)" value={s.statutory.employeeEsi} sub="Employee state insurance" />
                    <Separator />
                    <StatutoryRow label="Professional Tax" value={s.statutory.professionalTax} sub="State-wise slab deduction" />
                    <Separator />
                    <StatutoryRow
                      label="Total Employee Contributions"
                      value={s.statutory.totalEmployeeContributions}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Employer Contributions (CTC)</p>
                    <StatutoryRow label="Employer EPF + EPS" value={s.statutory.employerPf} sub="3.67% EPF + 8.33% EPS" />
                    <Separator />
                    <StatutoryRow label="Employer ESI (3.25%)" value={s.statutory.employerEsi} sub="Employer state insurance" />
                    <Separator />
                    <StatutoryRow
                      label="Total Employer Contributions"
                      value={s.statutory.totalEmployerContributions}
                    />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(year, month)}
                    data-testid="button-statutory-export-bottom"
                    className="gap-2"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download Statutory CSV
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
