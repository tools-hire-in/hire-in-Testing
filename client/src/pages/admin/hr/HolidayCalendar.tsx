import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";

interface Holiday {
  id: string;
  name: string;
  date: string;
  type: string;
  isOptional: boolean;
}

export default function HolidayCalendar() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const year = new Date().getFullYear();

  const { data: holidays, isLoading } = useQuery<Holiday[]>({
    queryKey: ["/api/hr/holidays", { year }],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const today = new Date().toISOString().split("T")[0];

  const upcoming = holidays?.filter(h => h.date >= today) || [];
  const past = holidays?.filter(h => h.date < today) || [];

  const months = Array.from(new Set(holidays?.map(h => h.date.substring(0, 7)) || [])).sort();

  const groupedByMonth: Record<string, Holiday[]> = {};
  holidays?.forEach(h => {
    const monthKey = h.date.substring(0, 7);
    if (!groupedByMonth[monthKey]) groupedByMonth[monthKey] = [];
    groupedByMonth[monthKey].push(h);
  });

  const formatMonthLabel = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-holidays-title">Holiday Calendar {year}</h1>
          <p className="text-muted-foreground">Company holidays and observances</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold">{holidays?.length || 0}</div>
              <p className="text-sm text-muted-foreground">Total Holidays</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold">{upcoming.length}</div>
              <p className="text-sm text-muted-foreground">Upcoming</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold">{holidays?.filter(h => h.isOptional).length || 0}</div>
              <p className="text-sm text-muted-foreground">Optional</p>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : (
          <div className="space-y-6">
            {months.map(monthKey => (
              <Card key={monthKey}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{formatMonthLabel(monthKey)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {groupedByMonth[monthKey]?.map(h => {
                      const hDate = new Date(h.date + "T00:00:00");
                      const dayName = hDate.toLocaleString("en-US", { weekday: "long" });
                      const isPast = h.date < today;
                      return (
                        <div
                          key={h.id}
                          className={`flex items-center justify-between py-2 px-3 rounded-md ${isPast ? "opacity-50" : ""}`}
                          data-testid={`holiday-item-${h.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-bold">{hDate.getDate()}</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium">{h.name}</p>
                              <p className="text-xs text-muted-foreground">{dayName}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {h.isOptional && (
                              <Badge variant="outline" className="text-xs">Optional</Badge>
                            )}
                            <Badge variant="secondary" className="text-xs capitalize">{h.type}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
            {months.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No holidays configured for {year}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
