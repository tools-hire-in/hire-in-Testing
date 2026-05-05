import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Users, FileText, Mail, TrendingUp, Clock, PencilLine } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";

interface DashboardStats {
  totalJobs: number;
  activeJobs: number;
  totalApplications: number;
  newApplications: number;
  totalContacts: number;
  newContacts: number;
}

interface CorrectionsSummary {
  totalCorrections: number;
  affectedCount: number;
  perEmployee: Array<{ name: string; email: string; correctedDays: number }>;
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/stats"],
    enabled: isAuthenticated,
  });

  const today = new Date().toISOString().split("T")[0];
  const monthStart = today.substring(0, 7) + "-01";
  const isHrLike = ["super_admin", "admin"].includes(user?.role || "");

  const { data: corrSummary, isLoading: corrLoading } = useQuery<CorrectionsSummary>({
    queryKey: ["/api/hr/attendance/corrections-summary", monthStart, today],
    queryFn: () => fetch(`/api/hr/attendance/corrections-summary?startDate=${monthStart}&endDate=${today}`, { credentials: "include" }).then(r => r.json()),
    enabled: isAuthenticated && isHrLike,
  });

  const hasRecruitmentAccess = ["super_admin", "admin", "operations", "manager"].includes(user?.role || "");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/admin/login");
    }
    if (!authLoading && isAuthenticated && !hasRecruitmentAccess) {
      setLocation("/admin/hr");
    }
  }, [authLoading, isAuthenticated, hasRecruitmentAccess, setLocation]);

  if (authLoading || !isAuthenticated || !hasRecruitmentAccess) {
    return null;
  }

  const canManageJobs = ["super_admin", "admin", "operations"].includes(user?.role || "");

  const statCards = [
    {
      title: "Active Jobs",
      value: stats?.activeJobs ?? 0,
      subtitle: `${stats?.totalJobs ?? 0} total jobs`,
      icon: Briefcase,
      href: canManageJobs ? "/admin/jobs" : "/admin/applications",
      color: "text-blue-600",
    },
    {
      title: "New Applications",
      value: stats?.newApplications ?? 0,
      subtitle: `${stats?.totalApplications ?? 0} total applications`,
      icon: FileText,
      href: "/admin/applications",
      color: "text-green-600",
    },
    {
      title: "New Inquiries",
      value: stats?.newContacts ?? 0,
      subtitle: `${stats?.totalContacts ?? 0} total inquiries`,
      icon: Mail,
      href: "/admin/contacts",
      color: "text-orange-600",
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.firstName || "Admin"}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {statCards.map((stat) => (
            <Link key={stat.title} href={stat.href}>
              {isLoading ? (
                <Card className="cursor-pointer"><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
              ) : (
                <StatCard
                  label={stat.title}
                  value={stat.value}
                  subvalue={stat.subtitle}
                  icon={<stat.icon className="h-5 w-5" />}
                  accentColour={stat.color}
                  className="hover-elevate cursor-pointer transition-all"
                />
              )}
            </Link>
          ))}
        </div>

        {/* Attendance Corrections This Month */}
        {isHrLike && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Attendance Corrections</h2>
            {corrLoading ? (
              <Card><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ) : (
              <Link href="/admin/hr/my-team?tab=attendance">
                <StatCard
                  label="Attendance Corrections This Month"
                  value={corrSummary?.totalCorrections ?? 0}
                  subvalue={corrSummary?.affectedCount ? `${corrSummary.affectedCount} employee${corrSummary.affectedCount !== 1 ? "s" : ""} affected` : "No corrections this month"}
                  icon={<PencilLine className="h-5 w-5" />}
                  accentColour="text-amber-600"
                  className="hover-elevate cursor-pointer transition-all max-w-sm"
                  data-testid="stat-attendance-corrections"
                />
              </Link>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {["super_admin", "admin", "operations"].includes(user?.role || "") && (
              <Link href="/admin/jobs">
                <Card className="hover-elevate cursor-pointer">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <Briefcase className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <div className="font-medium">Manage Jobs</div>
                      <div className="text-sm text-muted-foreground">Upload CSV, edit listings</div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )}
            <Link href="/admin/applications">
              <Card className="hover-elevate cursor-pointer">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <div className="font-medium">Review Applications</div>
                    <div className="text-sm text-muted-foreground">View candidate submissions</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/admin/contacts">
              <Card className="hover-elevate cursor-pointer">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <div className="font-medium">Contact Inquiries</div>
                    <div className="text-sm text-muted-foreground">Respond to messages</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/admin/users">
              <Card className="hover-elevate cursor-pointer">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                    <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <div className="font-medium">Team Directory</div>
                    <div className="text-sm text-muted-foreground">View team members</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
