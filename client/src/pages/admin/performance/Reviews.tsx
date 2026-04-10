import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ClipboardList } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { MyReviewsContent } from "./MyReviews";
import { TeamReviewsContent } from "./TeamReviews";

export default function Reviews() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  const showTeamTab = ["super_admin", "admin", "hr", "manager"].includes(user?.role || "");

  const params = new URLSearchParams(window.location.search);
  const requestedTab = params.get("tab");
  const validTabs = ["my-reviews", ...(showTeamTab ? ["team-reviews"] : [])];
  const initialTab = requestedTab && validTabs.includes(requestedTab) ? requestedTab : "my-reviews";
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const url = new URL(window.location.href);
    if (value === "my-reviews") {
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
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-reviews-title">
            <ClipboardList className="h-6 w-6 text-primary" />
            Reviews
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            View and manage performance reviews
          </p>
        </div>
        <Tabs value={activeTab} onValueChange={handleTabChange} data-testid="tabs-reviews">
          <TabsList>
            <TabsTrigger value="my-reviews" data-testid="tab-my-reviews">My Reviews</TabsTrigger>
            {showTeamTab && (
              <TabsTrigger value="team-reviews" data-testid="tab-team-reviews">Team Reviews</TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="my-reviews">
            <MyReviewsContent />
          </TabsContent>
          {showTeamTab && (
            <TabsContent value="team-reviews">
              <TeamReviewsContent />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AdminLayout>
  );
}
