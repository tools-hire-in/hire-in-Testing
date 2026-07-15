import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { CommunicationsControlCenter } from "@/components/admin/CommunicationsControlCenter";
import AutomatedChanges from "@/pages/admin/AutomatedChanges";
import {
  Mail,
  ClipboardCheck,
  Flag,
  KeyRound,
  ScrollText,
  Settings2,
  Wrench,
  Users,
  Loader2,
  Radar,
  ShieldCheck,
  Shield,
} from "lucide-react";

const GovernanceHub = lazy(() => import("@/pages/admin/GovernanceHub"));

const FeatureFlagsSection = lazy(() =>
  import("@/pages/admin/hr/HRSettings").then((m) => ({ default: m.FeatureFlagsSection })),
);
const AccessControlSection = lazy(() =>
  import("@/pages/admin/hr/HRSettings").then((m) => ({ default: m.AccessControlSection })),
);
const TrainingSettingsSection = lazy(() =>
  import("@/pages/admin/hr/HRSettings").then((m) => ({ default: m.TrainingSettingsSection })),
);
const DataMaintenanceSection = lazy(() =>
  import("@/pages/admin/hr/HRSettings").then((m) => ({ default: m.DataMaintenanceSection })),
);
const AdminUsers = lazy(() => import("@/pages/admin/Users"));
const AuditLogsContent = lazy(() =>
  import("@/pages/admin/AuditLogs").then((m) => ({ default: m.AuditLogsContent })),
);
const AllowedDomainsSection = lazy(() =>
  import("@/pages/admin/hr/HRSettings").then((m) => ({ default: m.AllowedDomainsSection })),
);

import {
  type TowerTab,
  SUPER_ADMIN_TOWER_TABS,
  allowedTowerTabs,
  canAccessControlTower,
  towerLegacyTabRedirect,
} from "@/lib/control-tower-access";

function PanelFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

interface ControlPanel {
  key: TowerTab;
  label: string;
  description: string;
  icon: typeof Mail;
}

const PANELS: ControlPanel[] = [
  {
    key: "communications",
    label: "Communications Control Center",
    description: "Review, approve, and govern every automated email. Set per-type send policy.",
    icon: Mail,
  },
  {
    key: "automated-changes",
    label: "Automated Changes",
    description: "Approve or reject changes proposed by automated jobs before they apply.",
    icon: ClipboardCheck,
  },
  {
    key: "feature-flags",
    label: "Feature Flags",
    description: "Toggle platform features and modules on or off.",
    icon: Flag,
  },
  {
    key: "access-control",
    label: "Access Control Matrix",
    description: "Configure which roles can access each feature.",
    icon: KeyRound,
  },
  {
    key: "audit-logs",
    label: "Audit Logs",
    description: "Full audit trail of privileged and write operations across the system.",
    icon: ScrollText,
  },
  {
    key: "data-maintenance",
    label: "Data Maintenance",
    description: "Backfill, correction, and cleanup utilities for attendance and leave data.",
    icon: Wrench,
  },
  {
    key: "system-settings",
    label: "System Settings",
    description: "Leave types, holidays, attendance policy, shifts, departments, and company profile.",
    icon: Settings2,
  },
  {
    key: "user-management",
    label: "User Management",
    description: "Manage users and roles, including super-admin soft-delete.",
    icon: Users,
  },
  {
    key: "security",
    label: "Security",
    description: "Manage allowed login email domains and authentication settings.",
    icon: ShieldCheck,
  },
  {
    key: "governance",
    label: "Governance Hub",
    description: "Configure enforcement cadence for SOPs, PIPs, growth plans, and probation escalations.",
    icon: Shield,
  },
];

const TAB_LABELS: Record<TowerTab, string> = {
  overview: "Overview",
  communications: "Communications",
  "automated-changes": "Automated Changes",
  "feature-flags": "Feature Flags",
  "access-control": "Access Control",
  "audit-logs": "Audit Logs",
  "data-maintenance": "Data Maintenance",
  "system-settings": "System Settings",
  "user-management": "Users",
  "security": "Security",
  "governance": "Governance",
};

export default function ControlTower() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const role = user?.role;
  const isSuperAdmin = role === "super_admin";
  const canAccess = canAccessControlTower(role);
  const allowedTabs = allowedTowerTabs(role);

  const [tab, setTab] = useState<TowerTab>(() => {
    try {
      const t = new URLSearchParams(window.location.search).get("tab") as TowerTab | null;
      if (t && SUPER_ADMIN_TOWER_TABS.includes(t)) return t;
    } catch {}
    return "overview";
  });

  const changeTab = (next: TowerTab) => {
    setTab(next);
    try {
      const url = new URL(window.location.href);
      if (next === "overview") url.searchParams.delete("tab");
      else url.searchParams.set("tab", next);
      window.history.replaceState({}, "", url.toString());
    } catch {}
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLocation("/admin/login");
      return;
    }
    if (!canAccess) {
      setLocation("/admin");
      return;
    }
    // Legacy deep-link: System Settings now lives at /admin/settings.
    try {
      const legacy = towerLegacyTabRedirect(new URLSearchParams(window.location.search).get("tab"));
      if (legacy) {
        setLocation(legacy);
        return;
      }
    } catch {}
  }, [authLoading, isAuthenticated, canAccess, setLocation]);

  // Keep the active tab within what this role is allowed to see.
  useEffect(() => {
    if (authLoading || !isAuthenticated || !canAccess) return;
    if (!allowedTabs.includes(tab)) {
      changeTab(allowedTabs[0] ?? "overview");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, canAccess, role, tab]);

  const { data: heldData } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/communications/count"],
    enabled: isSuperAdmin,
  });
  const heldCount = heldData?.count ?? 0;

  if (authLoading || !isAuthenticated || !canAccess) return null;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary shrink-0">
              <Radar className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-control-tower-title">
                {isSuperAdmin ? "Control Tower" : role === "admin" ? "Governance Hub" : "Data Maintenance"}
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                {isSuperAdmin
                  ? "Super Admin only. One audited surface for the platform's highest-privilege controls."
                  : role === "admin"
                  ? "Org Pulse, SOP rollout visibility, and governance oversight."
                  : "Backfill, correction, and cleanup utilities for attendance and leave data."}
              </p>
            </div>
          </div>
        </div>

        <div className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1" data-testid="tabs-control-tower">
          {allowedTabs.map((key) => (
            <button
              key={key}
              onClick={() => changeTab(key)}
              data-testid={`nav-${key}`}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {TAB_LABELS[key]}
              {key === "communications" && heldCount > 0 && (
                <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white" data-testid="badge-held-count">
                  {heldCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "overview" && isSuperAdmin && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PANELS.map((panel) => {
              const Icon = panel.icon;
              const handleClick = () =>
                panel.key === "system-settings"
                  ? setLocation("/admin/settings")
                  : changeTab(panel.key);
              return (
                <button key={panel.key} onClick={handleClick} className="text-left">
                  <Card
                    className="group h-full cursor-pointer transition-shadow hover:shadow-md"
                    data-testid={`panel-${panel.key}`}
                  >
                    <CardContent className="flex h-full flex-col gap-3 p-5">
                      <div className="flex items-center justify-between">
                        <div className="rounded-lg bg-primary/10 p-2 text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        {panel.key === "communications" && heldCount > 0 && (
                          <Badge className="bg-amber-500 text-white hover:bg-amber-500" data-testid="badge-panel-held">
                            {heldCount} pending
                          </Badge>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">{panel.label}</div>
                        <p className="mt-1 text-sm text-muted-foreground">{panel.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              );
            })}
          </div>
        )}

        {tab === "communications" && <CommunicationsControlCenter />}
        {tab === "automated-changes" && <AutomatedChanges embedded />}
        {tab === "feature-flags" && (
          <Suspense fallback={<PanelFallback />}>
            <div className="space-y-6">
              <FeatureFlagsSection />
              <TrainingSettingsSection />
            </div>
          </Suspense>
        )}
        {tab === "access-control" && (
          <Suspense fallback={<PanelFallback />}>
            <AccessControlSection />
          </Suspense>
        )}
        {tab === "audit-logs" && (
          <Suspense fallback={<PanelFallback />}>
            <AuditLogsContent />
          </Suspense>
        )}
        {tab === "data-maintenance" && (
          <Suspense fallback={<PanelFallback />}>
            <DataMaintenanceSection />
          </Suspense>
        )}
        {tab === "user-management" && (
          <Suspense fallback={<PanelFallback />}>
            <AdminUsers />
          </Suspense>
        )}
        {tab === "security" && (
          <Suspense fallback={<PanelFallback />}>
            <AllowedDomainsSection />
          </Suspense>
        )}
        {tab === "governance" && (
          <Suspense fallback={<PanelFallback />}>
<<<<<<< HEAD
            <GovernanceHub />
=======
            <GovernanceHub readonly={role === "hr"} />
>>>>>>> c09c3f7 (feat: Governance Hub — 6-card Org Pulse, manager drill-downs, SOP Rollout Panel & Wave Impact Preview)
          </Suspense>
        )}
      </div>
    </AdminLayout>
  );
}
