import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Target, RefreshCw, Star, MessageSquare, TrendingUp } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";

interface AnalyticsSummary {
  totalActiveGoals: number;
  goalsCompletedPercentage: number;
  reviewCompletionRate: number;
  averageRating: number;
  feedbackThisMonth: number;
  departmentBreakdown?: DepartmentStats[];
}

interface DepartmentStats {
  departmentName: string;
  totalGoals: number;
  completedGoals: number;
  completionRate: number;
  averageRating: number;
  feedbackCount: number;
}

function StatCard({ icon: Icon, label, value, subtext, color }: { icon: any; label: string; value: string | number; subtext?: string; color: string }) {
  return (
    <Card data-testid={`stat-card-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
          </div>
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Analytics() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  const isManagerOrAbove = ["super_admin", "admin", "hr", "manager"].includes(user?.role || "");
  const isHrOrAdmin = ["super_admin", "admin", "hr"].includes(user?.role || "");

  const { data: analytics, isLoading } = useQuery<AnalyticsSummary>({
    queryKey: ["/api/performance/analytics"],
    enabled: isAuthenticated && isManagerOrAbove,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  if (!isManagerOrAbove) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground" data-testid="text-no-access">You don't have access to this page.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-analytics-title">Performance Analytics</h1>
          <p className="text-muted-foreground">
            {isHrOrAdmin ? "Company-wide performance overview" : "Team performance overview"}
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : analytics ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard
                icon={Target}
                label="Active Goals"
                value={analytics.totalActiveGoals}
                subtext="Across all employees"
                color="bg-blue-500"
              />
              <StatCard
                icon={TrendingUp}
                label="Goals Completed"
                value={`${analytics.goalsCompletedPercentage}%`}
                subtext="Of all goals"
                color="bg-green-500"
              />
              <StatCard
                icon={RefreshCw}
                label="Review Completion"
                value={`${analytics.reviewCompletionRate}%`}
                subtext="Active cycle"
                color="bg-purple-500"
              />
              <StatCard
                icon={Star}
                label="Avg Rating"
                value={analytics.averageRating.toFixed(1)}
                subtext="Out of 5.0"
                color="bg-amber-500"
              />
              <StatCard
                icon={MessageSquare}
                label="Feedback Given"
                value={analytics.feedbackThisMonth}
                subtext="This month"
                color="bg-indigo-500"
              />
            </div>

            {isHrOrAdmin && analytics.departmentBreakdown && analytics.departmentBreakdown.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Department Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 font-medium text-muted-foreground">Department</th>
                          <th className="text-left py-3 px-2 font-medium text-muted-foreground">Total Goals</th>
                          <th className="text-left py-3 px-2 font-medium text-muted-foreground">Completed</th>
                          <th className="text-left py-3 px-2 font-medium text-muted-foreground">Completion Rate</th>
                          <th className="text-left py-3 px-2 font-medium text-muted-foreground">Avg Rating</th>
                          <th className="text-left py-3 px-2 font-medium text-muted-foreground">Feedback</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.departmentBreakdown.map((dept) => (
                          <tr key={dept.departmentName} className="border-b last:border-0" data-testid={`dept-row-${dept.departmentName}`}>
                            <td className="py-2 px-2 font-medium">{dept.departmentName}</td>
                            <td className="py-2 px-2">{dept.totalGoals}</td>
                            <td className="py-2 px-2">{dept.completedGoals}</td>
                            <td className="py-2 px-2">{dept.completionRate}%</td>
                            <td className="py-2 px-2">{dept.averageRating.toFixed(1)}</td>
                            <td className="py-2 px-2">{dept.feedbackCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No performance data available yet</p>
                <p className="text-sm text-muted-foreground mt-1">Analytics will appear once review cycles and goals are set up</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}