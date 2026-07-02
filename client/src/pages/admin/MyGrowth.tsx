import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
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
  | "team-check-ins"
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
  const tabs: Tab[] = ["praise", "training", "my-goals", "check-ins", "feedback", "my-reviews"];
  if (hasPlan) tabs.push("my-plan");
  if (isManager) tabs.push("team-check-ins", "team-goals", "team-reviews", "employee-plans", "settings");
  if (isHrAdmin) tabs.push("training-mgmt");
  return tabs;
}

// Fall back to the closest visible tab when a requested tab is not allowed.
function resolveTab(raw: string, allowed: Tab[]): Tab {
  if (allowed.includes(raw as Tab)) return raw as Tab;
  switch (raw) {
    case "team-check-ins":
      return "check-ins";
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

interface NavItemProps {
  value: Tab;
  label: string;
  active: boolean;
  onClick: (tab: Tab) => void;
  testId: string;
}

function NavItem({ value, label, active, onClick, testId }: NavItemProps) {
  return (
    <button
      data-testid={testId}
      onClick={() => onClick(value)}
      className={cn(
        "w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors",
        active
          ? "bg-[#1F3A6E] text-white font-medium"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
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

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === "praise") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", tab);
    }
    window.history.replaceState({}, "", url.toString());
  };

  const showTeamGrowth = isManager || isHrAdmin;

  return (
    <AdminLayout>
      <div className="v2-surface space-y-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-mygrowth-title">My Growth</h1>
          <p className="text-sm text-muted-foreground">Recognition, training, goals, check-ins, feedback, and reviews</p>
        </div>

        <div className="flex gap-6 items-start" data-testid="tabs-mygrowth">
          {/* Left sidebar */}
          <nav className="w-48 shrink-0 space-y-4" aria-label="My Growth navigation">
            {/* Personal Growth group */}
            <div>
              <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground select-none">
                Personal Growth
              </p>
              <div className="space-y-0.5">
                <NavItem value="praise" label="🏅 Praise" active={activeTab === "praise"} onClick={handleTabChange} testId="tab-praise" />
                <NavItem value="training" label="Training" active={activeTab === "training"} onClick={handleTabChange} testId="tab-training" />
                <NavItem value="my-goals" label="My Goals" active={activeTab === "my-goals"} onClick={handleTabChange} testId="tab-my-goals" />
                <NavItem value="check-ins" label="Check-Ins" active={activeTab === "check-ins"} onClick={handleTabChange} testId="tab-check-ins" />
                <NavItem value="feedback" label="Feedback" active={activeTab === "feedback"} onClick={handleTabChange} testId="tab-feedback" />
                <NavItem value="my-reviews" label="My Reviews" active={activeTab === "my-reviews"} onClick={handleTabChange} testId="tab-my-reviews" />
                {hasPlan && (
                  <NavItem value="my-plan" label="My Plan" active={activeTab === "my-plan"} onClick={handleTabChange} testId="tab-my-plan" />
                )}
              </div>
            </div>

            {/* Team Growth group — manager/HR only */}
            {showTeamGrowth && (
              <div>
                <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground select-none">
                  Team Growth
                </p>
                <div className="space-y-0.5">
                  {isManager && (
                    <NavItem value="team-check-ins" label="Team Check-Ins" active={activeTab === "team-check-ins"} onClick={handleTabChange} testId="tab-team-check-ins" />
                  )}
                  {isManager && (
                    <NavItem value="team-goals" label="Team Goals" active={activeTab === "team-goals"} onClick={handleTabChange} testId="tab-team-goals" />
                  )}
                  {isManager && (
                    <NavItem value="team-reviews" label="Team Reviews" active={activeTab === "team-reviews"} onClick={handleTabChange} testId="tab-team-reviews" />
                  )}
                  {isManager && (
                    <NavItem value="employee-plans" label="Employee Plans" active={activeTab === "employee-plans"} onClick={handleTabChange} testId="tab-employee-plans" />
                  )}
                  {isHrAdmin && (
                    <NavItem value="training-mgmt" label="Training Mgmt" active={activeTab === "training-mgmt"} onClick={handleTabChange} testId="tab-training-mgmt" />
                  )}
                  {isManager && (
                    <NavItem value="settings" label="Settings" active={activeTab === "settings"} onClick={handleTabChange} testId="tab-settings" />
                  )}
                </div>
              </div>
            )}
          </nav>

          {/* Right content area */}
          <div className="flex-1 min-w-0">
            {activeTab === "praise" && <PraiseBoard />}
            {activeTab === "training" && <MyTraining />}
            {activeTab === "my-goals" && <MyGoalsContent />}
            {activeTab === "check-ins" && <PerformanceCheckIns mode="mine" />}
            {activeTab === "feedback" && <PerformanceFeedback />}
            {activeTab === "my-reviews" && <MyReviewsContent />}
            {activeTab === "my-plan" && hasPlan && <MyPlanView />}
            {activeTab === "team-check-ins" && isManager && <PerformanceCheckIns mode="team" />}
            {activeTab === "team-goals" && isManager && <TeamGoalsContent />}
            {activeTab === "team-reviews" && isManager && <TeamReviewsContent />}
            {activeTab === "employee-plans" && isManager && <HRPlansOverview />}
            {activeTab === "training-mgmt" && isHrAdmin && (
              <div className="space-y-6">
                <RayoAcademySettingsSection />
                <TrainingManagement />
              </div>
            )}
            {activeTab === "settings" && isManager && (
              <div className="space-y-4 max-w-5xl">
                <PerformanceSettingsSection />
                <GoalTemplatesSection />
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
