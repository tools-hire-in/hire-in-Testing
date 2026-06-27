import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Users as UsersIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import { useAuth } from "@/hooks/use-auth";
import Users from "./Users";
import { SalaryReportsContent } from "./hr/SalaryReports";
import { DocumentComplianceContent } from "./hr/DocumentCompliance";
import { PolicyComplianceContent } from "./hr/PolicyCompliance";
import { AuditLogsContent } from "@/pages/admin/AuditLogs";
import RegularizationsPanel from "./hr/RegularizationsPanel";
import AttendanceExceptions from "./hr/AttendanceExceptions";
import BalanceAdjustments from "./hr/BalanceAdjustments";
import {
  type PeopleHrTab,
  isAdminRole,
  isHrRole,
  isTabVisibleForRole,
  parsePeopleHrTab,
  relocatedGrowthTab,
  visibleTabDefsForRole,
} from "@/lib/people-hr-tabs";

type EscalationView = "exceptions" | "risk-summary";

export default function PeopleHR() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { enabled: newLook } = useNewLook();

  const role = user?.role || "";
  const isAdmin = isAdminRole(role);
  const isHR = isHrRole(role);

  const visibleTabs = visibleTabDefsForRole(role);

  // Tabs that moved to Growth & Learning — redirect old deep links there.
  const relocated = relocatedGrowthTab(window.location.search);
  useEffect(() => {
    if (relocated) {
      setLocation(`/admin/growth?tab=${relocated}`);
    }
  }, [relocated, setLocation]);

  // Parse the deep-linked tab without depending on role, so a role-gated tab
  // (e.g. ?tab=balance-adjustments) is preserved through the auth-loading
  // phase. Role visibility is enforced once auth resolves (effect below).
  const [activeTab, setActiveTab] = useState<PeopleHrTab>(
    () => parsePeopleHrTab(window.location.search) ?? "users",
  );

  // Sub-view inside the merged "Attendance Escalations" tab.
  const [escalationView, setEscalationView] = useState<EscalationView>("exceptions");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (!authLoading && user && !["super_admin", "admin", "hr", "operations"].includes(role)) {
      setLocation("/admin/hr");
    }
  }, [authLoading, user, role, setLocation]);

  // Once auth resolves and the role is known, re-resolve the deep-linked tab
  // and snap to the default if the active tab is not visible for this role.
  useEffect(() => {
    if (authLoading || !user) return;
    const parsed = parsePeopleHrTab(window.location.search);
    if (parsed && isTabVisibleForRole(parsed, role) && parsed !== activeTab) {
      setActiveTab(parsed);
      return;
    }
    if (!isTabVisibleForRole(activeTab, role)) {
      setActiveTab("users");
    }
  }, [authLoading, user, role, activeTab]);

  if (authLoading || !isAuthenticated || relocated) return null;

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as PeopleHrTab);
    const url = new URL(window.location.href);
    if (tab === "users") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", tab);
    }
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <AdminLayout>
      <div className="space-y-4 v2-surface">
        {newLook ? (
          <V2PageHeader
            icon={UsersIcon}
            eyebrow="People & HR"
            title="People & HR"
            subtitle="User management, balance adjustments, reports, and attendance escalations"
            testId="text-peoplehr-title"
          />
        ) : (
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-peoplehr-title">People & HR</h1>
            <p className="text-sm text-muted-foreground">User management, balance adjustments, reports, and attendance escalations</p>
          </div>
        )}
        <Tabs value={activeTab} onValueChange={handleTabChange} data-testid="tabs-peoplehr">
          <TabsList className="flex flex-wrap gap-1 h-auto w-full">
            {visibleTabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} data-testid={t.testId}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="users" className="mt-4">
            <Users />
          </TabsContent>

          {isHR && (
            <TabsContent value="balance-adjustments" className="mt-4">
              <BalanceAdjustments />
            </TabsContent>
          )}

          {isHR && (
            <TabsContent value="salary" className="mt-4">
              <SalaryReportsContent />
            </TabsContent>
          )}

          {isHR && (
            <TabsContent value="compliance" className="mt-4">
              <DocumentComplianceContent />
            </TabsContent>
          )}

          {isHR && (
            <TabsContent value="policy" className="mt-4">
              <PolicyComplianceContent />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="audit" className="mt-4">
              <AuditLogsContent />
            </TabsContent>
          )}

          <TabsContent value="regularizations" className="mt-4">
            <RegularizationsPanel />
          </TabsContent>

          {isHR && (
            <TabsContent value="escalations" className="mt-4">
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Attendance Escalations</h2>
                  <p className="text-sm text-muted-foreground">
                    Review day-to-day short-day exceptions and monthly attendance risk tiers across all teams.
                  </p>
                </div>
                <div className="inline-flex rounded-md border bg-muted/30 p-1" role="tablist" data-testid="toggle-escalation-view">
                  <Button
                    type="button"
                    size="sm"
                    variant={escalationView === "exceptions" ? "default" : "ghost"}
                    className="h-7"
                    onClick={() => setEscalationView("exceptions")}
                    data-testid="button-escalation-exceptions"
                  >
                    Exceptions
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={escalationView === "risk-summary" ? "default" : "ghost"}
                    className="h-7"
                    onClick={() => setEscalationView("risk-summary")}
                    data-testid="button-escalation-risk-summary"
                  >
                    Risk Summary
                  </Button>
                </div>
                <AttendanceExceptions view={escalationView} />
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AdminLayout>
  );
}
