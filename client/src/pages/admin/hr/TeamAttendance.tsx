import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  designation: string | null;
  departmentId: string | null;
}

interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  punchIn: string | null;
  punchOut: string | null;
  totalHours: string | null;
  status: string;
  notes: string | null;
}

interface TeamAttendanceResponse {
  members: TeamMember[];
  attendance: AttendanceRecord[];
}

export default function TeamAttendance() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);

  const { data, isLoading } = useQuery<TeamAttendanceResponse>({
    queryKey: ["/api/hr/attendance/my-team", { date: selectedDate }],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const changeDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const formatTime = (ts: string | null) => {
    if (!ts) return "-";
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const statusColors: Record<string, string> = {
    present: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    absent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    half_day: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    late: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    on_leave: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    holiday: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    weekend: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  };

  const statusLabels: Record<string, string> = {
    present: "Present",
    absent: "Absent",
    half_day: "Half Day",
    late: "Late",
    on_leave: "On Leave",
    holiday: "Holiday",
    weekend: "Weekend",
  };

  const members = data?.members || [];
  const attendanceRecords = data?.attendance || [];

  const getMemberAttendance = (memberId: string) => {
    return attendanceRecords.find(a => a.userId === memberId);
  };

  const presentCount = members.filter(m => {
    const a = getMemberAttendance(m.id);
    return a && (a.status === "present" || a.status === "late" || a.status === "half_day");
  }).length;

  const absentCount = members.filter(m => {
    const a = getMemberAttendance(m.id);
    return !a || a.status === "absent";
  }).length;

  const onLeaveCount = members.filter(m => {
    const a = getMemberAttendance(m.id);
    return a && a.status === "on_leave";
  }).length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-team-attendance-title">Team Attendance</h1>
            <p className="text-muted-foreground">View your team's attendance records</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => changeDate(-1)} data-testid="button-prev-date">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border rounded-md px-3 py-1.5 text-sm bg-background"
              data-testid="input-date-picker"
            />
            <Button variant="outline" size="icon" onClick={() => changeDate(1)} data-testid="button-next-date">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}
              data-testid="button-today"
            >
              Today
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <span className="text-green-700 dark:text-green-300 font-bold">{presentCount}</span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Present</p>
                <p className="text-lg font-semibold" data-testid="text-present-count">{presentCount} / {members.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-red-100 dark:bg-red-900 flex items-center justify-center">
                <span className="text-red-700 dark:text-red-300 font-bold">{absentCount}</span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Absent</p>
                <p className="text-lg font-semibold" data-testid="text-absent-count">{absentCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <span className="text-blue-700 dark:text-blue-300 font-bold">{onLeaveCount}</span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">On Leave</p>
                <p className="text-lg font-semibold" data-testid="text-leave-count">{onLeaveCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Attendance for {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : members.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Employee</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Designation</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Punch In</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Punch Out</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Hours</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => {
                      const att = getMemberAttendance(member.id);
                      const status = att?.status || "absent";
                      return (
                        <tr key={member.id} className="border-b last:border-0" data-testid={`attendance-row-${member.id}`}>
                          <td className="py-2 px-2">
                            <div>
                              <p className="font-medium">{member.firstName} {member.lastName}</p>
                              <p className="text-xs text-muted-foreground">{member.email}</p>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-muted-foreground">{member.designation || "-"}</td>
                          <td className="py-2 px-2">{formatTime(att?.punchIn || null)}</td>
                          <td className="py-2 px-2">{formatTime(att?.punchOut || null)}</td>
                          <td className="py-2 px-2">{att?.totalHours ? `${parseFloat(att.totalHours).toFixed(1)}h` : "-"}</td>
                          <td className="py-2 px-2">
                            <Badge variant="secondary" className={statusColors[status] || ""}>
                              {statusLabels[status] || status}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No team members found</p>
                <p className="text-xs text-muted-foreground mt-1">Assign direct reports to see their attendance here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
