import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Clock, ChevronLeft, ChevronRight, X, CalendarDays, List } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { TicketsContent } from "./Tickets";

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

export default function Attendance() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const params = new URLSearchParams(window.location.search);
  const requestedTab = params.get("tab");
  const validTabs = ["attendance", "tickets"];
  const initialTab = requestedTab && validTabs.includes(requestedTab) ? requestedTab : "attendance";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [selectedDay, setSelectedDay] = useState<{
    dateStr: string;
    record: AttendanceRecord | undefined;
    isWeekend: boolean;
  } | null>(null);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const startDate = `${currentMonth}-01`;
  const [year, month] = currentMonth.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${currentMonth}-${lastDay}`;

  const { data: records, isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/hr/attendance/my", { startDate, endDate }],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/admin/login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const prevMonth = () => {
    const d = new Date(year, month - 2, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const nextMonth = () => {
    const d = new Date(year, month, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "--:--";
    return new Date(dateStr).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  const allDays = Array.from({ length: lastDay }, (_, i) => {
    const dayNum = i + 1;
    const dateStr = `${currentMonth}-${String(dayNum).padStart(2, "0")}`;
    const record = records?.find(r => r.date === dateStr);
    const dayOfWeek = new Date(year, month - 1, dayNum).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    return { dayNum, dateStr, record, isWeekend, dayOfWeek };
  });

  const totalPresent = records?.filter(r => ["present", "late", "half_day"].includes(r.status)).length || 0;
  const totalHours = records?.reduce((sum, r) => sum + parseFloat(r.totalHours || "0"), 0) || 0;
  const monthName = new Date(year, month - 1).toLocaleString("en-US", { month: "long", year: "numeric" });

  const handleDayClick = (day: typeof allDays[0]) => {
    setSelectedDay({ dateStr: day.dateStr, record: day.record, isWeekend: day.isWeekend });
  };

  const getStatusForDay = (day: typeof allDays[0]) => {
    if (day.record?.status) return day.record.status;
    if (day.isWeekend) return "weekend";
    if (day.dateStr > todayStr) return "";
    return "absent";
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const url = new URL(window.location.href);
    if (value === "attendance") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", value);
    }
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-attendance-title">Attendance</h1>
          <p className="text-muted-foreground">Your attendance and regularization requests</p>
        </div>
        <Tabs value={activeTab} onValueChange={handleTabChange} data-testid="tabs-attendance">
          <TabsList>
            <TabsTrigger value="attendance" data-testid="tab-attendance">My Attendance</TabsTrigger>
            <TabsTrigger value="tickets" data-testid="tab-tickets">Regularization Requests</TabsTrigger>
          </TabsList>
          <TabsContent value="attendance">
            <div className="space-y-6">
        <div className="flex items-center justify-end flex-wrap gap-2">
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
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="rounded-none h-8"
                data-testid="button-list-view"
              >
                <List className="h-4 w-4 mr-1" />
                List
              </Button>
            </div>
            <Button variant="outline" size="icon" onClick={prevMonth} data-testid="button-prev-month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[140px] text-center" data-testid="text-current-month">{monthName}</span>
            <Button variant="outline" size="icon" onClick={nextMonth} data-testid="button-next-month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold" data-testid="text-total-present">{totalPresent}</div>
              <p className="text-sm text-muted-foreground">Days Present</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold">{totalHours.toFixed(1)}</div>
              <p className="text-sm text-muted-foreground">Total Hours</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold">{totalPresent > 0 ? (totalHours / totalPresent).toFixed(1) : "0"}</div>
              <p className="text-sm text-muted-foreground">Avg Hours/Day</p>
            </CardContent>
          </Card>
        </div>

        {viewMode === "calendar" ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly Calendar</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <>
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                      <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
                        {d}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1" data-testid="calendar-grid">
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                      <div key={`empty-${i}`} className="aspect-square" />
                    ))}
                    {allDays.map((day) => {
                      const status = getStatusForDay(day);
                      const isFuture = day.dateStr > todayStr;
                      const isToday = day.dateStr === todayStr;
                      const dotColor = status ? statusDotColors[status] : "";

                      return (
                        <button
                          key={day.dateStr}
                          onClick={() => !isFuture && handleDayClick(day)}
                          disabled={isFuture}
                          className={`
                            aspect-square rounded-lg border flex flex-col items-center justify-center gap-1
                            text-sm transition-all relative
                            ${isFuture ? "opacity-30 cursor-not-allowed" : "cursor-pointer hover:border-primary hover:shadow-sm"}
                            ${isToday ? "border-primary border-2 font-bold" : "border-border"}
                            ${day.isWeekend && !isFuture ? "bg-muted/40" : ""}
                            ${selectedDay?.dateStr === day.dateStr ? "ring-2 ring-primary" : ""}
                          `}
                          data-testid={`calendar-day-${day.dateStr}`}
                        >
                          <span className={isToday ? "text-primary" : ""}>{day.dayNum}</span>
                          {status && dotColor && (
                            <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className={`h-2.5 w-2.5 rounded-full ${statusDotColors[key]}`} />
                        {label}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily Records</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Date</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Day</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Punch In</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Punch Out</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Hours</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allDays.map(({ dayNum, dateStr, record, isWeekend, dayOfWeek }) => {
                        const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dayOfWeek];
                        const status = record?.status || (isWeekend ? "weekend" : "");
                        const isFuture = dateStr > todayStr;
                        return (
                          <tr
                            key={dateStr}
                            className={`border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors ${isWeekend ? "bg-muted/30" : ""} ${isFuture ? "opacity-40" : ""}`}
                            onClick={() => !isFuture && handleDayClick({ dayNum, dateStr, record, isWeekend, dayOfWeek })}
                            data-testid={`attendance-row-${dateStr}`}
                          >
                            <td className="py-2 px-2">{dateStr}</td>
                            <td className="py-2 px-2">{dayName}</td>
                            <td className="py-2 px-2">{formatTime(record?.punchIn || null)}</td>
                            <td className="py-2 px-2">{formatTime(record?.punchOut || null)}</td>
                            <td className="py-2 px-2">{record?.totalHours ? `${parseFloat(record.totalHours).toFixed(1)}h` : "-"}</td>
                            <td className="py-2 px-2">
                              {status && (
                                <Badge variant="secondary" className={statusColors[status] || ""}>
                                  {statusLabels[status] || status.replace("_", " ")}
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-day-detail">
          <DialogHeader>
            <DialogTitle>
              {selectedDay && new Date(selectedDay.dateStr + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </DialogTitle>
          </DialogHeader>
          {selectedDay && (
            <DayDetailContent
              dateStr={selectedDay.dateStr}
              record={selectedDay.record}
              isWeekend={selectedDay.isWeekend}
            />
          )}
        </DialogContent>
      </Dialog>
          </TabsContent>
          <TabsContent value="tickets">
            <TicketsContent />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

function DayDetailContent({
  dateStr,
  record,
  isWeekend,
}: {
  dateStr: string;
  record: AttendanceRecord | undefined;
  isWeekend: boolean;
}) {
  const status = record?.status || (isWeekend ? "weekend" : "absent");
  const todayStr = new Date().toISOString().split("T")[0];
  const isFuture = dateStr > todayStr;

  const formatTime = (ts: string | null) => {
    if (!ts) return "--:--";
    return new Date(ts).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
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

  if (isFuture) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Clock className="h-10 w-10 mx-auto mb-2 opacity-40" />
        <p>Future date - no data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="day-detail-content">
      <div className="flex items-center justify-center">
        <Badge variant="secondary" className={`text-sm px-4 py-1.5 ${statusColors[status] || ""}`}>
          {statusLabels[status] || status.replace("_", " ")}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Punch In</p>
          <p className="text-lg font-semibold" data-testid="text-detail-punch-in">
            {formatTime(record?.punchIn || null)}
          </p>
        </div>
        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Punch Out</p>
          <p className="text-lg font-semibold" data-testid="text-detail-punch-out">
            {formatTime(record?.punchOut || null)}
          </p>
        </div>
      </div>

      <div className="bg-muted/50 rounded-lg p-4 text-center">
        <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Total Hours Worked</p>
        <p className="text-2xl font-bold" data-testid="text-detail-hours">
          {formatDuration(record?.totalHours || null)}
        </p>
        {record?.totalHours && (
          <p className="text-xs text-muted-foreground mt-1">
            ({parseFloat(record.totalHours).toFixed(2)} decimal hours)
          </p>
        )}
      </div>

      {record?.notes && (
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Notes</p>
          <p className="text-sm" data-testid="text-detail-notes">{record.notes}</p>
        </div>
      )}

      {!record && !isWeekend && (
        <p className="text-center text-sm text-muted-foreground">
          No attendance record for this day.
        </p>
      )}
    </div>
  );
}
