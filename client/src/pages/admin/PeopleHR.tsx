import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/use-auth";
import Users from "./Users";
import ReportsCompliance from "./hr/ReportsCompliance";
import TrainingManagement from "./hr/TrainingManagement";
import HRSettings from "./hr/HRSettings";

const TABS = ["users", "reports", "training", "settings"] as const;
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
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-peoplehr-title">People & HR</h1>
          <p className="text-sm text-muted-foreground">User management, reports, training, and settings</p>
        </div>
        <Tabs value={activeTab} onValueChange={handleTabChange} data-testid="tabs-peoplehr">
          <TabsList className="flex flex-wrap gap-1 h-auto w-full max-w-2xl">
            <TabsTrigger value="users" data-testid="tab-users">User Management</TabsTrigger>
            <TabsTrigger value="reports" data-testid="tab-reports">Reports</TabsTrigger>
            <TabsTrigger value="training" data-testid="tab-training-mgmt">Training Mgmt</TabsTrigger>
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
          <TabsContent value="settings" className="mt-4">
            <HRSettings />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
