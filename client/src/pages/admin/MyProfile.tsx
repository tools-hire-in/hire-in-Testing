import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/use-auth";
import HRProfile from "./hr/Profile";
import MyDocuments from "./hr/MyDocuments";
import OrgChart from "./hr/OrgChart";

const TABS = ["profile", "documents", "org-chart"] as const;
type Tab = typeof TABS[number];

function getTabFromSearch(): Tab {
  try {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab && TABS.includes(tab as Tab)) return tab as Tab;
    if (tab === "salary-slips") return "profile";
  } catch {}
  return "profile";
}

export default function MyProfile() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>(getTabFromSearch);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    try {
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (tab === "salary-slips") {
        setLocation("/admin/my-desk?tab=payslips");
      }
    } catch {}
  }, [setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as Tab);
    const url = new URL(window.location.href);
    if (tab === "profile") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", tab);
    }
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <AdminLayout>
      <div className="space-y-4 v2-surface">
        <div className="v2-page-head">
          <h1 className="text-2xl font-bold" data-testid="text-myprofile-title">My Profile</h1>
          <p className="text-sm text-muted-foreground">Your profile, documents, and org chart</p>
        </div>
        <Tabs value={activeTab} onValueChange={handleTabChange} data-testid="tabs-myprofile">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
            <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
            <TabsTrigger value="org-chart" data-testid="tab-org-chart">Org Chart</TabsTrigger>
          </TabsList>
          <TabsContent value="profile" className="mt-4">
            <HRProfile />
          </TabsContent>
          <TabsContent value="documents" className="mt-4">
            <MyDocuments />
          </TabsContent>
          <TabsContent value="org-chart" className="mt-4">
            <OrgChart />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
