import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Users as UsersIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import { useAuth } from "@/hooks/use-auth";
import Users from "./Users";
import ReportsCompliance from "./hr/ReportsCompliance";
import TrainingManagement from "./hr/TrainingManagement";
import HRSettings from "./hr/HRSettings";
import RegularizationsPanel from "./hr/RegularizationsPanel";
import { HRPlansOverview } from "@/components/hr/HRPlansOverview";
import AttendanceExceptions from "./hr/AttendanceExceptions";

const TABS = ["users", "reports", "training", "regularizations", "plans", "exceptions", "settings"] as const;
type Tab = typeof TABS[number];

function getTabFromSearch(): Tab {
  try {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab && TABS.includes(tab as Tab)) return tab as Tab;
  } catch {}
  return "users";
}

export default function PeopleHR() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { enabled: newLook } = useNewLook();
  const [activeTab, setActiveTab] = useState<Tab>(getTabFromSearch);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (!authLoading && user && !["super_admin", "admin", "hr", "operations"].includes(user.role || "")) {
      setLocation("/admin/hr");
    }
  }, [authLoading, user, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as Tab);
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
      <div className="space-y-4">
        {newLook ? (
          <V2PageHeader
            icon={UsersIcon}
            eyebrow="People & HR"
            title="People & HR"
            subtitle="User management, reports, training, regularizations, and settings"
            testId="text-peoplehr-title"
          />
        ) : (
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-peoplehr-title">People & HR</h1>
            <p className="text-sm text-muted-foreground">User management, reports, training, regularizations, and settings</p>
          </div>
        )}
        <Tabs value={activeTab} onValueChange={handleTabChange} data-testid="tabs-peoplehr">
          <TabsList className="flex flex-wrap gap-1 h-auto w-full max-w-3xl">
            <TabsTrigger value="users" data-testid="tab-users">User Management</TabsTrigger>
            <TabsTrigger value="reports" data-testid="tab-reports">Reports</TabsTrigger>
            <TabsTrigger value="training" data-testid="tab-training-mgmt">Training Mgmt</TabsTrigger>
            <TabsTrigger value="regularizations" data-testid="tab-regularizations">Regularizations</TabsTrigger>
            {["super_admin", "admin", "hr"].includes(user?.role || "") && (
              <TabsTrigger value="plans" data-testid="tab-plans">Plans Overview</TabsTrigger>
            )}
            {["super_admin", "admin", "hr"].includes(user?.role || "") && (
              <TabsTrigger value="exceptions" data-testid="tab-exceptions">Att. Exceptions</TabsTrigger>
            )}
            <TabsTrigger value="settings" data-testid="tab-hr-settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="users" className="mt-4">
            <Users />
          </TabsContent>
          <TabsContent value="reports" className="mt-4">
            <ReportsCompliance />
          </TabsContent>
          <TabsContent value="training" className="mt-4">
            <TrainingManagement />
          </TabsContent>
          <TabsContent value="regularizations" className="mt-4">
            <RegularizationsPanel />
          </TabsContent>
          {["super_admin", "admin", "hr"].includes(user?.role || "") && (
            <TabsContent value="plans" className="mt-4">
              <HRPlansOverview />
            </TabsContent>
          )}
          {["super_admin", "admin", "hr"].includes(user?.role || "") && (
            <TabsContent value="exceptions" className="mt-4">
              <div>
                <h2 className="text-lg font-semibold mb-1">Attendance Exceptions</h2>
                <p className="text-sm text-muted-foreground mb-4">Review short-day exceptions and monitor attendance risk across all teams.</p>
                <AttendanceExceptions />
              </div>
            </TabsContent>
          )}
          <TabsContent value="settings" className="mt-4">
            <HRSettings />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
