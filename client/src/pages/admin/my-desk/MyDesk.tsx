import { useEffect, useMemo, lazy, Suspense } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Lock, GraduationCap } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useNewLook } from "@/hooks/use-new-look";
import CommandCenter from "./CommandCenter";
import CommandCenterV2 from "./CommandCenterV2";
import MyRegularizations from "./MyRegularizations";
import MySops, { SopCoachingBanner } from "./MySops";

const Attendance = lazy(() => import("@/pages/admin/hr/Attendance"));
const LeaveManagement = lazy(() => import("@/pages/admin/hr/LeaveManagement"));
const HolidayCalendar = lazy(() => import("@/pages/admin/hr/HolidayCalendar"));

const TABS = [
  "time-card",
  "grace",
  "leave-balance",
  "apply-leave",
  "leave-history",
  "accrual",
  "leave-calendar",
  "regularizations",
  "my-sops",
] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  "time-card": "Time Card",
  "grace": "Grace Usage",
  "leave-balance": "Leave Balance",
  "apply-leave": "Apply Leave",
  "leave-history": "Leave History",
  "accrual": "Accrual",
  "leave-calendar": "Leave Calendar",
  "regularizations": "Regularizations",
  "my-sops": "My SOPs",
};

// Retired (nested) params → new single-level destinations, for old deep-links.
const LEGACY_TAB_MAP: Record<string, Tab> = {
  "time-off": "leave-balance",
  "leaves": "leave-balance",
  "attendance": "time-card",
  "holidays": "leave-calendar",
};

const GRACE_ROLES = ["hr", "admin", "super_admin", "manager"];

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
  const { enabled: newLook } = useNewLook();

  const canSeeGrace = GRACE_ROLES.includes(user?.role || "");

  const activeTab: Tab | null = useMemo(() => {
    try {
      const tab = new URLSearchParams(search).get("tab");
      if (tab && TABS.includes(tab as Tab)) return tab as Tab;
    } catch {}
    return null;
  }, [search]);

  // Normalize retired/nested deep-links to their new single-level destinations.
  // e.g. ?tab=time-off → ?tab=leave-balance, ?tab=time-card&att=grace → ?tab=grace,
  // and strip any leftover inner ?att= param.
  useEffect(() => {
    try {
      const sp = new URLSearchParams(search);
      const tab = sp.get("tab");
      const att = sp.get("att");
      let target: Tab | null = null;
      if (tab === "time-card" && att === "grace") target = "grace";
      else if (tab && LEGACY_TAB_MAP[tab]) target = LEGACY_TAB_MAP[tab];
      if (target) {
        setLocation(`/admin/my-desk?tab=${target}`);
      } else if (att) {
        sp.delete("att");
        const qs = sp.toString();
        setLocation(`/admin/my-desk${qs ? `?${qs}` : ""}`);
      }
    } catch {}
  }, [search, setLocation]);

  // Employees can't reach the Grace Usage view — bounce to Time Card.
  useEffect(() => {
    if (activeTab === "grace" && !canSeeGrace) {
      setLocation("/admin/my-desk?tab=time-card");
    }
  }, [activeTab, canSeeGrace, setLocation]);

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
      <div className="space-y-4 v2-surface">
        {/* Page header — only on the default Dashboard view; sub-tabs render their own
            headers. In the new look CommandCenterV2 renders its own hero, so the plain
            title would be redundant — suppress it there. */}
        {activeTab === null && !newLook && (
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-mydesk-title">My Desk</h1>
            <p className="text-sm text-muted-foreground">Your personal workspace — time, leave, and corrections</p>
          </div>
        )}

        {/* Soft-enforcement SOP coaching nudge (Task #662) — shown on the dashboard
            for users in the rollout pilot with un-acknowledged operational SOPs. */}
        {activeTab === null && <SopCoachingBanner />}

        {/* Content driven by sidebar sub-nav */}
        <div>
          {activeTab === null && (newLook ? <CommandCenterV2 /> : <CommandCenter />)}

          {activeTab === "time-card" && !isComplianceLocked && (
            <Suspense fallback={<TabFallback />}>
              <Attendance view="attendance" />
            </Suspense>
          )}
          {activeTab === "grace" && !isComplianceLocked && canSeeGrace && (
            <Suspense fallback={<TabFallback />}>
              <Attendance view="grace" />
            </Suspense>
          )}
          {activeTab === "leave-balance" && !isComplianceLocked && (
            <Suspense fallback={<TabFallback />}>
              <LeaveManagement view="balance" />
            </Suspense>
          )}
          {activeTab === "apply-leave" && !isComplianceLocked && (
            <Suspense fallback={<TabFallback />}>
              <LeaveManagement view="apply" />
            </Suspense>
          )}
          {activeTab === "leave-history" && !isComplianceLocked && (
            <Suspense fallback={<TabFallback />}>
              <LeaveManagement view="history" />
            </Suspense>
          )}
          {activeTab === "accrual" && !isComplianceLocked && (
            <Suspense fallback={<TabFallback />}>
              <LeaveManagement view="accrual" />
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
          {/* My SOPs stays reachable even when compliance-locked so the user can
              complete and acknowledge the SOPs that drive the lock. */}
          {activeTab === "my-sops" && (
            <MySops />
          )}

          {/* Locked tab interstitial */}
          {activeTab !== null && activeTab !== "my-sops" && isComplianceLocked && (
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
