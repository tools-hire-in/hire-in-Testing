import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Users, FileText, Mail, TrendingUp, Clock } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/stats"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/admin/login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) {
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
              <Card className="hover-elevate cursor-pointer transition-all">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <>
                      <div className="text-3xl font-bold">{stat.value}</div>
                      <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
                    </>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

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
