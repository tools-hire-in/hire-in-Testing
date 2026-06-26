import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Users as UsersIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import { useAuth } from "@/hooks/use-auth";
import Users from "./Users";
import { SalaryReportsContent } from "./hr/SalaryReports";
import { DocumentComplianceContent } from "./hr/DocumentCompliance";
import { PolicyComplianceContent } from "./hr/PolicyCompliance";
import { AuditLogsContent } from "@/pages/admin/AuditLogs";
import TrainingManagement from "./hr/TrainingManagement";
import RegularizationsPanel from "./hr/RegularizationsPanel";
import { HRPlansOverview } from "@/components/hr/HRPlansOverview";
import AttendanceExceptions from "./hr/AttendanceExceptions";
import BalanceAdjustments from "./hr/BalanceAdjustments";
import {
  type PeopleHrTab,
  isAdminRole,
  isHrRole,
  isTabVisibleForRole,
  parsePeopleHrTab,
  visibleTabDefsForRole,
} from "@/lib/people-hr-tabs";

export default function PeopleHR() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { enabled: newLook } = useNewLook();

  const role = user?.role || "";
  const isAdmin = isAdminRole(role);
  const isHR = isHrRole(role);

  const visibleTabs = visibleTabDefsForRole(role);

  // Parse the deep-linked tab without depending on role, so a role-gated tab
  // (e.g. ?tab=balance-adjustments) is preserved through the auth-loading
  // phase. Role visibility is enforced once auth resolves (effect below).
  const [activeTab, setActiveTab] = useState<PeopleHrTab>(
    () => parsePeopleHrTab(window.location.search) ?? "users",
  );

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

  if (authLoading || !isAuthenticated) return null;

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
            subtitle="User management, balance adjustments, reports, training, and attendance"
            testId="text-peoplehr-title"
          />
        ) : (
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-peoplehr-title">People & HR</h1>
            <p className="text-sm text-muted-foreground">User management, balance adjustments, reports, training, and attendance</p>
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

          <TabsContent value="training" className="mt-4">
            <TrainingManagement />
          </TabsContent>

          <TabsContent value="regularizations" className="mt-4">
            <RegularizationsPanel />
          </TabsContent>

          {isHR && (
            <TabsContent value="plans" className="mt-4">
              <HRPlansOverview />
            </TabsContent>
          )}

          {isHR && (
            <TabsContent value="exceptions" className="mt-4">
              <div>
                <h2 className="text-lg font-semibold mb-1">Attendance Exceptions</h2>
                <p className="text-sm text-muted-foreground mb-4">Review short-day exceptions across all teams.</p>
                <AttendanceExceptions view="exceptions" />
              </div>
            </TabsContent>
          )}

          {isHR && (
            <TabsContent value="risk-summary" className="mt-4">
              <div>
                <h2 className="text-lg font-semibold mb-1">Attendance Risk Summary</h2>
                <p className="text-sm text-muted-foreground mb-4">Monitor attendance risk and escalation tiers across all teams.</p>
                <AttendanceExceptions view="risk-summary" />
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AdminLayout>
  );
}
