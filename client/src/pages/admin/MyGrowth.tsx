import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  Award, BookOpen, Target, CalendarCheck, MessageSquare,
  ClipboardList, Map, Users, Flag, FileCheck, Briefcase,
  GraduationCap, Settings2,
} from "lucide-react";
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

type Segment = "my-growth" | "my-team" | "admin";

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

// Which segment each tab belongs to
const TAB_SEGMENT: Record<Tab, Segment> = {
  praise: "my-growth",
  training: "my-growth",
  "my-goals": "my-growth",
  "check-ins": "my-growth",
  feedback: "my-growth",
  "my-reviews": "my-growth",
  "my-plan": "my-growth",
  "team-check-ins": "my-team",
  "team-goals": "my-team",
  "team-reviews": "my-team",
  "employee-plans": "my-team",
  settings: "admin",
  "training-mgmt": "admin",
};

interface SubItem {
  tab: Tab;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

function getMyGrowthItems(hasPlan: boolean): SubItem[] {
  return [
    { tab: "praise", label: "Praise", Icon: Award },
    { tab: "training", label: "Training", Icon: BookOpen },
    { tab: "my-goals", label: "Goals", Icon: Target },
    { tab: "check-ins", label: "Check-Ins", Icon: CalendarCheck },
    { tab: "feedback", label: "Feedback", Icon: MessageSquare },
    { tab: "my-reviews", label: "Reviews", Icon: ClipboardList },
    ...(hasPlan ? [{ tab: "my-plan" as Tab, label: "My Plan", Icon: Map }] : []),
  ];
}

const MY_TEAM_ITEMS: SubItem[] = [
  { tab: "team-check-ins", label: "Check-Ins", Icon: CalendarCheck },
  { tab: "team-goals", label: "Goals", Icon: Flag },
  { tab: "team-reviews", label: "Reviews", Icon: FileCheck },
  { tab: "employee-plans", label: "Plans", Icon: Briefcase },
];

const ADMIN_ITEMS: SubItem[] = [
  { tab: "training-mgmt", label: "Training Mgmt", Icon: GraduationCap },
  { tab: "settings", label: "Settings", Icon: Settings2 },
];

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

  const [activeTab, setActiveTab] = useState<Tab>(() => getTabFromSearch() as Tab);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

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

  // Derive active segment from active tab
  const activeSegment: Segment = TAB_SEGMENT[activeTab] ?? "my-growth";

  const handleSegmentClick = (segment: Segment, items: SubItem[]) => {
    if (activeSegment === segment) return;
    const firstAllowed = items.find((it) => allowedTabs.includes(it.tab));
    if (firstAllowed) handleTabChange(firstAllowed.tab);
  };

  // Build segment list (only include segments the user has access to)
  const myGrowthItems = getMyGrowthItems(hasPlan);

  interface SegmentEntry {
    id: Segment;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    items: SubItem[];
  }

  const segments: SegmentEntry[] = [
    { id: "my-growth", label: "My Growth", Icon: Award, items: myGrowthItems },
    ...(MY_TEAM_ITEMS.some((it) => allowedTabs.includes(it.tab))
      ? [{ id: "my-team" as Segment, label: "My Team", Icon: Users, items: MY_TEAM_ITEMS }]
      : []),
    ...(ADMIN_ITEMS.some((it) => allowedTabs.includes(it.tab))
      ? [{ id: "admin" as Segment, label: "Admin", Icon: GraduationCap, items: ADMIN_ITEMS }]
      : []),
  ];

  const activeSeg = segments.find((s) => s.id === activeSegment) ?? segments[0];
  const subItems = activeSeg.items.filter((it) => allowedTabs.includes(it.tab));

  return (
    <AdminLayout>
      <div className="v2-surface space-y-4">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-mygrowth-title">My Growth</h1>
          <p className="text-sm text-muted-foreground">Recognition, training, goals, check-ins, feedback, and reviews</p>
        </div>

        {/* Top segment bar */}
        <nav
          className="flex gap-1 border-b overflow-x-auto"
          aria-label="My Growth segments"
          data-testid="tabs-mygrowth"
        >
          {segments.map((seg) => (
            <button
              key={seg.id}
              data-testid={`segment-${seg.id}`}
              onClick={() => handleSegmentClick(seg.id, seg.items)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeSegment === seg.id
                  ? "border-[#1F3A6E] text-[#1F3A6E]"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
              )}
            >
              <seg.Icon className="h-4 w-4 shrink-0" />
              {seg.label}
            </button>
          ))}
        </nav>

        {/* Secondary sub-nav chip row */}
        <div
          className="flex flex-wrap gap-2"
          aria-label="Section navigation"
        >
          {subItems.map((item) => (
            <button
              key={item.tab}
              data-testid={`tab-${item.tab}`}
              onClick={() => handleTabChange(item.tab)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border",
                activeTab === item.tab
                  ? "bg-[#F47C20] border-[#F47C20] text-white shadow-sm"
                  : "bg-background border-border text-muted-foreground hover:border-[#F47C20]/60 hover:text-foreground"
              )}
            >
              <item.Icon className="h-3.5 w-3.5 shrink-0" />
              {item.label}
            </button>
          ))}
        </div>

        {/* Content card */}
        <div className="bg-card rounded-xl border shadow-sm p-6 min-h-[400px]">
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
              <div className="overflow-x-auto">
                <TrainingManagement />
              </div>
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
    </AdminLayout>
  );
}
