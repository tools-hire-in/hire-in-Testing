import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/use-auth";
import MyTraining from "./hr/MyTraining";
import { MyGoalsContent } from "./performance/MyGoals";
import { TeamGoalsContent } from "./performance/TeamGoals";
import PerformanceCheckIns from "./performance/CheckIns";
import PerformanceFeedback from "./performance/Feedback";
import { MyReviewsContent } from "./performance/MyReviews";
import { TeamReviewsContent } from "./performance/TeamReviews";
import PraiseBoard from "./performance/PraiseBoard";
import MyPlanView from "./hr/MyPlanView";
import { PerformanceSettingsSection, GoalTemplatesSection, RayoAcademySettingsSection } from "./hr/HRSettings";
import TrainingManagement from "./hr/TrainingManagement";
import { HRPlansOverview } from "@/components/hr/HRPlansOverview";

const MANAGER_ROLES = ["super_admin", "admin", "hr", "manager"];
const HR_ADMIN_ROLES = ["super_admin", "admin", "hr"];

type Tab =
  | "praise"
  | "training"
  | "my-goals"
  | "team-goals"
  | "check-ins"
  | "feedback"
  | "my-reviews"
  | "team-reviews"
  | "settings"
  | "my-plan"
  | "training-mgmt"
  | "employee-plans";

// Map legacy / retired deep-link params onto the flattened tab set.
function aliasTab(raw: string): string {
  switch (raw) {
    case "goals":
      return "my-goals";
    case "reviews":
      return "my-reviews";
    case "performance":
    case "goal-templates":
    case "templates":
      return "settings";
    // Relocated from People & HR.
    case "training-management":
      return "training-mgmt";
    case "plans":
    case "plans-overview":
      return "employee-plans";
    default:
      return raw;
  }
}

function getAllowedTabs(isManager: boolean, isHrAdmin: boolean, hasPlan: boolean): Tab[] {
  const tabs: Tab[] = ["praise", "training", "my-goals"];
  if (isManager) tabs.push("team-goals");
  tabs.push("check-ins", "feedback", "my-reviews");
  if (isManager) tabs.push("team-reviews");
  if (isManager) tabs.push("settings");
  if (hasPlan) tabs.push("my-plan");
  // Admin tools relocated from People & HR.
  if (isHrAdmin) tabs.push("training-mgmt");
  if (isManager) tabs.push("employee-plans");
  return tabs;
}

// Fall back to the closest visible tab when a requested tab is not allowed.
function resolveTab(raw: string, allowed: Tab[]): Tab {
  if (allowed.includes(raw as Tab)) return raw as Tab;
  switch (raw) {
    case "team-goals":
      return "my-goals";
    case "team-reviews":
      return "my-reviews";
    case "training-mgmt":
      return "training";
    case "employee-plans":
      return hasPlanFallback(allowed);
    default:
      return "praise";
  }
}

// When a non-manager lands on ?tab=employee-plans, prefer their own plan view
// if available, else the praise board.
function hasPlanFallback(allowed: Tab[]): Tab {
  return allowed.includes("my-plan") ? "my-plan" : "praise";
}

function getTabFromSearch(): string {
  try {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab) return aliasTab(tab);
  } catch {}
  return "praise";
}

export default function MyGrowth() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const { data: myPlanData, isLoading: planLoading } = useQuery<any | null>({
    queryKey: ["/api/hr/my-plan"],
    enabled: isAuthenticated && !authLoading,
    staleTime: 1000 * 60 * 2,
  });

  const hasPlan =
    !planLoading &&
    myPlanData !== null &&
    myPlanData !== undefined &&
    myPlanData?.plan?.department_scope === "healthcare";

  const isManager = MANAGER_ROLES.includes(user?.role || "");
  const isHrAdmin = HR_ADMIN_ROLES.includes(user?.role || "");
  const allowedTabs = getAllowedTabs(isManager, isHrAdmin, hasPlan);

  // Hold the raw (alias-resolved) requested tab; validate against role/plan once known.
  const [activeTab, setActiveTab] = useState<Tab>(() => getTabFromSearch() as Tab);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  // Once role + plan status are known, fall back if the active tab isn't allowed.
  useEffect(() => {
    if (authLoading || planLoading) return;
    setActiveTab((prev) => (allowedTabs.includes(prev) ? prev : resolveTab(prev, allowedTabs)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, planLoading, isManager, isHrAdmin, hasPlan]);

  if (authLoading || !isAuthenticated) return null;

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as Tab);
    const url = new URL(window.location.href);
    if (tab === "praise") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", tab);
    }
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <AdminLayout>
      <div className="v2-surface space-y-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-mygrowth-title">My Growth</h1>
          <p className="text-sm text-muted-foreground">Recognition, training, goals, check-ins, feedback, and reviews</p>
        </div>
        <Tabs value={activeTab} onValueChange={handleTabChange} data-testid="tabs-mygrowth">
          <TabsList className="flex flex-wrap gap-1 h-auto w-full max-w-3xl">
            <TabsTrigger value="praise" data-testid="tab-praise">🏅 Praise</TabsTrigger>
            <TabsTrigger value="training" data-testid="tab-training">Training</TabsTrigger>
            <TabsTrigger value="my-goals" data-testid="tab-my-goals">My Goals</TabsTrigger>
            {isManager && (
              <TabsTrigger value="team-goals" data-testid="tab-team-goals">Team Goals</TabsTrigger>
            )}
            <TabsTrigger value="check-ins" data-testid="tab-check-ins">Check-Ins</TabsTrigger>
            <TabsTrigger value="feedback" data-testid="tab-feedback">Feedback</TabsTrigger>
            <TabsTrigger value="my-reviews" data-testid="tab-my-reviews">My Reviews</TabsTrigger>
            {isManager && (
              <TabsTrigger value="team-reviews" data-testid="tab-team-reviews">Team Reviews</TabsTrigger>
            )}
            {isManager && (
              <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
            )}
            {hasPlan && (
              <TabsTrigger value="my-plan" data-testid="tab-my-plan">My Plan</TabsTrigger>
            )}
            {isHrAdmin && (
              <TabsTrigger value="training-mgmt" data-testid="tab-training-mgmt">Training Mgmt</TabsTrigger>
            )}
            {isManager && (
              <TabsTrigger value="employee-plans" data-testid="tab-employee-plans">Employee Plans</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="praise" className="mt-4">
            <PraiseBoard />
          </TabsContent>
          <TabsContent value="training" className="mt-4">
            <MyTraining />
          </TabsContent>
          <TabsContent value="my-goals" className="mt-4">
            <MyGoalsContent />
          </TabsContent>
          {isManager && (
            <TabsContent value="team-goals" className="mt-4">
              <TeamGoalsContent />
            </TabsContent>
          )}
          <TabsContent value="check-ins" className="mt-4">
            <PerformanceCheckIns />
          </TabsContent>
          <TabsContent value="feedback" className="mt-4">
            <PerformanceFeedback />
          </TabsContent>
          <TabsContent value="my-reviews" className="mt-4">
            <MyReviewsContent />
          </TabsContent>
          {isManager && (
            <TabsContent value="team-reviews" className="mt-4">
              <TeamReviewsContent />
            </TabsContent>
          )}
          {isManager && (
            <TabsContent value="settings" className="mt-4">
              <div className="space-y-4 max-w-5xl">
                <PerformanceSettingsSection />
                <GoalTemplatesSection />
              </div>
            </TabsContent>
          )}
          {hasPlan && (
            <TabsContent value="my-plan" className="mt-4">
              <MyPlanView />
            </TabsContent>
          )}
          {isHrAdmin && (
            <TabsContent value="training-mgmt" className="mt-4">
              <div className="space-y-6">
                <RayoAcademySettingsSection />
                <TrainingManagement />
              </div>
            </TabsContent>
          )}
          {isManager && (
            <TabsContent value="employee-plans" className="mt-4">
              <HRPlansOverview />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AdminLayout>
  );
}
