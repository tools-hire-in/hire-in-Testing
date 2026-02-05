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

export default function Attendance() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
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

  const statusColors: Record<string, string> = {
    present: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    absent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    half_day: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    late: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    on_leave: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    holiday: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    weekend: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  };

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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-attendance-title">Attendance</h1>
            <p className="text-muted-foreground">Your attendance history</p>
          </div>
          <div className="flex items-center gap-2">
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
                      const isFuture = dateStr > new Date().toISOString().split("T")[0];
                      return (
                        <tr
                          key={dateStr}
                          className={`border-b last:border-0 ${isWeekend ? "bg-muted/30" : ""} ${isFuture ? "opacity-40" : ""}`}
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
                                {status.replace("_", " ")}
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
      </div>
    </AdminLayout>
  );
}
