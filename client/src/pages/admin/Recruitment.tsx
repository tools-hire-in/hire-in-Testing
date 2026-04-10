import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Briefcase } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { AdminJobsContent } from "./Jobs";
import { AdminApplicationsContent } from "./Applications";

export default function Recruitment() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const params = new URLSearchParams(window.location.search);
  const requestedTab = params.get("tab");
  const validTabs = ["jobs", "applications"];
  const initialTab = requestedTab && validTabs.includes(requestedTab) ? requestedTab : "jobs";
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const url = new URL(window.location.href);
    if (value === "jobs") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", value);
    }
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-recruitment-title">
            <Briefcase className="h-6 w-6 text-primary" />
            Recruitment
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage job listings and candidate pipeline
          </p>
        </div>
        <Tabs value={activeTab} onValueChange={handleTabChange} data-testid="tabs-recruitment">
          <TabsList>
            <TabsTrigger value="jobs" data-testid="tab-jobs">Job Listings</TabsTrigger>
            <TabsTrigger value="applications" data-testid="tab-applications">Candidate Pipeline</TabsTrigger>
          </TabsList>
          <TabsContent value="jobs">
            <AdminJobsContent />
          </TabsContent>
          <TabsContent value="applications">
            <AdminApplicationsContent />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
