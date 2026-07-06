import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Eye, Users } from "lucide-react";

interface OversightMember {
  entryId: string;
  userId: string;
  firstName: string;
  lastName: string;
  employeeId: string | null;
  designation: string | null;
  presentDays: number;
  absentDays: number;
  lopDays: number;
  leaveDays: number;
  holidayDays: number;
  totalHours: number;
}

interface OversightGroup {
  managerId: string | null;
  managerName: string;
  managerEmail: string | null;
  designation: string | null;
  approvalStatus: string | null;
  isSelf: boolean;
  members: OversightMember[];
  totals: { count: number; present: number; lop: number };
}

interface OversightData {
  exists: boolean;
  runId?: string;
  month?: number;
  year?: number;
  status?: string;
  scope?: "full" | "downstream";
  groups?: OversightGroup[];
  summary?: {
    employees: number;
    managers: number;
    approved: number;
    pending: number;
    editsSubmitted: number;
    overridden: number;
  };
}

function approvalBadge(status: string | null) {
  if (status === "approved") return <Badge className="bg-green-100 text-green-700">Approved</Badge>;
  if (status === "edits_submitted") return <Badge className="bg-orange-100 text-orange-700">Correction Submitted</Badge>;
  if (status === "overridden") return <Badge className="bg-blue-100 text-blue-700">Overridden</Badge>;
  if (status === "pending") return <Badge variant="secondary">Pending</Badge>;
  return <Badge variant="outline">No approver</Badge>;
}

interface Props {
  month: number;
  year: number;
  /**
   * "manager": senior-manager oversight (hidden entirely when the requester has
   * no sub-teams below them). "hr": full rollup, always shown when a run exists.
   */
  variant: "manager" | "hr";
}

export default function AttendanceOversight({ month, year, variant }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<OversightData>({
    queryKey: ["/api/hr/attendance-report/oversight", month, year],
    queryFn: () =>
      fetch(`/api/hr/attendance-report/oversight?month=${month}&year=${year}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!month && !!year,
    refetchInterval: 60_000,
  });

  if (isLoading || !data?.exists) return null;

  const groups = data.groups || [];
  const hasSubTeams = groups.some(g => !g.isSelf);

  // Manager oversight is only meaningful for a senior manager (someone with
  // sub-teams below them). A leaf manager already sees/approves their team on the
  // main approval list, so don't duplicate it here.
  if (variant === "manager" && !hasSubTeams) return null;
  if (groups.length === 0) return null;

  const toggle = (key: string) => {
    setExpanded(prev => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key);
      else s.add(key);
      return s;
    });
  };

  const s = data.summary!;
  const title = variant === "hr" ? "Approval Rollup — All Teams" : "Team Oversight (Read-Only)";
  const subtitle =
    variant === "hr"
      ? "Per-manager approval status for this run. Approval stays with each direct manager."
      : "Everyone who rolls up to you, grouped by their approving manager. View-only — each manager approves their own team.";

  return (
    <Card data-testid="section-attendance-oversight">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-start gap-2">
            <Eye className="mt-0.5 text-muted-foreground" size={18} />
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-2 text-xs">
          <Badge variant="outline" data-testid="badge-oversight-employees">{s.employees} employees</Badge>
          <Badge variant="outline" data-testid="badge-oversight-managers">{s.managers} managers</Badge>
          {s.approved > 0 && <Badge className="bg-green-100 text-green-700">{s.approved} approved</Badge>}
          {s.pending > 0 && <Badge variant="secondary">{s.pending} pending</Badge>}
          {s.editsSubmitted > 0 && <Badge className="bg-orange-100 text-orange-700">{s.editsSubmitted} with corrections</Badge>}
          {s.overridden > 0 && <Badge className="bg-blue-100 text-blue-700">{s.overridden} overridden</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {groups.map(g => {
          const key = g.managerId || "__unassigned__";
          const isOpen = expanded.has(key);
          return (
            <div key={key} className="border rounded-lg" data-testid={`oversight-group-${g.managerId || "unassigned"}`}>
              <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/40"
                onClick={() => toggle(key)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users size={14} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      {g.managerName}
                      {g.isSelf && <Badge variant="outline" className="text-[10px] px-1.5 py-0">You</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {g.totals.count} member{g.totals.count === 1 ? "" : "s"}
                      {g.designation ? ` · ${g.designation}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {approvalBadge(g.approvalStatus)}
                  {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </div>
              {isOpen && (
                <div className="border-t px-3 py-2 bg-muted/20 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground text-left">
                        <th className="py-1 pr-3 font-medium">Employee</th>
                        <th className="py-1 px-2 font-medium text-right">Present</th>
                        <th className="py-1 px-2 font-medium text-right">Absent</th>
                        <th className="py-1 px-2 font-medium text-right">LOP</th>
                        <th className="py-1 px-2 font-medium text-right">Leave</th>
                        <th className="py-1 px-2 font-medium text-right">Holiday</th>
                        <th className="py-1 pl-2 font-medium text-right">Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.members.map(m => (
                        <tr key={m.entryId} className="border-t border-border/50" data-testid={`oversight-member-${m.userId}`}>
                          <td className="py-1.5 pr-3">
                            <span className="font-medium">{m.firstName} {m.lastName}</span>
                            <span className="text-muted-foreground"> · {m.employeeId || "—"}</span>
                          </td>
                          <td className="py-1.5 px-2 text-right">{m.presentDays.toFixed(1)}</td>
                          <td className="py-1.5 px-2 text-right">{m.absentDays.toFixed(1)}</td>
                          <td className={`py-1.5 px-2 text-right ${m.lopDays > 0 ? "text-red-600 font-medium" : ""}`}>{m.lopDays.toFixed(1)}</td>
                          <td className="py-1.5 px-2 text-right">{m.leaveDays.toFixed(1)}</td>
                          <td className="py-1.5 px-2 text-right">{m.holidayDays.toFixed(1)}</td>
                          <td className="py-1.5 pl-2 text-right">{m.totalHours.toFixed(1)}</td>
                        </tr>
                      ))}
                      {g.members.length === 0 && (
                        <tr><td colSpan={7} className="py-2 text-center text-muted-foreground">No members</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
