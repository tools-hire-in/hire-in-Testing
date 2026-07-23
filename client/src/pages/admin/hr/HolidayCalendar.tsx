import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CalendarDays, Check, Info, Lock } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Holiday {
  id: string;
  name: string;
  date: string;
  type: string;
  isOptional: boolean;
}

interface RegionalSelection {
  id: string;
  userId: string;
  holidayId: string;
  year: number;
}

export default function HolidayCalendar() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { enabled: newLook } = useNewLook();
  const { toast } = useToast();
  const year = new Date().getFullYear();

  const { data: holidays, isLoading } = useQuery<Holiday[]>({
    queryKey: ["/api/hr/holidays", { year }],
    enabled: isAuthenticated,
  });

  const { data: selections } = useQuery<RegionalSelection[]>({
    queryKey: ["/api/hr/regional-holiday-selections", { year }],
    enabled: isAuthenticated,
  });

  const selectMutation = useMutation({
    mutationFn: (holidayId: string) => apiRequest("POST", "/api/hr/regional-holiday-selections", { holidayId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/regional-holiday-selections"] });
      toast({ title: "Selected", description: "Regional holiday selected successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to select holiday", variant: "destructive" });
    },
  });

  const deselectMutation = useMutation({
    mutationFn: (selectionId: string) => apiRequest("DELETE", `/api/hr/regional-holiday-selections/${selectionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/regional-holiday-selections"] });
      toast({ title: "Removed", description: "Regional holiday selection removed." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to remove selection", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const today = new Date().toISOString().split("T")[0];
  const regionalHolidays = holidays?.filter(h => h.type === "regional") || [];
  const selectedIds = new Set(selections?.map(s => s.holidayId) || []);
  const selectionCount = selections?.length || 0;
  const canDeselect = ["super_admin", "admin", "hr"].includes(user?.role || "");

  const upcoming = holidays?.filter(h => h.date >= today) || [];

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

  const getSelectionForHoliday = (holidayId: string) => {
    return selections?.find(s => s.holidayId === holidayId);
  };

  return (
    <AdminLayout>
      <div className="space-y-6 v2-surface">
        {newLook ? (
          <V2PageHeader
            icon={CalendarDays}
            eyebrow="My Work"
            title={`Holiday Calendar ${year}`}
            subtitle="Company holidays and observances"
            testId="text-holidays-title"
          />
        ) : (
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-holidays-title">Leave Calendar {year}</h1>
            <p className="text-muted-foreground">Company holidays and observances</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-mono font-bold" data-testid="text-total-holidays">{holidays?.length || 0}</div>
              <p className="text-sm text-muted-foreground">Total Holidays</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-mono font-bold">{upcoming.length}</div>
              <p className="text-sm text-muted-foreground">Upcoming</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-mono font-bold" data-testid="text-regional-selected">{selectionCount}/2</div>
              <p className="text-sm text-muted-foreground">Regional Holidays Selected</p>
            </CardContent>
          </Card>
        </div>

        <div className="p-3 rounded-md border border-dashed flex items-start gap-2" data-testid="text-regional-note">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground font-medium">
            Note : Employee's can apply any two regional holidays without any loss of pay for india office. US Holidays are mandatory for US Client Team.
          </p>
        </div>

        {regionalHolidays.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {canDeselect ? "Manage" : "Select Your"} Regional Holidays ({selectionCount}/2)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {regionalHolidays.map(h => {
                  const isSelected = selectedIds.has(h.id);
                  const existingSelection = getSelectionForHoliday(h.id);
                  const hDate = new Date(h.date + "T00:00:00");
                  const dayName = hDate.toLocaleString("en-US", { weekday: "short" });
                  const dateLabel = hDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  const canSelect = !isSelected && selectionCount < 2;
                  const isPast = h.date < today;

                  return (
                    <div
                      key={h.id}
                      className={`flex items-center gap-3 py-1.5 pl-2 pr-2.5 rounded-md border-l-2 transition-colors ${
                        isSelected
                          ? "border-l-primary bg-primary/5"
                          : "border-l-transparent bg-muted/40 hover:bg-muted/70"
                      } ${isPast ? "opacity-60" : ""}`}
                      data-testid={`regional-holiday-${h.id}`}
                    >
                      <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${isSelected ? "bg-primary/15 text-primary" : "bg-background text-muted-foreground"}`}>
                        <span className="text-sm font-bold leading-none">{hDate.getDate()}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm truncate ${isSelected ? "font-semibold text-foreground" : "font-medium text-foreground/90"}`}>{h.name}</p>
                        <p className="text-xs text-muted-foreground">{dateLabel} · {dayName}</p>
                      </div>
                      {isSelected ? (
                        canDeselect ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs shrink-0"
                            onClick={() => existingSelection && deselectMutation.mutate(existingSelection.id)}
                            disabled={deselectMutation.isPending}
                            data-testid={`button-deselect-${h.id}`}
                          >
                            <Check className="h-3.5 w-3.5 mr-1" />
                            Deselect
                          </Button>
                        ) : (
                          <Badge variant="default" className="shrink-0 text-xs" data-testid={`badge-locked-${h.id}`}>
                            <Lock className="h-3 w-3 mr-1" />
                            Selected
                          </Badge>
                        )
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-3 text-xs shrink-0"
                          onClick={() => selectMutation.mutate(h.id)}
                          disabled={!canSelect || selectMutation.isPending}
                          data-testid={`button-select-${h.id}`}
                        >
                          Select
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

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
                      const isRegional = h.type === "regional";
                      const isSelectedRegional = isRegional && selectedIds.has(h.id);
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
                            {isRegional && (
                              <Badge variant={isSelectedRegional ? "default" : "outline"} className="text-xs">
                                {isSelectedRegional ? "Selected" : "Regional"}
                              </Badge>
                            )}
                            {!isRegional && (
                              <Badge variant="secondary" className="text-xs capitalize">{h.type}</Badge>
                            )}
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
