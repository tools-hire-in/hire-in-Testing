import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { UserCircle, Mail, Shield, Calendar } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";

interface LeaveBalance {
  id: string;
  leaveTypeId: string;
  totalDays: string;
  usedDays: string;
}

interface LeaveType {
  id: string;
  name: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  totalHours: string | null;
}

export default function Profile() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  const { data: balances } = useQuery<LeaveBalance[]>({
    queryKey: ["/api/hr/leave-balances/my"],
    enabled: isAuthenticated,
  });

  const { data: leaveTypes } = useQuery<LeaveType[]>({
    queryKey: ["/api/hr/leave-types"],
    enabled: isAuthenticated,
  });

  const currentMonth = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  })();
  const startDate = `${currentMonth}-01`;
  const [year, month] = currentMonth.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${currentMonth}-${lastDay}`;

  const { data: monthlyAttendance } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/hr/attendance/my", { startDate, endDate }],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const getLeaveTypeName = (id: string) => leaveTypes?.find(lt => lt.id === id)?.name || "Unknown";

  const roleLabels: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    hr: "HR Manager",
    operations: "Operations",
    employee: "Employee",
  };

  const presentDays = monthlyAttendance?.filter(r => ["present", "late", "half_day"].includes(r.status)).length || 0;
  const totalHours = monthlyAttendance?.reduce((s, r) => s + parseFloat(r.totalHours || "0"), 0) || 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-profile-title">My Profile</h1>
          <p className="text-muted-foreground">Personal information and overview</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardContent className="p-6 text-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 mx-auto flex items-center justify-center mb-4">
                <UserCircle className="h-12 w-12 text-primary" />
              </div>
              <h2 className="text-xl font-bold" data-testid="text-profile-name">
                {user?.firstName} {user?.lastName}
              </h2>
              <Badge className="mt-2" data-testid="badge-profile-role">
                {roleLabels[user?.role || "employee"]}
              </Badge>
              <div className="mt-4 space-y-2 text-left">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span data-testid="text-profile-email">{user?.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span>Role: {roleLabels[user?.role || "employee"]}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Status: {user?.isActive ? "Active" : "Inactive"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">This Month's Attendance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold">{presentDays}</div>
                    <p className="text-xs text-muted-foreground">Days Present</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{totalHours.toFixed(1)}</div>
                    <p className="text-xs text-muted-foreground">Total Hours</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{presentDays > 0 ? (totalHours / presentDays).toFixed(1) : "0"}</div>
                    <p className="text-xs text-muted-foreground">Avg Hours/Day</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Leave Balances ({new Date().getFullYear()})</CardTitle>
              </CardHeader>
              <CardContent>
                {balances && balances.length > 0 ? (
                  <div className="space-y-3">
                    {balances.map((bal) => {
                      const total = parseFloat(bal.totalDays);
                      const used = parseFloat(bal.usedDays);
                      const remaining = total - used;
                      const percent = total > 0 ? (used / total) * 100 : 0;
                      return (
                        <div key={bal.id}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm">{getLeaveTypeName(bal.leaveTypeId)}</span>
                            <span className="text-sm text-muted-foreground">
                              {remaining} remaining / {total} total ({used} used)
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-md h-2">
                            <div
                              className="bg-primary rounded-md h-2 transition-all"
                              style={{ width: `${Math.min(percent, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No leave balances available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
