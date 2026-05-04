import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Clock, ChevronLeft, ChevronRight, Download, X, ArrowLeft, Coffee, UtensilsCrossed } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  designation: string | null;
  departmentId: string | null;
  shiftName: string | null;
  expectedStart: string | null;
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

interface MemberAttendanceResponse {
  member: TeamMember | null;
  attendance: AttendanceRecord[];
}

interface TeamBreakStatus {
  [userId: string]: {
    activeBreak: { breakType: "lunch" | "tea"; startedAt: string } | null;
    totalMinutes: number;
  };
}

const statusColors: Record<string, string> = {
  present: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  absent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  on_lunch: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  on_tea: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  half_day: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  late: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  on_leave: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  holiday: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  weekend: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

const statusDotColors: Record<string, string> = {
  present: "bg-green-500",
  absent: "bg-red-500",
  half_day: "bg-yellow-500",
  late: "bg-orange-500",
  on_leave: "bg-blue-500",
  holiday: "bg-purple-500",
  weekend: "bg-gray-400",
};

const statusLabels: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  half_day: "Half Day",
  late: "Late",
  on_leave: "On Leave",
  holiday: "Holiday",
  weekend: "Weekend",
  on_lunch: "On Lunch",
  on_tea: "Tea Break",
};

export default function TeamAttendance() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [memberMonth, setMemberMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [downloadMonth, setDownloadMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [showDownload, setShowDownload] = useState(false);

  const { data, isLoading } = useQuery<TeamAttendanceResponse>({
    queryKey: ["/api/hr/attendance/my-team", { date: selectedDate }],
    enabled: isAuthenticated,
  });

  const isToday = selectedDate === new Date().toISOString().split("T")[0];

  const { data: teamBreakStatus } = useQuery<TeamBreakStatus>({
    queryKey: ["/api/hr/attendance/breaks/team-status"],
    enabled: isAuthenticated && isToday,
    refetchInterval: 30000,
  });

  const [mYear, mMonth] = memberMonth.split("-").map(Number);
  const mLastDay = new Date(mYear, mMonth, 0).getDate();
  const memberStartDate = `${memberMonth}-01`;
  const memberEndDate = `${memberMonth}-${mLastDay}`;

  const { data: memberData, isLoading: memberLoading } = useQuery<MemberAttendanceResponse>({
    queryKey: ["/api/hr/attendance/member", selectedMember?.id, "range", { startDate: memberStartDate, endDate: memberEndDate }],
    queryFn: async () => {
      const res = await fetch(`/api/hr/attendance/member/${selectedMember!.id}/range?startDate=${memberStartDate}&endDate=${memberEndDate}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: isAuthenticated && !!selectedMember,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const canDownload = user && ["super_admin", "admin", "hr", "manager", "operations"].includes(user.role);

  const changeDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const formatTime = (ts: string | null) => {
    if (!ts) return "-";
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDuration = (hours: string | null) => {
    if (!hours) return "-";
    const h = parseFloat(hours);
    const wholeHours = Math.floor(h);
    const minutes = Math.round((h - wholeHours) * 60);
    if (wholeHours === 0 && minutes === 0) return "-";
    if (wholeHours === 0) return `${minutes}m`;
    if (minutes === 0) return `${wholeHours}h`;
    return `${wholeHours}h ${minutes}m`;
  };

  const getEffectiveStatus = (att: AttendanceRecord | undefined, userId?: string) => {
    if (!att) return "absent";
    if (att.status === "on_leave" || att.status === "holiday") return att.status;
    if (att.punchIn && att.punchOut && att.totalHours) {
      const hours = parseFloat(att.totalHours);
      return hours >= 8 ? "present" : "absent";
    }
    if (att.punchIn && !att.punchOut) {
      // Check if on break
      if (userId && teamBreakStatus?.[userId]?.activeBreak) {
        const breakType = teamBreakStatus[userId].activeBreak!.breakType;
        return breakType === "lunch" ? "on_lunch" : "on_tea";
      }
      return "working";
    }
    return att.status || "absent";
  };

  const todayStr = new Date().toISOString().split("T")[0];

  const members = data?.members || [];
  const attendanceRecords = data?.attendance || [];
  const getMemberAttendance = (id: string) => attendanceRecords.find(a => a.userId === id);

  const presentCount = members.filter(m => {
    const eff = getEffectiveStatus(getMemberAttendance(m.id), m.id);
    return eff === "present" || eff === "working" || eff === "on_lunch" || eff === "on_tea";
  }).length;
  const absentCount = members.filter(m => {
    const eff = getEffectiveStatus(getMemberAttendance(m.id), m.id);
    return eff === "absent";
  }).length;
  const onLeaveCount = members.filter(m => {
    const eff = getEffectiveStatus(getMemberAttendance(m.id), m.id);
    return eff === "on_leave";
  }).length;
  const onBreakCount = members.filter(m => {
    const eff = getEffectiveStatus(getMemberAttendance(m.id), m.id);
    return eff === "on_lunch" || eff === "on_tea";
  }).length;

  const handleDownload = () => {
    const [dy, dm] = downloadMonth.split("-").map(Number);
    const dlDay = new Date(dy, dm, 0).getDate();
    const ds = `${downloadMonth}-01`;
    const de = `${downloadMonth}-${dlDay}`;
    window.open(`/api/hr/attendance/download?startDate=${ds}&endDate=${de}`, "_blank");
    setShowDownload(false);
  };

  const handleMemberClick = (member: TeamMember) => {
    setSelectedMember(member);
    setMemberMonth(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-team-attendance-title">Team Attendance</h1>
            <p className="text-muted-foreground">View your team's attendance records</p>
          </div>
          <div className="flex items-center gap-2">
            {canDownload && (
              <Button variant="outline" size="sm" onClick={() => setShowDownload(true)} data-testid="button-download-report">
                <Download className="h-4 w-4 mr-1" />
                Download Report
              </Button>
            )}
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
            <Button variant="outline" size="sm" onClick={() => setSelectedDate(todayStr)} data-testid="button-today">
              Today
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                <span className="text-green-700 dark:text-green-300 font-bold">{presentCount}</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Present</p>
                <p className="text-base font-semibold" data-testid="text-present-count">{presentCount} / {members.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-red-100 dark:bg-red-900 flex items-center justify-center shrink-0">
                <span className="text-red-700 dark:text-red-300 font-bold">{absentCount}</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Absent</p>
                <p className="text-base font-semibold" data-testid="text-absent-count">{absentCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
                <span className="text-blue-700 dark:text-blue-300 font-bold">{onLeaveCount}</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">On Leave</p>
                <p className="text-base font-semibold" data-testid="text-leave-count">{onLeaveCount}</p>
              </div>
            </CardContent>
          </Card>
          {isToday && (
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-md bg-amber-100 dark:bg-amber-900 flex items-center justify-center shrink-0">
                  <span className="text-amber-700 dark:text-amber-300 font-bold">{onBreakCount}</span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">On Break</p>
                  <p className="text-base font-semibold" data-testid="text-break-count">{onBreakCount}</p>
                </div>
              </CardContent>
            </Card>
          )}
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
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Shift</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Punch In</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Punch Out</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Duration</th>
                      {isToday && <th className="text-left py-3 px-2 font-medium text-muted-foreground">Break</th>}
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => {
                      const att = getMemberAttendance(member.id);
                      const effectiveStatus = getEffectiveStatus(att, member.id);
                      const isWorking = effectiveStatus === "working" || effectiveStatus === "on_lunch" || effectiveStatus === "on_tea";
                      return (
                        <tr
                          key={member.id}
                          className="border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleMemberClick(member)}
                          data-testid={`attendance-row-${member.id}`}
                        >
                          <td className="py-2 px-2">
                            <div>
                              <p className="font-medium text-primary hover:underline">{member.firstName} {member.lastName}</p>
                              <p className="text-xs text-muted-foreground">{member.email}</p>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-muted-foreground">{member.designation || "-"}</td>
                          <td className="py-2 px-2">
                            {member.shiftName ? (
                              <div>
                                <span className="text-xs font-medium" data-testid={`text-shift-name-${member.id}`}>{member.shiftName}</span>
                                {member.expectedStart && (
                                  <p className="text-xs text-muted-foreground">{member.expectedStart.slice(0, 5)}</p>
                                )}
                              </div>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                          <td className="py-2 px-2">
                            {att?.punchIn ? (
                              <span className="text-green-600 dark:text-green-400 font-medium">{formatTime(att.punchIn)}</span>
                            ) : "-"}
                          </td>
                          <td className="py-2 px-2">
                            {att?.punchOut ? (
                              <span className="text-orange-600 dark:text-orange-400 font-medium">{formatTime(att.punchOut)}</span>
                            ) : isWorking ? (
                              <span className="text-xs text-muted-foreground italic">Working...</span>
                            ) : "-"}
                          </td>
                          <td className="py-2 px-2">
                            {att?.totalHours ? (
                              <span className="font-medium">{formatDuration(att.totalHours)}</span>
                            ) : "-"}
                          </td>
                          {isToday && (
                            <td className="py-2 px-2">
                              {(() => {
                                const memberBreak = teamBreakStatus?.[member.id];
                                if (!memberBreak) return <span className="text-muted-foreground text-xs">—</span>;
                                const activeBreak = memberBreak.activeBreak;
                                const totalMin = memberBreak.totalMinutes;
                                if (activeBreak) {
                                  const elapsedMin = Math.floor((Date.now() - new Date(activeBreak.startedAt).getTime()) / 60000);
                                  return (
                                    <div className="flex flex-col">
                                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">{elapsedMin}m active</span>
                                      {totalMin > 0 && <span className="text-xs text-muted-foreground">{Math.round(totalMin)}m total</span>}
                                    </div>
                                  );
                                }
                                if (totalMin > 0) return <span className="text-xs text-muted-foreground">{Math.round(totalMin)}m taken</span>;
                                return <span className="text-muted-foreground text-xs">—</span>;
                              })()}
                            </td>
                          )}
                          <td className="py-2 px-2">
                            <div className="space-y-1">
                              <Badge variant="secondary" className={statusColors[effectiveStatus === "working" ? "present" : effectiveStatus] || ""}>
                                {effectiveStatus === "working" && "Working"}
                                {effectiveStatus === "on_lunch" && <span className="flex items-center gap-1"><UtensilsCrossed className="h-3 w-3" /> On Lunch</span>}
                                {effectiveStatus === "on_tea" && <span className="flex items-center gap-1"><Coffee className="h-3 w-3" /> Tea Break</span>}
                                {effectiveStatus !== "working" && effectiveStatus !== "on_lunch" && effectiveStatus !== "on_tea" && (statusLabels[effectiveStatus] || effectiveStatus)}
                              </Badge>
                              {isToday && effectiveStatus === "absent" && member.expectedStart && !att?.punchIn && (() => {
                                const [h, m] = member.expectedStart.split(":").map(Number);
                                const expectedMins = h * 60 + m;
                                const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
                                if (nowMins > expectedMins) {
                                  const hr12 = h % 12 || 12;
                                  const period = h >= 12 ? "PM" : "AM";
                                  return (
                                    <p className="text-xs text-amber-600 dark:text-amber-400" data-testid={`text-expected-at-${member.id}`}>
                                      Expected at {hr12}:{String(m).padStart(2,"0")} {period}
                                    </p>
                                  );
                                }
                                return null;
                              })()}
                            </div>
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

      <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-member-calendar">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{selectedMember?.firstName} {selectedMember?.lastName} - Monthly Attendance</span>
            </DialogTitle>
          </DialogHeader>
          {selectedMember && (
            <MemberMonthlyCalendar
              records={memberData?.attendance || []}
              isLoading={memberLoading}
              month={memberMonth}
              onMonthChange={setMemberMonth}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showDownload} onOpenChange={setShowDownload}>
        <DialogContent className="sm:max-w-sm" data-testid="dialog-download-report">
          <DialogHeader>
            <DialogTitle>Download Attendance Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Select Month</label>
              <input
                type="month"
                value={downloadMonth}
                onChange={(e) => setDownloadMonth(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm bg-background w-full"
                data-testid="input-download-month"
              />
            </div>
            <Button onClick={handleDownload} className="w-full" data-testid="button-confirm-download">
              <Download className="h-4 w-4 mr-2" />
              Download Excel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function MemberMonthlyCalendar({
  records,
  isLoading,
  month,
  onMonthChange,
}: {
  records: AttendanceRecord[];
  isLoading: boolean;
  month: string;
  onMonthChange: (m: string) => void;
}) {
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  const firstDayOfWeek = new Date(year, mon - 1, 1).getDay();
  const todayStr = new Date().toISOString().split("T")[0];
  const monthName = new Date(year, mon - 1).toLocaleString("en-US", { month: "long", year: "numeric" });

  const prevMonth = () => {
    const d = new Date(year, mon - 2, 1);
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const nextMonth = () => {
    const d = new Date(year, mon, 1);
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const getEffectiveStatus = (record: AttendanceRecord | undefined, isWeekend: boolean) => {
    if (!record) return isWeekend ? "weekend" : "absent";
    if (record.status === "on_leave" || record.status === "holiday") return record.status;
    if (record.punchIn && record.punchOut && record.totalHours) {
      return parseFloat(record.totalHours) >= 8 ? "present" : "absent";
    }
    return record.status || "absent";
  };

  const formatTime = (ts: string | null) => {
    if (!ts) return "--:--";
    return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDuration = (hours: string | null) => {
    if (!hours) return "-";
    const h = parseFloat(hours);
    const wh = Math.floor(h);
    const mins = Math.round((h - wh) * 60);
    if (wh === 0 && mins === 0) return "-";
    if (wh === 0) return `${mins}m`;
    if (mins === 0) return `${wh}h`;
    return `${wh}h ${mins}m`;
  };

  const allDays = Array.from({ length: lastDay }, (_, i) => {
    const dayNum = i + 1;
    const dateStr = `${month}-${String(dayNum).padStart(2, "0")}`;
    const dayOfWeek = new Date(year, mon - 1, dayNum).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isFuture = dateStr > todayStr;
    const record = records.find(r => r.date === dateStr);
    const status = isFuture ? "" : getEffectiveStatus(record, isWeekend);
    return { dayNum, dateStr, dayOfWeek, isWeekend, isFuture, record, status };
  });

  const totalPresent = allDays.filter(d => d.status === "present").length;
  const totalAbsent = allDays.filter(d => d.status === "absent").length;
  const totalLeave = allDays.filter(d => d.status === "on_leave").length;
  const totalHours = records.reduce((sum, r) => sum + parseFloat(r.totalHours || "0"), 0);

  const [selectedDay, setSelectedDay] = useState<typeof allDays[0] | null>(null);

  if (isLoading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold">{monthName}</span>
        <Button variant="outline" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="bg-green-50 dark:bg-green-950 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-green-700 dark:text-green-300">{totalPresent}</p>
          <p className="text-[10px] text-green-600 dark:text-green-400">Present</p>
        </div>
        <div className="bg-red-50 dark:bg-red-950 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-red-700 dark:text-red-300">{totalAbsent}</p>
          <p className="text-[10px] text-red-600 dark:text-red-400">Absent</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{totalLeave}</p>
          <p className="text-[10px] text-blue-600 dark:text-blue-400">On Leave</p>
        </div>
        <div className="bg-muted rounded-lg p-2 text-center">
          <p className="text-lg font-bold">{totalHours.toFixed(1)}</p>
          <p className="text-[10px] text-muted-foreground">Total Hours</p>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={`${d}-${i}`} className="text-center text-xs font-medium text-muted-foreground py-1">
            {d}
          </div>
        ))}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}
        {allDays.map((day) => {
          const isToday = day.dateStr === todayStr;
          const dotColor = day.status ? (statusDotColors[day.status] || "") : "";

          return (
            <button
              key={day.dateStr}
              onClick={() => !day.isFuture && setSelectedDay(day)}
              disabled={day.isFuture}
              className={`
                aspect-square rounded-md border flex flex-col items-center justify-center gap-0.5
                text-xs transition-all
                ${day.isFuture ? "opacity-25 cursor-not-allowed" : "cursor-pointer hover:border-primary hover:shadow-sm"}
                ${isToday ? "border-primary border-2 font-bold" : "border-border"}
                ${day.isWeekend && !day.isFuture ? "bg-muted/40" : ""}
                ${selectedDay?.dateStr === day.dateStr ? "ring-2 ring-primary" : ""}
              `}
              data-testid={`member-cal-day-${day.dateStr}`}
            >
              <span className={`text-[11px] ${isToday ? "text-primary" : ""}`}>{day.dayNum}</span>
              {day.status && dotColor && (
                <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 pt-2 border-t">
        {Object.entries(statusLabels).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${statusDotColors[key]}`} />
            {label}
          </div>
        ))}
      </div>

      {selectedDay && (
        <div className="border rounded-lg p-4 bg-muted/30 space-y-3" data-testid="member-day-detail">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              {new Date(selectedDay.dateStr + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "short", month: "short", day: "numeric"
              })}
            </p>
            <Badge variant="secondary" className={statusColors[selectedDay.status] || ""}>
              {statusLabels[selectedDay.status] || selectedDay.status || "N/A"}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Punch In</p>
              <p className="text-sm font-medium">{formatTime(selectedDay.record?.punchIn || null)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Punch Out</p>
              <p className="text-sm font-medium">{formatTime(selectedDay.record?.punchOut || null)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Duration</p>
              <p className="text-sm font-medium">{formatDuration(selectedDay.record?.totalHours || null)}</p>
            </div>
          </div>
          {selectedDay.record?.notes && (
            <p className="text-xs text-muted-foreground border-t pt-2">{selectedDay.record.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}
