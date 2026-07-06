import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentComplianceContent } from "@/pages/admin/hr/DocumentCompliance";
import { PolicyComplianceContent } from "@/pages/admin/hr/PolicyCompliance";
import { SalaryReportsContent } from "@/pages/admin/hr/SalaryReports";
import { Users, ShieldCheck, BarChart3, Search, Building2, TrendingUp, CalendarDays, CheckCircle2, Clock, AlertTriangle, Download } from "lucide-react";

interface EmployeeRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  departmentId?: string | null;
  designation?: string | null;
  isActive: boolean;
}

function PeopleTab() {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [downloading, setDownloading] = useState(false);

  const handleExportCsv = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/hr/admin/users/export-csv", { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match ? match[1] : "employee-directory.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  const { data: employees = [], isLoading } = useQuery<EmployeeRow[]>({
    queryKey: ["/api/hr/users"],
  });

  const { data: departments = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/departments"],
  });

  const deptMap = new Map(departments.map((d) => [d.id, d.name]));

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    const deptName = deptMap.get(e.departmentId || "") || "";
    const matchSearch =
      !q ||
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
      (e.email || "").toLowerCase().includes(q) ||
      deptName.toLowerCase().includes(q);
    const matchDept = deptFilter === "all" || e.departmentId === deptFilter;
    return matchSearch && matchDept;
  });

  const active = employees.filter((e) => e.isActive).length;
  const inactive = employees.filter((e) => !e.isActive).length;

  const ROLE_COLORS: Record<string, string> = {
    super_admin: "bg-primary text-primary-foreground",
    admin: "bg-blue-500 text-white",
    hr: "bg-green-500 text-white",
    finance: "bg-amber-500 text-white",
    operations: "bg-orange-500 text-white",
    manager: "bg-purple-500 text-white",
    recruiter: "bg-cyan-500 text-white",
    employee: "bg-gray-400 text-white",
    executive: "bg-teal-600 text-white",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card data-testid="card-total-employees">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{isLoading ? "—" : employees.length}</p>
                <p className="text-xs text-muted-foreground">Total Employees</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-active-employees">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-green-600">{isLoading ? "—" : active}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-departments">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{isLoading ? "—" : departments.length}</p>
                <p className="text-xs text-muted-foreground">Departments</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-base flex-1">Employee Directory</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search…"
                  className="pl-8 h-8 w-48"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="input-search-employees"
                />
              </div>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="h-8 w-40" data-testid="select-department-filter">
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={handleExportCsv}
                disabled={downloading || isLoading}
                data-testid="button-export-csv"
              >
                <Download className="h-3.5 w-3.5" />
                {downloading ? "Downloading…" : "Download CSV"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No employees match your filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Designation</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Department</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Role</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((emp, idx) => (
                    <tr key={emp.id} className="border-b last:border-0 hover:bg-muted/30" data-testid={`row-emp-${idx}`}>
                      <td className="px-4 py-2.5">
                        <span className="font-medium" data-testid={`text-emp-name-${emp.id}`}>
                          {emp.firstName} {emp.lastName}
                        </span>
                        <p className="text-xs text-muted-foreground">{emp.email}</p>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground" data-testid={`text-emp-designation-${emp.id}`}>
                        {emp.designation || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground" data-testid={`text-emp-dept-${emp.id}`}>
                        {deptMap.get(emp.departmentId || "") || "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${ROLE_COLORS[emp.role] || "bg-gray-400 text-white"}`}>
                          {emp.role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant={emp.isActive ? "default" : "secondary"}
                          className="text-[10px]"
                          data-testid={`badge-emp-status-${emp.id}`}
                        >
                          {emp.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const MONTHS = [
  { value: "1", label: "January" }, { value: "2", label: "February" },
  { value: "3", label: "March" }, { value: "4", label: "April" },
  { value: "5", label: "May" }, { value: "6", label: "June" },
  { value: "7", label: "July" }, { value: "8", label: "August" },
  { value: "9", label: "September" }, { value: "10", label: "October" },
  { value: "11", label: "November" }, { value: "12", label: "December" },
];

interface OversightGroup {
  managerId: string | null;
  managerName: string;
  approvalStatus: string | null;
  members: { userId: string; firstName: string; lastName: string; employeeId?: string }[];
  totals: { count: number; present: number; lop: number };
}

interface OversightResponse {
  exists: boolean;
  runId?: string;
  month?: number;
  year?: number;
  status?: string;
  groups?: OversightGroup[];
  summary?: { employees: number; managers: number; approved: number; pending: number; overridden: number };
}

function AttendanceTab() {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));

  const years = Array.from({ length: 3 }, (_, i) => String(now.getFullYear() - i));

  const { data, isLoading } = useQuery<OversightResponse>({
    queryKey: ["/api/hr/attendance-report/oversight", { month, year }],
    queryFn: () =>
      fetch(`/api/hr/attendance-report/oversight?month=${month}&year=${year}`, { credentials: "include" })
        .then((r) => r.json()),
  });

  function handleExportCSV() {
    if (!data?.exists || !data.groups) return;
    const monthLabel = MONTHS.find((m) => m.value === month)?.label ?? month;
    const rows = [["Manager", "Team Size", "Avg Present Days", "Total LOP Days", "Approval Status", "Month", "Year"]];
    for (const g of data.groups) {
      rows.push([
        g.managerName,
        String(g.totals.count),
        g.totals.count > 0 ? (g.totals.present / g.totals.count).toFixed(1) : "0",
        String(g.totals.lop),
        g.approvalStatus ?? "pending",
        monthLabel,
        year,
      ]);
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${monthLabel.toLowerCase()}-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const statusBadge = (s: string | null | undefined) => {
    if (s === "approved") return <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
    if (s === "overridden") return <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Overridden</Badge>;
    return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Month</label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-36 h-8" data-testid="select-att-month"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Year</label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-24 h-8" data-testid="select-att-year"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={!data?.exists}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
          data-testid="button-export-attendance-csv"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : !data?.exists ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p>No attendance run found for {MONTHS.find((m) => m.value === month)?.label} {year}.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {data.summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card data-testid="card-att-employees">
                <CardContent className="pt-4 pb-3">
                  <p className="text-2xl font-bold">{data.summary.employees}</p>
                  <p className="text-xs text-muted-foreground">Employees</p>
                </CardContent>
              </Card>
              <Card data-testid="card-att-managers">
                <CardContent className="pt-4 pb-3">
                  <p className="text-2xl font-bold">{data.summary.managers}</p>
                  <p className="text-xs text-muted-foreground">Managers</p>
                </CardContent>
              </Card>
              <Card data-testid="card-att-approved">
                <CardContent className="pt-4 pb-3">
                  <p className="text-2xl font-bold text-green-600">{data.summary.approved}</p>
                  <p className="text-xs text-muted-foreground">Approved</p>
                </CardContent>
              </Card>
              <Card data-testid="card-att-pending">
                <CardContent className="pt-4 pb-3">
                  <p className="text-2xl font-bold text-amber-600">{data.summary.pending}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Manager Approval Status</CardTitle>
                <Badge variant="outline" className="text-xs capitalize">{data.status?.replace(/_/g, " ")}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Manager</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Team Size</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Avg Present</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Total LOP</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Approval</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.groups || []).map((g, idx) => (
                      <tr key={g.managerId || idx} className="border-b last:border-0 hover:bg-muted/30" data-testid={`row-att-manager-${idx}`}>
                        <td className="px-4 py-2.5 font-medium">{g.managerName}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{g.totals.count}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">
                          {g.totals.count > 0 ? (g.totals.present / g.totals.count).toFixed(1) : "—"}d
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{g.totals.lop}d</td>
                        <td className="px-4 py-2.5 text-right">{statusBadge(g.approvalStatus)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function ExecCockpit() {
  const [tab, setTab] = useState("people");

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-cockpit-title">Executive Cockpit</h1>
          <p className="text-muted-foreground mt-1">Read-only view of workforce compliance and payroll data</p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="people" className="flex items-center gap-1.5" data-testid="tab-people">
              <Users className="h-4 w-4" />
              People
            </TabsTrigger>
            <TabsTrigger value="compliance" className="flex items-center gap-1.5" data-testid="tab-compliance">
              <ShieldCheck className="h-4 w-4" />
              Compliance
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex items-center gap-1.5" data-testid="tab-attendance">
              <CalendarDays className="h-4 w-4" />
              Attendance
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-1.5" data-testid="tab-reports">
              <BarChart3 className="h-4 w-4" />
              Salary Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="people" data-testid="panel-people">
            <PeopleTab />
          </TabsContent>

          <TabsContent value="compliance" data-testid="panel-compliance">
            <div className="space-y-8">
              <section>
                <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Document Compliance
                </h2>
                <DocumentComplianceContent readOnly />
              </section>
              <section>
                <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Policy Compliance
                </h2>
                <PolicyComplianceContent readOnly />
              </section>
            </div>
          </TabsContent>

          <TabsContent value="attendance" data-testid="panel-attendance">
            <AttendanceTab />
          </TabsContent>

          <TabsContent value="reports" data-testid="panel-reports">
            <SalaryReportsContent readOnly />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
