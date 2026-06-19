import { useEffect, useMemo, lazy, Suspense } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Lock, GraduationCap } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import CommandCenter from "./CommandCenter";
import MyRegularizations from "./MyRegularizations";

const Attendance = lazy(() => import("@/pages/admin/hr/Attendance"));
const LeaveManagement = lazy(() => import("@/pages/admin/hr/LeaveManagement"));
const HolidayCalendar = lazy(() => import("@/pages/admin/hr/HolidayCalendar"));

const TABS = ["time-card", "time-off", "leave-calendar", "regularizations"] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  "time-card": "Time Card",
  "time-off": "Time Off",
  "leave-calendar": "Leave Calendar",
  "regularizations": "Regularizations",
};

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    </div>
  );
}

export default function MyDesk() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { toast } = useToast();

  const activeTab: Tab | null = useMemo(() => {
    try {
      const tab = new URLSearchParams(search).get("tab");
      if (tab && TABS.includes(tab as Tab)) return tab as Tab;
    } catch {}
    return null;
  }, [search]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (activeTab) {
      document.title = `Command Center — ${TAB_LABELS[activeTab]} | Hire'in Portal`;
    } else {
      document.title = "Command Center — My Desk | Hire'in Portal";
    }
  }, [activeTab]);

  const isComplianceLockExempt = ["hr", "admin", "super_admin"].includes(user?.role || "");

  const { data: complianceStatus } = useQuery<{ locked: boolean; reason: string | null; overdueCount: number }>({
    queryKey: ["/api/onboarding/my-training/compliance-status"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/onboarding/my-training/compliance-status", { credentials: "include" });
        if (!res.ok) return { locked: false, reason: null, overdueCount: 0 };
        return res.json();
      } catch { return { locked: false, reason: null, overdueCount: 0 }; }
    },
    enabled: isAuthenticated && !isComplianceLockExempt,
    staleTime: 60000,
  });

  const isComplianceLocked = !isComplianceLockExempt && complianceStatus?.locked === true;

  if (authLoading || !isAuthenticated) return null;

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-mydesk-title">My Desk</h1>
          <p className="text-sm text-muted-foreground">Your personal workspace — time, leave, and corrections</p>
        </div>

        {/* Content driven by sidebar sub-nav */}
        <div>
          {activeTab === null && <CommandCenter />}

          {activeTab === "time-card" && !isComplianceLocked && (
            <Suspense fallback={<TabFallback />}>
              <Attendance />
            </Suspense>
          )}
          {activeTab === "time-off" && !isComplianceLocked && (
            <Suspense fallback={<TabFallback />}>
              <LeaveManagement />
            </Suspense>
          )}
          {activeTab === "leave-calendar" && !isComplianceLocked && (
            <Suspense fallback={<TabFallback />}>
              <HolidayCalendar />
            </Suspense>
          )}
          {activeTab === "regularizations" && !isComplianceLocked && (
            <MyRegularizations />
          )}

          {/* Locked tab interstitial */}
          {activeTab !== null && isComplianceLocked && (
            <div className="flex flex-col items-center justify-center py-16 gap-4" data-testid="mydesk-locked-state">
              <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Lock className="h-7 w-7 text-amber-600" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">Training Required</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Complete your overdue training to access {TAB_LABELS[activeTab]}.
                </p>
              </div>
              <button
                className="text-sm text-primary underline underline-offset-2"
                onClick={() => setLocation("/admin/growth")}
                data-testid="link-go-to-training"
              >
                Go to My Growth →
              </button>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
