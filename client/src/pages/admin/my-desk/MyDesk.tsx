import { useEffect, useMemo, lazy, Suspense, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Lock, Info, ChevronDown, CalendarCheck, Plus } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useNewLook } from "@/hooks/use-new-look";
import { Button } from "@/components/ui/button";
import CommandCenter from "./CommandCenter";
import CommandCenterV2 from "./CommandCenterV2";
import MyRegularizations from "./MyRegularizations";
import MySops, { SopCoachingBanner } from "./MySops";

const Attendance = lazy(() => import("@/pages/admin/hr/Attendance"));
const LeaveManagement = lazy(() => import("@/pages/admin/hr/LeaveManagement"));
const HolidayCalendar = lazy(() => import("@/pages/admin/hr/HolidayCalendar"));
const SalarySlips = lazy(() => import("@/pages/admin/hr/SalarySlips"));

const TABS = [
  "time-card",
  "leave-balance",
  "leave-calendar",
  "payslips",
  "my-sops",
] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  "time-card": "Attendance",
  "leave-balance": "Leaves",
  "leave-calendar": "Holiday Calendar",
  "payslips": "Payslips",
  "my-sops": "My SOPs",
};

// Legacy tab slugs → new consolidated destinations.
// Redirects run before render so activeTab never holds a retired slug.
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

function SubTabStrip({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-border mb-5">
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          data-testid={`subtab-${key}`}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            active === key
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function AccrualInfoSection() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-5 rounded-lg border border-dashed border-border">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        data-testid="button-accrual-info-toggle"
      >
        <span className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
          <Info className="h-4 w-4" />
          How is my balance calculated?
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 border-t pt-3 space-y-2 text-xs text-muted-foreground">
          <p>
            <strong className="text-foreground">Earned Leave (EL):</strong>{" "}
            Accrues 1 day/month (2 days in January, May, September — bonus months). Max carry-forward: 45 days.
            Balance beyond the cap lapses at year-end.
          </p>
          <p>
            <strong className="text-foreground">Sick/Casual Leave (SL):</strong>{" "}
            Accrues ~0.67 days/month. Entire unused balance lapses on 31 December each year.
          </p>
          <p>
            <strong className="text-foreground">Emergency Leave (EML):</strong>{" "}
            Up to 3 occurrences per year (bereavement, medical emergency, legal obligation). Not accrual-based.
          </p>
          <p>
            <strong className="text-foreground">Comp-Off:</strong>{" "}
            Granted by HR after approved comp-off work. Expires within 90 days of the approval date.
          </p>
          <p className="text-muted-foreground/70">
            Accrual is credited on the 1st of each month for the prior month. Minimum hours worked in a month may
            affect eligibility.
          </p>
        </div>
      )}
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

  // Primary tab (sidebar-level)
  const activeTab: Tab | null = useMemo(() => {
    try {
      const tab = new URLSearchParams(search).get("tab");
      if (tab && TABS.includes(tab as Tab)) return tab as Tab;
    } catch {}
    return null;
  }, [search]);

  // Secondary params for internal sub-tabs
  const attSubTab = useMemo(() => {
    try { return new URLSearchParams(search).get("att") || "time-card"; } catch { return "time-card"; }
  }, [search]);

  const lvSubTab = useMemo(() => {
    try { return new URLSearchParams(search).get("lv") || "balance"; } catch { return "balance"; }
  }, [search]);

  // Redirect legacy / retired tab slugs to their new consolidated destinations.
  useEffect(() => {
    try {
      const sp = new URLSearchParams(search);
      const tab = sp.get("tab");

      if (tab === "grace") {
        setLocation("/admin/my-desk?tab=time-card&att=grace");
        return;
      }
      if (tab === "regularizations") {
        setLocation("/admin/my-desk?tab=time-card&att=corrections");
        return;
      }
      if (tab === "apply-leave") {
        setLocation("/admin/my-desk?tab=leave-balance&lv=apply");
        return;
      }
      if (tab === "leave-history") {
        setLocation("/admin/my-desk?tab=leave-balance&lv=history");
        return;
      }
      if (tab === "accrual") {
        setLocation("/admin/my-desk?tab=leave-balance");
        return;
      }
      // Old single-word aliases
      if (tab === "time-off" || tab === "leaves") {
        setLocation("/admin/my-desk?tab=leave-balance");
        return;
      }
      if (tab === "attendance") {
        setLocation("/admin/my-desk?tab=time-card");
        return;
      }
      if (tab === "holidays") {
        setLocation("/admin/my-desk?tab=leave-calendar");
        return;
      }
    } catch {}
  }, [search, setLocation]);

  // Employees can't reach Grace Usage — bounce to Time Card.
  useEffect(() => {
    if (activeTab === "time-card" && attSubTab === "grace" && !canSeeGrace) {
      setLocation("/admin/my-desk?tab=time-card");
    }
  }, [activeTab, attSubTab, canSeeGrace, setLocation]);

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

  // Attendance internal sub-tabs
  const attTabs = [
    { key: "time-card", label: "Time Card" },
    { key: "corrections", label: "Corrections" },
    ...(canSeeGrace ? [{ key: "grace", label: "Grace Usage" }] : []),
  ];

  // Leaves internal sub-tabs (Balance + History only in the strip; Apply is via button)
  const lvTabs = [
    { key: "balance", label: "Balance" },
    { key: "history", label: "History" },
  ];

  const setAttTab = (key: string) => setLocation(`/admin/my-desk?tab=time-card&att=${key}`);
  const setLvTab = (key: string) => {
    if (key === "balance") setLocation("/admin/my-desk?tab=leave-balance");
    else setLocation(`/admin/my-desk?tab=leave-balance&lv=${key}`);
  };

  return (
    <AdminLayout>
      <div className="space-y-4 v2-surface">
        {activeTab === null && !newLook && (
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-mydesk-title">My Desk</h1>
            <p className="text-sm text-muted-foreground">Your personal workspace — time, leave, and corrections</p>
          </div>
        )}

        {activeTab === null && <SopCoachingBanner />}

        <div>
          {activeTab === null && (newLook ? <CommandCenterV2 /> : <CommandCenter />)}

          {/* ── ATTENDANCE (time-card) ── */}
          {activeTab === "time-card" && !isComplianceLocked && (
            <div>
              <SubTabStrip
                tabs={attTabs}
                active={attSubTab}
                onChange={setAttTab}
              />
              {(attSubTab === "time-card" || attSubTab === null) && (
                <Suspense fallback={<TabFallback />}>
                  <Attendance view="attendance" />
                </Suspense>
              )}
              {attSubTab === "corrections" && <MyRegularizations />}
              {attSubTab === "grace" && canSeeGrace && (
                <Suspense fallback={<TabFallback />}>
                  <Attendance view="grace" />
                </Suspense>
              )}
            </div>
          )}

          {/* ── LEAVES (leave-balance) ── */}
          {activeTab === "leave-balance" && !isComplianceLocked && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <SubTabStrip
                  tabs={lvTabs}
                  active={lvSubTab === "apply" ? "balance" : lvSubTab}
                  onChange={setLvTab}
                />
                {lvSubTab !== "apply" && (
                  <div className="mb-5 ml-3 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => setLocation("/admin/my-desk?tab=leave-balance&lv=apply")}
                      data-testid="button-apply-leave-header"
                    >
                      <Plus className="h-4 w-4 mr-1.5" />
                      Apply Leave
                    </Button>
                  </div>
                )}
              </div>

              {(lvSubTab === "balance" || lvSubTab === null) && (
                <>
                  <Suspense fallback={<TabFallback />}>
                    <LeaveManagement view="balance" />
                  </Suspense>
                  <AccrualInfoSection />
                </>
              )}
              {lvSubTab === "history" && (
                <Suspense fallback={<TabFallback />}>
                  <LeaveManagement view="history" />
                </Suspense>
              )}
              {lvSubTab === "apply" && (
                <>
                  <div className="mb-4">
                    <button
                      onClick={() => setLocation("/admin/my-desk?tab=leave-balance")}
                      className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                      data-testid="button-back-to-balance"
                    >
                      ← Back to Balance
                    </button>
                  </div>
                  <Suspense fallback={<TabFallback />}>
                    <LeaveManagement view="apply" />
                  </Suspense>
                </>
              )}
            </div>
          )}

          {/* ── HOLIDAY CALENDAR ── */}
          {activeTab === "leave-calendar" && !isComplianceLocked && (
            <Suspense fallback={<TabFallback />}>
              <HolidayCalendar />
            </Suspense>
          )}

          {/* ── PAYSLIPS ── */}
          {activeTab === "payslips" && !isComplianceLocked && (
            <Suspense fallback={<TabFallback />}>
              <SalarySlips />
            </Suspense>
          )}

          {/* ── MY SOPs — reachable even when compliance-locked ── */}
          {activeTab === "my-sops" && (
            <MySops />
          )}

          {/* ── Compliance-locked interstitial ── */}
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
