import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/use-auth";
import HRDashboard from "./HRDashboard";
import Attendance from "./Attendance";
import LeaveManagement from "./LeaveManagement";
import HolidayCalendar from "./HolidayCalendar";

const TABS = ["dashboard", "attendance", "leaves", "holidays"] as const;
type Tab = typeof TABS[number];

function getTabFromSearch(): Tab {
  try {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab && TABS.includes(tab as Tab)) return tab as Tab;
  } catch {}
  return "dashboard";
}

export default function MyWork() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>(getTabFromSearch);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as Tab);
    const url = new URL(window.location.href);
    if (tab === "dashboard") {
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
          <h1 className="text-2xl font-bold" data-testid="text-mywork-title">My Work</h1>
          <p className="text-sm text-muted-foreground">Your dashboard, attendance, leaves, and holidays</p>
        </div>
        <Tabs value={activeTab} onValueChange={handleTabChange} data-testid="tabs-mywork">
          <TabsList className="grid grid-cols-4 w-full max-w-lg">
            <TabsTrigger value="dashboard" data-testid="tab-mywork-dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="attendance" data-testid="tab-mywork-attendance">Attendance</TabsTrigger>
            <TabsTrigger value="leaves" data-testid="tab-mywork-leaves">Leaves</TabsTrigger>
            <TabsTrigger value="holidays" data-testid="tab-mywork-holidays">Holidays</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard" className="mt-4">
            <HRDashboard />
          </TabsContent>
          <TabsContent value="attendance" className="mt-4">
            <Attendance />
          </TabsContent>
          <TabsContent value="leaves" className="mt-4">
            <LeaveManagement />
          </TabsContent>
          <TabsContent value="holidays" className="mt-4">
            <HolidayCalendar />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
