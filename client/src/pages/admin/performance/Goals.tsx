import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Target } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { MyGoalsContent } from "./MyGoals";
import { TeamGoalsContent } from "./TeamGoals";

export default function Goals() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  const showTeamTab = ["super_admin", "admin", "hr", "manager"].includes(user?.role || "");

  const params = new URLSearchParams(window.location.search);
  const requestedTab = params.get("tab");
  const validTabs = ["my-goals", ...(showTeamTab ? ["team-goals"] : [])];
  const initialTab = requestedTab && validTabs.includes(requestedTab) ? requestedTab : "my-goals";
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const url = new URL(window.location.href);
    if (value === "my-goals") {
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
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-goals-title">
            <Target className="h-6 w-6 text-primary" />
            Goals
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track and manage performance goals
          </p>
        </div>
        <Tabs value={activeTab} onValueChange={handleTabChange} data-testid="tabs-goals">
          <TabsList>
            <TabsTrigger value="my-goals" data-testid="tab-my-goals">My Goals</TabsTrigger>
            {showTeamTab && (
              <TabsTrigger value="team-goals" data-testid="tab-team-goals">Team Goals</TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="my-goals">
            <MyGoalsContent />
          </TabsContent>
          {showTeamTab && (
            <TabsContent value="team-goals">
              <TeamGoalsContent />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AdminLayout>
  );
}
