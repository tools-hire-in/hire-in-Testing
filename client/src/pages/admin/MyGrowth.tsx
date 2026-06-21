import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/use-auth";
import MyTraining from "./hr/MyTraining";
import Goals from "./performance/Goals";
import PerformanceCheckIns from "./performance/CheckIns";
import PerformanceFeedback from "./performance/Feedback";
import Reviews from "./performance/Reviews";
import PraiseBoard from "./performance/PraiseBoard";
import MyPlanView from "./hr/MyPlanView";

const BASE_TABS = ["praise", "training", "goals", "check-ins", "feedback", "reviews"] as const;
type BaseTab = typeof BASE_TABS[number];
type Tab = BaseTab | "my-plan";
const ALL_TABS = [...BASE_TABS, "my-plan"] as const;

function getTabFromSearch(hasPlan: boolean): Tab {
  try {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "my-plan" && !hasPlan) return "praise";
    if (tab && ALL_TABS.includes(tab as Tab)) return tab as Tab;
  } catch {}
  return "praise";
}

export default function MyGrowth() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const { data: myPlanData, isLoading: planLoading } = useQuery<any | null>({
    queryKey: ["/api/hr/my-plan"],
    enabled: isAuthenticated && !authLoading,
    staleTime: 1000 * 60 * 2,
  });

  const hasPlan = !planLoading && myPlanData !== null && myPlanData !== undefined
    && myPlanData?.plan?.department_scope === "healthcare";

  const [activeTab, setActiveTab] = useState<Tab>(() => getTabFromSearch(false));

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  // Once we know plan status, correct the active tab if needed
  useEffect(() => {
    if (!planLoading && activeTab === "my-plan" && !hasPlan) {
      setActiveTab("praise");
    }
  }, [planLoading, hasPlan, activeTab]);

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
          <TabsList className="flex flex-wrap gap-1 h-auto w-full max-w-2xl">
            <TabsTrigger value="praise" data-testid="tab-praise">🏅 Praise</TabsTrigger>
            <TabsTrigger value="training" data-testid="tab-training">Training</TabsTrigger>
            <TabsTrigger value="goals" data-testid="tab-goals">Goals</TabsTrigger>
            <TabsTrigger value="check-ins" data-testid="tab-check-ins">Check-Ins</TabsTrigger>
            <TabsTrigger value="feedback" data-testid="tab-feedback">Feedback</TabsTrigger>
            <TabsTrigger value="reviews" data-testid="tab-reviews">Reviews</TabsTrigger>
            {hasPlan && (
              <TabsTrigger value="my-plan" data-testid="tab-my-plan">My Plan</TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="praise" className="mt-4">
            <PraiseBoard />
          </TabsContent>
          <TabsContent value="training" className="mt-4">
            <MyTraining />
          </TabsContent>
          <TabsContent value="goals" className="mt-4">
            <Goals />
          </TabsContent>
          <TabsContent value="check-ins" className="mt-4">
            <PerformanceCheckIns />
          </TabsContent>
          <TabsContent value="feedback" className="mt-4">
            <PerformanceFeedback />
          </TabsContent>
          <TabsContent value="reviews" className="mt-4">
            <Reviews />
          </TabsContent>
          {hasPlan && (
            <TabsContent value="my-plan" className="mt-4">
              <MyPlanView />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AdminLayout>
  );
}
