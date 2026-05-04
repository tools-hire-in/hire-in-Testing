import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/use-auth";
import MyTraining from "./hr/MyTraining";
import Goals from "./performance/Goals";
import PerformanceCheckIns from "./performance/CheckIns";
import PerformanceFeedback from "./performance/Feedback";
import Reviews from "./performance/Reviews";

const TABS = ["training", "goals", "check-ins", "feedback", "reviews"] as const;
type Tab = typeof TABS[number];

function getTabFromSearch(): Tab {
  try {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab && TABS.includes(tab as Tab)) return tab as Tab;
  } catch {}
  return "training";
}

export default function MyGrowth() {
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
    if (tab === "training") {
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
          <h1 className="text-2xl font-bold" data-testid="text-mygrowth-title">My Growth</h1>
          <p className="text-sm text-muted-foreground">Training, goals, check-ins, feedback, and reviews</p>
        </div>
        <Tabs value={activeTab} onValueChange={handleTabChange} data-testid="tabs-mygrowth">
          <TabsList className="flex flex-wrap gap-1 h-auto w-full max-w-2xl">
            <TabsTrigger value="training" data-testid="tab-training">Training</TabsTrigger>
            <TabsTrigger value="goals" data-testid="tab-goals">Goals</TabsTrigger>
            <TabsTrigger value="check-ins" data-testid="tab-check-ins">Check-Ins</TabsTrigger>
            <TabsTrigger value="feedback" data-testid="tab-feedback">Feedback</TabsTrigger>
            <TabsTrigger value="reviews" data-testid="tab-reviews">Reviews</TabsTrigger>
          </TabsList>
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
        </Tabs>
      </div>
    </AdminLayout>
  );
}
