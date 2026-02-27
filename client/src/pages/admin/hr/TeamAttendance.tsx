import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Clock, ChevronLeft, ChevronRight, CalendarDays, List } from "lucide-react";
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

const statusColors: Record<string, string> = {
  present: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  absent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
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
};

export default function TeamAttendance() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [viewMode, setViewMode] = useState<"calendar" | "daily">("calendar");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [calendarSelectedDay, setCalendarSelectedDay] = useState<string | null>(null);

  const [year, month] = currentMonth.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const startDate = `${currentMonth}-01`;
  const endDate = `${currentMonth}-${lastDay}`;

  const { data: dailyData, isLoading: dailyLoading } = useQuery<TeamAttendanceResponse>({
    queryKey: ["/api/hr/attendance/my-team", { date: selectedDate }],
    enabled: isAuthenticated && viewMode === "daily",
  });

  const { data: monthlyData, isLoading: monthlyLoading } = useQuery<TeamAttendanceResponse>({
    queryKey: ["/api/hr/attendance/my-team/range", { startDate, endDate }],
    enabled: isAuthenticated && viewMode === "calendar",
  });

  const { data: dialogData, isLoading: dialogLoading } = useQuery<TeamAttendanceResponse>({
    queryKey: ["/api/hr/attendance/my-team", { date: calendarSelectedDay }],
    enabled: isAuthenticated && !!calendarSelectedDay,
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

  const prevMonth = () => {
    const d = new Date(year, month - 2, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const nextMonth = () => {
    const d = new Date(year, month, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const formatTime = (ts: string | null) => {
    if (!ts) return "-";
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatTimeFull = (ts: string | null) => {
    if (!ts) return "--:--";
    return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const formatDuration = (hours: string | null) => {
    if (!hours) return "-";
    const h = parseFloat(hours);
    const wholeHours = Math.floor(h);
    const minutes = Math.round((h - wholeHours) * 60);
    if (wholeHours === 0) return `${minutes}m`;
    if (minutes === 0) return `${wholeHours}h`;
    return `${wholeHours}h ${minutes}m`;
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const monthName = new Date(year, month - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  const members = viewMode === "daily" ? (dailyData?.members || []) : (monthlyData?.members || []);
  const monthlyAttendance = monthlyData?.attendance || [];

  const getDaySummary = (dateStr: string) => {
    const dayRecords = monthlyAttendance.filter(a => a.date === dateStr);
    const totalMembers = members.length;
    const presentCount = dayRecords.filter(a => ["present", "late", "half_day"].includes(a.status)).length;
    const leaveCount = dayRecords.filter(a => a.status === "on_leave").length;
    const absentCount = totalMembers - presentCount - leaveCount;
    return { totalMembers, presentCount, leaveCount, absentCount, records: dayRecords };
  };

  const allDays = Array.from({ length: lastDay }, (_, i) => {
    const dayNum = i + 1;
    const dateStr = `${currentMonth}-${String(dayNum).padStart(2, "0")}`;
    const dayOfWeek = new Date(year, month - 1, dayNum).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isFuture = dateStr > todayStr;
    const summary = getDaySummary(dateStr);
    return { dayNum, dateStr, dayOfWeek, isWeekend, isFuture, summary };
  });

  const dailyMembers = dailyData?.members || [];
  const dailyAttendance = dailyData?.attendance || [];
  const getMemberAttendance = (memberId: string) => dailyAttendance.find(a => a.userId === memberId);

  const presentCount = dailyMembers.filter(m => {
    const a = getMemberAttendance(m.id);
    return a && ["present", "late", "half_day"].includes(a.status);
  }).length;
  const absentCount = dailyMembers.filter(m => {
    const a = getMemberAttendance(m.id);
    return !a || a.status === "absent";
  }).length;
  const onLeaveCount = dailyMembers.filter(m => {
    const a = getMemberAttendance(m.id);
    return a && a.status === "on_leave";
  }).length;

  const dialogMembers = dialogData?.members || [];
  const dialogAttendance = dialogData?.attendance || [];

  const handleDayClick = (dateStr: string) => {
    setCalendarSelectedDay(dateStr);
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
            <div className="flex items-center border rounded-md overflow-hidden mr-2">
              <Button
                variant={viewMode === "calendar" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("calendar")}
                className="rounded-none h-8"
                data-testid="button-calendar-view"
              >
                <CalendarDays className="h-4 w-4 mr-1" />
                Calendar
              </Button>
              <Button
                variant={viewMode === "daily" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("daily")}
                className="rounded-none h-8"
                data-testid="button-daily-view"
              >
                <List className="h-4 w-4 mr-1" />
                Daily
              </Button>
            </div>

            {viewMode === "daily" ? (
              <>
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
              </>
            ) : (
              <>
                <Button variant="outline" size="icon" onClick={prevMonth} data-testid="button-prev-month">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[140px] text-center" data-testid="text-current-month">{monthName}</span>
                <Button variant="outline" size="icon" onClick={nextMonth} data-testid="button-next-month">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {viewMode === "daily" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-md bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <span className="text-green-700 dark:text-green-300 font-bold">{presentCount}</span>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Present</p>
                    <p className="text-lg font-semibold" data-testid="text-present-count">{presentCount} / {dailyMembers.length}</p>
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
                {dailyLoading ? (
                  <div className="space-y-2">
                    {[1,2,3,4].map(i => <Skeleton key={i} className="h-14 w-full" />)}
                  </div>
                ) : dailyMembers.length > 0 ? (
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
                        {dailyMembers.map((member) => {
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
          </>
        )}

        {viewMode === "calendar" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly Overview - {monthName}</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyLoading ? (
                <Skeleton className="h-[350px] w-full" />
              ) : (
                <>
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                      <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
                        {d}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1" data-testid="team-calendar-grid">
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                      <div key={`empty-${i}`} className="aspect-square" />
                    ))}
                    {allDays.map((day) => {
                      const isToday = day.dateStr === todayStr;
                      const { presentCount: dp, totalMembers: dt, leaveCount: dl } = day.summary;
                      const allPresent = dp === dt && dt > 0;
                      const somePresent = dp > 0 && dp < dt;

                      return (
                        <button
                          key={day.dateStr}
                          onClick={() => !day.isFuture && handleDayClick(day.dateStr)}
                          disabled={day.isFuture}
                          className={`
                            aspect-square rounded-lg border flex flex-col items-center justify-center gap-0.5
                            text-xs transition-all relative p-1
                            ${day.isFuture ? "opacity-30 cursor-not-allowed" : "cursor-pointer hover:border-primary hover:shadow-sm"}
                            ${isToday ? "border-primary border-2 font-bold" : "border-border"}
                            ${day.isWeekend && !day.isFuture ? "bg-muted/40" : ""}
                            ${calendarSelectedDay === day.dateStr ? "ring-2 ring-primary" : ""}
                          `}
                          data-testid={`team-calendar-day-${day.dateStr}`}
                        >
                          <span className={`text-sm ${isToday ? "text-primary" : ""}`}>{day.dayNum}</span>
                          {!day.isFuture && !day.isWeekend && dt > 0 && (
                            <div className="flex items-center gap-0.5">
                              <span className={`h-1.5 w-1.5 rounded-full ${allPresent ? "bg-green-500" : somePresent ? "bg-yellow-500" : "bg-red-500"}`} />
                              <span className="text-[10px] text-muted-foreground">{dp}/{dt}</span>
                            </div>
                          )}
                          {!day.isFuture && day.isWeekend && (
                            <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                      All Present
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                      Partial
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                      None Present
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-2.5 w-2.5 rounded-full bg-gray-400" />
                      Weekend
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!calendarSelectedDay} onOpenChange={(open) => !open && setCalendarSelectedDay(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto" data-testid="dialog-team-day-detail">
          <DialogHeader>
            <DialogTitle>
              {calendarSelectedDay && new Date(calendarSelectedDay + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </DialogTitle>
          </DialogHeader>
          {calendarSelectedDay && (
            <TeamDayDetail
              members={dialogMembers}
              attendance={dialogAttendance}
              isLoading={dialogLoading}
              formatTime={formatTimeFull}
              formatDuration={formatDuration}
            />
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function TeamDayDetail({
  members,
  attendance,
  isLoading,
  formatTime,
  formatDuration,
}: {
  members: TeamMember[];
  attendance: AttendanceRecord[];
  isLoading: boolean;
  formatTime: (ts: string | null) => string;
  formatDuration: (h: string | null) => string;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  const getMemberAtt = (id: string) => attendance.find(a => a.userId === id);

  const presentCount = members.filter(m => {
    const a = getMemberAtt(m.id);
    return a && ["present", "late", "half_day"].includes(a.status);
  }).length;
  const leaveCount = members.filter(m => {
    const a = getMemberAtt(m.id);
    return a && a.status === "on_leave";
  }).length;
  const absentCount = members.length - presentCount - leaveCount;

  return (
    <div className="space-y-4" data-testid="team-day-detail-content">
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-green-700 dark:text-green-300">{presentCount}</p>
          <p className="text-[11px] text-green-600 dark:text-green-400">Present</p>
        </div>
        <div className="bg-red-50 dark:bg-red-950 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-red-700 dark:text-red-300">{absentCount}</p>
          <p className="text-[11px] text-red-600 dark:text-red-400">Absent</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{leaveCount}</p>
          <p className="text-[11px] text-blue-600 dark:text-blue-400">On Leave</p>
        </div>
      </div>

      {members.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-4">No team members found</p>
      ) : (
        <div className="space-y-2">
          {members.map((member) => {
            const att = getMemberAtt(member.id);
            const status = att?.status || "absent";
            return (
              <div
                key={member.id}
                className="border rounded-lg p-3 space-y-2"
                data-testid={`dialog-member-${member.id}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{member.firstName} {member.lastName}</p>
                    <p className="text-xs text-muted-foreground">{member.designation || member.email}</p>
                  </div>
                  <Badge variant="secondary" className={`text-xs ${statusColors[status] || ""}`}>
                    {statusLabels[status] || status}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-muted/50 rounded p-1.5">
                    <p className="text-[10px] text-muted-foreground uppercase">In</p>
                    <p className="text-xs font-medium">{formatTime(att?.punchIn || null)}</p>
                  </div>
                  <div className="bg-muted/50 rounded p-1.5">
                    <p className="text-[10px] text-muted-foreground uppercase">Out</p>
                    <p className="text-xs font-medium">{formatTime(att?.punchOut || null)}</p>
                  </div>
                  <div className="bg-muted/50 rounded p-1.5">
                    <p className="text-[10px] text-muted-foreground uppercase">Hours</p>
                    <p className="text-xs font-medium">{formatDuration(att?.totalHours || null)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
