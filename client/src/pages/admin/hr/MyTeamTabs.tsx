import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/use-auth";
import MyTeam from "./MyTeam";
import TeamAttendance from "./TeamAttendance";
import LeaveApprovals from "./LeaveApprovals";
import TrainingProgress from "./TrainingProgress";
import AttendanceApproval from "./AttendanceApproval";
import TicketApprovalsTab from "./TicketApprovalsTab";

const TABS = ["overview", "attendance", "leave-approvals", "training-progress", "attendance-approval", "approvals"] as const;
type Tab = typeof TABS[number];

function getTabFromSearch(): Tab {
  try {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab && TABS.includes(tab as Tab)) return tab as Tab;
  } catch {}
  return "overview";
}

export default function MyTeamTabs() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>(getTabFromSearch);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (!authLoading && user) {
      const allowed = ["super_admin", "admin", "hr", "operations", "manager"];
      if (!allowed.includes(user.role || "")) setLocation("/admin/hr");
    }
  }, [authLoading, user, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as Tab);
    const url = new URL(window.location.href);
    if (tab === "overview") {
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
          <h1 className="text-2xl font-bold" data-testid="text-myteam-title">My Team</h1>
          <p className="text-sm text-muted-foreground">Team overview, attendance, leave approvals, training progress, and month-end approval</p>
        </div>
        <Tabs value={activeTab} onValueChange={handleTabChange} data-testid="tabs-myteam">
          <TabsList className="flex w-full max-w-4xl overflow-x-auto">
            <TabsTrigger value="overview" className="flex-1" data-testid="tab-team-overview">Overview</TabsTrigger>
            <TabsTrigger value="attendance" className="flex-1" data-testid="tab-team-attendance">Attendance</TabsTrigger>
            <TabsTrigger value="leave-approvals" className="flex-1" data-testid="tab-team-leave-approvals">Leave Approvals</TabsTrigger>
            <TabsTrigger value="training-progress" className="flex-1" data-testid="tab-team-training-progress">Training</TabsTrigger>
            <TabsTrigger value="attendance-approval" className="flex-1" data-testid="tab-team-attendance-approval">Month Approval</TabsTrigger>
            <TabsTrigger value="approvals" className="flex-1" data-testid="tab-team-approvals">Req. Approvals</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-4">
            <MyTeam />
          </TabsContent>
          <TabsContent value="attendance" className="mt-4">
            <TeamAttendance />
          </TabsContent>
          <TabsContent value="leave-approvals" className="mt-4">
            <LeaveApprovals />
          </TabsContent>
          <TabsContent value="training-progress" className="mt-4">
            <TrainingProgress />
          </TabsContent>
          <TabsContent value="attendance-approval" className="mt-4">
            <AttendanceApproval />
          </TabsContent>
          <TabsContent value="approvals" className="mt-4">
            <TicketApprovalsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
